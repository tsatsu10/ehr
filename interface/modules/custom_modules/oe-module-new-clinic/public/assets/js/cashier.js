(function (window) {
    'use strict';

    var POLL_MS = 30000;
    var activeVisit = null;
    var activePreview = null;
    var activeCharges = [];
    var chargesTotal = 0;
    var feeScheduleList = [];
    var stagedChargeLines = [];
    var pollTimer = null;
    var pendingPaymentAmount = 0;
    var pendingPayConfirm = null;
    var pendingClientRequestId = null;
    var pendingTerminalAction = null;
    var activeCompletionBlocked = false;
    var activeCanSkipCompletion = false;
    var searchDebounce = null;
    var STORAGE_KEY = 'cashier_desk_active_visit_id';

    function newClientRequestId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }

        return 'pay-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    }

    function canApplyDiscount(root) {
        return root.dataset.canApplyDiscount === '1';
    }

    function canEsignOverride(root, signMeta) {
        return root.dataset.canEsignOverride === '1' || !!(signMeta && signMeta.can_esign_override);
    }

    function restoreOpenEmrSession() {
        try {
            if (window.top && typeof window.top.restoreSession === 'function') {
                window.top.restoreSession();
            }
        } catch (e) {
            // iframe cross-origin — ignore
        }
    }

    function parseJsonResponse(response) {
        return window.NewClinicUI.parseJsonResponse(response);
    }

    function postJson(url, body) {
        restoreOpenEmrSession();
        return window.NewClinicUI.postJson(url, body);
    }

    function getJson(url) {
        restoreOpenEmrSession();
        return window.NewClinicUI.getJson(url);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function showModal(modal, backdrop) {
        if (window.NewClinicModal) {
            window.NewClinicModal.show(modal, backdrop);
            return;
        }
        modal.style.display = 'block';
        modal.classList.add('show');
        backdrop.style.display = 'block';
        backdrop.classList.add('show');
        document.body.classList.add('modal-open');
    }

    function hideModal(modal, backdrop) {
        if (window.NewClinicModal) {
            window.NewClinicModal.hide(modal, backdrop);
            return;
        }
        modal.style.display = 'none';
        modal.classList.remove('show');
        backdrop.style.display = 'none';
        backdrop.classList.remove('show');
        document.body.classList.remove('modal-open');
    }

    function formatMoney(amount) {
        return Number(amount || 0).toFixed(2);
    }

    function renderQueueCard(card) {
        var urgent = parseInt(card.is_urgent, 10)
            ? '<span class="badge badge-warning ml-1">URGENT</span>' : '';
        var total = card.charges_total > 0
            ? '<span class="badge badge-light border ml-1">' + formatMoney(card.charges_total) + '</span>'
            : '<span class="badge badge-warning ml-1">No charges</span>';

        return window.NewClinicUI.renderQueueCard(card, {
            showChiefComplaint: false,
            badgesHtml: urgent + total,
            subtitleHtml: '<div class="oe-nc-queue-card__meta small text-muted">' +
                escapeHtml(card.wait_minutes) + 'm · ' + escapeHtml(card.visit_type_label || 'Visit') +
                '</div>',
            dataAttributes: {
                'visit-id': card.id
            }
        });
    }

    function renderChargesTable(charges, total) {
        if (!charges.length) {
            return '<div class="alert alert-warning mb-0">No charges posted yet. Add lines from the clinic fee schedule below.</div>';
        }

        var rows = charges.map(function (line) {
            return '<tr><td>' + escapeHtml(line.code) + '</td>' +
                '<td>' + escapeHtml(line.description) + '</td>' +
                '<td class="text-right">' + escapeHtml(line.units) + '</td>' +
                '<td class="text-right">' + formatMoney(line.amount) + '</td></tr>';
        }).join('');

        return '<table class="table table-sm table-bordered mb-0">' +
            '<thead><tr><th>Code</th><th>Description</th><th class="text-right">Qty</th>' +
            '<th class="text-right">Amount</th></tr></thead><tbody>' + rows +
            '</tbody><tfoot><tr><th colspan="3" class="text-right">Total</th>' +
            '<th class="text-right">' + formatMoney(total) + '</th></tr></tfoot></table>';
    }

    function buildStagedFromSuggestions(suggested, charges) {
        var postedCodes = {};
        (charges || []).forEach(function (line) {
            postedCodes[line.code] = true;
        });

        return (suggested || []).filter(function (fee) {
            return !postedCodes[fee.billing_code] && !postedCodes[fee.code];
        }).map(function (fee) {
            return {
                fee_schedule_id: fee.id,
                code: fee.code,
                name: fee.name,
                units: 1,
                unit_price: fee.price_amount,
                suggested: true
            };
        });
    }

    function renderChargePicker(feeSchedule, staged, allowDiscount) {
        if (!feeSchedule.length) {
            return '<div class="alert alert-info py-2 mb-3">' +
                'No clinic fee schedule yet. An admin can add fee lines under <strong>Clinic Setup → Fees</strong>.' +
                '</div>';
        }

        var options = feeSchedule.map(function (fee) {
            return '<option value="' + escapeHtml(fee.id) + '">' +
                escapeHtml(fee.name) + ' (' + escapeHtml(fee.code) + ') — ' +
                formatMoney(fee.price_amount) + '</option>';
        }).join('');

        var stagedRows = staged.length
            ? staged.map(function (line, index) {
                var badge = line.suggested
                    ? ' <span class="badge badge-info">Suggested</span>' : '';
                var priceCell = allowDiscount
                    ? '<input type="number" min="0" step="0.01" class="form-control form-control-sm nc-staged-price" ' +
                    'data-index="' + index + '" value="' + escapeHtml(line.unit_price) + '">'
                    : '<span class="d-inline-block py-1">' + formatMoney(line.unit_price) + '</span>';

                return '<tr data-staged-index="' + index + '">' +
                    '<td>' + escapeHtml(line.name) + badge + '<br>' +
                    '<span class="small text-muted"><code>' + escapeHtml(line.code) + '</code></span></td>' +
                    '<td class="text-right" style="width:90px;">' +
                    '<input type="number" min="1" max="99" step="1" class="form-control form-control-sm nc-staged-units" ' +
                    'data-index="' + index + '" value="' + escapeHtml(line.units) + '"></td>' +
                    '<td class="text-right" style="width:110px;">' + priceCell + '</td>' +
                    '<td class="text-right" style="width:40px;">' +
                    '<button type="button" class="btn btn-link btn-sm text-danger p-0 nc-staged-remove" data-index="' +
                    index + '">&times;</button></td></tr>';
            }).join('')
            : '<tr><td colspan="4" class="text-muted"><em>Select fees to post, or use suggested lines.</em></td></tr>';

        return '<div class="card mb-3 border-primary">' +
            '<div class="card-body py-3">' +
            '<h6 class="mb-2">Add charges from clinic fee schedule</h6>' +
            '<div class="form-row align-items-end mb-2">' +
            '<div class="form-group col-md-8 mb-2">' +
            '<label class="small mb-1" for="nc-cashier-fee-pick">Fee line</label>' +
            '<select class="form-control form-control-sm" id="nc-cashier-fee-pick">' +
            '<option value="">Choose a fee line…</option>' + options + '</select></div>' +
            '<div class="form-group col-md-4 mb-2">' +
            '<button type="button" class="btn btn-outline-primary btn-sm btn-block" id="nc-cashier-fee-add">Add to list</button>' +
            '</div></div>' +
            '<table class="table table-sm table-bordered mb-2">' +
            '<thead><tr><th>Description</th><th class="text-right">Qty</th>' +
            '<th class="text-right">Unit price</th><th></th></tr></thead>' +
            '<tbody id="nc-cashier-staged-body">' + stagedRows + '</tbody></table>' +
            '<button type="button" class="btn btn-primary btn-sm" id="nc-cashier-post-charges"' +
            (staged.length ? '' : ' disabled') + '>Post charges to visit</button>' +
            '</div></div>';
    }

    function stagedLineTotal() {
        var sum = 0;
        stagedChargeLines.forEach(function (line) {
            sum += (parseFloat(line.unit_price, 10) || 0) * (parseInt(line.units, 10) || 1);
        });
        return sum;
    }

    function refreshActivePaneFromData(root, data) {
        activeVisit = data.visit;
        activePreview = data.preview;
        activeCharges = data.charges || [];
        chargesTotal = data.charges_total || 0;
        feeScheduleList = data.fee_schedule || [];
        activeCompletionBlocked = !!data.completion_blocked;
        activeCanSkipCompletion = !!(data.can_skip_completion || root.dataset.canSkipCompletion === '1');
        if (activeVisit && window.NewClinicUI) {
            window.NewClinicUI.setDeskActiveVisitId(STORAGE_KEY, activeVisit.id);
        }
        if (!activeCharges.length && stagedChargeLines.length === 0) {
            stagedChargeLines = buildStagedFromSuggestions(data.suggested_fees || [], activeCharges);
        }
        renderActivePane(
            root,
            activePreview,
            activeVisit,
            activeCharges,
            chargesTotal,
            data.completion_blocked,
            activeCanSkipCompletion,
            {
                front_payment_url: data.front_payment_url || '#',
                fee_sheet_url: data.fee_sheet_url || '#',
                can_close_without_charge: data.can_close_without_charge
            },
            {
                encounter_signed: data.encounter_signed !== false,
                unsigned_message: data.unsigned_message || '',
                encounter_url: data.encounter_url || '',
                can_esign_override: data.can_esign_override === true
            },
            feeScheduleList,
            stagedChargeLines,
            data.can_apply_discount === true
        );
    }

    function showPaneError(root, errorEl, message) {
        var el = errorEl || root.querySelector('#nc-cashier-error');
        if (el) {
            el.textContent = message;
            el.classList.remove('d-none');
        } else {
            window.alert(message);
        }
    }

    function handleApiFailure(root, result, errorEl) {
        var payload = result.payload || {};
        var code = (payload.data || {}).code || '';
        var conflict = window.NewClinicUI ? window.NewClinicUI.resolveVisitConflict(result) : null;

        if (conflict && (conflict.type === 'stale_visit' || conflict.type === 'visit_not_takeable')) {
            showPaneError(root, errorEl, conflict.message || 'Another user updated this visit. Refreshing queue.');
            clearActivePane(root);
            loadQueue(root);
            return true;
        }

        if (conflict && conflict.type === 'taken_elsewhere') {
            showPaneError(root, errorEl, conflict.message || 'This visit was claimed by another user.');
            clearActivePane(root);
            loadQueue(root);
            return true;
        }

        if (result.status === 409 && code === 'encounter_unsigned') {
            var encounterUrl = (payload.data || {}).encounter_url || '';
            if (errorEl) {
                errorEl.textContent = payload.message || 'Documentation not signed';
                errorEl.classList.remove('d-none');
            }
            if (encounterUrl) {
                window.open(encounterUrl, '_blank', 'noopener,noreferrer');
            }
            return true;
        }
        var message = payload.message || 'Request failed';
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('d-none');
        } else {
            window.alert(message);
        }
        return false;
    }

    function renderCompletionBlock(completion, blocked, canSkip) {
        if (!completion || completion.score === undefined) {
            return '';
        }

        var threshold = completion.billing_threshold || 70;
        var missing = completion.missing_labels || [];
        var missingHtml = missing.length
            ? '<ul class="mb-0 pl-3 small">' + missing.map(function (label) {
                return '<li>' + escapeHtml(label) + '</li>';
            }).join('') + '</ul>'
            : '';
        var demoUrl = completion.chart_url || completion.demographics_url || '';
        var demoLink = demoUrl
            ? ' <a href="' + escapeHtml(demoUrl) + '">Complete profile</a>'
            : '';
        var badgeClass = blocked ? 'badge-warning' : 'badge-success';

        var warnHtml = '';
        if (blocked) {
            var overrideNote = canSkip
                ? ' You may proceed with supervisor override.'
                : ' Payment is blocked until the profile is updated.';
            warnHtml = '<div class="alert alert-warning py-2 mb-2">' +
                'Profile ' + escapeHtml(completion.score) + '% complete (' +
                escapeHtml(threshold) + '% required).' + overrideNote +
                demoLink + missingHtml + '</div>';
        }

        return '<div class="mb-2"><span class="badge ' + badgeClass + '">' +
            escapeHtml(completion.score) + '% complete</span>' +
            (blocked && !canSkip ? ' <span class="text-danger small">Payment blocked</span>' : '') +
            '</div>' + warnHtml;
    }

    function renderActivePane(root, preview, visit, charges, total, completionBlocked, canSkipCompletion, links, signMeta, feeSchedule, staged, allowDiscount) {
        signMeta = signMeta || {};
        feeSchedule = feeSchedule || [];
        staged = staged || [];
        allowDiscount = allowDiscount === true || canApplyDiscount(root);
        var pane = root.querySelector('#nc-cashier-active-pane');
        var identity = preview.identity || {};
        var completion = preview.completion || {};
        var unsigned = signMeta.encounter_signed === false;
        var esignOverrideAllowed = canEsignOverride(root, signMeta);
        var payDisabled = total <= 0 || (completionBlocked && !canSkipCompletion) || unsigned;
        var zeroCharge = total <= 0;
        var canCloseZero = !!links.can_close_without_charge;
        var payButtonHtml = '';

        if (zeroCharge && canCloseZero) {
            payButtonHtml = '<button type="button" class="btn btn-success mr-2" id="nc-cashier-close-zero-btn">Close without charge</button>';
        } else if (unsigned && esignOverrideAllowed) {
            payButtonHtml = '<button type="button" class="btn btn-warning mr-2" id="nc-cashier-esign-override-btn">Pay with E-Sign override</button>';
        } else {
            payButtonHtml = '<button type="button" class="btn btn-success mr-2" id="nc-cashier-pay-btn"' +
                (payDisabled ? ' disabled' : '') + '>Take payment</button>';
        }

        pane.innerHTML =
            (window.NewClinicUI ? window.NewClinicUI.renderCompletionBanner(
                Object.assign({}, completion, { pid: identity.pid })
            ) : '') +
            '<div class="card"><div class="card-body">' +
            '<div class="nc-patient-context-banner mb-3 p-3 border rounded bg-light">' +
            '<strong>' + escapeHtml(identity.display_name) + '</strong> · MRN ' + escapeHtml(identity.pubpid) +
            ' · Queue #' + escapeHtml(visit.queue_number) +
            '</div>' +
            renderCompletionBlock(completion, completionBlocked, canSkipCompletion) +
            (unsigned
                ? '<div class="alert alert-warning py-2 mb-2">' + escapeHtml(signMeta.unsigned_message || 'Documentation not signed') +
                (signMeta.encounter_url
                    ? ' <a href="' + escapeHtml(signMeta.encounter_url) + '" target="_blank" rel="noopener">Open encounter</a>'
                    : '') +
                '</div>'
                : '') +
            renderChargePicker(feeSchedule, staged, allowDiscount) +
            '<h5>Posted charges</h5>' +
            renderChargesTable(charges, total) +
            '<div class="d-flex flex-wrap mt-2 mb-3">' +
            '<a class="btn btn-outline-secondary btn-sm mr-2" href="' + escapeHtml(links.fee_sheet_url) +
            '" target="_blank" rel="noopener">Open fee sheet</a>' +
            '<a class="btn btn-outline-secondary btn-sm mr-2" href="' + escapeHtml(links.front_payment_url) +
            '" target="_blank" rel="noopener">Open payments (core)</a>' +
            '</div>' +
            (zeroCharge
                ? '<div class="alert alert-info py-2">No charges on this visit.</div>'
                : '<h5>Take payment</h5>' +
                '<div class="form-row align-items-end">' +
                '<div class="form-group col-md-4"><label>Total due</label>' +
                '<input type="text" class="form-control" readonly value="' + formatMoney(total) + '"></div>' +
                '<div class="form-group col-md-4"><label>Cash received</label>' +
                '<input type="number" step="0.01" min="0" class="form-control" id="nc-cash-received" value="' +
                formatMoney(total) + '"></div>' +
                '<div class="form-group col-md-4"><label>Change</label>' +
                '<input type="text" class="form-control" id="nc-cash-change" readonly value="0.00"></div>' +
                '</div>' +
                '<div class="form-group"><label>Receipt note (optional)</label>' +
                '<input type="text" class="form-control" id="nc-receipt-note" maxlength="255"></div>') +
            '<div class="alert alert-danger d-none" id="nc-cashier-error"></div>' +
            '<div class="d-flex flex-wrap">' +
            payButtonHtml +
            (root.dataset.canMarkUnpaid === '1'
                ? '<button type="button" class="btn btn-outline-danger mr-2" id="nc-cashier-unpaid-btn">Mark left unpaid</button>'
                : '') +
            '<a class="btn btn-outline-secondary btn-sm" href="' + escapeHtml(root.dataset.visitBoardUrl) +
            ' target="_top">Visit Board</a>' +
            '</div></div></div>';

        function rerenderPicker() {
            var pickerCard = pane.querySelector('.card.border-primary');
            if (pickerCard) {
                var html = renderChargePicker(feeScheduleList, stagedChargeLines, allowDiscount);
                var temp = document.createElement('div');
                temp.innerHTML = html;
                pickerCard.replaceWith(temp.firstChild);
                wireChargePicker(root, pane);
            }
            var postBtn = pane.querySelector('#nc-cashier-post-charges');
            if (postBtn) {
                postBtn.disabled = stagedChargeLines.length === 0;
            }
        }

        function wireChargePicker(rootEl, paneEl) {
            var addBtn = paneEl.querySelector('#nc-cashier-fee-add');
            var pickEl = paneEl.querySelector('#nc-cashier-fee-pick');
            if (addBtn && pickEl) {
                addBtn.addEventListener('click', function () {
                    var feeId = parseInt(pickEl.value, 10);
                    if (!feeId) {
                        return;
                    }
                    if (stagedChargeLines.some(function (line) {
                        return parseInt(line.fee_schedule_id, 10) === feeId;
                    })) {
                        window.alert('That fee line is already in the list.');
                        return;
                    }
                    var fee = feeScheduleList.find(function (row) {
                        return parseInt(row.id, 10) === feeId;
                    });
                    if (!fee) {
                        return;
                    }
                    stagedChargeLines.push({
                        fee_schedule_id: fee.id,
                        code: fee.code,
                        name: fee.name,
                        units: 1,
                        unit_price: fee.price_amount,
                        suggested: false
                    });
                    pickEl.value = '';
                    rerenderPicker();
                });
            }

            paneEl.querySelectorAll('.nc-staged-remove').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var index = parseInt(btn.getAttribute('data-index'), 10);
                    stagedChargeLines.splice(index, 1);
                    rerenderPicker();
                });
            });

            paneEl.querySelectorAll('.nc-staged-units').forEach(function (input) {
                input.addEventListener('change', function () {
                    var index = parseInt(input.getAttribute('data-index'), 10);
                    stagedChargeLines[index].units = parseInt(input.value, 10) || 1;
                });
            });

            paneEl.querySelectorAll('.nc-staged-price').forEach(function (input) {
                input.addEventListener('change', function () {
                    var index = parseInt(input.getAttribute('data-index'), 10);
                    stagedChargeLines[index].unit_price = parseFloat(input.value) || 0;
                });
            });

            var postBtn = paneEl.querySelector('#nc-cashier-post-charges');
            if (postBtn) {
                postBtn.addEventListener('click', function () {
                    postCharges(rootEl);
                });
            }
        }

        wireChargePicker(root, pane);

        var receivedEl = pane.querySelector('#nc-cash-received');
        var changeEl = pane.querySelector('#nc-cash-change');
        if (receivedEl && changeEl) {
            function updateChange() {
                var received = parseFloat(receivedEl.value || '0') || 0;
                changeEl.value = formatMoney(Math.max(0, received - total));
            }
            receivedEl.addEventListener('input', updateChange);
            updateChange();
        }

        var payBtn = pane.querySelector('#nc-cashier-pay-btn');
        if (payBtn) {
            payBtn.addEventListener('click', function () {
                openPaymentConfirmModal(
                    root,
                    parseFloat((receivedEl || {}).value || '0') || 0,
                    null
                );
            });
        }

        var esignBtn = pane.querySelector('#nc-cashier-esign-override-btn');
        if (esignBtn) {
            esignBtn.addEventListener('click', function () {
                pendingPaymentAmount = parseFloat((receivedEl || {}).value || '0') || 0;
                openEsignOverrideModal(root);
            });
        }

        var closeZeroBtn = pane.querySelector('#nc-cashier-close-zero-btn');
        if (closeZeroBtn) {
            closeZeroBtn.addEventListener('click', function () {
                openCloseZeroModal(root);
            });
        }

        var unpaidBtn = pane.querySelector('#nc-cashier-unpaid-btn');
        if (unpaidBtn) {
            unpaidBtn.addEventListener('click', function () {
                openMarkUnpaidModal(root);
            });
        }
    }

    function clearActivePane(root) {
        activeVisit = null;
        activePreview = null;
        activeCharges = [];
        chargesTotal = 0;
        feeScheduleList = [];
        stagedChargeLines = [];
        activeCompletionBlocked = false;
        activeCanSkipCompletion = false;
        if (window.NewClinicUI) {
            window.NewClinicUI.clearDeskActiveVisitId(STORAGE_KEY);
        }
        root.querySelector('#nc-cashier-active-pane').innerHTML =
            '<div class="card"><div class="card-body text-muted text-center py-5">' +
            '<em>Select a visit from the payment queue.</em></div></div>';
    }

    function pageEl(id) {
        return document.getElementById(id);
    }

    function setPageText(id, text) {
        var el = pageEl(id);
        if (el) {
            el.textContent = text;
        }
    }

    function deskQuerySuffix(root) {
        if (window.NewClinicUI && window.NewClinicUI.facilityQuerySuffix) {
            return window.NewClinicUI.facilityQuerySuffix(root);
        }
        var facilityId = parseInt(root.dataset.facilityId || '0', 10);
        return facilityId > 0 ? '&facility_id=' + encodeURIComponent(String(facilityId)) : '';
    }

    function setText(root, selector, text) {
        var el = root.querySelector(selector);
        if (el) {
            el.textContent = text;
        }
    }

    function loadQueue(root) {
        var listEl = root.querySelector('#nc-cashier-queue-list');
        if (!listEl) {
            return Promise.resolve();
        }

        listEl.innerHTML = '<div class="text-muted py-2"><em>Loading payment queue…</em></div>';

        return getJson(root.dataset.ajaxUrl + '?action=cashier.queue' + deskQuerySuffix(root)).then(function (result) {
            if (!result.payload.success) {
                var code = (result.payload.data || {}).code || '';
                var hint = code === 'forbidden'
                    ? ' Your user may need the New Clinic Cashier role — ask an admin or log out and back in after roles are assigned.'
                    : (code === 'unauthorized' ? ' Session expired — refresh the page or log in again.' : '');
                listEl.innerHTML = '<div class="alert alert-danger mb-0">' +
                    escapeHtml(result.payload.message || 'Queue failed') + escapeHtml(hint) + '</div>';
                return;
            }

            var data = result.payload.data || {};
            setPageText('nc-cashier-date', data.visit_date || '');
            setPageText('nc-cashier-updated', 'Updated ' + new Date().toLocaleTimeString());
            setText(root, '#nc-cashier-counts', String((data.counts || {}).waiting || 0) + ' waiting');

            var visits = data.visits || [];
            listEl.innerHTML = visits.length
                ? visits.map(renderQueueCard).join('')
                : '<div class="text-muted py-3"><em>Payment queue clear for ' +
                    escapeHtml(data.visit_date || 'today') + '.</em><br>' +
                    '<span class="small">If Visit Board shows someone in Payment, click Refresh or log out and back in.</span></div>';

            setText(root, '#nc-cashier-paid-count', String((data.counts || {}).paid_today || 0));
            var paidListEl = root.querySelector('#nc-cashier-paid-list');
            var paid = data.paid_today || [];
            if (paidListEl) {
                paidListEl.innerHTML = paid.length
                    ? paid.map(function (row) {
                        return '<div class="small text-muted py-1">#' + escapeHtml(row.queue_number) +
                            ' ' + escapeHtml(row.display_name) + '</div>';
                    }).join('')
                    : '<div class="small text-muted">None yet today</div>';
            }

            if (activeVisit) {
                var activeId = parseInt(activeVisit.id, 10);
                var queueMatch = visits.find(function (card) {
                    return parseInt(card.id, 10) === activeId;
                });
                if (queueMatch && queueMatch.row_version != null) {
                    activeVisit.row_version = queueMatch.row_version;
                }
                if (queueMatch === undefined) {
                    clearActivePane(root);
                }
            }
        });
    }

    function selectVisit(root, visitId) {
        var pane = root.querySelector('#nc-cashier-active-pane');
        pane.innerHTML = '<div class="card"><div class="card-body"><em>Loading…</em></div></div>';

        postJson(root.dataset.ajaxUrl + '?action=cashier.select', {
            visit_id: visitId,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                pane.innerHTML = '<div class="alert alert-danger m-0">' +
                    escapeHtml(result.payload.message || 'Load failed') + '</div>';
                return;
            }

            var data = result.payload.data || {};
            stagedChargeLines = buildStagedFromSuggestions(data.suggested_fees || [], data.charges || []);
            refreshActivePaneFromData(root, data);
        }).catch(function (err) {
            pane.innerHTML = '<div class="alert alert-danger m-0">' +
                escapeHtml(err.message || 'Load failed') + '</div>';
        });
    }

    function postCharges(root) {
        if (!activeVisit || !stagedChargeLines.length) {
            return;
        }
        if (window.NewClinicUI && window.NewClinicUI.isSharedDeviceBlocked(root)) {
            return;
        }

        if (stagedLinesHaveDiscount(root)) {
            openDiscountConfirmModal(root);
            return;
        }

        executePostCharges(root);
    }

    function executePostCharges(root) {
        if (!activeVisit || !stagedChargeLines.length) {
            return;
        }
        if (window.NewClinicUI && window.NewClinicUI.isSharedDeviceBlocked(root)) {
            return;
        }
        var errorEl = root.querySelector('#nc-cashier-error');
        if (errorEl) {
            errorEl.classList.add('d-none');
        }

        var postBtn = root.querySelector('#nc-cashier-post-charges');
        if (postBtn) {
            postBtn.disabled = true;
        }

        postJson(root.dataset.ajaxUrl + '?action=cashier.charges.post', {
            visit_id: activeVisit.id,
            lines: stagedChargeLines.map(function (line) {
                var payload = {
                    fee_schedule_id: line.fee_schedule_id,
                    units: parseInt(line.units, 10) || 1
                };
                if (canApplyDiscount(root)) {
                    payload.unit_price = parseFloat(line.unit_price) || 0;
                }
                return payload;
            }),
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                if (postBtn) {
                    postBtn.disabled = false;
                }
                handleApiFailure(root, result, errorEl);
                return;
            }
            stagedChargeLines = [];
            refreshActivePaneFromData(root, result.payload.data || {});
            loadQueue(root);
        }).catch(function (err) {
            if (postBtn) {
                postBtn.disabled = false;
            }
            if (errorEl) {
                errorEl.textContent = err.message || 'Failed to post charges';
                errorEl.classList.remove('d-none');
            }
        });
    }

    function takePayment(root, amountReceived, esignOverrideReason) {
        if (window.NewClinicUI && window.NewClinicUI.isSharedDeviceBlocked(root)) {
            return Promise.resolve();
        }
        var errorEl = root.querySelector('#nc-cashier-error');
        if (errorEl) {
            errorEl.classList.add('d-none');
        }

        var requestId = pendingClientRequestId || newClientRequestId();
        pendingClientRequestId = null;

        var body = {
            visit_id: activeVisit.id,
            row_version: activeVisit.row_version,
            amount_received: amountReceived,
            receipt_note: (root.querySelector('#nc-receipt-note') || {}).value || '',
            client_request_id: requestId,
            csrf_token_form: root.dataset.csrfToken
        };
        if (esignOverrideReason) {
            body.esign_override_reason = esignOverrideReason;
        }

        return postJson(root.dataset.ajaxUrl + '?action=cashier.pay', body).then(function (result) {
            if (!result.payload.success) {
                if (!handleApiFailure(root, result, errorEl)) {
                    if (errorEl) {
                        errorEl.textContent = result.payload.message || 'Payment failed';
                        errorEl.classList.remove('d-none');
                    }
                }
                return result;
            }

            var receipt = result.payload.data.receipt || {};
            showReceiptModal(activePreview, receipt);
            clearActivePane(root);
            loadQueue(root);
            return result;
        }).catch(function (err) {
            if (errorEl) {
                errorEl.textContent = err.message || 'Payment failed';
                errorEl.classList.remove('d-none');
            }
            throw err;
        });
    }

    function closeWithoutCharge(root, reason) {
        if (window.NewClinicUI && window.NewClinicUI.isSharedDeviceBlocked(root)) {
            return;
        }
        var errorEl = root.querySelector('#nc-cashier-error');
        if (errorEl) {
            errorEl.classList.add('d-none');
        }

        postJson(root.dataset.ajaxUrl + '?action=cashier.close_zero', {
            visit_id: activeVisit.id,
            row_version: activeVisit.row_version,
            reason: reason,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                handleApiFailure(root, result, errorEl);
                return;
            }
            clearActivePane(root);
            loadQueue(root);
        });
    }

    function markUnpaid(root, reason) {
        if (window.NewClinicUI && window.NewClinicUI.isSharedDeviceBlocked(root)) {
            return;
        }
        postJson(root.dataset.ajaxUrl + '?action=cashier.mark_unpaid', {
            visit_id: activeVisit.id,
            row_version: activeVisit.row_version,
            reason: reason,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                handleApiFailure(root, result, null);
                return;
            }
            clearActivePane(root);
            loadQueue(root);
        });
    }

    function showReceiptModal(preview, receipt) {
        var modal = document.getElementById('nc-cashier-receipt-modal');
        var backdrop = document.getElementById('nc-cashier-modal-backdrop');
        var identity = (preview || {}).identity || {};
        var body = document.getElementById('nc-cashier-receipt-body');

        body.innerHTML =
            '<div class="nc-receipt-print">' +
            '<p><strong>' + escapeHtml(identity.display_name) + '</strong><br>' +
            (receipt.receipt_number
                ? 'Receipt #' + escapeHtml(receipt.receipt_number) + '<br>'
                : '') +
            'Queue #' + escapeHtml(receipt.queue_number) + '<br>' +
            'Paid: ' + formatMoney(receipt.amount_paid) + '<br>' +
            'Change: ' + formatMoney(receipt.change_due) + '<br>' +
            new Date().toLocaleString() +
            '</p></div>';

        document.getElementById('nc-cashier-print-receipt').onclick = function () {
            var printWin = window.open('', '_blank');
            printWin.document.write('<html><head><title>Receipt</title></head><body>' +
                body.innerHTML + '</body></html>');
            printWin.document.close();
            printWin.print();
        };

        showModal(modal, backdrop);
    }

    function renderPaymentIdentityBlock(preview, visit) {
        var identity = (preview || {}).identity || {};
        var visitRow = visit || {};
        return '<div class="nc-patient-context-banner p-3 border rounded bg-light mb-3">' +
            '<div><strong>Patient:</strong> ' + escapeHtml(identity.display_name) +
            ' · MRN ' + escapeHtml(identity.pubpid) +
            ' · Queue #' + escapeHtml(visitRow.queue_number) + '</div>' +
            '</div>';
    }

    function feeScheduleById() {
        var map = {};
        feeScheduleList.forEach(function (fee) {
            map[fee.id] = fee;
        });
        return map;
    }

    function stagedLinesHaveDiscount(root) {
        if (!canApplyDiscount(root)) {
            return false;
        }

        var fees = feeScheduleById();
        return stagedChargeLines.some(function (line) {
            var fee = fees[line.fee_schedule_id];
            if (!fee) {
                return false;
            }
            var posted = parseFloat(line.unit_price) || 0;
            var standard = parseFloat(fee.price_amount) || 0;
            return posted + 0.001 < standard;
        });
    }

    function renderDiscountSummaryHtml() {
        var fees = feeScheduleById();
        var rows = stagedChargeLines.map(function (line) {
            var fee = fees[line.fee_schedule_id] || {};
            var standard = parseFloat(fee.price_amount) || 0;
            var posted = parseFloat(line.unit_price) || 0;
            var discount = standard - posted;
            if (discount <= 0.001) {
                return '';
            }
            return '<tr><td>' + escapeHtml(line.name || fee.name) + '</td>' +
                '<td class="text-right">' + formatMoney(standard) + '</td>' +
                '<td class="text-right">' + formatMoney(posted) + '</td>' +
                '<td class="text-right text-danger">-' + formatMoney(discount) + '</td></tr>';
        }).filter(Boolean).join('');

        if (!rows) {
            return '<p class="mb-0">Post discounted charges to this visit?</p>';
        }

        return '<p class="mb-2">The following lines are below the standard fee schedule price:</p>' +
            '<table class="table table-sm table-bordered mb-2">' +
            '<thead><tr><th>Service</th><th class="text-right">Standard</th>' +
            '<th class="text-right">Posted</th><th class="text-right">Discount</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table>' +
            '<p class="small text-muted mb-0">Confirm patient identity before posting discounted charges.</p>';
    }

    function openTerminalActionModal(options) {
        if (!activeVisit || !activePreview) {
            return;
        }

        var modal = document.getElementById('nc-cashier-terminal-modal');
        var backdrop = document.getElementById('nc-cashier-terminal-backdrop');
        var titleEl = document.getElementById('nc-cashier-terminal-title');
        var bodyEl = document.getElementById('nc-cashier-terminal-body');
        var reasonWrap = document.getElementById('nc-cashier-terminal-reason-wrap');
        var reasonEl = document.getElementById('nc-cashier-terminal-reason');
        var errorEl = document.getElementById('nc-cashier-terminal-error');
        var confirmBtn = document.getElementById('nc-cashier-terminal-confirm');

        if (!modal || !backdrop || !titleEl || !bodyEl || !confirmBtn) {
            var fallback = options.fallbackError || 'Action confirmation could not load. Hard refresh (Ctrl+F5).';
            if (options.root) {
                showPaneError(options.root, null, fallback);
            } else {
                window.alert(fallback);
            }
            return;
        }

        titleEl.textContent = options.title || 'Confirm action';
        bodyEl.innerHTML = renderPaymentIdentityBlock(activePreview, activeVisit) + (options.bodyHtml || '');
        confirmBtn.textContent = options.confirmLabel || 'Confirm';
        confirmBtn.className = 'btn ' + (options.confirmClass || 'btn-primary');
        confirmBtn.disabled = false;

        if (reasonWrap && reasonEl) {
            if (options.requireReason) {
                reasonWrap.classList.remove('d-none');
                reasonEl.value = '';
            } else {
                reasonWrap.classList.add('d-none');
                reasonEl.value = '';
            }
        }

        if (errorEl) {
            errorEl.classList.add('d-none');
            errorEl.textContent = '';
        }

        pendingTerminalAction = options;
        showModal(modal, backdrop);
    }

    function openMarkUnpaidModal(root) {
        openTerminalActionModal({
            root: root,
            title: 'Mark left unpaid',
            bodyHtml: '<p class="mb-0">Record that this patient left without paying. Reason is required.</p>',
            confirmLabel: 'Mark left unpaid',
            confirmClass: 'btn-warning',
            requireReason: true,
            fallbackError: 'Mark unpaid confirmation could not load. Hard refresh (Ctrl+F5).',
            onConfirm: function (reason) {
                markUnpaid(root, reason);
            }
        });
    }

    function openCloseZeroModal(root) {
        openTerminalActionModal({
            root: root,
            title: 'Close without charge',
            bodyHtml: '<p class="mb-0">Close this visit with no charges posted. Reason is required.</p>',
            confirmLabel: 'Close visit',
            confirmClass: 'btn-success',
            requireReason: true,
            fallbackError: 'Close confirmation could not load. Hard refresh (Ctrl+F5).',
            onConfirm: function (reason) {
                closeWithoutCharge(root, reason);
            }
        });
    }

    function openDiscountConfirmModal(root) {
        openTerminalActionModal({
            root: root,
            title: 'Confirm discounted charges',
            bodyHtml: renderDiscountSummaryHtml(),
            confirmLabel: 'Post charges',
            confirmClass: 'btn-primary',
            requireReason: false,
            fallbackError: 'Discount confirmation could not load. Hard refresh (Ctrl+F5).',
            onConfirm: function () {
                executePostCharges(root);
            }
        });
    }

    function wireTerminalActionModal(root) {
        var modal = document.getElementById('nc-cashier-terminal-modal');
        var backdrop = document.getElementById('nc-cashier-terminal-backdrop');
        var reasonEl = document.getElementById('nc-cashier-terminal-reason');
        var errorEl = document.getElementById('nc-cashier-terminal-error');
        var confirmBtn = document.getElementById('nc-cashier-terminal-confirm');

        if (!modal || !backdrop || !confirmBtn) {
            return;
        }

        modal.querySelectorAll('.nc-terminal-modal-close').forEach(function (btn) {
            btn.addEventListener('click', function () {
                hideModal(modal, backdrop);
                pendingTerminalAction = null;
            });
        });

        confirmBtn.addEventListener('click', function () {
            if (confirmBtn.disabled || !pendingTerminalAction) {
                return;
            }

            var reason = reasonEl ? reasonEl.value.trim() : '';
            if (pendingTerminalAction.requireReason && !reason) {
                if (errorEl) {
                    errorEl.textContent = 'Reason is required.';
                    errorEl.classList.remove('d-none');
                }
                return;
            }

            confirmBtn.disabled = true;
            hideModal(modal, backdrop);
            var action = pendingTerminalAction;
            pendingTerminalAction = null;
            if (typeof action.onConfirm === 'function') {
                action.onConfirm(reason);
            }
        });
    }

    function renderPaymentConfirmBody(preview, visit, total, amountReceived) {
        var change = Math.max(0, amountReceived - total);
        var completion = (preview || {}).completion || {};
        var overrideHtml = '';
        if (activeCompletionBlocked && activeCanSkipCompletion) {
            overrideHtml = '<div class="alert alert-warning py-2 mb-3">' +
                'Profile completion override — payment will proceed despite incomplete profile (' +
                escapeHtml(completion.score || '—') + '% vs ' +
                escapeHtml(completion.billing_threshold || 70) + '% required).</div>';
        }

        return renderPaymentIdentityBlock(preview, visit) + overrideHtml +
            '<dl class="row mb-0">' +
            '<dt class="col-sm-5">Total due</dt><dd class="col-sm-7"><strong>' + formatMoney(total) + '</strong></dd>' +
            '<dt class="col-sm-5">Cash received</dt><dd class="col-sm-7">' + formatMoney(amountReceived) + '</dd>' +
            '<dt class="col-sm-5">Change</dt><dd class="col-sm-7">' + formatMoney(change) + '</dd>' +
            '</dl>' +
            '<p class="small text-muted mb-0 mt-3">Confirm patient identity before posting payment.</p>';
    }

    function openPaymentConfirmModal(root, amountReceived, esignOverrideReason) {
        if (!activeVisit || !activePreview) {
            return;
        }

        var modal = document.getElementById('nc-cashier-pay-confirm-modal');
        var backdrop = document.getElementById('nc-cashier-pay-confirm-backdrop');
        var bodyEl = document.getElementById('nc-cashier-pay-confirm-body');
        var confirmBtn = document.getElementById('nc-cashier-pay-confirm-btn');
        if (!modal || !backdrop || !bodyEl || !confirmBtn) {
            showPaneError(
                root,
                root.querySelector('#nc-cashier-error'),
                'Payment confirmation could not load. Hard refresh (Ctrl+F5) and try again.'
            );
            return;
        }

        pendingPayConfirm = {
            amount: amountReceived,
            esignReason: esignOverrideReason
        };
        pendingClientRequestId = newClientRequestId();
        confirmBtn.disabled = false;
        bodyEl.innerHTML = renderPaymentConfirmBody(activePreview, activeVisit, chargesTotal, amountReceived);
        showModal(modal, backdrop);
    }

    function wirePaymentConfirmModal(root) {
        var modal = document.getElementById('nc-cashier-pay-confirm-modal');
        var backdrop = document.getElementById('nc-cashier-pay-confirm-backdrop');
        var confirmBtn = document.getElementById('nc-cashier-pay-confirm-btn');
        if (!modal || !backdrop || !confirmBtn) {
            return;
        }

        modal.querySelectorAll('.nc-pay-confirm-close').forEach(function (btn) {
            btn.addEventListener('click', function () {
                hideModal(modal, backdrop);
                pendingPayConfirm = null;
                pendingClientRequestId = null;
            });
        });

        confirmBtn.addEventListener('click', function () {
            if (confirmBtn.disabled) {
                return;
            }
            var pending = pendingPayConfirm;
            if (!pending) {
                return;
            }
            confirmBtn.disabled = true;
            hideModal(modal, backdrop);
            takePayment(root, pending.amount, pending.esignReason).then(function (result) {
                pendingPayConfirm = null;
                var payload = (result && result.payload) || {};
                if (!payload.success) {
                    confirmBtn.disabled = false;
                }
            }).catch(function () {
                pendingPayConfirm = null;
                pendingClientRequestId = null;
                confirmBtn.disabled = false;
            });
        });
    }

    function openEsignOverrideModal(root) {
        var modal = document.getElementById('nc-cashier-esign-modal');
        var backdrop = document.getElementById('nc-cashier-esign-backdrop');
        var reasonEl = document.getElementById('nc-cashier-esign-reason');
        var errorEl = document.getElementById('nc-cashier-esign-error');
        if (!modal || !backdrop || !reasonEl) {
            return;
        }
        reasonEl.value = '';
        if (errorEl) {
            errorEl.classList.add('d-none');
            errorEl.textContent = '';
        }
        var identitySlot = document.getElementById('nc-cashier-esign-identity');
        if (identitySlot && activePreview && activeVisit) {
            identitySlot.innerHTML = renderPaymentIdentityBlock(activePreview, activeVisit);
        }
        showModal(modal, backdrop);
        reasonEl.focus();
    }

    function wireEsignOverrideModal(root) {
        var modal = document.getElementById('nc-cashier-esign-modal');
        var backdrop = document.getElementById('nc-cashier-esign-backdrop');
        var confirmBtn = document.getElementById('nc-cashier-esign-confirm');
        var reasonEl = document.getElementById('nc-cashier-esign-reason');
        var errorEl = document.getElementById('nc-cashier-esign-error');
        if (!modal || !backdrop || !confirmBtn || !reasonEl) {
            return;
        }

        modal.querySelectorAll('.nc-esign-modal-close').forEach(function (btn) {
            btn.addEventListener('click', function () {
                hideModal(modal, backdrop);
            });
        });

        confirmBtn.addEventListener('click', function () {
            var reason = (reasonEl.value || '').trim();
            if (!reason) {
                if (errorEl) {
                    errorEl.textContent = 'Reason is required';
                    errorEl.classList.remove('d-none');
                }
                return;
            }
            hideModal(modal, backdrop);
            openPaymentConfirmModal(root, pendingPaymentAmount, reason);
        });
    }

    function hidePickVisitModal() {
        var modal = document.getElementById('nc-cashier-pick-visit-modal');
        var backdrop = document.getElementById('nc-cashier-pick-visit-backdrop');
        if (modal && backdrop) {
            hideModal(modal, backdrop);
        }
    }

    function openPickVisitModal(visits, onPick) {
        var modal = document.getElementById('nc-cashier-pick-visit-modal');
        var backdrop = document.getElementById('nc-cashier-pick-visit-backdrop');
        var bodyEl = document.getElementById('nc-cashier-pick-visit-body');
        if (!modal || !backdrop || !bodyEl) {
            return;
        }

        bodyEl.innerHTML = visits.map(function (visit) {
            return '<button type="button" class="list-group-item list-group-item-action text-left nc-pick-visit-row" ' +
                'data-visit-id="' + escapeHtml(visit.id) + '">' +
                '<strong>#' + escapeHtml(visit.queue_number) + ' ' + escapeHtml(visit.display_name) + '</strong>' +
                '<div class="small text-muted">' + escapeHtml(visit.visit_type_label || 'Visit') +
                ' · ' + formatMoney(visit.charges_total || 0) + '</div></button>';
        }).join('');

        bodyEl.querySelectorAll('.nc-pick-visit-row').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var visitId = parseInt(btn.getAttribute('data-visit-id') || '0', 10);
                hidePickVisitModal();
                if (visitId > 0 && typeof onPick === 'function') {
                    onPick(visitId);
                }
            });
        });

        modal.querySelectorAll('.nc-pick-visit-close').forEach(function (btn) {
            btn.addEventListener('click', hidePickVisitModal);
        });

        showModal(modal, backdrop);
    }

    function applyCashierResolve(root, data) {
        var hintEl = document.getElementById('nc-cashier-search-hint');
        var resolution = data.resolution || 'preview_only';
        var message = data.message || '';

        if (hintEl) {
            if (message) {
                hintEl.textContent = message;
                hintEl.className = 'small mt-2 ' +
                    (resolution === 'not_ready' || resolution === 'preview_only' ? 'text-warning' : 'text-muted');
                hintEl.style.display = 'block';
            } else {
                hintEl.style.display = 'none';
            }
        }

        if (resolution === 'single') {
            var single = (data.ready_for_payment || [])[0];
            if (single && single.id) {
                selectVisit(root, parseInt(single.id, 10));
            }
            return;
        }

        if (resolution === 'pick_visit') {
            openPickVisitModal(data.ready_for_payment || [], function (visitId) {
                selectVisit(root, visitId);
            });
        }
    }

    function resolvePatientForCheckout(root, pid) {
        postJson(root.dataset.ajaxUrl + '?action=cashier.resolve_patient', {
            pid: pid,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                showPaneError(root, null, result.payload.message || 'Lookup failed');
                return;
            }
            applyCashierResolve(root, result.payload.data || {});
        });
    }

    function wirePatientSearch(root) {
        var input = document.getElementById('nc-cashier-patient-search');
        var resultsEl = document.getElementById('nc-cashier-search-results');
        if (!input || !resultsEl) {
            return;
        }

        input.addEventListener('input', function () {
            window.clearTimeout(searchDebounce);
            var q = input.value.trim();
            if (q.length < 2) {
                resultsEl.style.display = 'none';
                resultsEl.innerHTML = '';
                return;
            }
            searchDebounce = window.setTimeout(function () {
                postJson(root.dataset.ajaxUrl + '?action=patients.search', {
                    q: q,
                    limit: 8,
                    csrf_token_form: root.dataset.csrfToken
                }).then(function (result) {
                    if (!result.payload.success) {
                        return;
                    }
                    var rows = result.payload.data.patients || [];
                    if (!rows.length) {
                        resultsEl.innerHTML = '<div class="list-group-item text-muted">No patients found</div>';
                        resultsEl.style.display = 'block';
                        return;
                    }
                    resultsEl.innerHTML = rows.slice(0, 8).map(function (row) {
                        return '<button type="button" class="list-group-item list-group-item-action text-left" ' +
                            'data-pid="' + escapeHtml(row.pid) + '">' +
                            '<strong>' + escapeHtml(row.display_name) + '</strong>' +
                            '<div class="small text-muted">MRN ' + escapeHtml(row.pubpid) + '</div></button>';
                    }).join('');
                    resultsEl.style.display = 'block';
                    resultsEl.querySelectorAll('[data-pid]').forEach(function (btn) {
                        btn.addEventListener('click', function () {
                            var pid = parseInt(btn.getAttribute('data-pid') || '0', 10);
                            input.value = btn.querySelector('strong').textContent;
                            resultsEl.style.display = 'none';
                            if (pid > 0) {
                                resolvePatientForCheckout(root, pid);
                            }
                        });
                    });
                });
            }, 250);
        });
    }

    function bindQueueClicks(root) {
        root.addEventListener('click', function (event) {
            var btn = event.target.closest('.nc-queue-card');
            if (!btn || !root.querySelector('#nc-cashier-queue-list').contains(btn)) {
                return;
            }
            event.preventDefault();
            var visitId = parseInt(btn.getAttribute('data-visit-id') || '0', 10);
            if (visitId > 0) {
                selectVisit(root, visitId);
            }
        });
    }

    function init(root) {
        if (!root) {
            return;
        }

        bindQueueClicks(root);
        wirePatientSearch(root);
        wireEsignOverrideModal(root);
        wirePaymentConfirmModal(root);
        wireTerminalActionModal(root);
        if (window.NewClinicUI && window.NewClinicUI.wireSharedDeviceSessionWarning) {
            window.NewClinicUI.wireSharedDeviceSessionWarning(root, {
                storageKey: STORAGE_KEY,
                compareMode: 'pid_only',
                bannerId: 'nc-cashier-session-banner',
                bannerTextId: 'nc-cashier-session-banner-text',
                restoreButtonId: 'nc-cashier-restore-session',
                returnQueueButtonId: 'nc-cashier-return-queue',
                onReturnToQueue: function () {
                    clearActivePane(root);
                    loadQueue(root);
                }
            });
        }
        loadQueue(root);

        pollTimer = window.setInterval(function () {
            if (!document.hidden) {
                loadQueue(root);
            }
        }, window.NewClinicUI ? window.NewClinicUI.resolveQueuePollMs(root) : POLL_MS);

        var refreshBtn = pageEl('nc-cashier-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                loadQueue(root);
            });
        }

        var doneToggle = document.getElementById('nc-cashier-done-toggle');
        if (doneToggle) {
            doneToggle.addEventListener('click', function () {
                var list = document.getElementById('nc-cashier-paid-list');
                if (list) {
                    list.style.display = list.style.display === 'none' ? 'block' : 'none';
                }
            });
        }

        var modal = document.getElementById('nc-cashier-receipt-modal');
        var backdrop = document.getElementById('nc-cashier-modal-backdrop');
        if (modal && backdrop) {
            modal.querySelectorAll('.nc-modal-close').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    hideModal(modal, backdrop);
                });
            });
        }
    }

    window.NewClinicCashier = { init: init };
})(window);

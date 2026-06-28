(function (window) {
    'use strict';

    var POLL_MS = 30000;
    var activeVisit = null;
    var activePreview = null;
    var activeRxListUrl = '';
    var hasActiveWork = false;
    var highlightedVisit = null;
    var STORAGE_KEY = 'pharmacy_desk_active_visit_id';

    function pageEl(id) {
        return document.getElementById(id);
    }

    function setPageText(id, text) {
        var el = pageEl(id);
        if (el) {
            el.textContent = text;
        }
    }

    function facilitySuffix(root) {
        if (window.NewClinicUI && window.NewClinicUI.facilityQuerySuffix) {
            return window.NewClinicUI.facilityQuerySuffix(root);
        }
        return '';
    }

    function parseJsonResponse(response) {
        return window.NewClinicUI.parseJsonResponse(response);
    }

    function postJson(url, body) {
        return window.NewClinicUI.postJson(url, body);
    }

    function getJson(url) {
        return window.NewClinicUI.getJson(url);
    }

    function getJson(url) {
        return fetch(url, { credentials: 'same-origin' })
            .then(parseJsonResponse)
            .catch(function () {
                return {
                    status: 0,
                    payload: { success: false, message: 'Network error', data: { code: 'network_error' } }
                };
            });
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

    function showInterrupt(message) {
        var banner = document.getElementById('nc-pharmacy-interrupt');
        var textEl = document.getElementById('nc-pharmacy-interrupt-text');
        if (!banner || !textEl) {
            window.alert(message);
            return;
        }
        textEl.textContent = message;
        banner.classList.remove('d-none');
    }

    function showInterruptHtml(html, variant) {
        var banner = document.getElementById('nc-pharmacy-interrupt');
        var textEl = document.getElementById('nc-pharmacy-interrupt-text');
        if (!banner || !textEl) {
            return;
        }
        textEl.innerHTML = html;
        banner.className = 'alert alert-' + (variant || 'danger') + ' mb-3';
        banner.classList.remove('d-none');
    }

    function hideInterrupt() {
        var banner = document.getElementById('nc-pharmacy-interrupt');
        var textEl = document.getElementById('nc-pharmacy-interrupt-text');
        if (banner) {
            banner.classList.add('d-none');
            banner.className = 'alert alert-warning d-none mb-3';
        }
        if (textEl) {
            textEl.textContent = '';
        }
    }

    function handleApiFailure(root, result, pane) {
        var payload = result.payload || {};
        var code = (payload.data || {}).code || '';
        var message = payload.message || 'Request failed';
        var conflict = window.NewClinicUI ? window.NewClinicUI.resolveVisitConflict(result) : null;

        if (conflict && conflict.type === 'stale_visit') {
            showInterrupt('Another user updated this visit. Refreshing queue.');
            clearActivePane(root);
            loadQueue(root);
            return true;
        }

        if (conflict && conflict.type === 'taken_elsewhere') {
            showInterruptHtml(conflict.html, 'danger');
            clearActivePane(root);
            loadQueue(root);
            return true;
        }

        if (conflict && conflict.type === 'visit_not_takeable') {
            showInterrupt(conflict.message);
            loadQueue(root);
            return true;
        }

        if (result.status === 409 && code === 'session_mismatch') {
            document.getElementById('nc-pharmacy-session-banner').classList.remove('d-none');
            return true;
        }

        if (pane) {
            pane.innerHTML = '<div class="alert alert-danger m-0">' + escapeHtml(message) + '</div>';
        } else {
            window.alert(message);
        }
        return true;
    }

    function rxStatusBadgeClass(status) {
        if (status === 'dispensed') {
            return 'badge-success';
        }
        return 'badge-warning';
    }

    function renderQueueCard(card, disabled) {
        var modifiers = [];
        if (highlightedVisit && String(highlightedVisit.visit_id) === String(card.id)) {
            modifiers.push('highlighted');
        }
        var mine = card.pharmacy_mine ? ' <span class="badge badge-primary ml-1">You</span>' : '';
        var holder = card.pharmacy_actor_name && !card.pharmacy_mine
            ? ' <span class="badge badge-info ml-1">' + escapeHtml(card.pharmacy_actor_name) + '</span>' : '';
        var rxBadge = card.rx_count
            ? ' <span class="badge badge-light border ml-1">' + escapeHtml(card.rx_count) + ' Rx</span>'
            : '';
        var fromState = card.state === 'ready_for_pharmacy' ? 'ready_for_pharmacy' : (card.state || 'ready_for_pharmacy');

        return window.NewClinicUI.renderQueueCard(card, {
            modifiers: modifiers,
            disabled: disabled,
            disabledTitle: 'Complete your current patient first',
            showChiefComplaint: false,
            badgesHtml: mine + holder,
            subtitleHtml: '<div class="oe-nc-queue-card__meta small text-muted">' +
                escapeHtml(card.state) + ' · ' + escapeHtml(card.wait_minutes) + 'm' + rxBadge +
                '</div>',
            dataAttributes: {
                'visit-id': card.id,
                'from-state': fromState
            }
        });
    }

    function renderPrescriptionsTable(prescriptions) {
        if (!prescriptions.length) {
            return '<div class="alert alert-info py-2 mb-0">No prescriptions on this encounter yet. Doctor creates Rx in core.</div>';
        }

        var rows = prescriptions.map(function (line) {
            var label = line.status === 'dispensed' ? 'dispensed' : 'to dispense';
            return '<tr><td>' + escapeHtml(line.drug) + '</td>' +
                '<td>' + escapeHtml(line.sig) + '</td>' +
                '<td>' + escapeHtml(line.quantity) + '</td>' +
                '<td><span class="badge ' + rxStatusBadgeClass(line.status) + '">' +
                escapeHtml(label) + '</span></td></tr>';
        }).join('');

        return '<table class="table table-sm table-bordered mb-0">' +
            '<thead><tr><th>Medication</th><th>Sig</th><th>Qty</th><th>Status</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table>';
    }

    function renderAllergyChip(preview) {
        var safety = preview.safety || {};
        var allergies = safety.allergies_severe || [];
        if (!allergies.length) {
            return '';
        }

        return '<div class="alert alert-warning py-2 mb-3" role="alert">' +
            '<strong>Allergy alert:</strong> ' + escapeHtml(allergies.join(', ')) +
            '</div>';
    }

    function renderBanner(preview, visit) {
        var identity = preview.identity || {};
        var safety = preview.safety || {};
        var completion = preview.completion || {};
        var allergies = (safety.allergies_severe || []).join(', ');
        var allergyLine = allergies
            ? '<div class="text-danger small">Allergy: ' + escapeHtml(allergies) + '</div>'
            : '';

        return (window.NewClinicUI ? window.NewClinicUI.renderCompletionBanner(
            Object.assign({}, completion, { pid: identity.pid })
        ) : '') +
            '<div class="nc-patient-context-banner mb-3 p-3 border rounded bg-light">' +
            '<div class="d-flex justify-content-between flex-wrap">' +
            '<div><strong>' + escapeHtml(identity.display_name) + '</strong> · MRN ' +
            escapeHtml(identity.pubpid) + '</div>' +
            '<span class="badge badge-info">' + escapeHtml(visit.state) + '</span>' +
            '</div>' +
            allergyLine +
            '<div class="small mt-1">Visit #' + escapeHtml(visit.queue_number) +
            ' · ' + escapeHtml(visit.visit_type_label || 'Visit') + '</div>' +
            '</div>';
    }

    function renderActivePane(root, data) {
        var pane = root.querySelector('#nc-pharmacy-active-pane');
        var visit = data.visit;
        var preview = data.preview;
        var prescriptions = data.prescriptions || [];
        var canSkip = root.dataset.canSkip === '1';
        var inPharmacy = visit.state === 'in_pharmacy';
        var canTake = visit.state === 'ready_for_pharmacy' && !hasActiveWork;
        var rxListUrl = data.rx_list_url || activeRxListUrl || '#';

        pane.innerHTML =
            '<div class="card"><div class="card-body">' +
            renderBanner(preview, visit) +
            renderAllergyChip(preview) +
            '<h5>Prescriptions for this visit</h5>' +
            renderPrescriptionsTable(prescriptions) +
            '<div class="d-flex flex-wrap mt-3 mb-3">' +
            '<a class="btn btn-outline-primary btn-sm mr-2" id="nc-pharmacy-open-rx-list" href="' +
            escapeHtml(rxListUrl) + '" target="_blank" rel="noopener noreferrer">Open Rx list (core)</a>' +
            '<button type="button" class="btn btn-outline-secondary btn-sm mr-2" id="nc-pharmacy-open-dispense"' +
            (inPharmacy ? '' : ' disabled') + '>Open encounter / dispense</button>' +
            '<button type="button" class="btn btn-outline-secondary btn-sm mr-2" id="nc-pharmacy-open-rx-edit"' +
            (inPharmacy ? '' : ' disabled') + '>Add Rx (core)</button>' +
            '</div>' +
            '<div class="alert alert-danger d-none" id="nc-pharmacy-action-error"></div>' +
            '<div class="d-flex flex-wrap">' +
            (canTake
                ? '<button type="button" class="btn btn-primary mr-2" id="nc-pharmacy-take-btn">Take patient</button>'
                : '') +
            (inPharmacy
                ? '<button type="button" class="btn btn-success mr-2" id="nc-pharmacy-complete-btn">Pharmacy complete</button>'
                : '') +
            (canSkip && (visit.state === 'ready_for_pharmacy' || inPharmacy)
                ? '<button type="button" class="btn btn-outline-warning mr-2" id="nc-pharmacy-skip-btn">Skip to payment</button>'
                : '') +
            '<a class="btn btn-outline-secondary btn-sm" href="' + escapeHtml(root.dataset.visitBoardUrl) +
            ' target="_top">Visit Board</a>' +
            '</div></div></div>';

        var takeBtn = pane.querySelector('#nc-pharmacy-take-btn');
        if (takeBtn) {
            takeBtn.addEventListener('click', function () {
                takePatient(root, visit.id);
            });
        }

        var completeBtn = pane.querySelector('#nc-pharmacy-complete-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', function () {
                completePharmacy(root);
            });
        }

        var skipBtn = pane.querySelector('#nc-pharmacy-skip-btn');
        if (skipBtn) {
            skipBtn.addEventListener('click', function () {
                openSkipModal(preview, visit);
            });
        }

        pane.querySelector('#nc-pharmacy-open-dispense').addEventListener('click', function () {
            runShortcut(root, 'dispense');
        });
        pane.querySelector('#nc-pharmacy-open-rx-edit').addEventListener('click', function () {
            runShortcut(root, 'rx_edit');
        });
    }

    function clearActivePane(root) {
        activeVisit = null;
        activePreview = null;
        activeRxListUrl = '';
        if (window.NewClinicUI) {
            window.NewClinicUI.clearDeskActiveVisitId(STORAGE_KEY);
        }
        root.querySelector('#nc-pharmacy-active-pane').innerHTML =
            '<div class="card"><div class="card-body text-muted text-center py-5">' +
            '<em>Select a patient from the pharmacy queue.</em></div></div>';
    }

    function loadQueue(root) {
        var listEl = root.querySelector('#nc-pharmacy-queue-list');
        return getJson(root.dataset.ajaxUrl + '?action=pharmacy.queue' + facilitySuffix(root) +
            (window.NewClinicUI ? window.NewClinicUI.encodeQueueWatch(
                highlightedVisit ? [highlightedVisit] : []
            ) : '')).then(function (result) {
            if (!result.payload.success) {
                listEl.innerHTML = '<div class="alert alert-danger">' +
                    escapeHtml(result.payload.message || 'Queue failed') + '</div>';
                return;
            }

            var data = result.payload.data || {};
            if (window.NewClinicUI) {
                window.NewClinicUI.processClaimLostPoll(data, {
                    highlightedVisitId: highlightedVisit ? highlightedVisit.visit_id : null,
                    activeVisitId: activeVisit ? activeVisit.id : null,
                    onHighlightLost: function () {
                        highlightedVisit = null;
                    }
                });
            }
            hasActiveWork = !!data.has_active_work;
            setPageText('nc-pharmacy-date', data.visit_date || '');
            setPageText('nc-pharmacy-updated', 'Updated ' + new Date().toLocaleTimeString());
            var countsEl = root.querySelector('#nc-pharmacy-counts');
            if (countsEl) {
                countsEl.textContent = (data.counts || {}).waiting + ' waiting';
            }

            var visits = window.NewClinicUI
                ? window.NewClinicUI.mergeQueueWithClaimLost(data.visits || [], data.claim_lost_cards || [])
                : (data.visits || []);
            listEl.innerHTML = visits.length
                ? visits.map(function (card) {
                    return renderQueueCard(card, hasActiveWork && card.state === 'ready_for_pharmacy');
                }).join('')
                : '<div class="text-muted py-3"><em>No pharmacy work pending.</em></div>';

            if (activeVisit) {
                var activeId = parseInt(activeVisit.id, 10);
                var queueMatch = visits.find(function (card) {
                    return parseInt(card.id, 10) === activeId;
                });
                if (queueMatch && queueMatch.row_version != null) {
                    activeVisit.row_version = queueMatch.row_version;
                } else if ((data.active_work || {}).id === activeId && data.active_work.row_version != null) {
                    activeVisit.row_version = data.active_work.row_version;
                }

                var onQueue = !!queueMatch;
                var stillMine = (data.active_work || {}).id === activeVisit.id;
                if (!onQueue && !stillMine) {
                    clearActivePane(root);
                    hasActiveWork = !!data.has_active_work;
                }
            }
        });
    }

    function selectVisit(root, visitId) {
        var pane = root.querySelector('#nc-pharmacy-active-pane');
        pane.innerHTML = '<div class="card"><div class="card-body"><em>Loading…</em></div></div>';

        postJson(root.dataset.ajaxUrl + '?action=pharmacy.select', {
            visit_id: visitId,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                handleApiFailure(root, result, pane);
                return;
            }

            var data = result.payload.data || {};
            activeVisit = data.visit;
            activePreview = data.preview;
            activeRxListUrl = data.rx_list_url || '';
            if (activeVisit && window.NewClinicUI) {
                window.NewClinicUI.setDeskActiveVisitId(STORAGE_KEY, activeVisit.id);
            }
            hideInterrupt();
            document.getElementById('nc-pharmacy-session-banner').classList.add('d-none');

            if (activeVisit.state === 'ready_for_pharmacy' && !hasActiveWork) {
                takePatient(root, visitId);
                return;
            }

            renderActivePane(root, data);
        });
    }

    function takePatient(root, visitId) {
        var pane = root.querySelector('#nc-pharmacy-active-pane');
        postJson(root.dataset.ajaxUrl + '?action=pharmacy.take', {
            visit_id: visitId,
            row_version: activeVisit ? activeVisit.row_version : 0,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                handleApiFailure(root, result, pane);
                return;
            }

            hideInterrupt();
            document.getElementById('nc-pharmacy-session-banner').classList.add('d-none');
            var data = result.payload.data || {};
            activeVisit = data.visit;
            activePreview = data.preview;
            activeRxListUrl = data.rx_list_url || '';
            if (activeVisit && window.NewClinicUI) {
                window.NewClinicUI.setDeskActiveVisitId(STORAGE_KEY, activeVisit.id);
            }
            hasActiveWork = true;
            renderActivePane(root, data);
            loadQueue(root);
        });
    }

    function completePharmacy(root) {
        if (window.NewClinicUI && window.NewClinicUI.isSharedDeviceBlocked(root)) {
            return;
        }
        var errorEl = root.querySelector('#nc-pharmacy-action-error');
        if (errorEl) {
            errorEl.classList.add('d-none');
        }

        postJson(root.dataset.ajaxUrl + '?action=pharmacy.complete', {
            visit_id: activeVisit.id,
            row_version: activeVisit.row_version,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                if (!handleApiFailure(root, result, null) && errorEl) {
                    errorEl.textContent = result.payload.message || 'Complete failed';
                    errorEl.classList.remove('d-none');
                }
                return;
            }

            hideInterrupt();
            clearActivePane(root);
            hasActiveWork = false;
            loadQueue(root);
        });
    }

    function runShortcut(root, shortcut) {
        postJson(root.dataset.ajaxUrl + '?action=pharmacy.shortcut_preflight', {
            visit_id: activeVisit.id,
            shortcut: shortcut,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                if (result.status === 409 && (result.payload.data || {}).code === 'session_mismatch') {
                    document.getElementById('nc-pharmacy-session-banner').classList.remove('d-none');
                    return;
                }
                window.alert(result.payload.message || 'Shortcut blocked');
                return;
            }

            var url = (result.payload.data || {}).redirect_url;
            if (url) {
                window.location.href = url;
            }
        });
    }

    function openSkipModal(preview, visit) {
        var modal = document.getElementById('nc-pharmacy-skip-modal');
        var backdrop = document.getElementById('nc-pharmacy-modal-backdrop');
        var identity = preview.identity || {};
        document.getElementById('nc-pharmacy-skip-patient').textContent =
            identity.display_name + ' · MRN ' + identity.pubpid;
        document.getElementById('nc-pharmacy-skip-reason').value = '';
        document.getElementById('nc-pharmacy-skip-error').classList.add('d-none');

        document.getElementById('nc-pharmacy-skip-confirm').onclick = function () {
            confirmSkip(modal, backdrop);
        };

        showModal(modal, backdrop);
    }

    function confirmSkip(modal, backdrop) {
        var reason = document.getElementById('nc-pharmacy-skip-reason').value.trim();
        var errorEl = document.getElementById('nc-pharmacy-skip-error');
        if (!reason) {
            errorEl.textContent = 'Reason is required';
            errorEl.classList.remove('d-none');
            return;
        }

        postJson(document.getElementById('nc-pharmacy-desk').dataset.ajaxUrl + '?action=pharmacy.skip_to_payment', {
            visit_id: activeVisit.id,
            row_version: activeVisit.row_version,
            reason: reason,
            csrf_token_form: document.getElementById('nc-pharmacy-desk').dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                errorEl.textContent = result.payload.message || 'Skip failed';
                errorEl.classList.remove('d-none');
                if ((result.payload.message || '').indexOf('not on the pharmacy queue') !== -1) {
                    clearActivePane(document.getElementById('nc-pharmacy-desk'));
                    hasActiveWork = false;
                    loadQueue(document.getElementById('nc-pharmacy-desk'));
                }
                return;
            }

            hideModal(modal, backdrop);
            hideInterrupt();
            clearActivePane(document.getElementById('nc-pharmacy-desk'));
            hasActiveWork = false;
            loadQueue(document.getElementById('nc-pharmacy-desk'));
        });
    }

    function bindQueueHighlight(root) {
        root.addEventListener('mouseenter', function (event) {
            var btn = event.target.closest('.nc-queue-card');
            if (!btn || !root.contains(btn)) {
                return;
            }
            var visitId = parseInt(btn.getAttribute('data-visit-id') || '0', 10);
            var fromState = btn.getAttribute('data-from-state') || 'ready_for_pharmacy';
            if (visitId > 0) {
                highlightedVisit = { visit_id: visitId, from_state: fromState };
            }
        }, true);
    }

    function bindQueueClicks(root) {
        root.addEventListener('click', function (event) {
            var btn = event.target.closest('.nc-queue-card');
            if (!btn || !root.querySelector('#nc-pharmacy-queue-list').contains(btn)) {
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

        bindQueueHighlight(root);
        bindQueueClicks(root);
        loadQueue(root);

        window.setInterval(function () {
            if (!document.hidden) {
                loadQueue(root);
            }
        }, window.NewClinicUI ? window.NewClinicUI.resolveQueuePollMs(root) : POLL_MS);

        var refreshBtn = pageEl('nc-pharmacy-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                loadQueue(root);
            });
        }

        document.getElementById('nc-pharmacy-interrupt-dismiss').addEventListener('click', hideInterrupt);

        if (window.NewClinicUI && window.NewClinicUI.wireSharedDeviceSessionWarning) {
            window.NewClinicUI.wireSharedDeviceSessionWarning(root, {
                storageKey: STORAGE_KEY,
                compareMode: 'clinical',
                restoreAction: 'pharmacy.restore_session',
                bannerId: 'nc-pharmacy-session-banner',
                bannerTextId: 'nc-pharmacy-session-banner-text',
                restoreButtonId: 'nc-pharmacy-restore-session',
                returnQueueButtonId: 'nc-pharmacy-return-queue',
                onReturnToQueue: function () {
                    clearActivePane(root);
                    hasActiveWork = false;
                    loadQueue(root);
                }
            });
        }

        var modal = document.getElementById('nc-pharmacy-skip-modal');
        var backdrop = document.getElementById('nc-pharmacy-modal-backdrop');
        if (modal && backdrop) {
            modal.querySelectorAll('.nc-modal-close').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    hideModal(modal, backdrop);
                });
            });
        }
    }

    window.NewClinicPharmacy = { init: init };
})(window);

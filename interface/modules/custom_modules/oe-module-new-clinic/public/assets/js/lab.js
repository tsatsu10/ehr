(function (window) {
    'use strict';

    var POLL_MS = 30000;
    var activeVisit = null;
    var activePreview = null;
    var activeOrders = [];
    var pollTimer = null;
    var hasActiveWork = false;
    var highlightedVisit = null;
    var STORAGE_KEY = 'lab_desk_active_visit_id';

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
        var banner = document.getElementById('nc-lab-interrupt');
        var textEl = document.getElementById('nc-lab-interrupt-text');
        if (!banner || !textEl) {
            window.alert(message);
            return;
        }
        textEl.textContent = message;
        banner.classList.remove('d-none');
    }

    function showInterruptHtml(html, variant) {
        var banner = document.getElementById('nc-lab-interrupt');
        var textEl = document.getElementById('nc-lab-interrupt-text');
        if (!banner || !textEl) {
            return;
        }
        textEl.innerHTML = html;
        banner.className = 'alert alert-' + (variant || 'danger') + ' mb-3';
        banner.classList.remove('d-none');
    }

    function hideInterrupt() {
        var banner = document.getElementById('nc-lab-interrupt');
        var textEl = document.getElementById('nc-lab-interrupt-text');
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
            document.getElementById('nc-lab-session-banner').classList.remove('d-none');
            return true;
        }

        if (pane) {
            pane.innerHTML = '<div class="alert alert-danger m-0">' + escapeHtml(message) + '</div>';
        } else {
            window.alert(message);
        }
        return true;
    }

    function statusBadgeClass(status) {
        if (status === 'complete') {
            return 'badge-success';
        }
        if (status === 'routed' || status === 'in_progress') {
            return 'badge-info';
        }
        if (status === 'canceled' || status === 'cancelled') {
            return 'badge-secondary';
        }
        return 'badge-light border';
    }

    function renderQueueCard(card, disabled) {
        var modifiers = [];
        if (highlightedVisit && String(highlightedVisit.visit_id) === String(card.id)) {
            modifiers.push('highlighted');
        }
        var mine = card.lab_mine ? ' <span class="badge badge-primary ml-1">You</span>' : '';
        var holder = card.lab_actor_name && !card.lab_mine
            ? ' <span class="badge badge-info ml-1">' + escapeHtml(card.lab_actor_name) + '</span>' : '';
        var orders = card.order_count
            ? ' <span class="badge badge-light border ml-1">' + escapeHtml(card.order_count) + ' orders</span>'
            : '';
        var unreleased = parseInt(card.unreleased_count, 10) > 0
            ? ' <span class="badge badge-warning ml-1">' + escapeHtml(card.unreleased_count) + ' unreleased</span>'
            : '';
        var fromState = card.state === 'ready_for_lab' ? 'ready_for_lab' : (card.state || 'ready_for_lab');

        return window.NewClinicUI.renderQueueCard(card, {
            modifiers: modifiers,
            disabled: disabled,
            disabledTitle: 'Complete your current patient first',
            showChiefComplaint: false,
            badgesHtml: mine + holder,
            subtitleHtml: '<div class="oe-nc-queue-card__meta small text-muted">' +
                escapeHtml(card.state) + ' · ' + escapeHtml(card.wait_minutes) + 'm' + orders + unreleased +
                '</div>',
            dataAttributes: {
                'visit-id': card.id,
                'from-state': fromState
            }
        });
    }

    function renderOrdersTable(orders, root) {
        var labOpsEnabled = root && root.dataset.labOpsEnabled === '1';
        if (!orders.length) {
            return '<div class="alert alert-info py-2 mb-0">No lab orders on this encounter yet. Doctor creates orders in core.</div>';
        }

        var rows = orders.map(function (line) {
            var fulfillmentBadge = line.fulfillment_label
                ? ' <span class="badge badge-light border">' + escapeHtml(line.fulfillment_label) + '</span>'
                : '';
            var actions = '';
            if (labOpsEnabled && line.id) {
                actions = ' <button type="button" class="btn btn-link btn-sm p-0 ml-1 nc-lab-enter-results" data-order-id="' +
                    escapeHtml(line.id) + '">Enter results</button>';
                if (line.requisition_url) {
                    actions += ' <a class="btn btn-link btn-sm p-0 ml-1" href="' +
                        escapeHtml(line.requisition_url) + '" target="_blank">Print req</a>';
                }
            }
            return '<tr><td>' + escapeHtml(line.title) + fulfillmentBadge + actions + '</td>' +
                '<td>' + escapeHtml(line.code) + '</td>' +
                '<td><span class="badge ' + statusBadgeClass(line.status) + '">' +
                escapeHtml(line.status) + '</span></td></tr>';
        }).join('');

        return '<table class="table table-sm table-bordered mb-0">' +
            '<thead><tr><th>Test</th><th>Code</th><th>Status</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table>';
    }

    function renderBanner(preview, visit, data) {
        var identity = preview.identity || {};
        var safety = preview.safety || {};
        var completion = preview.completion || {};
        var allergies = (safety.allergies_severe || []).join(', ');
        var allergyLine = allergies
            ? '<div class="text-danger small">Allergy: ' + escapeHtml(allergies) + '</div>'
            : '';
        var criticalLine = data && data.critical_unreleased
            ? '<div class="alert alert-danger py-2 px-3 mt-2 mb-0 small">' +
            escapeHtml('Critical result saved but not released to doctor. Release from Enter results.') +
            '</div>'
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
            allergyLine + criticalLine +
            '<div class="small mt-1">Visit #' + escapeHtml(visit.queue_number) +
            ' · ' + escapeHtml(visit.visit_type_label || 'Visit') + '</div>' +
            '</div>';
    }

    function renderActivePane(root, data) {
        var pane = root.querySelector('#nc-lab-active-pane');
        var visit = data.visit;
        var preview = data.preview;
        var orders = data.lab_orders || [];
        var canSkip = root.dataset.canSkip === '1';
        var labOpsEnabled = root.dataset.labOpsEnabled === '1';
        var inLab = visit.state === 'in_lab';
        var canTake = visit.state === 'ready_for_lab' && !hasActiveWork;
        var resultsBtnLabel = labOpsEnabled ? 'Enter results (hub)' : 'Open results (core)';
        var resultsBtnId = labOpsEnabled ? 'nc-lab-enter-results-primary' : 'nc-lab-open-results';

        pane.innerHTML =
            '<div class="card"><div class="card-body">' +
            renderBanner(preview, visit, data) +
            '<h5>Lab orders</h5>' +
            renderOrdersTable(orders, root) +
            '<div class="d-flex flex-wrap mt-3 mb-3">' +
            '<button type="button" class="btn btn-outline-primary btn-sm mr-2" id="nc-lab-open-orders"' +
            (inLab ? '' : ' disabled') + '>Open orders (core)</button>' +
            '<button type="button" class="btn btn-outline-secondary btn-sm mr-2" id="' + resultsBtnId + '"' +
            (inLab ? '' : ' disabled') + '>' + escapeHtml(resultsBtnLabel) + '</button>' +
            '</div>' +
            '<div class="alert alert-danger d-none" id="nc-lab-action-error"></div>' +
            '<div class="d-flex flex-wrap">' +
            (canTake
                ? '<button type="button" class="btn btn-primary mr-2" id="nc-lab-take-btn">Take patient</button>'
                : '') +
            (inLab
                ? '<button type="button" class="btn btn-success mr-2" id="nc-lab-complete-btn">Lab complete</button>'
                : '') +
            (canSkip && (visit.state === 'ready_for_lab' || inLab)
                ? '<button type="button" class="btn btn-outline-warning mr-2" id="nc-lab-skip-btn">Skip to payment</button>'
                : '') +
            '<a class="btn btn-outline-secondary btn-sm" href="' + escapeHtml(root.dataset.visitBoardUrl) +
            ' target="_top">Visit Board</a>' +
            '</div></div></div>';

        var takeBtn = pane.querySelector('#nc-lab-take-btn');
        if (takeBtn) {
            takeBtn.addEventListener('click', function () {
                takePatient(root, visit.id);
            });
        }

        var completeBtn = pane.querySelector('#nc-lab-complete-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', function () {
                completeLab(root);
            });
        }

        var skipBtn = pane.querySelector('#nc-lab-skip-btn');
        if (skipBtn) {
            skipBtn.addEventListener('click', function () {
                openSkipModal(preview, visit);
            });
        }

        pane.querySelector('#nc-lab-open-orders').addEventListener('click', function () {
            runShortcut(root, 'orders');
        });
        var resultsBtn = pane.querySelector('#' + resultsBtnId);
        if (resultsBtn) {
            resultsBtn.addEventListener('click', function () {
                if (labOpsEnabled) {
                    openLabOpsResults(root, orders[0] && orders[0].id);
                } else {
                    runShortcut(root, 'results');
                }
            });
        }
        pane.querySelectorAll('.nc-lab-enter-results').forEach(function (btn) {
            btn.addEventListener('click', function () {
                openLabOpsResults(root, parseInt(btn.getAttribute('data-order-id') || '0', 10));
            });
        });
    }

    var labOpsEntry = null;

    function getLabOpsEntry(root) {
        if (!window.NewClinicLabOpsEntry || root.dataset.labOpsEnabled !== '1') {
            return null;
        }
        if (!labOpsEntry) {
            labOpsEntry = window.NewClinicLabOpsEntry.bind({
                ajaxUrl: root.dataset.ajaxUrl,
                csrfToken: root.dataset.csrfToken,
                canEnter: root.dataset.canEnter === '1',
                canRelease: root.dataset.canRelease === '1',
                onSaved: function () {
                    if (activeVisit) {
                        selectVisit(root, activeVisit.id);
                    }
                    loadQueue(root);
                }
            });
        }
        return labOpsEntry;
    }

    function openLabOpsResults(root, orderId) {
        var entry = getLabOpsEntry(root);
        if (!entry || !orderId) {
            runShortcut(root, 'results');
            return;
        }
        entry.open(orderId);
    }

    function clearActivePane(root) {
        activeVisit = null;
        activePreview = null;
        activeOrders = [];
        if (window.NewClinicUI) {
            window.NewClinicUI.clearDeskActiveVisitId(STORAGE_KEY);
        }
        root.querySelector('#nc-lab-active-pane').innerHTML =
            '<div class="card"><div class="card-body text-muted text-center py-5">' +
            '<em>Select a patient from the lab queue.</em></div></div>';
    }

    function loadQueue(root) {
        var listEl = root.querySelector('#nc-lab-queue-list');
        return getJson(root.dataset.ajaxUrl + '?action=lab.queue' + facilitySuffix(root) +
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
            setPageText('nc-lab-date', data.visit_date || '');
            setPageText('nc-lab-updated', 'Updated ' + new Date().toLocaleTimeString());
            var countsEl = root.querySelector('#nc-lab-counts');
            if (countsEl) {
                countsEl.textContent = (data.counts || {}).waiting + ' waiting';
            }

            var visits = window.NewClinicUI
                ? window.NewClinicUI.mergeQueueWithClaimLost(data.visits || [], data.claim_lost_cards || [])
                : (data.visits || []);
            listEl.innerHTML = visits.length
                ? visits.map(function (card) {
                    return renderQueueCard(card, hasActiveWork && card.state === 'ready_for_lab');
                }).join('')
                : '<div class="text-muted py-3"><em>No lab work pending.</em></div>';

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
        var pane = root.querySelector('#nc-lab-active-pane');
        pane.innerHTML = '<div class="card"><div class="card-body"><em>Loading…</em></div></div>';

        postJson(root.dataset.ajaxUrl + '?action=lab.select', {
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
            activeOrders = data.lab_orders || [];
            if (window.NewClinicUI) {
                window.NewClinicUI.setDeskActiveVisitId(STORAGE_KEY, activeVisit.id);
            }
            hideInterrupt();
            document.getElementById('nc-lab-session-banner').classList.add('d-none');

            if (activeVisit.state === 'ready_for_lab' && !hasActiveWork) {
                takePatient(root, visitId);
                return;
            }

            renderActivePane(root, data);
        });
    }

    function takePatient(root, visitId) {
        var pane = root.querySelector('#nc-lab-active-pane');
        postJson(root.dataset.ajaxUrl + '?action=lab.take', {
            visit_id: visitId,
            row_version: activeVisit ? activeVisit.row_version : 0,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                handleApiFailure(root, result, pane);
                return;
            }

            hideInterrupt();
            document.getElementById('nc-lab-session-banner').classList.add('d-none');
            var data = result.payload.data || {};
            activeVisit = data.visit;
            activePreview = data.preview;
            activeOrders = data.lab_orders || [];
            if (activeVisit && window.NewClinicUI) {
                window.NewClinicUI.setDeskActiveVisitId(STORAGE_KEY, activeVisit.id);
            }
            hasActiveWork = true;
            renderActivePane(root, data);
            loadQueue(root);
        });
    }

    function completeLab(root) {
        if (window.NewClinicUI && window.NewClinicUI.isSharedDeviceBlocked(root)) {
            return;
        }
        var errorEl = root.querySelector('#nc-lab-action-error');
        if (errorEl) {
            errorEl.classList.add('d-none');
        }

        postJson(root.dataset.ajaxUrl + '?action=lab.complete', {
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
        postJson(root.dataset.ajaxUrl + '?action=lab.shortcut_preflight', {
            visit_id: activeVisit.id,
            shortcut: shortcut,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                if (result.status === 409 && (result.payload.data || {}).code === 'session_mismatch') {
                    document.getElementById('nc-lab-session-banner').classList.remove('d-none');
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
        var modal = document.getElementById('nc-lab-skip-modal');
        var backdrop = document.getElementById('nc-lab-modal-backdrop');
        var identity = preview.identity || {};
        document.getElementById('nc-lab-skip-patient').textContent =
            identity.display_name + ' · MRN ' + identity.pubpid;
        document.getElementById('nc-lab-skip-reason').value = '';
        document.getElementById('nc-lab-skip-error').classList.add('d-none');

        document.getElementById('nc-lab-skip-confirm').onclick = function () {
            confirmSkip(modal, backdrop);
        };

        showModal(modal, backdrop);
    }

    function confirmSkip(modal, backdrop) {
        var reason = document.getElementById('nc-lab-skip-reason').value.trim();
        var errorEl = document.getElementById('nc-lab-skip-error');
        if (!reason) {
            errorEl.textContent = 'Reason is required';
            errorEl.classList.remove('d-none');
            return;
        }

        postJson(document.getElementById('nc-lab-desk').dataset.ajaxUrl + '?action=lab.skip_to_payment', {
            visit_id: activeVisit.id,
            row_version: activeVisit.row_version,
            reason: reason,
            csrf_token_form: document.getElementById('nc-lab-desk').dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                errorEl.textContent = result.payload.message || 'Skip failed';
                errorEl.classList.remove('d-none');
                if ((result.payload.message || '').indexOf('not on the lab queue') !== -1) {
                    clearActivePane(document.getElementById('nc-lab-desk'));
                    hasActiveWork = false;
                    loadQueue(document.getElementById('nc-lab-desk'));
                }
                return;
            }

            hideModal(modal, backdrop);
            hideInterrupt();
            clearActivePane(document.getElementById('nc-lab-desk'));
            hasActiveWork = false;
            loadQueue(document.getElementById('nc-lab-desk'));
        });
    }

    function bindQueueHighlight(root) {
        root.addEventListener('mouseenter', function (event) {
            var btn = event.target.closest('.nc-queue-card');
            if (!btn || !root.contains(btn)) {
                return;
            }
            var visitId = parseInt(btn.getAttribute('data-visit-id') || '0', 10);
            var fromState = btn.getAttribute('data-from-state') || 'ready_for_lab';
            if (visitId > 0) {
                highlightedVisit = { visit_id: visitId, from_state: fromState };
            }
        }, true);
    }

    function bindQueueClicks(root) {
        root.addEventListener('click', function (event) {
            var btn = event.target.closest('.nc-queue-card');
            if (!btn || !root.querySelector('#nc-lab-queue-list').contains(btn)) {
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

        pollTimer = window.setInterval(function () {
            if (!document.hidden) {
                loadQueue(root);
            }
        }, window.NewClinicUI ? window.NewClinicUI.resolveQueuePollMs(root) : POLL_MS);

        var refreshBtn = pageEl('nc-lab-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                loadQueue(root);
            });
        }

        document.getElementById('nc-lab-interrupt-dismiss').addEventListener('click', hideInterrupt);

        if (window.NewClinicUI && window.NewClinicUI.wireSharedDeviceSessionWarning) {
            window.NewClinicUI.wireSharedDeviceSessionWarning(root, {
                storageKey: STORAGE_KEY,
                compareMode: 'clinical',
                restoreAction: 'lab.restore_session',
                bannerId: 'nc-lab-session-banner',
                bannerTextId: 'nc-lab-session-banner-text',
                restoreButtonId: 'nc-lab-restore-session',
                returnQueueButtonId: 'nc-lab-return-queue',
                onReturnToQueue: function () {
                    clearActivePane(root);
                    hasActiveWork = false;
                    loadQueue(root);
                }
            });
        }

        var modal = document.getElementById('nc-lab-skip-modal');
        var backdrop = document.getElementById('nc-lab-modal-backdrop');
        if (modal && backdrop) {
            modal.querySelectorAll('.nc-modal-close').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    hideModal(modal, backdrop);
                });
            });
        }
    }

    window.NewClinicLab = { init: init };
})(window);

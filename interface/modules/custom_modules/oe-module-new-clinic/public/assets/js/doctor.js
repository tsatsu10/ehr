(function (window) {
    'use strict';

    var POLL_MS = 30000;
    var STORAGE_KEY = 'doctor_desk_active_visit_id';
    var LEFT_VIA_KEY = 'doctor_desk_left_via';
    var activeVisit = null;
    var activePreview = null;
    var activeRouting = null;
    var activeSignMeta = null;
    var queueScope = 'me';
    var pollTimer = null;
    var hasActiveConsult = false;
    var highlightedVisit = null;
    var pendingReopen = null;

    function pageEl(id) {
        if (window.NewClinicUI && window.NewClinicUI.pageEl) {
            return window.NewClinicUI.pageEl(id);
        }
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

    function ensureActivePane(root) {
        var pane = root.querySelector('#nc-doctor-active-pane');
        if (!pane) {
            return null;
        }
        if (!pane.querySelector('.card')) {
            pane.innerHTML =
                '<div class="card"><div class="card-body text-muted text-center py-5">' +
                '<em>Pick a patient from the queue to start a consult.</em></div></div>';
        }
        return pane;
    }

    function showDeskNotice(message, variant) {
        var banner = document.getElementById('nc-doctor-interrupt');
        var textEl = document.getElementById('nc-doctor-interrupt-text');
        if (!banner || !textEl) {
            window.alert(message);
            return;
        }
        textEl.textContent = message;
        banner.className = 'alert alert-' + (variant || 'warning') + ' mb-3';
        banner.classList.remove('d-none');
    }

    function showInterruptHtml(html, variant) {
        var banner = document.getElementById('nc-doctor-interrupt');
        var textEl = document.getElementById('nc-doctor-interrupt-text');
        if (!banner || !textEl) {
            return;
        }
        textEl.innerHTML = html;
        banner.className = 'alert alert-' + (variant || 'danger') + ' mb-3';
        banner.classList.remove('d-none');
    }

    function showInterrupt(message) {
        showDeskNotice(message, 'warning');
    }

    function hideInterrupt() {
        var banner = document.getElementById('nc-doctor-interrupt');
        var textEl = document.getElementById('nc-doctor-interrupt-text');
        if (banner) {
            banner.className = 'alert alert-warning d-none mb-3';
        }
        if (textEl) {
            textEl.textContent = '';
        }
    }

    function renderRoutingChips(chips) {
        if (!chips) {
            return '';
        }
        var html = '';
        if (chips.results_ready) {
            html += '<span class="badge badge-success ml-1">Results ready</span>';
        } else if (chips.lab_order_incomplete) {
            html += '<span class="badge badge-danger ml-1">Lab order incomplete</span>';
        } else if (chips.lab_ordered) {
            html += '<span class="badge badge-warning ml-1">Lab ordered</span>';
        }
        if (chips.rx_pending) {
            html += '<span class="badge badge-info ml-1">Rx pending</span>';
        }
        return html;
    }

    function renderQueueCard(card, disabled) {
        var skipped = card.skipped_triage
            ? '<span class="badge badge-secondary ml-1">Skipped triage</span>' : '';
        var assigned = card.assigned_provider_name
            ? '<span class="badge badge-info ml-1">Appt: ' + escapeHtml(card.assigned_provider_name) + '</span>'
            : '';
        var modifiers = [];
        if (highlightedVisit && String(highlightedVisit.visit_id) === String(card.id)) {
            modifiers.push('highlighted');
        }
        return window.NewClinicUI.renderQueueCard(card, {
            modifiers: modifiers,
            disabled: disabled,
            disabledTitle: 'Complete your current patient first',
            badgesHtml: skipped + assigned + renderRoutingChips(card.routing_chips),
            dataAttributes: {
                'visit-id': card.id,
                'from-state': 'ready_for_doctor'
            }
        });
    }

    function renderBanner(preview, visit, signMeta) {
        signMeta = signMeta || {};
        var identity = preview.identity || {};
        var safety = preview.safety || {};
        var allergies = (safety.allergies_severe || []).join(', ');
        var allergyLine = allergies
            ? '<div class="text-danger small">Allergy: ' + escapeHtml(allergies) + '</div>'
            : '';
        var vitals = preview.vitals_today || {};
        var vitalsLine = vitals.summary
            ? '<div class="small">Vitals today: ' + escapeHtml(vitals.summary) + '</div>'
            : '<div class="small text-warning">No vitals today</div>';
        var abnormal = vitals.vitals_abnormal_today
            ? '<span class="badge badge-danger ml-1">Vitals abnormal</span>' : '';
        var cc = visit.chief_complaint
            ? '<div class="small mt-1">CC: ' + escapeHtml(visit.chief_complaint) + '</div>' : '';
        var routingLine = signMeta.routing_chips
            ? '<div class="small mt-1">' + renderRoutingChips(signMeta.routing_chips) + '</div>'
            : '';
        var completion = preview.completion || {};
        var signed = !!signMeta.encounter_signed;
        var requireSign = !!signMeta.require_esign_before_complete_consult;
        var docChip = signed
            ? '<span class="badge badge-success ml-2">Signed</span>'
            : (requireSign
                ? '<span class="badge badge-danger ml-2">Unsigned — sign before complete</span>'
                : '<span class="badge badge-warning ml-2">Unsigned — payment blocked</span>');

        return (window.NewClinicUI ? window.NewClinicUI.renderCompletionBanner(
            Object.assign({}, completion, { pid: identity.pid })
        ) : '') +
            '<div class="nc-patient-context-banner mb-3 p-3 border rounded bg-light">' +
            '<div class="d-flex justify-content-between flex-wrap">' +
            '<div><strong>' + escapeHtml(identity.display_name) + '</strong> · ' +
            escapeHtml(identity.sex) + ' ' + escapeHtml(identity.age_years || '—') +
            ' · MRN ' + escapeHtml(identity.pubpid) + '</div>' +
            '<span class="badge badge-success">In consult #' + escapeHtml(visit.queue_number) + '</span>' +
            '</div>' +
            allergyLine + cc + routingLine +
            '<div class="small mt-1">Encounter #' + escapeHtml(visit.encounter) +
            ' · ' + escapeHtml(visit.visit_type_label || 'Visit') + abnormal + docChip + '</div>' +
            vitalsLine +
            '</div>';
    }

    function syncLabPanelOrderFlag(root) {
        return getJson(root.dataset.ajaxUrl + '?action=doctor.lab_panel_catalog' + facilitySuffix(root))
            .then(function (result) {
                var payload = result.payload || {};
                var enabled = !!(payload.success && payload.data && payload.data.enabled);
                root.dataset.labPanelOrder = enabled ? '1' : '0';
                return enabled;
            })
            .catch(function () {
                return false;
            });
    }

    function patchLabShortcutLabels(root) {
        var enabled = root.dataset.labPanelOrder === '1';
        var pane = root.querySelector('#nc-doctor-active-pane');
        if (!pane) {
            return;
        }
        var labBtn = pane.querySelector('.nc-shortcut-btn[data-shortcut="lab"]');
        if (labBtn) {
            labBtn.textContent = enabled ? 'Quick lab order' : 'Order lab';
        }
        var fullBtn = pane.querySelector('.nc-shortcut-btn[data-shortcut="lab-full"]');
        if (enabled && !fullBtn && labBtn && labBtn.parentNode) {
            fullBtn = document.createElement('button');
            fullBtn.type = 'button';
            fullBtn.className = 'btn btn-outline-secondary mr-2 mb-2 nc-shortcut-btn';
            fullBtn.setAttribute('data-shortcut', 'lab-full');
            fullBtn.textContent = 'Full lab form';
            labBtn.parentNode.insertBefore(fullBtn, labBtn.nextSibling);
            fullBtn.addEventListener('click', function () {
                runShortcut(root, 'lab');
            });
        } else if (!enabled && fullBtn) {
            fullBtn.remove();
        }
    }

    function renderShortcuts(root) {
        var labPanel = root.dataset.labPanelOrder === '1';
        var html = '<div class="nc-doctor-shortcuts mb-3">' +
            '<h5 class="mb-2">Consult shortcuts</h5>' +
            '<div class="d-flex flex-wrap">' +
            '<button type="button" class="btn btn-outline-primary mr-2 mb-2 nc-shortcut-btn" data-shortcut="encounter">' +
            'Open encounter</button>' +
            '<button type="button" class="btn btn-outline-primary mr-2 mb-2 nc-shortcut-btn" data-shortcut="lab">' +
            (labPanel ? 'Quick lab order' : 'Order lab') + '</button>';
        if (labPanel) {
            html += '<button type="button" class="btn btn-outline-secondary mr-2 mb-2 nc-shortcut-btn" data-shortcut="lab-full">' +
                'Full lab form</button>';
        }
        html += '<button type="button" class="btn btn-outline-primary mr-2 mb-2 nc-shortcut-btn" data-shortcut="rx">' +
            'Prescribe</button>' +
            '<button type="button" class="btn btn-outline-secondary mr-2 mb-2 nc-shortcut-btn" data-shortcut="chart">' +
            'Open full chart ↗</button>' +
            '</div></div>';
        return html;
    }

    function renderActivePane(root, preview, visit, signMeta) {
        var pane = ensureActivePane(root);
        if (!pane || !visit) {
            return;
        }

        signMeta = signMeta || {};
        var requireSign = !!signMeta.require_esign_before_complete_consult;
        var signed = !!signMeta.encounter_signed;
        var completeDisabled = requireSign && !signed;

        pane.innerHTML =
            '<div class="card"><div class="card-body">' +
            renderBanner(preview || {}, visit, signMeta) +
            renderShortcuts(root) +
            '<div class="d-flex flex-wrap align-items-center">' +
            '<button type="button" class="btn btn-success mr-2" id="nc-doctor-complete-btn"' +
            (completeDisabled ? ' disabled title="Sign documentation in the encounter first"' : '') +
            '>Complete consult</button>' +
            '<a class="btn btn-outline-secondary btn-sm" href="' +
            escapeHtml(root.dataset.visitBoardUrl || '') + '" target="_top">View on Visit Board</a>' +
            '</div></div></div>';

        pane.querySelector('#nc-doctor-complete-btn').addEventListener('click', function () {
            openRoutingModal(root, visit, preview);
        });

        pane.querySelectorAll('.nc-shortcut-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var shortcut = btn.getAttribute('data-shortcut') || '';
                if (shortcut === 'lab' && root.dataset.labPanelOrder === '1') {
                    openLabPanelModal(root);
                    return;
                }
                if (shortcut === 'lab-full') {
                    runShortcut(root, 'lab');
                    return;
                }
                runShortcut(root, shortcut);
            });
        });

        syncLabPanelOrderFlag(root).then(function () {
            patchLabShortcutLabels(root);
        });
    }

    function clearActivePane(root) {
        activeVisit = null;
        activePreview = null;
        activeRouting = null;
        activeSignMeta = null;
        window.sessionStorage.removeItem(STORAGE_KEY);
        var pane = ensureActivePane(root);
        if (pane) {
            pane.innerHTML =
                '<div class="card"><div class="card-body text-muted text-center py-5">' +
                '<em>Pick a patient from the queue to start a consult.</em></div></div>';
        }
    }

    function handleApiFailure(root, result, pane) {
        var payload = result.payload || {};
        var data = payload.data || {};
        var code = data.code || '';
        var message = payload.message || 'Request failed';
        var conflict = window.NewClinicUI ? window.NewClinicUI.resolveVisitConflict(result) : null;

        if (conflict && conflict.type === 'stale_visit') {
            showInterrupt('Another user updated this visit first. Refresh and try again.');
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

        if (result.status === 409 && code === 'encounter_unsigned') {
            var encounterUrl = data.encounter_url || '';
            showInterrupt(message + (encounterUrl ? ' Open the encounter to sign.' : ''));
            if (encounterUrl) {
                window.open(encounterUrl, '_blank', 'noopener,noreferrer');
            }
            return true;
        }

        if (result.status === 409 && code === 'visit_not_takeable') {
            showInterrupt(message);
            loadQueue(root);
            return true;
        }

        if (pane) {
            pane.innerHTML = '<div class="alert alert-danger m-0">' + escapeHtml(message) + '</div>';
        } else {
            window.alert(message);
        }
        return true;
    }

    function loadQueue(root) {
        var ajaxUrl = root.dataset.ajaxUrl;
        var listEl = root.querySelector('#nc-doctor-queue-list');
        var countsEl = root.querySelector('#nc-doctor-counts');
        var updatedEl = pageEl('nc-doctor-updated');
        var dateEl = pageEl('nc-doctor-date');
        var doneCountEl = root.querySelector('#nc-doctor-done-count');
        var doneListEl = root.querySelector('#nc-doctor-done-list');
        var reopenSectionEl = root.querySelector('#nc-doctor-reopen-section');
        var reopenCountEl = root.querySelector('#nc-doctor-reopen-count');
        var reopenListEl = root.querySelector('#nc-doctor-reopen-list');

        var url = ajaxUrl + '?action=doctor.queue&scope=' + encodeURIComponent(queueScope) +
            facilitySuffix(root) +
            (window.NewClinicUI ? window.NewClinicUI.encodeQueueWatch(
                highlightedVisit ? [highlightedVisit] : []
            ) : '');

        return getJson(url).then(function (result) {
            if (!result.payload.success) {
                listEl.innerHTML = '<div class="alert alert-danger">' +
                    escapeHtml(result.payload.message || 'Queue load failed') + '</div>';
                return;
            }

            var data = result.payload.data || {};
            var visits = window.NewClinicUI
                ? window.NewClinicUI.mergeQueueWithClaimLost(data.visits || [], data.claim_lost_cards || [])
                : (data.visits || []);
            hasActiveConsult = !!data.has_active_consult;

            if (window.NewClinicUI) {
                window.NewClinicUI.processClaimLostPoll(data, {
                    highlightedVisitId: highlightedVisit ? highlightedVisit.visit_id : null,
                    activeVisitId: activeVisit ? activeVisit.id : null,
                    storageKey: STORAGE_KEY,
                    onActivePaneLost: function (card) {
                        var html = window.NewClinicUI.formatTakenElsewhereHtml({
                            claim_kind: 'take_patient',
                            taker_display_name: (card.claim_lost_by || {}).display_name,
                            taker_role_label: (card.claim_lost_by || {}).role_label || 'Doctor',
                            patient_display_name: card.display_name,
                            patient_mrn: card.pubpid,
                            queue_number: card.queue_number
                        });
                        showInterruptHtml(html, 'danger');
                        clearActivePane(root);
                    },
                    onHighlightLost: function () {
                        highlightedVisit = null;
                    }
                });
            }

            if (dateEl) {
                dateEl.textContent = data.visit_date || '';
            }
            if (updatedEl) {
                updatedEl.textContent = 'Updated ' + new Date().toLocaleTimeString();
            }
            if (countsEl) {
                countsEl.textContent = visits.length + ' waiting';
            }

            listEl.innerHTML = visits.length
                ? visits.map(function (card) {
                    return renderQueueCard(card, hasActiveConsult);
                }).join('')
                : '<div class="text-muted py-3"><em>No patients ready. New visits appear within 30s.</em></div>';

            doneCountEl.textContent = String((data.counts || {}).done_today || 0);
            var done = data.done_today || [];
            doneListEl.innerHTML = done.length
                ? done.map(function (row) {
                    return '<div class="small text-muted py-1">#' + escapeHtml(row.queue_number) +
                        ' ' + escapeHtml(row.display_name) + '</div>';
                }).join('')
                : '<div class="small text-muted">None yet today</div>';

            if (reopenSectionEl && reopenCountEl && reopenListEl) {
                var canReopen = !!data.can_reopen_consult;
                reopenSectionEl.style.display = canReopen ? 'block' : 'none';
                if (canReopen) {
                    var reopenable = data.reopenable_today || [];
                    reopenCountEl.textContent = String((data.counts || {}).reopenable_today || reopenable.length);
                    reopenListEl.innerHTML = reopenable.length
                        ? reopenable.map(function (row) {
                            var stateLabel = String(row.state || '').replace(/_/g, ' ');
                            return '<div class="d-flex justify-content-between align-items-start py-1 border-bottom">' +
                                '<div class="small">' +
                                '<div>#' + escapeHtml(row.queue_number) + ' ' + escapeHtml(row.display_name) + '</div>' +
                                '<div class="text-muted">' + escapeHtml(stateLabel) + '</div>' +
                                '</div>' +
                                '<button type="button" class="btn btn-outline-warning btn-sm nc-doctor-reopen-btn" ' +
                                'data-visit-id="' + escapeHtml(row.id) + '" ' +
                                'data-row-version="' + escapeHtml(row.row_version) + '" ' +
                                'data-patient-name="' + escapeHtml(row.display_name) + '" ' +
                                'data-mrn="' + escapeHtml(row.pubpid) + '">Reopen</button>' +
                                '</div>';
                        }).join('')
                        : '<div class="small text-muted">None sent out today</div>';
                }
            }

            if (data.active_consult && !activeVisit) {
                loadActiveConsult(root, data.active_consult.id);
            }

            if (activeVisit) {
                var activeId = parseInt(activeVisit.id, 10);
                var queueMatch = visits.find(function (card) {
                    return parseInt(card.id, 10) === activeId;
                });
                if (queueMatch && queueMatch.row_version != null) {
                    activeVisit.row_version = queueMatch.row_version;
                } else if ((data.active_consult || {}).id === activeId && data.active_consult.row_version != null) {
                    activeVisit.row_version = data.active_consult.row_version;
                }

                var onQueue = !!queueMatch;
                var stillMine = (data.active_consult || {}).id === activeId;
                if (!onQueue && !stillMine) {
                    clearActivePane(root);
                    hasActiveConsult = !!data.has_active_consult;
                }
            }
        });
    }

    function loadActiveConsult(root, visitId) {
        var ajaxUrl = root.dataset.ajaxUrl;
        var csrfToken = root.dataset.csrfToken;
        var pane = ensureActivePane(root);
        pane.innerHTML = '<div class="card"><div class="card-body"><em>Loading consult…</em></div></div>';

        return postJson(ajaxUrl + '?action=doctor.active', {
            visit_id: visitId,
            csrf_token_form: csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                handleApiFailure(root, result, pane);
                return false;
            }

            hideInterrupt();
            var data = result.payload.data || {};
            activeVisit = data.visit || null;
            activePreview = data.preview || null;
            activeRouting = data.routing_preview || null;
            activeSignMeta = {
                encounter_signed: !!data.encounter_signed,
                require_esign_before_complete_consult: !!data.require_esign_before_complete_consult,
                encounter_url: data.encounter_url || '',
                routing_chips: data.routing_chips || null
            };
            if (activeVisit) {
                window.sessionStorage.setItem(STORAGE_KEY, String(activeVisit.id));
            }
            renderActivePane(root, activePreview, activeVisit, activeSignMeta);
            loadQueue(root);
            return true;
        }).catch(function () {
            pane.innerHTML = '<div class="alert alert-danger m-0">Failed to load consult.</div>';
            return false;
        });
    }

    function takePatient(root, visitId, rowVersion) {
        var ajaxUrl = root.dataset.ajaxUrl;
        var csrfToken = root.dataset.csrfToken;
        var pane = ensureActivePane(root);
        pane.innerHTML = '<div class="card"><div class="card-body"><em>Taking patient…</em></div></div>';

        postJson(ajaxUrl + '?action=doctor.take', {
            visit_id: visitId,
            row_version: rowVersion,
            csrf_token_form: csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                handleApiFailure(root, result, pane);
                return;
            }

            hideInterrupt();
            var data = result.payload.data || {};
            activeVisit = data.visit || null;
            activePreview = data.preview || null;
            activeRouting = data.routing_preview || null;
            activeSignMeta = {
                encounter_signed: !!data.encounter_signed,
                require_esign_before_complete_consult: !!data.require_esign_before_complete_consult,
                encounter_url: data.encounter_url || '',
                routing_chips: data.routing_chips || null
            };
            if (activeVisit) {
                window.sessionStorage.setItem(STORAGE_KEY, String(activeVisit.id));
            }
            renderActivePane(root, activePreview, activeVisit, activeSignMeta);
            loadQueue(root);
        }).catch(function () {
            pane.innerHTML = '<div class="alert alert-danger m-0">Failed to take patient.</div>';
        });
    }

    function openRoutingModal(root, visit, preview) {
        var modal = document.getElementById('nc-doctor-routing-modal');
        var backdrop = document.getElementById('nc-doctor-modal-backdrop');
        var identity = (preview || {}).identity || {};
        var routing = activeRouting || {};

        document.getElementById('nc-routing-patient').textContent =
            identity.display_name + ' · MRN ' + (identity.pubpid || '');
        document.getElementById('nc-routing-detected').textContent =
            'System detected: ' + (routing.lab_count || 0) + ' lab order(s), ' +
            (routing.rx_count || 0) + ' Rx today';
        document.getElementById('nc-routing-lab').checked = !!routing.detected_lab;
        document.getElementById('nc-routing-rx').checked = !!routing.detected_rx && !routing.detected_lab;
        document.getElementById('nc-routing-notes').value = '';
        document.getElementById('nc-routing-error').classList.add('d-none');

        showModal(modal, backdrop);

        document.getElementById('nc-routing-confirm').onclick = function () {
            confirmRouting(root, visit);
        };
    }

    function openReopenModal(root, visitMeta) {
        var modal = document.getElementById('nc-doctor-reopen-modal');
        var backdrop = document.getElementById('nc-doctor-modal-backdrop');
        pendingReopen = visitMeta;

        document.getElementById('nc-reopen-patient').textContent =
            visitMeta.patientName + ' · MRN ' + (visitMeta.mrn || '');
        document.getElementById('nc-reopen-reason').value = '';
        document.getElementById('nc-reopen-error').classList.add('d-none');

        showModal(modal, backdrop);
    }

    function confirmReopen(root) {
        if (!pendingReopen) {
            return;
        }
        var ajaxUrl = root.dataset.ajaxUrl;
        var csrfToken = root.dataset.csrfToken;
        var errorEl = document.getElementById('nc-reopen-error');
        var modal = document.getElementById('nc-doctor-reopen-modal');
        var backdrop = document.getElementById('nc-doctor-modal-backdrop');
        var reason = document.getElementById('nc-reopen-reason').value.trim();

        if (reason.length < 10) {
            errorEl.textContent = 'Please enter a reason of at least 10 characters';
            errorEl.classList.remove('d-none');
            return;
        }
        if (window.NewClinicUI && window.NewClinicUI.isSharedDeviceBlocked(root)) {
            return;
        }

        postJson(ajaxUrl + '?action=doctor.reopen', {
            visit_id: pendingReopen.visitId,
            row_version: pendingReopen.rowVersion,
            reason: reason,
            csrf_token_form: csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                if (handleApiFailure(root, result)) {
                    return;
                }
                errorEl.textContent = result.payload.message || 'Reopen failed';
                errorEl.classList.remove('d-none');
                return;
            }

            hideModal(modal, backdrop);
            hideInterrupt();
            pendingReopen = null;
            showDeskNotice('Consult reopened — you can order lab or Rx. Signed notes stay locked.', 'success');
            loadActiveConsult(root, parseInt((result.payload.data || {}).visit.id, 10));
        }).catch(function () {
            errorEl.textContent = 'Network error — reopen failed';
            errorEl.classList.remove('d-none');
        });
    }

    function confirmRouting(root, visit) {
        var ajaxUrl = root.dataset.ajaxUrl;
        var csrfToken = root.dataset.csrfToken;
        var errorEl = document.getElementById('nc-routing-error');
        var modal = document.getElementById('nc-doctor-routing-modal');
        var backdrop = document.getElementById('nc-doctor-modal-backdrop');
        var needsLab = document.getElementById('nc-routing-lab').checked;
        var needsRx = document.getElementById('nc-routing-rx').checked;

        if (needsLab && needsRx) {
            errorEl.textContent = 'Choose lab or pharmacy routing, not both';
            errorEl.classList.remove('d-none');
            return;
        }
        if (window.NewClinicUI && window.NewClinicUI.isSharedDeviceBlocked(root)) {
            return;
        }

        postJson(ajaxUrl + '?action=doctor.complete', {
            visit_id: visit.id,
            row_version: visit.row_version,
            needs_lab: needsLab,
            needs_rx: needsRx,
            notes: document.getElementById('nc-routing-notes').value.trim(),
            csrf_token_form: csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                var payload = result.payload || {};
                var data = payload.data || {};
                if (result.status === 409 && data.code === 'encounter_unsigned') {
                    errorEl.textContent = payload.message || 'Documentation must be signed first';
                    errorEl.classList.remove('d-none');
                    if (data.encounter_url) {
                        window.open(data.encounter_url, '_blank', 'noopener,noreferrer');
                    }
                    return;
                }
                errorEl.textContent = result.payload.message || 'Complete failed';
                errorEl.classList.remove('d-none');
                return;
            }

            hideModal(modal, backdrop);
            hideInterrupt();
            clearActivePane(root);
            loadQueue(root);
        }).catch(function () {
            errorEl.textContent = 'Network error — complete failed';
            errorEl.classList.remove('d-none');
        });
    }

    function formatLabMoney(symbol, amount) {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return '';
        }
        var sym = symbol || '';
        return sym + Number(amount).toFixed(2);
    }

    function updateLabPanelTotal(catalog) {
        var totalEl = document.getElementById('nc-lab-panel-total');
        if (!totalEl) {
            return;
        }
        var symbol = (catalog && catalog.currency_symbol) ? catalog.currency_symbol : '';
        var total = 0;
        var hasFee = false;
        document.querySelectorAll('.nc-lab-panel-test:checked').forEach(function (input) {
            var fee = parseFloat(input.getAttribute('data-fee') || '');
            if (!isNaN(fee)) {
                total += fee;
                hasFee = true;
            }
        });
        totalEl.textContent = hasFee
            ? ('Estimated: ' + formatLabMoney(symbol, total))
            : '';
    }

    function bindLabPanelTestInputs(catalog) {
        document.querySelectorAll('.nc-lab-panel-test').forEach(function (input) {
            input.addEventListener('change', function () {
                updateLabPanelTotal(catalog);
            });
        });
        var starterBtn = document.getElementById('nc-lab-panel-starter');
        if (starterBtn) {
            starterBtn.addEventListener('click', function () {
                document.querySelectorAll('.nc-lab-panel-test').forEach(function (input) {
                    input.checked = input.getAttribute('data-starter') === '1';
                });
                updateLabPanelTotal(catalog);
            });
        }
    }

    function openLabPanelModal(root) {
        if (!activeVisit) {
            return;
        }
        var modal = document.getElementById('nc-doctor-lab-panel-modal');
        var backdrop = document.getElementById('nc-doctor-modal-backdrop');
        var testsEl = document.getElementById('nc-lab-panel-tests');
        var hintEl = document.getElementById('nc-lab-panel-hint');
        var errorEl = document.getElementById('nc-lab-panel-error');
        var totalEl = document.getElementById('nc-lab-panel-total');
        if (!modal || !testsEl) {
            runShortcut(root, 'lab');
            return;
        }
        if (errorEl) {
            errorEl.classList.add('d-none');
            errorEl.textContent = '';
        }
        testsEl.innerHTML = '<p class="text-muted small mb-0">Loading tests…</p>';
        if (hintEl) {
            hintEl.textContent = '';
        }
        if (totalEl) {
            totalEl.textContent = '';
        }
        showModal(modal, backdrop);

        getJson(root.dataset.ajaxUrl + '?action=doctor.lab_panel_catalog' + facilitySuffix(root))
            .then(function (result) {
                var payload = result.payload || {};
                var data = payload.data || {};
                if (!payload.success || !data.has_catalog) {
                    testsEl.innerHTML = '<p class="text-warning mb-0">' +
                        escapeHtml('Lab catalog is not ready. Use Full lab form or complete Lab Operations setup.') +
                        '</p>';
                    return;
                }
                var hintParts = [];
                if (data.provider_name) {
                    hintParts.push('From ' + data.provider_name);
                }
                if (data.auto_bill_on_order) {
                    hintParts.push('Mapped tests auto-add cashier charges');
                }
                if (hintEl && hintParts.length) {
                    hintEl.textContent = hintParts.join(' — ') + '.';
                }
                testsEl.innerHTML = (data.tests || []).map(function (test) {
                    var feeLabel = test.has_fee
                        ? (' <span class="text-muted">' + escapeHtml(
                            formatLabMoney(data.currency_symbol, test.fee_amount)
                        ) + '</span>')
                        : ' <span class="text-muted">(no fee mapped)</span>';
                    return '<div class="form-check">' +
                        '<input class="form-check-input nc-lab-panel-test" type="checkbox" value="' +
                        escapeHtml(test.procedure_type_id) + '" id="nc-lab-panel-test-' +
                        escapeHtml(test.procedure_type_id) + '" data-fee="' +
                        escapeHtml(test.fee_amount != null ? String(test.fee_amount) : '') + '" data-starter="' +
                        (test.is_starter ? '1' : '0') + '">' +
                        '<label class="form-check-label" for="nc-lab-panel-test-' +
                        escapeHtml(test.procedure_type_id) + '">' +
                        escapeHtml(test.name) +
                        (test.code ? (' <span class="text-muted">(' + escapeHtml(test.code) + ')</span>') : '') +
                        feeLabel +
                        '</label></div>';
                }).join('');
                bindLabPanelTestInputs(data);
            });
    }

    function placeLabPanelOrder(root) {
        if (!activeVisit) {
            return;
        }
        var modal = document.getElementById('nc-doctor-lab-panel-modal');
        var backdrop = document.getElementById('nc-doctor-modal-backdrop');
        var errorEl = document.getElementById('nc-lab-panel-error');
        var ids = [];
        document.querySelectorAll('.nc-lab-panel-test:checked').forEach(function (input) {
            ids.push(parseInt(input.value, 10));
        });
        if (!ids.length) {
            if (errorEl) {
                errorEl.textContent = 'Select at least one test.';
                errorEl.classList.remove('d-none');
            }
            return;
        }
        if (window.NewClinicUI && window.NewClinicUI.isSharedDeviceBlocked(root)) {
            return;
        }

        postJson(root.dataset.ajaxUrl + '?action=doctor.lab_panel_place', {
            visit_id: activeVisit.id,
            procedure_type_ids: ids,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            var payload = result.payload || {};
            if (!payload.success) {
                if (errorEl) {
                    errorEl.textContent = payload.message || 'Order failed';
                    errorEl.classList.remove('d-none');
                }
                return;
            }
            hideModal(modal, backdrop);
            activeRouting = payload.data.routing_chips || activeRouting;
            var billing = payload.data.billing || {};
            if (billing.posted_count > 0) {
                showDeskNotice(
                    billing.posted_count + ' lab charge(s) posted to encounter (' +
                    formatLabMoney(billing.currency_symbol, billing.charges_total) + ').',
                    'info'
                );
            } else if ((billing.unmapped_codes || []).length > 0) {
                showDeskNotice(
                    'Lab order placed. Map fees in Lab Ops setup to auto-post charges.',
                    'info'
                );
            }
            if (activePreview && activeVisit) {
                renderActivePane(root, activePreview, activeVisit, {
                    routing_chips: activeRouting,
                    encounter_signed: activeSignMeta ? activeSignMeta.encounter_signed : false,
                    require_esign_before_complete_consult: activeSignMeta
                        ? activeSignMeta.require_esign_before_complete_consult
                        : false
                });
            }
            loadQueue(root);
        });
    }

    function runShortcut(root, shortcut) {
        if (!activeVisit) {
            return;
        }

        if (shortcut === 'chart') {
            postJson(root.dataset.ajaxUrl + '?action=doctor.shortcut_preflight', {
                visit_id: activeVisit.id,
                shortcut: 'chart',
                csrf_token_form: root.dataset.csrfToken
            }).then(function (result) {
                if (result.payload.success) {
                    window.open(result.payload.data.redirect_url, '_blank', 'noopener,noreferrer');
                } else {
                    window.alert(result.payload.message || 'Chart link failed');
                }
            });
            return;
        }

        window.sessionStorage.setItem(STORAGE_KEY, String(activeVisit.id));
        window.sessionStorage.setItem(LEFT_VIA_KEY, shortcut);

        postJson(root.dataset.ajaxUrl + '?action=doctor.shortcut_preflight', {
            visit_id: activeVisit.id,
            shortcut: shortcut,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                if ((result.payload.data || {}).code === 'session_mismatch') {
                    document.getElementById('nc-doctor-session-banner').classList.remove('d-none');
                }
                window.alert(result.payload.message || 'Shortcut failed');
                return;
            }
            window.location = result.payload.data.redirect_url;
        });
    }

    function restoreSession(root) {
        if (!activeVisit) {
            return;
        }

        postJson(root.dataset.ajaxUrl + '?action=doctor.restore_session', {
            visit_id: activeVisit.id,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (result.payload.success) {
                document.getElementById('nc-doctor-session-banner').classList.add('d-none');
            } else {
                window.alert(result.payload.message || 'Restore failed');
            }
        });
    }

    function bindQueueHighlight(root) {
        root.addEventListener('mouseenter', function (event) {
            var btn = event.target.closest('.nc-queue-card');
            if (!btn || !root.contains(btn) || btn.disabled) {
                return;
            }
            var visitId = parseInt(btn.getAttribute('data-visit-id') || '0', 10);
            if (visitId > 0) {
                highlightedVisit = {
                    visit_id: visitId,
                    from_state: btn.getAttribute('data-from-state') || 'ready_for_doctor'
                };
            }
        }, true);
    }

    function bindReopenClicks(root) {
        root.addEventListener('click', function (event) {
            var btn = event.target.closest('.nc-doctor-reopen-btn');
            if (!btn || !root.contains(btn) || btn.disabled) {
                return;
            }
            event.preventDefault();
            openReopenModal(root, {
                visitId: parseInt(btn.getAttribute('data-visit-id') || '0', 10),
                rowVersion: parseInt(btn.getAttribute('data-row-version') || '0', 10),
                patientName: btn.getAttribute('data-patient-name') || '',
                mrn: btn.getAttribute('data-mrn') || ''
            });
        });
    }

    function bindQueueClicks(root) {
        root.addEventListener('click', function (event) {
            var btn = event.target.closest('.nc-queue-card');
            if (!btn || !root.contains(btn) || btn.disabled) {
                return;
            }
            event.preventDefault();
            var visitId = parseInt(btn.getAttribute('data-visit-id') || '0', 10);
            if (visitId <= 0) {
                return;
            }

            getJson(root.dataset.ajaxUrl + '?action=doctor.queue&scope=' + encodeURIComponent(queueScope) +
                facilitySuffix(root))
                .then(function (result) {
                    if (!result.payload.success) {
                        return;
                    }
                    var visits = result.payload.data.visits || [];
                    var match = visits.find(function (v) {
                        return String(v.id) === String(visitId);
                    });
                    if (!match) {
                        showInterrupt('Visit is no longer in the queue.');
                        loadQueue(root);
                        return;
                    }
                    takePatient(root, visitId, parseInt(match.row_version, 10) || 0);
                });
        });
    }

    function init(root) {
        if (!root) {
            return;
        }

        queueScope = root.dataset.multiDoctor === '1' ? 'me' : 'all';
        var scopeEl = pageEl('nc-doctor-scope');
        if (scopeEl) {
            scopeEl.value = queueScope;
            scopeEl.addEventListener('change', function () {
                queueScope = scopeEl.value;
                loadQueue(root);
            });
        }

        ensureActivePane(root);
        bindQueueClicks(root);
        bindReopenClicks(root);
        bindQueueHighlight(root);
        loadQueue(root);

        pollTimer = window.setInterval(function () {
            if (!document.hidden) {
                loadQueue(root);
            }
        }, window.NewClinicUI ? window.NewClinicUI.resolveQueuePollMs(root) : POLL_MS);

        var refreshBtn = pageEl('nc-doctor-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                loadQueue(root);
            });
        }

        document.getElementById('nc-doctor-done-toggle').addEventListener('click', function () {
            var list = document.getElementById('nc-doctor-done-list');
            list.style.display = list.style.display === 'none' ? 'block' : 'none';
        });

        var reopenToggle = document.getElementById('nc-doctor-reopen-toggle');
        if (reopenToggle) {
            reopenToggle.addEventListener('click', function () {
                var list = document.getElementById('nc-doctor-reopen-list');
                if (list) {
                    list.style.display = list.style.display === 'none' ? 'block' : 'none';
                }
            });
        }

        document.getElementById('nc-doctor-interrupt-dismiss').addEventListener('click', function () {
            hideInterrupt();
            clearActivePane(root);
            loadQueue(root);
        });

        if (window.NewClinicUI && window.NewClinicUI.wireSharedDeviceSessionWarning) {
            window.NewClinicUI.wireSharedDeviceSessionWarning(root, {
                storageKey: STORAGE_KEY,
                compareMode: 'clinical',
                restoreAction: 'doctor.restore_session',
                bannerId: 'nc-doctor-session-banner',
                bannerTextId: 'nc-doctor-session-banner-text',
                restoreButtonId: 'nc-doctor-restore-session',
                returnQueueButtonId: 'nc-doctor-return-queue',
                onReturnToQueue: function () {
                    clearActivePane(root);
                    loadQueue(root);
                }
            });
        }

        var modal = document.getElementById('nc-doctor-routing-modal');
        var backdrop = document.getElementById('nc-doctor-modal-backdrop');
        if (modal && backdrop) {
            modal.querySelectorAll('.nc-modal-close').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    hideModal(modal, backdrop);
                });
            });
        }

        var reopenModal = document.getElementById('nc-doctor-reopen-modal');
        if (reopenModal && backdrop) {
            reopenModal.querySelectorAll('.nc-modal-close').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    hideModal(reopenModal, backdrop);
                    pendingReopen = null;
                });
            });
            var reopenConfirm = document.getElementById('nc-reopen-confirm');
            if (reopenConfirm) {
                reopenConfirm.addEventListener('click', function () {
                    confirmReopen(root);
                });
            }
        }

        var labPanelModal = document.getElementById('nc-doctor-lab-panel-modal');
        if (labPanelModal && backdrop) {
            labPanelModal.querySelectorAll('.nc-modal-close').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    hideModal(labPanelModal, backdrop);
                });
            });
            var placeBtn = document.getElementById('nc-lab-panel-place');
            if (placeBtn) {
                placeBtn.addEventListener('click', function () {
                    placeLabPanelOrder(root);
                });
            }
            var fullFormBtn = labPanelModal.querySelector('.nc-lab-panel-full-form');
            if (fullFormBtn) {
                fullFormBtn.addEventListener('click', function () {
                    hideModal(labPanelModal, backdrop);
                    runShortcut(root, 'lab');
                });
            }
        }

        window.addEventListener('pageshow', function () {
            var storedId = window.sessionStorage.getItem(STORAGE_KEY);
            var leftVia = window.sessionStorage.getItem(LEFT_VIA_KEY);
            if (!storedId) {
                return;
            }

            loadActiveConsult(root, parseInt(storedId, 10)).then(function (loaded) {
                if (!loaded || leftVia !== 'lab') {
                    return;
                }
                window.sessionStorage.removeItem(LEFT_VIA_KEY);
                var chips = (activeSignMeta || {}).routing_chips || {};
                if (chips.lab_ordered) {
                    if (chips.lab_order_incomplete) {
                        showDeskNotice(
                            'Lab order saved but no tests were added. Open Order lab again and add at least one test line.',
                            'warning'
                        );
                    } else {
                        showDeskNotice(
                            'Lab order saved for this visit. Continue the consult or route to lab when finished.',
                            'success'
                        );
                    }
                }
            });
        });
    }

    window.NewClinicDoctor = { init: init };
})(window);

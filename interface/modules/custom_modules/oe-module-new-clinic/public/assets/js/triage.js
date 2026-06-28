(function (window) {
    'use strict';

    var POLL_MS = 30000;
    var activeVisit = null;
    var STORAGE_KEY = 'triage_desk_active_visit_id';
    var activePreview = null;
    var formDirty = false;
    var pollTimer = null;
    var autoStartPid = null;
    var visitTypes = [];
    var tempUnitLabel = '°C';
    var queueLoadGuard = null;
    var vitalsValidator = null;
    var vitalsRules = {};
    var vitalsSaving = false;
    var highlightedVisit = null;

    function getQueueLoadGuard() {
        if (!queueLoadGuard && window.NewClinicUI && window.NewClinicUI.createRequestGuard) {
            queueLoadGuard = window.NewClinicUI.createRequestGuard();
        }
        if (!queueLoadGuard) {
            queueLoadGuard = {
                next: function () { return 1; },
                isStale: function () { return false; }
            };
        }
        return queueLoadGuard;
    }

    function pageEl(id) {
        if (window.NewClinicUI && window.NewClinicUI.pageEl) {
            return window.NewClinicUI.pageEl(id);
        }
        return document.getElementById(id);
    }

    function setPageText(id, text) {
        if (window.NewClinicUI && window.NewClinicUI.setPageText) {
            window.NewClinicUI.setPageText(id, text);
            return;
        }
        var el = document.getElementById(id);
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
        modal.style.display = 'block';
        modal.classList.add('show');
        backdrop.style.display = 'block';
        backdrop.classList.add('show');
    }

    function hideModal(modal, backdrop) {
        modal.style.display = 'none';
        modal.classList.remove('show');
        backdrop.style.display = 'none';
        backdrop.classList.remove('show');
    }

    function markDirty() {
        formDirty = true;
    }

    function clearDirty() {
        formDirty = false;
    }

    function ensureActivePane(root) {
        var pane = root.querySelector('#nc-triage-active-pane');
        if (!pane) {
            pane = document.createElement('div');
            pane.id = 'nc-triage-active-pane';
            pane.className = 'col-lg-8 mb-3';
            root.querySelector('.row').appendChild(pane);
        }

        if (!pane.querySelector('.card')) {
            pane.innerHTML =
                '<div class="card"><div class="card-body text-muted text-center py-5">' +
                '<em>Select a patient from the queue or use Find patient.</em></div></div>';
        }

        return pane;
    }

    function bindQueueHighlight(root) {
        root.addEventListener('mouseenter', function (event) {
            var btn = event.target.closest('.nc-queue-card');
            if (!btn || !root.contains(btn)) {
                return;
            }
            var visitId = parseInt(btn.getAttribute('data-visit-id') || '0', 10);
            var fromState = btn.getAttribute('data-from-state') || 'waiting';
            if (visitId > 0) {
                highlightedVisit = { visit_id: visitId, from_state: fromState };
            }
        }, true);
    }

    function bindQueueClicks(root) {
        root.addEventListener('click', function (event) {
            var btn = event.target.closest('.nc-queue-card');
            if (!btn || !root.contains(btn)) {
                return;
            }
            event.preventDefault();
            var visitId = parseInt(btn.getAttribute('data-visit-id') || '0', 10);
            if (visitId > 0) {
                selectVisit(root, visitId);
            }
        });
    }

    function renderQueueCard(card, activeId) {
        var modifiers = [];
        if (String(card.id) === String(activeId)) {
            modifiers.push('active');
        }
        if (card.state === 'in_triage' && card.triage_mine) {
            modifiers.push('mine');
        }
        if (card.state === 'in_triage' && !card.triage_mine) {
            modifiers.push('muted');
        }
        if (highlightedVisit && String(highlightedVisit.visit_id) === String(card.id)) {
            modifiers.push('highlighted');
        }
        var stateLabel = card.state === 'waiting' ? 'Waiting' : 'In triage';
        var subtitle = card.wait_minutes + 'm · ' + stateLabel;
        if (card.state === 'in_triage' && card.triage_mine) {
            subtitle += ' · In triage with you';
        } else if (card.state === 'in_triage' && card.triage_actor_name) {
            subtitle += ' · ' + card.triage_actor_name;
        }
        var urgent = parseInt(card.is_urgent, 10)
            ? '<span class="badge badge-warning ml-1">URGENT</span>' : '';
        return window.NewClinicUI.renderQueueCard(card, {
            modifiers: modifiers,
            badgesHtml: urgent,
            subtitleHtml: '<div class="oe-nc-queue-card__meta small text-muted">' +
                escapeHtml(card.sex || '') + ' · ' + escapeHtml(card.age_years || '—') +
                ' · ' + escapeHtml(subtitle) + '</div>',
            dataAttributes: {
                'visit-id': card.id,
                'from-state': card.state
            }
        });
    }

    function renderBanner(preview, visit) {
        var identity = preview.identity || {};
        var safety = preview.safety || {};
        var allergies = (safety.allergies_severe || []).join(', ');
        var allergyLine = allergies
            ? '<div class="text-danger small">Allergy: ' + escapeHtml(allergies) + '</div>'
            : '';
        var completion = preview.completion || {};
        var completionScore = completion.score || 0;
        var completionThreshold = completion.billing_threshold || 70;
        var completionBlocked = completionScore < completionThreshold;
        var missing = completion.missing_labels || [];
        var missingLine = missing.length
            ? '<div class="small text-muted">Missing: ' + escapeHtml(missing.slice(0, 2).join(', ')) +
            (missing.length > 2 ? '…' : '') + '</div>'
            : '';
        var demoUrl = completion.chart_url || completion.demographics_url || '';
        var demoLink = demoUrl && completionBlocked
            ? ' <a href="' + escapeHtml(demoUrl) + '" class="small">Complete profile</a>'
            : '';
        var vitals = preview.vitals_today || {};
        var vitalsLine = vitals.summary
            ? '<div class="small">Vitals today: ' + escapeHtml(vitals.summary) + '</div>'
            : '<div class="small text-warning">No vitals today</div>';
        var abnormal = vitals.vitals_abnormal_today
            ? '<span class="badge badge-danger ml-1">Vitals abnormal</span>' : '';

        return (window.NewClinicUI ? window.NewClinicUI.renderCompletionBanner(
            Object.assign({}, completion, { pid: identity.pid })
        ) : '') +
            '<div class="nc-patient-context-banner mb-3 p-3 border rounded bg-light">' +
            '<div class="d-flex justify-content-between flex-wrap">' +
            '<div>' +
            '<strong>' + escapeHtml(identity.display_name) + '</strong> · ' +
            escapeHtml(identity.sex) + ' ' + escapeHtml(identity.age_years || '—') +
            ' · MRN ' + escapeHtml(identity.pubpid) +
            '</div>' +
            '<span class="badge badge-' + (completionBlocked ? 'warning' : 'light border') + '">' +
            'Completion ' + escapeHtml(completionScore) + '%</span>' +
            demoLink +
            '</div>' +
            missingLine +
            allergyLine +
            '<div class="small mt-1">Active visit #' + escapeHtml(visit.queue_number) +
            ' · ' + escapeHtml(visit.state) + ' · ' + escapeHtml(visit.visit_type_label || 'Visit') +
            abnormal + '</div>' +
            vitalsLine +
            '</div>';
    }

    function loadVitalsRules(root, rulesFromApi) {
        if (rulesFromApi && rulesFromApi.fields) {
            vitalsRules = rulesFromApi;
        } else if (root && root.dataset.vitalsRules) {
            try {
                vitalsRules = JSON.parse(root.dataset.vitalsRules);
            } catch (e) {
                vitalsRules = {};
            }
        }
        if (window.NewClinicVitalsForm) {
            vitalsValidator = window.NewClinicVitalsForm.createValidator(vitalsRules);
        }
        if (vitalsRules.temperature_unit) {
            tempUnitLabel = vitalsRules.temperature_unit;
        }
    }

    function renderVitalsField(name, latest) {
        if (!vitalsValidator || !vitalsValidator.fields[name]) {
            return '';
        }

        var def = vitalsValidator.fields[name];
        var value = latest[name] || '';
        var requiredMark = def.required ? ' <span class="text-danger">*</span>' : '';
        var unitSuffix = def.unit ? ' (' + escapeHtml(def.unit) + ')' : '';
        var step = def.step !== undefined ? def.step : 1;
        var min = def.min !== undefined ? ' min="' + escapeHtml(def.min) + '"' : '';
        var max = def.max !== undefined ? ' max="' + escapeHtml(def.max) + '"' : '';
        var stepAttr = ' step="' + escapeHtml(step) + '"';

        return '<div class="form-group col-md-3" data-vitals-field="' + escapeHtml(name) + '">' +
            '<label class="nc-vitals-field-label" for="nc-vitals-' + escapeHtml(name) + '">' +
            escapeHtml(def.label) + unitSuffix + requiredMark +
            '<span class="nc-vitals-range-hint">Acceptable: ' + escapeHtml(def.min) + '–' +
            escapeHtml(def.max) + '</span></label>' +
            '<input type="number" class="form-control" id="nc-vitals-' + escapeHtml(name) + '"' +
            ' name="' + escapeHtml(name) + '" value="' + escapeHtml(value) + '"' +
            stepAttr + min + max + ' inputmode="decimal" autocomplete="off">' +
            '<div class="nc-vitals-feedback" aria-live="polite"></div></div>';
    }

    function renderVitalsForm(visit, formVitals, warnings, recordCount) {
        var latest = formVitals || {};
        var warningHtml = warnings.length
            ? '<div class="alert alert-warning py-2">' + warnings.map(escapeHtml).join('<br>') + '</div>'
            : '';
        var repeatHtml = recordCount > 1
            ? '<div class="alert alert-info py-2">Vitals already recorded today (' + recordCount + ' sets)</div>'
            : '';
        var fieldOrder = [
            ['bps', 'bpd', 'pulse', 'temperature'],
            ['oxygen_saturation', 'weight', 'height', 'respiration'],
            ['pain']
        ];
        var rowsHtml = fieldOrder.map(function (row) {
            return '<div class="form-row">' +
                row.map(function (name) { return renderVitalsField(name, latest); }).join('') +
                '</div>';
        }).join('');

        return warningHtml + repeatHtml +
            '<form id="nc-triage-vitals-form" class="nc-triage-vitals-form" novalidate>' +
            '<h5>Vitals</h5>' +
            '<p class="nc-vitals-required-note"><span class="text-danger">*</span> Required. ' +
            'Amber border = outside normal clinical range but still saveable. Red = fix before save.</p>' +
            rowsHtml +
            '<div class="form-group"><label>Chief complaint (optional)</label>' +
            '<textarea class="form-control" name="chief_complaint" rows="2" maxlength="500">' +
            escapeHtml(visit.chief_complaint || '') + '</textarea></div>' +
            '<div class="alert alert-danger d-none" id="nc-triage-form-error"></div>' +
            '<div class="alert alert-success d-none" id="nc-triage-form-success"></div>' +
            '</form>';
    }

    function bindVitalsValidation(root) {
        var form = root.querySelector('#nc-triage-vitals-form');
        if (!form || !vitalsValidator) {
            return;
        }

        Object.keys(vitalsValidator.fields).forEach(function (name) {
            var input = form.querySelector('[name="' + name + '"]');
            if (!input) {
                return;
            }

            var runValidation = function () {
                vitalsValidator.applyFieldFeedback(
                    input,
                    vitalsValidator.validateField(name, input.value)
                );
            };

            input.addEventListener('blur', runValidation);
            input.addEventListener('input', function () {
                if (input.dataset.touched === '1' || input.classList.contains('is-invalid')) {
                    runValidation();
                }
                markDirty();
            });
            input.addEventListener('focus', function () {
                input.dataset.touched = '1';
            });
        });
    }

    function applyServerFieldErrors(root, fieldErrors, fieldWarnings) {
        var form = root.querySelector('#nc-triage-vitals-form');
        if (!form || !vitalsValidator) {
            return;
        }

        var result = {
            fieldErrors: fieldErrors || {},
            fieldWarnings: fieldWarnings || {}
        };
        vitalsValidator.applyAllFeedback(form, result);
        vitalsValidator.focusFirstInvalid(form);
    }

    function buildVitalsSummary(formVitals, preview) {
        var vitalsToday = (preview || {}).vitals_today || {};
        if (vitalsToday.summary) {
            return vitalsToday.summary;
        }

        var latest = formVitals || {};
        var parts = [];
        if (latest.bps || latest.bpd) {
            parts.push('BP ' + (latest.bps || '—') + '/' + (latest.bpd || '—'));
        }
        if (latest.pulse) {
            parts.push('HR ' + latest.pulse);
        }
        if (latest.temperature) {
            parts.push('T ' + latest.temperature + ' ' + (tempUnitLabel || '°C'));
        }
        if (latest.oxygen_saturation) {
            parts.push('SpO2 ' + latest.oxygen_saturation + '%');
        }
        if (latest.weight) {
            parts.push('Wt ' + latest.weight + ' kg');
        }
        if (latest.respiration) {
            parts.push('RR ' + latest.respiration);
        }
        if (latest.pain !== undefined && latest.pain !== '') {
            parts.push('Pain ' + latest.pain);
        }

        return parts.length ? parts.join(' · ') : 'Vitals recorded';
    }

    function renderVitalsSavedPanel(formVitals, warnings, recordCount, savedAt) {
        var summary = buildVitalsSummary(formVitals, activePreview);
        var timeLabel = savedAt ? savedAt.toLocaleTimeString() : new Date().toLocaleTimeString();
        var warningHtml = warnings.length
            ? '<div class="alert alert-warning py-2 px-3 mt-2 mb-0 border border-warning">' +
            '<strong class="d-block mb-1">Review before sending to doctor</strong>' +
            warnings.map(escapeHtml).join('<br>') +
            '</div>'
            : '';
        var repeatHtml = recordCount > 1
            ? '<div class="small text-muted mt-2">' + escapeHtml(recordCount + ' vitals sets recorded today.') + '</div>'
            : '';

        return '<div class="nc-triage-vitals-saved" role="status" aria-live="polite">' +
            '<div class="d-flex align-items-start">' +
            '<span class="badge badge-success mr-2 mt-1">Saved</span>' +
            '<div class="flex-grow-1">' +
            '<strong>Vitals saved at ' + escapeHtml(timeLabel) + '</strong>' +
            '<div class="nc-triage-vitals-saved__summary mt-2">' + escapeHtml(summary) + '</div>' +
            warningHtml +
            repeatHtml +
            '<p class="text-muted small mb-0 mt-2">Send the patient to the doctor, or record another set if needed.</p>' +
            '</div></div></div>';
    }

    function renderActions(root, visit, mode) {
        var state = visit.state;
        mode = mode || 'form';

        if (state === 'in_triage' && mode === 'saved') {
            return '<div class="d-flex flex-wrap align-items-center mt-3">' +
                '<button type="button" class="btn btn-info mr-2" id="nc-triage-send-btn">Send to doctor</button>' +
                '<button type="button" class="btn btn-outline-primary mr-2" id="nc-triage-reenter-btn">' +
                'Record another set</button>' +
                '<a class="btn btn-outline-secondary btn-sm" href="' +
                escapeHtml(root.dataset.visitBoardUrl || '') +
                '" target="_top">View on Visit Board</a>' +
                '</div>';
        }

        var startBtn = state === 'waiting'
            ? '<button type="button" class="btn btn-primary mr-2" id="nc-triage-start-btn">Start triage</button>'
            : '';
        var saveBtn = state === 'in_triage'
            ? '<button type="button" class="btn btn-success mr-2" id="nc-triage-save-btn">Save vitals</button>'
            : '';

        return '<div class="d-flex flex-wrap align-items-center mt-3">' +
            startBtn + saveBtn +
            '<a class="btn btn-outline-secondary btn-sm ml-2" href="' +
            escapeHtml(root.dataset.visitBoardUrl || '') +
            '" target="_top">View on Visit Board</a>' +
            '</div>';
    }

    function bindActionHandlers(root, visit, mode, panelData) {
        panelData = panelData || {};

        var startBtn = root.querySelector('#nc-triage-start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', function () {
                startTriage(root);
            });
        }

        var saveBtn = root.querySelector('#nc-triage-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                saveVitals(root);
            });
        }

        var sendBtn = root.querySelector('#nc-triage-send-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', function () {
                sendToDoctor(root);
            });
        }

        var reenterBtn = root.querySelector('#nc-triage-reenter-btn');
        if (reenterBtn) {
            reenterBtn.addEventListener('click', function () {
                renderActivePane(
                    root,
                    activePreview,
                    visit,
                    {},
                    panelData.warnings || [],
                    panelData.recordCount || 0,
                    { mode: 'form', forceForm: true }
                );
            });
        }
    }

    function renderActivePane(root, preview, visit, formVitals, warnings, recordCount, options) {
        options = options || {};
        var pane = ensureActivePane(root);
        if (!visit) {
            pane.innerHTML = '<div class="alert alert-danger m-0">Visit details unavailable.</div>';
            return;
        }

        var warningList = Array.isArray(warnings) ? warnings : [];
        var mode = options.mode;
        if (!mode) {
            mode = recordCount > 0 && !options.forceForm ? 'saved' : 'form';
        }

        var bodyHtml = renderBanner(preview || {}, visit);
        if (mode === 'saved') {
            bodyHtml += renderVitalsSavedPanel(
                formVitals,
                warningList,
                recordCount || 0,
                options.savedAt || null
            );
        } else {
            bodyHtml += renderVitalsForm(visit, formVitals, warningList, recordCount || 0);
        }
        bodyHtml += renderActions(root, visit, mode);

        pane.innerHTML = '<div class="card"><div class="card-body">' + bodyHtml + '</div></div>';

        if (mode === 'form') {
            pane.querySelectorAll('#nc-triage-vitals-form textarea')
                .forEach(function (el) {
                    el.addEventListener('input', markDirty);
                });
            bindVitalsValidation(root);
        }

        bindActionHandlers(root, visit, mode, {
            warnings: warningList,
            recordCount: recordCount || 0
        });
    }

    function collectVitals(form) {
        var vitals = {};
        ['bps', 'bpd', 'pulse', 'temperature', 'weight', 'height', 'oxygen_saturation', 'respiration', 'pain']
            .forEach(function (name) {
                var input = form.querySelector('[name="' + name + '"]');
                if (input && input.value !== '') {
                    vitals[name] = input.value;
                }
            });
        return vitals;
    }

    function showInterrupt(root, message) {
        var banner = document.getElementById('nc-triage-interrupt');
        var textEl = document.getElementById('nc-triage-interrupt-text');
        if (!banner || !textEl) {
            window.alert(message);
            return;
        }
        textEl.textContent = message;
        banner.className = 'alert alert-warning mb-3';
        banner.classList.remove('d-none');
    }

    function showInterruptHtml(root, html, variant) {
        var banner = document.getElementById('nc-triage-interrupt');
        var textEl = document.getElementById('nc-triage-interrupt-text');
        if (!banner || !textEl) {
            return;
        }
        textEl.innerHTML = html;
        banner.className = 'alert alert-' + (variant || 'danger') + ' mb-3';
        banner.classList.remove('d-none');
    }

    function hideInterrupt() {
        var banner = document.getElementById('nc-triage-interrupt');
        var textEl = document.getElementById('nc-triage-interrupt-text');
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
        var data = payload.data || {};
        var code = data.code || '';
        var message = payload.message || 'Request failed';
        var conflict = window.NewClinicUI ? window.NewClinicUI.resolveVisitConflict(result) : null;

        if (conflict && conflict.type === 'stale_visit') {
            showInterrupt(root, 'Another user updated this visit first. Refresh the queue and try again.');
            if (pane) {
                pane.innerHTML = '<div class="card"><div class="card-body text-muted text-center py-5">' +
                    '<em>Visit was updated elsewhere. Select a patient from the queue.</em></div></div>';
            }
            activeVisit = null;
            clearDirty();
            loadQueue(root);
            return true;
        }

        if (conflict && conflict.type === 'taken_elsewhere') {
            showInterruptHtml(root, conflict.html, 'danger');
            if (pane) {
                pane.innerHTML = '<div class="card"><div class="card-body text-muted text-center py-5">' +
                    '<em>Another nurse started triage first. Select a patient from the queue.</em></div></div>';
            }
            activeVisit = null;
            clearDirty();
            loadQueue(root);
            return true;
        }

        if (conflict && conflict.type === 'visit_not_takeable') {
            showInterrupt(root, conflict.message);
            loadQueue(root);
            return true;
        }

        if (result.status === 400 && code === 'validation') {
            hideInterrupt();
            applyServerFieldErrors(root, data.field_errors || {}, data.field_warnings || {});
            showFormError(root, message);
            return true;
        }

        if (pane && !root.querySelector('#nc-triage-vitals-form')) {
            pane.innerHTML = '<div class="alert alert-danger m-0">' + escapeHtml(message) + '</div>';
        } else {
            showFormError(root, message);
        }
        return true;
    }

    function showFormError(root, message) {
        var el = root.querySelector('#nc-triage-form-error');
        if (el) {
            el.textContent = message;
            el.classList.remove('d-none');
        }
    }

    function showFormSuccess(root, message) {
        var el = root.querySelector('#nc-triage-form-success');
        if (el) {
            el.textContent = message;
            el.classList.remove('d-none');
        }
    }

    function loadQueue(root) {
        var ajaxUrl = root.dataset.ajaxUrl;
        var listEl = root.querySelector('#nc-triage-queue-list');
        var countsEl = root.querySelector('#nc-triage-counts');
        var updatedEl = pageEl('nc-triage-updated');
        var dateEl = pageEl('nc-triage-date');
        var hintEl = root.querySelector('#nc-triage-empty-hint');
        if (!listEl) {
            return Promise.resolve();
        }

        var guard = getQueueLoadGuard();
        var token = guard.next();

        return getJson(ajaxUrl + '?action=triage.queue' + facilitySuffix(root) +
            (window.NewClinicUI ? window.NewClinicUI.encodeQueueWatch(
                highlightedVisit ? [highlightedVisit] : []
            ) : '')).then(function (result) {
            if (guard.isStale(token)) {
                return;
            }
            if (!result.payload.success) {
                var msg = result.payload.message || 'Queue load failed';
                listEl.innerHTML = '<div class="alert alert-danger">' + escapeHtml(msg) + '</div>';
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
            if (data.vitals_unit_label) {
                tempUnitLabel = data.vitals_unit_label;
            }
            if (data.vitals_form_rules) {
                loadVitalsRules(root, data.vitals_form_rules);
            }
            var visits = window.NewClinicUI
                ? window.NewClinicUI.mergeQueueWithClaimLost(data.visits || [], data.claim_lost_cards || [])
                : (data.visits || []);
            if (dateEl) {
                dateEl.textContent = data.visit_date || '';
            }
            if (updatedEl) {
                updatedEl.textContent = 'Updated ' + new Date().toLocaleTimeString();
            }
            if (countsEl) {
                countsEl.textContent = 'Waiting ' + ((data.counts || {}).waiting || 0) +
                    ' · In triage ' + ((data.counts || {}).in_triage || 0);
            }

            if (!visits.length) {
                listEl.innerHTML = '<div class="text-muted py-3"><em>Triage queue clear. New visits appear within 30s.</em></div>';
                if (hintEl) {
                    hintEl.style.display = 'block';
                }
                return;
            }

            hintEl.style.display = 'block';
            listEl.innerHTML = visits.map(function (card) {
                return renderQueueCard(card, activeVisit ? activeVisit.id : null);
            }).join('');

            if (activeVisit) {
                var activeId = parseInt(activeVisit.id, 10);
                var queueMatch = visits.find(function (card) {
                    return parseInt(card.id, 10) === activeId;
                });
                if (queueMatch && queueMatch.row_version != null) {
                    activeVisit.row_version = queueMatch.row_version;
                }
            }
        });
    }

    function selectVisit(root, visitId, force) {
        if (!force && formDirty && activeVisit && String(activeVisit.id) !== String(visitId)) {
            if (!window.confirm('Discard unsaved vitals and open another patient?')) {
                return;
            }
        }

        var ajaxUrl = root.dataset.ajaxUrl;
        var csrfToken = root.dataset.csrfToken;
        var pane = ensureActivePane(root);
        pane.innerHTML = '<div class="card"><div class="card-body"><em>Loading patient…</em></div></div>';

        postJson(ajaxUrl + '?action=triage.select', {
            visit_id: visitId,
            csrf_token_form: csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                handleApiFailure(root, result, pane);
                return;
            }

            hideInterrupt();
            var data = result.payload.data || {};
            if (data.vitals_unit_label) {
                tempUnitLabel = data.vitals_unit_label;
            }
            if (data.vitals_form_rules) {
                loadVitalsRules(root, data.vitals_form_rules);
            }
            activeVisit = data.visit || null;
            activePreview = data.preview || null;
            if (activeVisit && window.NewClinicUI) {
                window.NewClinicUI.setDeskActiveVisitId(STORAGE_KEY, activeVisit.id);
            }
            clearDirty();
            renderActivePane(
                root,
                activePreview,
                activeVisit,
                data.form_vitals || {},
                data.vitals_warnings || [],
                (data.vitals || []).length,
                activeVisit && activeVisit.state === 'in_triage' && (data.vitals || []).length > 0
                    ? { mode: 'saved' }
                    : {}
            );
            loadQueue(root);
        }).catch(function () {
            pane.innerHTML = '<div class="alert alert-danger m-0">Failed to load patient. Refresh and try again.</div>';
        });
    }

    function startTriage(root) {
        if (!activeVisit) {
            return;
        }

        var ajaxUrl = root.dataset.ajaxUrl;
        var csrfToken = root.dataset.csrfToken;

        postJson(ajaxUrl + '?action=triage.start', {
            visit_id: activeVisit.id,
            row_version: activeVisit.row_version,
            csrf_token_form: csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                handleApiFailure(root, result, root.querySelector('#nc-triage-active-pane'));
                return;
            }
            hideInterrupt();
            activeVisit = result.payload.data.visit;
            selectVisit(root, activeVisit.id, true);
        });
    }

    function saveVitals(root) {
        if (!activeVisit || vitalsSaving) {
            return;
        }
        if (window.NewClinicUI && window.NewClinicUI.isSharedDeviceBlocked(root)) {
            return;
        }

        var form = root.querySelector('#nc-triage-vitals-form');
        if (!form) {
            return;
        }

        var ajaxUrl = root.dataset.ajaxUrl;
        var csrfToken = root.dataset.csrfToken;
        var saveBtn = root.querySelector('#nc-triage-save-btn');
        var errorEl = root.querySelector('#nc-triage-form-error');
        var successEl = root.querySelector('#nc-triage-form-success');
        if (errorEl) {
            errorEl.classList.add('d-none');
        }
        if (successEl) {
            successEl.classList.add('d-none');
        }

        if (vitalsValidator) {
            var check = vitalsValidator.validateAll(form);
            vitalsValidator.applyAllFeedback(form, check);
            if (!check.valid) {
                showFormError(root, 'Complete the required fields and fix values outside the acceptable range.');
                vitalsValidator.focusFirstInvalid(form);
                return;
            }
        }

        vitalsSaving = true;
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
        }

        var saveSucceeded = false;
        postJson(ajaxUrl + '?action=triage.save_vitals', {
            visit_id: activeVisit.id,
            vitals: collectVitals(form),
            chief_complaint: form.querySelector('[name="chief_complaint"]').value.trim(),
            csrf_token_form: csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                handleApiFailure(root, result, root.querySelector('#nc-triage-active-pane'));
                return;
            }

            saveSucceeded = true;
            hideInterrupt();
            clearDirty();
            var data = result.payload.data || {};
            activeVisit = data.visit || activeVisit;
            if (activeVisit && form.querySelector('[name="chief_complaint"]')) {
                activeVisit.chief_complaint = form.querySelector('[name="chief_complaint"]').value.trim();
            }

            var recordCount = (data.last_vitals_today || []).length;
            var warnings = data.vitals_warnings || [];
            if (activePreview) {
                activePreview.vitals_today = {
                    summary: buildVitalsSummary(data.form_vitals || {}, activePreview),
                    vitals_missing_today: false,
                    vitals_abnormal_today: !!data.vitals_abnormal_today,
                    vitals_breach_list: warnings,
                    record_count: recordCount
                };
            }

            renderActivePane(
                root,
                activePreview,
                activeVisit,
                data.form_vitals || {},
                warnings,
                recordCount,
                { mode: 'saved', savedAt: new Date() }
            );
            loadQueue(root);
        }).finally(function () {
            vitalsSaving = false;
            if (saveSucceeded) {
                return;
            }
            var btn = root.querySelector('#nc-triage-save-btn');
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Save vitals';
            }
        });
    }

    function sendToDoctor(root) {
        if (!activeVisit) {
            return;
        }
        if (window.NewClinicUI && window.NewClinicUI.isSharedDeviceBlocked(root)) {
            return;
        }

        var form = root.querySelector('#nc-triage-vitals-form');
        var ajaxUrl = root.dataset.ajaxUrl;
        var csrfToken = root.dataset.csrfToken;
        var chiefComplaint = form
            ? form.querySelector('[name="chief_complaint"]').value.trim()
            : (activeVisit.chief_complaint || '').trim();

        postJson(ajaxUrl + '?action=triage.send_doctor', {
            visit_id: activeVisit.id,
            row_version: activeVisit.row_version,
            chief_complaint: chiefComplaint,
            csrf_token_form: csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                handleApiFailure(root, result, root.querySelector('#nc-triage-active-pane'));
                return;
            }

            hideInterrupt();
            activeVisit = null;
            activePreview = null;
            clearDirty();
            root.querySelector('#nc-triage-active-pane').innerHTML =
                '<div class="card"><div class="card-body text-muted text-center py-5">' +
                '<em>Patient sent to doctor. Select the next patient from the queue.</em></div></div>';
            loadQueue(root);
        });
    }

    function loadVisitTypes(root) {
        var ajaxUrl = root.dataset.ajaxUrl;
        var typesUrl = ajaxUrl + '?action=visit.types' + facilitySuffix(root);
        return getJson(typesUrl).then(function (result) {
            if (result.payload.success) {
                visitTypes = result.payload.data.visit_types || [];
            }
        });
    }

    function openAutoStartModal(root, pid, preview) {
        autoStartPid = pid;
        var modal = document.getElementById('nc-triage-auto-start-modal');
        var backdrop = document.getElementById('nc-triage-modal-backdrop');
        var patientEl = document.getElementById('nc-auto-start-patient');
        var selectEl = document.getElementById('nc-auto-start-visit-type');
        var errorEl = document.getElementById('nc-auto-start-error');
        var identity = preview.identity || {};

        function show() {
            patientEl.textContent = identity.display_name + ' · MRN ' + (identity.pubpid || '');
            errorEl.style.display = 'none';
            if (!visitTypes.length) {
                errorEl.textContent = 'No visit types configured';
                errorEl.style.display = 'block';
            }
            selectEl.innerHTML = visitTypes.map(function (type) {
                return '<option value="' + escapeHtml(type.id) + '">' + escapeHtml(type.label) + '</option>';
            }).join('');
            showModal(modal, backdrop);
        }

        if (visitTypes.length) {
            show();
            return;
        }

        loadVisitTypes(root).then(show);
    }

    function confirmAutoStart(root) {
        var ajaxUrl = root.dataset.ajaxUrl;
        var csrfToken = root.dataset.csrfToken;
        var modal = document.getElementById('nc-triage-auto-start-modal');
        var backdrop = document.getElementById('nc-triage-modal-backdrop');
        var errorEl = document.getElementById('nc-auto-start-error');
        var visitTypeId = parseInt(document.getElementById('nc-auto-start-visit-type').value, 10);
        var isUrgent = document.getElementById('nc-auto-start-urgent').checked;

        var autoStartBody = {
            pid: autoStartPid,
            visit_type_id: visitTypeId,
            is_urgent: isUrgent,
            csrf_token_form: csrfToken
        };
        if (window.NewClinicUI && window.NewClinicUI.resolveFacilityId) {
            var facilityId = window.NewClinicUI.resolveFacilityId(root);
            if (facilityId > 0) {
                autoStartBody.facility_id = facilityId;
            }
        }
        postJson(ajaxUrl + '?action=triage.auto_start', autoStartBody).then(function (result) {
            if (!result.payload.success) {
                errorEl.textContent = result.payload.message || 'Failed to start visit';
                errorEl.style.display = 'block';
                return;
            }

            hideModal(modal, backdrop);
            closeDrawer();
            var visit = result.payload.data.visit || {};
            loadQueue(root).then(function () {
                selectVisit(root, visit.id, true);
            });
        });
    }

    function openDrawer(root) {
        document.getElementById('nc-triage-find-drawer').style.display = 'block';
    }

    function closeDrawer() {
        document.getElementById('nc-triage-find-drawer').style.display = 'none';
    }

    function handlePatientFind(root, pid) {
        var ajaxUrl = root.dataset.ajaxUrl;
        var csrfToken = root.dataset.csrfToken;

        postJson(ajaxUrl + '?action=patients.preview', {
            pid: pid,
            context: 'triage',
            csrf_token_form: csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                window.alert(result.payload.message || 'Preview failed');
                return;
            }

            var preview = result.payload.data || {};
            var active = preview.active_visit;

            if (active && ['waiting', 'in_triage'].indexOf(active.state) !== -1) {
                closeDrawer();
                selectVisit(root, active.visit_id, true);
                return;
            }

            if (active) {
                window.alert('Patient already has an active visit in state: ' + active.state);
                return;
            }

            openAutoStartModal(root, pid, preview);
        });
    }

    function init(root) {
        if (!root) {
            return;
        }

        ensureActivePane(root);
        bindQueueClicks(root);
        bindQueueHighlight(root);
        loadVitalsRules(root);

        loadVisitTypes(root);
        loadQueue(root);

        window.addEventListener('pageshow', function () {
            loadQueue(root);
        });
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) {
                loadQueue(root);
            }
        });

        pollTimer = window.setInterval(function () {
            if (document.hidden) {
                return;
            }
            loadQueue(root);
        }, window.NewClinicUI ? window.NewClinicUI.resolveQueuePollMs(root) : POLL_MS);

        var refreshBtn = pageEl('nc-triage-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                loadQueue(root);
            });
        }

        var findBtn = pageEl('nc-triage-find-patient');
        if (findBtn) {
            findBtn.addEventListener('click', function () {
                openDrawer(root);
            });
        }

        var drawerClose = document.getElementById('nc-triage-drawer-close');
        if (drawerClose) {
            drawerClose.addEventListener('click', closeDrawer);
        }

        var drawerBackdrop = document.getElementById('nc-triage-drawer-backdrop');
        if (drawerBackdrop) {
            drawerBackdrop.addEventListener('click', closeDrawer);
        }

        var dismissBtn = document.getElementById('nc-triage-interrupt-dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', function () {
                hideInterrupt();
                activeVisit = null;
                if (window.NewClinicUI) {
                    window.NewClinicUI.clearDeskActiveVisitId(STORAGE_KEY);
                }
                clearDirty();
                ensureActivePane(root);
                loadQueue(root);
            });
        }

        var searchRoot = document.getElementById('nc-patient-search');
        if (searchRoot && window.NewClinicPatientSearch) {
            window.NewClinicPatientSearch.init({
                root: searchRoot,
                onPatientSelect: function (pid) {
                    handlePatientFind(root, pid);
                }
            });
        }

        var modal = document.getElementById('nc-triage-auto-start-modal');
        var backdrop = document.getElementById('nc-triage-modal-backdrop');
        var confirmBtn = document.getElementById('nc-auto-start-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function () {
                confirmAutoStart(root);
            });
        }
        if (modal && backdrop) {
            modal.querySelectorAll('.nc-modal-close').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    hideModal(modal, backdrop);
                });
            });
        }

        if (window.NewClinicUI && window.NewClinicUI.wireSharedDeviceSessionWarning) {
            window.NewClinicUI.wireSharedDeviceSessionWarning(root, {
                storageKey: STORAGE_KEY,
                compareMode: 'clinical',
                restoreAction: 'triage.restore_session',
                bannerId: 'nc-triage-session-banner',
                bannerTextId: 'nc-triage-session-banner-text',
                restoreButtonId: 'nc-triage-restore-session',
                returnQueueButtonId: 'nc-triage-return-queue',
                onReturnToQueue: function () {
                    activeVisit = null;
                    activePreview = null;
                    clearDirty();
                    ensureActivePane(root);
                    loadQueue(root);
                }
            });
        }
    }

    window.NewClinicTriage = { init: init };
})(window);

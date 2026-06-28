(function (window) {
    'use strict';

    var debounceMs = 250;
    var dupDebounceMs = 400;
    var selectedPid = null;
    var selectedIndex = -1;
    var latestResults = [];
    var debounceTimer = null;
    var dupTimer = null;
    var quickAddOpen = false;
    var registrationHandle = null;
    var registrationMode = 'desk_full_form';
    var lastDupResult = { level: 'none', max_score: 0, candidates: [] };
    var startVisitDirty = false;

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

    function isMostlyDigits(value) {
        var stripped = String(value || '').replace(/\s+/g, '');
        if (!stripped) {
            return false;
        }
        var digitCount = (stripped.match(/\d/g) || []).length;
        return digitCount / stripped.length >= 0.7;
    }

    function parseSearchQuery(query) {
        var trimmed = String(query || '').trim();
        if (!trimmed) {
            return { fname: '', lname: '', phone: '' };
        }
        if (isMostlyDigits(trimmed)) {
            return { fname: '', lname: '', phone: trimmed };
        }
        var parts = trimmed.split(/\s+/);
        if (parts.length === 1) {
            return { fname: '', lname: parts[0], phone: '' };
        }
        return { fname: parts[0], lname: parts.slice(1).join(' '), phone: '' };
    }

    function ui() {
        return window.NewClinicUI || {
            escapeHtml: escapeHtml,
            initialsFromName: function (name) {
                var parts = String(name || '').trim().split(/\s+/);
                if (!parts[0]) { return '?'; }
                if (parts.length === 1) { return parts[0].substring(0, 2).toUpperCase(); }
                return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
            },
            renderStatusPill: function (label) {
                return '<span class="badge badge-secondary">' + escapeHtml(label) + '</span>';
            },
            renderVisitStatePill: function (state, queue) {
                return '<span class="badge badge-info">#' + escapeHtml(queue) + ' ' + escapeHtml(state) + '</span>';
            },
            renderCellIdentity: function (opts) {
                return '<strong>' + escapeHtml(opts.primary) + '</strong><div class="small text-muted">' +
                    escapeHtml(opts.secondary) + '</div>';
            },
            renderProgressBar: function (score) {
                return '<span class="badge badge-light">' + escapeHtml(score) + '%</span>';
            },
            renderChipCloud: function () { return ''; },
            renderEmptyState: function (title, message) {
                return '<em class="text-muted">' + escapeHtml(message) + '</em>';
            }
        };
    }

    function completionVariant(score, threshold) {
        var value = parseInt(score, 10) || 0;
        var min = threshold || 70;
        if (value >= min) {
            return 'success';
        }
        if (value >= min - 15) {
            return 'warning';
        }
        return 'warning';
    }

    function renderResults(container, patients) {
        var U = ui();
        container.innerHTML = '';
        if (!patients.length) {
            container.innerHTML = '<div class="list-group-item text-muted">' +
                escapeHtml('No match. Try phone or MRN, or register a new patient.') + '</div>';
            return;
        }

        patients.forEach(function (patient, index) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'list-group-item list-group-item-action nc-search-row oe-nc-search-row';
            item.dataset.pid = patient.pid;
            item.dataset.index = String(index);
            item.setAttribute('role', 'option');
            if (index === selectedIndex) {
                item.classList.add('active');
            }

            var secondary = (patient.sex || '—') + ' · ' + (patient.age_years || '—') +
                ' · ' + (patient.phone_masked || '—') + ' · MRN ' + (patient.pubpid || '—');

            var metaHtml = U.renderStatusPill(
                (patient.completion_score || 0) + '%',
                completionVariant(patient.completion_score),
                true
            );
            if (patient.active_visit) {
                metaHtml += U.renderVisitStatePill(
                    patient.active_visit.state,
                    patient.active_visit.queue_number
                );
            }
            if (patient.chips && patient.chips.appointment_today) {
                var appt = patient.chips.appointment_today;
                var apptLabel = 'Appointment today';
                if (appt.start_time_label) {
                    apptLabel += ' · ' + appt.start_time_label;
                }
                metaHtml += U.renderStatusPill(apptLabel, 'info', true);
            }

            item.innerHTML =
                '<div class="d-flex justify-content-between align-items-start gap-2 w-100">' +
                U.renderCellIdentity({
                    primary: patient.display_name,
                    secondary: secondary,
                    initials: U.initialsFromName(patient.display_name),
                    metaHtml: metaHtml
                }) +
                '</div>';

            container.appendChild(item);
        });
    }

    function renderDupPanel(container, dup, onUseExisting) {
        if (!container) {
            return;
        }
        lastDupResult = dup || { level: 'none', candidates: [] };
        if (!dup || dup.level === 'none') {
            container.innerHTML = '';
            container.classList.add('d-none');
            return;
        }

        var candidates = (dup.candidates || []).map(function (c) {
            return '<li class="mb-1">' +
                '<button type="button" class="btn btn-link btn-sm p-0 nc-use-existing-patient" data-pid="' +
                escapeHtml(c.pid) + '">' +
                escapeHtml(c.display_name) + ' · MRN ' + escapeHtml(c.pubpid) +
                ' (score ' + escapeHtml(c.score) + ')</button></li>';
        }).join('');

        var alertClass = dup.level === 'block' ? 'alert-danger' : 'alert-warning';
        var title = dup.level === 'block' ? 'Likely match found' : 'Possible duplicate';

        container.innerHTML =
            '<div class="alert ' + alertClass + ' py-2 mb-2">' +
            '<strong>' + escapeHtml(title) + '</strong>' +
            '<ul class="mb-2 pl-3">' + candidates + '</ul>' +
            (dup.level === 'warn'
                ? '<label class="mb-0"><input type="checkbox" id="nc-dup-confirm"> ' +
                escapeHtml('This is a different patient') + '</label>'
                : '<div class="form-group mb-0">' +
                '<label class="mb-1">' + escapeHtml('Override reason') + '</label>' +
                '<input type="text" class="form-control form-control-sm" id="nc-dup-override-reason" maxlength="255">' +
                '<label class="mt-2 mb-0"><input type="checkbox" id="nc-dup-override"> ' +
                escapeHtml('Create despite duplicate (lead only)') + '</label></div>') +
            '</div>';
        container.classList.remove('d-none');
        if (typeof onUseExisting === 'function') {
            container.querySelectorAll('.nc-use-existing-patient').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    onUseExisting(parseInt(btn.dataset.pid, 10));
                });
            });
        }
    }

    function collectQuickAddValues(formRoot) {
        return {
            fname: formRoot.querySelector('#nc-qa-fname').value.trim(),
            lname: formRoot.querySelector('#nc-qa-lname').value.trim(),
            sex: formRoot.querySelector('#nc-qa-sex').value,
            phone: formRoot.querySelector('#nc-qa-phone').value.trim(),
            DOB: formRoot.querySelector('#nc-qa-dob').value,
            age_years: formRoot.querySelector('#nc-qa-age').value
                ? parseInt(formRoot.querySelector('#nc-qa-age').value, 10) : null,
            no_phone_reason: formRoot.querySelector('#nc-qa-no-phone-reason').value.trim(),
            dup_confirm: !!(formRoot.querySelector('#nc-dup-confirm') && formRoot.querySelector('#nc-dup-confirm').checked),
            dup_override: !!(formRoot.querySelector('#nc-dup-override') && formRoot.querySelector('#nc-dup-override').checked),
            dup_override_reason: formRoot.querySelector('#nc-dup-override-reason')
                ? formRoot.querySelector('#nc-dup-override-reason').value.trim() : ''
        };
    }

    function ensurePreviewWorkArea(previewPane) {
        var work = previewPane.querySelector('#nc-preview-work');
        if (work) {
            work.innerHTML = '';
            return work;
        }

        work = document.createElement('div');
        work.id = 'nc-preview-work';
        work.className = 'nc-preview-work mt-2';
        var banner = previewPane.querySelector('#nc-patient-context-banner');
        if (banner) {
            banner.insertAdjacentElement('afterend', work);
        } else {
            previewPane.appendChild(work);
        }
        return work;
    }

    function registrationTargetPane(previewPane, pinnedPreview) {
        if (!pinnedPreview) {
            return previewPane;
        }
        return ensurePreviewWorkArea(previewPane);
    }

    function openRegistration(previewPane, ajaxUrl, csrfToken, hooks, config) {
        quickAddOpen = true;
        registrationHandle = null;
        var pinnedPreview = !!(hooks.searchOptions && hooks.searchOptions.pinnedPreview);
        var targetPane = registrationTargetPane(previewPane, pinnedPreview);

        if (registrationMode === 'progressive' || !window.NewClinicRegistrationForm) {
            renderQuickAdd(targetPane, config.prefill || '', ajaxUrl, csrfToken, hooks.searchOptions || hooks);
            return;
        }

        registrationHandle = window.NewClinicRegistrationForm.render(targetPane, {
            ajaxUrl: ajaxUrl,
            csrfToken: csrfToken,
            prefill: config.prefill || '',
            pid: config.pid || null,
            onSaved: hooks.onSaved,
            onUseExisting: hooks.onUseExisting,
            onCancel: hooks.onCancel
        });
    }

    function confirmRegistrationSwitch() {
        if (registrationHandle && typeof registrationHandle.confirmDiscard === 'function') {
            return registrationHandle.confirmDiscard();
        }
        if (quickAddOpen) {
            return window.confirm('Discard registration changes and switch patient?');
        }
        return true;
    }

    function findPatientMeta(pid) {
        var i;
        for (i = 0; i < latestResults.length; i += 1) {
            if (parseInt(latestResults[i].pid, 10) === parseInt(pid, 10)) {
                return latestResults[i];
            }
        }
        return null;
    }

    function isStartVisitPanelDirty() {
        if (!startVisitDirty) {
            return false;
        }
        var mount = document.getElementById('nc-start-visit-mount');
        if (!mount) {
            return false;
        }
        var cc = mount.querySelector('#nc-chief-complaint');
        var urgent = mount.querySelector('#nc-is-urgent');
        if (cc && cc.value.trim()) {
            return true;
        }
        if (urgent && urgent.checked) {
            return true;
        }
        return startVisitDirty;
    }

    function resetStartVisitDirty() {
        startVisitDirty = false;
    }

    function wireStartVisitDirtyTracking(mountEl) {
        if (!mountEl) {
            return;
        }
        mountEl.querySelectorAll('#nc-visit-type, #nc-chief-complaint, #nc-is-urgent').forEach(function (el) {
            el.addEventListener('input', function () {
                startVisitDirty = true;
            });
            el.addEventListener('change', function () {
                startVisitDirty = true;
            });
        });
    }

    function confirmStartVisitSwitch(pid) {
        if (parseInt(pid, 10) === parseInt(selectedPid, 10)) {
            return true;
        }
        if (!isStartVisitPanelDirty()) {
            return true;
        }
        var target = findPatientMeta(pid);
        var name = target ? (target.display_name || 'Patient') : 'Patient';
        var mrn = target ? (target.pubpid || '—') : '—';
        return window.confirm('Discard changes and switch to ' + name + ' · MRN ' + mrn + '?');
    }

    function bindCompleteNow(previewPane, pid, ajaxUrl, csrfToken, hooks) {
        var btn = previewPane.querySelector('#nc-complete-now');
        if (!btn) {
            return;
        }
        btn.addEventListener('click', function () {
            openRegistration(previewPane, ajaxUrl, csrfToken, hooks, { pid: pid });
        });
    }

    function bindEditProfile(previewPane, pid, ajaxUrl, csrfToken, hooks) {
        var btn = previewPane.querySelector('#nc-edit-profile');
        if (!btn) {
            return;
        }
        btn.addEventListener('click', function () {
            openRegistration(previewPane, ajaxUrl, csrfToken, hooks, { pid: pid });
        });
    }

    function renderQuickAdd(previewPane, prefill, ajaxUrl, csrfToken, hooks) {
        quickAddOpen = true;
        var parsed = parseSearchQuery(prefill);
        var searchOptions = hooks.searchOptions || hooks;

        previewPane.innerHTML =
            '<div class="nc-quick-add" id="nc-quick-add-form">' +
            '<h4>' + escapeHtml('Quick Add patient') + '</h4>' +
            '<p class="text-muted small">' + escapeHtml('Level 1 identity — save then start visit.') + '</p>' +
            '<div class="form-row">' +
            '<div class="form-group col-md-6"><label>' + escapeHtml('First name') + '</label>' +
            '<input class="form-control" id="nc-qa-fname" value="' + escapeHtml(parsed.fname) + '"></div>' +
            '<div class="form-group col-md-6"><label>' + escapeHtml('Last name') + '</label>' +
            '<input class="form-control" id="nc-qa-lname" value="' + escapeHtml(parsed.lname) + '"></div>' +
            '</div>' +
            '<div class="form-row">' +
            '<div class="form-group col-md-4"><label>' + escapeHtml('Sex') + '</label>' +
            '<select class="form-control" id="nc-qa-sex">' +
            '<option value="">' + escapeHtml('Select') + '</option>' +
            '<option value="Female">' + escapeHtml('Female') + '</option>' +
            '<option value="Male">' + escapeHtml('Male') + '</option>' +
            '<option value="UNK">' + escapeHtml('Other / Unknown') + '</option>' +
            '</select></div>' +
            '<div class="form-group col-md-4"><label>' + escapeHtml('Date of birth') + '</label>' +
            '<input type="date" class="form-control" id="nc-qa-dob"></div>' +
            '<div class="form-group col-md-4"><label>' + escapeHtml('Or age (years)') + '</label>' +
            '<input type="number" min="0" max="130" class="form-control" id="nc-qa-age"></div>' +
            '</div>' +
            '<div class="form-group"><label>' + escapeHtml('Phone') + '</label>' +
            '<input class="form-control" id="nc-qa-phone" value="' + escapeHtml(parsed.phone) + '"></div>' +
            '<div class="form-group"><label>' + escapeHtml('No-phone reason (if blank phone)') + '</label>' +
            '<input class="form-control" id="nc-qa-no-phone-reason" placeholder="' +
            escapeHtml('child, elder, relative-contact') + '"></div>' +
            '<div id="nc-dup-panel" class="d-none"></div>' +
            '<div class="alert alert-danger d-none" id="nc-qa-error"></div>' +
            '<div class="d-flex flex-wrap gap-2">' +
            '<button type="button" class="oe-nc-btn-primary-lg mr-2 mb-2" id="nc-qa-save">' +
            '<i class="fa fa-save" aria-hidden="true"></i><span>' + escapeHtml('Save') + '</span></button>' +
            '<button type="button" class="oe-nc-btn-primary-lg mr-2 mb-2" id="nc-qa-save-start">' +
            '<i class="fa fa-play" aria-hidden="true"></i><span>' + escapeHtml('Save and Start visit') + '</span></button>' +
            '<button type="button" class="btn btn-outline-secondary mb-2" id="nc-qa-cancel">' +
            escapeHtml('Cancel') + '</button></div></div>';

        var formRoot = previewPane.querySelector('#nc-quick-add-form');
        var dupPanel = previewPane.querySelector('#nc-dup-panel');
        var errorEl = previewPane.querySelector('#nc-qa-error');

        function runDupCheck() {
            window.clearTimeout(dupTimer);
            dupTimer = window.setTimeout(function () {
                var values = collectQuickAddValues(formRoot);
                postJson(ajaxUrl + '?action=patients.dup_check', Object.assign({}, values, {
                    csrf_token_form: csrfToken
                })).then(function (result) {
                    if (result.payload.success) {
                        renderDupPanel(dupPanel, result.payload.data, function (pid) {
                            quickAddOpen = false;
                            if (typeof hooks.onUseExisting === 'function') {
                                hooks.onUseExisting(pid);
                            }
                        });
                    }
                });
            }, dupDebounceMs);
        }

        ['#nc-qa-fname', '#nc-qa-lname', '#nc-qa-sex', '#nc-qa-dob', '#nc-qa-age', '#nc-qa-phone'].forEach(function (sel) {
            formRoot.querySelector(sel).addEventListener('input', runDupCheck);
            formRoot.querySelector(sel).addEventListener('change', runDupCheck);
        });
        runDupCheck();

        function savePatient(startAfter) {
            errorEl.classList.add('d-none');
            var values = collectQuickAddValues(formRoot);
            if (lastDupResult.level === 'block' && !values.dup_override) {
                errorEl.textContent = 'Likely duplicate — use existing patient or override with reason';
                errorEl.classList.remove('d-none');
                return;
            }
            postJson(ajaxUrl + '?action=patients.create', Object.assign({}, values, {
                csrf_token_form: csrfToken
            })).then(function (result) {
                if (!result.payload.success) {
                    errorEl.textContent = result.payload.message || 'Save failed';
                    errorEl.classList.remove('d-none');
                    return;
                }
                quickAddOpen = false;
                var pid = result.payload.data.pid;
                if (typeof hooks.onSaved === 'function') {
                    hooks.onSaved(pid, startAfter);
                }
            });
        }

        formRoot.querySelector('#nc-qa-save').addEventListener('click', function () {
            savePatient(false);
        });
        formRoot.querySelector('#nc-qa-save-start').addEventListener('click', function () {
            savePatient(true);
        });
        formRoot.querySelector('#nc-qa-cancel').addEventListener('click', function () {
            if (typeof hooks.onCancel === 'function') {
                hooks.onCancel();
            } else {
                quickAddOpen = false;
                resetPreviewEmpty();
            }
        });
    }

    function renderCompletionSummary(completion, registrationMode) {
        var U = ui();
        if (!completion || completion.score === undefined) {
            return '';
        }

        var threshold = completion.billing_threshold || 70;
        var missing = completion.missing_labels || [];
        var missingHtml = missing.length
            ? '<div class="small text-muted mt-1">Missing: ' +
            escapeHtml(missing.slice(0, 3).join(', ')) +
            (missing.length > 3 ? '…' : '') + '</div>'
            : '';

        var bannerHtml = U.renderCompletionBanner(completion, { registrationMode: registrationMode });

        if ((completion.score || 0) < threshold && bannerHtml === '') {
            bannerHtml =
                '<div class="alert alert-warning py-2 mb-2" id="nc-completion-banner">' +
                '<strong>Profile incomplete for billing</strong> — ' +
                escapeHtml(String(completion.score)) + '% of ' + escapeHtml(String(threshold)) + '% required.' +
                '</div>';
        }

        return bannerHtml +
            (bannerHtml ? '' : '<div class="oe-nc-patient-banner__section">' +
            U.renderProgressBar(completion.score, threshold) + missingHtml + '</div>');
    }

    function renderSafetyStrip(safety) {
        var U = ui();
        var chips = [];
        if (safety.allergies_undocumented) {
            chips.push({ label: 'Allergies undocumented', variant: 'warn' });
        } else if ((safety.allergies_severe || []).length) {
            (safety.allergies_severe || []).slice(0, 3).forEach(function (allergy) {
                chips.push({ label: allergy, variant: 'severe' });
            });
            if ((safety.allergies_severe || []).length > 3) {
                chips.push({
                    label: '+' + ((safety.allergies_severe || []).length - 3) + ' more',
                    variant: 'warn'
                });
            }
        }
        if (!chips.length) {
            return '';
        }
        return '<div class="oe-nc-patient-banner__section">' + U.renderChipCloud(chips) + '</div>';
    }

    function renderPreview(previewPane, data, registrationMode) {
        var U = ui();
        var identity = data.identity || {};
        var safety = data.safety || {};
        var completion = data.completion || {};
        var activeVisit = data.active_visit;
        var appointment = data.appointment_today || (data.chips && data.chips.appointment_today) || null;
        var initials = U.initialsFromName(identity.display_name);
        var metaLine = (identity.sex || '—') + ' · ' + (identity.age_years || '—') +
            ' · MRN ' + (identity.pubpid || '—') +
            (identity.phone_masked ? ' · ' + identity.phone_masked : '');

        var visitHtml = '';
        if (activeVisit) {
            visitHtml = '<div class="oe-nc-patient-banner__section">' +
                U.renderVisitStatePill(activeVisit.state, activeVisit.queue_number) + '</div>';
        } else if (appointment) {
            var apptTitle = appointment.tooltip ? ' title="' + escapeHtml(appointment.tooltip) + '"' : '';
            var apptLabel = 'Appointment today';
            if (appointment.start_time_label) {
                apptLabel += ' · ' + appointment.start_time_label;
            }
            if (appointment.provider_name) {
                apptLabel += ' · ' + appointment.provider_name;
            }
            visitHtml = '<div class="oe-nc-patient-banner__section">' +
                '<span class="oe-nc-status-pill oe-nc-status-pill--info"' + apptTitle + '>' +
                '<span class="oe-nc-status-pill__dot" aria-hidden="true"></span>' +
                '<span>' + escapeHtml(apptLabel) + '</span></span></div>';
        }

        var completionPill = U.renderStatusPill(
            (completion.score || 0) + '% complete',
            completionVariant(completion.score, completion.billing_threshold),
            true
        );

        var chartBtn = (completion.chart_open_url || completion.chart_url)
            ? '<a class="btn btn-sm btn-outline-secondary" target="_top" href="' +
            escapeHtml(completion.chart_open_url || completion.chart_url) +
            '"><i class="fa fa-folder-open mr-1" aria-hidden="true"></i>Open chart</a>'
            : '';

        previewPane.innerHTML =
            '<div class="oe-nc-patient-banner nc-patient-context-banner" id="nc-patient-context-banner">' +
            '<div class="oe-nc-patient-banner__header">' +
            '<div class="oe-nc-patient-banner__avatar" aria-hidden="true">' + escapeHtml(initials) + '</div>' +
            '<div class="oe-nc-patient-banner__identity">' +
            '<h3 class="oe-nc-patient-banner__name">' + escapeHtml(identity.display_name) + '</h3>' +
            '<div class="oe-nc-patient-banner__meta">' + escapeHtml(metaLine) + '</div>' +
            '</div>' +
            '<div class="oe-nc-patient-banner__aside text-right">' + completionPill + '</div>' +
            '</div>' +
            renderSafetyStrip(safety) +
            renderCompletionSummary(completion, registrationMode) +
            visitHtml +
            '<div class="d-flex flex-wrap mb-2">' +
            '<button type="button" class="btn btn-sm btn-outline-primary mr-2" id="nc-edit-profile">' +
            '<i class="fa fa-pen mr-1" aria-hidden="true"></i>Edit profile</button>' +
            chartBtn +
            '</div>' +
            '<div id="nc-start-visit-mount"></div>' +
            '</div>';

        return previewPane.querySelector('#nc-start-visit-mount');
    }

    function loadVisitTypes(ajaxUrl, csrfToken, mountEl, pid, activeVisit, autoStart, appointment, options) {
        if (!mountEl) {
            return;
        }

        if (activeVisit) {
            mountEl.innerHTML = '<div class="alert alert-warning mt-2">Patient already has an open visit today.</div>';
            return;
        }

        var fromAppointment = !!(appointment && appointment.pc_eid);
        var startAction = fromAppointment ? 'visit.start_from_appointment' : 'visit.start';
        var startLabel = fromAppointment ? 'Start visit & check in' : 'Start visit';
        var startIcon = fromAppointment ? 'fa-calendar-check' : 'fa-play';

        var typesUrl = ajaxUrl + '?action=visit.types';
        if (window.NewClinicUI && window.NewClinicUI.facilityQuerySuffix) {
            typesUrl += window.NewClinicUI.facilityQuerySuffix(document.getElementById('oe-nc-t1'));
        }
        getJson(typesUrl)
            .then(function (result) {
                var payload = result.payload;
                if (!payload.success) {
                    return;
                }
                var types = payload.data.visit_types || [];
                if (fromAppointment) {
                    types = types.filter(function (type) {
                        return type.service_profile === 'full_opd';
                    });
                }
                if (!types.length) {
                    mountEl.innerHTML = '<div class="alert alert-danger mt-2">' +
                        escapeHtml(fromAppointment
                            ? 'No OPD visit type available for appointment check-in.'
                            : 'No visit types configured.') + '</div>';
                    return;
                }
                var defaultTypeId = fromAppointment && appointment.default_visit_type_id
                    ? String(appointment.default_visit_type_id)
                    : null;
                var options = types.map(function (type) {
                    var selected = defaultTypeId && String(type.id) === defaultTypeId ? ' selected' : '';
                    if (!defaultTypeId && type.is_default) {
                        selected = ' selected';
                    }
                    return '<option value="' + escapeHtml(type.id) + '"' + selected + '>' +
                        escapeHtml(type.label) + '</option>';
                }).join('');

                mountEl.innerHTML =
                    '<div class="border-top pt-3 mt-2">' +
                    '<h6>' + escapeHtml(fromAppointment ? 'Start visit & check in' : 'Start visit') + '</h6>' +
                    '<div class="form-group"><label>Visit type</label>' +
                    '<select class="form-control" id="nc-visit-type">' + options + '</select></div>' +
                    '<div class="form-group"><label>Reason for visit</label>' +
                    '<textarea class="form-control" id="nc-chief-complaint" rows="2" maxlength="500"></textarea></div>' +
                    '<div class="form-group form-check">' +
                    '<input type="checkbox" class="form-check-input" id="nc-is-urgent">' +
                    '<label class="form-check-label" for="nc-is-urgent">Urgent</label></div>' +
                    '<button type="button" class="oe-nc-btn-primary-lg" id="nc-start-visit-btn">' +
                    '<i class="fa ' + startIcon + '" aria-hidden="true"></i><span>' +
                    escapeHtml(startLabel) + '</span></button>' +
                    '<div class="alert alert-success mt-2 d-none" id="nc-start-visit-success"></div>' +
                    '<div class="alert alert-danger mt-2 d-none" id="nc-start-visit-error"></div>' +
                    '</div>';

                resetStartVisitDirty();
                wireStartVisitDirtyTracking(mountEl);

                function startVisit() {
                    var visitTypeId = mountEl.querySelector('#nc-visit-type').value;
                    var successEl = mountEl.querySelector('#nc-start-visit-success');
                    var errorEl = mountEl.querySelector('#nc-start-visit-error');
                    successEl.classList.add('d-none');
                    errorEl.classList.add('d-none');

                    var body = {
                        pid: pid,
                        visit_type_id: parseInt(visitTypeId, 10),
                        chief_complaint: mountEl.querySelector('#nc-chief-complaint').value.trim(),
                        is_urgent: mountEl.querySelector('#nc-is-urgent').checked,
                        csrf_token_form: csrfToken
                    };
                    if (window.NewClinicUI && window.NewClinicUI.resolveFacilityId) {
                        var facilityId = window.NewClinicUI.resolveFacilityId(
                            document.getElementById('oe-nc-t1')
                        );
                        if (facilityId > 0) {
                            body.facility_id = facilityId;
                        }
                    }
                    if (fromAppointment) {
                        body.pc_eid = parseInt(appointment.pc_eid, 10);
                        body.appt_date = appointment.appt_date;
                    }

                    postJson(ajaxUrl + '?action=' + startAction, body).then(function (result) {
                        if (!result.payload.success) {
                            errorEl.textContent = result.payload.message || 'Failed to start visit';
                            errorEl.classList.remove('d-none');
                            return;
                        }
                        var data = result.payload.data || {};
                        var visit = data.visit || data || {};
                        var queueNumber = visit.queue_number || '?';
                        var successMsg = 'Visit #' + queueNumber + ' started — patient is on the Triage queue (refresh Triage desk if open).';
                        if (fromAppointment && data.recurring_guard_fired) {
                            successMsg = 'Visit #' + queueNumber + ' started. This recurring appointment was not marked ‘Arrived’ in scheduling — update on Flow Board if needed for records.';
                        } else if (fromAppointment && data.appointment_status_updated) {
                            successMsg = 'Visit #' + queueNumber + ' started and appointment marked arrived.';
                        }
                        renderStartVisitSuccess(mountEl, data, successMsg, options || {});
                    });
                }

                function renderStartVisitSuccess(mountEl, data, successMsg, options) {
                    var visit = data.visit || {};
                    var visitId = parseInt(visit.id, 10) || 0;
                    var printEnabled = !!(options && options.printQueueSlip !== false && data.queue_slip_enabled);
                    var slipUrl = data.queue_slip_url || (
                        options && options.moduleUrl && visitId
                            ? options.moduleUrl + '/queue-slip.php?visit_id=' + encodeURIComponent(String(visitId)) + '&print=1'
                            : ''
                    );

                    var html =
                        '<div class="border-top pt-3 mt-2">' +
                        '<div class="alert alert-success mb-3" id="nc-start-visit-success">' +
                        escapeHtml(successMsg) + '</div>';

                    if (printEnabled && slipUrl) {
                        html += '<div class="d-flex flex-wrap align-items-center">' +
                            '<a class="btn btn-primary mr-2 mb-2" href="' + escapeHtml(slipUrl) + '" target="_blank" rel="noopener">' +
                            'Print queue slip</a>' +
                            '<button type="button" class="btn btn-outline-secondary mb-2" id="nc-start-visit-done">' +
                            'Done</button></div>';
                    }

                    html += '</div>';
                    mountEl.innerHTML = html;
                    resetStartVisitDirty();

                    var doneBtn = mountEl.querySelector('#nc-start-visit-done');
                    if (doneBtn) {
                        doneBtn.addEventListener('click', function () {
                            mountEl.innerHTML = '<div class="text-muted small py-2"><em>Visit started. Search another patient or refresh preview.</em></div>';
                        });
                    }
                }

                mountEl.querySelector('#nc-start-visit-btn').addEventListener('click', startVisit);
                if (autoStart) {
                    startVisit();
                }
            });
    }

    function init(options) {
        var root = options.root;
        if (!root) {
            return;
        }

        var ajaxUrl = root.dataset.ajaxUrl;
        var csrfToken = root.dataset.csrfToken;
        var input = root.querySelector('#nc-search-input');
        var results = root.querySelector('#nc-search-results');
        var errorEl = root.querySelector('#nc-search-error');
        var previewPane = options.previewPane;
        var addBtn = root.querySelector('#nc-add-patient');
        registrationMode = options.registrationMode || 'desk_full_form';

        var registrationHooks = {
            searchOptions: options,
            onSaved: function () {},
            onUseExisting: function () {},
            onCancel: function () {}
        };

        function clearRegistrationState() {
            quickAddOpen = false;
            registrationHandle = null;
        }

        function selectPatient(pid, opts, autoStartVisit) {
            if (!confirmStartVisitSwitch(pid)) {
                return;
            }
            if (!confirmRegistrationSwitch()) {
                return;
            }
            selectedPid = pid;
            clearRegistrationState();
            resetStartVisitDirty();
            var work = previewPane ? previewPane.querySelector('#nc-preview-work') : null;
            if (work) {
                work.remove();
            }
            var mergedOpts = opts || options;
            if (!previewPane) {
                if (typeof mergedOpts.onPatientSelect === 'function') {
                    mergedOpts.onPatientSelect(pid);
                }
                return;
            }
            previewPane.innerHTML = '<em>Loading preview…</em>';
            postJson(ajaxUrl + '?action=patients.preview', {
                pid: pid,
                context: root.dataset.host || 'front-desk',
                csrf_token_form: csrfToken
            }).then(function (result) {
                if (!result.payload.success) {
                    previewPane.innerHTML = '<div class="alert alert-danger">' +
                        escapeHtml(result.payload.message || 'Preview failed') + '</div>';
                    return;
                }
                var mountEl = renderPreview(previewPane, result.payload.data, registrationMode);
                if ((opts || options).showStartVisit) {
                    loadVisitTypes(
                        ajaxUrl,
                        csrfToken,
                        mountEl,
                        pid,
                        result.payload.data.active_visit,
                        !!autoStartVisit,
                        result.payload.data.appointment_today
                            || (result.payload.data.chips && result.payload.data.chips.appointment_today),
                        (opts || options)
                    );
                }
                bindEditProfile(previewPane, pid, ajaxUrl, csrfToken, registrationHooks);
                bindCompleteNow(previewPane, pid, ajaxUrl, csrfToken, registrationHooks);
            });
        }

        registrationHooks.onSaved = function (pid, startAfter) {
            clearRegistrationState();
            selectPatient(pid, options, startAfter);
        };
        registrationHooks.onUseExisting = function (pid) {
            clearRegistrationState();
            selectPatient(pid, options);
        };
        registrationHooks.onCancel = function () {
            clearRegistrationState();
            if (!previewPane) {
                return;
            }
            if (options.pinnedPreview && selectedPid) {
                selectPatient(selectedPid, options);
                return;
            }
            previewPane.innerHTML = ui().renderEmptyState(
                'No patient selected',
                'Search by name, phone, NHIS, National ID, or MRN — then pick a row to preview.',
                'fa-search'
            );
        };

        function updateClearButton() {
            var clearBtn = root.querySelector('#nc-search-input-clear');
            if (!clearBtn) {
                return;
            }
            var hasValue = (input.value || '').trim().length > 0;
            clearBtn.classList.toggle('d-none', !hasValue);
        }

        function setSearching(isSearching) {
            var hint = root.querySelector('#nc-search-hint');
            if (!hint) {
                return;
            }
            hint.classList.toggle('is-searching', !!isSearching);
            if (isSearching) {
                hint.textContent = 'Searching…';
            } else if ((input.value || '').trim().length < 2) {
                hint.textContent = 'Type at least 2 characters · press / to focus';
            } else {
                hint.textContent = latestResults.length + ' result(s)';
            }
        }

        function resetPreviewEmpty() {
            if (previewPane) {
                previewPane.innerHTML = ui().renderEmptyState(
                    'No patient selected',
                    'Search by name, phone, NHIS, National ID, or MRN — then pick a row to preview.',
                    'fa-search'
                );
            }
        }

        function clearError() {
            errorEl.classList.add('d-none');
            errorEl.textContent = '';
        }

        function showError(message) {
            errorEl.textContent = message;
            errorEl.classList.remove('d-none');
        }

        function runSearch() {
            clearError();
            updateClearButton();
            var q = (input.value || '').trim();
            if (q.length < 2) {
                setSearching(false);
                results.innerHTML = '<div class="list-group-item text-muted">Type at least 2 characters</div>';
                latestResults = [];
                selectedIndex = -1;
                return;
            }

            setSearching(true);
            results.innerHTML = '<div class="list-group-item text-muted">Searching…</div>';

            postJson(ajaxUrl + '?action=patients.search', {
                q: q,
                limit: 8,
                csrf_token_form: csrfToken
            }).then(function (result) {
                setSearching(false);
                if (!result.payload.success) {
                    showError(result.payload.message || 'Search failed');
                    results.innerHTML = '';
                    return;
                }
                latestResults = result.payload.data.patients || [];
                selectedIndex = latestResults.length ? 0 : -1;
                renderResults(results, latestResults);
                setSearching(false);
                if (latestResults.length && previewPane && !quickAddOpen) {
                    selectPatient(latestResults[0].pid, options);
                }
            }).catch(function () {
                setSearching(false);
                showError('Search request failed');
            });
        }

        input.addEventListener('input', function () {
            updateClearButton();
            window.clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(runSearch, debounceMs);
        });

        var clearBtn = root.querySelector('#nc-search-input-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                input.value = '';
                updateClearButton();
                setSearching(false);
                results.innerHTML = '<div class="list-group-item text-muted" id="nc-search-empty">Results appear here</div>';
                latestResults = [];
                selectedIndex = -1;
                quickAddOpen = false;
                resetPreviewEmpty();
                input.focus();
            });
        }

        input.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                input.value = '';
                updateClearButton();
                setSearching(false);
                results.innerHTML = '<div class="list-group-item text-muted">Results appear here</div>';
                latestResults = [];
                selectedIndex = -1;
                quickAddOpen = false;
                resetPreviewEmpty();
                return;
            }
            if (event.key === 'ArrowDown' && latestResults.length) {
                event.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, latestResults.length - 1);
                renderResults(results, latestResults);
            }
            if (event.key === 'ArrowUp' && latestResults.length) {
                event.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                renderResults(results, latestResults);
            }
            if (event.key === 'Enter' && selectedIndex >= 0 && latestResults[selectedIndex]) {
                event.preventDefault();
                selectPatient(latestResults[selectedIndex].pid, options);
            }
        });

        results.addEventListener('click', function (event) {
            var row = event.target.closest('.nc-search-row');
            if (!row) {
                return;
            }
            selectedIndex = parseInt(row.dataset.index || '0', 10);
            selectPatient(parseInt(row.dataset.pid, 10), options);
        });

        if (addBtn && previewPane) {
            addBtn.addEventListener('click', function () {
                if (!confirmRegistrationSwitch()) {
                    return;
                }
                openRegistration(previewPane, ajaxUrl, csrfToken, registrationHooks, {
                    prefill: input.value
                });
            });
        }

        document.addEventListener('keydown', function (event) {
            if (event.key === '/' && root.dataset.host === 'front-desk' && document.activeElement !== input) {
                event.preventDefault();
                input.focus();
            }
        });

        var initialQuery = new URL(window.location.href).searchParams.get('q');
        if (initialQuery) {
            input.value = initialQuery;
            updateClearButton();
            runSearch();
        }
    }

    window.NewClinicPatientSearch = { init: init };
})(window);

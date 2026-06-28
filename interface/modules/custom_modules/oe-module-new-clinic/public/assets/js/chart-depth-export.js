(function (window) {
    'use strict';

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getJson(url) {
        return window.NewClinicUI.getJson(url);
    }

    function postJson(url, body) {
        return window.NewClinicUI.postJson(url, body);
    }

    function postForm(url, fields) {
        var form = document.createElement('form');
        form.method = 'POST';
        form.action = url;
        form.target = '_blank';
        form.style.display = 'none';

        Object.keys(fields).forEach(function (key) {
            var input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = fields[key];
            form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    }

    function renderIncludeOptions(options) {
        if (!options || !options.length) {
            return '';
        }

        return '<div class="mb-3"><div class="font-weight-bold mb-2">' +
            escapeHtml('Include') + '</div>' +
            options.filter(function (opt) { return !opt.hidden; }).map(function (opt) {
                return '<div class="form-check">' +
                    '<input class="form-check-input" type="checkbox" id="nc-export-inc-' +
                    escapeHtml(opt.key) + '" data-include-key="' + escapeHtml(opt.key) + '"' +
                    (opt.checked ? ' checked' : '') + '>' +
                    '<label class="form-check-label" for="nc-export-inc-' + escapeHtml(opt.key) + '">' +
                    escapeHtml(opt.label) + '</label></div>';
            }).join('') + '</div>';
    }

    function renderBuilder(container, payload) {
        var presets = payload.presets || [];
        var encounters = payload.encounters || [];
        var patient = payload.patient || {};
        var selectedPreset = payload.selected_preset || 'visit_summary';
        var selectedEncounter = payload.selected_encounter_id || '';

        var presetOptions = presets.map(function (preset) {
            return '<option value="' + escapeHtml(preset.key) + '"' +
                (preset.key === selectedPreset ? ' selected' : '') + '>' +
                escapeHtml(preset.label) + '</option>';
        }).join('');

        var encounterOptions = encounters.map(function (enc) {
            return '<option value="' + escapeHtml(String(enc.encounter_id)) + '"' +
                (String(enc.encounter_id) === String(selectedEncounter) ? ' selected' : '') + '>' +
                escapeHtml(enc.label) + '</option>';
        }).join('');

        var encounterBlock = payload.requires_encounter
            ? '<div class="form-group"><label for="nc-export-encounter">' +
            escapeHtml('Encounter') + '</label>' +
            '<select class="form-control" id="nc-export-encounter">' +
            (encounterOptions || '<option value="">' + escapeHtml('No encounters on file') + '</option>') +
            '</select></div>'
            : '';

        var patRepWarning = payload.has_pat_rep_acl
            ? ''
            : '<div class="alert alert-warning py-2 small">' +
            escapeHtml('Your account also needs core Patient Report permission to generate PDFs.') +
            '</div>';

        var customNote = selectedPreset === 'custom'
            ? '<div class="alert alert-info py-2 small">' +
            escapeHtml('Custom export opens the stock patient report page.') +
            ' <a href="' + escapeHtml(payload.stock_report_url || '#') + '" target="_top">' +
            escapeHtml('Open stock report') + '</a></div>'
            : '';

        container.innerHTML =
            '<div class="mb-2"><strong>' + escapeHtml(patient.name || 'Patient') + '</strong>' +
            (patient.pubpid ? ' · MRN ' + escapeHtml(patient.pubpid) : '') +
            '</div>' +
            patRepWarning +
            '<div class="form-group"><label for="nc-export-preset">' + escapeHtml('Preset') + '</label>' +
            '<select class="form-control" id="nc-export-preset">' + presetOptions + '</select></div>' +
            encounterBlock +
            '<div id="nc-export-include-options">' + renderIncludeOptions(payload.include_options) + '</div>' +
            customNote +
            '<div class="border rounded p-3 bg-light mb-3 small" id="nc-export-confirm">' +
            escapeHtml(payload.confirm_label || '') + '</div>' +
            '<div class="d-flex flex-wrap">' +
            '<button type="button" class="btn btn-primary mr-2 mb-2" id="nc-export-generate"' +
            (payload.can_generate && payload.has_pat_rep_acl ? '' : ' disabled') + '>' +
            escapeHtml('Generate PDF') + '</button>' +
            (payload.employer_letter_url
                ? '<a class="btn btn-outline-secondary mb-2" href="' +
                escapeHtml(payload.employer_letter_url) + '" target="_top">' +
                escapeHtml('Employer / school letter') + '</a>'
                : '') +
            '</div>';
    }

    function collectIncludeOptions(root) {
        var includes = {};
        root.querySelectorAll('[data-include-key]').forEach(function (input) {
            includes[input.getAttribute('data-include-key')] = input.checked;
        });
        return includes;
    }

    function loadBuilder(options) {
        var root = options.root;
        var pid = parseInt(root.dataset.pid, 10);
        var preset = root.dataset.preset || '';
        var encounterId = parseInt(root.dataset.encounterId, 10) || 0;
        var builderEl = root.querySelector('#nc-export-builder');
        var url = options.ajaxUrl + '?action=chart_depth.export_builder&pid=' + encodeURIComponent(pid);
        if (preset) {
            url += '&preset=' + encodeURIComponent(preset);
        }
        if (encounterId > 0) {
            url += '&encounter_id=' + encodeURIComponent(String(encounterId));
        }

        return getJson(url)
            .then(function (result) {
                var payload = result.payload;
                if (!payload.success) {
                    throw new Error(payload.message || 'Failed');
                }
                renderBuilder(builderEl, payload.data || {});
                bindBuilderEvents(root, options, payload.data || {});
            });
    }

    function bindBuilderEvents(root, options, currentPayload) {
        var builderEl = root.querySelector('#nc-export-builder');
        var pid = parseInt(root.dataset.pid, 10);
        var presetSelect = builderEl.querySelector('#nc-export-preset');
        var encounterSelect = builderEl.querySelector('#nc-export-encounter');
        var generateBtn = builderEl.querySelector('#nc-export-generate');

        function reload() {
            var preset = presetSelect ? presetSelect.value : '';
            var encounterId = encounterSelect ? encounterSelect.value : '';
            var url = options.ajaxUrl + '?action=chart_depth.export_builder&pid=' + encodeURIComponent(pid);
            if (preset) {
                url += '&preset=' + encodeURIComponent(preset);
            }
            if (encounterId) {
                url += '&encounter_id=' + encodeURIComponent(encounterId);
            }
            return getJson(url)
                .then(function (result) {
                    var payload = result.payload;
                    if (!payload.success) {
                        throw new Error(payload.message || 'Failed');
                    }
                    renderBuilder(builderEl, payload.data || {});
                    bindBuilderEvents(root, options, payload.data || {});
                });
        }

        if (presetSelect) {
            presetSelect.addEventListener('change', function () {
                reload().catch(function () {
                    builderEl.innerHTML = '<div class="alert alert-danger">' +
                        escapeHtml('Could not reload export options.') + '</div>';
                });
            });
        }

        if (encounterSelect) {
            encounterSelect.addEventListener('change', function () {
                reload().catch(function () {
                    builderEl.innerHTML = '<div class="alert alert-danger">' +
                        escapeHtml('Could not reload export options.') + '</div>';
                });
            });
        }

        if (generateBtn) {
            generateBtn.addEventListener('click', function () {
                var preset = presetSelect ? presetSelect.value : currentPayload.selected_preset;
                if (preset === 'custom') {
                    window.open(currentPayload.stock_report_url, '_top');
                    return;
                }

                var encounterId = encounterSelect ? parseInt(encounterSelect.value, 10) || 0 : 0;
                generateBtn.disabled = true;
                postJson(options.ajaxUrl + '?action=chart_depth.export_generate', {
                    csrf_token_form: options.csrfToken,
                    pid: pid,
                    preset: preset,
                    encounter_id: encounterId,
                    include: collectIncludeOptions(builderEl)
                }).then(function (result) {
                    var payload = result.payload;
                    if (!payload.success) {
                        throw new Error(payload.message || 'Export failed');
                    }
                    var data = payload.data || {};
                    postForm(data.post_url, data.fields || {});
                })
                    .catch(function (error) {
                        window.alert(error.message || 'Export failed');
                    })
                    .finally(function () {
                        generateBtn.disabled = false;
                    });
            });
        }
    }

    function init(options) {
        var root = options.root;
        if (!root) {
            return;
        }

        var pid = parseInt(root.dataset.pid, 10);
        if (window.NewClinicUI && window.NewClinicUI.mountCompletionBanner) {
            window.NewClinicUI.mountCompletionBanner({
                pid: pid,
                ajaxUrl: options.ajaxUrl,
                csrfToken: options.csrfToken || document.body.getAttribute('data-csrf-token') || '',
                slot: root.querySelector('#nc-chart-depth-banner')
            });
        }

        loadBuilder(options).catch(function () {
            var builderEl = root.querySelector('#nc-export-builder');
            if (builderEl) {
                builderEl.innerHTML = '<div class="alert alert-danger">' +
                    escapeHtml('Could not load export builder.') + '</div>';
            }
        });
    }

    window.NewClinicChartDepthExport = {
        init: init
    };
}(window));

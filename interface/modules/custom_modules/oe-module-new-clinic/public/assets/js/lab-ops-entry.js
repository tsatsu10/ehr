(function (window) {
    'use strict';

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function postJson(url, body) {
        return window.NewClinicUI.postJson(url, body);
    }

    function apiPayload(res) {
        return (window.NewClinicUI && window.NewClinicUI.apiPayload)
            ? window.NewClinicUI.apiPayload(res)
            : ((res && res.payload) ? res.payload : (res || {}));
    }

    function optionHtml(value, selected) {
        var sel = String(selected || '') === value ? ' selected' : '';
        var label = value === '' ? '—' : value;
        return '<option value="' + escapeHtml(value) + '"' + sel + '>' + escapeHtml(label) + '</option>';
    }

    /**
     * @param {object} options
     * @returns {{open: function(number, function=): void, close: function(): void}}
     */
    function bind(options) {
        var ajaxUrl = options.ajaxUrl || '';
        var csrfToken = options.csrfToken || '';
        var canEnter = !!options.canEnter;
        var canRelease = !!options.canRelease;
        var onSaved = typeof options.onSaved === 'function' ? options.onSaved : null;

        var drawer = document.getElementById(options.drawerId || 'nc-labops-drawer');
        var backdrop = document.getElementById(options.backdropId || 'nc-labops-drawer-backdrop');
        var drawerBody = document.getElementById(options.drawerBodyId || 'nc-labops-drawer-body');
        var drawerFooter = document.getElementById(options.drawerFooterId || 'nc-labops-drawer-footer');
        var drawerTitle = document.getElementById(options.drawerTitleId || 'nc-labops-drawer-title');
        var drawerClose = document.getElementById(options.drawerCloseId || 'nc-labops-drawer-close');

        var state = {
            activeOrderId: null,
            entryForm: null,
            viewMode: 'form',
            savedDraft: false,
            orderReleased: false,
            savedAt: null,
            savedSummary: [],
            savedWarnings: [],
            qcValidator: null,
            saving: false
        };

        if (drawerClose) {
            drawerClose.addEventListener('click', close);
        }
        if (backdrop) {
            backdrop.addEventListener('click', close);
        }
        if (drawerFooter) {
            drawerFooter.addEventListener('click', onFooterClick);
        }

        function refreshEntryForm() {
            if (!state.activeOrderId) {
                return Promise.resolve();
            }
            return postJson(ajaxUrl + '?action=lab_ops.result_get', {
                procedure_order_id: state.activeOrderId
            }).then(function (res) {
                var payload = apiPayload(res);
                if (payload.success) {
                    state.entryForm = payload.data || {};
                    if (window.NewClinicLabResultForm && state.entryForm.validation) {
                        state.qcValidator = window.NewClinicLabResultForm.createValidator(state.entryForm.validation);
                    }
                }
            });
        }

        function open(orderId) {
            state.activeOrderId = orderId;
            state.viewMode = 'form';
            state.savedDraft = false;
            state.orderReleased = false;
            state.savedAt = null;
            state.savedSummary = [];
            postJson(ajaxUrl + '?action=lab_ops.result_get', {
                procedure_order_id: orderId
            }).then(function (res) {
                var payload = apiPayload(res);
                if (!payload.success) {
                    window.alert(payload.message || 'Could not load result form');
                    return;
                }
                var data = payload.data || {};
                state.entryForm = data;
                if (window.NewClinicLabResultForm && data.validation) {
                    state.qcValidator = window.NewClinicLabResultForm.createValidator(data.validation);
                } else {
                    state.qcValidator = null;
                }
                if ((data.lines || []).length > 0 && data.has_saved_results) {
                    state.viewMode = 'saved';
                    state.savedAt = new Date();
                    state.savedSummary = summarizeLines(data.lines);
                }
                renderDrawer();
                show();
            });
        }

        function close() {
            state.activeOrderId = null;
            state.entryForm = null;
            state.viewMode = 'form';
            state.savedDraft = false;
            state.orderReleased = false;
            state.savedAt = null;
            state.savedSummary = [];
            state.savedWarnings = [];
            state.qcValidator = null;
            state.saving = false;
            if (drawer) {
                drawer.classList.add('d-none');
            }
            if (backdrop) {
                backdrop.classList.add('d-none');
            }
        }

        function show() {
            if (drawer) {
                drawer.classList.remove('d-none');
            }
            if (backdrop) {
                backdrop.classList.remove('d-none');
            }
        }

        function summarizeLines(lines) {
            return (lines || []).map(function (line) {
                var result = (line.results && line.results[0]) || {};
                var label = line.procedure_name || line.procedure_code || 'Test';
                var value = result.result ? String(result.result) : '—';
                var abnormal = result.abnormal ? (' (' + result.abnormal + ')') : '';
                var flagClass = result.abnormal ? ' class="text-danger font-weight-bold"' : '';
                return '<span' + flagClass + '>' + escapeHtml(label + ': ' + value + abnormal) + '</span>';
            });
        }

        function renderQcWarnings(warnings) {
            if (!warnings || !warnings.length) {
                return '';
            }
            return '<div class="alert alert-warning py-2 px-3 mt-3 mb-0 border border-warning">' +
                '<strong class="d-block mb-1">Review before release</strong>' +
                warnings.map(escapeHtml).join('<br>') +
                '</div>';
        }

        function renderSavedPanel(order, draft, released) {
            var patientLine = (order.patient_name || '') +
                (order.pubpid ? (' · MRN ' + order.pubpid) : '') +
                (order.queue_number ? (' · Q#' + order.queue_number) : '');
            var timeLabel = state.savedAt ? state.savedAt.toLocaleTimeString() : new Date().toLocaleTimeString();
            var title = released
                ? 'Released to doctor'
                : (state.orderReleased
                    ? 'Order released'
                    : (draft ? 'Draft saved' : 'Results saved'));
            var hint = released
                ? 'The doctor can see these results on the consult card.'
                : (state.orderReleased
                    ? 'This panel is released. Other lab orders for the visit may still be pending.'
                    : (draft
                        ? 'Draft is saved. Release to doctor when results are final.'
                        : 'Results are saved. A lab lead can release them to the doctor.'));
            var summaryHtml = state.savedSummary.length
                ? '<ul class="mb-0 pl-3">' + state.savedSummary.map(function (row) {
                    return '<li>' + row + '</li>';
                }).join('') + '</ul>'
                : '<p class="mb-0 text-muted">Result values recorded for this order.</p>';
            var warningHtml = renderQcWarnings(state.savedWarnings);

            if (drawerTitle) {
                drawerTitle.textContent = released ? 'Results released' : 'Lab results saved';
            }

            if (drawerBody) {
                drawerBody.innerHTML =
                    '<p class="small text-muted mb-3">' + escapeHtml(patientLine) + '</p>' +
                    '<div class="oe-nc-labops-saved" role="status" aria-live="polite">' +
                    '<div class="d-flex align-items-start">' +
                    '<span class="badge badge-success mr-2 mt-1">' +
                    escapeHtml(released || state.orderReleased ? 'Released' : 'Saved') + '</span>' +
                    '<div class="flex-grow-1">' +
                    '<strong>' + escapeHtml(title) + ' at ' + escapeHtml(timeLabel) + '</strong>' +
                    '<div class="oe-nc-labops-saved__summary mt-2">' + summaryHtml + '</div>' +
                    warningHtml +
                    '<p class="text-muted small mb-0 mt-2">' + escapeHtml(hint) + '</p>' +
                    '</div></div></div>';
            }

            var footer = '<button type="button" class="btn btn-primary btn-sm" data-drawer-action="done">' +
                escapeHtml('Done') + '</button>';
            if (!released) {
                footer += '<button type="button" class="btn btn-outline-secondary btn-sm" data-drawer-action="edit">' +
                    escapeHtml('Edit results') + '</button>';
            }
            if (canRelease && !released && !draft && state.activeOrderId) {
                footer += '<button type="button" class="btn btn-success btn-sm" data-drawer-action="release" data-order-id="' +
                    escapeHtml(state.activeOrderId) + '">' + escapeHtml('Release to doctor') + '</button>';
            }
            if (drawerFooter) {
                drawerFooter.innerHTML = footer;
            }
        }

        function renderDrawer() {
            var order = (state.entryForm && state.entryForm.order) || {};
            var lines = (state.entryForm && state.entryForm.lines) || [];

            if (state.viewMode === 'saved') {
                renderSavedPanel(order, state.savedDraft, false);
                return;
            }
            if (state.viewMode === 'released') {
                renderSavedPanel(order, false, true);
                return;
            }

            if (drawerTitle) {
                drawerTitle.textContent = 'Enter results — ' + (lines[0] && lines[0].procedure_name
                    ? lines[0].procedure_name
                    : 'Lab order');
            }

            var patientLine = (order.patient_name || '') +
                (order.pubpid ? (' · MRN ' + order.pubpid) : '') +
                (order.queue_number ? (' · Q#' + order.queue_number) : '');

            var html = '<p class="small text-muted mb-3">' + escapeHtml(patientLine) + '</p>';

            lines.forEach(function (line, idx) {
                var result = (line.results && line.results[0]) || {};
                var qc = line.qc || {};
                var units = result.units || qc.units || '';
                var range = result.range || qc.reference_range || '';
                var hint = qc.hint ? ('<div class="small text-muted mb-1">' + escapeHtml(qc.hint) + '</div>') : '';
                var listAttr = (qc.allowed && qc.allowed.length)
                    ? (' list="nc-labops-allowed-' + idx + '"')
                    : '';
                var datalist = (qc.allowed && qc.allowed.length)
                    ? ('<datalist id="nc-labops-allowed-' + idx + '">' +
                        qc.allowed.map(function (opt) {
                            return '<option value="' + escapeHtml(opt) + '">';
                        }).join('') + '</datalist>')
                    : '';

                html += '<div class="oe-nc-labops-line" data-line-index="' + idx + '">' +
                    '<div class="font-weight-bold mb-1">' + escapeHtml(line.procedure_name || line.procedure_code) + '</div>' +
                    hint +
                    '<input type="hidden" data-field="procedure_order_seq" value="' + escapeHtml(line.procedure_order_seq) + '">' +
                    '<input type="hidden" data-field="procedure_report_id" value="' + escapeHtml(line.procedure_report_id || '') + '">' +
                    '<input type="hidden" data-field="procedure_result_id" value="' + escapeHtml(result.procedure_result_id || '') + '">' +
                    '<div class="form-group"><label>' + escapeHtml('Result value') + ' <span class="text-danger">*</span></label>' +
                    '<input class="form-control form-control-sm" data-field="result" value="' + escapeHtml(result.result || '') + '"' + listAttr + '>' +
                    '<div class="nc-labops-feedback"></div></div>' +
                    datalist +
                    '<div class="form-row">' +
                    '<div class="col"><label>' + escapeHtml('Units') + '</label>' +
                    '<input class="form-control form-control-sm" data-field="units" value="' + escapeHtml(units) + '"></div>' +
                    '<div class="col"><label>' + escapeHtml('Range') + '</label>' +
                    '<input class="form-control form-control-sm" data-field="range" value="' + escapeHtml(range) + '"></div>' +
                    '</div>' +
                    '<div class="form-group mt-2"><label>' + escapeHtml('Abnormal') + '</label>' +
                    '<select class="form-control form-control-sm" data-field="abnormal">' +
                    optionHtml('', result.abnormal) +
                    optionHtml('yes', result.abnormal) +
                    optionHtml('high', result.abnormal) +
                    optionHtml('low', result.abnormal) +
                    '</select></div>' +
                    '<div class="form-group"><label>' + escapeHtml('Note') + '</label>' +
                    '<input class="form-control form-control-sm" data-field="comments" value="' + escapeHtml(result.comments || '') + '"></div>' +
                    '</div>';
            });

            if (!lines.length) {
                html += '<div class="alert alert-warning mb-0">' +
                    escapeHtml('This order has no tests yet. Add at least one test line before entering results.') +
                    '</div>';
                if (state.entryForm.edit_order_url) {
                    html += '<a class="btn btn-primary btn-sm mt-3" href="' +
                        escapeHtml(state.entryForm.edit_order_url) + '" target="_top">' +
                        escapeHtml('Add tests to order') + '</a>';
                }
            }

            if (drawerBody) {
                drawerBody.innerHTML = html;
                bindQcHandlers();
            }

            var footer = '';
            if (canEnter && lines.length) {
                var saveDraftLabel = state.saving ? 'Saving…' : 'Save draft';
                var saveLabel = state.saving ? 'Saving…' : 'Save';
                var disabledAttr = state.saving ? ' disabled' : '';
                footer += '<button type="button" class="btn btn-outline-secondary btn-sm" data-drawer-action="save-draft"' +
                    disabledAttr + '>' + escapeHtml(saveDraftLabel) + '</button>';
                footer += '<button type="button" class="btn btn-primary btn-sm" data-drawer-action="save"' +
                    disabledAttr + '>' + escapeHtml(saveLabel) + '</button>';
            }

            if (canRelease && state.activeOrderId && !state.savedDraft) {
                footer += '<button type="button" class="btn btn-success btn-sm" data-drawer-action="release" data-order-id="' +
                    escapeHtml(state.activeOrderId) + '">' + escapeHtml('Release to doctor') + '</button>';
            }
            if (drawerFooter) {
                drawerFooter.innerHTML = footer;
            }
        }

        function onFooterClick(event) {
            var btn = event.target.closest('[data-drawer-action]');
            if (!btn) {
                return;
            }
            var action = btn.getAttribute('data-drawer-action');
            if (action === 'done') {
                close();
                if (onSaved) {
                    onSaved();
                }
                return;
            }
            if (action === 'edit') {
                refreshEntryForm().then(function () {
                    state.viewMode = 'form';
                    renderDrawer();
                });
                return;
            }
            if (action === 'save-draft') {
                saveEntry(true);
            } else if (action === 'save') {
                saveEntry(false);
            } else if (action === 'release') {
                releaseOrder(parseInt(btn.getAttribute('data-order-id') || '0', 10));
            }
        }

        function bindQcHandlers() {
            if (!drawerBody || !state.qcValidator) {
                return;
            }

            drawerBody.querySelectorAll('.oe-nc-labops-line').forEach(function (lineEl) {
                var seqInput = lineEl.querySelector('[data-field="procedure_order_seq"]');
                var resultInput = lineEl.querySelector('[data-field="result"]');
                if (!seqInput || !resultInput) {
                    return;
                }
                var seq = parseInt(seqInput.value, 10);
                state.qcValidator.applyDefaults(lineEl, seq);

                function onResultChange() {
                    var check = state.qcValidator.validateLine(lineEl, true);
                    state.qcValidator.applyFieldFeedback(lineEl, check);
                    state.qcValidator.suggestAbnormal(lineEl, seq, resultInput.value);
                    if (check.normalizedValue && check.level !== 'error' && resultInput.value !== check.normalizedValue) {
                        resultInput.value = check.normalizedValue;
                    }
                }

                resultInput.addEventListener('blur', onResultChange);
                resultInput.addEventListener('change', onResultChange);
            });
        }

        function summarizePayloadLines(lines) {
            return lines.map(function (line) {
                var result = (line.results && line.results[0]) || {};
                var match = ((state.entryForm && state.entryForm.lines) || []).find(function (row) {
                    return parseInt(row.procedure_order_seq, 10) === parseInt(line.procedure_order_seq, 10);
                });
                var label = match
                    ? (match.procedure_name || match.procedure_code || 'Test')
                    : 'Test';
                var value = result.result ? String(result.result) : '—';
                var abnormal = result.abnormal ? (' (' + result.abnormal + ')') : '';
                var flagClass = result.abnormal ? ' class="text-danger font-weight-bold"' : '';
                return '<span' + flagClass + '>' + escapeHtml(label + ': ' + value + abnormal) + '</span>';
            });
        }

        function collectLinePayloads() {
            var lines = [];
            if (!drawerBody) {
                return lines;
            }
            drawerBody.querySelectorAll('.oe-nc-labops-line').forEach(function (lineEl) {
                lines.push({
                    procedure_order_seq: parseInt(lineEl.querySelector('[data-field="procedure_order_seq"]').value, 10),
                    procedure_report_id: parseInt(lineEl.querySelector('[data-field="procedure_report_id"]').value, 10) || null,
                    results: [{
                        procedure_result_id: parseInt(lineEl.querySelector('[data-field="procedure_result_id"]').value, 10) || null,
                        result: lineEl.querySelector('[data-field="result"]').value,
                        units: lineEl.querySelector('[data-field="units"]').value,
                        range: lineEl.querySelector('[data-field="range"]').value,
                        abnormal: lineEl.querySelector('[data-field="abnormal"]').value,
                        comments: lineEl.querySelector('[data-field="comments"]').value
                    }]
                });
            });
            return lines;
        }

        function saveEntry(draft) {
            if (state.saving) {
                return;
            }

            if (state.qcValidator && drawerBody) {
                var check = state.qcValidator.validateAll(drawerBody, draft);
                if (!check.valid) {
                    state.qcValidator.focusFirstInvalid(drawerBody);
                    return;
                }
            }

            var linePayloads = collectLinePayloads();
            state.saving = true;
            renderDrawer();

            postJson(ajaxUrl + '?action=lab_ops.result_save', {
                csrf_token_form: csrfToken,
                procedure_order_id: state.activeOrderId,
                draft: draft,
                lines: linePayloads
            }).then(function (res) {
                var payload = apiPayload(res);
                if (!payload.success) {
                    var errData = payload.data || {};
                    if (state.qcValidator && errData.field_errors) {
                        state.qcValidator.applyServerFieldErrors(
                            drawerBody,
                            errData.field_errors || {},
                            errData.field_warnings || {}
                        );
                    }
                    window.alert(payload.message || 'Save failed');
                    state.viewMode = 'form';
                    return;
                }

                var saved = payload.data || {};
                state.viewMode = 'saved';
                state.savedDraft = draft;
                state.savedAt = new Date();
                state.savedSummary = summarizePayloadLines(linePayloads);
                state.savedWarnings = saved.qc_warnings || Object.values(saved.field_warnings || {});
                return refreshEntryForm();
            }).then(function () {
                if (state.viewMode === 'saved' && onSaved) {
                    onSaved();
                }
            }).finally(function () {
                state.saving = false;
                renderDrawer();
            });
        }

        function releaseOrder(orderId) {
            if (!orderId || state.saving) {
                return;
            }

            state.saving = true;
            renderDrawer();

            postJson(ajaxUrl + '?action=lab_ops.result_release', {
                csrf_token_form: csrfToken,
                procedure_order_id: orderId
            }).then(function (res) {
                var payload = apiPayload(res);
                if (!payload.success) {
                    window.alert(payload.message || 'Release failed');
                    return;
                }

                var released = payload.data || {};
                state.savedDraft = false;
                state.savedAt = new Date();
                state.savedWarnings = released.qc_warnings || [];
                state.orderReleased = true;
                state.viewMode = (released.encounter_results_ready || released.results_ready)
                    ? 'released'
                    : 'saved';
                if (onSaved) {
                    onSaved();
                }
            }).finally(function () {
                state.saving = false;
                renderDrawer();
            });
        }

        return {
            open: open,
            close: close
        };
    }

    window.NewClinicLabOpsEntry = {
        bind: bind
    };
}(window));

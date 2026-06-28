(function (window) {
    'use strict';

    var POLL_MS = 45000;

    function localDateString(date) {
        if (window.NewClinicUI && window.NewClinicUI.localDateString) {
            return window.NewClinicUI.localDateString(date);
        }
        date = date || new Date();
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

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

    function init(root) {
        if (!root) {
            return;
        }

        var ajaxUrl = root.getAttribute('data-ajax-url') || '';
        var csrfToken = root.getAttribute('data-csrf-token') || '';
        var canEnter = root.getAttribute('data-can-enter') === '1';
        var canRelease = root.getAttribute('data-can-release') === '1';
        var canManageCatalog = root.getAttribute('data-can-catalog') === '1';

        var entry = window.NewClinicLabOpsEntry
            ? window.NewClinicLabOpsEntry.bind({
                ajaxUrl: ajaxUrl,
                csrfToken: csrfToken,
                canEnter: canEnter,
                canRelease: canRelease,
                onSaved: function () { loadWorklist(); }
            })
            : null;

        var state = {
            tab: root.getAttribute('data-initial-tab') || 'pending',
            date: '',
            fulfillment: 'all',
            urgentFirst: true,
            rows: [],
            counts: {},
            pollTimer: null,
            setup: null,
            collectOrderId: null
        };

        var els = {
            list: document.getElementById('nc-labops-list'),
            date: document.getElementById('nc-labops-date'),
            fulfillment: document.getElementById('nc-labops-fulfillment'),
            urgentFirst: document.getElementById('nc-labops-urgent-first'),
            refresh: document.getElementById('nc-labops-refresh'),
            updated: document.getElementById('nc-labops-updated'),
            countPending: document.getElementById('nc-labops-count-pending'),
            countProgress: document.getElementById('nc-labops-count-progress'),
            countSendout: document.getElementById('nc-labops-count-sendout'),
            setupPanel: document.getElementById('nc-labops-setup'),
            setupCreate: document.getElementById('nc-labops-setup-create'),
            setupImport: document.getElementById('nc-labops-setup-import'),
            accessionModal: document.getElementById('nc-labops-accession-modal'),
            accessionInput: document.getElementById('nc-labops-accession-input'),
            accessionConfirm: document.getElementById('nc-labops-accession-confirm')
        };

        if (els.date && !els.date.value) {
            els.date.value = localDateString();
        }
        state.date = els.date ? els.date.value : '';

        bindEvents();
        setActiveTab(state.tab);
        loadWorklist();
        if (canManageCatalog) {
            loadSetupStatus();
        }
        state.pollTimer = window.setInterval(loadWorklist, POLL_MS);

        function bindEvents() {
            document.querySelectorAll('[data-tab]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    setActiveTab(btn.getAttribute('data-tab') || 'pending');
                    loadWorklist();
                });
            });
            if (els.date) {
                els.date.addEventListener('change', function () {
                    state.date = els.date.value;
                    loadWorklist();
                });
            }
            if (els.fulfillment) {
                els.fulfillment.addEventListener('change', function () {
                    state.fulfillment = els.fulfillment.value;
                    loadWorklist();
                });
            }
            if (els.urgentFirst) {
                els.urgentFirst.addEventListener('change', function () {
                    state.urgentFirst = els.urgentFirst.checked;
                    loadWorklist();
                });
            }
            if (els.refresh) {
                els.refresh.addEventListener('click', loadWorklist);
            }
            if (els.list) {
                els.list.addEventListener('click', onListClick);
            }
            if (els.setupCreate) {
                els.setupCreate.addEventListener('click', createProvider);
            }
            if (els.setupImport) {
                els.setupImport.addEventListener('click', importStarter);
            }
            if (els.accessionConfirm) {
                els.accessionConfirm.addEventListener('click', confirmCollect);
            }
        }

        function setActiveTab(tab) {
            state.tab = tab;
            document.querySelectorAll('[data-tab]').forEach(function (btn) {
                btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
            });
        }

        function loadWorklist() {
            var facilityId = (window.NewClinicUI && window.NewClinicUI.resolveFacilityId)
                ? window.NewClinicUI.resolveFacilityId(root)
                : 0;
            var body = {
                tab: state.tab,
                date: state.date,
                fulfillment: state.fulfillment,
                urgent_first: state.urgentFirst
            };
            if (facilityId > 0) {
                body.facility_id = facilityId;
            }
            postJson(ajaxUrl + '?action=lab_ops.worklist', body).then(function (res) {
                var payload = apiPayload(res);
                if (!payload.success) {
                    if (els.updated) {
                        els.updated.textContent = 'Refresh failed';
                    }
                    return;
                }
                var data = payload.data || {};
                state.rows = data.rows || [];
                state.counts = data.counts || {};
                renderCounts();
                renderList();
                if (els.updated) {
                    els.updated.textContent = data.last_updated
                        ? new Date(data.last_updated).toLocaleTimeString()
                        : '';
                }
            }).catch(function () {
                if (els.updated) {
                    els.updated.textContent = 'Refresh failed';
                }
            });
        }

        function openCollectModal(orderId) {
            state.collectOrderId = orderId;
            if (els.accessionInput) {
                els.accessionInput.value = '';
            }
            if (els.accessionModal && window.jQuery) {
                window.jQuery(els.accessionModal).modal('show');
                if (els.accessionInput) {
                    window.setTimeout(function () { els.accessionInput.focus(); }, 200);
                }
            }
        }

        function confirmCollect() {
            var orderId = state.collectOrderId;
            if (!orderId) {
                return;
            }
            var accession = els.accessionInput ? els.accessionInput.value.trim() : '';
            postJson(ajaxUrl + '?action=lab_ops.specimen_collect', {
                csrf_token_form: csrfToken,
                procedure_order_id: orderId,
                accession_no: accession
            }).then(function () {
                state.collectOrderId = null;
                if (els.accessionModal && window.jQuery) {
                    window.jQuery(els.accessionModal).modal('hide');
                }
                loadWorklist();
            });
        }

        function loadSetupStatus() {
            postJson(ajaxUrl + '?action=lab_ops.setup_status', {}).then(function (res) {
                state.setup = apiPayload(res).data || {};
                renderSetup();
            });
        }

        function renderSetup() {
            if (!els.setupPanel || !state.setup) {
                return;
            }
            var s = state.setup;
            var model = s.setup_model || 'in_house';
            var html = '<div class="alert alert-light border mb-3">';
            html += '<strong>' + escapeHtml('Lab setup') + '</strong>';
            html += '<div class="form-group mb-2 mt-2">';
            html += '<label class="small font-weight-bold mb-1" for="nc-labops-setup-model">' +
                escapeHtml('Clinic lab model') + '</label>';
            html += '<select class="form-control form-control-sm" id="nc-labops-setup-model" style="max-width:280px;">';
            html += '<option value="in_house"' + (model === 'in_house' ? ' selected' : '') + '>' +
                escapeHtml('In-house bench') + '</option>';
            html += '<option value="hybrid"' + (model === 'hybrid' ? ' selected' : '') + '>' +
                escapeHtml('Hybrid (in-house + send-out)') + '</option>';
            html += '<option value="send_out_only"' + (model === 'send_out_only' ? ' selected' : '') + '>' +
                escapeHtml('Send-out only') + '</option>';
            html += '</select></div>';

            if (s.needs_inhouse_provider) {
                html += '<div class="small mb-2">';
                if (s.provider_name) {
                    html += escapeHtml('In-house: ' + s.provider_name + ' · ' + s.test_count + ' tests');
                } else {
                    html += '<span class="text-muted">' + escapeHtml('No in-house lab provider configured.') + '</span>';
                }
                html += '</div>';
            }

            if (s.needs_sendout_provider) {
                html += '<div class="small mb-2">';
                if (s.sendout_provider_name) {
                    html += escapeHtml('Send-out partner: ' + s.sendout_provider_name);
                } else {
                    html += '<span class="text-muted">' + escapeHtml('No send-out lab partner configured.') + '</span>';
                }
                html += '</div>';
            }

            html += '<div class="mt-2 d-flex flex-wrap" style="gap:0.5rem;">';
            if (s.needs_inhouse_provider && !s.provider_id) {
                html += '<button type="button" class="btn btn-sm btn-outline-primary" id="nc-labops-setup-create">' +
                    escapeHtml('Create in-house lab') + '</button>';
            }
            if (s.needs_sendout_provider && !s.sendout_provider_id) {
                html += '<button type="button" class="btn btn-sm btn-outline-primary" id="nc-labops-setup-sendout">' +
                    escapeHtml('Add send-out lab partner') + '</button>';
            }
            if (s.needs_inhouse_provider && s.provider_id && !s.has_starter_panel && s.starter_csv_available) {
                html += '<button type="button" class="btn btn-sm btn-primary" id="nc-labops-setup-import">' +
                    escapeHtml('Import OPD starter panel') + '</button>';
            }
            if (s.needs_inhouse_provider && s.has_starter_panel) {
                html += '<span class="badge badge-success align-self-center">' +
                    escapeHtml('Starter panel ready') + '</span>';
                if (s.fees_mapped) {
                    html += '<span class="badge badge-success align-self-center">' +
                        escapeHtml('Fees mapped') + '</span>';
                } else if (s.unmapped_fee_count > 0 && s.can_manage_catalog) {
                    html += '<button type="button" class="btn btn-sm btn-primary" id="nc-labops-setup-fees">' +
                        escapeHtml('Apply starter fee defaults') + '</button>';
                }
            }
            if (s.needs_sendout_provider && s.sendout_provider_id && !s.needs_inhouse_provider) {
                html += '<span class="badge badge-success align-self-center">' +
                    escapeHtml('Send-out partner ready') + '</span>';
            }
            html += '</div>';
            if (s.needs_sendout_provider && s.sendout_provider_id && !s.needs_inhouse_provider) {
                html += '<div class="small text-muted mt-2">' +
                    escapeHtml('Load send-out test codes via Advanced → Procedure providers (core).') +
                    '</div>';
            } else if (s.needs_inhouse_provider && s.has_starter_panel && !s.fees_mapped && s.unmapped_fee_count > 0) {
                html += '<div class="small text-muted mt-2">' +
                    escapeHtml(String(s.unmapped_fee_count) + ' test(s) need fee schedule mapping.') +
                    '</div>';
            }
            html += '</div>';
            els.setupPanel.innerHTML = html;

            var modelSelect = document.getElementById('nc-labops-setup-model');
            if (modelSelect) {
                modelSelect.addEventListener('change', function () {
                    saveSetupModel(modelSelect.value);
                });
            }
            var createBtn = document.getElementById('nc-labops-setup-create');
            var sendoutBtn = document.getElementById('nc-labops-setup-sendout');
            var importBtn = document.getElementById('nc-labops-setup-import');
            var feesBtn = document.getElementById('nc-labops-setup-fees');
            if (createBtn) {
                createBtn.addEventListener('click', createProvider);
            }
            if (sendoutBtn) {
                sendoutBtn.addEventListener('click', createSendOutProvider);
            }
            if (importBtn) {
                importBtn.addEventListener('click', importStarter);
            }
            if (feesBtn) {
                feesBtn.addEventListener('click', applyStarterFees);
            }
        }

        function saveSetupModel(model) {
            postJson(ajaxUrl + '?action=lab_ops.setup_model', {
                csrf_token_form: csrfToken,
                setup_model: model
            }).then(function (res) {
                var payload = apiPayload(res);
                if (!payload.success) {
                    window.alert(payload.message || 'Could not save lab model');
                    loadSetupStatus();
                    return;
                }
                state.setup = (payload.data && payload.data.setup_status)
                    ? payload.data.setup_status
                    : (payload.data || state.setup);
                renderSetup();
            });
        }

        function applyStarterFees() {
            postJson(ajaxUrl + '?action=lab_ops.fee_map_save', {
                csrf_token_form: csrfToken,
                use_starter_defaults: true
            }).then(function (res) {
                var payload = apiPayload(res);
                var data = payload.data || {};
                var errors = data.errors || payload.errors || [];
                if (!payload.success) {
                    window.alert(payload.message || 'Could not map fees');
                    return;
                }
                if (errors.length) {
                    window.alert(errors.join('\n'));
                } else if ((data.saved || 0) > 0) {
                    window.alert('Mapped ' + data.saved + ' lab test fee(s).');
                }
                if (data.setup_status) {
                    state.setup = data.setup_status;
                    renderSetup();
                } else {
                    loadSetupStatus();
                }
            });
        }

        function createProvider() {
            postJson(ajaxUrl + '?action=lab_ops.provider_create', {
                csrf_token_form: csrfToken
            }).then(function () {
                loadSetupStatus();
            });
        }

        function createSendOutProvider() {
            var name = window.prompt('Send-out lab partner name', 'External reference lab');
            if (name === null) {
                return;
            }
            postJson(ajaxUrl + '?action=lab_ops.sendout_provider_create', {
                csrf_token_form: csrfToken,
                lab_name: name
            }).then(function () {
                loadSetupStatus();
            });
        }

        function importStarter() {
            postJson(ajaxUrl + '?action=lab_ops.panel_import', {
                csrf_token_form: csrfToken,
                use_starter: true
            }).then(function () {
                loadSetupStatus();
            });
        }

        function renderCounts() {
            if (els.countPending) {
                els.countPending.textContent = String(state.counts.pending || 0);
            }
            if (els.countProgress) {
                els.countProgress.textContent = String(state.counts.in_progress || 0);
            }
            if (els.countSendout) {
                els.countSendout.textContent = String(state.counts.send_out || 0);
            }
        }

        function renderList() {
            if (!els.list) {
                return;
            }
            if (!state.rows.length) {
                var emptyMsg = 'No lab work in this tab for the selected date.';
                if (state.tab === 'send_out') {
                    emptyMsg = 'No external (send-out) lab orders for this date. '
                        + 'In-house tests stay on Pending / In progress until you release them to the doctor. '
                        + 'To send a sample to an external lab, use Print requisition on the order row — that moves it here.';
                } else if (state.tab === 'in_progress') {
                    emptyMsg = 'No in-house orders awaiting result entry or release for this date.';
                }
                els.list.innerHTML = '<div class="oe-nc-labops-empty">' +
                    escapeHtml(emptyMsg) + '</div>';
                return;
            }

            els.list.innerHTML = state.rows.map(function (row) {
                var qLabel = row.queue_number ? ('Q#' + row.queue_number + ' ') : '';
                var urgentClass = row.is_urgent ? ' oe-nc-labops-row--urgent' : '';
                var actions = '';

                if (row.can_open_lab_desk && row.lab_desk_url) {
                    actions += '<a class="btn btn-outline-secondary btn-sm" href="' +
                        escapeHtml(row.lab_desk_url) + '" target="_top">' +
                        escapeHtml('Open in Lab Desk') + '</a>';
                }
                if (row.requisition_url) {
                    var reqLabel = row.fulfillment === 'send_out'
                        ? 'Print requisition'
                        : 'Print requisition (send-out)';
                    actions += '<a class="btn btn-outline-secondary btn-sm" href="' +
                        escapeHtml(row.requisition_url) + '" target="_blank">' +
                        escapeHtml(reqLabel) + '</a>';
                }
                if (canEnter && !row.collected && row.fulfillment !== 'send_out') {
                    actions += '<button type="button" class="btn btn-outline-warning btn-sm" data-action="send-out" data-order-id="' +
                        row.procedure_order_id + '">' + escapeHtml('Mark send-out') + '</button>';
                }
                if (canEnter && !row.collected) {
                    actions += '<button type="button" class="btn btn-outline-primary btn-sm" data-action="collect" data-order-id="' +
                        row.procedure_order_id + '">' + escapeHtml('Mark collected') + '</button>';
                }
                if (canEnter && entry) {
                    actions += '<button type="button" class="btn btn-primary btn-sm" data-action="enter" data-order-id="' +
                        row.procedure_order_id + '">' + escapeHtml('Enter results') + '</button>';
                }

                return '<article class="oe-nc-labops-row' + urgentClass + '" role="listitem">' +
                    '<div class="oe-nc-labops-row__title">' + escapeHtml(qLabel + row.patient_name) +
                    ' <span class="text-muted font-weight-normal">· ' + escapeHtml(row.pubpid || '') + '</span></div>' +
                    '<div class="oe-nc-labops-row__meta">' + escapeHtml(row.test_names) + '</div>' +
                    '<div class="oe-nc-labops-row__meta">' +
                    escapeHtml(row.fulfillment_label + ' · ' + row.status_label) +
                    (row.ordered_display ? (' · ' + escapeHtml(row.ordered_display)) : '') +
                    '</div>' +
                    '<div class="oe-nc-labops-row__actions">' + actions + '</div>' +
                    '</article>';
            }).join('');
        }

        function onListClick(event) {
            var btn = event.target.closest('[data-action]');
            if (!btn) {
                return;
            }
            var orderId = parseInt(btn.getAttribute('data-order-id') || '0', 10);
            if (!orderId) {
                return;
            }
            var action = btn.getAttribute('data-action');
            if (action === 'collect') {
                openCollectModal(orderId);
            } else if (action === 'enter' && entry) {
                entry.open(orderId);
            } else if (action === 'send-out') {
                markSendOut(orderId);
            }
        }

        function markSendOut(orderId) {
            postJson(ajaxUrl + '?action=lab_ops.mark_send_out', {
                csrf_token_form: csrfToken,
                procedure_order_id: orderId
            }).then(function (res) {
                var payload = (window.NewClinicUI && window.NewClinicUI.apiPayload)
                    ? window.NewClinicUI.apiPayload(res)
                    : ((res && res.payload) ? res.payload : (res || {}));
                if (!payload.success) {
                    window.alert(payload.message || 'Could not mark send-out');
                    return;
                }
                loadWorklist();
            });
        }
    }

    window.NewClinicLabOps = {
        init: init
    };
}(window));

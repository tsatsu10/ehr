(function (window) {
    'use strict';

    var dirty = false;
    var settings = {};
    var visitTypes = [];
    var calendarCategories = [];
    var feeSchedule = [];
    var feeCategories = [];
    var feeTemplates = [];
    var billingCodeTypes = [];
    var billingCodes = [];
    var defaultCodeType = 'CPT4';
    var facilityId = 0;
    var clinicFacilityId = 0;
    var adminScope = 'facility';
    var clinicFacilityLabel = '';

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

    function setDirty(isDirty) {
        dirty = isDirty;
        var saveBtn = document.getElementById('nc-admin-save');
        if (saveBtn) {
            saveBtn.disabled = !dirty;
        }
    }

    function showMessage(id, text) {
        var el = document.getElementById(id);
        var other = id === 'nc-admin-success' ? 'nc-admin-error' : 'nc-admin-success';
        document.getElementById(other).classList.add('d-none');
        el.textContent = text;
        el.classList.remove('d-none');
    }

    function renderRoleGroups(groups) {
        if (!groups.length) {
            return '<div class="text-muted"><em>No New Clinic role groups found.</em></div>';
        }

        return groups.map(function (group) {
            var members = group.members || [];
            var activeMembers = members.filter(function (member) {
                return member.active;
            });
            var memberText = !activeMembers.length
                ? '<span class="text-muted"><em>No active members</em></span>'
                : activeMembers.map(function (member) {
                    return escapeHtml(member.display_name || member.username) +
                        ' <span class="text-muted">(' + escapeHtml(member.username) + ')</span>';
                }).join(', ');

            return '<div class="card mb-2"><div class="card-body py-2">' +
                '<div class="d-flex justify-content-between flex-wrap">' +
                '<strong>' + escapeHtml(group.group_title) + '</strong>' +
                '<span class="badge badge-secondary">' + escapeHtml(group.member_count) + ' members</span>' +
                '</div>' +
                '<div class="small mt-1">' + memberText + '</div>' +
                '</div></div>';
        }).join('');
    }

    function renderSensitivePermissions(items) {
        if (!items.length) {
            return '<div class="text-muted"><em>No sensitive permissions configured.</em></div>';
        }

        return '<table class="table table-sm table-bordered"><thead><tr>' +
            '<th>Permission</th><th>Granted to groups</th><th>Notes</th></tr></thead><tbody>' +
            items.map(function (row) {
                var groups = (row.granted_groups || []).join(', ') || '—';
                return '<tr><td><code>' + escapeHtml(row.aco_key) + '</code><br>' +
                    '<span class="small text-muted">' + escapeHtml(row.aco_title) + '</span></td>' +
                    '<td>' + escapeHtml(groups) + '</td>' +
                    '<td class="small">' + escapeHtml(row.note) + '</td></tr>';
            }).join('') +
            '</tbody></table>';
    }

    function renderAclInventory(rows) {
        if (!rows.length) {
            return '<div class="text-muted"><em>No ACL keys found.</em></div>';
        }

        return '<table class="table table-sm table-bordered"><thead><tr>' +
            '<th>ACL key</th><th>Title</th><th>Groups</th></tr></thead><tbody>' +
            rows.map(function (row) {
                var groups = (row.granted_groups || []).join(', ') || '—';
                return '<tr><td><code>' + escapeHtml(row.aco_key) + '</code></td>' +
                    '<td>' + escapeHtml(row.aco_title) + '</td>' +
                    '<td class="small">' + escapeHtml(groups) + '</td></tr>';
            }).join('') +
            '</tbody></table>';
    }

    function showModal(modal, backdrop) {
        if (window.NewClinicModal) {
            window.NewClinicModal.show(modal, backdrop);
            return;
        }
        modal.style.display = 'block';
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
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
        modal.setAttribute('aria-hidden', 'true');
        backdrop.style.display = 'none';
        backdrop.classList.remove('show');
        document.body.classList.remove('modal-open');
    }

    function categoryLabel(pcCatid) {
        var match = calendarCategories.find(function (row) {
            return parseInt(row.pc_catid, 10) === parseInt(pcCatid, 10);
        });
        if (!match) {
            return String(pcCatid || '—');
        }
        return match.name + ' (' + match.pc_catid + ')';
    }

    function profileLabel(profile) {
        if (profile === 'lab_direct') {
            return 'Lab direct';
        }
        if (profile === 'pharmacy_walkin') {
            return 'Pharmacy walk-in';
        }
        return 'Full OPD';
    }

    function renderVisitTypes() {
        var typesEl = document.getElementById('nc-admin-visit-types');
        if (!typesEl) {
            return;
        }

        if (!visitTypes.length) {
            typesEl.innerHTML = '<div class="text-muted"><em>No visit types configured.</em></div>';
            return;
        }

        typesEl.innerHTML = '<table class="table table-sm table-bordered mb-0"><thead><tr>' +
            '<th>Name</th><th>Calendar category</th><th>Profile</th><th>Scope</th><th>Status</th><th></th>' +
            '</tr></thead><tbody>' +
            visitTypes.map(function (row) {
                var status = row.is_active
                    ? (row.is_default ? '<span class="badge badge-primary">Default</span>' : 'Active')
                    : '<span class="text-muted">Archived</span>';
                var actions = '';
                if (row.is_active) {
                    actions = '<button type="button" class="btn btn-link btn-sm p-0 mr-2 nc-admin-edit-type" ' +
                        'data-id="' + escapeHtml(row.id) + '">Edit</button>';
                    if (!row.is_default) {
                        actions += '<button type="button" class="btn btn-link btn-sm p-0 text-danger nc-admin-archive-type" ' +
                            'data-id="' + escapeHtml(row.id) + '" data-label="' + escapeHtml(row.label) + '">Archive</button>';
                    }
                }
                return '<tr' + (row.is_active ? '' : ' class="text-muted"') + '>' +
                    '<td>' + escapeHtml(row.label) + '</td>' +
                    '<td>' + escapeHtml(categoryLabel(row.pc_catid)) + '</td>' +
                    '<td>' + escapeHtml(profileLabel(row.service_profile)) + '</td>' +
                    '<td class="small">' + escapeHtml(row.scope_label || '') + '</td>' +
                    '<td>' + status + '</td>' +
                    '<td class="text-nowrap">' + actions + '</td></tr>';
            }).join('') + '</tbody></table>';
    }

    function populateCategorySelect(selectedId) {
        var selectEl = document.getElementById('nc-admin-visit-type-category');
        if (!selectEl) {
            return;
        }
        selectEl.innerHTML = calendarCategories.map(function (row) {
            return '<option value="' + escapeHtml(row.pc_catid) + '">' +
                escapeHtml(row.name) + ' (' + escapeHtml(row.pc_catid) + ')</option>';
        }).join('');
        if (selectedId) {
            selectEl.value = String(selectedId);
        }
    }

    function clearVisitTypeError() {
        var errEl = document.getElementById('nc-admin-visit-type-error');
        if (errEl) {
            errEl.textContent = '';
            errEl.classList.add('d-none');
        }
    }

    function showVisitTypeError(text) {
        var errEl = document.getElementById('nc-admin-visit-type-error');
        if (!errEl) {
            return;
        }
        errEl.textContent = text;
        errEl.classList.remove('d-none');
    }

    function populateFeeHintSelect(selectedIds) {
        var selectEl = document.getElementById('nc-admin-visit-type-fee-hints');
        if (!selectEl) {
            return;
        }
        var selected = (selectedIds || []).map(function (id) {
            return parseInt(id, 10);
        });
        selectEl.innerHTML = (feeSchedule || []).filter(function (fee) {
            return fee.is_active !== false;
        }).map(function (fee) {
            var feeId = parseInt(fee.id, 10);
            var isSelected = selected.indexOf(feeId) !== -1;
            return '<option value="' + escapeHtml(feeId) + '"' + (isSelected ? ' selected' : '') + '>' +
                escapeHtml(fee.name) + ' (' + escapeHtml(fee.code) + ')</option>';
        }).join('');
    }

    function selectedFeeHintIds() {
        var selectEl = document.getElementById('nc-admin-visit-type-fee-hints');
        if (!selectEl) {
            return [];
        }
        return Array.prototype.map.call(selectEl.selectedOptions || [], function (opt) {
            return parseInt(opt.value, 10);
        }).filter(function (id) {
            return id > 0;
        });
    }

    function openVisitTypeModal(row) {
        var modal = document.getElementById('nc-admin-visit-type-modal');
        var backdrop = document.getElementById('nc-admin-modal-backdrop');
        var titleEl = document.getElementById('nc-admin-visit-type-title');
        if (!modal || !backdrop) {
            return;
        }

        clearVisitTypeError();
        document.getElementById('nc-admin-visit-type-id').value = row ? String(row.id) : '';
        document.getElementById('nc-admin-visit-type-label').value = row ? row.label : '';
        populateCategorySelect(row ? row.pc_catid : (calendarCategories[0] && calendarCategories[0].pc_catid));
        document.getElementById('nc-admin-visit-type-profile').value = row ? row.service_profile : 'full_opd';
        document.getElementById('nc-admin-visit-type-referral').checked = !!(row && row.referral_required);
        document.getElementById('nc-admin-visit-type-default').checked = !!(row && row.is_default);
        populateFeeHintSelect(row ? row.cashier_fee_hint_ids : []);
        titleEl.textContent = row ? 'Edit visit type' : 'Add visit type';
        showModal(modal, backdrop);
        document.getElementById('nc-admin-visit-type-label').focus();
    }

    function applyVisitTypePayload(data) {
        visitTypes = data.visit_types || [];
        calendarCategories = data.calendar_categories || calendarCategories;
        facilityId = data.facility_id || facilityId;
        renderVisitTypes();
    }

    function saveVisitType(root) {
        var saveBtn = document.getElementById('nc-admin-visit-type-save');
        var modal = document.getElementById('nc-admin-visit-type-modal');
        var backdrop = document.getElementById('nc-admin-modal-backdrop');
        var visitTypeId = parseInt(document.getElementById('nc-admin-visit-type-id').value, 10) || 0;

        clearVisitTypeError();
        saveBtn.disabled = true;

        postJson(root.dataset.ajaxUrl + '?action=admin.visit_type.save', {
            facility_id: facilityId,
            visit_type: {
                id: visitTypeId,
                label: document.getElementById('nc-admin-visit-type-label').value,
                pc_catid: parseInt(document.getElementById('nc-admin-visit-type-category').value, 10),
                service_profile: document.getElementById('nc-admin-visit-type-profile').value,
                referral_required: document.getElementById('nc-admin-visit-type-referral').checked,
                is_default: document.getElementById('nc-admin-visit-type-default').checked,
                cashier_fee_hint_ids: selectedFeeHintIds()
            },
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            saveBtn.disabled = false;
            if (!result.payload.success) {
                showVisitTypeError(result.payload.message || 'Save failed');
                return;
            }
            applyVisitTypePayload(result.payload.data || {});
            hideModal(modal, backdrop);
            showMessage('nc-admin-success', 'Visit type saved.');
        });
    }

    function archiveVisitType(root, visitTypeId, label) {
        if (!window.confirm('Archive visit type "' + label + '"?')) {
            return;
        }

        postJson(root.dataset.ajaxUrl + '?action=admin.visit_type.archive', {
            facility_id: facilityId,
            visit_type_id: visitTypeId,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                showMessage('nc-admin-error', result.payload.message || 'Archive failed');
                return;
            }
            applyVisitTypePayload(result.payload.data || {});
            showMessage('nc-admin-success', 'Visit type archived.');
        });
    }

    function wireVisitTypeHandlers(root) {
        var modal = document.getElementById('nc-admin-visit-type-modal');
        var backdrop = document.getElementById('nc-admin-modal-backdrop');
        var addBtn = document.getElementById('nc-admin-add-visit-type');
        var saveBtn = document.getElementById('nc-admin-visit-type-save');
        var cancelBtn = document.getElementById('nc-admin-visit-type-cancel');
        var closeBtn = document.getElementById('nc-admin-visit-type-close');
        var typesEl = document.getElementById('nc-admin-visit-types');

        if (addBtn) {
            addBtn.addEventListener('click', function () {
                openVisitTypeModal(null);
            });
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                saveVisitType(root);
            });
        }
        [cancelBtn, closeBtn].forEach(function (btn) {
            if (btn) {
                btn.addEventListener('click', function () {
                    hideModal(modal, backdrop);
                });
            }
        });
        if (backdrop) {
            backdrop.addEventListener('click', function () {
                hideModal(modal, backdrop);
            });
        }
        if (typesEl) {
            typesEl.addEventListener('click', function (event) {
                var editBtn = event.target.closest('.nc-admin-edit-type');
                if (editBtn) {
                    var editId = parseInt(editBtn.getAttribute('data-id'), 10);
                    var row = visitTypes.find(function (type) {
                        return parseInt(type.id, 10) === editId;
                    });
                    openVisitTypeModal(row || null);
                    return;
                }
                var archiveBtn = event.target.closest('.nc-admin-archive-type');
                if (archiveBtn) {
                    archiveVisitType(
                        root,
                        parseInt(archiveBtn.getAttribute('data-id'), 10),
                        archiveBtn.getAttribute('data-label') || 'visit type'
                    );
                }
            });
        }
    }

    function formatPrice(amount) {
        var symbol = settings.currency_symbol || '';
        var decimals = settings.currency_decimals !== undefined ? settings.currency_decimals : 2;
        var formatted = Number(amount || 0).toFixed(decimals);
        return symbol ? symbol + ' ' + formatted : formatted;
    }

    function renderFeeSchedule() {
        var el = document.getElementById('nc-admin-fee-schedule');
        if (!el) {
            return;
        }

        if (!feeSchedule.length) {
            el.innerHTML = '<div class="text-muted"><em>No fee lines configured.</em></div>';
            return;
        }

        el.innerHTML = '<table class="table table-sm table-bordered mb-0"><thead><tr>' +
            '<th>Code</th><th>Description</th><th>Category</th><th>Price</th>' +
            '<th>Billing</th><th>Scope</th><th>Status</th><th></th></tr></thead><tbody>' +
            feeSchedule.map(function (row) {
                var status = row.is_active
                    ? 'Active'
                    : '<span class="text-muted">Archived</span>';
                var billing = escapeHtml(row.code_type) + ' · ' + escapeHtml(row.billing_code);
                var actions = '';
                if (row.is_active) {
                    actions = '<button type="button" class="btn btn-link btn-sm p-0 mr-2 nc-admin-edit-fee" ' +
                        'data-id="' + escapeHtml(row.id) + '">Edit</button>' +
                        '<button type="button" class="btn btn-link btn-sm p-0 text-danger nc-admin-archive-fee" ' +
                        'data-id="' + escapeHtml(row.id) + '" data-label="' + escapeHtml(row.name) + '">Archive</button>';
                }
                return '<tr' + (row.is_active ? '' : ' class="text-muted"') + '>' +
                    '<td><code>' + escapeHtml(row.code) + '</code></td>' +
                    '<td>' + escapeHtml(row.name) + '</td>' +
                    '<td>' + escapeHtml(row.category_label || row.category || '—') + '</td>' +
                    '<td>' + escapeHtml(formatPrice(row.price_amount)) + '</td>' +
                    '<td class="small">' + billing + '</td>' +
                    '<td class="small">' + escapeHtml(row.scope_label || '') + '</td>' +
                    '<td>' + status + '</td>' +
                    '<td class="text-nowrap">' + actions + '</td></tr>';
            }).join('') + '</tbody></table>';
    }

    function clearFeeError() {
        var errEl = document.getElementById('nc-admin-fee-error');
        if (errEl) {
            errEl.textContent = '';
            errEl.classList.add('d-none');
        }
    }

    function showFeeError(text) {
        var errEl = document.getElementById('nc-admin-fee-error');
        if (!errEl) {
            return;
        }
        errEl.textContent = text;
        errEl.classList.remove('d-none');
    }

    function populateFeeCategorySelect(selected) {
        var selectEl = document.getElementById('nc-admin-fee-category');
        if (!selectEl) {
            return;
        }
        selectEl.innerHTML = feeCategories.map(function (row) {
            return '<option value="' + escapeHtml(row.value) + '">' + escapeHtml(row.label) + '</option>';
        }).join('');
        if (selected) {
            selectEl.value = selected;
        }
    }

    function populateFeeCodeTypeSelect(selected) {
        var selectEl = document.getElementById('nc-admin-fee-code-type');
        var hintEl = document.getElementById('nc-admin-fee-code-type-hint');
        if (!selectEl) {
            return;
        }
        if (!billingCodeTypes.length) {
            selectEl.innerHTML = '<option value="">' + escapeHtml('No billable code types') + '</option>';
            if (hintEl) {
                hintEl.textContent = 'Enable fee types under Administration → Codes in OpenEMR.';
            }
            return;
        }
        selectEl.innerHTML = billingCodeTypes.map(function (row) {
            return '<option value="' + escapeHtml(row.ct_key) + '">' +
                escapeHtml(row.label) + ' (' + escapeHtml(row.ct_key) + ')</option>';
        }).join('');
        selectEl.value = selected || defaultCodeType || billingCodeTypes[0].ct_key;
        if (hintEl) {
            hintEl.textContent = 'CPT4/HCPCS for standard codes; use the type where your clinic codes live.';
        }
    }

    function populateFeeTemplateSelect() {
        var selectEl = document.getElementById('nc-admin-fee-template');
        if (!selectEl) {
            return;
        }
        var options = '<option value="">' + escapeHtml('Blank fee line') + '</option>';
        options += feeTemplates.map(function (row) {
            return '<option value="' + escapeHtml(row.id) + '">' + escapeHtml(row.label) + '</option>';
        }).join('');
        selectEl.innerHTML = options;
    }

    function populateBillingCodeSelect(selected) {
        var selectEl = document.getElementById('nc-admin-fee-billing-code');
        var hintEl = document.getElementById('nc-admin-fee-billing-hint');
        if (!selectEl) {
            return;
        }
        if (!billingCodes.length) {
            selectEl.innerHTML = '<option value="">' + escapeHtml('No codes found — add in OpenEMR first') + '</option>';
            if (hintEl) {
                hintEl.textContent = 'Open Codes admin, add the billing code, then refresh this dialog.';
            }
            return;
        }
        selectEl.innerHTML = '<option value="">' + escapeHtml('Select billing code…') + '</option>' +
            billingCodes.map(function (row) {
                var label = row.code + ' — ' + (row.name || 'No description');
                if (row.fee) {
                    label += ' (' + formatPrice(row.fee) + ')';
                }
                return '<option value="' + escapeHtml(row.code) + '">' + escapeHtml(label) + '</option>';
            }).join('');
        if (selected) {
            selectEl.value = selected;
        }
        if (hintEl) {
            hintEl.textContent = billingCodes.length + ' active code(s) for this type.';
        }
    }

    function updateFeePriceHint() {
        var hintEl = document.getElementById('nc-admin-fee-price-hint');
        if (!hintEl) {
            return;
        }
        var symbol = settings.currency_symbol || '';
        hintEl.textContent = symbol
            ? 'Clinic currency: ' + symbol
            : 'Default amount suggested to cashier; editable at payment.';
    }

    function loadBillingCodes(root, codeType, selected) {
        var url = root.dataset.ajaxUrl + '?action=admin.fee.billing_codes' +
            '&code_type=' + encodeURIComponent(codeType || defaultCodeType);
        return getJson(url).then(function (result) {
            if (!result.payload.success) {
                billingCodes = [];
            } else {
                billingCodes = result.payload.data.billing_codes || [];
            }
            populateBillingCodeSelect(selected || '');
        });
    }

    function applyFeeTemplate(templateId) {
        var hintEl = document.getElementById('nc-admin-fee-template-hint');
        if (!templateId) {
            if (hintEl) {
                hintEl.textContent = '';
            }
            return;
        }
        var template = feeTemplates.find(function (row) {
            return row.id === templateId;
        });
        if (!template) {
            return;
        }
        document.getElementById('nc-admin-fee-code').value = template.code || '';
        document.getElementById('nc-admin-fee-name').value = template.name || '';
        document.getElementById('nc-admin-fee-category').value = template.category || 'consult';
        document.getElementById('nc-admin-fee-price').value = template.price_amount || 0;
        document.getElementById('nc-admin-fee-sort').value = template.sort_order || 0;
        document.getElementById('nc-admin-fee-code-type').value = template.code_type || defaultCodeType;
        if (hintEl) {
            hintEl.textContent = template.hint || '';
        }
    }

    function onBillingCodePicked() {
        var code = document.getElementById('nc-admin-fee-billing-code').value;
        var match = billingCodes.find(function (row) {
            return row.code === code;
        });
        if (!match) {
            return;
        }
        var nameEl = document.getElementById('nc-admin-fee-name');
        var codeEl = document.getElementById('nc-admin-fee-code');
        var priceEl = document.getElementById('nc-admin-fee-price');
        if (!nameEl.value.trim() && match.name) {
            nameEl.value = match.name;
        }
        if (!codeEl.value.trim()) {
            codeEl.value = match.code;
        }
        if ((!priceEl.value || parseFloat(priceEl.value, 10) === 0) && match.fee) {
            priceEl.value = match.fee;
        }
    }

    function openFeeModal(root, row) {
        var modal = document.getElementById('nc-admin-fee-modal');
        var backdrop = document.getElementById('nc-admin-modal-backdrop');
        var titleEl = document.getElementById('nc-admin-fee-title');
        if (!modal || !backdrop) {
            return;
        }

        clearFeeError();
        populateFeeCategorySelect(row ? row.category : 'consult');
        populateFeeCodeTypeSelect(row ? row.code_type : defaultCodeType);
        populateFeeTemplateSelect();
        document.getElementById('nc-admin-fee-template').value = '';
        document.getElementById('nc-admin-fee-template-hint').textContent = '';
        document.getElementById('nc-admin-fee-id').value = row ? String(row.id) : '';
        document.getElementById('nc-admin-fee-code').value = row ? row.code : '';
        document.getElementById('nc-admin-fee-name').value = row ? row.name : '';
        document.getElementById('nc-admin-fee-price').value = row ? row.price_amount : '0';
        document.getElementById('nc-admin-fee-sort').value = row ? row.sort_order : '0';
        updateFeePriceHint();
        titleEl.textContent = row ? 'Edit fee line' : 'Add fee line';

        var codeType = row ? row.code_type : (defaultCodeType || '');
        loadBillingCodes(root, codeType, row ? row.billing_code : '').then(function () {
            showModal(modal, backdrop);
            document.getElementById('nc-admin-fee-code').focus();
        });
    }

    function applyFeePayload(data) {
        feeSchedule = data.fee_schedule || [];
        if (data.categories) {
            feeCategories = data.categories;
        }
        if (data.templates) {
            feeTemplates = data.templates;
        }
        if (data.billing_code_types) {
            billingCodeTypes = data.billing_code_types;
        }
        if (data.default_code_type) {
            defaultCodeType = data.default_code_type;
        }
        renderFeeSchedule();
    }

    function applyFeeFormMeta(data) {
        var form = data.fee_form || data;
        feeCategories = form.categories || feeCategories;
        feeTemplates = form.templates || feeTemplates;
        billingCodeTypes = form.billing_code_types || billingCodeTypes;
        defaultCodeType = form.default_code_type || defaultCodeType;
    }

    function saveFee(root) {
        var saveBtn = document.getElementById('nc-admin-fee-save');
        var modal = document.getElementById('nc-admin-fee-modal');
        var backdrop = document.getElementById('nc-admin-modal-backdrop');
        var feeId = parseInt(document.getElementById('nc-admin-fee-id').value, 10) || 0;

        clearFeeError();
        saveBtn.disabled = true;

        postJson(root.dataset.ajaxUrl + '?action=admin.fee.save', {
            facility_id: facilityId,
            fee: {
                id: feeId,
                code: document.getElementById('nc-admin-fee-code').value,
                name: document.getElementById('nc-admin-fee-name').value,
                category: document.getElementById('nc-admin-fee-category').value,
                price_amount: parseFloat(document.getElementById('nc-admin-fee-price').value) || 0,
                sort_order: parseInt(document.getElementById('nc-admin-fee-sort').value, 10) || 0,
                code_type: document.getElementById('nc-admin-fee-code-type').value,
                billing_code: document.getElementById('nc-admin-fee-billing-code').value
            },
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            saveBtn.disabled = false;
            if (!result.payload.success) {
                showFeeError(result.payload.message || 'Save failed');
                return;
            }
            applyFeePayload(result.payload.data || {});
            hideModal(modal, backdrop);
            showMessage('nc-admin-success', 'Fee line saved.');
        });
    }

    function archiveFee(root, feeId, label) {
        if (!window.confirm('Archive fee line "' + label + '"?')) {
            return;
        }

        postJson(root.dataset.ajaxUrl + '?action=admin.fee.archive', {
            facility_id: facilityId,
            fee_id: feeId,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                showMessage('nc-admin-error', result.payload.message || 'Archive failed');
                return;
            }
            applyFeePayload(result.payload.data || {});
            showMessage('nc-admin-success', 'Fee line archived.');
        });
    }

    function wireFeeHandlers(root) {
        var modal = document.getElementById('nc-admin-fee-modal');
        var backdrop = document.getElementById('nc-admin-modal-backdrop');
        var addBtn = document.getElementById('nc-admin-add-fee');
        var saveBtn = document.getElementById('nc-admin-fee-save');
        var cancelBtn = document.getElementById('nc-admin-fee-cancel');
        var closeBtn = document.getElementById('nc-admin-fee-close');
        var listEl = document.getElementById('nc-admin-fee-schedule');

        if (addBtn) {
            addBtn.addEventListener('click', function () {
                openFeeModal(root, null);
            });
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                saveFee(root);
            });
        }
        [cancelBtn, closeBtn].forEach(function (btn) {
            if (btn) {
                btn.addEventListener('click', function () {
                    hideModal(modal, backdrop);
                });
            }
        });
        if (listEl) {
            listEl.addEventListener('click', function (event) {
                var editBtn = event.target.closest('.nc-admin-edit-fee');
                if (editBtn) {
                    var editId = parseInt(editBtn.getAttribute('data-id'), 10);
                    var row = feeSchedule.find(function (fee) {
                        return parseInt(fee.id, 10) === editId;
                    });
                    openFeeModal(root, row || null);
                    return;
                }
                var archiveBtn = event.target.closest('.nc-admin-archive-fee');
                if (archiveBtn) {
                    archiveFee(
                        root,
                        parseInt(archiveBtn.getAttribute('data-id'), 10),
                        archiveBtn.getAttribute('data-label') || 'fee line'
                    );
                }
            });
        }

        var templateEl = document.getElementById('nc-admin-fee-template');
        if (templateEl) {
            templateEl.addEventListener('change', function () {
                var templateId = templateEl.value;
                applyFeeTemplate(templateId);
                var template = feeTemplates.find(function (row) {
                    return row.id === templateId;
                });
                var codeType = document.getElementById('nc-admin-fee-code-type').value;
                loadBillingCodes(root, codeType, template ? template.billing_code : '');
            });
        }
        var codeTypeEl = document.getElementById('nc-admin-fee-code-type');
        if (codeTypeEl) {
            codeTypeEl.addEventListener('change', function () {
                loadBillingCodes(root, codeTypeEl.value, '');
            });
        }
        var billingEl = document.getElementById('nc-admin-fee-billing-code');
        if (billingEl) {
            billingEl.addEventListener('change', onBillingCodePicked);
        }
    }

    function wireAdminLinks(root) {
        var webroot = root.dataset.webroot || '';
        var usersLink = document.getElementById('nc-admin-link-users');
        var aclLink = document.getElementById('nc-admin-link-acl');
        var codesLink = document.getElementById('nc-admin-link-codes');
        if (usersLink) {
            usersLink.href = webroot + '/interface/usergroup/usergroup_admin.php';
        }
        if (aclLink) {
            aclLink.href = webroot + '/interface/usergroup/adminacl.php';
        }
        if (codesLink) {
            codesLink.href = webroot + '/interface/super/layout_service_codes.php';
        }

        var grantBtn = document.getElementById('nc-admin-grant-self-roles');
        if (grantBtn) {
            grantBtn.addEventListener('click', function () {
                if (!window.confirm('Grant all New Clinic desk groups to your account? Log out and back in afterward.')) {
                    return;
                }
                grantBtn.disabled = true;
                postJson(root.dataset.ajaxUrl + '?action=admin.roles.grant_self', {
                    csrf_token_form: root.dataset.csrfToken
                }).then(function (result) {
                    grantBtn.disabled = false;
                    if (!result.payload.success) {
                        showMessage('nc-admin-error', result.payload.message || 'Grant failed');
                        return;
                    }
                    showMessage('nc-admin-success', result.payload.message || 'Roles granted.');
                });
            });
        }

        var importBtn = document.getElementById('nc-admin-fee-import');
        if (importBtn) {
            importBtn.addEventListener('click', function () {
                var csvEl = document.getElementById('nc-admin-fee-csv');
                var csv = csvEl ? csvEl.value : '';
                if (!csv.trim()) {
                    showMessage('nc-admin-error', 'Paste CSV content first.');
                    return;
                }
                importBtn.disabled = true;
                postJson(root.dataset.ajaxUrl + '?action=admin.fee.import', {
                    facility_id: facilityId,
                    csv: csv,
                    csrf_token_form: root.dataset.csrfToken
                }).then(function (result) {
                    importBtn.disabled = false;
                    if (!result.payload.success) {
                        showMessage('nc-admin-error', result.payload.message || 'Import failed');
                        return;
                    }
                    var data = result.payload.data || {};
                    feeSchedule = data.fee_schedule || feeSchedule;
                    renderFeeSchedule();
                    if (csvEl) {
                        csvEl.value = '';
                    }
                    var summary = data.import_summary || {};
                    showMessage('nc-admin-success', 'Imported ' + (summary.imported || 0) +
                        ' fee line(s), skipped ' + (summary.skipped || 0) + '.');
                });
            });
        }
    }

    function applySettings(data) {
        settings = data.settings || {};
        facilityId = data.facility_id || 0;
        adminScope = data.scope === 'global' ? 'global' : 'facility';
        if (data.clinic_facility_id) {
            clinicFacilityId = parseInt(data.clinic_facility_id, 10) || clinicFacilityId;
        }
        clinicFacilityLabel = data.clinic_facility_label || ('Facility ' + (clinicFacilityId || data.clinic_facility_id || ''));
        calendarCategories = data.calendar_categories || [];
        visitTypes = data.visit_types || [];
        feeSchedule = data.fee_schedule || [];
        applyFeeFormMeta(data);
        document.querySelectorAll('.nc-admin-field').forEach(function (field) {
            var key = field.getAttribute('data-key');
            if (!key || settings[key] === undefined) {
                return;
            }
            if (field.type === 'checkbox') {
                field.checked = !!settings[key];
            } else {
                field.value = settings[key];
            }
        });

        renderVisitTypes();
        renderFeeSchedule();

        setDirty(false);
        var scopeSelect = document.getElementById('nc-admin-scope');
        if (scopeSelect) {
            scopeSelect.value = adminScope;
        }
        var statusEl = document.getElementById('nc-admin-status');
        if (statusEl) {
            statusEl.textContent = data.scope_label || ('Facility ' + facilityId);
        }
        var hintEl = document.getElementById('nc-admin-scope-hint');
        if (hintEl) {
            hintEl.textContent = adminScope === 'global'
                ? 'Applies as the default when a clinic has no override.'
                : ('Editing ' + (data.scope_label || clinicFacilityLabel) + ' (ID ' + facilityId + ').');
        }
        document.getElementById('nc-admin-currency-code').textContent =
            settings.currency_code || '—';
        document.getElementById('nc-admin-currency-symbol').textContent =
            settings.currency_symbol || '—';
        document.getElementById('nc-admin-currency-decimals').textContent =
            settings.currency_decimals !== undefined ? settings.currency_decimals : '—';

        var roles = data.roles || {};
        document.getElementById('nc-admin-roles').innerHTML =
            renderRoleGroups(roles.role_groups || []);
        document.getElementById('nc-admin-sensitive').innerHTML =
            renderSensitivePermissions(roles.sensitive_permissions || []);
        document.getElementById('nc-admin-acl-inventory').innerHTML =
            renderAclInventory(roles.acl_inventory || []);
        loadReconciliationStatus(root);
    }

    function loadReconciliationStatus(root) {
        var statusEl = document.getElementById('nc-admin-reconciliation-status');
        if (!statusEl) {
            return;
        }

        var url = root.dataset.ajaxUrl + '?action=reports.reconciliation';
        if (window.NewClinicUI && window.NewClinicUI.facilityQuerySuffix) {
            url += window.NewClinicUI.facilityQuerySuffix(root);
        }

        getJson(url).then(function (result) {
            if (!result.payload.success) {
                statusEl.textContent = 'Last run: unavailable';
                return;
            }
            var latest = (result.payload.data || {}).latest_run;
            if (!latest) {
                statusEl.textContent = 'Last run: none yet';
                return;
            }
            statusEl.textContent = 'Last run: ' + (latest.run_date || '') +
                ' — ' + (latest.status || '') +
                ' (delta ' + (latest.delta_amount || '0') + ')';
        }).catch(function () {
            statusEl.textContent = 'Last run: unavailable';
        });
    }

    function runReconciliationNow(root) {
        var btn = document.getElementById('nc-admin-run-reconciliation');
        if (btn) {
            btn.disabled = true;
        }
        postJson(root.dataset.ajaxUrl + '?action=admin.reconciliation.run', {
            csrf_token_form: root.dataset.csrfToken,
            run_date: new Date().toISOString().slice(0, 10)
        }).then(function (result) {
            if (!result.payload.success) {
                showMessage('nc-admin-error', result.payload.message || 'Reconciliation failed');
                return;
            }
            var data = result.payload.data || {};
            showMessage('nc-admin-success',
                'Reconciliation ' + (data.status || 'done') +
                ' — module ' + (data.module_total_amount || 0) +
                ', core ' + (data.core_total_amount || 0) +
                ', delta ' + (data.delta_amount || 0));
            loadReconciliationStatus(root);
        }).catch(function () {
            showMessage('nc-admin-error', 'Reconciliation failed — check your connection and try again.');
        }).finally(function () {
            if (btn) {
                btn.disabled = false;
            }
        });
    }

    function collectSettings() {
        var out = {};
        document.querySelectorAll('.nc-admin-field').forEach(function (field) {
            var key = field.getAttribute('data-key');
            if (!key) {
                return;
            }
            if (field.type === 'checkbox') {
                out[key] = field.checked;
            } else {
                out[key] = field.value;
            }
        });
        return out;
    }

    function loadSettings(root) {
        var url = root.dataset.ajaxUrl + '?action=admin.config&scope=' + encodeURIComponent(adminScope);
        return getJson(url).then(function (result) {
            if (!result.payload.success) {
                showMessage('nc-admin-error', result.payload.message || 'Load failed');
                return;
            }
            applySettings(result.payload.data || {});
        }).catch(function () {
            showMessage('nc-admin-error', 'Failed to load settings — check your connection and refresh.');
        });
    }

    function saveSettings(root) {
        var saveBtn = document.getElementById('nc-admin-save');
        saveBtn.disabled = true;
        postJson(root.dataset.ajaxUrl + '?action=admin.config.save', {
            scope: adminScope,
            facility_id: facilityId,
            settings: collectSettings(),
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                showMessage('nc-admin-error', result.payload.message || 'Save failed');
                setDirty(true);
                return;
            }
            applySettings(result.payload.data || {});
            showMessage('nc-admin-success', 'Settings saved.');
        }).catch(function () {
            showMessage('nc-admin-error', 'Save failed — check your connection and try again.');
            setDirty(true);
        });
    }

    function init(root) {
        if (!root) {
            return;
        }

        clinicFacilityId = parseInt(root.dataset.clinicFacilityId || '0', 10) || 0;

        loadSettings(root);
        wireAdminLinks(root);
        wireVisitTypeHandlers(root);
        wireFeeHandlers(root);

        var scopeSelect = document.getElementById('nc-admin-scope');
        if (scopeSelect) {
            scopeSelect.addEventListener('change', function () {
                if (dirty && !window.confirm('Discard unsaved changes and switch settings scope?')) {
                    scopeSelect.value = adminScope;
                    return;
                }
                adminScope = scopeSelect.value === 'global' ? 'global' : 'facility';
                setDirty(false);
                loadSettings(root);
            });
        }

        root.querySelectorAll('.nc-admin-field').forEach(function (field) {
            field.addEventListener('change', function () {
                setDirty(true);
            });
            field.addEventListener('input', function () {
                setDirty(true);
            });
        });

        document.getElementById('nc-admin-save').addEventListener('click', function () {
            saveSettings(root);
        });

        var reconcileBtn = document.getElementById('nc-admin-run-reconciliation');
        if (reconcileBtn) {
            reconcileBtn.addEventListener('click', function () {
                runReconciliationNow(root);
            });
        }

        if (window.NewClinicUI && window.NewClinicUI.bindBootstrapTabUrlState) {
            window.NewClinicUI.bindBootstrapTabUrlState({
                tabSelector: '#nc-admin-desk [data-toggle="tab"]',
                panePrefix: 'nc-admin-tab-',
                defaultTab: 'queue'
            });
        }
    }

    window.NewClinicAdmin = { init: init };
})(window);

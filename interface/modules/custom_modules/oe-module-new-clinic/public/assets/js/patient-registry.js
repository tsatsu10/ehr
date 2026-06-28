(function (window) {
    'use strict';

    function postJson(url, body) {
        return window.NewClinicUI.postJson(url, body);
    }

    function escapeHtml(value) {
        return window.NewClinicUI.escapeHtml(value);
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
        var chartBase = root.getAttribute('data-chart-url-base') || '';
        var state = { page: 1, pageSize: 25, lastMeta: null, myProviderToday: false, canShareFilter: false, selectedSavedId: 0 };

        var els = {
            preset: document.getElementById('nc-registry-preset'),
            summary: document.getElementById('nc-registry-summary'),
            rows: document.getElementById('nc-registry-rows'),
            pagination: document.getElementById('nc-registry-pagination'),
            apply: document.getElementById('nc-registry-apply'),
            clear: document.getElementById('nc-registry-clear'),
            refresh: document.getElementById('nc-registry-refresh'),
            exportBtn: document.getElementById('nc-registry-export'),
            saveFilter: document.getElementById('nc-registry-save-filter'),
            deleteFilter: document.getElementById('nc-registry-delete-filter'),
            visitStates: document.getElementById('nc-registry-visit-states'),
            visitType: document.getElementById('nc-registry-visit-type'),
            confirmationSource: document.getElementById('nc-registry-confirmation-source'),
            conditionKey: document.getElementById('nc-registry-condition-key')
        };

        loadPresets();
        bindEvents();

        function bindEvents() {
            if (els.apply) {
                els.apply.addEventListener('click', function () {
                    state.page = 1;
                    runSearch();
                });
            }
            if (els.clear) {
                els.clear.addEventListener('click', clearFilters);
            }
            if (els.refresh) {
                els.refresh.addEventListener('click', runSearch);
            }
            if (els.exportBtn) {
                els.exportBtn.addEventListener('click', runExport);
            }
            if (els.saveFilter) {
                els.saveFilter.addEventListener('click', saveCurrentFilters);
            }
            if (els.deleteFilter) {
                els.deleteFilter.addEventListener('click', deleteSelectedSavedFilter);
            }
            if (els.preset) {
                els.preset.addEventListener('change', onPresetChange);
            }
        }

        function onPresetChange() {
            var option = els.preset.options[els.preset.selectedIndex];
            var savedId = option && option.dataset.savedId ? parseInt(option.dataset.savedId, 10) : 0;
            state.selectedSavedId = savedId;
            if (els.deleteFilter) {
                if (savedId > 0 && option.dataset.canDelete === '1') {
                    els.deleteFilter.classList.remove('d-none');
                } else {
                    els.deleteFilter.classList.add('d-none');
                }
            }
            applyPreset();
        }

        function loadPresets() {
            window.NewClinicUI.getJson(ajaxUrl + '?action=cohort.presets')
                .then(function (res) {
                    var payload = apiPayload(res);
                    if (!payload.success || !payload.data) {
                        return;
                    }
                    if (els.preset) {
                        while (els.preset.options.length > 1) {
                            els.preset.remove(1);
                        }
                        (payload.data.builtins || []).forEach(function (preset) {
                            appendPresetOption(preset);
                        });
                        var saved = payload.data.saved || [];
                        if (saved.length) {
                            var group = document.createElement('optgroup');
                            group.label = 'Saved filters';
                            saved.forEach(function (preset) {
                                appendPresetOption(preset, group);
                            });
                            els.preset.appendChild(group);
                        }
                    }
                    state.canShareFilter = !!payload.data.can_share_filter;
                    populateVisitStates(payload.data.visit_states || []);
                    populateVisitTypes(payload.data.visit_types || []);
                    populateConfirmationSources(payload.data.confirmation_sources || []);
                    populateConditionMap(payload.data.condition_map || []);
                });
        }

        function populateConditionMap(conditions) {
            if (!els.conditionKey || !conditions.length) {
                return;
            }
            conditions.forEach(function (row) {
                var opt = document.createElement('option');
                opt.value = row.key;
                opt.textContent = row.label || row.key;
                els.conditionKey.appendChild(opt);
            });
        }

        function populateVisitTypes(types) {
            if (!els.visitType || !types.length) {
                return;
            }
            types.forEach(function (typeRow) {
                var opt = document.createElement('option');
                opt.value = String(typeRow.id);
                opt.textContent = typeRow.label || ('Type ' + typeRow.id);
                els.visitType.appendChild(opt);
            });
        }

        function populateConfirmationSources(sources) {
            if (!els.confirmationSource || !sources.length) {
                return;
            }
            els.confirmationSource.innerHTML = '';
            sources.forEach(function (sourceRow) {
                var opt = document.createElement('option');
                opt.value = sourceRow.value;
                opt.textContent = sourceRow.label || sourceRow.value;
                els.confirmationSource.appendChild(opt);
            });
        }

        function appendPresetOption(preset, parent) {
            var opt = document.createElement('option');
            opt.value = preset.id;
            opt.textContent = preset.label;
            opt.dataset.filters = JSON.stringify(preset.filters || {});
            if (preset.saved_id) {
                opt.dataset.savedId = String(preset.saved_id);
                opt.dataset.canDelete = preset.can_delete ? '1' : '0';
            }
            (parent || els.preset).appendChild(opt);
        }

        function saveCurrentFilters() {
            var name = window.prompt('Name for this saved filter:');
            if (!name) {
                return;
            }
            var isShared = false;
            if (state.canShareFilter) {
                isShared = window.confirm('Share this filter with the whole clinic?');
            }
            postJson(ajaxUrl + '?action=cohort.saved_filter', {
                csrf_token_form: csrfToken,
                operation: 'save',
                name: name,
                is_shared: isShared ? 1 : 0,
                filters: collectFilters()
            }).then(function (res) {
                var payload = apiPayload(res);
                if (!payload.success) {
                    window.alert(payload.message || 'Could not save filter');
                    return;
                }
                loadPresets();
            });
        }

        function deleteSelectedSavedFilter() {
            if (state.selectedSavedId <= 0) {
                return;
            }
            if (!window.confirm('Delete this saved filter?')) {
                return;
            }
            postJson(ajaxUrl + '?action=cohort.saved_filter', {
                csrf_token_form: csrfToken,
                operation: 'delete',
                id: state.selectedSavedId
            }).then(function (res) {
                var payload = apiPayload(res);
                if (!payload.success) {
                    window.alert(payload.message || 'Could not delete filter');
                    return;
                }
                state.selectedSavedId = 0;
                if (els.deleteFilter) {
                    els.deleteFilter.classList.add('d-none');
                }
                loadPresets();
            });
        }

        function populateVisitStates(states) {
            if (!els.visitStates || !states.length) {
                return;
            }
            states.forEach(function (stateName) {
                var opt = document.createElement('option');
                opt.value = stateName;
                opt.textContent = stateName.replace(/_/g, ' ');
                els.visitStates.appendChild(opt);
            });
        }

        function setMultiSelect(id, values) {
            var el = document.getElementById(id);
            if (!el || !values || !values.length) {
                return;
            }
            var wanted = values.reduce(function (acc, val) {
                acc[val] = true;
                return acc;
            }, {});
            Array.prototype.forEach.call(el.options, function (opt) {
                opt.selected = !!wanted[opt.value];
            });
        }

        function applyPreset() {
            var option = els.preset.options[els.preset.selectedIndex];
            if (!option || !option.dataset.filters) {
                return;
            }
            try {
                var filters = JSON.parse(option.dataset.filters);
                if (filters.completion_max !== undefined) {
                    document.getElementById('nc-registry-completion-max').value = filters.completion_max;
                }
                if (filters.age_today_min !== undefined && filters.age_today_min !== null) {
                    document.getElementById('nc-registry-age-min').value = filters.age_today_min;
                }
                if (filters.age_today_max !== undefined && filters.age_today_max !== null) {
                    document.getElementById('nc-registry-age-max').value = filters.age_today_max;
                }
                if (filters.condition_key) {
                    document.getElementById('nc-registry-condition-key').value = filters.condition_key;
                }
                if (filters.problem_title_contains) {
                    document.getElementById('nc-registry-problem-title').value = filters.problem_title_contains;
                }
                if (filters.recall_due) {
                    document.getElementById('nc-registry-recall-due').value = filters.recall_due;
                }
                if (filters.active_visit_today) {
                    document.getElementById('nc-registry-active-visit').value = filters.active_visit_today;
                }
                if (filters.record_status) {
                    document.getElementById('nc-registry-record-status').value = filters.record_status;
                }
                if (filters.visit_type_id) {
                    document.getElementById('nc-registry-visit-type').value = String(filters.visit_type_id);
                }
                if (filters.problem_title_contains) {
                    document.getElementById('nc-registry-problem-title').value = filters.problem_title_contains;
                }
                if (filters.icd_prefix) {
                    document.getElementById('nc-registry-icd-prefix').value = filters.icd_prefix;
                }
                if (filters.confirmation_source && els.confirmationSource) {
                    els.confirmationSource.value = filters.confirmation_source;
                }
                if (filters.lab_test_contains) {
                    document.getElementById('nc-registry-lab-test').value = filters.lab_test_contains;
                }
                if (filters.diagnosis_date_from) {
                    document.getElementById('nc-registry-diagnosis-from').value = filters.diagnosis_date_from;
                }
                if (filters.diagnosis_date_to) {
                    document.getElementById('nc-registry-diagnosis-to').value = filters.diagnosis_date_to;
                }
                if (filters.age_at_diagnosis_min !== undefined && filters.age_at_diagnosis_min !== null) {
                    document.getElementById('nc-registry-age-dx-min').value = filters.age_at_diagnosis_min;
                }
                if (filters.age_at_diagnosis_max !== undefined && filters.age_at_diagnosis_max !== null) {
                    document.getElementById('nc-registry-age-dx-max').value = filters.age_at_diagnosis_max;
                }
                if (filters.my_provider_today) {
                    document.getElementById('nc-registry-active-visit').value = 'yes';
                    state.myProviderToday = true;
                } else {
                    state.myProviderToday = false;
                }
                if (filters.visit_states) {
                    setMultiSelect('nc-registry-visit-states', filters.visit_states);
                }
                if (filters.visit_date_from) {
                    document.getElementById('nc-registry-visit-from').value = filters.visit_date_from;
                }
                if (filters.visit_date_to) {
                    document.getElementById('nc-registry-visit-to').value = filters.visit_date_to;
                }
                if (filters.last_visit_to) {
                    document.getElementById('nc-registry-last-visit-to').value = filters.last_visit_to;
                }
                state.page = 1;
                runSearch();
            } catch (e) {
                /* ignore */
            }
        }

        function clearFilters() {
            ['nc-registry-age-min', 'nc-registry-age-max', 'nc-registry-name', 'nc-registry-mrn',
                'nc-registry-national-id', 'nc-registry-nhis', 'nc-registry-phone',
                'nc-registry-completion-min', 'nc-registry-completion-max',
                'nc-registry-visit-from', 'nc-registry-visit-to',
                'nc-registry-last-visit-from', 'nc-registry-last-visit-to',
                'nc-registry-problem-title', 'nc-registry-icd-prefix', 'nc-registry-lab-test',
                'nc-registry-diagnosis-from', 'nc-registry-diagnosis-to',
                'nc-registry-age-dx-min', 'nc-registry-age-dx-max',
                'nc-registry-appointment-from', 'nc-registry-appointment-to',
                'nc-registry-recall-from', 'nc-registry-recall-to'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) {
                    el.value = '';
                }
            });
            document.getElementById('nc-registry-record-status').value = 'active_only';
            document.getElementById('nc-registry-sex').value = 'any';
            document.getElementById('nc-registry-active-visit').value = '';
            document.getElementById('nc-registry-payment').value = 'any';
            if (els.visitType) {
                els.visitType.value = '';
            }
            if (els.confirmationSource && els.confirmationSource.options.length) {
                els.confirmationSource.selectedIndex = 0;
            }
            if (els.conditionKey) {
                els.conditionKey.value = '';
            }
            document.getElementById('nc-registry-appointment-today').value = '';
            document.getElementById('nc-registry-recall-due').value = 'any';
            if (els.visitStates) {
                Array.prototype.forEach.call(els.visitStates.options, function (opt) {
                    opt.selected = false;
                });
            }
            if (els.preset) {
                els.preset.value = '';
            }
            state.selectedSavedId = 0;
            if (els.deleteFilter) {
                els.deleteFilter.classList.add('d-none');
            }
            state.myProviderToday = false;
        }

        function collectFilters() {
            function num(id) {
                var el = document.getElementById(id);
                var val = el ? el.value.trim() : '';
                return val === '' ? null : parseInt(val, 10);
            }
            function text(id) {
                var el = document.getElementById(id);
                var val = el ? el.value.trim() : '';
                return val === '' ? null : val;
            }
            function selectedVisitStates() {
                if (!els.visitStates) {
                    return null;
                }
                var selected = [];
                Array.prototype.forEach.call(els.visitStates.options, function (opt) {
                    if (opt.selected) {
                        selected.push(opt.value);
                    }
                });
                return selected.length ? selected : null;
            }

            function selectedVisitType() {
                if (!els.visitType) {
                    return null;
                }
                var val = els.visitType.value.trim();
                return val === '' ? null : parseInt(val, 10);
            }

            var filters = {
                record_status: document.getElementById('nc-registry-record-status').value,
                sex: document.getElementById('nc-registry-sex').value,
                age_today_min: num('nc-registry-age-min'),
                age_today_max: num('nc-registry-age-max'),
                name_contains: text('nc-registry-name'),
                mrn: text('nc-registry-mrn'),
                national_id: text('nc-registry-national-id'),
                nhis_number: text('nc-registry-nhis'),
                phone: text('nc-registry-phone'),
                completion_min: num('nc-registry-completion-min'),
                completion_max: num('nc-registry-completion-max'),
                active_visit_today: document.getElementById('nc-registry-active-visit').value || null,
                visit_states: selectedVisitStates(),
                visit_type_id: selectedVisitType(),
                visit_date_from: text('nc-registry-visit-from'),
                visit_date_to: text('nc-registry-visit-to'),
                payment_status: document.getElementById('nc-registry-payment').value,
                last_visit_from: text('nc-registry-last-visit-from'),
                last_visit_to: text('nc-registry-last-visit-to'),
                condition_key: els.conditionKey && els.conditionKey.value ? els.conditionKey.value : null,
                problem_title_contains: text('nc-registry-problem-title'),
                icd_prefix: text('nc-registry-icd-prefix'),
                lab_test_contains: text('nc-registry-lab-test'),
                confirmation_source: els.confirmationSource ? els.confirmationSource.value : null,
                age_at_diagnosis_min: num('nc-registry-age-dx-min'),
                age_at_diagnosis_max: num('nc-registry-age-dx-max'),
                diagnosis_date_from: text('nc-registry-diagnosis-from'),
                diagnosis_date_to: text('nc-registry-diagnosis-to'),
                appointment_today: document.getElementById('nc-registry-appointment-today').value || null,
                appointment_date_from: text('nc-registry-appointment-from'),
                appointment_date_to: text('nc-registry-appointment-to'),
                recall_due: document.getElementById('nc-registry-recall-due').value || 'any',
                recall_date_from: text('nc-registry-recall-from'),
                recall_date_to: text('nc-registry-recall-to')
            };

            if (state.myProviderToday) {
                filters.my_provider_today = true;
            }

            return filters;
        }

        function runSearch() {
            if (!els.rows) {
                return;
            }
            els.rows.innerHTML = '<tr><td colspan="7"><em>Searching…</em></td></tr>';
            postJson(ajaxUrl + '?action=cohort.search', {
                csrf_token_form: csrfToken,
                page: state.page,
                page_size: state.pageSize,
                sort: 'name_asc',
                filters: collectFilters()
            }).then(function (res) {
                var payload = apiPayload(res);
                if (!payload.success) {
                    els.rows.innerHTML = '<tr><td colspan="7" class="text-danger">' +
                        escapeHtml(payload.message || 'Search failed') + '</td></tr>';
                    return;
                }
                state.lastMeta = payload.data.meta || {};
                renderSummary(payload.data);
                renderRows(payload.data.rows || []);
                renderPagination(payload.data);
            });
        }

        function runExport() {
            if (!window.confirm('Export current filters to CSV (max 5,000 rows)?')) {
                return;
            }
            fetch(ajaxUrl + '?action=cohort.export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    csrf_token_form: csrfToken,
                    sort: 'name_asc',
                    filters: collectFilters()
                })
            }).then(function (res) {
                var contentType = res.headers.get('Content-Type') || '';
                if (!res.ok || contentType.indexOf('text/csv') === -1) {
                    return res.json().then(function (payload) {
                        window.alert((payload && payload.message) ? payload.message : 'Export failed');
                    }).catch(function () {
                        window.alert('Export failed');
                    });
                }
                var disposition = res.headers.get('Content-Disposition') || '';
                var filename = 'patient-registry.csv';
                var match = /filename="([^"]+)"/.exec(disposition);
                if (match) {
                    filename = match[1];
                }
                return res.blob().then(function (blob) {
                    var url = URL.createObjectURL(blob);
                    var anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = filename;
                    anchor.click();
                    URL.revokeObjectURL(url);
                });
            });
        }

        function renderSummary(data) {
            if (!els.summary) {
                return;
            }
            var meta = data.meta || {};
            var parts = [(data.total || 0) + ' patient(s) match'];
            if (meta.filter_summary) {
                parts.push(meta.filter_summary);
            }
            if (meta.excluded_missing_dob) {
                parts.push(meta.excluded_missing_dob + ' excluded (missing DOB for age-at-diagnosis)');
            }
            if (meta.query_ms !== undefined) {
                parts.push(meta.query_ms + ' ms');
            }
            els.summary.textContent = parts.join(' · ');
        }

        function renderRows(rows) {
            var hasClinical = rows.some(function (row) {
                return row.condition_summary || row.index_diagnosis_date;
            });
            var conditionHeader = document.querySelector('.oe-nc-registry-col-condition');
            if (conditionHeader) {
                conditionHeader.style.display = hasClinical ? '' : 'none';
            }
            if (!rows.length) {
                els.rows.innerHTML = '<tr><td colspan="7" class="text-muted"><em>No patients match these filters.</em></td></tr>';
                return;
            }
            els.rows.innerHTML = rows.map(function (row) {
                var chartUrl = row.chart_url || (chartBase + '?pid=' + encodeURIComponent(row.pid));
                var clinicalCell = '<td>' +
                    (hasClinical
                        ? escapeHtml(row.condition_summary || '—') +
                            (row.age_at_diagnosis != null ? ' <span class="text-muted">(' + row.age_at_diagnosis + 'y)</span>' : '')
                        : '—') +
                    '</td>';
                return '<tr>' +
                    '<td>' + escapeHtml(row.name) + '</td>' +
                    '<td>' + escapeHtml(row.age_today != null ? row.age_today : '—') + '</td>' +
                    '<td>' + escapeHtml(row.sex || '—') + '</td>' +
                    '<td>' + escapeHtml(row.mrn || '—') + '</td>' +
                    clinicalCell +
                    '<td>' + escapeHtml(row.completion_pct) + '%</td>' +
                    '<td class="text-right"><a class="btn btn-link btn-sm p-0" href="' + escapeHtml(chartUrl) +
                    '" target="_top">Open chart</a></td></tr>';
            }).join('');
        }

        function renderPagination(data) {
            if (!els.pagination) {
                return;
            }
            var total = data.total || 0;
            var page = data.page || 1;
            var pageSize = data.page_size || state.pageSize;
            if (total <= pageSize) {
                els.pagination.innerHTML = '';
                return;
            }
            var from = (page - 1) * pageSize + 1;
            var to = Math.min(page * pageSize, total);
            els.pagination.innerHTML =
                '<button type="button" class="btn btn-link btn-sm p-0" id="nc-registry-prev"' +
                (page <= 1 ? ' disabled' : '') + '>Prev</button>' +
                '<span class="small text-muted">' + from + '–' + to + ' of ' + total + '</span>' +
                '<button type="button" class="btn btn-link btn-sm p-0" id="nc-registry-next"' +
                (to >= total ? ' disabled' : '') + '>Next</button>';

            var prev = document.getElementById('nc-registry-prev');
            var next = document.getElementById('nc-registry-next');
            if (prev && !prev.disabled) {
                prev.addEventListener('click', function () {
                    state.page = Math.max(1, page - 1);
                    runSearch();
                });
            }
            if (next && !next.disabled) {
                next.addEventListener('click', function () {
                    state.page = page + 1;
                    runSearch();
                });
            }
        }
    }

    window.NewClinicPatientRegistry = { init: init };
}(window));

(function (window) {
    'use strict';

    var POLL_MS = 30000;
    var pollTimer = null;
    var pendingCancel = null;
    var pendingMarkUnpaid = null;

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

    function formatMoney(amount) {
        return Number(amount || 0).toFixed(2);
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
    }

    function renderVisits(visits) {
        return '<div class="row mb-3">' +
            '<div class="col-md-3"><div class="card text-center"><div class="card-body">' +
            '<div class="h3 mb-0">' + escapeHtml(visits.started) + '</div><div class="small text-muted">Started</div></div></div></div>' +
            '<div class="col-md-3"><div class="card text-center"><div class="card-body">' +
            '<div class="h3 mb-0">' + escapeHtml(visits.completed) + '</div><div class="small text-muted">Completed</div></div></div></div>' +
            '<div class="col-md-3"><div class="card text-center"><div class="card-body">' +
            '<div class="h3 mb-0">' + escapeHtml(visits.still_open) + '</div><div class="small text-muted">Still open</div></div></div></div>' +
            '<div class="col-md-3"><div class="card text-center"><div class="card-body">' +
            '<div class="h3 mb-0">' + escapeHtml(visits.cancelled) + '</div><div class="small text-muted">Cancelled</div></div></div></div>' +
            '</div>' +
            '<h5>By state</h5>' +
            renderStateTable(visits.by_state || {});
    }

    function renderStateTable(byState) {
        var keys = Object.keys(byState);
        if (!keys.length) {
            return '<div class="text-muted"><em>No visits on this date.</em></div>';
        }
        keys.sort();
        return '<table class="table table-sm table-bordered"><thead><tr><th>State</th><th>Count</th></tr></thead><tbody>' +
            keys.map(function (state) {
                return '<tr><td>' + escapeHtml(state) + '</td><td>' + escapeHtml(byState[state]) + '</td></tr>';
            }).join('') +
            '</tbody></table>';
    }

    function renderCash(cash) {
        return '<div class="row"><div class="col-md-4"><div class="card"><div class="card-body">' +
            '<div class="h4 mb-0">' + formatMoney(cash.total_collected) + '</div>' +
            '<div class="small text-muted">Total collected</div></div></div></div>' +
            '<div class="col-md-4"><div class="card"><div class="card-body">' +
            '<div class="h4 mb-0">' + escapeHtml(cash.receipt_count) + '</div>' +
            '<div class="small text-muted">Completed visits with payment</div></div></div></div></div>';
    }

    function formatWaitMinutes(minutes) {
        var total = parseInt(minutes, 10) || 0;
        if (total < 60) {
            return total + 'm';
        }
        var hours = Math.floor(total / 60);
        var mins = total % 60;
        return hours + 'h ' + String(mins).padStart(2, '0') + 'm';
    }

    function renderUnsignedAlerts(alerts) {
        alerts = alerts || {};
        var withDoctor = parseInt(alerts.with_doctor, 10) || 0;
        var readyPayment = parseInt(alerts.ready_for_payment, 10) || 0;
        if (!withDoctor && !readyPayment) {
            return '';
        }

        return '<div class="alert alert-warning py-2 mb-3">' +
            '<strong>Documentation gaps (unsigned)</strong><ul class="mb-0 pl-3">' +
            (withDoctor ? '<li>With doctor + unsigned note: ' + escapeHtml(withDoctor) + '</li>' : '') +
            (readyPayment ? '<li>Ready for payment + unsigned: ' + escapeHtml(readyPayment) + '</li>' : '') +
            '</ul></div>';
    }

    function renderEodOpen(root, summary, visits, unsignedAlerts) {
        if (!visits.length) {
            return renderUnsignedAlerts(unsignedAlerts) +
                '<div class="alert alert-success py-2">No open visits for this date.</div>';
        }

        var states = Object.keys(summary || {});
        var summaryHtml = renderUnsignedAlerts(unsignedAlerts) +
            '<h5 class="mb-2">By state</h5>' +
            '<table class="table table-sm table-bordered mb-3"><thead><tr>' +
            '<th>State</th><th>Count</th><th>Oldest wait</th></tr></thead><tbody>' +
            states.map(function (state) {
                var row = summary[state];
                return '<tr><td>' + escapeHtml(state) + '</td>' +
                    '<td>' + escapeHtml(row.count) + '</td>' +
                    '<td>' + escapeHtml(formatWaitMinutes(row.oldest_wait_minutes)) + '</td></tr>';
            }).join('') +
            '</tbody></table>';

        return summaryHtml + '<h5 class="mb-2">Open visit list</h5>' + renderOpenList(root, visits);
    }

    function renderUnpaidList(rows) {
        if (!rows.length) {
            return '<div class="text-muted"><em>No unpaid visits on this date.</em></div>';
        }

        var body = rows.map(function (row) {
            return '<tr><td>#' + escapeHtml(row.queue_number) + ' ' + escapeHtml(row.display_name) + '</td>' +
                '<td>' + formatMoney(row.charges_total) + '</td>' +
                '<td>' + escapeHtml(row.unpaid_reason || '—') + '</td>' +
                '<td>' + escapeHtml(row.left_unpaid_at || '—') + '</td></tr>';
        }).join('');

        return '<table class="table table-sm table-bordered"><thead><tr>' +
            '<th>Patient</th><th>Charges</th><th>Reason</th><th>Marked at</th></tr></thead><tbody>' +
            body + '</tbody></table>';
    }

    function renderDataQuality(quality) {
        quality = quality || {};
        var buckets = quality.completion_buckets || {};
        var stale = quality.stale_incomplete || [];
        var threshold = quality.billing_threshold || 70;

        var staleHtml = !stale.length
            ? '<div class="text-muted"><em>No patients below billing threshold on visits today.</em></div>'
            : '<table class="table table-sm table-bordered"><thead><tr>' +
                '<th>Patient</th><th>MRN</th><th>Score</th></tr></thead><tbody>' +
                stale.map(function (row) {
                    return '<tr><td>' + escapeHtml(row.display_name) + '</td>' +
                        '<td>' + escapeHtml(row.pubpid) + '</td>' +
                        '<td>' + escapeHtml(row.completion_score) + '%</td></tr>';
                }).join('') +
                '</tbody></table>';

        return '<div class="row mb-3">' +
            '<div class="col-md-4"><div class="card text-center"><div class="card-body">' +
            '<div class="h3 mb-0">' + escapeHtml(quality.patients_registered_today || 0) + '</div>' +
            '<div class="small text-muted">Patients registered today</div></div></div></div>' +
            '<div class="col-md-4"><div class="card text-center"><div class="card-body">' +
            '<div class="h3 mb-0">' + escapeHtml(quality.dup_overrides_today || 0) + '</div>' +
            '<div class="small text-muted">Duplicate overrides today</div></div></div></div>' +
            '<div class="col-md-4"><div class="card text-center"><div class="card-body">' +
            '<div class="h3 mb-0">' + escapeHtml(threshold) + '%</div>' +
            '<div class="small text-muted">Billing completion threshold</div></div></div></div>' +
            '</div>' +
            '<h5>New registrations today — completion buckets</h5>' +
            '<table class="table table-sm table-bordered mb-3"><thead><tr>' +
            '<th>&lt; 40%</th><th>40–69%</th><th>70–99%</th><th>100%</th></tr></thead><tbody><tr>' +
            '<td>' + escapeHtml(buckets.under_40 || 0) + '</td>' +
            '<td>' + escapeHtml(buckets.from_40_to_69 || 0) + '</td>' +
            '<td>' + escapeHtml(buckets.from_70_to_99 || 0) + '</td>' +
            '<td>' + escapeHtml(buckets.complete_100 || 0) + '</td>' +
            '</tr></tbody></table>' +
            '<h5>Visits today below ' + escapeHtml(threshold) + '% completion</h5>' +
            staleHtml;
    }

    function renderUnsignedList(root, visits) {
        if (!visits.length) {
            return '<div class="text-muted"><em>No unsigned documentation on this date.</em></div>';
        }

        var rows = visits.map(function (row) {
            return '<tr><td>#' + escapeHtml(row.queue_number) + ' ' + escapeHtml(row.display_name) + '</td>' +
                '<td>' + escapeHtml(row.state) + '</td>' +
                '<td>' + escapeHtml(row.provider_name || '—') + '</td>' +
                '<td>' + escapeHtml(row.hours_unsigned) + 'h</td>' +
                '<td>' + escapeHtml(row.service_profile || 'full_opd') + '</td>' +
                '<td class="text-nowrap">' +
                '<a class="btn btn-sm btn-outline-primary mr-1" href="' + escapeHtml(row.encounter_url) +
                '" target="_blank" rel="noopener noreferrer">Encounter</a>' +
                '<a class="btn btn-sm btn-outline-secondary" href="' +
                escapeHtml(root.dataset.visitBoardUrl) + ' target="_top">Visit Board</a>' +
                '</td></tr>';
        }).join('');

        return '<table class="table table-sm table-bordered"><thead><tr>' +
            '<th>Patient</th><th>State</th><th>Doctor</th><th>Hours unsigned</th><th>Profile</th><th>Actions</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function renderOpenList(root, visits) {
        if (!visits.length) {
            return '<div class="alert alert-success py-2">No open visits for this date.</div>';
        }

        var canCancel = root.dataset.canCancel === '1';
        var canMarkUnpaid = root.dataset.canMarkUnpaid === '1';
        var rows = visits.map(function (row) {
            var actions = '<a class="btn btn-sm btn-outline-secondary mr-1" href="' +
                escapeHtml(root.dataset.visitBoardUrl) + ' target="_top">Visit Board</a>';
            if (canMarkUnpaid && row.state === 'ready_for_payment') {
                actions += '<button type="button" class="btn btn-sm btn-outline-warning mr-1 nc-reports-mark-unpaid" ' +
                    'data-visit-id="' + escapeHtml(row.id) + '" ' +
                    'data-row-version="' + escapeHtml(row.row_version) + '" ' +
                    'data-display-name="' + escapeHtml(row.display_name) + '" ' +
                    'data-pubpid="' + escapeHtml(row.pubpid) + '">Mark unpaid</button>';
            }
            if (canCancel) {
                actions += '<button type="button" class="btn btn-sm btn-outline-danger nc-reports-cancel" ' +
                    'data-visit-id="' + escapeHtml(row.id) + '" ' +
                    'data-row-version="' + escapeHtml(row.row_version) + '" ' +
                    'data-display-name="' + escapeHtml(row.display_name) + '" ' +
                    'data-pubpid="' + escapeHtml(row.pubpid) + '">Cancel</button>';
            }
            return '<tr><td>#' + escapeHtml(row.queue_number) + ' ' + escapeHtml(row.display_name) + '</td>' +
                '<td>' + escapeHtml(row.state) + '</td>' +
                '<td>' + escapeHtml(row.wait_minutes) + 'm</td>' +
                '<td class="text-nowrap">' + actions + '</td></tr>';
        }).join('');

        return '<table class="table table-sm table-bordered"><thead><tr>' +
            '<th>Patient</th><th>State</th><th>Age</th><th>Actions</th></tr></thead><tbody>' +
            rows + '</tbody></table>';
    }

    function renderBypassList(entries) {
        if (!entries.length) {
            return '<div class="text-muted"><em>No lab or pharmacy queue bypasses on this date.</em></div>';
        }

        var rows = entries.map(function (row) {
            return '<tr><td>#' + escapeHtml(row.queue_number) + ' ' + escapeHtml(row.display_name) + '</td>' +
                '<td>' + escapeHtml(row.bypass_type) + '</td>' +
                '<td>' + escapeHtml(row.from_state) + '</td>' +
                '<td>' + escapeHtml(row.reason) + '</td>' +
                '<td>' + escapeHtml(row.actor_name || '—') + '</td></tr>';
        }).join('');

        return '<table class="table table-sm table-bordered"><thead><tr>' +
            '<th>Patient</th><th>Queue</th><th>From</th><th>Reason</th><th>By</th></tr></thead><tbody>' +
            rows + '</tbody></table>';
    }

    function bindOpenActions(root) {
        root.querySelectorAll('.nc-reports-mark-unpaid').forEach(function (btn) {
            btn.addEventListener('click', function () {
                pendingMarkUnpaid = {
                    visit_id: parseInt(btn.getAttribute('data-visit-id') || '0', 10),
                    row_version: parseInt(btn.getAttribute('data-row-version') || '0', 10),
                    display_name: btn.getAttribute('data-display-name') || '',
                    pubpid: btn.getAttribute('data-pubpid') || ''
                };
                var modal = document.getElementById('nc-reports-mark-unpaid-modal');
                var backdrop = document.getElementById('nc-reports-modal-backdrop');
                document.getElementById('nc-reports-mark-unpaid-patient').textContent =
                    pendingMarkUnpaid.display_name + ' · MRN ' + pendingMarkUnpaid.pubpid;
                document.getElementById('nc-reports-mark-unpaid-reason').value = '';
                document.getElementById('nc-reports-mark-unpaid-error').classList.add('d-none');
                showModal(modal, backdrop);
            });
        });

        root.querySelectorAll('.nc-reports-cancel').forEach(function (btn) {
            btn.addEventListener('click', function () {
                pendingCancel = {
                    visit_id: parseInt(btn.getAttribute('data-visit-id') || '0', 10),
                    row_version: parseInt(btn.getAttribute('data-row-version') || '0', 10),
                    display_name: btn.getAttribute('data-display-name') || '',
                    pubpid: btn.getAttribute('data-pubpid') || ''
                };
                var modal = document.getElementById('nc-reports-cancel-modal');
                var backdrop = document.getElementById('nc-reports-modal-backdrop');
                document.getElementById('nc-reports-cancel-patient').textContent =
                    pendingCancel.display_name + ' · MRN ' + pendingCancel.pubpid;
                document.getElementById('nc-reports-cancel-reason').value = '';
                document.getElementById('nc-reports-cancel-error').classList.add('d-none');
                showModal(modal, backdrop);
            });
        });
    }

    function confirmMarkUnpaid(root) {
        if (!pendingMarkUnpaid) {
            return;
        }
        var reason = document.getElementById('nc-reports-mark-unpaid-reason').value.trim();
        var errorEl = document.getElementById('nc-reports-mark-unpaid-error');
        if (!reason) {
            errorEl.textContent = 'Reason is required';
            errorEl.classList.remove('d-none');
            return;
        }

        postJson(root.dataset.ajaxUrl + '?action=cashier.mark_unpaid', {
            visit_id: pendingMarkUnpaid.visit_id,
            row_version: pendingMarkUnpaid.row_version,
            reason: reason,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                var handled = window.NewClinicUI && window.NewClinicUI.handleVisitConflictUi(result, {
                    onStaleVisit: function (conflict) {
                        errorEl.textContent = conflict.message || 'Another user updated this visit first. Refreshing report…';
                        errorEl.classList.remove('d-none');
                    },
                    onRefresh: function () {
                        hideModal(
                            document.getElementById('nc-reports-mark-unpaid-modal'),
                            document.getElementById('nc-reports-modal-backdrop')
                        );
                        pendingMarkUnpaid = null;
                        loadReport(root);
                    }
                });
                if (handled) {
                    return;
                }
                errorEl.textContent = result.payload.message || 'Mark unpaid failed';
                errorEl.classList.remove('d-none');
                return;
            }

            hideModal(
                document.getElementById('nc-reports-mark-unpaid-modal'),
                document.getElementById('nc-reports-modal-backdrop')
            );
            pendingMarkUnpaid = null;
            loadReport(root);
        });
    }

    function confirmCancel(root) {
        if (!pendingCancel) {
            return;
        }
        var reason = document.getElementById('nc-reports-cancel-reason').value.trim();
        var errorEl = document.getElementById('nc-reports-cancel-error');
        if (!reason) {
            errorEl.textContent = 'Reason is required';
            errorEl.classList.remove('d-none');
            return;
        }

        postJson(root.dataset.ajaxUrl + '?action=visit.cancel', {
            visit_id: pendingCancel.visit_id,
            row_version: pendingCancel.row_version,
            reason: reason,
            csrf_token_form: root.dataset.csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                var handled = window.NewClinicUI && window.NewClinicUI.handleVisitConflictUi(result, {
                    onStaleVisit: function (conflict) {
                        errorEl.textContent = conflict.message || 'Another user updated this visit first. Refreshing report…';
                        errorEl.classList.remove('d-none');
                    },
                    onRefresh: function () {
                        hideModal(
                            document.getElementById('nc-reports-cancel-modal'),
                            document.getElementById('nc-reports-modal-backdrop')
                        );
                        pendingCancel = null;
                        loadReport(root);
                    }
                });
                if (handled) {
                    return;
                }
                errorEl.textContent = result.payload.message || 'Cancel failed';
                errorEl.classList.remove('d-none');
                return;
            }

            hideModal(
                document.getElementById('nc-reports-cancel-modal'),
                document.getElementById('nc-reports-modal-backdrop')
            );
            pendingCancel = null;
            loadReport(root);
        });
    }

    function reportError(message) {
        var html = '<div class="alert alert-danger">' + escapeHtml(message) + '</div>';
        [
            'nc-reports-visits',
            'nc-reports-cash',
            'nc-reports-open',
            'nc-reports-unpaid',
            'nc-reports-quality',
            'nc-reports-unsigned',
            'nc-reports-bypass'
        ].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) {
                el.innerHTML = html;
            }
        });
    }

    function loadReport(root) {
        var date = document.getElementById('nc-reports-date').value;
        var facilitySuffix = (window.NewClinicUI && window.NewClinicUI.facilityQuerySuffix)
            ? window.NewClinicUI.facilityQuerySuffix(root)
            : '';
        var url = root.dataset.ajaxUrl + '?action=reports.daily&visit_date=' +
            encodeURIComponent(date) + facilitySuffix;

        return getJson(url).then(function (result) {
            if (!result.payload.success) {
                reportError(result.payload.message || 'Load failed');
                return;
            }

            var data = result.payload.data || {};
            document.getElementById('nc-reports-updated').textContent =
                'Updated ' + new Date().toLocaleTimeString();
            document.getElementById('nc-reports-visits').innerHTML = renderVisits(data.visits || {});
            document.getElementById('nc-reports-cash').innerHTML = renderCash(data.cash || {});
            document.getElementById('nc-reports-open').innerHTML =
                renderEodOpen(root, data.eod_open || {}, data.open_visits || [], data.unsigned_alerts || {});
            document.getElementById('nc-reports-unpaid').innerHTML =
                renderUnpaidList(data.unpaid_visits || []);
            document.getElementById('nc-reports-quality').innerHTML =
                renderDataQuality(data.data_quality || {});
            document.getElementById('nc-reports-unsigned').innerHTML =
                renderUnsignedList(root, data.unsigned_visits || []);
            document.getElementById('nc-reports-bypass').innerHTML =
                renderBypassList(data.queue_bypass || []);
            bindOpenActions(root);
        }).catch(function () {
            reportError('Failed to load report — check your connection and refresh.');
        });
    }

    function isEodTabVisible() {
        var pane = document.getElementById('nc-reports-tab-open');
        return pane && pane.classList.contains('active');
    }

    function schedulePoll(root) {
        window.clearInterval(pollTimer);
        pollTimer = window.setInterval(function () {
            if (document.hidden || !isEodTabVisible()) {
                return;
            }
            loadReport(root);
        }, POLL_MS);
    }

    function init(root) {
        if (!root) {
            return;
        }

        var dateInput = document.getElementById('nc-reports-date');
        var dateParam = new URL(window.location.href).searchParams.get('date');
        dateInput.value = dateParam || (window.NewClinicUI && window.NewClinicUI.localDateString
            ? window.NewClinicUI.localDateString()
            : new Date().toLocaleDateString('en-CA'));
        loadReport(root);
        schedulePoll(root);

        if (window.NewClinicUI && window.NewClinicUI.bindBootstrapTabUrlState) {
            window.NewClinicUI.bindBootstrapTabUrlState({
                tabSelector: '#nc-reports-desk [data-toggle="tab"]',
                panePrefix: 'nc-reports-tab-',
                defaultTab: 'visits'
            });
        }

        document.querySelector('[href="#nc-reports-tab-open"]').addEventListener('click', function () {
            window.setTimeout(function () {
                loadReport(root);
            }, 0);
        });

        document.getElementById('nc-reports-refresh').addEventListener('click', function () {
            loadReport(root);
        });
        dateInput.addEventListener('change', function () {
            var url = new URL(window.location.href);
            url.searchParams.set('date', dateInput.value);
            window.history.replaceState({}, '', url.toString());
            loadReport(root);
        });

        document.getElementById('nc-reports-cancel-confirm').addEventListener('click', function () {
            confirmCancel(root);
        });
        document.getElementById('nc-reports-mark-unpaid-confirm').addEventListener('click', function () {
            confirmMarkUnpaid(root);
        });

        var modal = document.getElementById('nc-reports-cancel-modal');
        var markUnpaidModal = document.getElementById('nc-reports-mark-unpaid-modal');
        var backdrop = document.getElementById('nc-reports-modal-backdrop');
        if (modal && backdrop) {
            modal.querySelectorAll('.nc-modal-close').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    hideModal(modal, backdrop);
                });
            });
        }
        if (markUnpaidModal && backdrop) {
            markUnpaidModal.querySelectorAll('.nc-modal-close').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    hideModal(markUnpaidModal, backdrop);
                });
            });
        }
    }

    window.NewClinicReports = { init: init };
})(window);

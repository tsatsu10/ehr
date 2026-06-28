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

    function formatMoney(symbol, amount) {
        return escapeHtml(symbol || '') + Number(amount || 0).toFixed(2);
    }

    function renderRow(row, symbol) {
        var visitLabel = row.queue_number
            ? '#' + escapeHtml(row.queue_number) + (row.visit_date ? ' · ' + escapeHtml(row.visit_date) : '')
            : '—';

        return '<tr>' +
            '<td><strong>' + escapeHtml(row.receipt_number || '—') + '</strong></td>' +
            '<td>' + escapeHtml(row.paid_at_label || '—') + '</td>' +
            '<td>' + formatMoney(symbol, row.amount_paid) + '</td>' +
            '<td>' + visitLabel + '</td>' +
            '<td class="text-muted small">' + escapeHtml(row.cashier || '—') + '</td>' +
            '</tr>';
    }

    function renderPane(container, payload) {
        var rows = payload.rows || [];
        var symbol = payload.currency_symbol || '';

        if (!rows.length) {
            container.innerHTML = '<p class="text-muted mb-0">' +
                escapeHtml('No receipts recorded for this patient.') + '</p>';
            return;
        }

        var loadMore = payload.has_more
            ? '<button type="button" class="btn btn-outline-secondary btn-sm mt-2" ' +
            'data-action="load-more-payments">' + escapeHtml('Load more') + '</button>'
            : '';

        container.innerHTML =
            '<div class="table-responsive">' +
            '<table class="table table-sm mb-0">' +
            '<thead><tr>' +
            '<th>' + escapeHtml('Receipt') + '</th>' +
            '<th>' + escapeHtml('Paid') + '</th>' +
            '<th>' + escapeHtml('Amount') + '</th>' +
            '<th>' + escapeHtml('Visit') + '</th>' +
            '<th>' + escapeHtml('Cashier') + '</th>' +
            '</tr></thead>' +
            '<tbody id="nc-payments-rows">' +
            rows.map(function (row) { return renderRow(row, symbol); }).join('') +
            '</tbody></table></div>' +
            loadMore;
    }

    function appendRows(container, rows, symbol) {
        var body = container.querySelector('#nc-payments-rows');
        if (!body || !rows || !rows.length) {
            return;
        }
        rows.forEach(function (row) {
            body.insertAdjacentHTML('beforeend', renderRow(row, symbol));
        });
    }

    function init(options) {
        var root = options.root;
        if (!root) {
            return;
        }

        var pid = parseInt(root.dataset.pid, 10);
        var visitId = parseInt(root.dataset.visitId, 10) || 0;
        var ajaxUrl = options.ajaxUrl;
        var listEl = root.querySelector('#nc-payments-list');
        var offset = 0;
        var hasMore = false;
        var currencySymbol = '';

        function buildUrl() {
            var url = ajaxUrl + '?action=chart_depth.payments_list&pid=' + encodeURIComponent(pid) +
                '&offset=' + encodeURIComponent(String(offset));
            if (visitId > 0) {
                url += '&visit_id=' + encodeURIComponent(String(visitId));
            }
            return url;
        }

        function load(reset) {
            if (!listEl) {
                return Promise.resolve();
            }
            if (reset) {
                offset = 0;
                listEl.innerHTML = '<em>' + escapeHtml('Loading payments…') + '</em>';
            }

            return getJson(buildUrl())
                .then(function (result) {
                    var payload = result.payload;
                    if (!payload.success) {
                        throw new Error(payload.message || 'Failed');
                    }
                    var data = payload.data || {};
                    currencySymbol = data.currency_symbol || currencySymbol;
                    hasMore = !!data.has_more;
                    offset = (data.offset || 0) + (data.rows || []).length;

                    if (reset) {
                        renderPane(listEl, data);
                    } else {
                        appendRows(listEl, data.rows || [], currencySymbol);
                        var moreBtn = listEl.querySelector('[data-action="load-more-payments"]');
                        if (moreBtn) {
                            moreBtn.remove();
                        }
                        if (hasMore) {
                            listEl.insertAdjacentHTML('beforeend',
                                '<button type="button" class="btn btn-outline-secondary btn-sm mt-2" ' +
                                'data-action="load-more-payments">' + escapeHtml('Load more') + '</button>');
                        }
                    }
                })
                .catch(function () {
                    if (reset) {
                        listEl.innerHTML = '<div class="alert alert-danger">' +
                            escapeHtml('Could not load payment history.') + '</div>';
                    }
                });
        }

        if (listEl) {
            listEl.addEventListener('click', function (event) {
                var btn = event.target.closest('[data-action="load-more-payments"]');
                if (!btn) {
                    return;
                }
                btn.disabled = true;
                load(false).finally(function () {
                    btn.disabled = false;
                });
            });
        }

        if (window.NewClinicUI && window.NewClinicUI.mountCompletionBanner) {
            window.NewClinicUI.mountCompletionBanner({
                pid: pid,
                ajaxUrl: ajaxUrl,
                csrfToken: document.body.getAttribute('data-csrf-token') || '',
                slot: root.querySelector('#nc-chart-depth-banner')
            });
        }

        load(true);
    }

    window.NewClinicChartDepthPayments = { init: init };
}(window));

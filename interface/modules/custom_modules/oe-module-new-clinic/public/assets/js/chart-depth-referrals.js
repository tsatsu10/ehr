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

    function renderRow(item) {
        var actions = '';
        if (item.print_url) {
            actions += '<a class="btn btn-sm btn-outline-secondary mr-1" href="' +
                escapeHtml(item.print_url) + '" target="_top">' + escapeHtml('Print') + '</a>';
        }
        if (item.edit_url) {
            actions += '<a class="btn btn-sm btn-outline-primary" href="' +
                escapeHtml(item.edit_url) + '" target="_top">' + escapeHtml('Edit') + '</a>';
        }

        return '<tr>' +
            '<td><strong>' + escapeHtml(item.label || 'Referral') + '</strong>' +
            '<div class="small text-muted">' + escapeHtml(item.author || '—') + '</div></td>' +
            '<td>' + escapeHtml(item.status || '—') + '</td>' +
            '<td>' + escapeHtml(item.occurred_at || '—') + '</td>' +
            '<td class="text-right">' + actions + '</td>' +
            '</tr>';
    }

    function renderPane(container, actionsEl, payload) {
        var rows = payload.items || [];
        if (actionsEl) {
            actionsEl.innerHTML = payload.can_create_referral && payload.create_referral_url
                ? '<a class="btn btn-sm btn-primary" href="' +
                escapeHtml(payload.create_referral_url) + '" target="_top">' +
                escapeHtml('New referral') + '</a>'
                : '';
        }

        if (!rows.length) {
            container.innerHTML = '<p class="text-muted mb-0">' +
                escapeHtml('No referrals for this filter.') + '</p>';
            return;
        }

        var loadMore = payload.has_more
            ? '<button type="button" class="btn btn-outline-secondary btn-sm mt-2" ' +
            'data-action="load-more-referrals">' + escapeHtml('Load more') + '</button>'
            : '';

        container.innerHTML =
            '<div class="table-responsive">' +
            '<table class="table table-sm mb-0">' +
            '<thead><tr>' +
            '<th>' + escapeHtml('Destination') + '</th>' +
            '<th>' + escapeHtml('Status') + '</th>' +
            '<th>' + escapeHtml('Date') + '</th>' +
            '<th></th>' +
            '</tr></thead>' +
            '<tbody id="nc-referrals-rows">' +
            rows.map(renderRow).join('') +
            '</tbody></table></div>' + loadMore;
    }

    function appendRows(container, rows) {
        var body = container.querySelector('#nc-referrals-rows');
        if (!body || !rows || !rows.length) {
            return;
        }
        rows.forEach(function (row) {
            body.insertAdjacentHTML('beforeend', renderRow(row));
        });
    }

    function init(options) {
        var root = options.root;
        if (!root) {
            return;
        }

        var pid = parseInt(root.dataset.pid, 10);
        var encounterId = parseInt(root.dataset.encounterId, 10) || 0;
        var ajaxUrl = options.ajaxUrl;
        var listEl = root.querySelector('#nc-referrals-list');
        var actionsEl = root.querySelector('#nc-referrals-actions');
        var offset = 0;
        var hasMore = false;

        function buildUrl() {
            var url = ajaxUrl + '?action=chart_depth.referrals_list&pid=' + encodeURIComponent(pid) +
                '&offset=' + encodeURIComponent(String(offset));
            if (encounterId > 0) {
                url += '&encounter_id=' + encodeURIComponent(String(encounterId));
            }
            return url;
        }

        function load(reset) {
            if (!listEl) {
                return Promise.resolve();
            }
            if (reset) {
                offset = 0;
                listEl.innerHTML = '<em>' + escapeHtml('Loading referrals…') + '</em>';
            }

            return getJson(buildUrl())
                .then(function (result) {
                    var payload = result.payload;
                    if (!payload.success) {
                        throw new Error(payload.message || 'Failed');
                    }
                    var data = payload.data || {};
                    hasMore = !!data.has_more;
                    offset = (data.offset || 0) + (data.items || []).length;
                    if (reset) {
                        renderPane(listEl, actionsEl, data);
                    } else {
                        appendRows(listEl, data.items || []);
                        var moreBtn = listEl.querySelector('[data-action="load-more-referrals"]');
                        if (moreBtn) {
                            moreBtn.remove();
                        }
                        if (hasMore) {
                            listEl.insertAdjacentHTML('beforeend',
                                '<button type="button" class="btn btn-outline-secondary btn-sm mt-2" ' +
                                'data-action="load-more-referrals">' + escapeHtml('Load more') + '</button>');
                        }
                    }
                })
                .catch(function () {
                    if (reset) {
                        listEl.innerHTML = '<div class="alert alert-danger">' +
                            escapeHtml('Could not load referrals.') + '</div>';
                    }
                });
        }

        if (listEl) {
            listEl.addEventListener('click', function (event) {
                var btn = event.target.closest('[data-action="load-more-referrals"]');
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

    window.NewClinicChartDepthReferrals = { init: init };
}(window));

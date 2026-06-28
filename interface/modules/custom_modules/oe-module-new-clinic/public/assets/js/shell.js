/**
 * T1 shell — mobile nav, queue stats refresh, role switch
 */
(function (window) {
    'use strict';

    var REFRESH_MS = 30000;

    function init(root) {
        if (!root) {
            return;
        }

        var ajaxUrl = root.getAttribute('data-ajax-url');
        var csrfToken = root.getAttribute('data-csrf-token');
        bindNavToggle(root);
        bindRoleSwitch(root, ajaxUrl, csrfToken);
        if (window.NewClinicUI && window.NewClinicUI.bindCompletionBannerActions) {
            window.NewClinicUI.bindCompletionBannerActions(root);
        }
        refreshQueueStats(root, ajaxUrl);
        window.setInterval(function () {
            refreshQueueStats(root, ajaxUrl);
        }, REFRESH_MS);
    }

    function bindNavToggle(root) {
        var nav = root.querySelector('.oe-nc-module-nav');
        var toggle = root.querySelector('.oe-nc-module-nav__toggle');
        if (!nav || !toggle) {
            return;
        }

        toggle.addEventListener('click', function () {
            var open = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    function bindRoleSwitch(root, ajaxUrl, csrfToken) {
        var modal = document.getElementById('oe-nc-role-picker-modal');
        if (!modal) {
            return;
        }

        modal.querySelectorAll('[data-role-aco]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var role = btn.getAttribute('data-role-aco');
                if (!role) {
                    return;
                }

                btn.disabled = true;
                window.NewClinicUI.postJson(ajaxUrl + '?action=switch_role', {
                    csrf_token_form: csrfToken,
                    role: role
                })
                    .then(function (result) {
                        var payload = result.payload;
                        if (payload.success && payload.data && payload.data.redirect_url) {
                            window.location.href = payload.data.redirect_url;
                            return;
                        }
                        btn.disabled = false;
                        window.alert(payload.message || 'Could not switch role');
                    })
                    .catch(function () {
                        btn.disabled = false;
                        window.alert('Network error — try again');
                    });
            });
        });
    }

    function refreshQueueStats(root, ajaxUrl) {
        var strip = root.querySelector('.oe-nc-queue-stats');
        if (!strip || !ajaxUrl) {
            return;
        }

        var suffix = window.NewClinicUI ? window.NewClinicUI.facilityQuerySuffix(root) : '';
        var url = ajaxUrl + '?action=queue.counts' + suffix;
        window.NewClinicUI.getJson(url)
            .then(function (result) {
                var payload = result.payload;
                if (!payload.success || !payload.data || !payload.data.counts) {
                    return;
                }
                updateCounts(strip, payload.data.counts);
            })
            .catch(function () {
                /* non-blocking */
            });
    }

    function updateCounts(strip, counts) {
        strip.querySelectorAll('[data-stat-key]').forEach(function (el) {
            var key = el.getAttribute('data-stat-key');
            if (!key || typeof counts[key] === 'undefined') {
                return;
            }
            var countEl = el.querySelector('.oe-nc-queue-stats__count');
            if (countEl) {
                countEl.textContent = String(counts[key]);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        init(document.getElementById('oe-nc-t1'));
    });

    window.NewClinicShell = { init: init };
}(window));

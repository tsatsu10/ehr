/**
 * T1 shell — sidebar collapse, mobile drawer, nav badge refresh, role switch
 */
(function (window) {
    'use strict';

    var REFRESH_MS = 30000;
    var SIDEBAR_COLLAPSED_KEY = 'oe-nc-sidebar-collapsed';

    function init(root) {
        if (!root) {
            return;
        }

        var ajaxUrl = root.getAttribute('data-ajax-url');
        bindSidebar(root);
        bindRoleSwitch(root, ajaxUrl);
        if (window.NewClinicUI && window.NewClinicUI.bindCompletionBannerActions) {
            window.NewClinicUI.bindCompletionBannerActions(root);
        }
        refreshQueueCounts(root, ajaxUrl);
        window.setInterval(function () {
            refreshQueueCounts(root, ajaxUrl);
        }, REFRESH_MS);
    }

    function bindSidebar(root) {
        var sidebar = root.querySelector('.oe-nc-sidebar');
        if (!sidebar) {
            return;
        }

        var backdrop = document.getElementById('oe-nc-sidebar-backdrop');
        var openBtn = document.getElementById('oe-nc-sidebar-open');
        var closeBtn = document.getElementById('oe-nc-sidebar-close');
        var collapseBtn = document.getElementById('oe-nc-sidebar-collapse');

        applyCollapsedState(root);

        function openMobile() {
            sidebar.classList.add('is-open');
            if (backdrop) {
                backdrop.hidden = false;
                backdrop.setAttribute('aria-hidden', 'false');
            }
            if (openBtn) {
                openBtn.setAttribute('aria-expanded', 'true');
            }
            document.body.classList.add('oe-nc-sidebar-mobile-open');
        }

        function closeMobile() {
            sidebar.classList.remove('is-open');
            if (backdrop) {
                backdrop.hidden = true;
                backdrop.setAttribute('aria-hidden', 'true');
            }
            if (openBtn) {
                openBtn.setAttribute('aria-expanded', 'false');
            }
            document.body.classList.remove('oe-nc-sidebar-mobile-open');
        }

        if (openBtn) {
            openBtn.addEventListener('click', openMobile);
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', closeMobile);
        }

        if (backdrop) {
            backdrop.addEventListener('click', closeMobile);
        }

        sidebar.querySelectorAll('.oe-nc-sidebar__link').forEach(function (link) {
            link.addEventListener('click', function () {
                if (window.matchMedia('(max-width: 991.98px)').matches) {
                    closeMobile();
                }
            });
        });

        if (collapseBtn) {
            collapseBtn.addEventListener('click', function () {
                var collapsed = root.classList.toggle('oe-nc-t1--sidebar-collapsed');
                collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                collapseBtn.setAttribute(
                    'aria-label',
                    collapsed ? 'Expand sidebar' : 'Collapse sidebar'
                );
                try {
                    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
                } catch (e) {
                    /* ignore */
                }
            });
        }

        window.addEventListener('resize', function () {
            if (window.matchMedia('(min-width: 992px)').matches) {
                closeMobile();
            }
        });
    }

    function applyCollapsedState(root) {
        var collapseBtn = document.getElementById('oe-nc-sidebar-collapse');
        var collapsed = false;

        try {
            collapsed = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
        } catch (e) {
            collapsed = false;
        }

        if (collapsed) {
            root.classList.add('oe-nc-t1--sidebar-collapsed');
        }

        if (collapseBtn) {
            collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            collapseBtn.setAttribute(
                'aria-label',
                collapsed ? 'Expand sidebar' : 'Collapse sidebar'
            );
        }
    }

    function hideProfileDropdown() {
        var trigger = document.getElementById('oe-nc-role-pill');
        if (!trigger) {
            return;
        }
        if (window.jQuery) {
            window.jQuery(trigger).dropdown('hide');
            return;
        }
        trigger.setAttribute('aria-expanded', 'false');
        var menu = trigger.parentElement && trigger.parentElement.querySelector('.dropdown-menu');
        if (menu) {
            menu.classList.remove('show');
        }
    }

    function showModal(modal) {
        if (!modal) {
            return false;
        }
        if (window.jQuery) {
            window.jQuery(modal).modal('show');
            return true;
        }
        return false;
    }

    function bindRoleSwitch(root, ajaxUrl) {
        if (!ajaxUrl) {
            return;
        }

        var errorEl = root.querySelector('#oe-nc-role-switch-error');
        var confirmModal = document.getElementById('oe-nc-role-confirm-modal');
        var confirmMessageEl = document.getElementById('oe-nc-role-confirm-message');
        var confirmDeskEl = document.getElementById('oe-nc-role-confirm-desk');
        var confirmBtn = document.getElementById('oe-nc-role-confirm-btn');
        var pending = null;

        function showRoleError(message) {
            if (!errorEl) {
                window.alert(message);
                return;
            }
            errorEl.textContent = message;
            errorEl.classList.remove('d-none');
        }

        function clearRoleError() {
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.classList.add('d-none');
            }
        }

        function executeSwitch(role, sourceBtn) {
            clearRoleError();
            var csrfToken = root.getAttribute('data-csrf-token') || '';
            if (!csrfToken) {
                showRoleError('Session security token missing. Refresh the page and try again.');
                return;
            }
            if (sourceBtn) {
                sourceBtn.disabled = true;
                sourceBtn.classList.add('is-switching');
            }
            if (confirmBtn) {
                confirmBtn.disabled = true;
            }

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
                    if (sourceBtn) {
                        sourceBtn.disabled = false;
                        sourceBtn.classList.remove('is-switching');
                    }
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                    }
                    showRoleError(payload.message || 'Could not switch role');
                })
                .catch(function () {
                    if (sourceBtn) {
                        sourceBtn.disabled = false;
                        sourceBtn.classList.remove('is-switching');
                    }
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                    }
                    showRoleError('Network error — try again');
                });
        }

        function requestSwitch(btn) {
            var role = btn.getAttribute('data-role-aco');
            if (!role) {
                return;
            }

            var labelEl = btn.querySelector('.oe-nc-role-switch-item__label');
            var deskEl = btn.querySelector('.oe-nc-role-switch-item__hint');
            var roleLabel = labelEl ? labelEl.textContent.trim() : role;
            var deskLabel = deskEl ? deskEl.textContent.trim() : '';

            pending = { role: role, btn: btn };

            if (confirmModal && confirmMessageEl && confirmDeskEl && showModal(confirmModal)) {
                confirmMessageEl.textContent = 'Switch to ' + roleLabel + '?';
                confirmDeskEl.textContent = deskLabel
                    ? 'You will be taken to ' + deskLabel + '.'
                    : '';
                hideProfileDropdown();
                return;
            }

            if (window.confirm(
                'Switch to ' + roleLabel + '?' + (deskLabel ? '\nYou will be taken to ' + deskLabel + '.' : '')
            )) {
                executeSwitch(role, btn);
            }
        }

        root.querySelectorAll('.oe-nc-role-switch-item[data-role-aco]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (btn.disabled || btn.classList.contains('is-active')) {
                    return;
                }
                requestSwitch(btn);
            });
        });

        if (confirmBtn) {
            confirmBtn.addEventListener('click', function () {
                if (!pending) {
                    return;
                }
                executeSwitch(pending.role, pending.btn);
            });
        }

        if (confirmModal && window.jQuery) {
            window.jQuery(confirmModal).on('hidden.bs.modal', function () {
                pending = null;
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                }
            });
        }
    }

    function refreshQueueCounts(root, ajaxUrl) {
        if (!ajaxUrl) {
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
                updateQueueCounts(root, payload.data.counts);
            })
            .catch(function () {
                /* non-blocking */
            });
    }

    function sumActiveCounts(counts) {
        var keys = ['waiting', 'triage', 'doctor', 'lab', 'pharmacy', 'payment'];
        var total = 0;
        keys.forEach(function (key) {
            total += Number(counts[key] || 0);
        });
        return total;
    }

    function updateQueueCounts(root, counts) {
        root.querySelectorAll('[data-stat-key]').forEach(function (el) {
            var key = el.getAttribute('data-stat-key');
            if (!key || typeof counts[key] === 'undefined') {
                return;
            }
            var countEl = el.querySelector('[data-stat-count]');
            if (!countEl) {
                return;
            }
            var next = String(counts[key]);
            if (countEl.textContent !== next) {
                countEl.textContent = next;
                el.classList.add('is-updated');
                window.setTimeout(function () {
                    el.classList.remove('is-updated');
                }, 600);
            }
        });

        var activeTotal = sumActiveCounts(counts);
        root.querySelectorAll('[data-queue-active-total]').forEach(function (el) {
            el.textContent = String(activeTotal);
        });

        root.querySelectorAll('[data-badge-key]').forEach(function (link) {
            var key = link.getAttribute('data-badge-key');
            if (!key || typeof counts[key] === 'undefined') {
                return;
            }
            var badge = link.querySelector('[data-badge-count]');
            if (!badge) {
                return;
            }
            var value = Number(counts[key]);
            badge.textContent = String(value);
            badge.classList.toggle('is-zero', value === 0);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        init(document.getElementById('oe-nc-t1'));
    });

    window.NewClinicShell = { init: init };
}(window));

/**
 * T1 shell — sidebar drawer, collapse rail, and nav link behavior
 */
(function (window) {
    'use strict';

    var SIDEBAR_COLLAPSED_KEY = 'nc-sidebar-collapsed';
    var SIDEBAR_COLLAPSED_KEY_LEGACY = 'oe-nc-sidebar-collapsed';
    var MOBILE_MQ = '(max-width: 991.98px)';
    var DESKTOP_MQ = '(min-width: 992px)';

    function applyCollapsedState(root) {
        var collapseBtn = document.getElementById('nc-sidebar-collapse');
        var collapsed = false;

        try {
            collapsed = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
                || window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY_LEGACY) === '1';
        } catch (e) {
            collapsed = false;
        }

        if (collapsed) {
            root.classList.add('nc-t1-sidebar-collapsed');
        }

        if (collapseBtn) {
            collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            collapseBtn.setAttribute(
                'aria-label',
                collapsed ? 'Expand sidebar' : 'Collapse sidebar'
            );
        }
    }

    function bindSidebar(root) {
        var sidebar = root.querySelector('.nc-sidebar');
        if (!sidebar) {
            return;
        }

        var backdrop = document.getElementById('nc-sidebar-backdrop');
        var openBtn = document.getElementById('nc-sidebar-open');
        var closeBtn = document.getElementById('nc-sidebar-close');
        var collapseBtn = document.getElementById('nc-sidebar-collapse');
        var mobileQuery = window.matchMedia(MOBILE_MQ);

        applyCollapsedState(root);

        function focusMobileClose() {
            if (closeBtn && mobileQuery.matches) {
                closeBtn.focus();
            }
        }

        function openMobile() {
            sidebar.classList.add('is-open');
            if (backdrop) {
                backdrop.hidden = false;
                backdrop.setAttribute('aria-hidden', 'false');
            }
            if (openBtn) {
                openBtn.setAttribute('aria-expanded', 'true');
            }
            document.body.classList.add('nc-sidebar-mobile-open');
            focusMobileClose();
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
            document.body.classList.remove('nc-sidebar-mobile-open');
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

        sidebar.querySelectorAll('.nc-sidebar-link').forEach(function (link) {
            link.addEventListener('click', function () {
                if (mobileQuery.matches) {
                    closeMobile();
                }
            });
        });

        if (collapseBtn) {
            collapseBtn.addEventListener('click', function () {
                var collapsed = root.classList.toggle('nc-t1-sidebar-collapsed');
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

        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape' || !sidebar.classList.contains('is-open')) {
                return;
            }
            if (mobileQuery.matches) {
                event.preventDefault();
                closeMobile();
                if (openBtn) {
                    openBtn.focus();
                }
            }
        });

        window.addEventListener('resize', function () {
            if (window.matchMedia(DESKTOP_MQ).matches) {
                closeMobile();
            }
        });
    }

    window.NewClinicShellSidebar = {
        bind: bindSidebar,
        applyCollapsedState: applyCollapsedState,
    };
}(window));

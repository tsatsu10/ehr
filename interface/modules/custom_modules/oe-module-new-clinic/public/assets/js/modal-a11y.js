(function (window) {
    'use strict';

    var FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    function getFocusable(modal) {
        return Array.prototype.slice.call(modal.querySelectorAll(FOCUSABLE))
            .filter(function (el) {
                return !el.disabled && el.offsetParent !== null;
            });
    }

    function trapFocus(modal) {
        var focusable = getFocusable(modal);
        if (!focusable.length) {
            return;
        }

        var first = focusable[0];
        var last = focusable[focusable.length - 1];

        modal._ncPreviousFocus = document.activeElement;
        modal._ncFocusTrap = function (event) {
            if (event.key !== 'Tab') {
                return;
            }
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        modal.addEventListener('keydown', modal._ncFocusTrap);
        first.focus();
    }

    function releaseFocusTrap(modal) {
        if (modal._ncFocusTrap) {
            modal.removeEventListener('keydown', modal._ncFocusTrap);
            modal._ncFocusTrap = null;
        }
        if (modal._ncPreviousFocus && typeof modal._ncPreviousFocus.focus === 'function') {
            modal._ncPreviousFocus.focus();
        }
        modal._ncPreviousFocus = null;
    }

    function show(modal, backdrop) {
        if (!modal) {
            return;
        }
        modal.style.display = 'block';
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        if (backdrop) {
            backdrop.style.display = 'block';
            backdrop.classList.add('show');
        }
        document.body.classList.add('modal-open');
        trapFocus(modal);
    }

    function hide(modal, backdrop) {
        if (!modal) {
            return;
        }
        releaseFocusTrap(modal);
        modal.style.display = 'none';
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        if (backdrop) {
            backdrop.style.display = 'none';
            backdrop.classList.remove('show');
        }
        document.body.classList.remove('modal-open');
    }

    window.NewClinicModal = {
        show: show,
        hide: hide
    };
})(window);

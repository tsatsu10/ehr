(function (window) {
    'use strict';

    var POLL_MS = 60000;
    var SEARCH_DEBOUNCE_MS = 300;
    var PAGE_SIZE = 25;

    function getJson(url) {
        return window.NewClinicUI.getJson(url);
    }

    function postJson(url, body) {
        return window.NewClinicUI.postJson(url, body);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function apiPayload(res) {
        return (window.NewClinicUI && window.NewClinicUI.apiPayload)
            ? window.NewClinicUI.apiPayload(res)
            : ((res && res.payload) ? res.payload : (res || {}));
    }

    function buildUrl(base, params) {
        var parts = [];
        Object.keys(params).forEach(function (key) {
            var val = params[key];
            if (val === undefined || val === null || val === '') {
                return;
            }
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(val)));
        });
        return base + (base.indexOf('?') >= 0 ? '&' : '?') + parts.join('&');
    }

    function init(root) {
        if (!root) {
            return;
        }

        var ajaxUrl = root.getAttribute('data-ajax-url') || '';
        var csrfToken = root.getAttribute('data-csrf-token') || '';
        var canViewAll = root.getAttribute('data-can-view-all') === '1';
        var reminderAddUrl = root.getAttribute('data-reminder-add-url') || '';
        var reminderLogUrl = root.getAttribute('data-reminder-log-url') || '';

        var state = {
            lens: root.getAttribute('data-initial-lens') || 'messages',
            selectedId: null,
            selectedType: null,
            begin: 0,
            total: 0,
            activity: '1',
            showAll: false,
            search: '',
            detail: null,
            pollTimer: null,
            searchTimer: null
        };

        var els = {
            list: document.getElementById('nc-comm-list'),
            pagination: document.getElementById('nc-comm-pagination'),
            detail: document.getElementById('nc-comm-detail'),
            detailPane: document.getElementById('nc-comm-detail-pane'),
            footer: document.getElementById('nc-comm-footer'),
            countMessages: document.getElementById('nc-comm-count-messages'),
            countReminders: document.getElementById('nc-comm-count-reminders'),
            lensMessages: document.getElementById('nc-comm-lens-messages'),
            lensReminders: document.getElementById('nc-comm-lens-reminders'),
            search: document.getElementById('nc-comm-search'),
            activity: document.getElementById('nc-comm-activity'),
            scopeWrap: document.getElementById('nc-comm-scope-wrap'),
            showAll: document.getElementById('nc-comm-show-all'),
            refresh: document.getElementById('nc-comm-refresh'),
            markDone: document.getElementById('nc-comm-mark-done'),
            reminderComplete: document.getElementById('nc-comm-reminder-complete'),
            createReminder: document.getElementById('nc-comm-create-reminder'),
            viewLog: document.getElementById('nc-comm-view-log'),
            composeLink: document.getElementById('nc-comm-compose-link'),
            back: document.getElementById('nc-comm-back')
        };

        bindEvents();
        applyLensUi();
        refreshCounts();
        loadList();

        function bindEvents() {
            if (els.lensMessages) {
                els.lensMessages.addEventListener('click', function () { switchLens('messages'); });
            }
            if (els.lensReminders) {
                els.lensReminders.addEventListener('click', function () { switchLens('reminders'); });
            }
            if (els.search) {
                els.search.addEventListener('input', function () {
                    clearTimeout(state.searchTimer);
                    state.searchTimer = setTimeout(function () {
                        state.search = els.search.value.trim();
                        state.begin = 0;
                        loadList();
                    }, SEARCH_DEBOUNCE_MS);
                });
            }
            if (els.activity) {
                els.activity.addEventListener('change', function () {
                    state.activity = els.activity.value;
                    state.begin = 0;
                    loadList();
                });
            }
            if (els.showAll) {
                els.showAll.addEventListener('change', function () {
                    state.showAll = els.showAll.checked;
                    state.begin = 0;
                    loadList();
                });
            }
            if (els.refresh) {
                els.refresh.addEventListener('click', function () {
                    refreshCounts();
                    loadList();
                    if (state.selectedId) {
                        loadDetail();
                    }
                });
            }
            if (els.markDone) {
                els.markDone.addEventListener('click', markMessageDone);
            }
            if (els.reminderComplete) {
                els.reminderComplete.addEventListener('click', markReminderDone);
            }
            if (els.createReminder) {
                els.createReminder.addEventListener('click', openReminderAdd);
            }
            if (els.viewLog) {
                els.viewLog.addEventListener('click', openReminderLog);
            }
            if (els.back) {
                els.back.addEventListener('click', closeMobileDetail);
            }
            document.addEventListener('visibilitychange', onVisibilityChange);
        }

        function switchLens(lens) {
            if (state.lens === lens) {
                return;
            }
            state.lens = lens;
            state.selectedId = null;
            state.selectedType = null;
            state.begin = 0;
            state.detail = null;
            applyLensUi();
            renderEmptyDetail();
            updateFooter();
            loadList();
            refreshCounts();
        }

        function applyLensUi() {
            var isMessages = state.lens === 'messages';
            if (els.lensMessages) {
                els.lensMessages.classList.toggle('active', isMessages);
            }
            if (els.lensReminders) {
                els.lensReminders.classList.toggle('active', !isMessages);
            }
            if (els.activity) {
                els.activity.classList.toggle('d-none', !isMessages);
            }
            if (els.scopeWrap) {
                els.scopeWrap.classList.toggle('d-none', !isMessages || !canViewAll);
            }
            if (els.composeLink) {
                els.composeLink.classList.toggle('d-none', !isMessages);
            }
            if (els.createReminder) {
                els.createReminder.classList.toggle('d-none', isMessages);
            }
            if (els.viewLog) {
                els.viewLog.classList.toggle('d-none', isMessages);
            }
            resetPoll(isMessages ? null : POLL_MS);
        }

        function refreshCounts() {
            return getJson(buildUrl(ajaxUrl, { action: 'communications.hub_counts' }))
                .then(function (res) {
                    var payload = apiPayload(res);
                    if (!payload.success || !payload.data) {
                        return;
                    }
                    if (els.countMessages) {
                        els.countMessages.textContent = String(payload.data.messages_active || 0);
                    }
                    if (els.countReminders) {
                        els.countReminders.textContent = String(payload.data.reminders_in_window || 0);
                    }
                })
                .catch(function () { /* non-fatal */ });
        }

        function loadList() {
            if (!els.list) {
                return;
            }
            els.list.innerHTML = '<div class="p-3 text-muted"><em>Loading…</em></div>';

            var promise;
            if (state.lens === 'messages') {
                promise = getJson(buildUrl(ajaxUrl, {
                    action: 'communications.messages_list',
                    activity: state.activity,
                    show_all: state.showAll ? '1' : '',
                    begin: state.begin,
                    limit: PAGE_SIZE,
                    q: state.search
                }));
            } else {
                promise = getJson(buildUrl(ajaxUrl, {
                    action: 'communications.reminders_list',
                    days: 30
                }));
            }

            promise.then(function (res) {
                var payload = apiPayload(res);
                if (!payload.success) {
                    els.list.innerHTML = '<div class="p-3 text-danger">' + escapeHtml(payload.message || 'Could not load list') + '</div>';
                    return;
                }
                var rows = payload.data.rows || [];
                state.total = payload.data.total || rows.length;
                state.lastRows = rows;
                renderList(rows);
                renderPagination();
            }).catch(function () {
                els.list.innerHTML = '<div class="p-3 text-danger">Could not load list</div>';
            });
        }

        function renderList(rows) {
            if (!rows.length) {
                els.list.innerHTML = '<div class="p-3 text-muted"><em>No items in this view.</em></div>';
                return;
            }

            els.list.innerHTML = rows.map(function (row) {
                var id = state.lens === 'messages' ? row.id : row.id;
                var selected = state.selectedId === id;
                if (state.lens === 'messages') {
                    return '<button type="button" class="oe-nc-comm-row' + (selected ? ' is-selected' : '') + '" data-id="' + escapeHtml(id) + '" data-type="message" role="option" aria-selected="' + (selected ? 'true' : 'false') + '">' +
                        '<div class="oe-nc-comm-row__title">' + escapeHtml(row.patient_name || row.type || 'Message') +
                        (row.is_unread ? ' <span class="badge badge-primary oe-nc-comm-row__badge">New</span>' : '') + '</div>' +
                        '<div class="oe-nc-comm-row__meta">' + escapeHtml(row.from_name) + ' · ' + escapeHtml(row.date_display || row.date) + '</div>' +
                        '<div class="oe-nc-comm-row__meta">' + escapeHtml(row.status || '') + '</div>' +
                        '</button>';
                }
                return '<button type="button" class="oe-nc-comm-row' + (selected ? ' is-selected' : '') + '" data-id="' + escapeHtml(id) + '" data-type="reminder" role="option" aria-selected="' + (selected ? 'true' : 'false') + '">' +
                    '<div class="oe-nc-comm-row__title">' + escapeHtml(row.patient_name || 'Reminder') +
                    ' <span class="oe-nc-comm-urgency--' + escapeHtml(row.urgency) + ' oe-nc-comm-row__badge">' + escapeHtml(row.urgency_label) + '</span></div>' +
                    '<div class="oe-nc-comm-row__meta">' + escapeHtml(row.due_display || row.due_date) + ' · ' + escapeHtml(row.from_name) + '</div>' +
                    '<div class="oe-nc-comm-row__meta">' + escapeHtml(row.preview) + '</div>' +
                    '</button>';
            }).join('');

            Array.prototype.forEach.call(els.list.querySelectorAll('.oe-nc-comm-row'), function (btn) {
                btn.addEventListener('click', function () {
                    state.selectedId = parseInt(btn.getAttribute('data-id'), 10);
                    state.selectedType = btn.getAttribute('data-type');
                    Array.prototype.forEach.call(els.list.querySelectorAll('.oe-nc-comm-row'), function (row) {
                        var active = row === btn;
                        row.classList.toggle('is-selected', active);
                        row.setAttribute('aria-selected', active ? 'true' : 'false');
                    });
                    root.classList.add('is-detail-open');
                    loadDetail();
                });
            });
        }

        function renderPagination() {
            if (!els.pagination) {
                return;
            }
            if (state.lens !== 'messages' || state.total <= PAGE_SIZE) {
                els.pagination.innerHTML = state.total > 0
                    ? '<span>' + escapeHtml(state.total) + ' item(s)</span><span></span>'
                    : '';
                return;
            }
            var from = state.begin + 1;
            var to = Math.min(state.begin + PAGE_SIZE, state.total);
            var prevDisabled = state.begin <= 0 ? ' disabled' : '';
            var nextDisabled = state.begin + PAGE_SIZE >= state.total ? ' disabled' : '';
            els.pagination.innerHTML =
                '<button type="button" class="btn btn-link btn-sm p-0" id="nc-comm-page-prev"' + prevDisabled + '>&laquo; Prev</button>' +
                '<span>' + from + '–' + to + ' of ' + state.total + '</span>' +
                '<button type="button" class="btn btn-link btn-sm p-0" id="nc-comm-page-next"' + nextDisabled + '>Next &raquo;</button>';

            var prev = document.getElementById('nc-comm-page-prev');
            var next = document.getElementById('nc-comm-page-next');
            if (prev && !prev.disabled) {
                prev.addEventListener('click', function () {
                    state.begin = Math.max(0, state.begin - PAGE_SIZE);
                    loadList();
                });
            }
            if (next && !next.disabled) {
                next.addEventListener('click', function () {
                    state.begin += PAGE_SIZE;
                    loadList();
                });
            }
        }

        function loadDetail() {
            if (!state.selectedId) {
                renderEmptyDetail();
                return;
            }
            if (state.selectedType === 'reminder') {
                renderReminderDetail(findReminderRow(state.selectedId));
                return;
            }

            els.detail.innerHTML = '<div class="text-muted"><em>Loading…</em></div>';
            getJson(buildUrl(ajaxUrl, { action: 'communications.message_detail', id: state.selectedId }))
                .then(function (res) {
                    var payload = apiPayload(res);
                    if (!payload.success || !payload.data) {
                        els.detail.innerHTML = '<div class="text-danger">' + escapeHtml(payload.message || 'Could not load message') + '</div>';
                        return;
                    }
                    state.detail = payload.data;
                    renderMessageDetail(payload.data);
                    updateFooter();
                })
                .catch(function () {
                    els.detail.innerHTML = '<div class="text-danger">Could not load message</div>';
                });
        }

        function findReminderRow(id) {
            if (!state.lastRows || !state.lastRows.length) {
                return null;
            }
            for (var i = 0; i < state.lastRows.length; i++) {
                if (state.lastRows[i].id === id) {
                    return state.lastRows[i];
                }
            }
            return null;
        }

        function renderEmptyDetail() {
            if (!els.detail) {
                return;
            }
            els.detail.innerHTML = '<div class="oe-nc-comm-empty text-muted"><p class="mb-0">Select an item to read details.</p></div>';
            updateFooter();
        }

        function renderMessageDetail(data) {
            var banner = '';
            if (data.is_supervisory_read && data.supervisory_banner) {
                banner = '<div class="alert alert-warning oe-nc-comm-detail__banner py-2 small">' + escapeHtml(data.supervisory_banner) + '</div>';
            }
            var chartLink = data.chart_url
                ? '<a class="btn btn-outline-primary btn-sm mr-1" href="' + escapeHtml(data.chart_url) + '" target="_top">Open chart</a>'
                : '';
            var replyLink = data.can_reply && data.legacy_reply_url
                ? '<a class="btn btn-primary btn-sm" href="' + escapeHtml(data.legacy_reply_url) + '" target="_top">Reply</a>'
                : '';
            els.detail.innerHTML =
                banner +
                '<header class="oe-nc-comm-detail__header">' +
                '<h2 class="h5 mb-1">' + escapeHtml(data.patient_name || data.type || 'Message') + '</h2>' +
                '<div class="text-muted small mb-2">' + escapeHtml(data.from_name) + ' · ' + escapeHtml(data.date_display || data.date) + '</div>' +
                '<div class="small mb-2"><strong>Type:</strong> ' + escapeHtml(data.type) + ' · <strong>Status:</strong> ' + escapeHtml(data.status || '') + '</div>' +
                '<div class="mb-2">' + chartLink + replyLink + '</div>' +
                '</header>' +
                '<div class="oe-nc-comm-thread">' + (data.thread_html || '') + '</div>';
        }

        function renderReminderDetail(row) {
            var match = row && row.id ? row : findReminderRow(state.selectedId);
            if (match) {
                state.detail = match;
                var chartBtn = match.pid
                    ? '<a class="btn btn-outline-primary btn-sm" href="' + escapeHtml(root.getAttribute('data-webroot') + '/interface/modules/custom_modules/oe-module-new-clinic/public/patient-chart.php?pid=' + match.pid) + '" target="_top">Open chart</a>'
                    : '';
                els.detail.innerHTML =
                    '<header class="oe-nc-comm-detail__header">' +
                    '<h2 class="h5 mb-1">' + escapeHtml(match.patient_name || 'Reminder') + '</h2>' +
                    '<div class="text-muted small mb-2"><span class="oe-nc-comm-urgency--' + escapeHtml(match.urgency) + '">' + escapeHtml(match.urgency_label) + '</span> · ' + escapeHtml(match.due_display || match.due_date) + '</div>' +
                    '<div class="small mb-2"><strong>From:</strong> ' + escapeHtml(match.from_name) + '</div>' +
                    chartBtn +
                    '</header>' +
                    '<p class="mb-0">' + escapeHtml(match.preview) + '</p>';
                updateFooter();
                return;
            }

            getJson(buildUrl(ajaxUrl, { action: 'communications.reminders_list', days: 30 }))
                .then(function (res) {
                    var payload = apiPayload(res);
                    var fetched = null;
                    if (payload.success && payload.data && payload.data.rows) {
                        state.lastRows = payload.data.rows;
                        fetched = payload.data.rows.find(function (r) { return r.id === state.selectedId; });
                    }
                    if (!fetched) {
                        els.detail.innerHTML = '<div class="text-muted">Reminder not found or already completed.</div>';
                        updateFooter();
                        return;
                    }
                    renderReminderDetail(fetched);
                });
        }

        function updateFooter() {
            var isMessage = state.lens === 'messages' && state.selectedType === 'message' && state.detail;
            var isReminder = state.lens === 'reminders' && state.selectedId;
            if (els.markDone) {
                var canMark = isMessage && state.detail.can_mark_done;
                els.markDone.classList.toggle('d-none', !canMark);
            }
            if (els.reminderComplete) {
                els.reminderComplete.classList.toggle('d-none', !isReminder);
            }
        }

        function markMessageDone() {
            if (!state.selectedId) {
                return;
            }
            postJson(ajaxUrl + '?action=communications.message_done', {
                csrf_token_form: csrfToken,
                noteid: state.selectedId
            }).then(function (res) {
                var payload = apiPayload(res);
                if (!payload.success) {
                    window.alert(payload.message || 'Could not mark message done');
                    return;
                }
                state.selectedId = null;
                state.detail = null;
                closeMobileDetail();
                refreshCounts();
                loadList();
                renderEmptyDetail();
            });
        }

        function markReminderDone() {
            if (!state.selectedId) {
                return;
            }
            postJson(ajaxUrl + '?action=communications.reminder_done', {
                csrf_token_form: csrfToken,
                dr_id: state.selectedId
            }).then(function (res) {
                var payload = apiPayload(res);
                if (!payload.success) {
                    window.alert(payload.message || 'Could not complete reminder');
                    return;
                }
                state.selectedId = null;
                state.detail = null;
                closeMobileDetail();
                refreshCounts();
                loadList();
                renderEmptyDetail();
            });
        }

        function openReminderAdd() {
            if (typeof window.dlgopen === 'function' && reminderAddUrl) {
                window.dlgopen(reminderAddUrl, '_blank', 775, 500);
                return;
            }
            window.open(reminderAddUrl, '_blank');
        }

        function openReminderLog() {
            if (typeof window.dlgopen === 'function' && reminderLogUrl) {
                window.dlgopen(reminderLogUrl, '_blank', 900, 600);
                return;
            }
            window.open(reminderLogUrl, '_blank');
        }

        function closeMobileDetail() {
            root.classList.remove('is-detail-open');
        }

        function resetPoll(interval) {
            if (state.pollTimer) {
                clearInterval(state.pollTimer);
                state.pollTimer = null;
            }
            if (interval && state.lens === 'reminders') {
                state.pollTimer = setInterval(function () {
                    refreshCounts();
                    loadList();
                }, interval);
            }
        }

        function onVisibilityChange() {
            if (document.hidden) {
                resetPoll(null);
            } else if (state.lens === 'reminders') {
                resetPoll(POLL_MS);
            }
        }
    }

    window.NewClinicCommunications = {
        init: init
    };
}(window));

(function (window) {
    'use strict';

    var POLL_MS = 30000;
    var COLUMN_LABELS = {
        waiting: 'Waiting',
        triage: 'Triage',
        doctor: 'Doctor',
        lab: 'Lab',
        pharmacy: 'Pharmacy',
        payment: 'Payment',
        done: 'Done'
    };

    var boardData = null;
    var pollTimer = null;
    var boardLoadGuard = null;

    function isWallProfile(root) {
        return root && root.dataset.boardProfile === 'wall';
    }

    function isPrivacyMode(root) {
        return isWallProfile(root) || root.dataset.privacyMode === '1';
    }

    function computeNowServing(columns) {
        var priority = ['with_doctor', 'ready_for_doctor', 'in_triage', 'waiting'];
        var i;
        for (i = 0; i < priority.length; i += 1) {
            var state = priority[i];
            var columnKey = state === 'with_doctor' || state === 'ready_for_doctor'
                ? 'doctor'
                : (state === 'in_triage' ? 'triage' : 'waiting');
            var cards = (columns[columnKey] || []).filter(function (card) {
                return card.state === state;
            });
            if (cards.length) {
                cards.sort(function (a, b) {
                    return parseInt(a.queue_number, 10) - parseInt(b.queue_number, 10);
                });
                return cards[0];
            }
        }
        return null;
    }

    function updateWallBanner(root, columns) {
        if (!isWallProfile(root)) {
            return;
        }
        var banner = document.getElementById('nc-wall-now-serving');
        if (!banner) {
            return;
        }
        var serving = computeNowServing(columns || {});
        if (!serving) {
            banner.textContent = banner.dataset.clinicName || banner.textContent;
            return;
        }
        banner.textContent = 'Now serving #' + (serving.queue_number || '?');
    }

    function getBoardLoadGuard() {
        if (!boardLoadGuard && window.NewClinicUI && window.NewClinicUI.createRequestGuard) {
            boardLoadGuard = window.NewClinicUI.createRequestGuard();
        }
        if (!boardLoadGuard) {
            boardLoadGuard = {
                next: function () { return 1; },
                isStale: function () { return false; }
            };
        }
        return boardLoadGuard;
    }

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

    function matchesFilter(card, searchText, urgentOnly) {
        if (urgentOnly && !parseInt(card.is_urgent, 10)) {
            return false;
        }
        if (!searchText) {
            return true;
        }
        var hay = [
            card.display_name,
            card.pubpid,
            card.queue_number,
            card.chief_complaint
        ].join(' ').toLowerCase();
        return hay.indexOf(searchText) !== -1;
    }

    function renderCard(card, root) {
        var urgent = parseInt(card.is_urgent, 10)
            ? '<span class="badge badge-warning mr-1">URGENT</span>' : '';
        var skipped = card.skipped_triage
            ? '<span class="badge badge-secondary mr-1" title="Skipped triage">Skipped triage</span>' : '';
        var stateBadge = '<span class="badge badge-info mt-1">' + escapeHtml(card.state) + '</span>';

        return window.NewClinicUI.renderQueueCard(card, {
            interactive: !isWallProfile(root),
            privacyMode: isPrivacyMode(root),
            badgesHtml: urgent + skipped,
            subtitleHtml: '<div class="oe-nc-queue-card__meta small text-muted">' +
                escapeHtml(card.sex || '') + ' · ' + escapeHtml(card.age_years || '—') +
                ' · ' + escapeHtml(card.wait_minutes) + 'm · ' + escapeHtml(card.visit_type_label) +
                '</div>',
            footerHtml: isWallProfile(root) ? '' : stateBadge,
            dataAttributes: {
                'visit-id': card.id
            }
        });
    }

    function renderStats(counts) {
        var parts = [];
        Object.keys(COLUMN_LABELS).forEach(function (key) {
            parts.push('<span class="badge badge-light border mr-2 mb-2">' +
                escapeHtml(COLUMN_LABELS[key]) + ': ' + (counts[key] || 0) + '</span>');
        });
        return parts.join('');
    }

    function computeFilteredCounts(columns, searchText, urgentOnly) {
        var counts = {};
        Object.keys(COLUMN_LABELS).forEach(function (key) {
            counts[key] = ((columns[key] || []).filter(function (card) {
                return matchesFilter(card, searchText, urgentOnly);
            })).length;
        });

        return counts;
    }

    function visibleColumns(config, columns, counts) {
        var cols = ['waiting', 'doctor', 'payment', 'done'];
        if (config.enable_triage) {
            cols.splice(1, 0, 'triage');
        }
        var insertAt = cols.indexOf('payment');
        if (config.enable_pharmacy_role || columnHasVisits(columns, counts, 'pharmacy')) {
            cols.splice(insertAt, 0, 'pharmacy');
            insertAt += 1;
        }
        if (config.enable_lab_role || columnHasVisits(columns, counts, 'lab')) {
            cols.splice(insertAt, 0, 'lab');
        }
        return cols;
    }

    function columnHasVisits(columns, counts, key) {
        if ((counts[key] || 0) > 0) {
            return true;
        }
        var cards = columns[key] || [];
        return cards.length > 0;
    }

    function boardEl(id) {
        if (window.NewClinicUI && window.NewClinicUI.pageEl) {
            return window.NewClinicUI.pageEl(id);
        }
        return document.getElementById(id);
    }

    function boardFilterState() {
        var searchInput = boardEl('nc-board-search');
        var urgentInput = boardEl('nc-board-urgent-only');
        return {
            searchText: searchInput ? (searchInput.value || '').trim().toLowerCase() : '',
            urgentOnly: urgentInput ? !!urgentInput.checked : false
        };
    }

    function renderBoard(root, data) {
        boardData = data;
        var filters = boardFilterState();
        var searchText = filters.searchText;
        var urgentOnly = filters.urgentOnly;
        var statsEl = root.querySelector('#nc-board-stats');
        var columnsEl = root.querySelector('#nc-board-columns');
        var cancelledEl = root.querySelector('#nc-cancelled-list');
        var cancelledCountEl = root.querySelector('#nc-cancelled-count');
        var updatedEl = boardEl('nc-board-updated');
        var dateEl = boardEl('nc-board-date');

        if (!statsEl || !columnsEl) {
            return;
        }

        statsEl.innerHTML = renderStats(
            computeFilteredCounts(data.columns || {}, searchText, urgentOnly)
        );
        if (dateEl) {
            dateEl.textContent = data.visit_date || '';
        }
        if (updatedEl) {
            updatedEl.textContent = 'Updated ' + new Date().toLocaleTimeString();
        }

        var html = '';
        visibleColumns(data.config || {}, data.columns || {}, data.counts || {}).forEach(function (columnKey) {
            var cards = (data.columns[columnKey] || []).filter(function (card) {
                return matchesFilter(card, searchText, urgentOnly);
            });
            html += '<div class="col-lg-4 col-xl-3 mb-3">' +
                '<div class="nc-board-column h-100">' +
                '<h6 class="nc-board-column-title">' + escapeHtml(COLUMN_LABELS[columnKey]) +
                ' <span class="badge badge-secondary">' + cards.length + '</span></h6>' +
                '<div class="nc-board-column-body">' +
                (cards.length ? cards.map(function (card) {
                    return renderCard(card, root);
                }).join('') :
                    '<em class="text-muted small">None</em>') +
                '</div></div></div>';
        });
        columnsEl.innerHTML = html;
        updateWallBanner(root, data.columns || {});

        var cancelled = data.cancelled || [];
        if (cancelledCountEl) {
            cancelledCountEl.textContent = String(cancelled.length);
        }
        if (cancelledEl) {
            cancelledEl.innerHTML = cancelled.length
                ? cancelled.map(function (v) {
                    return '<div class="border-bottom py-1">#' + escapeHtml(v.queue_number) + ' ' +
                        escapeHtml(v.display_name) + ' — ' + escapeHtml(v.cancel_reason || '') + '</div>';
                }).join('')
                : '<em class="text-muted">None</em>';
        }

        columnsEl.querySelectorAll('.oe-nc-queue-card[data-visit-id], .nc-queue-card[data-visit-id]').forEach(function (btn) {
            if (isWallProfile(root)) {
                return;
            }
            btn.addEventListener('click', function () {
                openVisitModal(root, parseInt(btn.dataset.visitId, 10));
            });
        });
    }

    function deskActionForState(state, deskUrls) {
        if (state === 'waiting') {
            return { label: 'Open Front Desk', url: deskUrls.front_desk };
        }
        if (state === 'in_triage') {
            return { label: 'Open Triage', url: deskUrls.triage };
        }
        if (state === 'ready_for_doctor' || state === 'with_doctor') {
            return { label: 'Open Doctor Desk', url: deskUrls.doctor };
        }
        if (state === 'ready_for_lab' || state === 'in_lab' || state === 'lab_complete') {
            return { label: 'Open Lab Desk', url: deskUrls.lab };
        }
        if (state === 'ready_for_pharmacy' || state === 'in_pharmacy' || state === 'pharmacy_complete') {
            return { label: 'Open Pharmacy Desk', url: deskUrls.pharmacy };
        }
        if (state === 'ready_for_payment') {
            return { label: 'Open Cashier', url: deskUrls.cashier };
        }
        return null;
    }

    function parseDeskUrls(root) {
        try {
            return JSON.parse(root.dataset.deskUrls || '{}');
        } catch (e) {
            return {};
        }
    }

    function modalElements() {
        return {
            modal: document.getElementById('nc-visit-modal'),
            backdrop: document.getElementById('nc-visit-modal-backdrop'),
            drawer: document.getElementById('nc-visit-detail-drawer')
        };
    }

    function showModal() {
        var els = modalElements();
        if (window.NewClinicModal) {
            window.NewClinicModal.show(els.modal, els.backdrop);
            return;
        }
        if (!els.modal || !els.backdrop) {
            return;
        }
        els.modal.style.display = 'block';
        els.modal.classList.add('show');
        els.modal.setAttribute('aria-hidden', 'false');
        els.backdrop.style.display = 'block';
        els.backdrop.classList.add('show');
        document.body.classList.add('modal-open');
    }

    function hideModal() {
        hideDrawer();
        var els = modalElements();
        if (window.NewClinicModal) {
            window.NewClinicModal.hide(els.modal, els.backdrop);
            return;
        }
        if (!els.modal || !els.backdrop) {
            return;
        }
        els.modal.style.display = 'none';
        els.modal.classList.remove('show');
        els.modal.setAttribute('aria-hidden', 'true');
        els.backdrop.style.display = 'none';
        els.backdrop.classList.remove('show');
        document.body.classList.remove('modal-open');
    }

    function hideDrawer() {
        var drawer = document.getElementById('nc-visit-detail-drawer');
        if (!drawer) {
            return;
        }
        drawer.style.display = 'none';
        drawer.classList.remove('show');
        drawer.setAttribute('aria-hidden', 'true');
    }

    function showDrawer() {
        var drawer = document.getElementById('nc-visit-detail-drawer');
        if (!drawer) {
            return;
        }
        drawer.style.display = 'block';
        drawer.classList.add('show');
        drawer.setAttribute('aria-hidden', 'false');
    }

    function renderVisitSummary(summary) {
        summary = summary || {};
        var badges = (summary.badges || []).map(function (badge) {
            if (badge === 'urgent') {
                return '<span class="badge badge-warning">URGENT</span>';
            }
            if (badge === 'skipped_triage') {
                return '<span class="badge badge-secondary">Skipped triage</span>';
            }
            return '';
        }).join(' ');

        var parts = [
            escapeHtml(summary.visit_type_label || 'Visit'),
            summary.started_at_label ? 'Started ' + escapeHtml(summary.started_at_label) : '',
            'Wait ' + escapeHtml(summary.wait_minutes || 0) + 'm',
            'Dr hint: ' + escapeHtml(summary.provider_hint || 'Unassigned')
        ].filter(Boolean);

        return '<div class="nc-visit-summary mt-2 mb-2">' +
            '<div class="text-muted">' + parts.join(' · ') + '</div>' +
            (badges ? '<div class="nc-visit-summary__badges mt-2">' + badges + '</div>' : '') +
            '</div>';
    }

    function renderDrawerContent(data) {
        var summary = data.visit_summary || {};
        var visit = data.visit || {};
        var stateMeta = window.NewClinicUI && window.NewClinicUI.visitStateMeta
            ? window.NewClinicUI.visitStateMeta[visit.state] || {}
            : {};
        var titleEl = document.getElementById('nc-visit-drawer-title');
        if (titleEl) {
            titleEl.textContent = '#' + (summary.queue_number || visit.queue_number || '?') +
                ' · ' + (summary.state_label || stateMeta.label || visit.state || 'Visit');
        }

        var bodyEl = document.getElementById('nc-visit-drawer-body');
        if (!bodyEl) {
            return;
        }

        var auditHtml = (window.NewClinicUI && window.NewClinicUI.renderAuditTimeline)
            ? window.NewClinicUI.renderAuditTimeline(data.audit_timeline || [])
            : '<em class="text-muted small">No recent activity.</em>';

        bodyEl.innerHTML =
            '<div class="mb-3">' +
            '<div><strong>' + escapeHtml(summary.state_label || visit.state || '') + '</strong></div>' +
            '<div class="small text-muted">' +
            escapeHtml(summary.visit_type_label || '') +
            (summary.started_at_label ? ' · Started ' + escapeHtml(summary.started_at_label) : '') +
            (summary.provider_hint ? ' · ' + escapeHtml(summary.provider_hint) : '') +
            '</div>' +
            (summary.chief_complaint
                ? '<div class="small mt-2"><strong>Chief complaint:</strong> ' +
                escapeHtml(summary.chief_complaint) + '</div>'
                : '') +
            '</div>' +
            '<h6 class="small text-uppercase text-muted">Audit timeline</h6>' +
            auditHtml;

        var historyEl = document.getElementById('nc-visit-drawer-history');
        if (historyEl) {
            if (data.chart_history_url) {
                historyEl.href = data.chart_history_url;
                historyEl.style.display = '';
            } else {
                historyEl.style.display = 'none';
            }
        }
    }

    function openVisitModal(root, visitId) {
        var ajaxUrl = root.dataset.ajaxUrl;
        var csrfToken = root.dataset.csrfToken;
        var deskUrls = parseDeskUrls(root);
        var canCancel = root.dataset.canCancel === '1';
        var bodyEl = document.getElementById('nc-visit-modal-body');
        var footerEl = document.getElementById('nc-visit-modal-footer');
        var titleEl = document.getElementById('nc-visit-modal-title');

        bodyEl.innerHTML = '<em>Loading…</em>';
        footerEl.innerHTML = '';
        titleEl.textContent = 'Visit #' + visitId + ' — …';
        hideDrawer();
        showModal();

        postJson(ajaxUrl + '?action=visit.detail', {
            visit_id: visitId,
            csrf_token_form: csrfToken
        }).then(function (result) {
            if (!result.payload.success) {
                bodyEl.innerHTML = '<div class="alert alert-danger">' +
                    escapeHtml(result.payload.message || 'Error') + '</div>';
                return;
            }

            var data = result.payload.data;
            var visit = data.visit || {};
            var preview = data.preview || {};
            var summary = data.visit_summary || {};
            var identity = preview.identity || {};
            var completion = preview.completion || {};
            var stateMeta = window.NewClinicUI && window.NewClinicUI.visitStateMeta
                ? window.NewClinicUI.visitStateMeta[visit.state] || {}
                : {};

            titleEl.textContent = 'Visit #' + (visit.queue_number || '?') + ' — ' +
                (summary.state_label || stateMeta.label || visit.state || 'Visit');

            var bannerHtml = (window.NewClinicUI && window.NewClinicUI.renderPatientContextBannerTier1)
                ? window.NewClinicUI.renderPatientContextBannerTier1(preview, {
                    host: 'visit_board',
                    visit: visit,
                    skippedTriage: !!data.skipped_triage,
                    isUrgent: !!parseInt(visit.is_urgent, 10),
                    chiefComplaint: visit.chief_complaint || summary.chief_complaint,
                    dobLabel: summary.dob_label || null
                })
                : '';

            var completionBanner = (window.NewClinicUI && window.NewClinicUI.renderCompletionBanner)
                ? window.NewClinicUI.renderCompletionBanner(Object.assign({}, completion, { pid: identity.pid }))
                : '';

            bodyEl.innerHTML = completionBanner + bannerHtml + renderVisitSummary(summary);

            var action = deskActionForState(visit.state, deskUrls);
            var chartUrl = completion.chart_open_url || completion.chart_url || '';
            var footerHtml = '';
            if (action) {
                footerHtml += '<a class="btn btn-primary mb-1" href="' + escapeHtml(action.url) + '" target="_top">' +
                    escapeHtml(action.label) + '</a> ';
            }
            if (chartUrl) {
                footerHtml += '<a class="btn btn-outline-secondary mb-1" href="' + escapeHtml(chartUrl) +
                    '" target="_blank" rel="noopener noreferrer">Open full chart</a> ';
            }
            if (canCancel && visit.state !== 'cancelled' && visit.state !== 'completed') {
                footerHtml += '<button type="button" class="btn btn-outline-danger mb-1" id="nc-modal-cancel">' +
                    'Cancel visit</button> ';
            }
            footerHtml += '<button type="button" class="btn btn-link mb-1" id="nc-modal-more-details">' +
                'More details…</button> ';
            footerHtml += '<button type="button" class="btn btn-secondary mb-1" id="nc-modal-close">Close</button>';
            footerEl.innerHTML = footerHtml;

            var closeBtn = document.getElementById('nc-modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', hideModal);
            }

            var moreBtn = document.getElementById('nc-modal-more-details');
            if (moreBtn) {
                moreBtn.addEventListener('click', function () {
                    renderDrawerContent(data);
                    showDrawer();
                });
            }

            var cancelBtn = document.getElementById('nc-modal-cancel');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function () {
                    var reason = window.prompt('Cancel reason:');
                    if (!reason) {
                        return;
                    }
                    postJson(ajaxUrl + '?action=visit.cancel', {
                        visit_id: visitId,
                        row_version: parseInt(visit.row_version, 10) || 0,
                        reason: reason,
                        csrf_token_form: csrfToken
                    }).then(function (cancelResult) {
                        if (!cancelResult.payload.success) {
                            var handled = window.NewClinicUI && window.NewClinicUI.handleVisitConflictUi(cancelResult, {
                                onMessage: function (message) {
                                    window.alert(message || 'Cancel failed');
                                },
                                onRefresh: function () {
                                    hideModal();
                                    loadBoard(root);
                                }
                            });
                            if (handled) {
                                return;
                            }
                            window.alert(cancelResult.payload.message || 'Cancel failed');
                            return;
                        }
                        hideModal();
                        loadBoard(root);
                    }).catch(function () {
                        window.alert('Network error — cancel failed');
                    });
                });
            }
        }).catch(function () {
            bodyEl.innerHTML = '<div class="alert alert-danger">Failed to load visit details.</div>';
        });
    }

    function deskQuerySuffix(root) {
        if (window.NewClinicUI && window.NewClinicUI.facilityQuerySuffix) {
            return window.NewClinicUI.facilityQuerySuffix(root);
        }
        var facilityId = parseInt(root.dataset.facilityId || '0', 10);
        return facilityId > 0 ? '&facility_id=' + encodeURIComponent(String(facilityId)) : '';
    }

    function loadBoard(root) {
        var ajaxUrl = root.dataset.ajaxUrl;
        var guard = getBoardLoadGuard();
        var token = guard.next();
        window.NewClinicUI.getJson(ajaxUrl + '?action=visit.board' + deskQuerySuffix(root))
            .then(function (result) {
                if (guard.isStale(token)) {
                    return;
                }
                var payload = result.payload;
                if (!payload.success) {
                    var columnsEl = root.querySelector('#nc-board-columns');
                    if (columnsEl) {
                        columnsEl.innerHTML =
                            '<div class="col-12 alert alert-danger">' +
                            escapeHtml(payload.message || 'Failed to load board') + '</div>';
                    }
                    return;
                }
                renderBoard(root, payload.data);
            })
            .catch(function (err) {
                if (guard.isStale(token)) {
                    return;
                }
                var columnsEl = root.querySelector('#nc-board-columns');
                if (columnsEl) {
                    columnsEl.innerHTML =
                        '<div class="col-12 alert alert-danger">' +
                        escapeHtml(err && err.message ? err.message : 'Failed to load board') + '</div>';
                }
            });
    }

    function schedulePoll(root) {
        window.clearInterval(pollTimer);
        pollTimer = window.setInterval(function () {
            if (document.hidden) {
                return;
            }
            loadBoard(root);
        }, window.NewClinicUI ? window.NewClinicUI.resolveQueuePollMs(root) : POLL_MS);
    }

    function init(root) {
        if (!root) {
            return;
        }

        loadBoard(root);
        schedulePoll(root);

        if (isWallProfile(root)) {
            var banner = document.getElementById('nc-wall-now-serving');
            if (banner) {
                banner.dataset.clinicName = banner.textContent;
            }
        }

        var refreshBtn = boardEl('nc-refresh-queue');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                loadBoard(root);
            });
        }
        var searchInput = boardEl('nc-board-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                if (boardData) {
                    renderBoard(root, boardData);
                }
            });
        }
        var urgentInput = boardEl('nc-board-urgent-only');
        if (urgentInput) {
            urgentInput.addEventListener('change', function () {
                if (boardData) {
                    renderBoard(root, boardData);
                }
            });
        }
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) {
                loadBoard(root);
            }
        });

        var modalClose = document.getElementById('nc-visit-modal-close');
        var modalBackdrop = document.getElementById('nc-visit-modal-backdrop');
        if (modalClose) {
            modalClose.addEventListener('click', hideModal);
        }
        if (modalBackdrop) {
            modalBackdrop.addEventListener('click', hideModal);
        }

        ['nc-visit-drawer-close', 'nc-visit-drawer-close-btn'].forEach(function (id) {
            var btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', hideDrawer);
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') {
                return;
            }
            var drawer = document.getElementById('nc-visit-detail-drawer');
            if (drawer && drawer.classList.contains('show')) {
                hideDrawer();
                event.preventDefault();
                return;
            }
            var modal = document.getElementById('nc-visit-modal');
            if (modal && modal.classList.contains('show')) {
                hideModal();
                event.preventDefault();
            }
        });
    }

    window.NewClinicVisitBoard = { init: init };
})(window);

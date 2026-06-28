/**
 * Shared UI render helpers — mirrors templates/partials/ui/* for AJAX paths
 */
(function (window) {
    'use strict';

    var VISIT_STATE = {
        waiting: { variant: 'info', label: 'Waiting' },
        in_triage: { variant: 'info', label: 'In triage' },
        ready_for_doctor: { variant: 'warning', label: 'Ready for doctor' },
        with_doctor: { variant: 'success', label: 'With doctor' },
        ready_for_lab: { variant: 'warning', label: 'Ready for lab' },
        in_lab: { variant: 'info', label: 'In lab' },
        lab_complete: { variant: 'success', label: 'Lab complete' },
        ready_for_pharmacy: { variant: 'warning', label: 'Ready for pharmacy' },
        in_pharmacy: { variant: 'info', label: 'In pharmacy' },
        pharmacy_complete: { variant: 'success', label: 'Pharmacy complete' },
        ready_for_payment: { variant: 'warning', label: 'Ready to pay' },
        completed: { variant: 'success', label: 'Completed' },
        closed_unpaid: { variant: 'danger', label: 'Left unpaid' },
        cancelled: { variant: 'neutral', label: 'Cancelled' }
    };

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function initialsFromName(name) {
        var parts = String(name || '').trim().split(/\s+/);
        if (!parts.length || !parts[0]) {
            return '?';
        }
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    function renderStatusPill(label, variant, showDot) {
        var v = variant || 'neutral';
        var dot = showDot !== false
            ? '<span class="oe-nc-status-pill__dot" aria-hidden="true"></span>'
            : '';
        return '<span class="oe-nc-status-pill oe-nc-status-pill--' + escapeHtml(v) + '">' +
            dot + '<span>' + escapeHtml(label) + '</span></span>';
    }

    function renderVisitStatePill(state, queueNumber) {
        var meta = VISIT_STATE[state] || { variant: 'neutral', label: state || 'Visit' };
        var label = meta.label;
        if (queueNumber) {
            label = '#' + queueNumber + ' ' + label;
        }
        return renderStatusPill(label, meta.variant, true);
    }

    function renderCellIdentity(options) {
        var opts = options || {};
        var initials = opts.initials || initialsFromName(opts.primary);
        var avatarInner = opts.photoUrl
            ? '<img src="' + escapeHtml(opts.photoUrl) + '" alt="">'
            : escapeHtml(initials);
        var metaHtml = opts.metaHtml || '';

        return '<div class="oe-nc-cell-identity">' +
            '<span class="oe-nc-cell-identity__avatar" aria-hidden="true">' + avatarInner + '</span>' +
            '<div class="oe-nc-cell-identity__body">' +
            '<div class="oe-nc-cell-identity__primary" title="' + escapeHtml(opts.primary) + '">' +
            escapeHtml(opts.primary) + '</div>' +
            '<div class="oe-nc-cell-identity__secondary" title="' + escapeHtml(opts.secondary || '') + '">' +
            escapeHtml(opts.secondary || '') + '</div>' +
            (metaHtml ? '<div class="oe-nc-cell-identity__meta">' + metaHtml + '</div>' : '') +
            '</div></div>';
    }

    function renderProgressBar(score, threshold) {
        var value = parseInt(score, 10) || 0;
        var min = threshold || 70;
        var mod = value >= min ? 'success' : (value >= min - 20 ? 'warning' : 'warning');
        return '<div class="oe-nc-progress-bar oe-nc-progress-bar--' + mod + '" role="progressbar" ' +
            'aria-valuenow="' + value + '" aria-valuemin="0" aria-valuemax="100">' +
            '<div class="oe-nc-progress-bar__header">' +
            '<span class="oe-nc-progress-bar__label">Profile complete</span>' +
            '<span class="oe-nc-progress-bar__value">' + value + '%</span></div>' +
            '<div class="oe-nc-progress-bar__track">' +
            '<div class="oe-nc-progress-bar__fill" style="width:' + value + '%"></div></div></div>';
    }

    function completionBannerTone(score) {
        var value = parseInt(score, 10) || 0;
        if (value < 40) {
            return { css: 'danger', icon: 'fa-exclamation-circle', label: 'Profile incomplete' };
        }
        if (value < 70) {
            return { css: 'warning', icon: 'fa-exclamation-triangle', label: 'Profile incomplete' };
        }
        return { css: 'secondary', icon: 'fa-info-circle', label: 'Profile almost complete' };
    }

    function completionBannerStorageKey(pid) {
        return 'nc_completion_remind_later_' + String(pid || '');
    }

    function isCompletionBannerDismissed(pid) {
        if (!pid) {
            return false;
        }
        try {
            return sessionStorage.getItem(completionBannerStorageKey(pid)) === '1';
        } catch (e) {
            return false;
        }
    }

    function dismissCompletionBanner(pid) {
        if (!pid) {
            return;
        }
        try {
            sessionStorage.setItem(completionBannerStorageKey(pid), '1');
        } catch (e) {
            /* ignore */
        }
    }

    /**
     * M1c persistent completion banner (score < 100).
     */
    function renderCompletionBanner(completion, options) {
        options = options || {};
        if (!completion || completion.score === undefined) {
            return '';
        }
        var score = parseInt(completion.score, 10) || 0;
        if (score >= 100) {
            return '';
        }
        var pid = completion.pid || options.pid || 0;
        if (pid && isCompletionBannerDismissed(pid)) {
            return '';
        }

        var tone = completionBannerTone(score);
        var threshold = completion.billing_threshold || 70;
        var missing = completion.missing_labels || [];
        var missingHtml = missing.length
            ? '<div class="small mt-1 text-muted">Missing: ' +
            escapeHtml(missing.slice(0, 3).join(', ')) +
            (missing.length > 3 ? '…' : '') + '</div>'
            : '';

        var message = score < 40
            ? 'Profile incomplete — ' + score + '%. Tap to add missing info.'
            : (score < 70
                ? 'Profile ' + score + '% — please complete soon.'
                : 'Profile ' + score + '% — almost there.');

        var completeHref = completion.chart_url || completion.demographics_url || '';
        var completeBtn = options.registrationMode === 'desk_full_form'
            ? '<button type="button" class="btn btn-sm btn-outline-' + tone.css + ' ml-2 oe-nc-completion-complete" data-pid="' +
            escapeHtml(pid) + '">Complete now</button>'
            : (completeHref
                ? '<a href="' + escapeHtml(completeHref) + '" class="btn btn-sm btn-outline-' + tone.css +
                ' ml-2" target="_top">Complete now</a>'
                : '');

        return '<div class="alert alert-' + tone.css + ' oe-nc-completion-banner py-2 mb-2" role="status" ' +
            'data-pid="' + escapeHtml(pid) + '" id="nc-completion-banner">' +
            '<div class="d-flex flex-wrap align-items-start justify-content-between">' +
            '<div class="flex-grow-1 pr-2">' +
            '<i class="fa ' + tone.icon + ' mr-1" aria-hidden="true"></i>' +
            '<strong>' + escapeHtml(tone.label) + '</strong> — ' + escapeHtml(message) +
            missingHtml +
            renderProgressBar(score, threshold) +
            '</div>' +
            '<div class="d-flex flex-wrap align-items-center mt-1 mt-md-0">' +
            completeBtn +
            '<button type="button" class="btn btn-sm btn-link oe-nc-completion-remind" data-pid="' +
            escapeHtml(pid) + '">Remind later</button>' +
            '</div></div></div>';
    }

    function bindCompletionBannerActions(root, hooks) {
        if (!root) {
            return;
        }
        hooks = hooks || {};
        root.addEventListener('click', function (event) {
            var remind = event.target.closest('.oe-nc-completion-remind');
            if (remind) {
                dismissCompletionBanner(remind.getAttribute('data-pid'));
                var banner = remind.closest('.oe-nc-completion-banner');
                if (banner) {
                    banner.remove();
                }
                return;
            }
            var complete = event.target.closest('.oe-nc-completion-complete');
            if (complete && typeof hooks.onCompleteNow === 'function') {
                hooks.onCompleteNow(parseInt(complete.getAttribute('data-pid'), 10) || 0);
            }
        });
    }

    function renderChipCloud(chips) {
        if (!chips || !chips.length) {
            return '';
        }
        return '<div class="oe-nc-chip-cloud" role="list">' +
            chips.map(function (chip) {
                return '<span class="oe-nc-chip oe-nc-chip--' + escapeHtml(chip.variant || 'warn') +
                    '" role="listitem">' + escapeHtml(chip.label) + '</span>';
            }).join('') +
            '</div>';
    }

    function renderEmptyState(title, message, iconClass) {
        return '<div class="oe-nc-empty-state">' +
            '<div class="oe-nc-empty-state__icon"><i class="fa ' + escapeHtml(iconClass || 'fa-user') +
            '" aria-hidden="true"></i></div>' +
            '<div class="oe-nc-empty-state__title">' + escapeHtml(title) + '</div>' +
            '<p class="mb-0 small">' + escapeHtml(message) + '</p></div>';
    }

    function shellRoot() {
        return document.getElementById('oe-nc-t1');
    }

    function resolveFacilityId(root) {
        var candidates = [];
        if (root && root.dataset && root.dataset.facilityId) {
            candidates.push(parseInt(root.dataset.facilityId, 10));
        }
        var shell = shellRoot();
        if (shell) {
            candidates.push(parseInt(shell.getAttribute('data-facility-id') || '0', 10));
        }
        var i;
        for (i = 0; i < candidates.length; i++) {
            if (candidates[i] > 0) {
                return candidates[i];
            }
        }
        return 0;
    }

    function facilityQuerySuffix(root) {
        var facilityId = resolveFacilityId(root);
        return facilityId > 0 ? '&facility_id=' + encodeURIComponent(String(facilityId)) : '';
    }

    /** Page chrome lives in base.html.twig heading blocks, outside desk roots. */
    function pageEl(id) {
        return document.getElementById(id);
    }

    function setPageText(id, text) {
        var el = pageEl(id);
        if (el) {
            el.textContent = text;
        }
    }

    function bindBootstrapTabUrlState(options) {
        var opts = options || {};
        var tabSelector = opts.tabSelector || '[data-toggle="tab"]';
        var panePrefix = opts.panePrefix || '';
        var defaultTab = opts.defaultTab || '';
        if (!panePrefix || !window.jQuery) {
            return;
        }

        var initialTab = new URL(window.location.href).searchParams.get('tab') || defaultTab;
        if (initialTab) {
            var initialLink = document.querySelector(tabSelector + '[href="#' + panePrefix + initialTab + '"]');
            if (initialLink) {
                window.jQuery(initialLink).tab('show');
            }
        }

        window.jQuery(document).on('shown.bs.tab', tabSelector, function (event) {
            var href = event.target.getAttribute('href') || '';
            if (href.indexOf('#' + panePrefix) !== 0) {
                return;
            }
            var tab = href.slice(('#' + panePrefix).length);
            var url = new URL(window.location.href);
            if (tab && tab !== defaultTab) {
                url.searchParams.set('tab', tab);
            } else {
                url.searchParams.delete('tab');
            }
            window.history.replaceState({}, '', url.toString());
        });
    }

    function createRequestGuard() {
        var seq = 0;
        return {
            next: function () {
                seq += 1;
                return seq;
            },
            isStale: function (token) {
                return token !== seq;
            }
        };
    }

    function networkErrorResult() {
        return {
            status: 0,
            payload: {
                success: false,
                message: 'Network error — check your connection',
                data: { code: 'network_error' }
            }
        };
    }

    function parseJsonResponse(response) {
        return response.text().then(function (text) {
            var payload;
            try {
                payload = text ? JSON.parse(text) : {};
            } catch (err) {
                return {
                    status: response.status,
                    payload: {
                        success: false,
                        message: 'Invalid server response',
                        data: { code: 'parse_error' }
                    }
                };
            }
            return { status: response.status, payload: payload };
        });
    }

    function getJson(url) {
        return fetch(url, { credentials: 'same-origin' })
            .then(parseJsonResponse)
            .catch(networkErrorResult);
    }

    function postJson(url, body) {
        return fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(parseJsonResponse).catch(networkErrorResult);
    }

    function apiPayload(res) {
        return (res && res.payload) ? res.payload : (res || {});
    }

    function mountCompletionBanner(options) {
        options = options || {};
        var slot = options.slot;
        if (typeof slot === 'string') {
            slot = document.querySelector(slot);
        }
        var pid = parseInt(options.pid, 10) || 0;
        var ajaxUrl = options.ajaxUrl || '';
        var csrfToken = options.csrfToken || '';
        if (!slot || pid <= 0 || !ajaxUrl || !csrfToken) {
            return Promise.resolve();
        }

        return postJson(ajaxUrl + '?action=patients.preview', {
            pid: pid,
            csrf_token: csrfToken,
            context: options.context || 'chart-depth'
        }).then(function (res) {
            var payload = apiPayload(res);
            if (!payload.success || !payload.data) {
                return;
            }
            var completion = payload.data.completion || {};
            slot.innerHTML = renderCompletionBanner(Object.assign({}, completion, { pid: pid }));
            bindCompletionBannerActions(slot, options.hooks || {});
        }).catch(function () { /* non-fatal */ });
    }

    function encodeQueueWatch(watchList) {
        if (!watchList || !watchList.length) {
            return '';
        }
        try {
            return '&queue_watch=' + encodeURIComponent(JSON.stringify(watchList));
        } catch (err) {
            return '';
        }
    }

    function claimLostTooltip(card) {
        var by = (card && card.claim_lost_by) || {};
        var role = by.role_label || 'Staff';
        var name = by.display_name || 'Another user';
        return role + ' ' + name + ' took this patient';
    }

    function mergeQueueWithClaimLost(visits, claimLostCards) {
        var merged = (visits || []).slice();
        var byId = {};
        merged.forEach(function (visit) {
            byId[String(visit.id)] = visit;
        });
        (claimLostCards || []).forEach(function (card) {
            var id = String(card.id);
            if (byId[id]) {
                Object.assign(byId[id], card);
            } else {
                merged.push(card);
                byId[id] = card;
            }
        });
        return merged;
    }

    function formatTakenElsewhereHtml(opts) {
        var options = opts || {};
        var role = escapeHtml(options.taker_role_label || 'Staff');
        var name = escapeHtml(options.taker_display_name || 'Another user');
        var patient = escapeHtml(options.patient_display_name || '');
        var mrn = escapeHtml(options.patient_mrn || '');
        var queue = escapeHtml(options.queue_number || '');
        var html = '<strong>' + role + ' ' + name + '</strong> took this patient';
        if (patient) {
            html += ' — ' + patient;
        }
        if (mrn) {
            html += ' · MRN ' + mrn;
        }
        if (queue) {
            html += ' · #' + queue;
        }
        return html + '.';
    }

    function resolveQueuePollMs(root) {
        var candidates = [];
        if (root && root.dataset && root.dataset.queuePollMs) {
            candidates.push(parseInt(root.dataset.queuePollMs, 10));
        }
        var shell = shellRoot();
        if (shell && shell.getAttribute('data-queue-poll-ms')) {
            candidates.push(parseInt(shell.getAttribute('data-queue-poll-ms'), 10));
        }
        var i;
        for (i = 0; i < candidates.length; i++) {
            if (candidates[i] >= 10000 && candidates[i] <= 60000) {
                return candidates[i];
            }
        }
        return 30000;
    }

    function similarSurnameBadge(card) {
        if (!card || !card.similar_surname_today) {
            return '';
        }
        return '<span class="badge badge-warning ml-1" title="Another patient in today\'s queue shares this surname">' +
            'Same surname today</span>';
    }

    function privacyDisplayName(displayName) {
        var parts = String(displayName || '').trim().split(/\s+/);
        if (!parts.length || !parts[0]) {
            return '—';
        }
        if (parts.length === 1) {
            return parts[0].charAt(0) + '.';
        }
        return parts[0] + ' ' + parts[parts.length - 1].charAt(0) + '.';
    }

    function renderQueueCard(card, options) {
        var opts = options || {};
        var interactive = opts.interactive !== false;
        var tag = interactive ? 'button' : 'div';
        var typeAttr = interactive ? ' type="button"' : '';
        var modifiers = opts.modifiers || [];
        if (parseInt(card.is_urgent, 10)) {
            modifiers.push('urgent');
        }
        if (opts.disabled) {
            modifiers.push('disabled');
        }
        if (card.claim_lost) {
            modifiers.push('claim-lost');
        }
        var modifierClass = modifiers.map(function (modifier) {
            return ' oe-nc-queue-card--' + modifier;
        }).join('');

        var claimTitle = card.claim_lost ? ' title="' + escapeHtml(claimLostTooltip(card)) + '"' : '';
        var disabledAttr = (opts.disabled || card.claim_lost) && interactive ? ' disabled' : '';
        var disabledTitle = opts.disabled && opts.disabledTitle
            ? ' title="' + escapeHtml(opts.disabledTitle) + '"' : '';

        var displayName = opts.privacyMode ? privacyDisplayName(card.display_name) : (card.display_name || '');
        var surnameBadge = similarSurnameBadge(card);
        var titleHtml = opts.titleHtml
            ? (opts.titleHtml + surnameBadge)
            : ('<strong>#' + escapeHtml(card.queue_number) + ' ' + escapeHtml(displayName) + '</strong>' +
                (opts.badgesHtml || '') + surnameBadge);
        var subtitleHtml = opts.subtitleHtml || (
            '<div class="oe-nc-queue-card__meta small text-muted">' +
            escapeHtml(card.sex || '') + ' · ' + escapeHtml(card.age_years || '—') +
            ' · ' + escapeHtml(card.wait_minutes) + 'm waiting' +
            '</div>'
        );
        var cc = card.chief_complaint && opts.showChiefComplaint !== false
            ? '<div class="oe-nc-queue-card__cc small text-muted text-truncate">CC: ' +
            escapeHtml(card.chief_complaint) + '</div>' : '';
        var footerHtml = opts.footerHtml || '';

        var dataAttrs = '';
        Object.keys(opts.dataAttributes || {}).forEach(function (key) {
            dataAttrs += ' data-' + key + '="' + escapeHtml(opts.dataAttributes[key]) + '"';
        });
        if (!opts.dataAttributes && card.id) {
            dataAttrs += ' data-visit-id="' + escapeHtml(card.id) + '"';
        }

        var btnClasses = interactive ? ' btn btn-light text-left' : '';

        return '<' + tag + typeAttr +
            ' class="oe-nc-queue-card nc-queue-card' + btnClasses + ' w-100 mb-2' + modifierClass + '"' +
            dataAttrs + claimTitle + disabledTitle + disabledAttr + '>' +
            '<div class="oe-nc-queue-card__header d-flex justify-content-between align-items-start flex-wrap">' +
            titleHtml +
            '</div>' +
            subtitleHtml + cc + footerHtml +
            '</' + tag + '>';
    }

    function processClaimLostPoll(data, options) {
        var opts = options || {};
        var cards = (data && data.claim_lost_cards) || [];
        if (!cards.length) {
            return;
        }
        var activeId = opts.activeVisitId != null ? String(opts.activeVisitId) : '';
        var highlightId = opts.highlightedVisitId != null ? String(opts.highlightedVisitId) : '';
        cards.forEach(function (card) {
            var cardId = String(card.id);
            if (activeId && cardId === activeId && typeof opts.onActivePaneLost === 'function') {
                opts.onActivePaneLost(card);
            } else if (highlightId && cardId === highlightId && typeof opts.onHighlightLost === 'function') {
                opts.onHighlightLost(card);
            }
        });
    }

    function resolveVisitConflict(result) {
        var res = result || {};
        if (res.status !== 409) {
            return null;
        }
        var payload = apiPayload(res);
        var data = payload.data || {};
        var code = data.code || '';
        if (data.interrupt === 'taken_elsewhere') {
            return {
                type: 'taken_elsewhere',
                message: payload.message || 'This visit was claimed by another user.',
                html: formatTakenElsewhereHtml(data)
            };
        }
        if (code === 'stale_visit') {
            return {
                type: 'stale_visit',
                message: payload.message || 'Visit was updated by another user.'
            };
        }
        if (code === 'visit_not_takeable') {
            return {
                type: 'visit_not_takeable',
                message: payload.message || 'Visit is not available.'
            };
        }
        return null;
    }

    function setDeskActiveVisitId(storageKey, visitId) {
        if (!storageKey || !visitId) {
            return;
        }
        try {
            window.sessionStorage.setItem(storageKey, String(visitId));
        } catch (e) {
            // private mode / quota — ignore
        }
    }

    function clearDeskActiveVisitId(storageKey) {
        if (!storageKey) {
            return;
        }
        try {
            window.sessionStorage.removeItem(storageKey);
        } catch (e) {
            // ignore
        }
    }

    function isSharedDeviceBlocked(root) {
        return !!(root && root.dataset && root.dataset.sharedDeviceBlocked === '1');
    }

    function renderSharedDeviceBannerHtml(data) {
        var visit = (data && data.visit) || {};
        var session = (data && data.session) || {};
        var visitLine = 'Desk visit: ' + (visit.display_name || '—') +
            ' · Queue #' + (visit.queue_number || '—');
        var sessionLine = 'Session patient: ' + (session.display_name || '—') +
            (session.pubpid ? ' · MRN ' + session.pubpid : '');

        return '<strong>Browser session is on another patient.</strong>' +
            '<div class="small mt-1">' + escapeHtml(visitLine) + '</div>' +
            '<div class="small">' + escapeHtml(sessionLine) + '</div>' +
            '<div class="small mt-1">Restore encounter session or return to the queue before saving.</div>';
    }

    function wireSharedDeviceSessionWarning(root, options) {
        options = options || {};
        if (!root || root.dataset.sharedDeviceWarning !== '1' || !options.storageKey) {
            return;
        }

        var banner = document.getElementById(options.bannerId);
        var bannerText = document.getElementById(options.bannerTextId);
        var restoreBtn = document.getElementById(options.restoreButtonId);
        var returnBtn = document.getElementById(options.returnQueueButtonId);
        var compareMode = options.compareMode || 'clinical';
        var restoreAction = options.restoreAction || '';

        function hideBanner() {
            if (banner) {
                banner.classList.add('d-none');
            }
            root.dataset.sharedDeviceBlocked = '0';
        }

        function showBanner(html) {
            if (bannerText) {
                bannerText.innerHTML = html;
            }
            if (banner) {
                banner.classList.remove('d-none');
            }
            if (restoreBtn) {
                if (compareMode === 'pid_only') {
                    restoreBtn.classList.add('d-none');
                } else {
                    restoreBtn.classList.remove('d-none');
                }
            }
            root.dataset.sharedDeviceBlocked = '1';
        }

        function probeAndUpdate() {
            var visitId = parseInt(window.sessionStorage.getItem(options.storageKey) || '0', 10);
            if (visitId <= 0) {
                hideBanner();
                return Promise.resolve();
            }

            var suffix = facilityQuerySuffix(root);
            var url = root.dataset.ajaxUrl + '?action=desk.shared_session_probe' +
                '&visit_id=' + encodeURIComponent(String(visitId)) +
                '&compare_mode=' + encodeURIComponent(compareMode) + suffix;

            return getJson(url).then(function (result) {
                var payload = (result.payload && result.payload.data) || {};
                if (!payload.enabled || !payload.mismatch) {
                    hideBanner();
                    return;
                }
                showBanner(renderSharedDeviceBannerHtml(payload));
            }).catch(function () {
                hideBanner();
            });
        }

        if (returnBtn) {
            returnBtn.addEventListener('click', function () {
                clearDeskActiveVisitId(options.storageKey);
                hideBanner();
                if (typeof options.onReturnToQueue === 'function') {
                    options.onReturnToQueue();
                }
            });
        }

        if (restoreBtn && restoreAction) {
            restoreBtn.addEventListener('click', function () {
                var visitId = parseInt(window.sessionStorage.getItem(options.storageKey) || '0', 10);
                if (visitId <= 0) {
                    return;
                }
                postJson(root.dataset.ajaxUrl + '?action=' + restoreAction, {
                    visit_id: visitId,
                    csrf_token_form: root.dataset.csrfToken
                }).then(function (result) {
                    if (result.payload.success) {
                        hideBanner();
                        if (typeof options.onSessionRestored === 'function') {
                            options.onSessionRestored();
                        }
                    }
                });
            });
        }

        window.addEventListener('pageshow', probeAndUpdate);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) {
                probeAndUpdate();
            }
        });

        probeAndUpdate();
    }

    /**
     * Tier 1 patient-context-banner (M2-F13, shared §4.11).
     *
     * @param {object} preview PatientPreviewDto from patients.preview / visit.detail
     * @param {object} [options]
     * @returns {string}
     */
    function renderPatientContextBannerTier1(preview, options) {
        options = options || {};
        var identity = preview.identity || {};
        var safety = preview.safety || {};
        var completion = preview.completion || {};
        var activeVisit = preview.active_visit || options.visit || null;
        var vitals = preview.vitals_today || {};
        var host = options.host || 'visit_board';
        var initials = initialsFromName(identity.display_name);
        var metaParts = [
            identity.sex || '—',
            (identity.age_years !== undefined && identity.age_years !== null ? identity.age_years + 'y' : '—'),
            'MRN ' + (identity.pubpid || '—')
        ];
        if (options.dobLabel) {
            metaParts.push('DOB ' + options.dobLabel);
        }
        if (identity.dob_estimated) {
            metaParts.push('Est. DOB');
        }
        var metaLine = metaParts.join(' · ');

        var chips = [];
        if (safety.allergies_undocumented) {
            chips.push({ label: 'Allergies not documented', variant: 'warn' });
        } else if ((safety.allergies_severe || []).length) {
            (safety.allergies_severe || []).slice(0, 3).forEach(function (allergy) {
                chips.push({ label: allergy, variant: 'severe' });
            });
        }
        if (preview.pediatric_dob_block) {
            chips.push({ label: 'Exact DOB required before payment', variant: 'warn' });
        }
        if (options.isUrgent || (activeVisit && parseInt(activeVisit.is_urgent, 10))) {
            chips.push({ label: 'URGENT', variant: 'warn' });
        }
        if (options.skippedTriage) {
            chips.push({ label: 'Skipped triage', variant: 'neutral' });
        }
        if (vitals.vitals_abnormal_today) {
            chips.push({ label: 'Vitals abnormal', variant: 'severe' });
        } else if (vitals.vitals_missing_today && activeVisit) {
            chips.push({ label: 'No vitals today', variant: 'warn' });
        }

        var cc = (activeVisit && activeVisit.chief_complaint) || options.chiefComplaint || '';
        var detailParts = [];
        if (cc) {
            detailParts.push('CC: ' + cc);
        }
        if (vitals.summary) {
            detailParts.push('Vitals today: ' + vitals.summary);
        }
        var detailLine = detailParts.length
            ? '<div class="oe-nc-patient-banner__detail small text-muted mt-1">' +
            escapeHtml(detailParts.join(' · ')) + '</div>'
            : '';

        var completionPill = (completion.score !== undefined && completion.score < 100)
            ? renderStatusPill(
                (completion.score || 0) + '% complete',
                completion.score >= (completion.billing_threshold || 70) ? 'info' : 'warn',
                true
            )
            : '';

        return '<div class="oe-nc-patient-banner nc-patient-context-banner" id="nc-patient-context-banner"' +
            ' data-tier="1" data-host="' + escapeHtml(host) + '">' +
            '<div class="oe-nc-patient-banner__header">' +
            '<div class="oe-nc-patient-banner__avatar" aria-hidden="true">' + escapeHtml(initials) + '</div>' +
            '<div class="oe-nc-patient-banner__identity">' +
            '<h3 class="oe-nc-patient-banner__name">' + escapeHtml(identity.display_name || '—') + '</h3>' +
            '<div class="oe-nc-patient-banner__meta">' + escapeHtml(metaLine) + '</div>' +
            detailLine +
            '</div>' +
            (completionPill ? '<div class="oe-nc-patient-banner__aside text-right">' + completionPill + '</div>' : '') +
            '</div>' +
            (chips.length ? '<div class="oe-nc-patient-banner__section">' + renderChipCloud(chips) + '</div>' : '') +
            '</div>';
    }

    /**
     * @param {Array<object>} items
     * @returns {string}
     */
    function renderAuditTimeline(items) {
        if (!items || !items.length) {
            return '<em class="text-muted small">No recent activity.</em>';
        }
        return '<ul class="list-unstyled mb-0 nc-audit-timeline">' + items.map(function (item) {
            var subtitle = item.subtitle
                ? '<div class="small text-muted">' + escapeHtml(item.subtitle) + '</div>'
                : '';
            return '<li class="nc-audit-timeline__item py-2 border-bottom">' +
                '<div class="d-flex justify-content-between">' +
                '<strong class="small">' + escapeHtml(item.label || '') + '</strong>' +
                '<span class="small text-muted">' + escapeHtml(item.at_label || '') + '</span>' +
                '</div>' + subtitle + '</li>';
        }).join('') + '</ul>';
    }

    window.NewClinicUI = {
        escapeHtml: escapeHtml,
        initialsFromName: initialsFromName,
        renderStatusPill: renderStatusPill,
        renderVisitStatePill: renderVisitStatePill,
        renderCellIdentity: renderCellIdentity,
        renderProgressBar: renderProgressBar,
        renderCompletionBanner: renderCompletionBanner,
        bindCompletionBannerActions: bindCompletionBannerActions,
        dismissCompletionBanner: dismissCompletionBanner,
        apiPayload: apiPayload,
        mountCompletionBanner: mountCompletionBanner,
        renderChipCloud: renderChipCloud,
        renderEmptyState: renderEmptyState,
        visitStateMeta: VISIT_STATE,
        resolveFacilityId: resolveFacilityId,
        facilityQuerySuffix: facilityQuerySuffix,
        resolveQueuePollMs: resolveQueuePollMs,
        pageEl: pageEl,
        setPageText: setPageText,
        bindBootstrapTabUrlState: bindBootstrapTabUrlState,
        createRequestGuard: createRequestGuard,
        parseJsonResponse: parseJsonResponse,
        getJson: getJson,
        postJson: postJson,
        encodeQueueWatch: encodeQueueWatch,
        claimLostTooltip: claimLostTooltip,
        mergeQueueWithClaimLost: mergeQueueWithClaimLost,
        formatTakenElsewhereHtml: formatTakenElsewhereHtml,
        processClaimLostPoll: processClaimLostPoll,
        resolveVisitConflict: resolveVisitConflict,
        renderQueueCard: renderQueueCard,
        privacyDisplayName: privacyDisplayName,
        setDeskActiveVisitId: setDeskActiveVisitId,
        clearDeskActiveVisitId: clearDeskActiveVisitId,
        isSharedDeviceBlocked: isSharedDeviceBlocked,
        wireSharedDeviceSessionWarning: wireSharedDeviceSessionWarning,
        renderPatientContextBannerTier1: renderPatientContextBannerTier1,
        renderAuditTimeline: renderAuditTimeline
    };
}(window));

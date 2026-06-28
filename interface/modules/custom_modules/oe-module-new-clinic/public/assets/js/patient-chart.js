(function (window) {
    'use strict';

    var TAB_IDS = ['overview', 'profile', 'visits', 'clinical', 'messages'];

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

    function ui() {
        return window.NewClinicUI || {};
    }

    function completionVariant(score, threshold) {
        var t = threshold || 70;
        if (score >= t) {
            return 'success';
        }
        if (score >= t - 15) {
            return 'warn';
        }
        return 'danger';
    }

    function formatStateLabel(state) {
        if (!state) {
            return '—';
        }
        return String(state).replace(/_/g, ' ');
    }

    function renderBanner(container, data) {
        if (!container || !data) {
            return;
        }

        var U = ui();
        var identity = data.identity || {};
        var safety = data.safety || {};
        var completion = data.completion || {};
        var initials = U.initialsFromName ? U.initialsFromName(identity.display_name) : '—';
        var metaLine = (identity.sex || '—') + ' · ' + (identity.age_years || '—') +
            ' · MRN ' + (identity.pubpid || '—') +
            (identity.phone_masked ? ' · ' + identity.phone_masked : '');
        var completionPill = U.renderStatusPill
            ? U.renderStatusPill(
                (completion.score || 0) + '% complete',
                completionVariant(completion.score, completion.billing_threshold),
                true
            )
            : '';

        var chips = '';
        if (safety.allergies_undocumented) {
            chips = '<div class="oe-nc-patient-banner__section">' +
                (U.renderChipCloud ? U.renderChipCloud([{ label: 'Allergies undocumented', variant: 'warn' }]) : '') +
                '</div>';
        }

        var active = data.active_visit;
        if (active && active.encounter_signed === false) {
            var signVariant = active.require_esign_before_complete_consult ? 'danger' : 'warn';
            var signLabel = active.require_esign_before_complete_consult
                ? 'Unsigned — sign before complete'
                : 'Unsigned — payment blocked';
            chips += '<div class="oe-nc-patient-banner__section mt-2">' +
                (U.renderChipCloud ? U.renderChipCloud([{ label: signLabel, variant: signVariant }]) : '') +
                '</div>';
        }

        container.innerHTML =
            (U.renderCompletionBanner
                ? U.renderCompletionBanner(Object.assign({}, completion, { pid: identity.pid }))
                : '') +
            '<div class="oe-nc-patient-banner nc-patient-context-banner">' +
            '<div class="oe-nc-patient-banner__header">' +
            '<div class="oe-nc-patient-banner__avatar" aria-hidden="true">' + escapeHtml(initials) + '</div>' +
            '<div class="oe-nc-patient-banner__identity">' +
            '<h3 class="oe-nc-patient-banner__name">' + escapeHtml(identity.display_name) + '</h3>' +
            '<div class="oe-nc-patient-banner__meta">' + escapeHtml(metaLine) + '</div>' +
            '</div>' +
            '<div class="oe-nc-patient-banner__aside text-right">' + completionPill + '</div>' +
            '</div>' +
            chips +
            '</div>';
    }

    function renderChecklist(container, byLevel, completion) {
        if (!container) {
            return;
        }

        if (!byLevel || !byLevel.length) {
            container.innerHTML = '';
            return;
        }

        var threshold = (completion && completion.billing_threshold) || 70;
        var score = (completion && completion.score) || 0;
        var levelsHtml = byLevel.map(function (level) {
            var fields = (level.fields || []).map(function (field) {
                var mark = field.complete ? '✓' : '○';
                var cls = field.complete ? 'text-success' : 'text-muted';
                return '<li class="small ' + cls + '">' + mark + ' ' + escapeHtml(field.label) + '</li>';
            }).join('');
            var sectionMark = level.complete ? '✓' : '○';
            return '<div class="col-md-6 col-lg-3 mb-2">' +
                '<div class="border rounded p-2 h-100' + (level.complete ? ' bg-light' : '') + '">' +
                '<strong>' + sectionMark + ' ' + escapeHtml(level.label) + '</strong>' +
                '<ul class="list-unstyled mb-0 mt-1 pl-2">' + fields + '</ul>' +
                '</div></div>';
        }).join('');

        container.innerHTML =
            '<div class="nc-profile-checklist">' +
            '<h5 class="mb-2">Profile completion <span class="text-muted small">(' +
            escapeHtml(String(score)) + '% · ' + escapeHtml(String(threshold)) + '% for billing)</span></h5>' +
            '<div class="row">' + levelsHtml + '</div></div>';
    }

    function renderActionRequired(items) {
        if (!items || !items.length) {
            return '';
        }

        var rows = items.map(function (item) {
            var actionBtn = item.action_url
                ? '<a class="btn btn-sm btn-outline-primary ml-2" href="' +
                escapeHtml(item.action_url) + '" target="_top">' + escapeHtml('Open encounter') + '</a>'
                : '';
            var badge = item.badge
                ? '<span class="badge badge-warning mr-2">' + escapeHtml(item.badge) + '</span>'
                : '';
            return '<div class="d-flex flex-wrap align-items-start border rounded p-2 mb-2 bg-light">' +
                '<div class="flex-grow-1">' + badge +
                '<strong>' + escapeHtml(item.title || 'Action required') + '</strong>' +
                '<div class="small text-muted">' + escapeHtml(item.message || '') + '</div>' +
                '</div>' + actionBtn + '</div>';
        }).join('');

        return '<div class="mb-3">' +
            '<h6 class="mb-2">' + escapeHtml('Action required') + '</h6>' + rows + '</div>';
    }

    function renderActivityFeedItem(item) {
        var expand = item.expand || {};
        var detail = '';
        if (item.event_type === 'lab_result_ready' && expand.procedure_name) {
            detail = '<div class="small text-muted mt-1">' +
                escapeHtml(expand.procedure_name) +
                (item.queue_number ? ' · Queue #' + escapeHtml(String(item.queue_number)) : '') +
                '</div>';
        } else if (expand.to_state) {
            detail = '<div class="small text-muted mt-1">' +
                escapeHtml('Queue #' + (item.queue_number || '—')) +
                (expand.reason ? ' · ' + escapeHtml(expand.reason) : '') +
                '</div>';
        }

        return '<div class="border-bottom py-2 nc-activity-feed-item" data-event-type="' +
            escapeHtml(item.event_type || '') + '">' +
            '<div class="d-flex justify-content-between">' +
            '<strong class="small">' + escapeHtml(item.title || '—') + '</strong>' +
            '</div>' +
            '<div class="small text-muted">' + escapeHtml(item.subtitle || '') + '</div>' +
            detail + '</div>';
    }

    function renderActivityFeedSection(feed, showLoadMore) {
        var items = (feed && feed.items) || [];
        if (!items.length) {
            return '<div class="mb-3">' +
                '<h6 class="mb-2">' + escapeHtml('Recent activity') + '</h6>' +
                '<p class="text-muted small mb-0">' + escapeHtml('No recent visit activity.') + '</p></div>';
        }

        var loadMore = showLoadMore && feed.has_more
            ? '<button type="button" class="btn btn-outline-secondary btn-sm mt-2" ' +
            'data-action="load-more-activity">' + escapeHtml('Load more') + '</button>'
            : '';

        return '<div class="mb-3">' +
            '<h6 class="mb-2">' + escapeHtml('Recent activity') +
            ' <span class="text-muted small">(' + escapeHtml(String(feed.lookback_days || 90)) +
            'd)</span></h6>' +
            '<div id="nc-chart-activity-feed-list">' +
            items.map(renderActivityFeedItem).join('') +
            '</div>' + loadMore + '</div>';
    }

    function renderOverviewPane(container, data, visitBoardUrl, onEditProfile) {
        if (!container) {
            return;
        }

        var active = data.active_visit;
        var last = data.last_visit || {};
        var safety = data.safety || {};
        var completion = data.completion || {};
        var U = ui();

        var activeHtml;
        if (active && active.visit_id) {
            var boardLink = visitBoardUrl
                ? '<a class="btn btn-sm btn-outline-primary ml-2" href="' +
                escapeHtml(visitBoardUrl) + '">' + escapeHtml('Open visit board') + '</a>'
                : '';
            activeHtml =
                '<div class="border rounded p-3 mb-3 bg-light">' +
                '<h5 class="mb-2">' + escapeHtml('Today\'s visit') + '</h5>' +
                '<div><strong>#' + escapeHtml(active.queue_number) + '</strong> · ' +
                escapeHtml(formatStateLabel(active.state)) + boardLink + '</div>' +
                (active.chief_complaint
                    ? '<div class="small text-muted mt-1">CC: ' + escapeHtml(active.chief_complaint) + '</div>'
                    : '') +
                '</div>';
        } else {
            activeHtml =
                '<div class="border rounded p-3 mb-3 text-muted">' +
                escapeHtml('No active visit today.') +
                '</div>';
        }

        var lastHtml = last.label
            ? '<div class="mb-3"><strong>' + escapeHtml('Last visit') + ':</strong> ' +
            escapeHtml(last.label) + '</div>'
            : '';

        var allergyChips = [];
        if (safety.allergies_undocumented) {
            allergyChips.push({ label: 'Allergies undocumented', variant: 'warn' });
        }
        (safety.allergies_severe || []).forEach(function (title) {
            allergyChips.push({ label: title, variant: 'danger' });
        });
        var safetyHtml = allergyChips.length && U.renderChipCloud
            ? '<div class="mb-3"><h6 class="mb-2">' + escapeHtml('Safety') + '</h6>' +
            U.renderChipCloud(allergyChips) + '</div>'
            : '';

        var problemsHtml = safety.problem_count
            ? '<div class="mb-3 small text-muted">' + escapeHtml('Active problems') + ': ' +
            escapeHtml(String(safety.problem_count)) + '</div>'
            : '';

        var vitals = data.vitals_today || {};
        var vitalsHtml;
        if (vitals.summary) {
            vitalsHtml =
                '<div class="border rounded p-3 mb-3">' +
                '<h6 class="mb-2">' + escapeHtml('Vitals today') + '</h6>' +
                '<div>' + escapeHtml(vitals.summary) +
                (vitals.pain_score !== null && vitals.pain_score !== undefined && vitals.pain_score !== ''
                    ? ' · Pain ' + escapeHtml(String(vitals.pain_score)) : '') +
                '</div>';
            if (vitals.vitals_abnormal_today) {
                vitalsHtml += '<div class="mt-2">' +
                    (U.renderChipCloud ? U.renderChipCloud((vitals.vitals_breach_list || []).map(function (w) {
                        return { label: w, variant: 'danger' };
                    })) : escapeHtml((vitals.vitals_breach_list || []).join(', '))) +
                    '</div>';
            }
            vitalsHtml += '</div>';
        } else {
            vitalsHtml =
                '<div class="border rounded p-3 mb-3 text-muted small">' +
                escapeHtml('No vitals recorded today.') +
                '</div>';
        }

        var missingLabels = completion.missing_labels || [];
        var missingHtml = missingLabels.length
            ? '<div class="mb-3 small text-muted">' + escapeHtml('Missing for billing') + ': ' +
            escapeHtml(missingLabels.slice(0, 3).join(', ')) +
            (missingLabels.length > 3 ? '…' : '') + '</div>'
            : '';

        var pediatricHtml = data.pediatric_dob_block
            ? '<div class="alert alert-warning py-2">' +
            escapeHtml('Estimated DOB — verify for patients under 5.') +
            '</div>'
            : '';

        var completionPill = U.renderStatusPill
            ? U.renderStatusPill(
                (completion.score || 0) + '% profile complete',
                completionVariant(completion.score, completion.billing_threshold),
                true
            )
            : escapeHtml(String(completion.score || 0)) + '%';

        var actionHtml = renderActionRequired(data.action_required || []);
        var activityHtml = renderActivityFeedSection(data.activity_feed || {}, true);

        container.innerHTML =
            pediatricHtml +
            activeHtml +
            actionHtml +
            vitalsHtml +
            activityHtml +
            lastHtml +
            safetyHtml +
            problemsHtml +
            missingHtml +
            '<div class="d-flex align-items-center flex-wrap">' +
            completionPill +
            '<button type="button" class="btn btn-sm btn-link ml-2" data-action="goto-profile">' +
            escapeHtml('Edit profile') + '</button>' +
            '</div>';

        var editBtn = container.querySelector('[data-action="goto-profile"]');
        if (editBtn && typeof onEditProfile === 'function') {
            editBtn.addEventListener('click', onEditProfile);
        }
    }

    function renderVisitRow(visit, visitBoardUrl, isToday) {
        var urgent = visit.is_urgent
            ? '<span class="badge badge-warning mr-1">URGENT</span>' : '';
        var skipped = visit.skipped_triage
            ? '<span class="badge badge-secondary mr-1">' + escapeHtml('Skipped triage') + '</span>' : '';
        var cc = visit.chief_complaint
            ? '<div class="small text-muted">CC: ' + escapeHtml(visit.chief_complaint) + '</div>' : '';
        var dateLabel = isToday ? escapeHtml('Today') : escapeHtml(visit.visit_date || '—');
        var boardBtn = isToday && visitBoardUrl
            ? '<a class="btn btn-sm btn-outline-secondary ml-2" href="' +
            escapeHtml(visitBoardUrl) + '">' + escapeHtml('Board') + '</a>'
            : '';
        var docBtn = visit.documentation_url
            ? '<a class="btn btn-sm btn-outline-primary ml-2" href="' +
            escapeHtml(visit.documentation_url) + '" target="_top">' +
            escapeHtml('View documentation') + '</a>'
            : '';
        var exportBtn = visit.export_visit_summary_url
            ? '<a class="btn btn-sm btn-outline-secondary ml-2" href="' +
            escapeHtml(visit.export_visit_summary_url) + '" target="_top">' +
            escapeHtml('Export visit summary') + '</a>'
            : '';

        return '<div class="border rounded p-2 mb-2 d-flex flex-wrap align-items-start">' +
            '<div class="flex-grow-1">' +
            '<div class="d-flex align-items-center flex-wrap">' +
            '<strong class="mr-2">#' + escapeHtml(visit.queue_number) + '</strong>' +
            '<span class="text-muted small mr-2">' + dateLabel + '</span>' +
            '<span class="badge badge-info mr-1">' + escapeHtml(formatStateLabel(visit.state)) + '</span>' +
            urgent + skipped +
            '</div>' +
            '<div class="small">' + escapeHtml(visit.visit_type_label || 'Visit') +
            (visit.service_profile && visit.service_profile !== 'full_opd'
                ? ' · ' + escapeHtml(visit.service_profile) : '') +
            '</div>' +
            cc +
            '</div>' +
            '<div class="d-flex flex-wrap align-items-center ml-auto">' + docBtn + exportBtn + boardBtn + '</div>' +
            '</div>';
    }

    function renderClinicalListSection(title, section, emptyLabel) {
        var anchor = section.anchor || '';
        var items = section.items || [];
        var editorBtn = section.editor_url
            ? '<a class="btn btn-sm btn-outline-secondary" href="' +
            escapeHtml(section.editor_url) + '" target="_top">' +
            escapeHtml('Edit') + '</a>'
            : '';

        var body;
        if (section.undocumented) {
            body = '<p class="text-warning small mb-2">' +
                escapeHtml('Allergies not documented.') + '</p>';
        } else if (section.none_known) {
            body = '<p class="text-muted mb-0">' + escapeHtml('No known drug allergies.') + '</p>';
        } else if (items.length) {
            body = '<ul class="list-unstyled mb-0">' + items.map(function (item) {
                var detail = item.detail
                    ? '<div class="small text-muted">' + escapeHtml(item.detail) + '</div>' : '';
                return '<li class="mb-2"><strong>' + escapeHtml(item.title) + '</strong>' + detail + '</li>';
            }).join('') + '</ul>';
        } else {
            body = '<p class="text-muted mb-0">' + escapeHtml(emptyLabel) + '</p>';
        }

        return '<section class="border rounded p-3 mb-3" id="' + escapeHtml(anchor) + '">' +
            '<div class="d-flex justify-content-between align-items-start mb-2">' +
            '<h5 class="mb-0">' + escapeHtml(title) + '</h5>' + editorBtn +
            '</div>' + body + '</section>';
    }

    function renderClinicalBackground(section) {
        var lines = section.lines || [];
        var editorBtn = section.editor_url
            ? '<a class="btn btn-sm btn-outline-secondary" href="' +
            escapeHtml(section.editor_url) + '" target="_top">' +
            escapeHtml('Edit history') + '</a>'
            : '';
        var body = lines.length
            ? '<dl class="mb-0">' + lines.map(function (line) {
                return '<dt class="small text-muted">' + escapeHtml(line.label) + '</dt>' +
                    '<dd class="mb-2">' + escapeHtml(line.value) + '</dd>';
            }).join('') + '</dl>'
            : '<p class="text-muted mb-0">' + escapeHtml('No background documented.') + '</p>';

        return '<section class="border rounded p-3 mb-3" id="' +
            escapeHtml(section.anchor || 'clinical-background') + '">' +
            '<div class="d-flex justify-content-between align-items-start mb-2">' +
            '<h5 class="mb-0">' + escapeHtml('Background') + '</h5>' + editorBtn +
            '</div>' + body + '</section>';
    }

    function renderClinicalVitals(section) {
        var U = ui();
        var body;
        if (section.summary) {
            body = '<div>' + escapeHtml(section.summary) +
                (section.pain_score !== null && section.pain_score !== undefined && section.pain_score !== ''
                    ? ' · Pain ' + escapeHtml(String(section.pain_score)) : '') +
                '</div>';
            if (section.abnormal) {
                body += '<div class="mt-2">' +
                    (U.renderChipCloud ? U.renderChipCloud((section.warnings || []).map(function (w) {
                        return { label: w, variant: 'danger' };
                    })) : escapeHtml((section.warnings || []).join(', '))) +
                    '</div>';
            }
        } else {
            body = '<p class="text-muted mb-0">' + escapeHtml('No vitals recorded today.') + '</p>';
        }

        return '<section class="border rounded p-3 mb-3" id="' +
            escapeHtml(section.anchor || 'clinical-vitals') + '">' +
            '<h5 class="mb-2">' + escapeHtml('Vitals today') + '</h5>' + body + '</section>';
    }

    function renderClinicalLabs(section) {
        var items = section.items || [];
        var editorBtn = section.editor_url
            ? '<a class="btn btn-sm btn-outline-secondary" href="' +
            escapeHtml(section.editor_url) + '" target="_top">' +
            escapeHtml('Open orders') + '</a>'
            : '';
        var body = items.length
            ? '<ul class="list-unstyled mb-0">' + items.map(function (item) {
                var detail = item.detail
                    ? '<div class="small text-muted">' + escapeHtml(item.detail) + '</div>' : '';
                return '<li class="mb-2"><strong>' + escapeHtml(item.title) + '</strong>' + detail + '</li>';
            }).join('') + '</ul>'
            : '<p class="text-muted mb-0">' +
            escapeHtml('No lab orders on file.') + '</p>';

        return '<section class="border rounded p-3 mb-3" id="' +
            escapeHtml(section.anchor || 'clinical-labs') + '">' +
            '<div class="d-flex justify-content-between align-items-start mb-2">' +
            '<h5 class="mb-0">' + escapeHtml('Labs') + '</h5>' + editorBtn +
            '</div>' + body + '</section>';
    }

    function renderClinicalImmunizations(section) {
        if (!section || section.hidden) {
            return '';
        }

        return renderClinicalListSection(
            'Immunizations',
            section,
            'No immunizations on file.'
        );
    }

    function renderClinicalThisVisit(section) {
        if (!section || section.hidden) {
            return '';
        }

        var openBtn = section.open_encounter_url
            ? '<a class="btn btn-sm btn-primary" href="' +
            escapeHtml(section.open_encounter_url) + '" target="_top">' +
            escapeHtml('Open encounter') + '</a>'
            : '';

        var forms = section.forms || [];
        var body;
        if (forms.length) {
            body = '<div class="table-responsive"><table class="table table-sm mb-0">' +
                '<thead><tr>' +
                '<th>' + escapeHtml('Form') + '</th>' +
                '<th>' + escapeHtml('Date') + '</th>' +
                '<th>' + escapeHtml('Author') + '</th>' +
                '<th></th>' +
                '</tr></thead><tbody>' +
                forms.map(function (form) {
                    var signedChip = form.signed
                        ? '<span class="badge badge-success">' + escapeHtml('Signed') + '</span>'
                        : '<span class="badge badge-secondary">' + escapeHtml('Unsigned') + '</span>';
                    var link = form.form_url
                        ? '<a href="' + escapeHtml(form.form_url) + '" target="_top">' +
                        escapeHtml(form.title || 'Form') + '</a>'
                        : escapeHtml(form.title || 'Form');
                    return '<tr>' +
                        '<td>' + link + '</td>' +
                        '<td class="text-muted small">' + escapeHtml(form.date || '—') + '</td>' +
                        '<td class="text-muted small">' + escapeHtml(form.author || '—') + '</td>' +
                        '<td class="text-right">' + signedChip + '</td>' +
                        '</tr>';
                }).join('') +
                '</tbody></table></div>';
        } else {
            body = '<p class="text-muted mb-0">' +
                escapeHtml('No encounter forms recorded yet.') + '</p>';
        }

        return '<section class="border rounded p-3 mb-3" id="' +
            escapeHtml(section.anchor || 'clinical-encounter-forms') + '">' +
            '<div class="d-flex justify-content-between align-items-start mb-2 flex-wrap">' +
            '<h5 class="mb-0">' + escapeHtml('This visit') + '</h5>' + openBtn +
            '</div>' + body + '</section>';
    }

    function insertClinicalStrip(clinicalPane, stripId, html, beforeAnchor) {
        if (!clinicalPane || !html) {
            return;
        }
        var existing = clinicalPane.querySelector('#' + stripId);
        if (existing) {
            existing.remove();
        }
        var anchorEl = beforeAnchor ? clinicalPane.querySelector('#' + beforeAnchor) : null;
        if (anchorEl) {
            anchorEl.insertAdjacentHTML('beforebegin', html);
        } else {
            clinicalPane.insertAdjacentHTML('beforeend', html);
        }
    }

    function renderClinicalMedsStrip(strip) {
        if (!strip || strip.hidden) {
            return '';
        }

        var warningClass = strip.undispensed_warning ? ' border-warning' : '';
        var summary = escapeHtml(strip.meds_strip_label || 'Medications on file for this visit.');
        var buttons = '';

        if (strip.pharm_ops_url) {
            buttons += '<a class="btn btn-sm btn-outline-primary mr-2 mb-1" href="' +
                escapeHtml(strip.pharm_ops_url) + '" target="_top">' +
                escapeHtml('Open in Pharm Ops') + '</a>';
        }
        if (strip.view_meds_anchor) {
            buttons += '<button type="button" class="btn btn-sm btn-outline-secondary mb-1" ' +
                'data-action="scroll-clinical-anchor" data-anchor="' +
                escapeHtml(strip.view_meds_anchor) + '">' +
                escapeHtml('View meds') + '</button>';
        }

        return '<section class="border rounded p-3 mb-3 bg-light' + warningClass +
            '" id="nc-clinical-meds-strip">' +
            '<div class="d-flex flex-wrap justify-content-between align-items-start">' +
            '<div class="flex-grow-1 mb-2 mb-md-0">' +
            '<h5 class="mb-1">' + escapeHtml('Medications') + '</h5>' +
            '<div class="small">' + summary + '</div>' +
            '</div><div class="d-flex flex-wrap">' + buttons + '</div></div></section>';
    }

    function renderClinicalLabsStrip(strip) {
        if (!strip || strip.hidden) {
            return '';
        }

        var warningClass = strip.pending_warning ? ' border-warning' : '';
        var summary = escapeHtml(strip.labs_strip_label || 'Labs on file for this visit.');
        var buttons = '';

        if (strip.lab_ops_url) {
            buttons += '<a class="btn btn-sm btn-outline-primary mr-2 mb-1" href="' +
                escapeHtml(strip.lab_ops_url) + '" target="_top">' +
                escapeHtml('Open in Lab Ops') + '</a>';
        }
        if (strip.place_order_url) {
            buttons += '<a class="btn btn-sm btn-outline-primary mr-2 mb-1" href="' +
                escapeHtml(strip.place_order_url) + '" target="_top">' +
                escapeHtml('Place lab order') + '</a>';
        }
        if (strip.pending_orders_url) {
            buttons += '<a class="btn btn-sm btn-outline-secondary mr-2 mb-1" href="' +
                escapeHtml(strip.pending_orders_url) + '" target="_top">' +
                escapeHtml('Pending orders') + '</a>';
        }
        if (strip.view_trends_anchor) {
            buttons += '<button type="button" class="btn btn-sm btn-outline-secondary mb-1" ' +
                'data-action="scroll-clinical-anchor" data-anchor="' +
                escapeHtml(strip.view_trends_anchor) + '">' +
                escapeHtml('View trends') + '</button>';
        }

        return '<section class="border rounded p-3 mb-3 bg-light' + warningClass +
            '" id="nc-clinical-labs-strip">' +
            '<div class="d-flex flex-wrap justify-content-between align-items-start">' +
            '<div class="flex-grow-1 mb-2 mb-md-0">' +
            '<h5 class="mb-1">' + escapeHtml('Labs') + '</h5>' +
            '<div class="small">' + summary + '</div>' +
            '</div><div class="d-flex flex-wrap">' + buttons + '</div></div></section>';
    }

    function renderClinicalReferralsStrip(strip) {
        if (!strip || strip.hidden) {
            return '';
        }

        var items = strip.items || [];
        var latest = items[0];
        var summary = latest
            ? escapeHtml(latest.label || 'Referral') +
            ' · ' + escapeHtml(latest.status || '—') +
            (latest.occurred_at ? ' · ' + escapeHtml(latest.occurred_at) : '')
            : escapeHtml('Referrals on file for this visit.');

        var openBtn = strip.open_referrals_url
            ? '<a class="btn btn-sm btn-outline-primary" href="' +
            escapeHtml(strip.open_referrals_url) + '" target="_top">' +
            escapeHtml('Open referrals') + '</a>'
            : '';

        return '<section class="border rounded p-3 mb-3 bg-light" id="nc-clinical-referrals-strip">' +
            '<div class="d-flex flex-wrap justify-content-between align-items-start">' +
            '<div class="flex-grow-1 mb-2 mb-md-0">' +
            '<h5 class="mb-1">' + escapeHtml('Referrals') + '</h5>' +
            '<div class="small">→ ' + summary + '</div>' +
            '</div>' + openBtn + '</div></section>';
    }

    function insertClinicalReferralsStrip(clinicalPane, strip) {
        insertClinicalStrip(
            clinicalPane,
            'nc-clinical-referrals-strip',
            renderClinicalReferralsStrip(strip),
            'clinical-encounter-forms'
        );
    }

    function insertClinicalLabsStrip(clinicalPane, strip) {
        insertClinicalStrip(
            clinicalPane,
            'nc-clinical-labs-strip',
            renderClinicalLabsStrip(strip),
            'clinical-labs'
        );
    }

    function insertClinicalMedsStrip(clinicalPane, strip) {
        insertClinicalStrip(
            clinicalPane,
            'nc-clinical-meds-strip',
            renderClinicalMedsStrip(strip),
            'clinical-meds'
        );
    }

    function loadClinicalSummaryStrips(clinicalPane, ajaxUrl, pid, encounterId) {
        var encParam = encounterId
            ? '&encounter_id=' + encodeURIComponent(String(encounterId))
            : '';
        var base = ajaxUrl + '?pid=' + encodeURIComponent(pid) + encParam;
        var requests = [
            getJson(base + '&action=mrd.clinical_referrals_strip'),
            getJson(base + '&action=mrd.clinical_labs_summary'),
            getJson(base + '&action=mrd.clinical_meds_summary'),
        ];

        return Promise.all(requests.map(function (req) {
            return req.catch(function () {
                return null;
            });
        })).then(function (results) {
            if (results[0] && results[0].payload.success) {
                insertClinicalReferralsStrip(clinicalPane, results[0].payload.data || {});
            }
            if (results[1] && results[1].payload.success) {
                insertClinicalLabsStrip(clinicalPane, results[1].payload.data || {});
            }
            if (results[2] && results[2].payload.success) {
                insertClinicalMedsStrip(clinicalPane, results[2].payload.data || {});
            }
        });
    }

    function renderClinicalPane(container, payload) {
        if (!container || !payload) {
            return;
        }

        container.innerHTML =
            renderClinicalBackground(payload.background || {}) +
            renderClinicalListSection('Problems', payload.problems || {}, 'No active problems.') +
            renderClinicalListSection('Allergies', payload.allergies || {}, 'No allergies on file.') +
            renderClinicalListSection('Medications', payload.medications || {}, 'No active medications.') +
            renderClinicalImmunizations(payload.immunizations || {}) +
            renderClinicalLabs(payload.labs || {}) +
            renderClinicalVitals(payload.vitals || {}) +
            renderClinicalThisVisit(payload.this_visit || {});
    }

    function scrollToClinicalAnchor(root, anchor) {
        if (!anchor || !root) {
            return;
        }
        var el = document.getElementById(anchor);
        if (!el && root) {
            el = root.querySelector('#' + anchor);
        }
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function renderMessageRow(item) {
        var statusChip = '';
        if (item.status) {
            var variant = item.active === false ? 'secondary' : 'info';
            statusChip = '<span class="badge badge-' + variant + ' ml-2">' +
                escapeHtml(item.status) + '</span>';
        }
        var assigned = item.assigned_to
            ? '<span class="text-muted small"> → ' + escapeHtml(item.assigned_to) + '</span>'
            : '';
        var titleHtml = item.detail_url
            ? '<a href="' + escapeHtml(item.detail_url) + '" target="_top">' +
            escapeHtml(item.title || 'Message') + '</a>'
            : '<strong>' + escapeHtml(item.title || '—') + '</strong>';
        var preview = item.preview
            ? '<div class="small text-muted mt-1">' + escapeHtml(item.preview) + '</div>'
            : '';

        return '<div class="border rounded p-2 mb-2">' +
            '<div class="d-flex flex-wrap justify-content-between align-items-start">' +
            '<div class="flex-grow-1">' + titleHtml + statusChip + assigned + preview +
            '<div class="small text-muted mt-1">' +
            escapeHtml(item.author || '—') +
            (item.date ? ' · ' + escapeHtml(item.date) : '') +
            '</div></div></div></div>';
    }

    function renderMessagesPane(container, payload) {
        if (!container || !payload) {
            return;
        }

        var urls = payload.editor_urls || {};
        var actions = '<div class="d-flex flex-wrap mb-3">';
        if (urls.add_message) {
            actions += '<a class="btn btn-sm btn-primary mr-2 mb-2" href="' +
                escapeHtml(urls.add_message) + '" target="_top">' +
                escapeHtml('New message') + '</a>';
        }
        if (urls.pnotes) {
            actions += '<a class="btn btn-sm btn-outline-secondary mr-2 mb-2" href="' +
                escapeHtml(urls.pnotes) + '" target="_top">' +
                escapeHtml('Open all notes') + '</a>';
        }
        if (urls.dated_reminders) {
            actions += '<a class="btn btn-sm btn-outline-secondary mb-2" href="' +
                escapeHtml(urls.dated_reminders) + '" target="_top">' +
                escapeHtml('Dated reminders') + '</a>';
        }
        actions += '</div>';

        var messages = payload.messages || [];
        var messagesHtml = messages.length
            ? '<div id="nc-chart-messages-list">' +
            messages.map(renderMessageRow).join('') + '</div>'
            : '<p class="text-muted">' + escapeHtml('No chart messages for this patient.') + '</p>';

        var loadMore = '';
        if (payload.has_more) {
            loadMore = '<button type="button" class="btn btn-outline-secondary btn-sm mt-2" ' +
                'data-action="load-more-messages">' + escapeHtml('Load more') + '</button>';
        }

        var reminders = payload.reminders || [];
        var remindersHtml = reminders.length
            ? reminders.map(renderMessageRow).join('')
            : '<p class="text-muted mb-0">' + escapeHtml('No reminders for this patient.') + '</p>';

        container.innerHTML =
            '<p class="text-muted small">' +
            escapeHtml('Chart-scoped messages and reminders for this patient. Use the clinic Communications hub for staff inbox across all patients.') +
            '</p>' +
            actions +
            '<h5 class="mb-2">' + escapeHtml('Messages') +
            ' <span class="text-muted small">(' + escapeHtml(String(payload.message_total || 0)) + ')</span></h5>' +
            messagesHtml +
            loadMore +
            '<h5 class="mb-2 mt-4">' + escapeHtml('Reminders') + '</h5>' +
            remindersHtml;
    }

    function appendMessages(container, messages) {
        var list = container.querySelector('#nc-chart-messages-list');
        if (!list || !messages || !messages.length) {
            return;
        }
        messages.forEach(function (item) {
            list.insertAdjacentHTML('beforeend', renderMessageRow(item));
        });
    }

    function renderVisitsPane(container, payload, visitBoardUrl) {
        if (!container || !payload) {
            return;
        }

        var today = payload.today_visits || [];
        var past = payload.past_visits || [];
        var todayHtml = today.length
            ? today.map(function (v) { return renderVisitRow(v, visitBoardUrl, true); }).join('')
            : '<p class="text-muted">' + escapeHtml('No visits today.') + '</p>';

        var pastHtml = past.length
            ? past.map(function (v) { return renderVisitRow(v, visitBoardUrl, false); }).join('')
            : '<p class="text-muted">' + escapeHtml('No past visits.') + '</p>';

        var loadMore = '';
        if (payload.past_has_more) {
            loadMore = '<button type="button" class="btn btn-outline-secondary btn-sm mt-2" ' +
                'data-action="load-more-visits">' + escapeHtml('Load more') + '</button>';
        }

        container.innerHTML =
            '<h5 class="mb-2">' + escapeHtml('Today') + '</h5>' +
            todayHtml +
            '<h5 class="mb-2 mt-4">' + escapeHtml('Past visits') +
            ' <span class="text-muted small">(' + escapeHtml(String(payload.past_total || 0)) + ')</span></h5>' +
            '<div id="nc-chart-past-visits-list">' + pastHtml + '</div>' +
            loadMore;
    }

    function appendPastVisits(container, visits, visitBoardUrl) {
        var list = container.querySelector('#nc-chart-past-visits-list');
        if (!list || !visits || !visits.length) {
            return;
        }
        visits.forEach(function (visit) {
            list.insertAdjacentHTML('beforeend', renderVisitRow(visit, visitBoardUrl, false));
        });
    }

    function init(options) {
        var root = options.root;
        if (!root) {
            return;
        }

        var pid = parseInt(root.dataset.pid, 10);
        var ajaxUrl = options.ajaxUrl;
        var csrfToken = options.csrfToken;
        var visitBoardUrl = root.dataset.visitBoardUrl || '';
        var activeTab = root.dataset.activeTab || 'overview';
        if (TAB_IDS.indexOf(activeTab) === -1) {
            activeTab = 'overview';
        }

        var bannerEl = root.querySelector('#nc-chart-banner');
        var checklistEl = root.querySelector('#nc-profile-checklist');
        var paymentsStripEl = root.querySelector('#nc-profile-payments-strip');
        var profilePane = root.querySelector('#nc-chart-profile-pane');
        var overviewPane = root.querySelector('#nc-chart-overview-pane');
        var visitsPane = root.querySelector('#nc-chart-visits-pane');
        var clinicalPane = root.querySelector('#nc-chart-clinical-pane');
        var messagesPane = root.querySelector('#nc-chart-messages-pane');
        var tabLinks = root.querySelectorAll('#nc-chart-tabs [data-tab]');
        var tabPanes = root.querySelectorAll('#nc-chart-tab-panes .tab-pane');
        var clinicalAnchor = root.dataset.clinicalAnchor || '';

        var previewData = null;
        var visitsLoaded = false;
        var clinicalLoaded = false;
        var messagesLoaded = false;
        var paymentsStripLoaded = false;
        var messagesOffset = 0;
        var messagesHasMore = false;
        var activityFeedOffset = 0;
        var activityFeedHasMore = false;
        var pastVisitsOffset = 0;
        var pastHasMore = false;
        var registrationHandle = null;
        var currentTab = activeTab;

        function setTab(tab) {
            if (TAB_IDS.indexOf(tab) === -1) {
                tab = 'overview';
            }
            currentTab = tab;

            tabLinks.forEach(function (link) {
                var isActive = link.dataset.tab === tab;
                link.classList.toggle('active', isActive);
                link.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
            tabPanes.forEach(function (pane) {
                var paneTab = pane.id.replace('nc-chart-tab-', '');
                var isActive = paneTab === tab;
                pane.classList.toggle('show', isActive);
                pane.classList.toggle('active', isActive);
            });

            var url = new URL(window.location.href);
            url.searchParams.set('tab', tab);
            if (tab === 'clinical' && clinicalAnchor) {
                url.searchParams.set('anchor', clinicalAnchor);
            } else {
                url.searchParams.delete('anchor');
            }
            window.history.replaceState({}, '', url.toString());

            if (tab === 'overview' && overviewPane) {
                loadOverview();
            }
            if (tab === 'visits' && visitsPane && !visitsLoaded) {
                loadVisits(true);
            }
            if (tab === 'clinical' && clinicalPane && !clinicalLoaded) {
                loadClinical(!!clinicalAnchor);
            }
            if (tab === 'profile' && paymentsStripEl && !paymentsStripLoaded) {
                loadPaymentsStrip();
            }
            if (tab === 'messages' && messagesPane && !messagesLoaded) {
                loadMessages(true);
            }
        }

        function reloadContext() {
            return postJson(ajaxUrl + '?action=patients.preview', {
                pid: pid,
                context: 'patient-chart',
                csrf_token_form: csrfToken
            }).then(function (result) {
                if (result.payload.success) {
                    previewData = result.payload.data;
                    if (previewData.activity_feed) {
                        activityFeedOffset = (previewData.activity_feed.items || []).length;
                        activityFeedHasMore = !!previewData.activity_feed.has_more;
                    }
                    renderBanner(bannerEl, previewData);
                    if (currentTab === 'overview') {
                        renderOverviewPane(overviewPane, previewData, visitBoardUrl, function () {
                            setTab('profile');
                        });
                    }
                }
            });
        }

        function reloadChecklist() {
            return postJson(ajaxUrl + '?action=patients.registration.get', {
                pid: pid,
                csrf_token_form: csrfToken
            }).then(function (result) {
                if (result.payload.success) {
                    renderChecklist(
                        checklistEl,
                        result.payload.data.completion_by_level || [],
                        result.payload.data.completion || {}
                    );
                }
            });
        }

        function loadOverview() {
            if (!overviewPane) {
                return Promise.resolve();
            }
            if (previewData) {
                renderOverviewPane(overviewPane, previewData, visitBoardUrl, function () {
                    setTab('profile');
                });
                return Promise.resolve();
            }
            overviewPane.innerHTML = '<em>' + escapeHtml('Loading overview…') + '</em>';
            return reloadContext().catch(function () {
                overviewPane.innerHTML = '<div class="alert alert-danger">' +
                    escapeHtml('Could not load overview.') + '</div>';
            });
        }

        function renderPaymentsStrip(container, payload) {
            if (!container) {
                return;
            }
            if (!payload || payload.hidden) {
                container.innerHTML = '';
                return;
            }

            var warningClass = payload.balance_warning ? ' border-warning bg-light' : '';
            var historyBtn = payload.can_view_history && payload.payment_history_url
                ? '<a class="btn btn-sm btn-outline-primary" href="' +
                escapeHtml(payload.payment_history_url) + '" target="_top">' +
                escapeHtml('View payment history') + '</a>'
                : '';

            container.innerHTML =
                '<section class="border rounded p-3 mb-3' + warningClass + '" id="nc-profile-payments-strip-panel">' +
                '<div class="d-flex flex-wrap justify-content-between align-items-start">' +
                '<div class="flex-grow-1 mb-2 mb-md-0">' +
                '<h5 class="mb-1">' + escapeHtml('Payments') + '</h5>' +
                '<div class="small">' + escapeHtml(payload.payments_strip_label || '') + '</div>' +
                '</div>' + historyBtn + '</div></section>';
        }

        function loadPaymentsStrip() {
            if (!paymentsStripEl) {
                return Promise.resolve();
            }

            return getJson(ajaxUrl + '?action=mrd.profile_payments_summary&pid=' + encodeURIComponent(pid))
                .then(function (result) {
                    if (!result.payload.success) {
                        throw new Error(result.payload.message || 'Failed');
                    }
                    renderPaymentsStrip(paymentsStripEl, result.payload.data || {});
                    paymentsStripLoaded = true;
                })
                .catch(function () {
                    paymentsStripEl.innerHTML = '';
                });
        }

        function loadMessages(reset) {
            if (!messagesPane) {
                return Promise.resolve();
            }
            if (reset) {
                messagesLoaded = false;
                messagesOffset = 0;
                messagesPane.innerHTML = '<em>' + escapeHtml('Loading messages…') + '</em>';
            }

            var url = ajaxUrl + '?action=patients.chart.messages&pid=' + encodeURIComponent(pid) +
                '&offset=' + encodeURIComponent(String(messagesOffset));

            return getJson(url).then(function (result) {
                if (!result.payload.success) {
                    throw new Error(result.payload.message || 'Failed');
                }
                var data = result.payload.data || {};
                messagesHasMore = !!data.has_more;
                messagesOffset = (data.offset || 0) + (data.messages || []).length;

                if (reset) {
                    renderMessagesPane(messagesPane, data);
                    messagesLoaded = true;
                } else {
                    appendMessages(messagesPane, data.messages || []);
                    var moreBtn = messagesPane.querySelector('[data-action="load-more-messages"]');
                    if (moreBtn) {
                        moreBtn.remove();
                    }
                    if (messagesHasMore) {
                        messagesPane.insertAdjacentHTML('beforeend',
                            '<button type="button" class="btn btn-outline-secondary btn-sm mt-2" ' +
                            'data-action="load-more-messages">' + escapeHtml('Load more') + '</button>');
                    }
                }
            }).catch(function () {
                if (reset) {
                    messagesPane.innerHTML = '<div class="alert alert-danger">' +
                        escapeHtml('Could not load messages.') + '</div>';
                }
            });
        }

        function loadClinical(scrollAfter) {
            if (!clinicalPane) {
                return Promise.resolve();
            }
            clinicalPane.innerHTML = '<em>' + escapeHtml('Loading clinical summary…') + '</em>';

            var url = ajaxUrl + '?action=patients.chart.clinical&pid=' + encodeURIComponent(pid);
            return getJson(url).then(function (result) {
                if (!result.payload.success) {
                    throw new Error(result.payload.message || 'Failed');
                }
                var data = result.payload.data || {};
                renderClinicalPane(clinicalPane, data);
                clinicalLoaded = true;

                return loadClinicalSummaryStrips(
                    clinicalPane,
                    ajaxUrl,
                    pid,
                    data.active_encounter_id || null
                ).catch(function () {
                    return null;
                }).then(function () {
                    if (scrollAfter && clinicalAnchor) {
                        scrollToClinicalAnchor(root, clinicalAnchor);
                    }
                });
            }).catch(function () {
                clinicalPane.innerHTML = '<div class="alert alert-danger">' +
                    escapeHtml('Could not load clinical summary.') + '</div>';
            });
        }

        function loadMoreActivity() {
            var url = ajaxUrl + '?action=patients.chart.activity_feed&pid=' +
                encodeURIComponent(pid) + '&offset=' + encodeURIComponent(String(activityFeedOffset));

            return getJson(url).then(function (result) {
                if (!result.payload.success) {
                    throw new Error(result.payload.message || 'Failed');
                }
                var feed = result.payload.data || {};
                var list = overviewPane.querySelector('#nc-chart-activity-feed-list');
                if (!list) {
                    return;
                }
                (feed.items || []).forEach(function (item) {
                    list.insertAdjacentHTML('beforeend', renderActivityFeedItem(item));
                });
                activityFeedOffset += (feed.items || []).length;
                activityFeedHasMore = !!feed.has_more;
                var moreBtn = overviewPane.querySelector('[data-action="load-more-activity"]');
                if (moreBtn && !activityFeedHasMore) {
                    moreBtn.remove();
                }
            });
        }

        function loadVisits(reset) {
            if (!visitsPane) {
                return Promise.resolve();
            }
            if (reset) {
                visitsLoaded = false;
                pastVisitsOffset = 0;
                visitsPane.innerHTML = '<em>' + escapeHtml('Loading visits…') + '</em>';
            }

            var url = ajaxUrl + '?action=patients.chart.visits&pid=' + encodeURIComponent(pid) +
                '&offset=' + encodeURIComponent(String(pastVisitsOffset));

            return getJson(url).then(function (result) {
                if (!result.payload.success) {
                    throw new Error(result.payload.message || 'Failed');
                }
                var data = result.payload.data || {};
                pastHasMore = !!data.past_has_more;
                pastVisitsOffset = (data.past_offset || 0) + (data.past_visits || []).length;

                if (reset) {
                    renderVisitsPane(visitsPane, data, visitBoardUrl);
                    visitsLoaded = true;
                } else {
                    appendPastVisits(visitsPane, data.past_visits || [], visitBoardUrl);
                    var moreBtn = visitsPane.querySelector('[data-action="load-more-visits"]');
                    if (moreBtn) {
                        moreBtn.remove();
                    }
                    if (pastHasMore) {
                        visitsPane.insertAdjacentHTML('beforeend',
                            '<button type="button" class="btn btn-outline-secondary btn-sm mt-2" ' +
                            'data-action="load-more-visits">' + escapeHtml('Load more') + '</button>');
                    }
                }
            }).catch(function () {
                if (reset) {
                    visitsPane.innerHTML = '<div class="alert alert-danger">' +
                        escapeHtml('Could not load visits.') + '</div>';
                }
            });
        }

        function mountProfileForm() {
            if (!window.NewClinicRegistrationForm || !profilePane) {
                return;
            }

            registrationHandle = window.NewClinicRegistrationForm.render(profilePane, {
                ajaxUrl: ajaxUrl,
                csrfToken: csrfToken,
                pid: pid,
                mode: 'chart',
                onSaved: function () {
                    previewData = null;
                    clinicalLoaded = false;
                    paymentsStripLoaded = false;
                    reloadContext();
                    reloadChecklist();
                    visitsLoaded = false;
                },
                onCancel: function () {
                    window.history.back();
                }
            });
        }

        tabLinks.forEach(function (link) {
            link.addEventListener('click', function (event) {
                event.preventDefault();
                setTab(link.dataset.tab || 'profile');
            });
        });

        if (overviewPane) {
            overviewPane.addEventListener('click', function (event) {
                var btn = event.target.closest('[data-action="load-more-activity"]');
                if (!btn) {
                    return;
                }
                btn.disabled = true;
                loadMoreActivity().finally(function () {
                    btn.disabled = false;
                });
            });
        }

        if (visitsPane) {
            visitsPane.addEventListener('click', function (event) {
                var btn = event.target.closest('[data-action="load-more-visits"]');
                if (!btn) {
                    return;
                }
                btn.disabled = true;
                loadVisits(false).finally(function () {
                    btn.disabled = false;
                });
            });
        }

        if (messagesPane) {
            messagesPane.addEventListener('click', function (event) {
                var btn = event.target.closest('[data-action="load-more-messages"]');
                if (!btn) {
                    return;
                }
                btn.disabled = true;
                loadMessages(false).finally(function () {
                    btn.disabled = false;
                });
            });
        }

        if (clinicalPane) {
            clinicalPane.addEventListener('click', function (event) {
                var btn = event.target.closest('[data-action="scroll-clinical-anchor"]');
                if (!btn) {
                    return;
                }
                event.preventDefault();
                scrollToClinicalAnchor(root, btn.getAttribute('data-anchor') || '');
            });
        }

        profilePane.innerHTML = '<em>' + escapeHtml('Loading profile…') + '</em>';
        Promise.all([reloadContext(), reloadChecklist()]).then(function () {
            mountProfileForm();
            setTab(currentTab);
        }).catch(function () {
            profilePane.innerHTML = '<div class="alert alert-danger">' +
                escapeHtml('Could not load patient profile.') + '</div>';
        });

        return {
            reload: function () {
                previewData = null;
                visitsLoaded = false;
                return Promise.all([reloadContext(), reloadChecklist()]);
            },
            setTab: setTab
        };
    }

    window.NewClinicPatientChart = { init: init };
})(window);

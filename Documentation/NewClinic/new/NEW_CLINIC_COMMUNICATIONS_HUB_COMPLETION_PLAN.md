# Communications Hub — Completion & Redesign Plan (COMHUB-*)

| Field | Value |
|-------|-------|
| **Document version** | 1.0.0 |
| **Date** | 2026-07-17 |
| **Status** | **Executed 2026-07-17** — all COMHUB-0..6 tasks shipped in one batch (asset version `-commhub60`); live-smoked: both lenses, compose, reminder create/complete, log, mobile width |
| **Companion to** | `done/NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md` (v1.0.3), PRD COM-F*, PAGE_DESIGNS §7.12 |
| **Scope** | Finish the Communications page redesign: the compose form, reminder panes, log, toolbar, and footer that earlier passes did not touch |

---

## 1. Why parts of this page keep getting left behind (root cause)

The Communications hub island is one of the few islands whose `main.css` **does not import
`core/tokens.css`** — so it ships **zero Tailwind utilities**. 17 other islands import it
(clinical-doc, doctor-desk, scheduling, …); this one is a one-line comment file.

Consequence: every shared component in this island that is styled with Tailwind classes
**silently renders unstyled or half-styled**:

| Component / call site | What actually renders today |
|---|---|
| shadcn `Checkbox` (compose "To" list) | ~2px square (the island CSS even documents this at `communications-hub.css:725`) |
| shadcn `Button` variants (Send, Cancel, Create reminder, Mark completed, Close, Apply, Reset…) | UA-reset buttons with no variant color/size |
| shadcn `Input`/`NativeSelect`/`Textarea` `h-8` sizing | no-op — default heights |
| `Badge` variants (`warning`, `outline`) | no tone at all |
| `deskCalloutClass` tones (supervisory banner, orphan "No patient linked" box, search-truncated info, submit errors) | grey-bordered box, **no warn/info/error color** (Bootstrap happens to supply `border px-4 py-3 rounded-lg`; the amber/red/blue backgrounds are Tailwind-only) |
| `ConfirmModal` (Delete message), `PatientContextBanner`, `PaginationBar` | degraded to whatever Bootstrap coincidentally covers |
| Layout utilities `space-y-1.5`, `flex`, `items-center`, `gap-2`, `text-lg`, `font-semibold`, `text-[var(…)]` | all no-op (only BS4-name-colliding ones like `mb-3`, `mr-2`, `p-2` work, by accident) |

The premium redesign passes (avatar rows, reader header, chat bubbles, composer dock,
radio pills, recipient boxes) were written in **non-layered BEM CSS** and look right.
Everything still expressed in Tailwind/shadcn — chiefly **MessageComposePane**, parts of
**ReminderCreatePane**, **ReminderLogPane**, the **detail-pane action buttons**, and every
callout — is the "untouched side" the user keeps seeing. Any pass that restyles only BEM
areas will keep missing them.

**Fix strategy (COMHUB-0):** add `@import '../../core/tokens.css';` to
`frontend/src/islands/communications-hub/main.css` — the exact precedented fix (same import
every Tailwind island uses; utilities land in `@layer utilities` so they still lose to
Bootstrap where names collide, guarded by `npm run bs:check`). Then finish the visual work
in BEM where the page's premium identity already lives.

> **Note on the earlier "BEM-only" lesson.** A previous batch (remforms55) hit this same
> root cause in the reminder panes and worked around it with native inputs + BEM, recording
> "in this island use BEM + native inputs, NOT Tailwind/shadcn." That was the right triage,
> but it cannot fix the *shared* components this island imports (ConfirmModal,
> PatientContextBanner, PaginationBar, callout tones) — those are Tailwind-styled centrally
> and rewriting them per-island is worse. The import supersedes the workaround; the BEM
> work already shipped stays (non-layered BEM outranks layered utilities), and the
> already-QA'd areas get a visual regression pass in the same batch.

---

## 2. Full audit — everything on the page, by component

Severity: 🔴 broken/bug · 🟠 inconsistent/degraded · 🟡 polish/UX debt.

### 2.1 Twig toolbar (`communications.html.twig` `page_heading_actions`)

| # | Finding | Severity |
|---|---|---|
| T1 | **Search box is dead on the Reminders lens** — it stays visible, but `loadList()` ignores `search` for reminders (`CommunicationsHub.tsx:124-131`); typing does nothing. | 🔴 |
| T2 | Lens switcher is a plain `nc-btn` button group, not the segmented-control look used elsewhere; counts render as flat neutral badges. | 🟠 |
| T3 | Sort is **two raw selects** (field + order) shown only on messages lens; visually heavy, unlabeled to sighted users, inline `style="width:auto"`. | 🟠 |
| T4 | Activity filter options say "Active / Inactive / All" — jargon; means "Open / Done / All" messages. | 🟡 |
| T5 | Refresh is an icon-only `fa` button; primary "+ New message" exists for messages, but **the Reminders lens has no top-right primary action at all** (its create action hides in the page footer, see F1). | 🟠 |
| T6 | Inline `style` attributes on search/selects instead of CSS. | 🟡 |

### 2.2 List pane (`CommunicationsList.tsx`, left column)

| # | Finding | Severity |
|---|---|---|
| L1 | **"No patient" badge in rows is unstyled** — CSS scopes the tone as `.nc-comm-row-title .nc-comm-row-badge--warn` (`communications-hub.css:212`) but the markup renders the badge inside `.nc-comm-row-tags` (`CommunicationsList.tsx:84-90`). Selector written for the old structure; also the `--new` rule at :206 is dead CSS. | 🔴 |
| L2 | **60-second reminders poll flashes the whole list** — `handleRefresh → loadList` sets `listLoading=true`, replacing rows with "Loading…" every minute, losing scroll position. Background refresh should keep stale rows visible. | 🔴 |
| L3 | The search-truncated info callout is rendered **inside the `role="listbox"` container** — invalid ARIA child; `aria-live="polite"` on the whole listbox announces every re-render. | 🟠 |
| L4 | Loading state is plain text — no skeleton rows; empty state has no icon/action (e.g. "New message"). | 🟡 |
| L5 | Reminders list: fixed 30-day window, no pagination (count footer only) — fine for now, but no way to see further out; note only. | 🟡 |

### 2.3 Message reader (`MessageDetailView`)

| # | Finding | Severity |
|---|---|---|
| R1 | Reader-title "No patient" `Badge variant="warning"` has **no styling at all** (Tailwind variant, no BEM backup). | 🔴 |
| R2 | Supervisory banner + orphan assign box lose their **warning color** (callout root cause §1) — a clinical-safety signal rendered as a plain grey box. | 🔴 |
| R3 | Assign-patient flow: `flex flex-wrap items-center` no-ops → chip/Clear/Assign controls stack raggedly; "Assigning…"/"Assign patient" strings not i18n'd. | 🟠 |
| R4 | `mb-md-1` (Bootstrap-only class) in the orphan box; `Badge` `outline` variant unstyled. | 🟡 |
| R5 | Delete `ConfirmModal` styling unverified on this page (Radix + Tailwind — same root cause; must be pixel-checked after COMHUB-0). | 🟠 |
| R6 | Error handling for done/reopen/status/assign/delete/reply uses **`window.alert()`** (6 call sites in `CommunicationsHub.tsx`: 434, 449, 466, 484, 502, 519) instead of `showDeskToast`/callouts. | 🔴 |

### 2.4 Compose pane (`MessageComposePane.tsx`) — **the biggest untouched component**

| # | Finding | Severity |
|---|---|---|
| C1 | Entire form is shadcn/Tailwind (`space-y-1.5`, `h-8`, shadcn Checkbox recipients) → renders cramped and half-styled today (root cause §1). No premium chrome at all — plain `h2`, no parity with the reader header. | 🔴 |
| C2 | **"To" recipient list**: raw checkbox list of every user, `~2px` checkboxes, no search/filter, `border rounded p-2` Bootstrap classes + inline `style` maxHeight. Needs the BEM `nc-comm-recipient-box` / `nc-comm-check-row` pattern the reminder form already has, plus a filter input for long user lists. | 🔴 |
| C3 | **"Status" dropdown exposed at compose time** — inconsistent with the redesigned chat model (reader deliberately replaced the status dropdown with one done/reopen action). A new message is always "New"; sending as Done is a niche case. Remove from the form (keep backend default). | 🟠 |
| C4 | Validation is **save-time only** ("must be at least 2 characters", "select at least one recipient" appear on submit) — violates the standing forms rule: inline validation while typing. | 🟠 |
| C5 | Not i18n'd: 'Reply to message', 'Compose message', 'Sending…', 'Send', 'No patient linked', the patient-search placeholder, submit-error strings. | 🟠 |
| C6 | Attachment (fax) callout is tone-less (§1); shows raw "Attaching fax ID: N". | 🟡 |
| C7 | Buttons: Send/Cancel are shadcn `size="sm"` — after COMHUB-0 they work, but should match the reader's 44px labeled-action style. | 🟡 |

### 2.5 Reminder detail (`ReminderDetailView`)

| # | Finding | Severity |
|---|---|---|
| D1 | **No reader parity**: no avatar, plain `h2`, urgency as colored text; nothing matching the premium message reader header. | 🟠 |
| D2 | **"Mark completed" lives in the page footer** (`nc-comm-footer`, bottom of the page, far from the content) while the message reader's equivalent action is in its header. Move it into the reminder reader header as the same labeled done-toggle style. | 🔴 |
| D3 | Detail is sourced from the list row only (no fetch) — after L2's poll refresh removes a row, selection shows "Reminder not found or already completed." Acceptable, but message copy should be a proper empty/info state, not the error style. | 🟡 |

### 2.6 Reminder create/forward (`ReminderCreatePane.tsx`) — half migrated

| # | Finding | Severity |
|---|---|---|
| RC1 | Mixed styling generations: BEM recipient box + radio pills (done) next to shadcn `Label/Input/NativeSelect/Textarea` with `h-8`/`space-y-1.5` (broken today). Unify on BEM field styles. | 🟠 |
| RC2 | Save-time-only validation (same as C4); message length counter is good — keep. | 🟠 |
| RC3 | Not i18n'd: 'Forward reminder', 'Create reminder', 'Sending…', 'Send reminder', placeholder, error strings. | 🟠 |
| RC4 | "Or select a time span" preset select resets silently when the date is edited — fine, but presets deserve the pill treatment (chips) to match Priority. | 🟡 |

### 2.7 Reminder log (`ReminderLogPane.tsx`) — untouched

| # | Finding | Severity |
|---|---|---|
| LG1 | shadcn `Table` + `ncShadcnTableClass` → table styling no-ops today (root cause §1). | 🔴 |
| LG2 | **No pagination / row bound in the UI** — whatever the action returns renders in full (verify the service bound per SCALE R-rules; add pagination or "showing latest N"). | 🟠 |
| LG3 | Column design: raw `ID` column (meaningless to staff), unbounded `Message` text, `Sent from`/`Sent to` date labels easily confused with the Sent by/Sent to people filters. Redesign columns: Sent · From → To · Patient · Message (truncated, expandable) · Due · Completed. | 🟠 |
| LG4 | Plain-text loading/error; admin people-filters are two cramped checkbox boxes; Apply/Reset buttons unstyled today. | 🟡 |
| LG5 | It renders **inside the detail pane** replacing the reader — OK on desktop, but on mobile it's an 8-column table in a 100%-width overlay; needs a responsive treatment (cards or horizontal scroll container). | 🟠 |

### 2.8 Footer (`nc-comm-footer`)

| # | Finding | Severity |
|---|---|---|
| F1 | Leftover pattern: "Mark completed" / "Create reminder" / "View log" sit as small outline buttons at the very bottom of the page, below both panes — disconnected from what they act on, inconsistent with every other desk (primary actions top-right, contextual actions in the reader). **Plan: delete the footer entirely** (D2 moves Mark completed; T5 moves Create reminder + View log into the toolbar for the reminders lens). | 🔴 |

### 2.9 Cross-cutting

| # | Finding | Severity |
|---|---|---|
| X1 | i18n leftovers across all panes (island *is* in the eslint `jsx-no-literals` fence, but attribute strings/ternaries slipped through). Sweep + `npm run i18n:extract`. | 🟠 |
| X2 | Keyboard: list arrow-key nav exists (good); compose/reminder forms need Esc-to-cancel; confirm focus trap in ConfirmModal after COMHUB-0. | 🟡 |
| X3 | Tests exist for hub/detail/compose/reminder-create/print/storage — extend for each behavior change; no visual regression, so the batch must end with a real browser screenshot QA of **both lenses + compose + log + mobile width** (this page's history proves attribute-level tests pass while pixels are wrong). | 🟠 |

---

## 3. The plan — one task ID per commit

### COMHUB-0 · Foundation: light up the island's styling (prereq for everything)
- `main.css`: `@import '../../core/tokens.css';`
- Re-run `npm run bs:check`; migrate the few Bootstrap-colliding classes the audit found (`mb-md-1`, `border rounded p-2`) to token/BEM equivalents and re-baseline **down**.
- Pixel-probe after build: compose checkboxes, Send button, callout tones, ConfirmModal, PatientContextBanner — screenshot, not DOM attributes.
- Regression-check the already-good BEM areas (rows, reader, chat, pills) — BEM is non-layered so it should win, verify visually.

### COMHUB-1 · Live bug fixes
- L1 badge selector (restyle `.nc-comm-row-badge--warn` for the real structure; delete dead `--new` rule).
- T1 dead search: client-side filter of reminder rows by patient/from/preview (no new query — SCALE-safe), or hide the search box on the reminders lens; **recommend filter, search should just work**.
- L2 poll flash: background refresh keeps current rows (`listLoading` only when the list is empty/lens changed; subtle refresh indicator otherwise).
- R6 `window.alert` → `showDeskToast` (error tone) at all 6 call sites.
- L3 ARIA: move the truncation callout outside the listbox; scope `aria-live` to a status line.

### COMHUB-2 · Compose pane redesign (the big untouched component)
- Premium header parity with the reader (title, quiet type tag, close affordance).
- Recipients: BEM check rows + filter-as-you-type box + "selected" chips summary; select-all.
- Remove the Status dropdown (C3); keep Type, Patient (banner/chip once chosen), Due date (when enabled), Message.
- Inline validation while typing (body length, ≥1 recipient) with the submit button enabling live; values preserved on error; pane closes on success (existing behavior).
- Fax-attachment info as a proper info callout with plain-English copy.
- i18n every string.

### COMHUB-3 · Reminders side completion
- Reminder reader parity: avatar + patient banner + urgency badge header, **Mark completed as the header done-toggle** (same component style as messages), Forward + Open chart icon actions stay.
- Toolbar becomes lens-aware for the primary action: messages → "+ New message", reminders → "+ New reminder"; "View log" moves to a toolbar secondary button on the reminders lens.
- **Delete `nc-comm-footer`.**
- ReminderCreatePane: unify remaining shadcn fields onto the BEM field/label pattern; date presets as chips; inline validation; i18n.

### COMHUB-4 · Reminder log redesign
- Verify/bound the query (SCALE R-rules), add pagination or "latest N" cap with count.
- Column redesign per LG3; truncate message with expand; DD/MM/YYYY labels.
- Filter bar: status pills instead of a select; date range; admin people filters as the recipient-box pattern with labels "Sent by (person)" / "Sent to (person)" so they can't be confused with the date fields.
- Responsive: card rows under 768px (or scroll container), proper loading/empty/error states.

### COMHUB-5 · Toolbar polish + cross-cutting sweep
- Lens switcher as segmented control style with count badges; activity options renamed "Open / Done / All"; sort collapsed into a single labeled select (or menu); drop inline styles.
- i18n leftover sweep (X1) + `npm run i18n:extract`.
- Keyboard/Esc paths (X2); touch-target check (44px) across all new controls.

### COMHUB-6 · Verify + docs
- Vitest suite (extend hub/compose/reminder tests for the new behaviors), `npm run check` (i18n gate + bs:check), `npm run frontend:build`, **asset version bump**, hard-refresh instruction.
- Browser screenshot QA: messages lens (list+reader+chat+compose), reminders lens (list+reader+create+log), mobile width, dark shell if applicable.
- Docs: bump `NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md` (history row: compose/reminder/log completion), sync scorecard + README index.

**Order matters:** COMHUB-0 must land first; 1–4 are independent after that; 5–6 close the batch. All of it is one "fix ALL in one pass" batch with a single version bump at the end.

---

## 4. States (per redesigned region)

| Region | Loading | Empty | Error | Success |
|---|---|---|---|---|
| List (both lenses) | skeleton rows, no flash on background poll | "No messages — Messages sent to you appear here" + New message action / "No reminders due in the next 30 days" + New reminder action | inline error callout + Retry | rows |
| Reader | lightweight spinner text | "Select an item to read details." (unchanged) | error callout + Retry | reader |
| Compose / Reminder create | "Loading form…" | — | error callout (load) / inline callout (submit), values preserved | pane closes, toast "Message sent" / "Reminder created", list+counts refresh |
| Reminder log | skeleton table/cards | "No reminders found for this filter." + Reset filters | error callout + Retry | table/cards + count |

## 5. Open design questions (defaults chosen — flag if you disagree)

1. **Search on reminders**: plan says make it filter client-side (default) rather than hide it.
2. **Compose Status dropdown**: plan removes it (backend keeps accepting it; no API change).
3. **Sort controls**: collapse to one select ("Newest first / Oldest first / By patient / By sender / By type") — loses the field×order matrix but matches real use. Keep both selects if the matrix matters.
4. Reminder log export (CSV) — not planned; say the word if the clinic needs it.

## 6. Hand-off

- Flag: existing `enable_react_communications_hub` (default true) — no new flags, no schema, no ACL changes; backend actions untouched except verifying the reminder-log bound.
- Files: `frontend/src/islands/communications-hub/*` (all panes + main.css), `oe-module-new-clinic/public/assets/css/communications-hub.css`, `templates/communications.html.twig` (toolbar), tests alongside.
- Build path: `/verify-batch` after the batch; screenshot QA is mandatory (this page's bug history was only ever caught by pixels).

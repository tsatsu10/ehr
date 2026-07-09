# Scheduling & Flow — Redesign Specification (Calendar, Flow Board, Recalls)

| Field | Value |
|-------|--------|
| **Document version** | 0.2.6 |
| **Status** | **In scope for V1** (package S1 — PRD D17, §20 dual-track) |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](../NEW_CLINIC_V1_PRD.md) (v1.20.14), [NEW_CLINIC_V1_USER_WORKFLOWS.md](../NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.25), [NEW_CLINIC_V1_PAGE_DESIGNS.md](../NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.25), [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](../MEDICAL_RECORD_DASHBOARD_REDESIGN.md) (v0.2.22), [NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md](./NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md) (v1.0.3) |
| **Audience** | Product, design, clinical leads, implementers, QA |
| **Scope** | Core OpenEMR Calendar (PostCalendar), Patient Flow Board, and Recalls |
| **Implementation** | Design only — no code in this document |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Current-state snapshot](#2-current-state-snapshot)
3. [Why the three do not align today](#3-why-the-three-do-not-align-today)
4. [Design goals & principles](#4-design-goals--principles)
5. [Unified scheduling shell & shared components](#5-unified-scheduling-shell--shared-components)
6. [Calendar redesign](#6-calendar-redesign)
7. [Flow Board redesign](#7-flow-board-redesign)
8. [Recalls redesign](#8-recalls-redesign)
9. [Cross-system alignment](#9-cross-system-alignment)
10. [Data model changes](#10-data-model-changes)
11. [Accessibility & mobile](#11-accessibility--mobile)
12. [Phasing & implementation strategy](#12-phasing--implementation-strategy)
13. [Open questions](#13-open-questions)
14. [Document history](#14-document-history)

---

## 1. Purpose & positioning

OpenEMR ships three scheduling-adjacent surfaces that grew independently and look, behave, and integrate differently:

| System | What it answers | Core table |
|--------|-----------------|-----------|
| **Calendar** (PostCalendar) | "When is everyone booked?" | `openemr_postcalendar_events` |
| **Patient Flow Board** | "Who is in the building right now and where?" | `patient_tracker` (+ calendar) |
| **Recalls** | "Who do we need to call back later?" | `medex_recalls` (+ MedEx) |

This document analyses each in its current state, identifies why they fail to feel like one product, and specifies a **unified Scheduling & Flow experience** that meets modern UI/UX standards while respecting the New Clinic constraints already locked in the PRD — in particular the **scheduled-integration coexistence rules (PRD §6.7)** and its hard rules **H1–H4** (never let a recall write rewrite demographics or trigger messaging; never call `calendar_arrived()`; never duplicate queue logic; never rely on core auto-encounter / `todaysEncounterCheck()` after the module already created the encounter — PRD §6.7.3 H4 / D19).

**Positioning vs the walk-in system (PRD D17).** V1 builds **both fully**. New Clinic's `new_visit` queue (Visit Board + role desks) is **Mode 1 — today's flow**. This document is **Mode 2 — the schedule system** (S1), built in parallel per PRD §20. At the door, every patient joins Mode 1 via Start visit; S1 provides booking, recalls, appointment check-in, and the §6.7 bridge.

**Design-only.** No code here. Wireframes are ASCII; components reference the New Clinic UI Kit (Bootstrap 4.6, Font Awesome, CSS variables, Twig, `xl()`/`xlt()`).

---

## 2. Current-state snapshot

Grounded in code (file:line where useful). Full exploration captured the detail; this is the redesign-relevant summary.

### 2.1 Calendar (PostCalendar)

**How it works.** Menu -> `interface/main/main_info.php` builds a URL and redirects to `interface/main/calendar/index.php`, which persists facility/provider/viewtype to session and boots a PostNuke-era stack (`pnInit()` -> `pnModFunc('PostCalendar','user','view')`). `pnuserapi.php::postcalendar_userapi_buildView()` builds time slots from `schedule_start`/`schedule_end`/`calendar_interval`, resolves providers via `UserService::getUsersForCalendar()`, queries events, and renders Smarty `pntemplates/default/views/{day,week,month}/ajax_template.html`.

**UI.** Day = time column + one column per provider; Week = a separate table per provider with 7 day columns; Month = a separate table per provider. Events are **absolutely-positioned divs** colored by `pc_catcolor` (or facility color when `event_color=2`). The left sidebar holds facility/provider multi-select filters and a mini datepicker; filter changes **full-form POST** and reload.

**CRUD.** Add/edit opens `add_edit_event.php` in a `dlgopen()` modal (ACL `patients/appt`): category (`pc_catid`), title, facility, patient/group, provider(s), date/time/duration, recurrence (`pc_recurrtype` 0-3 + serialized `pc_recurrspec`), status (`pc_apptstatus`), room (`pc_room`), comments.

**Pain points.** PostNuke/Smarty fork alien to the rest of OpenEMR; ~1,000 lines of near-duplicated inline JS across day/week/month; **double-click-to-edit only**; **no drag/drop, no resize, no inline edit**; filters require full page POST; month view still uses GIF icons while day/week use Font Awesome; hardcoded category IDs in templates; grid cells not keyboard-focusable, no ARIA on events; sidebar **hidden below `md`** so mobile loses filters; fixed 20%/80% split with 25rem columns forces horizontal scroll.

### 2.2 Patient Flow Board

**How it works.** `interface/patient_tracker/patient_tracker.php` is a **two-mode page**: a shell with a filter form + empty `#flb_table`, and an AJAX fragment (`flb_table=1`) returning table HTML injected by `refreshMe()` on a `pat_trkr_timer` interval (default 20s). It is **an HTML table, not a kanban** — one row per appointment, sourced from `fetchAppointments(..., tracker_board=true)` (calendar events LEFT JOIN `patient_tracker`). Row background color comes from the status' `notes` (`HEXCOLOR|alert_minutes`). Time-in-status over threshold adds a CSS **blink** class.

**Status change.** Clicking the status/room button opens `patient_tracker_status.php` (a 500x250 popup) when a tracker row exists, else the calendar editor. Save calls `manage_tracker_status()` which appends a `patient_tracker_element` (status/room/seq/user/time) and syncs `pc_apptstatus`/`pc_room` back to the calendar. The status popup still does a **legacy full-form submit on the opener**.

**Status model.** `list_options.apptstat`: `toggle_setting_1=1` = check-in status, `toggle_setting_2=1` = check-out status, `notes` = color + alert minutes. Rooms are a separate list (`patient_flow_board_rooms`).

**Pain points.** Table/list, not a visual pipeline; status change is modal + opener-submit; appointments without tracker rows open the heavy calendar editor; full-fragment reload every cycle (no delta); status communicated mainly by **background color** (color-blind risk) and **blink** (motion risk), no ARIA live region; `<td>` used inside `<thead>`; mobile header columns lack matching body cells (misalignment); recurring appointments excluded from tracker; `calendar_arrived()` bypasses the tracker leaving timeline gaps; `clearInteral` typo in timer cleanup; ~1,130-line monolith with ~330 lines inline jQuery.

### 2.3 Recalls

**How it works.** Almost all recall logic lives under MedEx (`library/MedEx/API.php`) even when MedEx messaging is off. UI is the **Recall Board** (`messages.php?go=Recalls` -> `display_recalls()`) and **New Recall** (`?go=addRecall` -> `display_add_recall()`); a read-only recall card appears on the demographics chart. Creating: pick patient (popup), fill date/reason/provider/facility/contact, **Add Recall** -> `save_recall()`.

**Data + MedEx.** `medex_recalls` with `UNIQUE(r_PRACTID, r_pid)` and `ON DUPLICATE KEY UPDATE` => effectively **one recall per patient**. Recalls are packaged as synthetic `pc_eid = "recall_{pid}"` rows in `medex_outgoing` and dispatched as SMS/email/AVM by RECALL-group campaigns; progress/history reads the same key. Without a MedEx subscription, local CRUD + manual phone/notes/postcards/labels still work; automated messaging and status-color tabs do not.

**Pain points (and one hazard).** **Hazard:** `save_recall()` always rewrites `patient_data` (phones, email, **HIPAA consent flags**, address) from `$_REQUEST` — a scheduling intent can silently corrupt the chart and consent (this is exactly PRD §6.7 H1). One recall per patient; **no structured status/outcome** (inferred from colors + outgoing history); overdue handling implicit (default filter hides >6 months old); **no edit screen** (save replaces); buried inside Message Center with a dead-end "Recalls" tab; icon-only actions, hardcoded English confirms, wide 8-column table with `display:none` rows; tight MedEx coupling.

---

## 3. Why the three do not align today

They share data and intent but were never designed as one product.

| Dimension | Calendar | Flow Board | Recalls | Misalignment |
|-----------|----------|------------|---------|--------------|
| **UI paradigm** | Absolute-positioned grid (PostNuke/Smarty) | HTML table (Bootstrap 4) | HTML table in Message Center | Three different visual languages |
| **Navigation** | Calendar tab (iframe redirect) | Patient Flow Board menu | Recalls menu / Messages | No single "Scheduling" home |
| **Filters** | Sidebar multi-select, full POST | Inline form, AJAX + client refine | Client-side row hide | Same facility/provider/date re-implemented 3x; no shared state |
| **Status vocabulary** | `pc_apptstatus` (sets it) | `apptstat` + toggle flags (consumes it) | None (colors inferred from MedEx) | Calendar and Flow Board share a model; Recalls is an island |
| **Refresh** | Full page POST | AJAX fragment poll | Manual | Inconsistent freshness model |
| **CRUD pattern** | `dlgopen` modal | popup + opener submit | AJAX to `save.php` | Three modal/submit conventions |
| **Data linkage** | Owns events | Reads events, writes status | Siloed `medex_recalls` | Recall has no link to the appointment it should produce |
| **Accessibility** | None on grid | Color + blink only | Icon-only, English JS | All three fail WCAG basics differently |
| **Mobile** | Sidebar hidden < md | Column misalignment | Wide table | None usable on a phone |

**The core alignment gaps:**

1. **No shared shell.** A user books on the Calendar, watches arrivals on the Flow Board, and chases follow-ups on the Recall Board — three pages, three layouts, three mental models.
2. **The status model is half-shared.** Calendar *sets* `pc_apptstatus`; Flow Board *reads* it via `apptstat` toggles. Recalls ignore it entirely and infer state from MedEx message history.
3. **The lifecycle is broken in the middle.** A recall should close the loop by becoming an appointment, which becomes a flow-board arrival. Today a recall has no structured link to the appointment it produces, and `recall_{pid}` is auto-deleted heuristically (future appt within 90 days). The "loop" is implicit and lossy.
4. **Filters and freshness diverge.** Facility/provider/date are re-built three times; refresh is full-POST vs poll vs manual.
5. **Each carries its own hazards.** Calendar's recurring events break tracker linkage; Flow Board's `calendar_arrived()` bypass leaves timeline gaps; Recalls' save rewrites demographics/consent.

---

## 4. Design goals & principles

| # | Goal | Principle |
|---|------|-----------|
| G1 | **One suite, three lenses** | A single **Scheduling & Flow** shell with three tabs (Calendar / Flow Board / Recalls) sharing top bar, filter bar, and components. |
| G2 | **One status model** | A single appointment-status vocabulary (`apptstat` + toggle flags) is the source of truth; all three surfaces read/write it consistently. Recalls gain their own explicit status field (§10). |
| G3 | **Close the loop** | Recall -> Appointment -> Flow Board arrival is a first-class, linked, auditable chain — not heuristics. |
| G4 | **Modern interaction** | Drag/drop + resize on Calendar; inline single-click status advance on Flow Board; real worklist on Recalls. Modal-only CRUD retired. |
| G5 | **Accessible by default** | WCAG 2.1 AA: status conveyed by shape+label+color (never color alone), ARIA roles/live regions, full keyboard, no blink (use a steady "overdue" treatment + optional sound). |
| G6 | **Responsive** | Phone/tablet-first layouts; filters never disappear; columns reflow, not horizontal-scroll. |
| G7 | **Shared filter + freshness** | One filter bar (facility, provider, date/range, search) with shared state and a consistent near-real-time refresh contract. |
| G8 | **Respect locked constraints** | Honor PRD §6.7 **H1–H4**: recall writes never touch demographics/consent or trigger messaging implicitly (H1); never call `calendar_arrived()` (H2); never duplicate the `new_visit` queue (H3); never rely on core auto-encounter at check-in after the module created one — status write is field-only via `updateAppointmentStatus()` (H4 / D19). |
| G9 | **Incremental, low-risk** | Ship as an overlay/redesign that can coexist with the legacy screens behind a toggle; no big-bang core fork. |

**Non-goals (V1 of this redesign):** replacing MedEx as the messaging provider; building a patient-facing self-scheduling portal; multi-week resource optimization/auto-booking; insurance/eligibility in the booking flow (cash-first per PRD).

---

## 5. Unified scheduling shell & shared components

### 5.1 The shell

One page, three lenses. Tabs switch the working surface; the top bar and filter bar persist and keep state across tabs.

```text
+--------------------------------------------------------------------------+
|  Scheduling & Flow            [ Today ]  < June 11, 2026 >   [ + Book ]   |  <- top bar
+--------------------------------------------------------------------------+
|  [ Calendar ] [ Flow Board ] [ Recalls ]                       (tabs)     |
+--------------------------------------------------------------------------+
|  Facility [ Main v ]  Provider [ All v ]  Date/Range [..]  Search [____]  |  <- shared filter bar
+--------------------------------------------------------------------------+
|                                                                          |
|                      ( active lens renders here )                        |
|                                                                          |
+--------------------------------------------------------------------------+
```

| Shell element | Behavior |
|---------------|----------|
| Top bar | Title, Today button, date stepper (context-sensitive: day/week/month for Calendar; day for Flow Board; range for Recalls), primary CTA (**Book** on Calendar/Flow, **New recall** on Recalls). |
| Tabs | Calendar / Flow Board / Recalls. Tab + filter state encoded in the URL (deep-linkable, back-button safe). |
| Filter bar | Shared facility, provider(s), date/range, and search. One source of truth; each lens reads the same state (§9.2). |
| Density | Comfortable default; compact toggle persists per user. |

### 5.2 Shared component library

Built once, reused across all three lenses (and aligned to New Clinic UI Kit tokens).

| Component | Used by | Notes |
|-----------|---------|-------|
| **Status pill** | Calendar, Flow Board | Shape + short label + color (never color alone). Maps to `apptstat`; check-in/out variants from toggle flags. Tooltip = full label + who/when. |
| **Patient chip** | All | Avatar/initials, name, age/sex, MRN; click = peek; modifier-click = open chart. Masks phone per ACL. |
| **Filter bar** | All | Facility, provider multi-select with typeahead, date/range, debounced search. Emits one shared state object. |
| **Provider/resource selector** | Calendar, Flow Board | Multi-select with color legend; "All" option scoped to facility. |
| **Room selector** | Flow Board, booking | From `patient_flow_board_rooms`; inline, not a separate popup. |
| **Time-in-state meter** | Flow Board | Steady progress treatment (green -> amber -> red) with numeric minutes + ARIA; **no blink**. |
| **Booking sheet** | Calendar, Flow Board, Recalls (convert) | Slide-over (not full modal) for create/edit appointment; same component everywhere. |
| **Peek popover** | All | Lightweight read-only summary on single click; actions to edit/open. |
| **Empty / loading / error states** | All | Consistent skeletons, empty hints, and retry banners (mirrors PAGE_DESIGNS patterns). |
| **Toast + optional sound** | Flow Board, Recalls | Non-blocking notifications for arrivals/overdue; sound opt-in per user. |

### 5.3 Visual language

- **Status by triple-encoding:** icon/shape + text label + color token. A fixed legend is always reachable (inline on Flow Board; popover on Calendar).
- **Category colors** come from `pc_catcolor` but are normalized to accessible contrast; a category legend is shown on demand instead of relying on memorized pastels.
- **Motion:** transitions <= 200ms; respect `prefers-reduced-motion`; overdue is a steady state, never a blink.

---

## 6. Calendar redesign

**Goal:** a modern resource calendar that keeps the existing data model (`openemr_postcalendar_events`, categories, recurrence, `pc_apptstatus`) but replaces the PostNuke/Smarty grid and double-click interaction.

### 6.1 Views

| View | Layout | Use |
|------|--------|-----|
| **Day** | Time rows x provider columns (resource view) | Front desk daily booking |
| **Week** | Time rows x 7 days, provider selectable/overlaid | Provider self-view |
| **Month** | Day cells with event chips + overflow "+N more" | Capacity glance |
| **Agenda (new)** | Vertical list grouped by day | Mobile default; accessible fallback |

```text
DAY VIEW (resource columns)
        | Dr. Mensah        | Dr. Owusu         | Nurse Room        |
  08:00 | [Office Visit ]   |                   |                   |
  08:15 | [Akua M.  @Arr ]  | [New Patient    ] |                   |
  08:30 |                   | [Kwame O.       ] | [Vitals walk-in ] |
  08:45 | <-- drag to move / drag edge to resize -->                |
```

### 6.2 Interaction (replaces double-click-only)

| Action | Behavior |
|--------|----------|
| **Single click slot** | Booking sheet opens pre-filled with slot time + provider/resource column. |
| **Single click event** | Peek popover (patient, time, status, room, actions). |
| **Drag event** | Move to a new time/provider; confirm on drop; optimistic update + rollback on failure. |
| **Drag event edge** | Resize duration; snaps to `calendar_interval`. |
| **Keyboard** | Slots and events are focusable; Enter = open; arrow keys move focus; documented shortcuts (n = new, t = today, d/w/m/a = views). |
| **Recurring edit** | On move/edit of a recurring event, prompt **This / This+future / All** (preserves current semantics). |

### 6.3 Booking sheet (slide-over, replaces `dlgopen` modal)

Progressive, single-column, mobile-friendly. Fields map 1:1 to today's `add_edit_event.php` so the backend contract is unchanged:

- Patient (typeahead picker) or Group; category (`pc_catid`, drives default duration/color/title); provider(s); facility/billing facility; date/time/duration; **room** (inline selector); recurrence (single clear control with preview of generated dates); status (`pc_apptstatus`); comments.
- **Find available** surfaces open slots inline rather than a separate popup.
- Validation at the boundary (required category, provider, date/time; duration > 0).

### 6.4 Filters & freshness

- Facility/provider/date come from the **shared filter bar** (§5.1) — no separate sidebar full-POST.
- Provider color legend shown on demand; "All facilities" cross-facility events render as a clearly-labeled muted style (kept for admins; hidden by default for single-facility users).
- Calendar refreshes via the shared contract (§9.3); edits broadcast so the Flow Board lens updates without a manual reload.

### 6.5 Accessibility & mobile

- Grid exposes ARIA grid/row/gridcell roles; events are buttons with accessible names ("08:15 Akua Mensah, Office Visit, Arrived").
- Month GIF icons replaced with Font Awesome; category color paired with a label/legend.
- **Mobile = Agenda view by default**; day/week available via horizontal scroll *within* the grid only, never the whole page; filters stay in a collapsible-but-present bar (not hidden entirely).

### 6.6 Calendar improvements summary

Drag/drop + resize; single-click peek/book; agenda view; shared filter bar; keyboard + ARIA; accessible colors + legend; slide-over booking; cross-lens live updates; retire duplicated day/week/month inline JS into one componentized view.

---

## 7. Flow Board redesign

**Goal:** turn the status *table* into a genuine visual *flow*, keep the `patient_tracker` / `patient_tracker_element` audit trail and the `apptstat` status model, and fix the color-only / blink / modal-submit accessibility problems.

### 7.1 Two layouts, same data

| Layout | When | Description |
|--------|------|-------------|
| **Board (default)** | Desktop / wall display | Kanban columns grouped by **status stage**; patients are cards that move between columns. |
| **List** | Dense days, admin, accessibility | The current table, modernized (proper `<th>`, no blink, ARIA), as a toggle. |

Status stages are derived from the configurable `apptstat` list, grouped into ordered lanes (default: **Booked -> Arrived -> Roomed -> With provider -> Checked out**). Check-in/check-out lanes come from `toggle_setting_1`/`toggle_setting_2`; intermediate statuses map to lanes via admin config (§10.3).

```text
BOARD VIEW
  Booked (3)      Arrived (2)     Roomed (1)      With provider   Checked out
  +-----------+   +-----------+   +-----------+   +-----------+   +-----------+
  | Akua M.   |   | Kwame O.  |   | Yaa A.    |   | (empty)   |   | Kofi D.   |
  | 08:15 OPD |   | 12m  Rm-? |   | Rm 3  24m |   |           |   | done 13:02|
  +-----------+   +-----------+   +-----------+   +-----------+   +-----------+
  | ...       |   | Esi B.    |
  +-----------+   | 31m !ALERT|   <- steady amber/red, numeric, ARIA (no blink)
                  +-----------+
```

### 7.2 Interaction (replaces popup + opener-submit)

| Action | Behavior |
|--------|----------|
| **Advance status** | Single click "Next" on a card, or **drag card to a lane**. Writes via `manage_tracker_status()` (appends element, syncs calendar). Optimistic + rollback. |
| **Assign room** | Inline room selector on the card (no separate popup). |
| **Open / peek** | Click card = peek popover; modifier-click = chart/encounter. |
| **No tracker row yet** | Lightweight **Check in** on the card creates the tracker row and syncs calendar status — **Mode 2 only**; does **not** create `new_visit`. Staff must still use Front Desk **Start visit & check in** for clinical queue (D19). Never via `calendar_arrived()` (PRD §6.7 H2). |
| **Refresh** | Shared near-real-time contract (§9.3) with delta updates; manual refresh still available. |

### 7.3 Time-in-status (replaces blink)

- A steady meter per card: green within target, amber approaching `alert_minutes`, red past it, with the **numeric minutes always visible** and an ARIA live announcement when a card crosses the threshold.
- Optional, opt-in **sound** on new arrival or threshold breach (per-user; off by default). Respects `prefers-reduced-motion` (no flashing).

### 7.4 Columns, filters, configurability

- Filter bar shared with the suite (facility, provider, date = today by default, search).
- **Per-user column/lane preferences** (which lanes to show, card fields) replace the global-only toggles (`ptkr_show_pid`, etc., remain as defaults).
- Room and facility are first-class card fields, not hidden inside a button.
- Checkout roll-off (`checkout_roll_off`) preserved but a "show completed" toggle lets staff see the day's history without changing config.

### 7.5 Accessibility & mobile

- Status conveyed by lane position + label + icon + color (never color alone); ARIA `list`/`listitem` semantics; live region for arrivals and threshold breaches.
- Fixes current defects: proper `<th>` headers in List layout; header/body column parity; no `clearInteral` timer leak in the new componentized refresh.
- **Mobile:** lanes become a horizontally swipeable set or a stacked accordion (one lane expanded at a time); cards stay full-width and tappable.

### 7.6 Flow Board improvements summary

Kanban + modernized list toggle; drag/inline status advance; inline room; lightweight check-in (no calendar editor, no `calendar_arrived()`); steady accessible time-in-status (no blink) + optional sound; per-user columns; delta refresh; recurring-safe (chip-only when `pc_recurrtype != 0`, mirroring core).

---

## 8. Recalls redesign

**Goal:** promote recalls from a MedEx-buried table into a first-class **Recall Worklist** with real statuses, multiple recalls per patient, an explicit link to the appointment they produce, and **zero demographic/consent side effects** (PRD §6.7 H1).

### 8.1 Recall Worklist (replaces the Message Center board)

A dedicated lens in the suite — also reachable from its own menu — built for "work the list" outreach.

```text
RECALL WORKLIST
  Filters: Facility | Provider | Reason | Status | Due range | Search
  Tabs:  [ Due now (12) ] [ Overdue (5) ] [ Upcoming ] [ Completed ]
  +------------------------------------------------------------------+
  | Patient        Due        Reason         Status        Contact   |
  | Akua Mensah    -3d OVERDUE 6-mo review    Needs call    SMS ok    |
  |   [ Call ] [ Log outcome ] [ Book appt ] [ Snooze ] [ ... ]       |
  | Kwame Owusu    in 2d       Lab follow-up  Contacted     Email ok  |
  +------------------------------------------------------------------+
```

| Element | Behavior |
|---------|----------|
| Tabs | Due now / Overdue / Upcoming / Completed (derived from due date + status). |
| Overdue badge | "**-3d**" steady treatment + sortable "days overdue" (replaces the implicit 6-month hide). |
| Row actions | Call, Log outcome, **Book appointment** (opens the shared booking sheet, pre-linked to the recall — closes the loop, §9.1), Snooze (push due date with reason), Edit, Delete. |
| Contact column | Shows consent state read-only (SMS/email/voice allowed) — **display only**, never edited here (H1). |

### 8.2 Create / edit recall (no demographic writes)

A slide-over with **only recall fields**: patient, due date (with "+N months from last visit" helper), **reason/type** (from a configurable list), provider, facility, note.

- **Hard rule (H1):** the recall save path writes **only** the recall record. It **never** updates `patient_data` phone/email/address or HIPAA consent. If contact details are wrong, the user is deep-linked to the demographics editor (separate, audited) — the recall form shows them read-only.
- **Edit is real:** editing updates the existing recall; it does not delete-and-replace.
- **Multiple recalls per patient:** the one-per-patient constraint is removed (§10.2) so a patient can have, e.g., a lab follow-up and an annual review concurrently, each with its own reason/status.

### 8.3 Explicit statuses & outcomes (new)

Structured lifecycle replaces color-inference:

```text
 open --> contacted --> scheduled --> completed
   |          |             |
   +----------+--> declined / unreachable (terminal, with reason)
   +--> snoozed (re-enters open at new due date)
```

Each outreach attempt is logged (channel, time, user, outcome) — reusing `medex_outgoing` history where MedEx is present, plus a local outcome on the recall row so the worklist works **without** a MedEx subscription.

### 8.4 Messaging (MedEx optional, decoupled)

- With MedEx: automated SMS/email/AVM via RECALL campaigns continue, keyed as today (`recall_{pid}` in `medex_outgoing`); the worklist surfaces send/reply status.
- Without MedEx: the worklist is fully usable for **manual** outreach (call, postcard, label, note) with local outcome logging.
- Messaging is **never** triggered as a silent side effect of saving a recall; it is an explicit action or a configured campaign.

### 8.5 Loop closure

Booking an appointment from a recall links them (`recall.produced_eid`, §10.2). When that appointment is kept (checked in on the Flow Board), the recall auto-advances to **completed** with a real reference — replacing the current heuristic auto-delete (future appt within 90 days). The link is auditable and reversible.

### 8.6 Recalls improvements summary

Dedicated worklist with due/overdue/upcoming/completed; multiple recalls per patient; explicit statuses + outcome logging; real edit; **no demographic/consent side effects**; explicit (never silent) messaging; loop closure via linked appointment; MedEx optional; accessible, mobile-friendly list with labeled actions and i18n.

---

## 9. Cross-system alignment

### 9.1 The unified lifecycle

The redesign makes the implicit chain explicit and linked end to end:

```text
 Recall (due)  --book-->  Appointment (Calendar)  --arrive-->  Flow Board
      ^                          |                                  |
      |                          | (kept & checked in)              |
      +-------- completed <------+----------------------------------+
                (linked, audited; replaces 90-day auto-delete heuristic)
```

- **Recall -> Appointment:** booking from the worklist opens the shared booking sheet and stores `recall.produced_eid`.
- **Appointment -> Flow Board:** unchanged core path (appears from calendar; tracker row on check-in). New Clinic walk-ins remain separate (`new_visit`), surfaced per PRD §6.7.
- **Back to Recall:** keeping the appointment advances the recall to completed via the stored link.

### 9.1a Front Desk arrival bridge (multi-doctor)

When reception uses **Start visit & check in** (PRD M0-F16 / §6.7.5), the atomic transaction:

1. Creates encounter + `new_visit` (walk-in queue / Visit Board).
2. Copies appointment **`pc_aid` → `new_visit.assigned_provider_id`** as a **soft hint** (PRD §6.5.1, D28).
3. Does **not** assign the patient to a doctor-only sub-queue — the visit still enters the **shared** `ready_for_doctor` pool after triage (or skip triage).

Nurse **Send to doctor** never selects a provider. Doctors use Doctor Desk **All / Me** filter; **Take patient** sets provider when still NULL. V1.1 advisory routing may set `routing_suggested_provider_id` (PRD §6.5.2). V1.2 optional hard assignment (`hard_assigned_provider_id`, PRD §6.5.3) and doctor-ready notify (§6.5.4) — config OFF by default.

See [USER_WORKFLOWS §8.3.1](../NEW_CLINIC_V1_USER_WORKFLOWS.md#831-multi-doctor-clinics) and [§8.3.2](../NEW_CLINIC_V1_USER_WORKFLOWS.md#832-advisory-routing-v11).

### 9.2 Shared filter & navigation state

- One filter state object (facility, provider(s), date/range, search) lives in the shell and is read by whichever lens is active; switching tabs preserves it where meaningful (facility/provider carry; the date control adapts: day/week/month vs day vs range).
- State is encoded in the URL for deep-linking and back-button correctness.
- Cross-links: a Calendar event peek links to its Flow Board card (if arrived) and to any originating recall; a Flow Board card links back to the calendar event; a recall links to its produced appointment.

### 9.3 Refresh contract

| Surface | Default | Mechanism |
|---------|---------|-----------|
| Calendar | On demand + on local edit broadcast | Re-query changed range; optimistic local edits |
| Flow Board | Near-real-time (configurable, default ~20s) | **Delta** fetch (changed cards only) replacing full-fragment reload |
| Recalls | On demand | Worklist re-query on action/filter change |

All three share one polling/refresh utility and one "stale data" affordance, retiring the three divergent models (full-POST / fragment-poll / manual).

### 9.4 One status model

`apptstat` (with `toggle_setting_1`/`toggle_setting_2` and `notes` = color|alert) stays the single source of truth for appointment state across Calendar and Flow Board. Lane grouping for the board is an admin mapping on top of that list (§10.3). Recalls get their own explicit status field (§10.1) because they are not appointments — but the two vocabularies are presented with the same status-pill component.

### 9.5 Scheduling ↔ visit queue boundary (D18 / H3)

S1 owns **Mode 2** UX (Calendar, Flow Board, Recalls). The clinical floor queue (`new_visit`, Visit Board) is **Mode 1** — intentionally **not** bidirectionally synced with `patient_tracker` (PRD D18, H3). The happy-path bridge is **Start visit & check in** (§9.1a).

**Exception reconciliation** (arrived on Flow Board but no clinical visit; visit active but appointment still Booked; recurring informational gaps) is **out of scope for S1** and specified in [NEW_CLINIC_V1_SCHEDULING_QUEUE_BOUNDARY_REDESIGN.md](./NEW_CLINIC_V1_SCHEDULING_QUEUE_BOUNDARY_REDESIGN.md) — **M18 Queue Bridge Hub** (V1.1-BRIDGE, v0.1.2): detect + guided one-way fixes + EOD sweep; **no** background sync engine.

**Mode 2 vs Mode 1:** S1 Flow Board status writes update **schedule + tracker only**. They do **not** create `new_visit`. Clinical floor truth remains Visit Board; `@` on Flow Board without Front Desk bridge is a common staff mistake and **EX-01** when M18 is enabled.

---

## 10. Data model changes

Additive and backward-compatible; no destructive changes to core tables. New structures can live in module tables to honor the no-core-fork strategy (§12).

### 10.1 Recall status & outcomes

| Field | Purpose |
|-------|---------|
| `recall_status` | `open` / `contacted` / `scheduled` / `completed` / `declined` / `unreachable` / `snoozed` |
| `recall_type` (list) | Configurable reason/type (lab follow-up, annual review, ...) |
| `outcome_log` | One row per outreach: channel, datetime, user, result, note (reuses `medex_outgoing` when MedEx present; local table otherwise) |
| `snooze_reason`, `snoozed_to` | For the snoozed state |

### 10.2 Multiple recalls + loop link

- **Remove** the effective one-per-patient limit: replace `UNIQUE(r_PRACTID, r_pid)` semantics with a key that allows multiple **open** recalls per patient (e.g. unique on patient + type + open-status), so distinct reasons coexist.
- **Add** `produced_eid` (+ `produced_date`) linking a recall to the appointment it generated, enabling deterministic loop closure (§9.1) and replacing the heuristic auto-delete.
- Migration: existing single recalls map cleanly to one `open` recall with inferred type "general".

### 10.3 Flow Board lane mapping

- Admin config maps each `apptstat` option to an ordered **lane** (Booked/Arrived/Roomed/With provider/Checked out, extensible). Check-in/out lanes still anchor on the toggle flags.
- Per-user preferences table for visible lanes + card fields (defaults from existing globals).

### 10.4 What stays unchanged

`openemr_postcalendar_events`, `openemr_postcalendar_categories`, recurrence fields, `patient_tracker` / `patient_tracker_element`, and the `apptstat` list keep their schema and meaning. The redesign is UI + additive config/links, not a data rewrite.

---

## 11. Accessibility & mobile

| Area | Standard |
|------|----------|
| Color | Never the sole signal — pair with icon/shape + text on every status (Calendar, Flow Board, Recalls). |
| Motion | No blink; overdue/alert is a steady treatment; honor `prefers-reduced-motion`; sound is opt-in. |
| Keyboard | Full keyboard for grid slots, board cards, worklist rows, booking sheet; visible focus; documented shortcuts. |
| Semantics | ARIA grid (Calendar), list/listitem (Flow Board, Recalls), live regions for arrivals/threshold/overdue. |
| Targets | >= 44px touch targets; labeled icon buttons (fix icon-only delete/print). |
| i18n | All strings via `xl()`/`xlt()` (fix hardcoded English JS confirms); category labels via `xl_appt_category()`. |
| Mobile | Calendar -> Agenda default; Flow Board -> swipeable/accordion lanes; Recalls -> stacked rows; filter bar always present, collapsible not removed. |

---

## 12. Phasing & implementation strategy

Low-risk, incremental, coexisting with legacy screens behind a toggle (G9). Aligns with PRD §6.7 gating.

**Two distinct flags govern S1 (do not conflate):**

| Flag | Owner / default | Role |
|------|-----------------|------|
| `enable_scheduled_integration` | M6-F14, **default `ON`** (PRD §6.7.1, §12.4) | **Render gate** — whether scheduling exists for this clinic at all. When OFF (walk-in-only profile), the S1 menu entry and Front Desk chips are hidden. **All S1 surfaces must evaluate `enable_scheduled_integration === ON && disable_calendar !== ON` before rendering.** Not the redesign switch. |
| `enable_scheduling_redesign` | Module config, **default `OFF` until parity verified** | **Rollout/parity gate** — selects the redesigned S1 suite vs the legacy Calendar / Flow Board / Recall Board. Independent of the render gate; legacy screens remain reachable until parity is signed off, then hidden per §19-style config (PRD §5.4 "behind toggle until parity"). |

| Phase | Scope | Risk |
|-------|-------|------|
| **P1 — Shared foundation** | Scheduling shell, shared filter bar, status-pill / patient-chip / booking-sheet components, refresh utility. Behind `enable_scheduling_redesign`; legacy screens remain. | Low |
| **P2 — Flow Board** | Kanban + modernized list, inline status advance, steady time-in-status, delta refresh, lightweight check-in (no `calendar_arrived()`). | Medium |
| **P3 — Calendar** | Resource views + agenda, drag/drop + resize, slide-over booking, ARIA/keyboard. Backend contract unchanged. | Medium-High |
| **P4 — Recalls** | Recall Worklist, statuses/outcomes, multi-recall + loop link, **demographic-write removal (H1)**, MedEx decoupling. | Medium |
| **P5 — Loop closure** | Recall->Appointment->Flow Board linkage and auto-complete; cross-lens links. | Medium |

**Implementation notes**

- **No core fork required:** ship as a module overlay providing the new pages; new persistence (recall status/outcomes, lane mapping, per-user prefs, loop link) lives in module tables. Legacy `medex_recalls` stays the messaging source of truth; new fields extend it additively.
- **Honor §6.7 hard rules:** recall save never writes `patient_data`/consent (H1); arrivals never via `calendar_arrived()` (H2); no duplication of the `new_visit` queue (H3); never rely on core auto-encounter / `todaysEncounterCheck()` after the module created the encounter — field-only status write via `updateAppointmentStatus()` (H4 / D19); recurring appointments are chip-only for tracker writes (`pc_recurrtype != 0`).
- **Toggle + parity:** `enable_scheduling_redesign` enables the redesigned suite per facility; legacy Calendar/Flow Board/Recall Board remain available until parity is verified, then can be hidden per §19-style config. This is **separate** from the `enable_scheduled_integration` render gate (see §12 table).

---

## 13. Open questions

| # | Question | Owner | Leaning |
|---|----------|-------|---------|
| SCH-1 | Redesign as a standalone module overlay vs incremental core replacement? | Eng | Module overlay first (no-core-fork), promote later |
| SCH-2 | Real-time transport for Flow Board delta — short poll vs SSE/websocket? | Eng | Start with short poll (existing infra); SSE later |
| SCH-3 | Keep MedEx as the only messaging provider or abstract a messaging interface? | Product | Abstract interface; MedEx as first adapter |
| SCH-4 | Lane model: fixed 5 stages vs fully admin-defined ordered lanes? | Product/Clinical | Admin-defined with a sensible 5-stage default |
| SCH-5 | Should drag-to-reschedule notify the patient automatically (when MedEx on)? | Clinical | Explicit confirm, never silent |
| SCH-6 | Migration of the one-per-patient recall constraint on busy installs? | Eng | Additive; backfill to single `open` recall |
| SCH-7 | Do we retire the legacy PostCalendar templates after parity, or keep as fallback? | Eng/Product | Keep behind toggle for one release, then retire |

---

## 14. Document history

| Version | Date | Changes |
|---------|------|---------|
| 0.2.6 | 2026-06-24 | **Consistency audit fixes** — added hard rule **H4** to §1, G8, and §12 (anti-double-encounter / D19, was only H1–H3); §12 now names the two distinct flags — `enable_scheduled_integration` (render gate, default ON) vs `enable_scheduling_redesign` (parity/rollout gate, default OFF) — previously "a feature toggle"/"a global" unnamed |
| 0.2.5 | 2026-06-22 | **M18 audit** — §7.2 Mode 2 check-in clarifier; §9.5 integrated M18 + Mode 1/2 boundary; companion SCHEDULING_QUEUE_BOUNDARY v0.1.2 |
| 0.2.4 | 2026-06-22 | §9.5 cross-ref [Scheduling ↔ visit queue boundary](./NEW_CLINIC_V1_SCHEDULING_QUEUE_BOUNDARY_REDESIGN.md) (M18) |
| 0.2.3 | 2026-06-16 | §9.1a PRD §6.5.3 hard assignment + §6.5.4 notify cross-ref |
| 0.2.2 | 2026-06-16 | §9.1a cross-ref PRD §6.5.2 advisory routing |
| 0.2.1 | 2026-06-15 | §9.1a Front Desk arrival bridge — `pc_aid` → `assigned_provider_id` soft hint; PRD §6.5.1 D28 |
| 0.2.0 | 2026-06-11 | **Promoted to V1 in-scope** (S1, D17): aligned with PRD v1.11.0 dual-track §20; S-P1–P5 map to release milestones; default integration ON |
| 0.1.0 | 2026-06-11 | Initial redesign spec for Calendar, Flow Board, and Recalls: current-state analysis (grounded in code), alignment-gap analysis, unified scheduling shell + shared components, per-system redesigns, unified lifecycle/loop closure, additive data-model changes, accessibility/mobile standards, phasing. Aligned to PRD v1.10.0 (esp. §6.7 H1-H3), USER_WORKFLOWS v1.4.0, PAGE_DESIGNS v0.2.0, MRD Redesign v0.2.0. |

---

*End of Scheduling & Flow Redesign Specification*



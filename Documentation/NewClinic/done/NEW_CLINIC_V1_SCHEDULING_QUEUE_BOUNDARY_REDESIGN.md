# Scheduling ↔ Visit Queue Boundary — Redesign Specification

| Field | Value |
|-------|--------|
| **Document version** | 0.1.3 |
| **Status** | Draft for review — **S1** + **M0/M2** boundary locked (D18, H3); **M18 Queue Bridge Hub** integrated in PRD v1.20.39; **Appendix E audit closure**; **trilogy integrated** |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md) (v1.20.39), [NEW_CLINIC_V1_SCHEDULING_REDESIGN.md](./NEW_CLINIC_V1_SCHEDULING_REDESIGN.md) (v0.2.5), [NEW_CLINIC_V1_USER_WORKFLOWS.md](../NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.43), [NEW_CLINIC_V1_PAGE_DESIGNS.md](../NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.43), [NEW_CLINIC_V1_REPORTING_OPERATIONS_REDESIGN.md](./NEW_CLINIC_V1_REPORTING_OPERATIONS_REDESIGN.md) (v0.1.2) |
| **Audience** | Product, design, reception leads, clinic managers, implementers, QA |
| **Scope** | The **intentional split** between **Mode 2 — Scheduling & Flow** (`openemr_postcalendar_events`, `patient_tracker`) and **Mode 1 — Today's clinical queue** (`new_visit`, Visit Board, role desks); pain points, exception taxonomy, reconciliation UX, Ghana/West Africa practice |
| **Implementation** | Design spec only — no code in this document |
| **Primary market** | Private outpatient clinics — **West Africa** (Ghana launch region) |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Gap analysis — what S1 and PRD already cover](#2-gap-analysis--what-s1-and-prd-already-cover)
3. [Current-state snapshot (stock OpenEMR)](#3-current-state-snapshot-stock-openemr)
4. [Pain points by surface](#4-pain-points-by-surface)
5. [UI/UX principles for dual-system clinics](#5-uiux-principles-for-dual-system-clinics)
6. [How leading EHRs address these needs](#6-how-leading-ehrs-address-these-needs)
7. [West Africa & Ghana context](#7-west-africa--ghana-context)
8. [Information architecture — Queue Bridge Hub](#8-information-architecture--queue-bridge-hub)
9. [Exception taxonomy & detectors](#9-exception-taxonomy--detectors)
10. [Lens: Today's exceptions (worklist)](#10-lens-todays-exceptions-worklist)
11. [Lens: Arrival advisor (Front Desk embed)](#11-lens-arrival-advisor-front-desk-embed)
12. [Lens: End-of-day boundary sweep](#12-lens-end-of-day-boundary-sweep)
13. [Cross-surface integration](#13-cross-surface-integration)
14. [Navigation, ACL & config](#14-navigation-acl--config)
15. [Data model, APIs & queries](#15-data-model-apis--queries)
16. [Phasing & PRD alignment](#16-phasing--prd-alignment)
17. [Acceptance criteria](#17-acceptance-criteria)
18. [Closed decisions](#18-closed-decisions)
19. [Document history](#19-document-history)
20. [Appendix A — Exception catalog & resolve actions](#appendix-a--exception-catalog--resolve-actions)
21. [Appendix B — Ghana clinic day scenarios](#appendix-b--ghana-clinic-day-scenarios)
22. [Appendix C — User stories](#appendix-c--user-stories)
23. [Appendix D — Competitive reference matrix](#appendix-d--competitive-reference-matrix)
24. [Appendix E — Audit resolution log (v0.1.2)](#appendix-e--audit-resolution-log-v012)

---

## 1. Purpose & positioning

### 1.1 What this document is for

New Clinic V1 deliberately runs **two parallel systems** at the clinic door:

| Mode | Question | System of record | Daily UI |
|------|----------|------------------|----------|
| **Mode 1 — Today's flow** | “Who is in the clinic **right now** and where in care?” | `new_visit` + role desks | **Visit Board**, Triage, Doctor Desk, Cashier |
| **Mode 2 — Scheduling** | “Who was **booked**, who **arrived** at the appointment desk, who is **due back**?” | Calendar + `patient_tracker` | **S1 Scheduling & Flow** (Calendar, Flow Board, Recalls) |

PRD **D18 / H3** closes bidirectional sync: walk-ins have no appointment key; the appointment tracker is keyed on `pc_eid`. The **only** automated bridge is **Start visit & check in** (M0-F16) — one atomic action that creates the clinical visit **and** (when allowed) marks the appointment **Arrived**.

That design is **correct** for West African OPD (high walk-in mix, unreliable phone bookings, no need to fork OpenEMR). What is **missing** today:

- Staff **training** on why two boards exist
- **Visible exceptions** when the boards diverge (human process error, recurring appointments, plain Start visit used by mistake)
- **Guided fix** paths — not silent sync
- Manager **EOD sweep** beyond thin M7-F16 funnel counts

This spec defines **Queue Bridge Operations** — a **reconciliation façade** (same pattern as M16 over Reports, M17 over forms) — without violating H3.

### 1.2 Problem statement

> Ama books twelve patients on the Calendar. On the Flow Board, eight show **Arrived** because the locum used inline check-in without starting a visit. On the Visit Board, only six patients are in Triage or Doctor columns — the other two walked out after paying for labs only. Dr. Mensah asks “why is Kwame on the flow board but not on my list?” The manager opens Daily Reports → Scheduling tab and sees “8 arrived, 6 with appointment link” but **no list of who to fix**. Reception was never trained that **Start visit & check in** is the only button that connects both worlds.

### 1.3 Positioning vs other surfaces

| Surface | Question | Relationship to boundary |
|---------|----------|------------------------|
| **S1 Scheduling & Flow** | Book, arrive, recall | **Writes** appointment status; does **not** own clinical queue |
| **Visit Board (M2)** | Floor truth for care | **Writes** `new_visit` FSM; optional `pc_eid` link |
| **Front Desk (M1)** | Register + start visit | **Primary bridge** via Start visit & check in |
| **M7 Scheduling tab (M7-F16)** | Manager funnel KPIs | **Counts only** today — M18 adds **exception list** |
| **M16 Reporting Hub** | Monthly extracts | Orthogonal appointment reports — not live reconciliation |

**Training one-liner:** *Schedule for planning; Visit Board for treating; one button connects them — the exception list catches mistakes.*

**Design decision (closed — D-BRIDGE-1):** **H3 stands** — no bidirectional sync engine. M18 = **detect + guide + audit** one-way fixes staff confirm.

---

## 2. Gap analysis — what S1 and PRD already cover

| Capability | S1 / PRD (V1) | M18 gap |
|------------|---------------|---------|
| Unified Calendar + Flow + Recalls shell | S1-F01–F08 | — |
| Atomic **Start visit & check in** | M0-F16, §6.7.5 | No **mistake detector** when staff use plain Start visit |
| `pc_eid` + `appt_date` link columns | `new_visit` DDL | No UI surfacing **unlinked** scheduled arrivals |
| Recurring guard (no auto arrived) | §6.7.9 copy | No **worklist row** for recurring mismatch |
| Walk-in vs scheduled % | M7-F16 | No **named patient list** for exceptions |
| Flow Board kanban | S1-F03 | No chip “**No clinical visit**” on card |
| Visit Board badges | M2 | No badge “**Appointment not linked**” |
| Orthogonal KPI rule | §6.7.8 #2 | Managers still **add counts** in spreadsheets |
| Divergence accepted | §6.7.5 “not reconciled” | No **operational** reconciliation playbooks |

**Conclusion:** S1 fixes **scheduling UX**. M0-F16 fixes **happy path**. M18 fixes **exception path + manager hygiene**.

---

## 3. Current-state snapshot (stock OpenEMR)

### 3.1 Two silos in core

| Silo | Tables | UI | Tied to |
|------|--------|-----|---------|
| **Appointments** | `openemr_postcalendar_events` | Calendar, add/edit event | Future planning, `pc_apptstatus` |
| **Appointment flow** | `patient_tracker`, `patient_tracker_element` | Patient Flow Board | Check-in/out timeline per `pc_eid` |
| **Clinical encounter** | `form_encounter`, forms | Encounter screens | Billing, notes, orders |

New Clinic adds **`new_visit`** as a **fourth operational layer** — visit state machine for the private clinic floor. It is **not** in stock OpenEMR.

### 3.2 Stock Flow Board behavior (pain summary)

- HTML **table**, not a pipeline; status = background color + optional **blink**
- Check-in opens **popup**; may call legacy paths that **bypass** tracker
- **Recurring** appointments excluded from tracker linkage
- Appointments **without** tracker row open heavy calendar editor
- **No** concept of “clinical visit started” — only appointment status
- Full fragment **reload** every ~20s — no delta, no cross-link to a queue

### 3.3 Stock vs New Clinic after S1

| Aspect | Stock | New Clinic target |
|--------|-------|-------------------|
| Arrival → encounter | `calendar_arrived()` may auto-create encounter | **Forbidden** (H2/H4) — module creates encounter at Start visit |
| Floor queue | Flow Board only | **Visit Board** (`new_visit`) |
| Sync | Implicit, buggy | **Explicit one-way** at bridge only (D18) |

---

## 4. Pain points by surface

### 4.1 Reception / Front Desk

| Pain | Ghana/West Africa impact |
|------|--------------------------|
| Two buttons: **Start visit** vs **Start visit & check in** | Busy Saturday — wrong button; appointment stays “Booked” |
| **Appointment today** chip visible but ignored | Patient says “I have appointment” — reception starts walk-in path |
| Recurring series confusion | Toast easy to miss; calendar never shows Arrived |
| Multiple appointments same day | Wrong occurrence linked — doctor expects different time |
| Plain language | Staff say “check in” for both systems |

### 4.2 Flow Board (S1 lens)

| Pain | Impact |
|------|--------|
| **Arrived** without `new_visit` | Patient “on schedule” but invisible to nurse/doctor queue |
| Inline check-in without bridge | Tracker updated; clinical queue untouched |
| **No-show** (`?`) but patient walks in later | Allowed — but staff think systems “out of sync” |
| Color-only status | Outdoor-lit waiting area — hard to read |

### 4.3 Visit Board (M2)

| Pain | Impact |
|------|--------|
| Walk-in with **no** `pc_eid` | Normal — but manager thinks “missing from schedule” |
| Visit with `pc_eid` but appointment still **Booked** | Plain Start visit used — reporting skew |
| No cross-link | Cannot jump to Flow Board card from queue row |

### 4.4 Clinical roles

| Pain | Impact |
|------|--------|
| Doctor sees patient “not on my list” | Patient only on Flow Board — locum checked them in |
| Triage expects vitals | Patient never started clinically |

### 4.5 Management & reporting

| Pain | Impact |
|------|--------|
| M7-F16 shows **percentages** only | Cannot action “3 arrived without visit” |
| Stock **Appointments report** vs **Visits report** | Double-count anxiety |
| EOD | Stuck **Arrived** on schedule, no one in building |
| District asks “how many attended?” | Unclear which number is official |

### 4.6 Process & training

| Pain | Impact |
|------|--------|
| Locum / weekend staff | Never trained on bridge |
| Walk-in-only clinic toggles integration OFF | Still ships S1 in CI — confusion in docs |
| Paper appointment book + digital | Duplicate entries |

---

## 5. UI/UX principles for dual-system clinics

| Principle | Application |
|-----------|-------------|
| **One floor truth** | Visit Board + role desks = **where to treat**; never argue with Flow Board for clinical actions |
| **One planning truth** | Calendar + Flow Board = **who was expected**; recalls, no-shows, utilization |
| **One bridge button** | **Start visit & check in** when appointment chip shows — never two steps |
| **Exceptions are first-class** | Named rows, not hidden KPI deltas |
| **Guide, don’t sync** | Each fix is a **staff-confirmed** one-way action with audit |
| **Plain language** | “On schedule, not in clinic queue” — not `pc_eid` null |
| **Never add KPIs** | Scheduling tab and Visits tab stay **orthogonal** (§6.7.8 #2) |
| **Ghana Saturday mode** | Exception list sorted by **wait time** and **queue #** when visit exists |
| **Recurring = expected gap** | Separate exception type — informational, not error red |
| **Mobile reception** | Exception cards tappable; primary action ≥44px |

---

## 6. How leading EHRs address these needs

| Pattern | Epic / Cerner | athena | Bahmni / OpenMRS | Helium Health / African SaaS | **New Clinic M18 proposal** |
|---------|---------------|--------|------------------|------------------------------|----------------------------|
| **Single arrival action** | Check-in creates encounter | One check-in | Bahmni visit at registration | Often one “start visit” | **M0-F16** atomic (V1) |
| **Dual board acceptance** | Appointment board ≠ ED track | Front desk vs provider schedule | OpenMRS appointment vs visit | Varies | **Explicit D18** + training |
| **Exception worklist** | “Unlinked arrivals” reports | Front desk dashboard | Registration discrepancies | Manager daily close | **M18 worklist** |
| **No silent sync** | Manual link appointment | Advisory banners | Manual | — | **Confirm modal** per fix |
| **Walk-in heavy markets** | — | — | High in LMIC | Phone booking weak | **Walk-in % normal** in copy |
| **Recurring series** | Series exception rules | — | — | — | **Chip-only** + **SQ-01** training |
| **EOD reconciliation** | End-of-day appointment close | — | — | Cash + attendance | **M18 + M7** sweep |

**Takeaway:** Top systems either **merge** arrival and encounter (single product) or provide a **daily exception queue** for front-desk managers. New Clinic chooses **merge at button** + **exception queue** — not background sync.

---

## 7. West Africa & Ghana context

### 7.1 Practice realities

| Reality | Design response |
|---------|-----------------|
| **High walk-in %** (50–80% in private OPD) | Walk-in without appointment link = **normal**, not exception |
| **Phone/WhatsApp bookings** informal | “Booked” ≠ patient will arrive on time |
| **Same patient, multiple queues** | Lab-only visit — may be Arrived on schedule but ancillary profile |
| **Locum doctors / agency nurses** | Exception list + **SQ-07** locum training card in hub |
| **Power cuts / slow network** | Exception detectors run **server-side** on EOD + on-demand refresh |
| **English UI** V1 | All labels via `xl()`; Twi prompts defer V2 |
| **Manager is often owner** | EOD sweep in **Daily Reports**, not separate IT tool |
| **NHIS / insurance not V1** | No eligibility-driven arrival — cash OPD |

### 7.2 Regulatory & reporting context

| Topic | V1 stance |
|-------|-----------|
| **Attendance for MOH returns** | Operational truth = **`new_visit` completed**; scheduled = planning metric (M16 public health lens) |
| **Patient privacy** | Exception list = same ACL as Visit Board — no public wall display |
| **Audit** | Every guided fix logs actor + before/after |

### 7.3 Clinic profiles

| Profile | Boundary behavior |
|---------|-------------------|
| **Full schedule + walk-in** (pilot default) | M18 ON when `enable_scheduled_integration` = 1 |
| **Walk-in only** | Integration OFF — **M18 hidden**; golden path only |
| **Eye clinic appointments** | Higher scheduled % — exception list more valuable |

---

## 8. Information architecture — Queue Bridge Hub

### 8.1 Three-layer model (D-BRIDGE-1)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Queue Bridge Hub (M18) — exception detection & guided fixes                   │
│  ┌──────────────────┬──────────────────┬──────────────────────────────────┐ │
│  │ Today's          │ Arrival advisor  │ EOD boundary sweep               │ │
│  │ exceptions       │ (Front Desk      │ (manager close)                  │ │
│  │ (worklist)       │  embed)          │                                  │ │
│  └──────────────────┴──────────────────┴──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
         ▲                    ▲                         ▲
         │                    │                         │
   S1 Flow Board          M1 Start visit          M7 Daily Reports
   Visit Board            panel                    Scheduling tab
```

| Module | Route | ACL |
|--------|-------|-----|
| **M18 Hub shell** | `…/public/queue-bridge/index.php` | `new_queue_bridge` |
| **Today's exceptions** | default tab | `new_queue_bridge` |
| **EOD sweep** | same shell — manager lens | `new_queue_bridge` + `reports` |

**Entry:** Manager → **Daily Reports → Scheduling → View exceptions**; Reception → Front Desk **Arrival advisor** strip when chip visible; S1 Flow Board card **Fix** link.

### 8.2 Hub shell wireframe

```text
┌─ T1 TopBar ───────────────────────────────────────────────────────────────────┐
├─ Queue Bridge — Today 11 Jun 2026                    [ Refresh ] [ Export ] │
│  ⚠ 3 need attention · 2 informational (recurring)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ [ Exceptions (3) ] [ Recurring info (2) ] [ Resolved today (5) ]              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Kwame Owusu · Appt 09:00 · Arrived on schedule · No clinical visit (EX-01) │
│  [ Start visit & check in ]  [ Open Flow Board ]  [ Open Scheduling & Flow ] │
├─────────────────────────────────────────────────────────────────────────────┤
│  Akua Mensah · Queue #14 · Visit active · Appointment still Booked            │
│  [ Mark appointment arrived ]  [ Open Visit Board ]  [ Dismiss — walk-in OK ]│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 M18 functional requirements (summary)

| ID | Requirement | Phase |
|----|-------------|-------|
| M18-F01 | **Hub shell** + today's exception worklist | P1 (V1.1-BRIDGE) |
| M18-F02 | **Detector EX-01** — `@` on schedule / tracker **and** no non-terminal `new_visit` today with matching `pc_eid`/`appt_date` | P1 |
| M18-F03 | **Detector EX-02** — `new_visit` with `pc_eid`+`appt_date` AND appt status ∉ arrived set (non-recurring) | P1 |
| M18-F04 | **Detector EX-03** — active `new_visit` today, `pc_eid` NULL, Booked appt same pid (nearest time) | P1 |
| M18-F05 | **Detector EX-04** — recurring informational gap (visit linked; appt not `@`) | P1 |
| M18-F06 | **Guided fix: Start visit & check in** — calls M0-F16 from exception row | P1 |
| M18-F07 | **Guided fix: Mark arrived only** — `updateAppointmentStatus` when visit exists | P1 |
| M18-F08 | **Flow Board card chip** — “No clinical visit” when **EX-01** (S1-F10) | P1 |
| M18-F09 | **Visit Board badge** — “Appt not linked” / recurring info when **EX-03** / **EX-04** (M2-F14) | P1 |
| M18-F10 | **EOD sweep** — extend M7 **Scheduling tab footer** with exception export + resolve summary | P1 |
| M18-F11a | **Front Desk arrival advisor** — strip when appointment chip visible | P1 |
| M18-F11b | **Front Desk EX-01 guard** — block plain Start visit when EX-01; link to hub | P1 |
| M18-F12 | **Audit** — `queue_bridge.resolve` / `queue_bridge.dismiss` events | P1 |
| M18-F13 | **Link nearest Booked appt** — Visit Board / hub guided action (M0-F16 or mark arrived) | P1 |
| M18-F14 | **Detectors EX-05 / EX-06** — cancelled appt + active visit; wrong `pc_eid` link | P2 (**V1.2-BRIDGE-EXT** — not in BRIDGE-1–7) |
| M18-F15 | **Detector EX-07** — active ancillary (lab/pharmacy-service) `new_visit` today AND a same-day OPD/consult appointment exists for the pid (visit-profile vs appt-category mismatch); informational, dismiss-eligible per **D-BRIDGE-9** | P1 |

---

## 9. Exception taxonomy & detectors

### 9.1 Severity classes

| Class | Color | Meaning |
|-------|-------|---------|
| **Action required** | Red | Patient may be waiting; clinical queue wrong |
| **Informational** | Amber | Recurring gap, walk-in OK dismiss |
| **Resolved** | Green | Fixed today — audit trail |

### 9.2 Detector rules (server-side)

| Code | Condition (simplified) | Default severity |
|------|------------------------|----------------|
| **EX-01** | Today appt status `@` (or tracker check-in) AND no non-terminal `new_visit` today with matching `pc_eid`/`appt_date` | Action |
| **EX-02** | `new_visit` with `pc_eid`+`appt_date` AND appt status ∉ arrived set AND not recurring | Action |
| **EX-03** | Active `new_visit` today, `pc_eid` NULL, appt exists Booked same pid (nearest time) | Action |
| **EX-04** | `new_visit` linked, recurring, appt not `@` | Informational |
| **EX-05** | Appt cancelled but `new_visit` still active | Action — **detector P2** (M18-F14; V1.2-BRIDGE-EXT) |
| **EX-06** | Multiple appts today — linked `pc_eid` not nearest to `started_at` | Informational — **detector P2** (M18-F14) |
| **EX-07** | Active `new_visit` today with **ancillary** visit profile (lab/pharmacy service) AND same-day appointment exists with **OPD/consult** category for the pid (profile vs chip mismatch) | Informational (lab/pharm walk-in) — **detector M18-F15** |

**Walk-in with no appointment** is **not** an exception (EX-normal).

### 9.3 Query cadence

| Trigger | When |
|---------|------|
| On-demand | Hub open, Refresh click |
| Front Desk | After patient search when appointment chip visible |
| Scheduled | EOD job optional — populate M7 sweep cache |
| Polling | Hub visible: 60s (pause when hidden) |

---

## 10. Lens: Today's exceptions (worklist)

| Column | Content |
|--------|---------|
| Patient | Name, MRN, age |
| Exception | Plain English type (EX-01…) |
| Schedule side | Appt time, status pill, provider |
| Queue side | Queue #, visit state, or “—” |
| Since | Time in exception state |
| Actions | Contextual buttons per Appendix A |

**Rules:**
- Max **50 rows** today — paginate
- **No auto-fix** — every action = confirm modal + audit
- **Dismiss** with reason for **EX-03**, **EX-04**, **EX-07** per role ACL (**D-BRIDGE-9**): reception_lead → EX-03, EX-07; admin → EX-03, EX-04, EX-05, EX-07
- **No no-show action** on hub rows — staff mark `?` no-show in core **Scheduling & Flow** only (**D-BRIDGE-8**, PRD §6.7.7)

---

## 11. Lens: Arrival advisor (Front Desk embed)

When **Appointment today** chip is visible on Start visit panel:

```text
┌─ Arrival advisor ─────────────────────────────────────────────────────────────┐
│ This patient has a 09:00 appointment. Use **Start visit & check in** to       │
│ add them to today's clinic queue and mark arrived.                            │
│ [ Start visit & check in ]     Plain Start visit only if lab/pharm walk-in   │
└─────────────────────────────────────────────────────────────────────────────┘
```

If EX-01 already exists for pid → **blocking banner** on plain Start visit: “Patient already marked arrived on schedule — use **Start visit & check in** or open Queue Bridge.”

---

## 12. Lens: End-of-day boundary sweep

Extends **M7 Scheduling tab** (M7-F16) — does **not** merge KPIs with Visits tab.

| Section | Content |
|---------|---------|
| Summary | Count exceptions by type; resolved vs open |
| Open list | Link to M18 hub filtered |
| Export | CSV for manager log |
| Playbook | **SQ-04** checklist inline |

**Manager question answered:** “Can I go home?” → zero **Action required** rows OR each documented with dismiss reason.

---

## 13. Cross-surface integration

| Surface | Integration |
|---------|-------------|
| **S1 Flow Board** | Card chip + **Fix** deep-link to M18 row |
| **Visit Board** | Badge + **Link appointment** guided action (M18-F13) |
| **Front Desk** | Arrival advisor §11 |
| **M7 Daily Reports** | Scheduling tab footer → **View exceptions** |
| **M16 Public health** | OPD attendance uses **`new_visit`**; scheduling funnel separate |
| **USER_WORKFLOWS** | §12.3 arrival rules; §14.11 boundary workflows |

**H3 compliance:** M18 **never** writes `new_visit` from tracker alone; **never** clears visits from calendar status. Fixes use **M0-F16** or **updateAppointmentStatus** only.

---

## 14. Navigation, ACL & config

### 14.1 Config (M6)

| Key | Default | Notes |
|-----|---------|-------|
| `enable_queue_bridge` | `0` | Master gate — V1.1-BRIDGE |
| `queue_bridge_show_recurring_info` | `1` | Show EX-04 tab |
| `queue_bridge_eod_block` | `0` | When `1`, **M7-F16 Scheduling tab footer** warns if open EX-01 action rows remain (not M7-F15) |

Requires `enable_scheduled_integration` = 1.

### 14.2 ACL

| Permission | Roles | Purpose |
|------------|-------|---------|
| **View queue bridge** | `new_reception_lead`, `new_admin` | Open hub |
| **Resolve queue bridge** | `new_reception_lead`, `new_admin` | Guided fixes |
| **Dismiss exception** | `new_reception_lead` (EX-03, EX-07), `new_admin` (EX-03–05, EX-07) | Dismiss with reason — server enforces code scope (**D-BRIDGE-9**) |

### 14.3 Menu

When `enable_queue_bridge` = 1:

| Entry | Location |
|-------|----------|
| **Queue Bridge** | Clinic → Scheduling → Exceptions (or sub-link under Scheduling & Flow) |
| Not on wall display | D22 — Visit Board wall only |

---

## 15. Data model, APIs & queries

### 15.1 No new sync table required (V1)

Detectors use **read-only joins** across existing tables. Optional cache:

```sql
queue_bridge_exception_snapshot (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  facility_id INT NOT NULL,
  snapshot_date DATE NOT NULL,
  exception_code VARCHAR(16) NOT NULL,
  pid BIGINT NOT NULL,
  pc_eid INT NULL,
  visit_id BIGINT NULL,
  severity ENUM('action','info','resolved') NOT NULL,
  detected_at DATETIME NOT NULL,
  resolved_at DATETIME NULL,
  resolved_by BIGINT NULL,
  resolve_action VARCHAR(64) NULL,
  dismiss_reason TEXT NULL
)
```

### 15.2 AJAX actions (sketch)

| Action | Purpose |
|--------|---------|
| `queue_bridge.list` | Today's exceptions |
| `queue_bridge.resolve` | Execute guided fix |
| `queue_bridge.dismiss` | Dismiss with reason |
| `queue_bridge.eod_summary` | M7 embed |

---

## 16. Phasing & PRD alignment

| Phase | Deliverable | PRD |
|-------|-------------|-----|
| **V1 P0** | M0-F16 bridge + S1 + M7-F16 counts | §6.7 — **no M18** |
| **V1.1-BRIDGE** | M18 hub + detectors EX-01–04 + **EX-07** (informational) + M7 exception list | M18-F01–F13, **F15** |
| **V1.1-OPS** | Optional `queue_bridge_eod_block` strict mode on M7-F16 footer | Config |
| **V1.2-BRIDGE-EXT** | EX-05/06 detectors + cancel/unlink flows | M18-F14 P2 |

**Depends on:** S1-P2 Flow Board + M0-F16 stable ≥2 weeks. **Independent** of M17/M16.

**NG / hard rules:** H1–H4 unchanged; H3 **reaffirmed** (D-BRIDGE-2).

---

## 17. Acceptance criteria

### 17.1 V1 pilot (no bridge)

- [ ] Start visit & check in creates visit + `@` when guard passes (tests 17–18).
- [ ] M7 Scheduling tab hidden when integration OFF.

### 17.2 M18 hub

- [ ] Hub OFF → no exception UI; legacy behavior (BRIDGE-7).
- [ ] EX-01 detected when Flow Board arrived without visit (BRIDGE-1).
- [ ] Guided fix calls M0-F16 — one visit, one encounter (BRIDGE-2).
- [ ] Walk-in without appt **not** listed (BRIDGE-3).
- [ ] Recurring EX-04 on informational tab (BRIDGE-4).
- [ ] Ancillary visit + same-day OPD appt → EX-07 on informational tab; dismiss-eligible per D-BRIDGE-9 (M18-F15).
- [ ] KPI orthogonality — scheduling counts ≠ visit counts (BRIDGE-5).
- [ ] Every resolve writes audit (BRIDGE-6).

### 17.3 Tests (PRD §16.1 — `@new-clinic-v11-bridge`)

| ID | Test |
|----|------|
| BRIDGE-1 | EX-01 appears for arrived-without-visit fixture |
| BRIDGE-2 | Resolve → M0-F16 → visit exists + appt `@` |
| BRIDGE-3 | Walk-in only → empty exception list |
| BRIDGE-4 | Recurring → informational not action |
| BRIDGE-5 | M7 scheduling + visits totals not summed in UI |
| BRIDGE-6 | `queue_bridge.resolve` audit row |
| BRIDGE-7 | Hub OFF regression |

---

## 18. Closed decisions

| ID | Decision |
|----|----------|
| D-BRIDGE-1 | **No bidirectional sync** — M18 = detect + guide + audit; **H3 stands** |
| D-BRIDGE-2 | **Floor truth = Visit Board** for clinical actions; Flow Board = planning/arrival |
| D-BRIDGE-3 | **One bridge button** — Start visit & check in; advisor blocks plain Start when EX-01 |
| D-BRIDGE-4 | **Orthogonal KPIs** — M7-F16 + M18 list; never sum appointment + visit counts |
| D-BRIDGE-5 | **Walk-in without link = normal** — not an exception |
| D-BRIDGE-6 | **Recurring gap = informational** — staff copy from §6.7.9 |
| D-BRIDGE-7 | **Ghana manager default (closed):** exception list in Daily Reports — not a separate IT product (**D-BRIDGE-10** clarifies entry hierarchy) |
| D-BRIDGE-8 | **No M18 no-show writes (closed):** module never sets `?` — core Scheduling & Flow only (§6.7.7) |
| D-BRIDGE-9 | **Dismiss ACL split (closed):** reception_lead EX-03/EX-07; admin EX-03–05/EX-07 |
| D-BRIDGE-10 | **Hub entry hierarchy (closed):** Daily Reports → Scheduling tab primary; Clinic → Scheduling & Flow → Exceptions secondary |

---

## 19. Document history

| Version | Date | Changes |
|---------|------|---------|
| 0.1.3 | 2026-06-24 | **Consistency audit fix (G-BRIDGE-11)** — added **M18-F15** detector for EX-07 (was dismiss-eligible per D-BRIDGE-9 but had no detector requirement); §9.2 EX-07 rule made precise; V1.1-BRIDGE phasing + §17.2 acceptance updated |
| 0.1.2 | 2026-06-22 | **Audit closure** — remove Mark no-show (D-BRIDGE-8); dismiss ACL split (D-BRIDGE-9); EX-01 refined; M18-F11a/b + F13/F14; DR→SQ; Appendix E; PRD v1.20.39 |
| 0.1.1 | 2026-06-22 | **Trilogy integration** — PRD v1.20.36 / PAGE_DESIGNS §7.31 / USER_WORKFLOWS §14.11; §20 SQ runbooks |
| 0.1.0 | 2026-06-22 | Initial draft — dual-system pain points, M18 Queue Bridge Hub, exception taxonomy, Ghana context, competitive patterns |

---

## Appendix A — Exception catalog & resolve actions

| Code | Plain English | Primary action | Secondary |
|------|---------------|--------------|-----------|
| EX-01 | On schedule as arrived, not in clinic queue | Start visit & check in | Open Flow Board / Scheduling & Flow (no-show in core only) |
| EX-02 | In clinic queue, appointment not marked arrived | Mark appointment arrived | Open visit |
| EX-03 | Walk-in visit but booking still open | Link & check in OR dismiss | — |
| EX-04 | Recurring — visit OK, calendar not ticked | Dismiss (info) | Manual Flow Board update |
| EX-05 | Appointment cancelled, visit still open | Cancel visit OR unlink (P2) | Manager — **M18-F14 deferred** |
| EX-06 | Wrong appointment linked | Re-link nearest appt (P2) | — — **M18-F14 deferred** |
| EX-07 | Ancillary visit, OPD booking exists | Dismiss | — |

---

## Appendix B — Ghana clinic day scenarios

| Scenario | Expected system behavior |
|----------|-------------------------|
| Saturday walk-in crush | Mostly EX-normal; advisor on chip only |
| WhatsApp booking, patient late | Booked → EX-01 if locum checked in without visit |
| Recurring ANC series | EX-04 info; training toast |
| Lab-direct after external consult | Plain Start visit; EX-07 dismiss |
| Patient leaves after paying lab | Visit completes; Flow Board may still Arrived — EX-02 EOD |
| Power cut mid-check-in | Refresh exception list; no duplicate visits (M0-F05) |

---

## Appendix C — User stories

| ID | As a… | I want to… | So that… |
|----|-------|------------|----------|
| US-BRG-1 | Reception lead | see patients on schedule but not in queue | nobody waits unseen |
| US-BRG-2 | Manager | EOD list of schedule vs queue mismatches | I close the day confidently |
| US-BRG-3 | Trainer | plain-language exception types | locum staff fix mistakes |
| US-BRG-4 | Owner | walk-ins not flagged as errors | reports reflect our OPD reality |
| US-BRG-5 | Doctor | trust Visit Board over Flow Board | I take the right patients |

---

## Appendix D — Competitive reference matrix

| Capability | Epic | athena | Bahmni | Helium Health | New Clinic |
|------------|------|--------|--------|---------------|------------|
| Single check-in creates visit | ✓ | ✓ | ✓ | partial | **M0-F16** |
| Dual board explicit | partial | partial | ✓ | — | **D18 + training** |
| Exception worklist | Reports | Dashboard | — | Manager tools | **M18** |
| Walk-in heavy market | — | — | ✓ India | ✓ Africa | **EX-normal** |
| No background sync | — | — | Manual | — | **H3 + guide** |
| EOD reconciliation | End of day | — | — | Cash close | **M18 + M7** |

---

## 20. Day-2 queue bridge runbook (SQ-01–SQ-08)

**Normative in PRD:** [§17.4.11](./NEW_CLINIC_V1_PRD.md#17411-day-2-queue-bridge-runbook-m18). Trainer workflows: [USER_WORKFLOWS §14.11](../NEW_CLINIC_V1_USER_WORKFLOWS.md#1411-queue-bridge--scheduling-boundary-workflows). Wireframes: [PAGE_DESIGNS §7.31](../NEW_CLINIC_V1_PAGE_DESIGNS.md#731-queue-bridgeindexphp--queue-bridge-hub).

| ID | When | Task | Verify |
|----|------|------|--------|
| **SQ-01** | Go-live | Train: two boards + one bridge button | USER_WORKFLOWS §14.11.1 |
| **SQ-02** | Go-live | Drill **Start visit & check in** on staging | M0-F16 tests 17–18 |
| **SQ-03** | Daily | Clear EX-01 before lunch | Hub action tab |
| **SQ-04** | EOD | Boundary sweep — zero open EX-01 or documented | M7 Scheduling tab |
| **SQ-05** | EOD | Export CSV to manager log | `queue_bridge.eod_summary` |
| **SQ-06** | Post-pilot | BRIDGE-1–7 green → enable hub | `enable_queue_bridge` = 1 |
| **SQ-07** | Locum weekends | Wrong-button playbook card at desk | EX-01 rate drops |
| **SQ-08** | Optional strict | Enable `queue_bridge_eod_block` | Manager cannot ignore EX-01 |

---

## 21. Trilogy integration audit

| ID | Requirement | Status |
|----|-------------|--------|
| R-BRIDGE-01 | PRD M18 module + ACL + config + DDL | **Closed** — PRD v1.20.39 |
| R-BRIDGE-02 | PAGE_DESIGNS §7.31 hub wireframes | **Closed** — PAGE_DESIGNS v0.6.43 |
| R-BRIDGE-03 | USER_WORKFLOWS §14.11 + §12.3 Flow Board rule | **Closed** — USER_WORKFLOWS v1.9.43 |
| R-BRIDGE-04 | M7-F16 exception footer (orthogonal KPIs) | **Closed** — D-BRIDGE-4 |
| R-BRIDGE-05 | S1 §9.5 + Mode 2 check-in wording | **Closed** — SCHEDULING v0.2.5 |
| R-BRIDGE-06 | BRIDGE-1–7 tests + `@new-clinic-v11-bridge` | **Closed** — PRD §16.1 + §16.1.1 |
| R-BRIDGE-07 | §21.1y acceptance checklist | **Closed** — PRD v1.20.39 |
| R-BRIDGE-08 | D-BRIDGE-1–10 in PRD §24.1 | **Closed** — PRD v1.20.39 |

**Trilogy integration complete (v0.1.2):** PRD v1.20.39 · PAGE_DESIGNS §7.31 · USER_WORKFLOWS §14.11 · slice **V1.1-BRIDGE** · R-BRIDGE-01–08 closed after Appendix E audit pass.

---

## Appendix E — Audit resolution log (v0.1.2)

| ID | Issue | Resolution |
|----|-------|------------|
| **X-BRIDGE-1** | Mark no-show on EX-01 row vs §6.7.7 | Removed from hub wireframes; **Open Scheduling & Flow** secondary; **D-BRIDGE-8** |
| **X-BRIDGE-2** | Dismiss ACL — reception vs admin | **D-BRIDGE-9** — reception_lead EX-03/EX-07; admin EX-03–05/EX-07 |
| **X-BRIDGE-3** | “Informational only” inline check-in | Mode 2 writes schedule/tracker only — does not create `new_visit`; USER_WORKFLOWS §12.3 |
| **C-BRIDGE-01** | F02/F04 typo in §8.3 | Fixed to EX-01 / EX-03–04 |
| **C-BRIDGE-02** | DR-BRIDGE vs SQ runbook IDs | Standardized on **SQ-01–SQ-08** |
| **C-BRIDGE-03** | Wrong §8.1a cross-ref | §13 → §12.3 + §14.11 |
| **C-BRIDGE-04** | Dismiss rules §10 vs Appendix A | EX-03, EX-04, EX-07 dismiss-eligible per D-BRIDGE-9 |
| **C-BRIDGE-05** | Premature audit closure | Reopened; closed in v0.1.2 after fixes |
| **C-BRIDGE-06** | D-BRIDGE-7 vs §19.7 dual menu | **D-BRIDGE-10** — M7 primary, S1 secondary |
| **G-BRIDGE-01** | EX-05/06 undetected | **M18-F14** deferred **V1.2-BRIDGE-EXT** |
| **G-BRIDGE-02** | Link appointment no F-ID | **M18-F13** added |
| **G-BRIDGE-03** | EX-01 same-day second visit false positive | Refined detector — matching `pc_eid`/`appt_date` |
| **G-BRIDGE-04** | M18-F11 phase split | **M18-F11a** advisor + **M18-F11b** EX-01 guard (both P1) |
| **G-BRIDGE-05** | `queue_bridge_eod_block` target | Tied to **M7-F16 footer** only |
| **G-BRIDGE-06** | §17.4.1 no post-pilot SQ pointer | PRD §17.4.1 post-pilot note → §17.4.11 |
| **G-BRIDGE-07** | Worksheet missing `enable_queue_bridge` | PRD §24.4 row 12 |
| **G-BRIDGE-09** | §12.3 missing Flow Board → EX-01 | USER_WORKFLOWS §12.3 rule added |
| **G-BRIDGE-10** | BRIDGE tests in §16.1.1 traceability | Confirmed in post-V1 table |
| **G-BRIDGE-11** | EX-07 dismiss-eligible (D-BRIDGE-9) but had **no detector** functional requirement | **M18-F15** added (P1, V1.1-BRIDGE); §9.2 rule made precise; phasing row updated |

---

*End of Scheduling ↔ Visit Queue Boundary Redesign Specification*

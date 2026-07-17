# New Clinic — Screening Questionnaires redesign (PHQ-9 / GAD-7 native)

| | |
|---|---|
| **Document version** | 0.3.0 |
| **Status** | Built (SCRN-1/2/3) — native default, no flag; encounter-summary parity + server-route done |
| **Owner** | New Clinic engineering |
| **Flag** | **None — native default** (product decision 2026-07-17; the stock "Questionnaires" card is removed from the Screening lens) |
| **Surfaces** | M17 Clinical Documentation hub — Screening lens; patient chart (read) |
| **Replaces (partially)** | Stock `questionnaire_assessments` (LForms / FHIR) form for the two screeners the clinic actually uses |

---

## 1. Problem / why now

The Clinical Documentation hub has a **Screening** tab. It is meant to hold quick
screening tools a nurse or clinician runs during a visit — depression (PHQ-9),
anxiety (GAD-7), and similar short scored questionnaires.

Today that tab is effectively empty and unusable:

- The only working card is **"Questionnaires"**, which opens OpenEMR's stock
  questionnaire engine. That engine is a **generic FHIR / LForms builder** — it renders
  any FHIR questionnaire and stores a FHIR QuestionnaireResponse. It is powerful but
  heavy, and it is built for a library of pre-loaded questionnaires.
- In this clinic's database that **library is empty** — zero questionnaires, zero saved
  responses. So a nurse clicking "Questionnaires" lands on a builder with nothing to
  pick. There is no fast way to record a PHQ-9 or GAD-7.
- The screening tab **also lists "PHQ-9" and "GAD-7" cards**, but there is no form behind
  them (no database table, not registered), so they are silently hidden. Dead scaffolding.

What clinicians want here is simple and specific: **pick the screener, answer the
questions, get an instant score and severity, save it to the visit.** The generic FHIR
builder does not give them that, and it is the wrong tool to force on a fast screening
station.

**Why now:** we are replacing the remaining stock encounter forms with native ones
(Clinical Instructions shipped; Vitals next). Screening is the other card on the same hub
that is stock-and-broken. This closes it.

---

## 2. Scope

### In scope (this spec)

- Native **PHQ-9** (depression, 9 items) and **GAD-7** (anxiety, 7 items) screeners as
  fast React forms opened from the Screening lens.
- **Automatic scoring**: total score, severity band, and plain-English interpretation
  computed as the user answers — no manual math.
- **Safety handling** for PHQ-9 item 9 (self-harm thoughts): a clear alert when the answer
  is above zero.
- Save to the encounter so the score is visible on the visit and in the patient chart.
- One admin flag, default OFF. Stock FHIR engine stays reachable for anything else.
- An **extensible instrument definition** so PHQ-2, EPDS (postnatal), AUDIT-C (alcohol),
  etc. can be added later as data, not new code.

### Explicit non-scope

- **We do NOT rebuild the FHIR / LForms engine.** FHIR/SMART is a deliberate PRD non-goal
  (CLAUDE.md §0, gap-analysis Tier 3). The stock `questionnaire_assessments` form stays
  exactly as-is for custom / imported questionnaires — we neither extend nor remove it.
- No patient-portal self-administration in V1 (the stock form already does portal; ours is
  staff-facing at the desk).
- No FHIR QuestionnaireResponse export of native screeners in V1 (open question §9).
- No new screeners beyond PHQ-9 / GAD-7 built in V1 — only the extension point.
- No population/registry cohort reporting on scores in V1 (data is stored so it can come
  later — see §9).

---

## 3. User workflows affected

**Role / desk:** M17 Clinical Documentation hub, Screening lens. Primary users are the
nurse at the screening/triage station and the doctor during the consult. Access follows
the existing screening ACLs (`SCREENING_ACLS`) and the screening-lens toggle
(`clinical_doc_show_screening`) — this spec adds no new access surface, it fills an
existing one.

**Flow (flag ON):**

1. Open a visit's documentation → **Screening** tab.
2. See **PHQ-9** and **GAD-7** cards (plus the existing **Questionnaires** card for
   anything custom).
3. Click PHQ-9 → a drawer opens with the 9 questions, each a row of four options
   (Not at all / Several days / More than half the days / Nearly every day = 0–3).
4. As answers are picked, a live **score + severity** shows at the bottom (e.g.
   "12 / 27 — Moderate"). If item 9 (self-harm) is above zero, a **safety alert** appears.
5. Save → the drawer closes, the card shows the latest score and date, and the score is
   recorded on the encounter.
6. Re-opening the card shows the saved answers for editing (one active screener of each
   type per encounter, edit-in-place — same rule as the native Clinical Instructions
   editor).

**Flow (flag OFF):** the Screening tab behaves exactly as today — only the stock
"Questionnaires" card, opening the FHIR engine. No PHQ-9/GAD-7 cards. 100% legacy.

---

## 4. Design

### 4.1 The screener drawer (per instrument)

Opened from the hub card as a `SlideOver` drawer (same pattern as the native Clinical
Instructions editor — in-hub, no page reload). Layout top-to-bottom:

- **Header:** instrument name + patient context line.
- **Instruction line:** the standard stem, e.g. *"Over the last 2 weeks, how often have
  you been bothered by any of the following problems?"*
- **Question rows:** each question is one row; the four response options are a horizontal
  radio group on desktop, stacked on mobile. 44px touch targets.
- **Live result panel** (sticky at the bottom of the drawer): total score, severity band
  chip, and a one-line interpretation. Updates on every answer.
- **Safety alert** (PHQ-9 only): when item 9 > 0, a token danger callout appears above the
  result panel: *"This person reported thoughts of self-harm. Assess safety before the
  patient leaves."* It never blocks saving — it prompts action.
- **Footer:** Cancel · Save.

### 4.2 Scoring (built in, per instrument definition)

- **PHQ-9:** 9 scored items (0–3 each), total 0–27. Bands: 0–4 minimal · 5–9 mild ·
  10–14 moderate · 15–19 moderately severe · 20–27 severe. Item 9 is the safety flag.
  (Public-domain instrument; no licensing constraint.)
- **GAD-7:** 7 scored items (0–3 each), total 0–21. Bands: 0–4 minimal · 5–9 mild ·
  10–14 moderate · 15–21 severe. (Public domain.)

Score, band, and interpretation are computed **client-side for live feedback** and
**recomputed and stored server-side on save** (never trust the client's number).

### 4.3 States (every region)

| Region | Loading | Empty | Error | Success |
|---|---|---|---|---|
| Drawer load | "Loading screener…" | new blank screener (no prior answers) | token error callout + retry | questions render, prior answers filled if editing |
| Save | button → "Saving…" | — (save disabled until all scored items answered) | token error callout, **answers kept**, retry | toast "Screening saved", drawer closes, card refreshes |
| Card status | — | "Not started" | — | "PHQ-9 12/27 · Moderate · saved DD/MM/YYYY" |

Validation: **Save is disabled until every scored item is answered** (a partial screener
has no valid score). Inline hint marks unanswered rows. Answers are never wiped on a failed
save.

### 4.4 A11y

Radio groups are real `<fieldset>`/`<legend>` per question; score panel uses
`aria-live="polite"` so the running total is announced; the safety alert uses
`role="alert"`; visible focus ring; `prefers-reduced-motion` honored by the shared drawer.

---

## 5. Data & backend

### 5.1 Storage decision

Native screeners are **not** stored as FHIR (non-goal) and there is no stock `form_phq9`
table here. We store them as a normal OpenEMR encounter form owned by the module:

- New table **`form_nc_screening`** (one row per completed screener on an encounter):

```sql
#IfNotTable form_nc_screening
CREATE TABLE `form_nc_screening` (
    `id`            BIGINT(21) NOT NULL AUTO_INCREMENT,
    `date`          DATETIME DEFAULT NULL,
    `pid`           BIGINT(21) NOT NULL DEFAULT 0,
    `encounter`     BIGINT(21) NOT NULL DEFAULT 0,
    `user`          VARCHAR(255) DEFAULT NULL,
    `groupname`     VARCHAR(255) DEFAULT NULL,
    `authorized`    TINYINT(4) NOT NULL DEFAULT 0,
    `activity`      TINYINT(4) NOT NULL DEFAULT 1,
    `instrument`    VARCHAR(32) NOT NULL,            -- 'phq9' | 'gad7' | ...
    `answers`       TEXT,                            -- JSON: { "1": 2, "2": 0, ... }
    `total_score`   INT DEFAULT NULL,
    `severity`      VARCHAR(32) DEFAULT NULL,        -- 'minimal' | 'mild' | ...
    `flags`         VARCHAR(255) DEFAULT NULL,       -- e.g. 'self_harm' when PHQ-9 item9 > 0
    PRIMARY KEY (`id`),
    KEY `pid_encounter` (`pid`, `encounter`),
    KEY `instrument_pid` (`instrument`, `pid`)
) ENGINE=InnoDB;
#EndIf
```

- **V1 storage decision (module-native):** the screener is stored in `form_nc_screening`
  only. The screener's score is surfaced on **New Clinic surfaces** — the hub card status
  line and the patient chart — computed from this table. The started-state of the hub card
  is read from `form_nc_screening` (by `pid`+`encounter`+`instrument`), **not** from the
  `forms` registry.
- **Stock encounter-summary parity is deferred** (open question §9). The stock encounter
  summary renders each form via the `registry` table + that form's `interface/forms/<dir>/
  report.php`; an unregistered `nc_screening` directory will not appear there. Making the
  score show on the stock summary requires registering a real form directory with a
  `report.php` — heavier, and the clinic lives on New Clinic surfaces, so V1 does not do
  it. (If we later register per-instrument dirs, `FormService::addForm($encounter, $title,
  $newid, 'phq9'|'gad7', $pid, '1')` would also let the card started-state key off the
  `forms` row — but that is the deferred path, not V1.)

Edit-in-place: the latest non-deleted `form_nc_screening` row of that `instrument` on the
encounter is loaded and updated; a first save creates it. One active PHQ-9 and one active
GAD-7 per encounter.

### 5.2 Instrument definitions (server-owned, the extension point)

Instruments live in one PHP definition map (`ScreeningInstrumentCatalog`): id, title, stem,
item list, options with values, max score, severity bands, and any flag rules. PHQ-9 and
GAD-7 ship in V1. Adding PHQ-2 / EPDS / AUDIT-C later is a data edit here, not new
services. The client fetches the definition; the server uses the same map to re-score on
save. **Single source of truth — the client never defines scoring.**

### 5.3 AJAX actions

Under the existing clinical-doc action group and ACL policy
(`clinical_doc_write_acl`, service `assertWriteAccess()`):

| Action | Method | Purpose |
|---|---|---|
| `clinical_doc.screening_get` | GET | instrument definition + any saved answers for the visit's active screener |
| `clinical_doc.screening_save` | POST | validate answers, re-score, insert/update, addForm |

Both funnel through the same visit-state + provider guard the Clinical Instructions editor
uses (visit in an active clinical state; `with_doctor` must match the actor). Service:
`ScreeningAssessmentService` (get/save), lazy getters only (crash-pattern rule).

### 5.4 Catalog / card wiring

**Correction (from the code audit):** unlike `clinical_instructions` — which is a
**registered** stock form (`registry` directory `clinical_instructions`, state 1) whose
card already renders, so we only intercepted its click — `phq9` and `gad7` have **no
registry row**. `ClinicalDocCatalogService::buildCard()` returns `null` for a form-kind
card when `isRegistryFormActive($formdir)` is false, so those two cards are **dropped
today before any intercept is possible.** Showing them therefore needs a new allowance, not
just a click intercept:

- Add a **native-screening allowance in `buildCard()`** (parallel to the existing
  native-engine escape): when the def is a built-in screening instrument (`phq9`/`gad7`)
  **and `enable_native_screening` is on**, emit the card even though it is not in the
  registry. Compute its `started`/score status from `form_nc_screening`, not from the
  `forms` registry.
- The hub then **intercepts the card click client-side** to open the drawer (same as
  `clinical_instructions`).
- `ClinicalDocFormOpenService::openForm` is registry-gated too: it throws "not in catalog"
  at the `isAllowedFormdir()` check (`ClinicalDocFormOpenService.php:72`) for `phq9`/`gad7`
  today. The server-route branch (for external deep-links / favorites) must open that gate
  for the two instruments first. This is **lower priority** — cards intercept client-side,
  and screening instruments are rarely favorited — so it can land in SCRN-2/3, not SCRN-1.
- The generic **"Questionnaires"** card is untouched — still the stock FHIR engine.

### 5.5 ACL

No new ACOs. Reads/writes gated by the existing screening/clinical-doc write ACL in the
service (`assertWriteAccess`) **and** the ajax action policy. Verify grants via
`gacl_aco_map` / `gacl_aro_groups_map`, not install echo text.

---

## 6. Feature flag & rollout

- **Flag:** `enable_native_screening` in `new_clinic_config`, **default OFF**. Wired in all
  three required places (install.sql `#IfNotRow2D`, `ClinicAdminService::EDITABLE_SETTINGS`,
  `adminFieldDefs.ts` allowlist + field def) plus read at the resolved facility in the hub
  host page and passed to the island.
- **Flag OFF = 100% legacy:** no PHQ-9/GAD-7 cards; the Screening tab shows only the stock
  Questionnaires card. No half-new chrome.
- Note the screening lens is itself behind `clinical_doc_show_screening` — both must be on
  for anyone to see native screeners.

### Parity sign-off checklist

- [ ] PHQ-9 total and severity match the published scoring for a set of known inputs
      (0, mixed, max).
- [ ] GAD-7 total and severity match published scoring for known inputs.
- [ ] Item-9 self-harm alert fires for any answer > 0 and never blocks saving.
- [ ] Save writes `form_nc_screening` + the `forms` row; re-open loads and edits in place
      (no duplicate rows on a second save) — verified by DB readback.
- [ ] Score shows on the encounter summary / chart.
- [ ] Flag OFF: screening tab is byte-for-byte the current stock behavior.
- [ ] Stock "Questionnaires" (FHIR) card still opens and works.

---

## 7. Phasing

| Phase | Deliverable |
|---|---|
| SCRN-1 | Backend: table, `ScreeningInstrumentCatalog` (PHQ-9 + GAD-7), `ScreeningAssessmentService`, two ajax actions + policy, flag ×3 + install.sql |
| SCRN-2 | Frontend: `ScreeningDrawer` island component, live scoring, safety alert, card intercept + Add-form + server-route funnel; tests |
| SCRN-3 | Encounter-summary parity (`nc_screening` report) OR chart display fallback; verify + parity sign-off |
| SCRN-4 (later) | Extension instruments (PHQ-2 / EPDS / AUDIT-C) as catalog data; registry cohort reporting on scores |

---

## 8. Risks

- **Clinical safety:** PHQ-9 item 9 is a real self-harm signal. The alert is a product
  requirement, not polish. It must be impossible to miss and must not depend on the score
  band.
- **Scoring correctness:** wrong bands are a clinical-quality bug. Scoring is unit-tested
  against published thresholds and computed server-side.
- **Instrument licensing:** PHQ-9 and GAD-7 are public domain — safe to embed. Any future
  instrument must be licence-checked before it ships (same discipline as the growth-chart
  WHO-licensing block).

---

## 9. Open questions

1. ~~**Encounter-summary parity:** register a real `nc_screening` form directory?~~
   **DONE (v0.3.0):** `interface/forms/nc_screening/report.php` + registry row `nc_screening`
   registered; `ScreeningAssessmentService::saveAssessment` calls `FormService::addForm(...,
   'nc_screening', ...)` on insert (edit-in-place keeps one `forms` row). The score + per-item
   answers now render on the stock encounter summary.
2. **FHIR export:** should a native screener also write a FHIR QuestionnaireResponse so it
   flows to any future export? Deferred — FHIR is a non-goal; revisit only if an export
   requirement appears.
3. **Self-administration:** do we ever want the patient to self-answer on a tablet at the
   desk? Out of V1; the stock form already covers portal self-report if truly needed.
4. **Registry cohorts:** surfacing "all PHQ-9 ≥ 10 this month" in M10 Registry — valuable,
   deferred to SCRN-4; the stored `total_score` + `severity` make it a query later.

---

## 10. Version history

| Version | Date | Changes |
|---|---|---|
| 0.1.0 | 2026-07-17 | Initial draft — analysis of the stock FHIR questionnaire form (empty repository, dead PHQ-9/GAD-7 cards), native scored-screener redesign (PHQ-9 + GAD-7), storage/flag/ACL plan, parity checklist. Deliberately does not rebuild the FHIR engine (non-goal). |
| 0.1.1 | 2026-07-17 | Code-audit corrections: (§5.4) phq9/gad7 cards are dropped in `buildCard()` because they have no registry row (unlike the registered `clinical_instructions`) — showing them needs a native-screening allowance in `buildCard`, not just a click intercept; the `openForm` server-route is registry-gated (`isAllowedFormdir`) and is deprioritised to SCRN-2/3. (§5.1) V1 stores in `form_nc_screening` only with card status + score read from that table; stock encounter-summary parity deferred (needs a registered form dir). |
| 0.2.0 | 2026-07-17 | **Built + product pivot to native default (no flag).** SCRN-1/2 shipped. Then per user decision the `enable_native_screening` flag was **removed** (native PHQ-9/GAD-7 are always on, like the native Clinical Instructions editor) and the generic stock **"Questionnaires" (FHIR/LForms) card was removed from the Screening lens** so there are no stock pages on the tab. The stock questionnaire engine still exists in the codebase but is no longer surfaced as a hub card (custom FHIR questionnaires are not offered — the repository was empty anyway). Only `clinical_doc_show_screening` still gates whether the Screening lens shows at all. |
| 0.3.0 | 2026-07-17 | **SCRN-3 — the two deferred items done.** (Open Q1) Encounter-summary parity: `interface/forms/nc_screening/report.php` + `nc_screening` registry row; `saveAssessment` now `addForm`s on insert so the score + per-item answers render on the stock encounter summary. (Open Q2 / §5.4) `openForm` now server-routes `phq9`/`gad7` to `clinical-doc/index.php?tab=screening&open_form=<instrument>` and the hub auto-opens the screener drawer — so deep-links, favorites, and any stale-bundle fallback open the native drawer instead of the (non-existent) stock form directory. This also hardens the card buttons against a stale bundle. |

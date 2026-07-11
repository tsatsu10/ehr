# New Clinic — Codebase Audit & Refactoring Roadmap

**Version:** v0.1.3 · **Date:** 2026-07-09 · **Status:** Roadmap complete — all AUDIT-1..15 tasks verified done (§7.0)
**Scope:** Full evidence-based audit of the New Clinic module (PHP + React + SQL + docs) as of the working tree on 2026-07-07
**Audience:** Lead dev (desktop + Cursor iOS sessions); roadmap tasks are written to be executable by a smaller model

---

## 0. TL;DR

- **The architecture is sound and the security posture is good.** The strangler-fig island model is implemented consistently: `verify:new-clinic` passes (193 PHP files, zero constructor cycles), CSRF coverage is complete (all 145 write actions verified, zero write actions missing `verifyCsrf`), no SQL injection found, ACL is centrally enforced per action.
- **One Critical regression:** commit `58a3e75` (2026-07-06, "desk modal layout") silently **deleted the Skip-to-payment feature from the Lab and Pharmacy desks** — a PRD P1 feature (M8-F07, M9-F06). Backend, ACL, and FSM are intact; only the UI callers were dropped. Both flagship golden-path Playwright specs now fail. → **AUDIT-1**.
- **The mandatory contract test gate is red:** 6 of 80 tests fail on the current tree (mostly stale source-layout assertions after the desk refactor, plus one removed constant). A red mandatory gate cannot guard merges. → **AUDIT-2**.
- **One fresh-install SQL bug:** `install.sql` orders the `recall_type` ALTER *before* the table CREATE, so a fresh single-pass install leaves the column missing and the recalls worklist errors. → **AUDIT-3**.
- **Debt is concentrated, not diffuse:** `AjaxController.php` (4,258 lines, 252 actions, 97 eagerly constructed services), 9 dead ajax actions, ~10 orphan frontend/Twig files, 5 copy-pasted `*DeskUi.tsx` files, 49/181 services without name-matched tests, and a batch of doc-drift items (scorecard %, flag matrix, CLAUDE.md claims).
- **Roadmap:** 15 AUDIT-* tasks in §7, ordered Critical → Low, one per PR, each with exact files, verification commands, a "Do NOT" line, and an iOS-safe / desktop-only tag. SCALE-* work stays in its own plan and is not duplicated here.

---

## 1. Executive summary

### 1.1 Verdict

The module is in genuinely good shape for a ~92%-built V1: the domain model (visit FSM), the security enforcement pattern, and the island architecture are all implemented the way the specs describe them, and the automated verifier passes. The problems found are **specific and fixable**, not systemic — with one exception: the size of `AjaxController.php` and the eager service construction pattern are a structural risk (Windows stack-overflow crash class, documented in CLAUDE.md §6) that grows with every added action.

### 1.2 Top findings by severity

| # | Severity | Finding | Evidence | Fix |
|---|----------|---------|----------|-----|
| 1 | **Critical** | Skip-to-payment UI removed from Lab + Pharmacy desks by `58a3e75` (2026-07-06); PRD P1 (M8-F07 · PRD:2754, M9-F06 · PRD:2838). Backend intact (`AjaxController.php:1284,1390`; ACO `new_visit_skip_queue` · `AjaxActionPolicy.php:64,71`). Golden-path E2E specs reference now-nonexistent `#nc-lab-skip-btn` / `#nc-pharmacy-skip-btn` (`golden-path-lab-close-day.spec.js:199`, `golden-path.spec.js:211`) | `git show 58a3e75` diff shows deletion of `SkipToPaymentModal` import + `handleSkip` from both desks; repo-wide grep finds zero remaining callers | AUDIT-1 |
| 2 | **Critical** | Mandatory contract suite red: 6/80 failing (`composer test:new-clinic-mandatory`, run 2026-07-07) — Mandatory 12, 39 (error: `PatientActivityFeedService::MAX_LOOKBACK_DAYS` undefined), 40, 43d, 48, 49 | PHPUnit output; failures 12/49 verified stale (features moved to `StartVisitSuccessView.tsx:50-54`, `DoctorTeamRoster`/`useDoctorRoster`) | AUDIT-2 |
| 3 | **High** | `install.sql` fresh-install bug: `#IfMissingColumn new_clinic_recall_meta recall_type` ALTER at lines 1015-1017 precedes the `#IfNotTable` CREATE at 1019-1030, whose body lacks `recall_type`. Fresh single-run install → missing column → SQL errors in `SchedulingRecallsService.php:349,480,493` | Read of `install.sql`; live dev DB has the column only because upgrade ran twice | AUDIT-3 |
| 4 | **High** | ~241 files uncommitted in the working tree (admin-hub People & Access batch, incl. deleted `RolesTab.tsx`, doc moves into `new/`, rebuilt assets) — the prior audit's R-11 risk, recurring | `git status --porcelain` count 2026-07-07 | AUDIT-4 |
| 5 | **High** | `AjaxController.php` 4,258 lines / 252 case labels / 97 services eagerly constructed as promoted ctor defaults (lines 147-243). Known crash class: ctor cycles → Apache `0xc00000fd` (CLAUDE.md §6). Verifier currently reports 0 cycles, but every new eager service re-rolls that dice | Read + parser over the file | AUDIT-10 |
| 6 | Medium | Dual ACL definitions for 13 chart-read + 2 export actions: `AjaxActionPolicy::defersAuthorizationToHandler()` (`AjaxActionPolicy.php:666-669`) delegates to inline helpers (`AjaxController.php:3930-4008`) while the policy *also* lists ACLs (`AjaxActionPolicy.php:615-621`) — two sources of truth that can drift | Read of both files | AUDIT-6 |
| 7 | Medium | 9 truly dead ajax actions (§4.3.2) + 2 "dead because caller regressed" (`lab.skip_to_payment`, `pharmacy.skip_to_payment` — restore, don't remove) | Repo-wide caller search: frontend/src, legacy JS, Twig, module PHP, scripts, tests | AUDIT-5 |
| 8 | Medium | Orphan files: 4 unimported React components + 1 unused hook, 3 unreferenced Twig templates, empty `visit-board-hello/` island dir, empty `src/EventSubscriber/`, 6 `@deprecated` script wrappers, stale `tools/migrate_registration.php` | §5 disposition tables | AUDIT-7, AUDIT-12 |
| 9 | Medium | 49 of 181 services have no name-matched unit test (module `tests/` dir inside the module is empty; real tests live in `tests/Tests/Unit/Modules/NewClinic/` — 162 files) | Data/ops inventory sweep | AUDIT-15 |
| 10 | Low | Doc drift batch: scorecard % overstated for M8/M9; PRD §12.4 flag matrix vs code (3 PRD-only flags, ~24 code-only); CLAUDE.md errors (island count, "Two-Step Cash" model line, `visit-board-hello` demo claim); `acl_version` drift (0.2.3 / 0.2.0 / 0.1.0 across files) | §4.6 | **AUDIT-13 done** · AUDIT-11 done |

### 1.3 Audit baseline caveat

This audit was run against the **working tree of 2026-07-07**, which includes an uncommitted ~241-file batch (admin-hub People & Access rework, doc relocation into `Documentation/NewClinic/new/`, rebuilt `assets/modern/`). HEAD is `4f5a68c`. Findings that depend on uncommitted state are marked. `install.sql` and `AjaxController.php` are **unchanged vs HEAD**, so findings 1-3 and 5-7 hold at HEAD too.

---

## 2. Architecture overview (verified)

### 2.1 Request path

```
Browser (React island)
  └─ oeFetch<T>(action)  — frontend/src/core/oeFetch.ts; envelope {success, data|error}
      └─ public/ajax.php — 17 lines; requires bootstrap.php (globals + CSRF-key seeding
                            for login-app landings, bootstrap.php:17-19)
          └─ AjaxController::handleRequest() :247
              ├─ 401 if no $_SESSION['authUserID']            :251
              ├─ 'visit.transition' → 410 Gone (removed API)  :259-266
              ├─ AjaxActionPolicy::authorizeAction($action)   :268
              │    unless defersAuthorizationToHandler (15 actions → inline gates :3930-4008)
              ├─ giant switch: 252 case labels → service calls (zero SQL in controller)
              │    writes: inline "POST required" gate + $this->verifyCsrf() :4095-4110
              └─ respond() JSON envelope
```

- **Shell:** Twig `templates/base.html.twig` renders `#nc-t1` with `data-ajax-url` + CSRF; `mountIsland()` mounts into `data-island` divs. Desks are React-in-Twig, not iframes; menu entries escape the tab iframe via `top-redirect.php`.
- **Services:** 184 service classes under `src/Services/` (~60,300 lines total in `src/`), all referenced (7 only via non-ajax entry points, e.g. `EncounterNoteExportRenderer` used by `interface/forms/nc_encounter_consult/report.php`).
- **Bootstrap:** module `Bootstrap` class (424 lines) wires 5 output injectors (deep-link session restore, identity strip, etc.) + menu events.
- **Domain model:** `VisitFsm.php` (61 lines) — verified an **exact match** to USER_WORKFLOWS §5: no cancel from `lab_complete`/`pharmacy_complete`; reopen only from {ready_for_lab, ready_for_pharmacy, ready_for_payment, lab_complete, pharmacy_complete} → `with_doctor`.
- **Frontend:** 22 island entry points in `frontend/vite.config.ts` → built into `public/assets/modern/` (manifest verified clean: 103 manifest chunks = 103 files on disk). `bill-ops` deliberately has dual entries (`index.tsx` + `index-correct.tsx` for `public/bill-ops/correct.php`) — not a defect.
- **Pages:** 36 public PHP pages, each with a page-level ACL check; deliberate legacy bypass pages (`clinical-form-bridge.php`, `admin-people-legacy.php`, `top-redirect.php`, `desk-router.php`, `lab-ops/requisition.php`) — not defects (design decision).
- **Data:** 23 `new_%` tables live in the dev DB; no orphan tables found (all referenced from module code). `new_visit` carries 6 secondary indexes including two 5-column queue-sort indexes.
- **Config:** `new_clinic_config` (facility 0 defaults + per-facility overrides, ~130 keys live in dev). `react_migration_cutover_v1` force-enables the `enable_react_*` family (`install.sql:839-863`).

### 2.2 What is deliberately NOT a defect (per design decisions)

Legacy iframe wrappers; Bootstrap-4 shell coexisting with non-layered BEM island CSS; `enable_*` flags defaulting OFF; committed built assets; the `ajax.php` action API (instead of REST/FHIR) for desk work; Tier 3 non-goals (portal, telehealth, claims/EDI, eRx UIs, FHIR clients, DICOM, fax); poll-based desks (SCALE-* owns remediation). None of these are flagged below.

---

## 3. Verified feature & endpoint inventory

### 3.1 Endpoint surface

| Metric | Count | How verified |
|---|---|---|
| Ajax case labels | **252** | Parser over `AjaxController.php` (2026-07-07) |
| Actions with `verifyCsrf` | 145 | Same parser |
| Actions without CSRF — **all reads** | 107 | Parser; zero actions have a POST gate without CSRF |
| Actions with explicit ACL in `AjaxActionPolicy::SINGLE_ACL` / group maps | all except 15 deferred | `AjaxActionPolicy.php:23-124, 474-659` |
| Deferred-auth actions (inline gates) | 15 (13 chart-read + 2 export) | `AjaxActionPolicy.php:666-669` → `AjaxController.php:3930-4008` |
| Removed API tombstone | `visit.transition` → HTTP 410 | `AjaxController.php:259-266` |
| Alias actions | 7 `admin_hub.*` → `admin.*` via `normalizeAction()` | `AjaxActionPolicy.php:691-703` |
| Dead actions (no caller anywhere) | 9 + 2 regressed | §4.3.2 |

### 3.2 Island inventory

22 built islands (front-desk, triage-desk, doctor-desk, lab-desk, pharmacy-desk, cashier-desk, visit-board, patient-chart/MRD, scheduling, patient-registry, communications, admin-hub, report-hub, lab-ops, pharm-ops, bill-ops, queue-bridge, clinical-doc, my-profile, registration, plus per-desk variants) — every island has `*.test.tsx`, zero skipped tests, zero `@ts-ignore`, zero TODO comments, 15 `eslint-disable` (all justified). The `visit-board-hello/` directory is **empty** and absent from `vite.config.ts` entries.

### 3.3 Scorecard corrections (Hygiene — do not edit specs in this session)

The scorecard (`NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md`, overall 81%, last audited 2026-07-08) predates the 2026-07-06 desk redesign. Corrections applied in AUDIT-13 (2026-07-08):

| Scorecard claim | Reality (verified 2026-07-08) |
|---|---|
| M8 Lab desk % includes M8-F07 skip-to-payment | **Restored** — `SkipToPaymentModal` + `lab.skip_to_payment` live in `LabDesk.tsx` (AUDIT-1 landed) |
| M9 Pharmacy desk % includes M9-F06 | **Restored** — same pattern in `PharmacyDesk.tsx` |
| §21.1d ops-exceptions E2E "covered by golden-path specs" | Skip-button selectors present; **re-run golden-path E2E on desktop** to confirm green |
| §21 QA sign-off: 15 flows signed, 57/57 hub smokes | Product §21 sign-off still **PENDING** (Q-24 carried from prior audit) |
| CLAUDE.md: "22 production islands... plus a visit-board-hello Phase 0 demo" | **Fixed in AUDIT-13** — `visit-board-hello/` removed; 22 bundles + `encounter-consult` documented |
| SCALE-* status | All 31 tasks pending — **consistent** with the plan; verified absent in code (no `session_write_close` in ajax path, unbounded desk queries remain) |

---

## 4. Gap analysis

Severity ladder: **Critical** (data loss / feature regression / broken release gate) → **High** (will bite a real deployment) → **Medium** (debt with a concrete failure mode) → **Low** (hygiene). Doc-drift taxonomy: **Conflict** (doc contradicts code), **Gap** (built but undocumented / documented but unbuilt), **Hygiene** (stale numbers, duplicate files).

### 4.1 Functional

| Sev | Finding | Evidence |
|---|---|---|
| **Critical** | **Skip-to-payment regression.** `58a3e75` rewrote LabDesk/PharmacyDesk (85+/86− lines in LabDesk alone) and dropped: `SkipToPaymentModal` import, `handleSkip` callback calling `lab.skip_to_payment`, skip button/modal markup. Leftovers prove the amputation: `SkipToPaymentModal.tsx` (orphan, unimported), `.nc-lab-skip-btn` / `.nc-pharmacy-skip-btn` CSS (`lab-desk/main.css:161`, `pharmacy-desk/main.css:161`), `can_skip_to_payment` in `types.ts:879,1000`, test mock `LabDesk.test.tsx:64`. Backend fully alive: actions at `AjaxController.php:1284,1390`, FSM paths `ready_for_lab/in_lab/ready_for_pharmacy/in_pharmacy → ready_for_payment` (`VisitFsm.php:36-40`), ACO `new_visit_skip_queue`. PRD P1: M8-F07 (PRD:2754), M9-F06 (PRD:2838); PAGE_DESIGNS §7.5.7 requires the reason modal | Session greps + `git show 58a3e75` |
| High | **Advisory routing & queue-slip printing survived the same commit but under new file names** — `DoctorRosterBar.tsx` → `DoctorTeamRoster.tsx` + `useDoctorRoster.ts` (`DoctorDesk.tsx:33-34,167-181`); queue-slip print moved to `StartVisitSuccessView.tsx:50-54`. Functionally OK; the *mandatory tests* asserting the old layout are what's broken (→ 4.7) | Session greps |
| Medium | **"Two-Step Cash" model line in CLAUDE.md is not implemented and not specified.** Every cashier payment op requires `state = 'ready_for_payment'` (`CashierService.php:88,237,413,508`); no code path collects a registration fee at `waiting`; USER_WORKFLOWS has no such step; PRD:127 mentions split settlement only as market context ("sometimes split"). **Conflict** (CLAUDE.md vs code+spec) — either amend CLAUDE.md wording or raise a PRD amendment if upfront REG fee is actually wanted | Greps over module src + both spec docs |
| Low | `visit.queue_slip` re-fetch endpoint documented in module `README.md:313` but never called (slip URL is delivered inline in the `visit.start` response, `AjaxController.php:4060-4067`) | Caller search |

### 4.2 UI/UX

The islands follow the token system (`--oe-nc-*`), callout variants, `WaitTimeSpan`/`QueueCard` render paths, and a11y rules; no hardcoded currency symbols or hex colors were found in the islands sampled. Two debt items:

| Sev | Finding | Evidence |
|---|---|---|
| Medium | Five `*DeskUi.tsx` files (~125 lines each) are **identical except for the desk prefix** — a copy-paste family that will drift on the next desk-wide UI change | Islands inventory sweep |
| Medium | Monster files: `AdminHub.tsx` 1,258 lines, `core/types.ts` 1,229 lines (all domains in one file), `DoctorDesk.tsx` 956 lines | Line counts 2026-07-07 |

### 4.3 Architecture

#### 4.3.1 The controller

`AjaxController.php` (4,258 lines) is the single biggest structural liability: 252 actions in one `switch`, 97 services constructed **eagerly** as promoted constructor property defaults (lines 147-243) on *every* ajax request. Two concrete failure modes: (a) the documented Windows Apache crash class when a ctor cycle sneaks in (currently 0 cycles per verifier, but the gate is desktop-only — CI can't run it); (b) a missing `use` import fatals every ajax request (CLAUDE.md §6, has happened before). Also: unused `use ...QueryUtils` import at line 16.

#### 4.3.2 Dead endpoint surface

Verified across frontend/src, legacy JS (`public/assets/js/`), Twig templates, module PHP, scripts, e2e specs, and unit tests; no dynamic action-string construction exists in the frontend.

| Action | Status | Note |
|---|---|---|
| `session.bind` | **Dead** — remove | Auth-adjacent surface; policy special-case at `AjaxActionPolicy.php:654` also removable |
| `visit.queue_slip` | Dead — remove | Superseded by inline `visit.start` payload; fix module README:313 in same PR |
| `queue.list`, `fees.list` | Dead — remove | Superseded by `visit.board` / desk-specific queues |
| `scheduling.calendar.day` | Dead — remove | `calendar.range` + `calendar.poll` are the live pair |
| `queue_bridge.eod_summary`, `queue_bridge.flow_board_flags` | Dead — remove | Sibling `queue_bridge.eod_export` **is live** (server-built URL, `QueueBridgeSurfaceService.php:193`) — keep it |
| `clinical_doc.ghana_pack_status`, `clinical_doc.referral_hospital_pack_status` | Dead — remove | The `import_*` siblings are live |
| `lab.skip_to_payment`, `pharmacy.skip_to_payment` | **Keep — restore callers** | Regression, §4.1 |
| `admin.config.export`, `admin.config.import` | **Live** | Called via `admin_hub.*` aliases → `normalizeAction()` |

#### 4.3.3 Dual ACL truth

15 actions set `defersAuthorizationToHandler` and are gated inline (`AjaxController.php:3930-4008`), yet the policy file also declares ACLs for them (`AjaxActionPolicy.php:615-621`). Today the two agree; nothing enforces that they keep agreeing.

### 4.4 Database

| Sev | Finding | Evidence |
|---|---|---|
| **High** | `recall_type` ordering bug (§1.2 #3). Self-heals on a second `upgrade_sql.php` run — which is exactly why dev works and a fresh pilot install won't | `install.sql:1015-1030`; consumer `SchedulingRecallsService.php:349,480,493` |
| Low | `acl_version` drift: 0.2.3 / 0.2.0 / 0.1.0 across `acl_setup.php` / installer / recorded config — makes "is ACL up to date?" undecidable from data | Data/ops sweep |
| — | No orphan tables; indexes on `new_visit` are appropriate for the queue-sort paths; unbounded-query concerns are owned by SCALE-* (not re-flagged) | Live DB inspection |

### 4.5 Security

| Area | Verdict | Evidence |
|---|---|---|
| CSRF | **PASS** | Parser over all 252 case blocks: zero actions with a POST/write gate lacking `verifyCsrf`; the 107 CSRF-less actions are all reads (queues, lists, gets, GET exports). `verifyCsrf()` accepts JSON body / `X-CSRF-Token` header / `$_POST` → `CsrfUtils::verifyCsrfToken` (`AjaxController.php:4095-4110`) |
| SQL injection | **None found** | Parameterized queries throughout; ORDER BY via strict whitelists (`PatientCohortSearchService.php:1421-1455`); LIMIT/OFFSET int-cast (e.g. `PatientActivityFeedService` fetchers) |
| AuthZ | Good, one drift risk | Central `authorizeAction()` at `AjaxController.php:268`; `requireAcl()` → `AclMain::aclCheckCore('new_clinic', $aco)` (:4088); dual-definition risk §4.3.3 |
| AuthN | Good | 401 without `authUserID` (:251); per-page ACL on all 36 public pages |
| Info leakage | Clean | 4 `error_log` sites, none log PHI |
| Attack surface | Trim | Dead `session.bind` action should be removed (it is auth-flavored surface nobody uses) |

### 4.6 Documentation drift (Conflicts / Gaps / Hygiene)

| Type | Item |
|---|---|
| Conflict | CLAUDE.md "Two-Step Cash payment (REG fee at waiting...)" vs code + specs (§4.1) |
| Conflict | CLAUDE.md "plus a `visit-board-hello` Phase 0 demo" — empty directory |
| Gap (spec→code) | PRD §12.4 lists flags absent from code: `enable_chart_depth_external`, `enable_lab_lis`, `enable_legacy_strip_terminal_chip` — documented in PRD §12.4.3 (AUDIT-13) |
| Gap (code→spec) | ~20 `enable_react_*` cutover flags + 9 operational flags — documented in PRD §12.4.1–12.4.2 (AUDIT-13) |
| Hygiene | Scorecard corrections (§3.3) — **AUDIT-13 applied 2026-07-08**; doc relocation into `new/` complete (`new/README.md` absent; top-level README is canonical index) |
| Hygiene | Module `README.md:313` documents dead `visit.queue_slip`; prior living audit (`CODE_AUDIT_2026-06-27-REACT-MIGRATION.md`) carries open items Q-12/Q-24/Q-29/Q-30/R-11 that this report supersedes with AUDIT-* IDs |

### 4.7 Test-gate health

`composer test:new-clinic-mandatory` (run 2026-07-07): **80 tests, 1 error + 5 failures.**

| Test | Diagnosis |
|---|---|
| Mandatory 12 (queue slip print payload) | **Stale** — asserts old `StartVisitForm.tsx` source; logic moved to `useStartVisit.ts` + `StartVisitSuccessView.tsx:50-54` and still works |
| Mandatory 39 (MRD feed pagination) | **Error** — `PatientActivityFeedService::MAX_LOOKBACK_DAYS` no longer exists; decide constant-restore vs test-update |
| Mandatory 40 (MRD feed event types) | Stale source assert on service file |
| Mandatory 43d (start-visit switch confirm) | Stale source assert after front-desk refactor |
| Mandatory 48 (clinical doc hub `preflight(` signature) | Stale source assert |
| Mandatory 49 (advisory routing) | **Stale** — asserts `DoctorRosterBar.tsx` exists; renamed to `DoctorTeamRoster.tsx` (feature alive) |

Root cause: these "contract" tests assert **source-file text/layout**, so any refactor breaks them without a behavior change. §9 recommends migrating them to behavioral assertions. Meanwhile, note the inverse hole: the one *real* regression (skip-to-payment) is covered **only** by Playwright, which isn't run per-batch.

---

## 5. File disposition tables

### 5.1 Delete (after the grep listed in each AUDIT task)

| File | Why |
|---|---|
| `frontend/src/components/ClinicalIdentityHeader.tsx` | Unimported orphan |
| `frontend/src/components/ClinicalTaskPanel.tsx` | Unimported orphan |
| `frontend/src/components/ClinicalTimelineEntry.tsx` | Unimported orphan |
| `frontend/src/core/useOfflineRegistrationQueue.ts` | Unused hook |
| `frontend/src/islands/visit-board-hello/` (empty dir) | Not a vite entry; CLAUDE.md claim is wrong |
| `templates/desk-shell.html.twig`, `templates/components/patient-context-banner.html.twig`, `templates/components/patient-search.html.twig` | Unreferenced Twig |
| `src/EventSubscriber/` (empty dir) | Nothing subscribes |
| 6 `@deprecated` wrapper scripts in module `scripts/` + `tools/migrate_registration.php` | Superseded; grep-then-delete |
| 9 dead ajax actions + their `AjaxActionPolicy` entries (§4.3.2 list) | Zero callers |
| `Documentation/NewClinic/new/README.md` | Older divergent duplicate of the top-level README |

### 5.2 Re-wire — do NOT delete

| File | Why |
|---|---|
| `frontend/src/components/SkipToPaymentModal.tsx` | The AUDIT-1 fix re-imports it |
| `.nc-lab-skip-btn` / `.nc-pharmacy-skip-btn` CSS blocks | Same |
| `lab.skip_to_payment` / `pharmacy.skip_to_payment` actions | Same |

### 5.3 Split

| File | Into |
|---|---|
| `src/Controllers/AjaxController.php` (4,258) | Thin dispatcher + per-domain handler classes with lazy service access (AUDIT-10, phased) |
| `frontend/src/core/types.ts` (1,229) | Per-domain type modules re-exported from `types.ts` (no import churn) |
| `frontend/src/islands/admin-hub/AdminHub.tsx` (1,258) | Tab components (in-flight batch already moves this direction) |
| `frontend/src/islands/doctor-desk/DoctorDesk.tsx` (956) | Extract pane/queue subcomponents |

### 5.4 Merge / dedupe

| Files | Action |
|---|---|
| 5 × `*DeskUi.tsx` (~125 lines each, identical modulo prefix) | One parameterized `DeskUi` factory in `@components` |
| `Documentation/NewClinic/` vs `new/` duplicates | Finish the in-flight consolidation; one canonical location per doc |

### 5.5 Keep as-is (explicitly cleared)

Legacy bypass pages (`clinical-form-bridge.php`, `admin-people-legacy.php`, `top-redirect.php`, `desk-router.php`, `lab-ops/requisition.php`); committed `assets/modern/` (manifest-clean); `bill-ops` dual entries; `queue_bridge.eod_export`; all 184 services (all referenced); all 23 live tables.

---

## 6. Workflow findings (Phase 5 trace)

Golden path **register → vitals → consult → lab → Rx → cashier**, traced through code + the mandatory FSM contract tests (74/80 passing include all queue-FSM, wrong-patient, and audit-timeline contracts):

| Step | Status | Evidence |
|---|---|---|
| Register / start visit | ✅ | `visit.start` creates the encounter; Take = queue claim only; queue-slip URL returned inline (`AjaxController.php:4060-4067`) and printed via `StartVisitSuccessView.tsx:50-54` |
| Triage vitals | ✅ | `triage.*` actions; FSM `waiting→in_triage→ready_for_doctor` contracts pass |
| Doctor consult + routing | ✅ | `doctor.take/select/complete`; advisory routing alive post-rename (`DoctorDesk.tsx:33-34,596-609`); routing-override reason required when advisory enabled |
| E-sign gate | ✅ | Server-enforced on desk completes; `esign_override_reason` path (`AjaxController.php:3552`); UI handles `esign_required` → modal (`LabDesk.tsx:288-335`) |
| Lab | ⚠️ | Queue/take/select/complete alive; **skip-to-payment missing** (Critical, §4.1) |
| Pharmacy | ⚠️ | Same regression |
| Cashier | ✅ | Single settlement at `ready_for_payment`, charge presence enforced ("No charges on this visit" guard, `CashierService.php:250`); `completed`/`closed_unpaid` terminal paths per FSM |
| Scheduling / recalls | ⚠️ | Works on upgraded DBs; fresh-install `recall_type` bug (§4.4) |
| Registry (M10) | ✅ | `composer registry-signoff` exists + REG-5 automated (HEAD commits `60bcdc4`, `4f5a68c`); cohort search injection-safe |
| Admin / People & Access | 🚧 | Mid-rework in the uncommitted batch — audited for safety (page ACLs present) but not for completeness |
| Ops hubs (M11-M18) | ✅ | Per §21 map: 57/57 hub smokes recorded; spot-checks consistent |

---

## 7. Refactoring roadmap

### 7.0 Task status (verified against the tree, 2026-07-08)

| Task | Status | Evidence |
|---|---|---|
| AUDIT-1 | ✅ Done | `SkipToPaymentModal` imported + wired in `LabDesk.tsx` / `PharmacyDesk.tsx`; golden-path selectors present |
| AUDIT-2 | ✅ Done | `composer test:new-clinic-mandatory` → 80/80 green (run 2026-07-08) |
| AUDIT-3 | ✅ Done | `recall_type` in CREATE body (`install.sql:1019`); `#IfMissingColumn` moved after CREATE (`:1030`) |
| AUDIT-4 | ✅ Done | People & Access batch landed (`d90e3fe`); note: keep landing session batches promptly (RK-4 recurs) |
| AUDIT-5 | ✅ Done | All 9 dead actions absent from controller + policy |
| AUDIT-6 | ✅ Done | `authorizeDeferredHandler()` reads ACL layers from `AjaxActionPolicy::deferredAuthorizationLayers()` — single truth |
| AUDIT-7 | ✅ Done | All §5.1 orphan components/templates/dirs removed |
| AUDIT-8 | ✅ Done | `@components/DeskUi.tsx` `createDeskUi` factory; six per-desk files are thin config wrappers |
| AUDIT-9 | ✅ Done | `core/types/` domain modules (a); admin-hub `tabs/` split (b); doctor-desk pane subcomponents (c) |
| AUDIT-10 | ✅ Done (target met) | `AjaxController.php` 4,258 → 886 lines; 20 domain handlers under `Controllers/Ajax/Handlers/`; lazy `svc()` accessor |
| AUDIT-11 | ✅ Done | Single `AclVersion::VERSION` (0.2.4 as of 2026-07-08); installer paths pinned by `AclVersionTest` |
| AUDIT-12 | ✅ Done | All deprecated wrappers + `tools/` removed; final `scripts/run_acl_upgrade.php` deleted 2026-07-08 |
| AUDIT-13 | ✅ Done | v0.1.1 doc-sync landed |
| AUDIT-14 | ✅ Done | `ajax-action-crosscheck.php` in `verify:new-clinic` (244 actions) and runs in CI static verify |
| AUDIT-15 | ✅ Done | AUDIT-15a–d batches + final 7 services covered 2026-07-08 (ConfigLog, EncounterNoteExportRenderer, LabOpsRequisition, Module, PhoneBackfill, RegistryAudit, ReportHubPharmacyNativeReport) — every service now referenced by tests |
| §3.3 / §9.3 E2E | ✅ **2/2 green** 2026-07-08 | Both golden-path specs pass end-to-end (registration → triage → doctor → lab skip-to-payment → cashier → close-day) after repairing E2E drift from the desk redesign: letters-only patient names, Start-visit panel click-through (M1b §10), per-desk `nc-<desk>-queue-card` selectors, Radix dialog confirm buttons |

Rules: one task per PR; Conventional Commit subjects given; every task lists exact verification and a "Do NOT" line. Tags: **[iOS-safe]** per `.cursor/rules/new-clinic-mobile-scope.mdc`, **[desktop-only]** otherwise. Frontend tasks end with the standard gate — `cd frontend; npm test -- --run src/islands/<island>; npm run check; npm run build` — plus **one** `ModuleAssetVersion.php` bump per batch and a hard-refresh instruction. Backend tasks end with `composer verify:new-clinic` printing `RESULT: PASS`.

**Persona-sync rule:** the role personas cite AUDIT findings as dated facts (Selorm: AUDIT-3/-11/-13; Kofi/Labik/Esi: AUDIT-1). When a finding's status changes, update the citing personas in the same batch — Labik/Esi were synced 2026-07-08, Kofi/Selorm 2026-07-09. Any future audit that mints new finding IDs inherits this rule.

---

**AUDIT-1 · Critical · Restore skip-to-payment on Lab & Pharmacy desks · [iOS-safe]**
`fix(new-clinic): restore lab/pharmacy skip-to-payment UI (AUDIT-1)`
Files: `frontend/src/islands/lab-desk/LabDesk.tsx`, `frontend/src/islands/pharmacy-desk/PharmacyDesk.tsx` (+ their tests).
Recover the deleted blocks from `git show 58a3e75^:frontend/src/islands/lab-desk/LabDesk.tsx` (import `SkipToPaymentModal` from `@components/SkipToPaymentModal`, `skipOpen`/`skipError` state, `handleSkip` → `oeFetch('lab.skip_to_payment', …)` with `visit_id` + `reason` + `row_version`, button `#nc-lab-skip-btn` gated on `can_skip_to_payment`, modal ids `#nc-lab-skip-modal` / `#nc-lab-skip-reason`) and re-graft into the post-redesign layout; mirror for pharmacy with `pharmacy.` prefix and `#nc-pharmacy-*` ids. Keep the E2E selector ids exactly — the golden-path specs depend on them.
Verify: scoped vitest for both islands → `npm run check` → build → version bump; then desktop: `npx playwright test tests/e2e/new-clinic/specs/golden-path.spec.js tests/e2e/new-clinic/specs/golden-path-lab-close-day.spec.js --config tests/e2e/new-clinic/playwright.config.js` (needs `scripts/e2e-prep-golden-path.php` seeding).
Do NOT: change the backend actions, the FSM, or `SkipToPaymentModal.tsx` itself; do not invent new element ids.

**AUDIT-2 · Critical · Make the mandatory contract suite green · [desktop-only]**
`test(new-clinic): repair mandatory contract suite after desk redesign (AUDIT-2)`
Files: `tests/Tests/Unit/Modules/NewClinic/NewClinicMandatoryContractTest.php` (tests 12, 40, 43d, 48, 49), `src/Services/PatientActivityFeedService.php` (test 39).
For 12/40/43d/48/49: repoint the source-contract assertions at the new file layout (`useStartVisit.ts`, `StartVisitSuccessView.tsx`, `DoctorTeamRoster.tsx`) — assert the *behavioral* string (e.g. the action name `'lab.skip_to_payment'`, the `queue_slip_url` usage), not incidental layout. For 39: restore a `MAX_LOOKBACK_DAYS` public const on `PatientActivityFeedService` if the lookback bound still exists under another name, else update the test to the current bound mechanism.
Verify: `composer test:new-clinic-mandatory` → 80/80; `composer verify:new-clinic` → PASS.
Do NOT: delete or `markTestSkipped` any mandatory test; do not weaken an assertion to `assertTrue(true)`. Run AFTER AUDIT-1 so test 12's skip-adjacent contracts see the restored code.

**AUDIT-3 · High · Fix install.sql recall_type ordering · [desktop-only]**
`fix(new-clinic): create recall_meta with recall_type on fresh install (AUDIT-3)`
Files: `interface/modules/custom_modules/oe-module-new-clinic/sql/install.sql` (lines 1015-1030).
Add `recall_type VARCHAR(32) NOT NULL DEFAULT 'general'` to the CREATE TABLE body at :1019-1030 AND move the `#IfMissingColumn` block (:1015-1017) to *after* the CREATE (keep it — it upgrades existing installs).
Verify: `C:\xampp\php\php.exe interface\modules\custom_modules\oe-module-new-clinic\bin\upgrade_sql.php` (idempotent on dev); then fresh-install proof: create a scratch DB, run the installer once, `DESCRIBE new_clinic_recall_meta` shows `recall_type`.
Do NOT: touch any other directive; do not renumber/reorder unrelated blocks.

**AUDIT-4 · High · Land the uncommitted People & Access batch · [desktop-only]**
`feat(new-clinic): admin hub people & access (AUDIT-4)` — or split if review demands.
Run the full gate on the ~241-file working tree (`composer verify:new-clinic`, `composer people-signoff`, frontend check + build + bump), then commit. This unblocks every other AUDIT task from rebasing over a moving base.
Do NOT: mix AUDIT-1/2/3 fixes into this commit.

**AUDIT-5 · Medium · Remove 9 dead ajax actions · [desktop-only]**
`refactor(new-clinic): remove dead ajax actions (AUDIT-5)`
Files: `src/Controllers/AjaxController.php` (cases for the 9 actions in §4.3.2 marked "remove", incl. the `session.bind` case at :797 and `visit.queue_slip` at :789), `src/Services/AjaxActionPolicy.php` (matching entries incl. `:654` special-case), module `README.md:313`, drop unused `use ...QueryUtils` (`AjaxController.php:16`) in the same pass.
Verify: `composer verify:new-clinic` → PASS; `composer test:new-clinic-mandatory` → green; grep repo for each removed action string → only this diff.
Do NOT: remove `lab.skip_to_payment`, `pharmacy.skip_to_payment`, `queue_bridge.eod_export`, `admin.config.export`, `admin.config.import`, or any `admin_hub.*` alias.

**AUDIT-6 · Medium · Single ACL truth for deferred actions · [desktop-only]**
`refactor(new-clinic): consolidate deferred-action ACL definitions (AUDIT-6)`
Files: `src/Services/AjaxActionPolicy.php` (:615-621, :666-669), `src/Controllers/AjaxController.php` (:3930-4008).
Make the inline chart-read/export gates *read their ACO from the policy map* instead of hardcoding it, so the policy is the only place an ACL string lives.
Verify: `composer verify:new-clinic`; `vendor\bin\phpunit -c phpunit.xml tests\Tests\Unit\Modules\NewClinic`; browser smoke of MRD chart tabs + one export (200s in Network).
Do NOT: change any actual ACO value; behavior must be byte-identical.

**AUDIT-7 · Medium · Delete orphan frontend + Twig files · [iOS-safe]**
`chore(new-clinic): remove orphan components and templates (AUDIT-7)`
Files: §5.1 rows 1-7 (React orphans, empty dirs, 3 Twig templates). Grep each name repo-wide first; skip any with a hit.
Verify: `cd frontend; npm run check; npm run build`; grep confirms zero references; version bump not needed if no shipped island changed (build output diff should be empty).
Do NOT: delete `SkipToPaymentModal.tsx` (§5.2); do not touch `scripts/` (that's AUDIT-12).

**AUDIT-8 · Medium · Deduplicate the five `*DeskUi.tsx` files · [iOS-safe]**
`refactor(new-clinic): shared DeskUi factory (AUDIT-8)`
Create `frontend/src/components/DeskUi.tsx` parameterized by desk prefix; make the five files thin re-exports (or delete them and update imports).
Verify: scoped vitest for all five desks → `npm run check` → build → bump; hard-refresh each desk, confirm identical rendering.
Do NOT: change any rendered class name (`nc-<desk>-*` BEM names must survive for CSS + E2E selectors).

**AUDIT-9 · Medium · Split monster frontend files · [iOS-safe, multi-PR]**
`refactor(new-clinic): split core/types.ts by domain (AUDIT-9a)` then AdminHub (9b — after AUDIT-4 lands), DoctorDesk (9c).
`types.ts` becomes a barrel re-exporting `types/visit.ts`, `types/chart.ts`, etc. — zero import churn for islands.
Verify per PR: `npm run check` (typecheck is the real gate) → build → bump.
Do NOT: rename any exported type; no behavior changes in the same PR.

**AUDIT-10 · High(structural) · AjaxController decomposition · [desktop-only, multi-PR]**
Phase A — `refactor(new-clinic): lazy service access in AjaxController (AUDIT-10a)`: replace the 97 promoted-ctor-default services (:147-243) with a lazy `private function svc(string $class)` memoizing accessor; delete the ctor property list. This *eliminates* the eager-construction crash class instead of merely scanning for it.
Phase B+ — carve the switch into per-domain handler classes (`VisitActions`, `AdminActions`, …) one domain per PR, dispatcher keyed by action prefix.
Verify per PR: `composer verify:new-clinic` (ctor-cycle scan + bootstrap) → PASS; `composer test:new-clinic-mandatory`; browser smoke: one action per touched domain returns 200.
Do NOT: attempt this from Cursor iOS (explicitly barred by mobile-scope rules); do not change any action name, response shape, or ACL in the same PR as a move.

**AUDIT-11 · Low · Reconcile acl_version · [desktop-only]**
`chore(new-clinic): align acl_version to 0.2.3 (AUDIT-11)` — one version constant, installer records it, `install_acl.php` idempotent re-run proves it.
Verify: `C:\xampp\php\php.exe ...\bin\install_acl.php` twice → second run no-ops; `composer people-signoff`.
Do NOT: add/remove any ACO or group in this PR.

**AUDIT-12 · Low · Scripts hygiene · [desktop-only]**
`chore(new-clinic): remove deprecated script wrappers (AUDIT-12)` — the 6 `@deprecated` wrappers + `tools/migrate_registration.php`, each grepped (incl. `composer.json` scripts and CI workflow) before deletion.
Verify: `composer verify:new-clinic` (stray-file scan); `Get-Content composer.json | Select-String <name>` → no hits.
Do NOT: delete any script referenced by `composer.json`, CI, or a sign-off smoke.

**AUDIT-13 · Low · Doc-sync batch · [iOS-safe]**
`docs(new-clinic): sync scorecard, flag matrix, CLAUDE.md to audited reality (AUDIT-13)`
Apply §3.3 scorecard corrections, §4.6 flag-matrix reconciliation (PRD §12.4 ↔ install.sql), CLAUDE.md fixes (island count / visit-board-hello / Two-Step Cash line pending product decision), finish the `new/` consolidation, delete `new/README.md`. Bump each touched spec's version + history row + README index per house rules.
Do NOT: change any normative requirement while syncing status text.

**AUDIT-14 · Low · Dead-action lint guard · [desktop-only]**
`ci(new-clinic): cross-check policy actions against frontend callers (AUDIT-14)`
Add a script (pattern: this audit's parser) to `composer verify:new-clinic` that fails on any policy action with zero callers (allowlist for server-side-URL actions like `queue_bridge.eod_export`) and on any `oeFetch` action string missing from the policy. Prevents §4.3.2 from regrowing.
Do NOT: wire it into CI (CI has no MySQL, but this check is static — it CAN go into `new-clinic-verify.yml` if kept DB-free).

**AUDIT-15 · Medium · Test coverage for the 49 untested services · [desktop-only, incremental]**
`test(new-clinic): cover <ServiceName> (AUDIT-15-<n>)` — priority order: payment/cashier services, FSM-adjacent (visit lifecycle, queue bridge), then ACL/config, then read-model services.
Verify per PR: `vendor\bin\phpunit -c phpunit.xml --filter "<ServiceName>"`.
Do NOT: write source-text "contract" tests (see §9.2); assert behavior.

**Sequencing:** AUDIT-1 → 2 → 3 → 4 unblock everything; 5-9 in any order after 4; 10 is the long arc; 11-15 opportunistic. SCALE-* runs on its own plan in parallel — do not fold SCALE work into AUDIT PRs.

---

## 8. Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| RK-1 | Skip-to-payment regression reaches the pilot (external-lab / declined-Rx patients stuck in queue states, staff invent workarounds) | High if unfixed | High | AUDIT-1 now; Playwright golden paths as release gate (§9) |
| RK-2 | Red mandatory suite normalizes "the gate is always red" → real contract breaks slip through | High | High | AUDIT-2; then treat any red as merge-blocking again |
| RK-3 | Fresh pilot install hits the `recall_type` bug on day one | Certain on fresh install | Medium | AUDIT-3; add a fresh-install smoke to release checklist |
| RK-4 | 241-file uncommitted batch lost or half-landed (R-11 recurring) | Medium | High | AUDIT-4 immediately |
| RK-5 | New eager service in AjaxController reintroduces the Windows ctor-cycle Apache crash; CI can't catch it (desktop-only gate) | Medium | High | AUDIT-10a removes the mechanism, not just the instances |
| RK-6 | Dual ACL definitions drift → an action silently gets the weaker gate | Low-Medium | High | AUDIT-6 + AUDIT-14 |
| RK-7 | Refactor-vs-contract-test cycle repeats (this is the 2nd time source-layout tests broke on a redesign) | High | Medium | §9.2 behavioral-contract policy |
| RK-8 | Scale bottlenecks under multi-desk pilot load | Known | Medium | Owned by SCALE-* plan; not duplicated here |

---

## 9. Testing strategy

1. **Restore the pyramid's gates.** Mandatory suite green (AUDIT-2) and treated as merge-blocking; `composer verify:new-clinic` stays the desktop backend gate; scoped Vitest → `npm run check` → build stays the frontend gate.
2. **Contract tests must assert behavior, not file layout.** The 6 current failures all come from asserting source text of specific files. Policy going forward: a mandatory test may assert (a) an action name exists in the controller/policy, (b) a rendered DOM contract (via Vitest/RTL), or (c) a service behavior — never "file X contains string Y at its old path". Migrate opportunistically as tests break.
3. **Playwright golden paths become a release gate, not a curiosity.** The only test that would have caught the skip regression is `golden-path*.spec.js`. Run both specs (plus `e2e-prep-golden-path.php` seeding) before any release tag and after any desk-island batch.
4. **Fill the 49-service unit gap by risk** (AUDIT-15 ordering): money paths, FSM paths, ACL/config, then read models.
5. **Add the static dead-action cross-check** (AUDIT-14) to `verify:new-clinic` and, being DB-free, to `new-clinic-verify.yml`.
6. **Fresh-install smoke**: scratch DB + single-pass installer + `DESCRIBE` spot-checks (catches the whole `recall_type` bug class), scripted under module `scripts/`.

## 10. Target end-state architecture

- **Backend:** `ajax.php` → thin `AjaxDispatcher` → per-domain action handlers (visit, desk, admin, chart, ops, comms, scheduling) with a lazy memoizing service accessor; `AjaxActionPolicy` is the *sole* ACL/CSRF/verb declaration point (per-action metadata: ACO, requires-POST, requires-CSRF) so the dispatcher enforces gates generically and a forgotten `verifyCsrf` line becomes structurally impossible.
- **Frontend:** domain-split `core/types/`; one `DeskUi` factory; islands stay ≤ ~500 lines by extracting panes; shared components remain the only place modals/queues/wait-times are implemented.
- **Data:** installer proven on fresh DB per release; one `acl_version`; SCALE-* R1-R8 rules govern all new queries/polls.
- **Docs:** one canonical location per doc (`new/` consolidation finished), scorecard re-audited after AUDIT-1/2 land, PRD §12.4 flag matrix generated from `install.sql` rather than hand-maintained.
- **Gates:** green mandatory suite + verify:new-clinic + golden-path Playwright at release; static dead-action check in CI.

---

## 11. Completeness statement — what was NOT audited, and why

- **Not executed:** the 38-spec Playwright suite (needs seeded fixtures + a long browser run; only the two golden-path specs were statically analyzed — and found broken); load/performance testing (owned by SCALE-*).
- **Not read line-by-line:** the ~162 unit-test bodies (inventoried, not reviewed); `NEW_CLINIC_V1_PAGE_DESIGNS.md` beyond targeted sections (§7.5.x lab/pharmacy, sub-action tables); `worksheets/` and `samples/`; the final 619 lines of `CODE_AUDIT_2026-06-27-REACT-MIGRATION.md`; core OpenEMR outside module touchpoints (globals bootstrap, CsrfUtils, AclMain were verified only at the call boundary).
- **Not browser-smoked:** all 22 islands individually (static analysis + unit tests + the mandatory suite stood in; the uncommitted admin-hub batch in particular was audited for safety, not completeness).
- **Sampled, not exhaustive:** SQL-injection review covered all ORDER BY/LIMIT construction sites found by pattern search plus the highest-risk service (`PatientCohortSearchService`) in full — a hand-review of every one of 184 services' query strings was not performed.
- **Single-verified counts:** service/test/script counts come from one inventory sweep each (agent-assisted, spot-verified); action counts, CSRF coverage, FSM, SQL bug, skip regression, and security claims were **independently re-verified by direct file reads or parsers** in this session.

---

## Document history

| Version | Date | Author | Changes |
|---|---|---|---|
| v0.1.3 | 2026-07-09 | Engineering | Persona-sync rule added to §7.0; Kofi (stale AUDIT-1 warning) and Selorm (AUDIT-3/-11/-13 present-tense claims) personas updated to fixed status |
| v0.1.2 | 2026-07-08 | Engineering | §7.0 status table — all AUDIT-1..15 verified done; AUDIT-12 tail (`run_acl_upgrade.php`) and AUDIT-15 tail (7 uncovered services) closed; golden-path E2E name-generator drift fixed (letters-only names) and specs re-run |
| v0.1.1 | 2026-07-08 | Engineering | AUDIT-13 doc-sync landed: scorecard, PRD §12.4 flag matrix, CLAUDE.md, README index; AUDIT-1 skip-to-payment confirmed in tree |
| v0.1.0 | 2026-07-07 | Codebase audit session (Claude) | Initial audit: 6-phase evidence-based review; 10 sections; AUDIT-1..15 roadmap |

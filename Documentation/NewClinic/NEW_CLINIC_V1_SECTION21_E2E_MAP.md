# PRD §21 — E2E evidence map

Living worksheet mapping [PRD §21 acceptance](./NEW_CLINIC_V1_PRD.md#21-acceptance-criteria-v1-pilot) to automated tests and pilot scripts.

| Field | Value |
|-------|--------|
| **Last updated** | 2026-07-04 |
| **Asset** | `20260704sp81hubcomplete` |
| **Rollout script** | `scripts/pilot-enable-v21-golden-path.php` |
| **Readiness fixture** | `scripts/v21-golden-path-smoke-fixture.php` |

## One-command pilot prep

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v21-golden-path.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-golden-path-http.php
```

E2E rollout smoke:

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v21-golden-path-smoke.spec.js
```

## §21.1 Golden path (full clinic)

| PRD checkbox (summary) | Automated evidence | Manual / training |
|------------------------|------------------|-------------------|
| Search top 5 | `golden-path.spec.js` registration search | Pilot sample patients |
| Quick Add + dup check | `golden-path.spec.js` · mandatory 06 | |
| Start visit → Visit Board waiting | `golden-path.spec.js` · mandatory 23 | |
| Vitals → ready_for_doctor | `golden-path.spec.js` | Abnormal vitals chip: triage unit tests |
| Doctor Take patient / consult panel | `golden-path.spec.js` · mandatory 38 | |
| Core encounter orders + Rx | `golden-path-pharm-dispense.spec.js` | |
| E-sign gate on complete | mandatory 28–30 | Config `require_esign_before_complete_consult` |
| Routing modal → lab/pharm | `golden-path-lab-close-day.spec.js` · pharm path | |
| Lab / pharmacy complete → payment | `golden-path-lab-close-day.spec.js` · `golden-path.spec.js` skip | |
| Cashier completion gate + payment | `golden-path.spec.js` · mandatory 07 | |
| E-sign at payment | mandatory 29 | |
| Receipt + completed | `golden-path.spec.js` · mandatory 02–03 | |
| Daily report = receipt sum | `golden-path-lab-close-day.spec.js` bill_ops.daysheet | [Pilot day reconciliation worksheet](./worksheets/NEW_CLINIC_V1_PILOT_DAY_RECONCILIATION_WORKSHEET.md) |

## §21.1b Minimal clinic

| PRD checkbox | Automated evidence |
|--------------|-------------------|
| Skip triage → doctor → pay | `golden-path.spec.js` (pharmacy skip path; no lab role steps) |

## §21.1c–z (post-pilot hubs)

| Section | Topic | Primary e2e smoke | Mandatory contract |
|---------|-------|-------------------|-------------------|
| §21.1c | Registration quality | `front-desk.spec.js` | 04–08 |
| §21.1d | Ops exceptions | `golden-path.spec.js` skip queue | 14–16 |
| §21.1e | Visit Board ↔ Triage | `visit-board.spec.js` | — |
| §21.1f–h | Scheduling | `v11-scheduling-smoke.spec.js` | 59–60 |
| §21.1i | Ancillary | `v11-anc-smoke.spec.js` | — |
| §21.1j | Clinical decision | `v11-rt-smoke.spec.js` | 38, 49 |
| §21.1k–l, aa | MRD / history | `clinical-doc.spec.js` | 39–42 |
| §21.1p | Chart depth | `v11-cd-smoke.spec.js` | 50 |
| §21.1q | Lab ops | `v11-lab-smoke.spec.js` | 51–52 |
| §21.1r, t | Pharm ops | `pharm-ops-hub.spec.js` · `golden-path-pharm-dispense` | 45, 53 |
| §21.1s | Print Rx | `v11-print-rx-smoke.spec.js` | 56 |
| §21.1u | Bill ops | `v12-bill-smoke.spec.js` · `v12-bill-depth-smoke` | 61 |
| §21.1v | Admin hub | `v11-admin-smoke.spec.js` | 54 |
| §21.1w | Report hub | `v11-rep-smoke.spec.js` | 55 |
| §21.1x | Clinical doc | `v11-doc-smoke.spec.js` · `encounter-consult-native.spec.js` | 58 |
| §21.1y | Queue bridge | `v11-bridge-smoke.spec.js` | 57 |
| §21.1z | Legacy chart CTX | `v12-ctx-smoke.spec.js` | — |
| COM | Communications | `v11-comms-smoke.spec.js` | 62 |
| §21 rollout | Desk chain ready | `v21-golden-path-smoke.spec.js` | 63 |

## QA sign-off

Formal record: [NEW_CLINIC_V1_SECTION21_QA_SIGNOFF.md](./NEW_CLINIC_V1_SECTION21_QA_SIGNOFF.md) — **2026-07-04** · asset `20260704sp81hubcomplete`.

| Status | §21 rows | Evidence |
|--------|----------|----------|
| **Signed** | §21.1 (13), §21.1b (1), §21.5 CI (1) | Golden-path E2E 11/11; PHPUnit 62/62 |
| **Engineering signed** | Hub smokes (19 specs) | Playwright **57/57** — 2026-07-04 |
| **Open** | Normative §21.1c–z checkboxes, training, MRD B7, perf, reconciliation | [Pilot worksheets](./worksheets/README.md) |

PRD checkboxes for signed rows are marked in [NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md#21-acceptance-criteria-v1-pilot).

Update [NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md](./NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md) when new smoke specs land.

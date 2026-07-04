# PRD §21 — QA sign-off record

Formal acceptance worksheet for [PRD §21](./NEW_CLINIC_V1_PRD.md#21-acceptance-criteria-v1-pilot). Engineering evidence map: [NEW_CLINIC_V1_SECTION21_E2E_MAP.md](./NEW_CLINIC_V1_SECTION21_E2E_MAP.md).

| Field | Value |
|-------|--------|
| **Sign-off date** | 2026-07-04 |
| **Environment** | XAMPP · Windows · `http://localhost/openemr/` |
| **Asset** | `20260704sp81hubcomplete` |
| **Rollout script** | `scripts/pilot-enable-v21-golden-path.php` |
| **Signed by** | Engineering QA (automated evidence + worksheet) |
| **Product owner** | Pending live pilot week-1 observation |

## Executive summary

| Lens | Signed | Partial | Open | Notes |
|------|--------|---------|------|-------|
| **§21.1 Golden path (full)** | 13 | 0 | 0 | All golden-path E2E specs green |
| **§21.1b Minimal clinic** | 1 | 0 | 0 | Pharmacy-skip path in `golden-path.spec.js` |
| **§21.1c–z Post-pilot hubs** | 0 | 19 | 0 | Hub smokes **57/57** — engineering signed; Product normative rows open |
| **§21.2–21.4 Non-E2E** | 0 | 0 | 8 | Manual training, perf, SUS |
| **§21.5 CI / reconciliation** | 1 | 3 | 0 | Mandatory contracts 62/62; rollout contract 63 |

**Pilot week-1 gate (B0–B5):** **PASS** — golden path + mandatory contracts green. **Hub engineering smokes 57/57 PASS** — Product sign-off on normative §21 rows below remains open until training + live pilot worksheets.

---

## Test run evidence (2026-07-04)

### PHPUnit — mandatory contracts

```bash
vendor/bin/phpunit -c phpunit.xml --filter NewClinicMandatoryContractTest
```

| Result | Detail |
|--------|--------|
| **62 / 62 pass** | 488 assertions · includes rollout smoke contract **63** |

### E2E — golden path (pilot-blocking)

```bash
npm run test:e2e-new-clinic -- \
  tests/e2e/new-clinic/specs/golden-path.spec.js \
  tests/e2e/new-clinic/specs/golden-path-pharm-dispense.spec.js \
  tests/e2e/new-clinic/specs/golden-path-lab-close-day.spec.js \
  tests/e2e/new-clinic/specs/v21-golden-path-smoke.spec.js
```

| Result | Detail |
|--------|--------|
| **11 / 11 pass** | ~6.8 min · desk chain + receipt + daysheet |

### E2E — post-pilot hub smokes (19 specs, 57 tests)

| Spec | Pass | Fail | §21 section |
|------|------|------|-------------|
| `v11-anc-smoke.spec.js` | all | — | §21.1i |
| `v11-admin-smoke.spec.js` | all | — | §21.1v |
| `v11-bridge-smoke.spec.js` | all | — | §21.1y |
| `v11-cd-smoke.spec.js` | all | — | §21.1p |
| `v11-comms-smoke.spec.js` | all | — | COM |
| `v11-doc-smoke.spec.js` | all | — | §21.1x |
| `v11-lab-smoke.spec.js` | all | — | §21.1q |
| `v11-lab-ord-smoke.spec.js` | all | — | §21.1q (LAB-ORD) |
| `v11-print-rx-smoke.spec.js` | all | — | §21.1s |
| `v11-reg-smoke.spec.js` | all | — | §21.1ae |
| `v11-rep-smoke.spec.js` | all | — | §21.1w |
| `v11-rt-smoke.spec.js` | all | — | §21.1j / RT |
| `v11-scheduling-smoke.spec.js` | all | — | §21.1f–h |
| `v12-bill-smoke.spec.js` | all | — | §21.1u |
| `v12-bill-depth-smoke.spec.js` | all | — | §21.1u BILL-3 |
| `v12-ctx-smoke.spec.js` | all | — | §21.1z |
| `v12-hard-assign-smoke.spec.js` | all | — | V1.2 hard assign |
| `v12-doctor-ready-notify-smoke.spec.js` | all | — | V1.2 notify |
| `v12-pharm-rx-smoke.spec.js` | all | — | V1.2-PHARM-RX |

**Hub smoke total:** **57 / 57 pass** (full hub batch + notify/pharm-rx stabilization 2026-07-04).

### E2E — COM + RT (isolated re-run 2026-07-04)

```bash
npm run test:e2e-new-clinic -- \
  tests/e2e/new-clinic/specs/v11-comms-smoke.spec.js \
  tests/e2e/new-clinic/specs/v11-rt-smoke.spec.js
```

| Result | Detail |
|--------|--------|
| **5 / 5 pass** | COM message list + mark done; RT roster + advisory routing (~2.4 min) |

### PHPUnit — test 43 wrong patient (2026-07-04 re-run)

```bash
vendor/bin/phpunit -c phpunit.xml --filter WrongPatientPreventionMandatoryTest
```

| Result | Detail |
|--------|--------|
| **14 / 14 pass** | Test **43** · 67 assertions · go-live gate per §21.5 |

---

## Section sign-off detail

### Signed — pilot week 1

| Section | Rows signed | Evidence |
|---------|-------------|----------|
| §21.1 | 13/13 | `golden-path*.spec.js`, mandatory 02–03, 07, 23, 28–30, 38 |
| §21.1b | 1/1 | `golden-path.spec.js` skip-queue path |
| §21.5 (CI row) | 1/1 | PHPUnit mandatory 1–63 file contracts + integration subset |

PRD checkboxes for §21.1, §21.1b, and §21.5 CI row are marked `[x]` in [NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md#21-acceptance-criteria-v1-pilot).

### Signed — hub engineering smokes (2026-07-04)

All 19 hub smoke specs green (57 tests). Shell/API coverage only — not every normative checkbox in §21.1f–z.

| Smoke spec | Tests | §21 / slice |
|------------|-------|-------------|
| `v11-scheduling-smoke.spec.js` | 3 | §21.1f–h |
| `v11-anc-smoke.spec.js` | 3 | §21.1i |
| `v11-rt-smoke.spec.js` | 2 | RT / §21.1j partial |
| `v11-cd-smoke.spec.js` | 3 | §21.1p shell |
| `v11-lab-smoke.spec.js` | 3 | §21.1q |
| `v11-lab-ord-smoke.spec.js` | 2 | §21.1q LAB-ORD |
| `v11-print-rx-smoke.spec.js` | 2 | §21.1s |
| `v12-bill-smoke.spec.js` | 3 | §21.1u |
| `v12-bill-depth-smoke.spec.js` | 4 | §21.1u BILL-3 |
| `v11-admin-smoke.spec.js` | 3 | §21.1v |
| `v11-rep-smoke.spec.js` | 3 | §21.1w |
| `v11-doc-smoke.spec.js` | 3 | §21.1x |
| `v11-bridge-smoke.spec.js` | 3 | §21.1y |
| `v12-ctx-smoke.spec.js` | 3 | §21.1z |
| `v11-reg-smoke.spec.js` | 3 | §21.1ae shell |
| `v11-comms-smoke.spec.js` | 3 | COM |
| `v12-hard-assign-smoke.spec.js` | 3 | V1.2 hard assign |
| `v12-doctor-ready-notify-smoke.spec.js` | 1 | V1.2 notify |
| `v12-pharm-rx-smoke.spec.js` | 2 | V1.2-PHARM-RX |

### Partial — engineering smoke pass, Product sign-off deferred

All 19 hub smoke specs **57/57 green** (2026-07-04). Smoke covers shell/API paths only — not every normative §21 row. Product walkthrough worksheet: [worksheets/NEW_CLINIC_V1_HUB_PRODUCT_SIGNOFF_WORKSHEET.md](./worksheets/NEW_CLINIC_V1_HUB_PRODUCT_SIGNOFF_WORKSHEET.md).

### Open — manual-only or Product deferred

| Item | Reason | Worksheet |
|------|--------|-----------|
| §21.1c–e, §21.1k–ad | Manual training, MRD B7, week-4 observation | Hub Product sign-off |
| §21.1m wrong patient | §17.4.3 manual script **6/6** on staging | [G12 worksheet](./worksheets/NEW_CLINIC_V1_G12_WRONG_PATIENT_WORKSHEET.md) |
| §21.1o signed amendment | §17.2.4 drill + test **44** | [Documentation integrity](./worksheets/NEW_CLINIC_V1_DOCUMENTATION_INTEGRITY_WORKSHEET.md) |
| §21.2 Safety, §21.3 Performance, §21.4 SUS | Not automated in CI | — |
| §21.5 reconciliation / printing | Live pilot day | [Pilot day reconciliation](./worksheets/NEW_CLINIC_V1_PILOT_DAY_RECONCILIATION_WORKSHEET.md) |

---

## Follow-up before Product marks hub §21 rows

1. Trainer delivery using worksheets: [G12](./worksheets/NEW_CLINIC_V1_G12_WRONG_PATIENT_WORKSHEET.md) · [medication safety](./worksheets/NEW_CLINIC_V1_MEDICATION_SAFETY_WORKSHEET.md) · [documentation integrity](./worksheets/NEW_CLINIC_V1_DOCUMENTATION_INTEGRITY_WORKSHEET.md).
2. Live pilot: [reconciliation worksheet](./worksheets/NEW_CLINIC_V1_PILOT_DAY_RECONCILIATION_WORKSHEET.md) (§21.5), queue slip print, week-4 G11 observation.
3. Product: [hub Product sign-off worksheet](./worksheets/NEW_CLINIC_V1_HUB_PRODUCT_SIGNOFF_WORKSHEET.md) after staging walkthrough.

---

## Related

- [Pilot worksheets index](./worksheets/README.md)
- [Trainer one-pager](./worksheets/NEW_CLINIC_V1_TRAINER_ONE_PAGER.md)
- [Pilot day checklist](./worksheets/NEW_CLINIC_V1_PILOT_DAY_CHECKLIST.md)
- [Implementation scorecard](./NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md)
- [NEXT_STEPS.md](../../interface/modules/custom_modules/oe-module-new-clinic/NEXT_STEPS.md)

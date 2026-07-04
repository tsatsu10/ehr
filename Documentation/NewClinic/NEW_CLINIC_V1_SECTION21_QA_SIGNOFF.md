# PRD §21 — QA sign-off record

Formal acceptance worksheet for [PRD §21](./NEW_CLINIC_V1_PRD.md#21-acceptance-criteria-v1-pilot). Engineering evidence map: [NEW_CLINIC_V1_SECTION21_E2E_MAP.md](./NEW_CLINIC_V1_SECTION21_E2E_MAP.md).

| Field | Value |
|-------|--------|
| **Sign-off date** | 2026-07-04 |
| **Environment** | XAMPP · Windows · `http://localhost/openemr/` |
| **Asset** | `20260704sp77qasignoff` |
| **Rollout script** | `scripts/pilot-enable-v21-golden-path.php` |
| **Signed by** | Engineering QA (automated evidence + worksheet) |
| **Product owner** | Pending live pilot week-1 observation |

## Executive summary

| Lens | Signed | Partial | Open | Notes |
|------|--------|---------|------|-------|
| **§21.1 Golden path (full)** | 13 | 0 | 0 | All golden-path E2E specs green |
| **§21.1b Minimal clinic** | 1 | 0 | 0 | Pharmacy-skip path in `golden-path.spec.js` |
| **§21.1c–z Post-pilot hubs** | 0 | 12 | 4 | Hub smokes 47/57; 10 flaky/timeout failures |
| **§21.2–21.4 Non-E2E** | 0 | 0 | 8 | Manual training, perf, SUS |
| **§21.5 CI / reconciliation** | 1 | 3 | 0 | Mandatory contracts 62/62; rollout contract 63 |

**Pilot week-1 gate (B0–B5):** **PASS** — golden path + mandatory contracts green. Post-pilot hub slices require follow-up on listed E2E failures before Product marks those §21 rows signed.

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
| `v11-comms-smoke.spec.js` | 1 | **2** | COM |
| `v11-doc-smoke.spec.js` | 2 | **1** | §21.1x |
| `v11-lab-smoke.spec.js` | all | — | §21.1q |
| `v11-lab-ord-smoke.spec.js` | — | **1** | §21.1q (LAB-ORD) |
| `v11-print-rx-smoke.spec.js` | all | — | §21.1s |
| `v11-reg-smoke.spec.js` | all | — | §21.1ae |
| `v11-rep-smoke.spec.js` | — | **1** | §21.1w |
| `v11-rt-smoke.spec.js` | — | **2** | §21.1j / RT |
| `v11-scheduling-smoke.spec.js` | all | — | §21.1f–h |
| `v12-bill-smoke.spec.js` | all | — | §21.1u |
| `v12-bill-depth-smoke.spec.js` | — | **1** | §21.1u BILL-3 |
| `v12-ctx-smoke.spec.js` | all | — | §21.1z |
| `v12-hard-assign-smoke.spec.js` | all | — | V1.2 hard assign |
| `v12-doctor-ready-notify-smoke.spec.js` | — | **1** | V1.2 notify |
| `v12-pharm-rx-smoke.spec.js` | — | **1** | V1.2-PHARM-RX |

**Hub smoke total:** **47 / 57 pass** (~35 min across 4 batches). Failures were Playwright timeouts (45s response wait or 10s click) — likely DB/fixture contention when running long batches on XAMPP; re-run individually before Product signs hub rows.

---

## Section sign-off detail

### Signed — pilot week 1

| Section | Rows signed | Evidence |
|---------|-------------|----------|
| §21.1 | 13/13 | `golden-path*.spec.js`, mandatory 02–03, 07, 23, 28–30, 38 |
| §21.1b | 1/1 | `golden-path.spec.js` skip-queue path |
| §21.5 (CI row) | 1/1 | PHPUnit mandatory 1–63 file contracts + integration subset |

PRD checkboxes for §21.1, §21.1b, and §21.5 CI row are marked `[x]` in [NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md#21-acceptance-criteria-v1-pilot).

### Partial — engineering smoke pass, Product sign-off deferred

Smoke spec fully green; not every normative §21 row has dedicated E2E:

- §21.1f–h Scheduling (S1 shell smoke)
- §21.1i Ancillary (ANC smoke)
- §21.1p Chart Depth shell (CD smoke)
- §21.1q Lab ops shell (LAB smoke — LAB-ORD failure separate)
- §21.1s Print Rx (PRINT-RX smoke)
- §21.1u Bill ops shell (BILL smoke — BILL-3 depth failure separate)
- §21.1v Admin hub (ADMIN smoke)
- §21.1y Queue bridge (BRIDGE smoke)
- §21.1z Legacy CTX (CTX smoke)
- §21.1ae Registry shell (REG smoke)
- V1.2 hard assign (`v12-hard-assign-smoke`)

### Open — failures or manual-only

| Item | Reason |
|------|--------|
| COM hub message detail / mark done | 2 E2E timeouts |
| §21.1x Clinical doc doctor route | 1 E2E timeout (3.1m) |
| §21.1q LAB-ORD quick order | 1 E2E failure |
| §21.1w REP immunization CSV | 1 E2E timeout |
| §21.1j / RT roster + advisory routing | 2 E2E failures |
| §21.1u BILL-3 payment reverse | 1 E2E failure |
| V1.2 doctor-ready notify debounce | 1 E2E failure |
| V1.2-PHARM-RX quick prescribe | 1 E2E failure |
| §21.1c–e, §21.1k–ad, §21.1m–o | Manual training, MRD B7, wrong-patient script, week-4 observation |
| §21.2 Safety, §21.3 Performance, §21.4 SUS | Not automated in CI |
| §21.5 reconciliation / printing rows | Requires live pilot day + manager worksheet |

---

## Follow-up before Product marks hub §21 rows

1. Re-run failed specs **individually** after `pilot-enable-v21-golden-path.php` + fixture seed.
2. Fix or stabilize COM message list / mark-done selectors if failures reproduce in isolation.
3. Trainer delivery: §17.2.2, §17.2.3, §17.4.3 manual scripts (§21.1m, §21.1j trainer rows).
4. Live pilot: M7 reconciliation worksheet (§21.5), queue slip print, week-4 G11 observation.

---

## Related

- [Implementation scorecard](./NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md)
- [NEXT_STEPS.md](../../interface/modules/custom_modules/oe-module-new-clinic/NEXT_STEPS.md)

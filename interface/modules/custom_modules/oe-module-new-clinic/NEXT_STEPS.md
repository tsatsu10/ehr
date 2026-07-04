# New Clinic V1 — Next Steps

**Current status (July 4, 2026):** §21 QA sign-off complete (pilot week-1 gate) · asset `20260704sp77qasignoff`  
**Product repo:** [github.com/tsatsu10/ehr](https://github.com/tsatsu10/ehr) — see root [EHR.md](../../../../EHR.md)  
**Remaining work:** Re-run 10 failing hub smoke specs in isolation; Product sign-off on hub §21 rows; live pilot reconciliation (§21.5)

### V1.1-DOC rollout (M17 clinical documentation hub)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-doc.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

Requires M4 P0 doctor desk + `consult_shortcut_preflight`. Enables `enable_clinical_doc_hub` + screening lens.

E2E smoke (PRD DOC-1/3 subset):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v11-doc-smoke.spec.js
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/clinical-doc.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-clinical-doc-http.php
```

### V1.1-BRIDGE rollout (M18 queue bridge)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-bridge.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/queue-bridge-fixture-seed.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

Requires `enable_scheduled_integration` = 1 (set by pilot script). Enables `enable_queue_bridge` + EX-01 detector worklist.

E2E smoke (PRD BRIDGE-1/5/7 subset):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v11-bridge-smoke.spec.js
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/queue-bridge.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-queue-bridge-http.php
```

### V1.1-PRINT-RX rollout (M4-F38 / M13-F10 Type A)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-print-rx.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

Enables `enable_rx_print` + formulary import for smoke flows. **Does not** enable `enable_pharm_ops` (D-PHARM-4).

E2E smoke (PRD PHARM-8):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v11-print-rx-smoke.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-rx-print-http.php
```

### V1.1-REP rollout (M16 reporting hub)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-rep.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

Requires M7 P0 daily reports baseline. Enables `enable_report_hub` + curated lenses (Today, Clinical, Pharmacy, Financial).

E2E smoke (PRD REP-1/3/6 subset):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v11-rep-smoke.spec.js
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/report-hub.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-report-hub-http.php
```

### V1.1-ADMIN rollout (M15 hub)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-admin.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

Requires M6 P0 clinic setup baseline. Enables `enable_admin_hub` + System tab (health, runbooks, config import/export).

E2E smoke (PRD ADMIN-1/3/5 subset):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v11-admin-smoke.spec.js
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/admin-config-import.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-admin-hub-http.php
```

### V1.2-PHARM-RX rollout (M4-F37 quick prescribe)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v12-pharm-rx.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

Requires V1.1-PHARM hub + imported OPD starter formulary (`enable_pharm_rx_favorites` ON).

E2E smoke (PRD PHARM-RX):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v12-pharm-rx-smoke.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-formulary-rx-http.php
```

### V1.1-LAB-ORD rollout (M4-F36 quick panel order)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-lab-ord.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

Requires V1.1-LAB hub + imported OPD starter panel (`enable_lab_panel_order` ON).

E2E smoke (PRD LAB-ORD):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v11-lab-ord-smoke.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-lab-panel-order-http.php
```

### V1.1-LAB rollout (M12 hub)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-lab.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

Admin Hub → enable **Lab role** and **Lab Operations Hub** (`enable_lab_ops` requires lab role ON).

E2E smoke (PRD LAB-1–LAB-8 subset):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v11-lab-smoke.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-lab-ops-http.php
```

### V1.1-CD rollout (payments, referrals, export)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-cd.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/e2e-prep-golden-path.php
cd frontend && npm run build
```

Admin Hub → enable **Chart depth** master + finance / referrals / export sub-flags (default OFF).

E2E smoke (PRD CD-1–CD-5):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v11-cd-smoke.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-chart-depth-http.php
```

### V1.1-RT rollout (roster + advisory routing)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-rt.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

Admin Hub → enable **Doctor roster** and **Advisory routing suggestions** (both default OFF; RTb requires RTa).

E2E smoke (PRD test 33):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v11-rt-smoke.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-advisory-routing-http.php
```

### V1.2 hard assign + notify rollout

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v12-hard-assign.php
cd frontend && npm run build
```

Admin Hub → enable **Hard provider assignment** and **Doctor ready in-app notify** (both default OFF).

E2E smoke (PRD tests 34–35):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v12-hard-assign-smoke.spec.js
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v12-doctor-ready-notify-smoke.spec.js
```

Notify-only pilot (hard assign OFF):

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v12-doctor-notify.php
```

### S1 Scheduling rollout (calendar / flow / recalls)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-scheduling.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/scheduling-recurring-fixture-seed.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

`enable_scheduling_redesign` admin default is `'1'` for **new** facility rows only. Existing databases keep their stored value until you run the pilot script above.

E2E smoke (S1 calendar / flow / recalls subset):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v11-scheduling-smoke.spec.js
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/scheduling.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-scheduling-http.php
```

Hub URL: `.../scheduling/index.php?lens=calendar|flow|recalls`

### V1.2-BILL rollout (M14 billing back office)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/e2e-prep-golden-path.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v12-bill.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/v12-bill-depth-fixture-seed.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

E2E smoke:

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v12-bill-smoke.spec.js
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v12-bill-depth-smoke.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-bill-ops-http.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-bill-ops-depth-http.php
```

Hub URL: `.../bill-ops/index.php`

### V1.1-COM rollout (Communications Hub)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-comms.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-comms-fixture-seed.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

E2E smoke (PRD COM-1/2 subset):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v11-comms-smoke.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-communications-http.php
```

Hub URL: `.../public/communications.php`

### §21 golden path rollout (full clinic pilot stack)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v21-golden-path.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

Chains `pilot-rollout.php` product flags + `e2e-prep-golden-path.php` desk release and ACL grants.

E2E evidence map: [NEW_CLINIC_V1_SECTION21_E2E_MAP.md](../../../../Documentation/NewClinic/NEW_CLINIC_V1_SECTION21_E2E_MAP.md)

Rollout smoke (desk chain readiness):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/v21-golden-path-smoke.spec.js
```

Full journey specs (PRD §21.1):

```bash
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/golden-path.spec.js
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/golden-path-pharm-dispense.spec.js
npm run test:e2e-new-clinic -- tests/e2e/new-clinic/specs/golden-path-lab-close-day.spec.js
```

HTTP smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-golden-path-http.php
```

---

## Completed

- React migration — all desks + hubs (`frontend/src/islands/`, **18** Vite entries incl. `report-hub`, `clinical-doc`)
- **M13 Pharm Ops Hub** — worklist, dispense, receive, OTC, destroy, reports, controlled register, labels, formulary quick Rx
- **M16 Reporting Hub (complete)** — Today lens (M7 embed), lens catalog, native immunization + destroyed-drugs cards, async export (`reports.export` / `reports.export_status`), export audit
- **M17 Clinical Documentation Hub (complete)** — lens shell, catalog + visit summary APIs, form open via `clinical-form-bridge`, Visit Forms menu cutover; visit tab sign overview + add-form picker; ancillary LBF packs; **M4-F40–F42**; **MRD** hub link cutover; **M17-F08** Ghana OPD LBF wizard; audit remediation + PHPUnit (486+ tests)
- **M15 Admin Hub** — form bundle (F06), forms catalog (F07), system health + backup (F08–F09), runbooks + setup checklist (F10–F11), M6 config JSON export (F13); asset `20260701sp14m15export`
- Legacy desk jQuery removed (w50react); Phase 0 hello island removed
- Deep-link session bridge (Rx, encounter, lab results, chart depth)
- Playwright: module page smoke, golden-path E2E (skip + pharm dispense + lab + close day), pharm-ops hub smoke, **report-hub smoke**, **clinical-doc smoke**, island bundle smoke
- E2E helpers: `helpers/registration.js` (Save & Start + dup confirm), `helpers/cashier.js` (zero close or payment)
- Pilot pharm ops seed: `scripts/pilot-enable-pharm-ops.php` + shared `scripts/lib/pharm-ops-pilot-seed.php`
- Pilot report hub seed: `scripts/pilot-enable-report-hub.php` + shared `scripts/lib/pilot-common-seed.php` + `enable_report_hub` in `pilot-rollout.php`
- Pilot clinical doc seed: `scripts/pilot-enable-clinical-doc.php`
- **M16 audit remediation** — admin flag persistence, export schema guard, lens-scoped catalog, M7 embed mode, PHPUnit/Vitest coverage
- E2E npm scripts use `tests/e2e/new-clinic/playwright.config.js` (120s timeout, single worker)
- PHPUnit: `PharmOpsWorklistServiceIntegrationTest`, `ReportHubAccessServiceTest`, `MainMenuRestrictReportHubTest`
- Pilot user seed script + PHPUnit/Vitest green
- **July 2 roadmap batch** — ViteManifestService on all islands (`partials/island-assets.html.twig`); M16 RR-01–RR-12 runbooks footer; M10 PR-3 saved-filter update; **V1.1-RTa** doctor roster (`enable_doctor_roster`, `DoctorRosterBar`); V1.2-CTX pilot seed + `LegacyChartContextServiceTest`; M14 F04 `OutstandingPane` shadcn Card; PRD §5.6 matrix refresh; EX-01 Flow Board test

---

## Task 1: Pilot rollout (facility 3) — done

Product flags enabled via `scripts/pilot-rollout.php` for facilities **0** and **3** (default clinic).

Re-run if needed:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-rollout.php
```

Pharm ops only (subset):

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-pharm-ops.php
```

Report hub only (subset):

```bash
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-report-hub.php
```

Also enable as needed via Admin Hub: `communications_hub_enable`, `enable_chart_depth`, `enable_bill_ops`, `enable_report_hub` (included in `pilot-rollout.php`).

Seed desk users and smoke:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
npx playwright test tests/e2e/new-clinic/specs/module-pages-smoke.spec.js --config tests/e2e/new-clinic/playwright.config.js
npx playwright test tests/e2e/new-clinic/specs/golden-path.spec.js --config tests/e2e/new-clinic/playwright.config.js
npx playwright test tests/e2e/new-clinic/specs/golden-path-pharm-dispense.spec.js --config tests/e2e/new-clinic/playwright.config.js
npx playwright test tests/e2e/new-clinic/specs/golden-path-lab-close-day.spec.js --config tests/e2e/new-clinic/playwright.config.js
npx playwright test tests/e2e/new-clinic/specs/pharm-ops-hub.spec.js --config tests/e2e/new-clinic/playwright.config.js
npx playwright test tests/e2e/new-clinic/specs/report-hub.spec.js --config tests/e2e/new-clinic/playwright.config.js
```

---

## Task 2: Ship to remote

Branch: **`feat/new-clinic-pharm-ops-report-hub`** (HEAD `d4a182a` — 3 commits ahead of `master`).

This workspace has **no git remote** configured and **GitHub CLI (`gh`) is not installed** — push and PR must be done from your fork:

```bash
git remote add origin <your-fork-url>   # once
git push -u origin feat/new-clinic-pharm-ops-report-hub
```

Suggested PR title: `feat(new-clinic): M13/M16/M17 hubs and clinical doc PRD follow-ons`

Commits on branch:
- `004445d` — M13 pharm ops + M16 reporting hub
- `c8da76b` — M16 native exports + M17 clinical doc hub P1
- `d4a182a` — M17 PRD follow-ons + audit remediation

Or open a PR manually on GitHub after push.

---

## Task 3: Optional follow-ups

- O-PHARM-1: optional `pharm_require_lot_on_receive` config (product decision)
- National controlled-substance schedule alignment (O-PHARM-5 register ships; schedule codes TBD)
- V1.2 flags: `enable_hard_provider_assignment`, legacy chart strip tuning
- Install **Ghana OPD LBF** on pilot via Admin Hub → Queue & roles → Import template (if not using stock SOAP)

---

## Verification commands

```bash
vendor/bin/phpunit -c phpunit.xml --filter NewClinic
cd frontend && npm run check && npm run build
```

---

## Reference

- PRD & page designs: `Documentation/NewClinic/README.md`
- **Implementation scorecard:** `Documentation/NewClinic/NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md`
- React islands: `Documentation/FRONTEND_MODULE_GUIDE.md`
- Migration audit: `CODE_AUDIT_2026-06-27-REACT-MIGRATION.md`
- Module URL (XAMPP): http://localhost/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/

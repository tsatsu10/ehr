# New Clinic V1 — Next Steps

**Current status (June 30, 2026):** React cutover complete · V1.2-PHARM shipped · **M16 Reporting Hub shell** (V1.1-REP) shipped · audit remediation complete · pilot rollout on facilities **0 + 3**  
**Remaining work:** Push/PR, M16 async export + native P2 cards

---

## Completed

- React migration — all desks + hubs (`frontend/src/islands/`, 17 Vite entries incl. `report-hub`)
- **M13 Pharm Ops Hub** — worklist, dispense, receive, OTC, destroy, reports, controlled register, labels, formulary quick Rx
- **M16 Reporting Hub (shell)** — Today lens (M7 embed), clinical/pharmacy/financial/public-health/audit catalog lenses, export audit (`reports.export_run`), menu cutover (`enable_report_hub`), pilot CLI `pilot-enable-report-hub.php`
- Legacy desk jQuery removed (w50react); Phase 0 hello island removed
- Deep-link session bridge (Rx, encounter, lab results, chart depth)
- Playwright: module page smoke, golden-path E2E (skip + pharm dispense + lab + close day), pharm-ops hub smoke, **report-hub smoke**, island bundle smoke
- E2E helpers: `helpers/registration.js` (Save & Start + dup confirm), `helpers/cashier.js` (zero close or payment)
- Pilot pharm ops seed: `scripts/pilot-enable-pharm-ops.php` + shared `scripts/lib/pharm-ops-pilot-seed.php`
- Pilot report hub seed: `scripts/pilot-enable-report-hub.php` + shared `scripts/lib/pilot-common-seed.php` + `enable_report_hub` in `pilot-rollout.php`
- **M16 audit remediation** — admin flag persistence, export schema guard, lens-scoped catalog, M7 embed mode, PHPUnit/Vitest coverage
- E2E npm scripts use `tests/e2e/new-clinic/playwright.config.js` (120s timeout, single worker)
- PHPUnit: `PharmOpsWorklistServiceIntegrationTest`, `ReportHubAccessServiceTest`, `MainMenuRestrictReportHubTest`
- Pilot user seed script + PHPUnit/Vitest green

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

Branch: **`feat/new-clinic-pharm-ops-report-hub`** (commit `004445d` on top of `master`).

This workspace has **no git remote** configured and **GitHub CLI (`gh`) is not installed** — push and PR must be done from your fork:

```bash
git remote add origin <your-fork-url>   # once
git push -u origin feat/new-clinic-pharm-ops-report-hub
gh pr create --title "feat(new-clinic): pharm ops hub and reporting hub (M13/M16)" --body "..."
```

Or open a PR manually on GitHub after push.

---

## Task 3: Optional follow-ups

- **M16 deferred** — async export (`reports.export` / `reports.export_status`, 5000-row threshold); native immunization / destroyed-drugs cards (P2)
- O-PHARM-1: optional `pharm_require_lot_on_receive` config (product decision)
- National controlled-substance schedule alignment (O-PHARM-5 register ships; schedule codes TBD)
- V1.2 flags: `enable_hard_provider_assignment`, legacy chart strip tuning

---

## Verification commands

```bash
vendor/bin/phpunit -c phpunit.xml --filter NewClinic
cd frontend && npm run check && npm run build
```

---

## Reference

- PRD & page designs: `Documentation/NewClinic/README.md`
- React islands: `Documentation/FRONTEND_MODULE_GUIDE.md`
- Migration audit: `CODE_AUDIT_2026-06-27-REACT-MIGRATION.md`
- Module URL (XAMPP): http://localhost/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/

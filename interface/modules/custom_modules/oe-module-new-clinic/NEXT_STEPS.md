# New Clinic V1 — Next Steps

**Current status (June 30, 2026):** React cutover complete · V1.2-PHARM shipped · **M16 Reporting Hub** (V1.1-REP) complete · **M17 Clinical Documentation Hub** (V1.1-DOC) complete · pilot rollout on facilities **0 + 3**  
**Remaining work:** Push/PR (no git remote in this workspace)

---

## Completed

- React migration — all desks + hubs (`frontend/src/islands/`, **18** Vite entries incl. `report-hub`, `clinical-doc`)
- **M13 Pharm Ops Hub** — worklist, dispense, receive, OTC, destroy, reports, controlled register, labels, formulary quick Rx
- **M16 Reporting Hub (complete)** — Today lens (M7 embed), lens catalog, native immunization + destroyed-drugs cards, async export (`reports.export` / `reports.export_status`), export audit
- **M17 Clinical Documentation Hub (complete)** — lens shell, catalog + visit summary APIs, form open via `clinical-form-bridge`, Visit Forms menu cutover; **M4-F40** doc status chip, **M4-F41** Open documentation shortcut, **M4-F42** Quick forms drawer; **MRD** hub link cutover; **M17-F08** Ghana OPD LBF wizard (Admin Hub); audit remediation + PHPUnit (473 tests)
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
- React islands: `Documentation/FRONTEND_MODULE_GUIDE.md`
- Migration audit: `CODE_AUDIT_2026-06-27-REACT-MIGRATION.md`
- Module URL (XAMPP): http://localhost/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/

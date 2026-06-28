# New Clinic V1 — Next Steps

**Current status (June 28, 2026):** React cutover complete · 349 PHPUnit New Clinic · 175+ Vitest · asset `20260628w54restore`  
**Remaining work:** E2E golden path (ops setup), optional pilot hardening

---

## Completed since prior draft

- React migration (all 7 desks + admin, chart depth, comms, bill ops, lab ops)
- Deep-link session bridge: Rx, encounter, lab results, chart-depth stock pages
- Admin config cascade for `enable_chart_depth`
- HTTP 200 smoke on all 17 module entry points

---

## Task 1: Playwright E2E golden path (Test 23)

**Goal:** Full patient workflow: registration → triage → doctor → lab → pharmacy → cashier → close day

**Spec exists:** `tests/e2e/new-clinic/specs/golden-path.spec.js`

**Blockers:**

1. Seeded role users (`reception_user`, `nurse_user`, `doctor_user`, etc.) or env vars
2. Base URL: Docker uses `http://localhost:8300`; XAMPP uses `http://localhost/openemr`
3. Playwright: `npm install --save-dev @playwright/test && npx playwright install`

**Run (Docker):**

```bash
cd docker/development-easy
docker compose exec openemr npx playwright test tests/e2e/new-clinic/specs/golden-path.spec.js
```

**Run (XAMPP):** set `TEST_BASE_URL=http://localhost/openemr` and use your local test credentials.

**Module page smoke (17 surfaces, authenticated):**

```bash
npx playwright test tests/e2e/new-clinic/specs/module-pages-smoke.spec.js
```

---

## Task 2: Pilot role users

Seed one user per desk (matches `golden-path.spec.js` env vars):

```bash
# From project root (Apache + MySQL running)
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php --password=YourPass123
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php --dry-run
```

Creates: `reception_user`, `nurse_user`, `doctor_user`, `lab_user`, `pharmacy_user`, `cashier_user`  
Default password: `test_pass` (or `NEW_CLINIC_PILOT_PASS` env). Each user gets **Clinicians** + their desk group.

Grant all desks to an existing admin user:

```bash
php interface/modules/custom_modules/oe-module-new-clinic/acl/install_and_grant.php Adminstrator
```

---

## Task 3: Optional V1.2 flags (default OFF)

- `enable_hard_provider_assignment` — hard doctor assignment
- `enable_bill_ops` — billing back office (enable when pilot ready)
- `enable_admin_hub` — admin hub (enable when pilot ready)

Document per-facility scope: facility rows override global; use Admin Hub scope selector when toggling.

---

## Verification commands

```bash
# Host (XAMPP)
vendor/bin/phpunit -c phpunit.xml --filter NewClinic
cd frontend && npm run check && npm run build

# Docker full suite
cd docker/development-easy
docker compose exec openemr /root/devtools unit-test
```

---

## Reference

- PRD & page designs: `Documentation/NewClinic/README.md`
- React migration audit: `CODE_AUDIT_2026-06-27-REACT-MIGRATION.md`
- Module URL (XAMPP): http://localhost/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/

# Clinic EHR (New Clinic on OpenEMR)

Open-source outpatient clinic operations layer built on [OpenEMR](https://open-emr.org) 7.0.3+.

**Product repo:** [github.com/tsatsu10/ehr](https://github.com/tsatsu10/ehr)  
**Module path:** `interface/modules/custom_modules/oe-module-new-clinic/`  
**License:** GPL-3.0-or-later (inherits OpenEMR)

## What this is

A **private OPD clinic** stack — front desk, triage, doctor consult, lab, pharmacy, cashier, visit board, scheduling, billing back office, admin hub, and clinical documentation — for cash-based clinics (West Africa pilot focus). It is **not** a full hospital HIMS or national HMIS (e.g. DHIMS2).

## Requirements

- PHP 8.2+
- MySQL/MariaDB
- Node.js 20+ (React island builds)
- OpenEMR 7.0.3+ with the New Clinic module installed

## Quick start (XAMPP / local)

```bash
composer install
npm install
cd frontend && npm run build

php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/e2e-prep-golden-path.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
```

Enable the module in OpenEMR **Admin → Modules**, then open desks from the New Clinic menu.

Post-pilot feature flags (clinical doc, queue bridge, report hub, bill ops, admin hub, etc.) are toggled via pilot scripts under `oe-module-new-clinic/scripts/` — see [NEXT_STEPS.md](interface/modules/custom_modules/oe-module-new-clinic/NEXT_STEPS.md).

## Documentation

| Doc | Purpose |
|-----|---------|
| [Module README](interface/modules/custom_modules/oe-module-new-clinic/README.md) | Architecture, desks, ACL, dev workflow |
| [NEXT_STEPS.md](interface/modules/custom_modules/oe-module-new-clinic/NEXT_STEPS.md) | Rollout scripts, smoke tests, backlog |
| [Documentation/NewClinic/](Documentation/NewClinic/) | PRD v1.20.x, page designs, workflows |
| [CLAUDE.md](CLAUDE.md) | Contributor setup (XAMPP + Docker) |

## Tests

```bash
# PHP (New Clinic unit + mandatory contracts)
vendor/bin/phpunit --filter NewClinic

# React islands
cd frontend && npm test

# E2E (requires running app + seeded DB)
npm run test:e2e-new-clinic
```

Current asset version: see `oe-module-new-clinic/src/ModuleAssetVersion.php`.

## Upstream

This tree tracks OpenEMR core plus the New Clinic custom module. Core OpenEMR docs remain in [README.md](README.md).

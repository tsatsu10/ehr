# New Clinic V1 — OpenEMR Module

**Version:** 1.0 (Pilot)  
**License:** GPL-3.0-or-later  
**PHP:** ≥8.2  
**OpenEMR:** ≥7.0.3

A comprehensive private outpatient clinic layer for OpenEMR, designed for West African markets with cash-based billing, visit queue management, and role-specific operational desks.

## Features

### 🏥 **10 Operational Desks**

- **M0 — Front Desk** (`front-desk.php`): Patient search, registration, visit start, appointment integration
- **M2 — Triage** (`triage.php`): Vitals capture, chief complaint, queue management
- **M3 — Doctor Desk** (`doctor.php`): Consult workflow, SOAP notes, prescriptions, lab orders, e-sign
- **M5 — Lab** (`lab.php`): Result entry, quality control, result readiness
- **M8 — Pharmacy** (`pharmacy.php`): Dispensing queue, medication fulfillment
- **M7 — Cashier** (`cashier.php`): Payment processing, receipt issuance, AR integration
- **M7 — Reports** (`reports.php`): End-of-day summaries, unsigned alerts, financial reports
- **M9 — Visit Board** (`visit-board.php`): Real-time queue monitoring, timeline view
- **M6 — Admin** (`admin.php`): Clinic configuration, system health, reconciliation
- **M10 — Patient Registry** (`patient-registry.php`): Cohort search, patient lists

### 📊 **Core Capabilities**

- **Visit Finite State Machine** with optimistic locking (`row_version`)
- **Atomic queue numbering** per facility per day
- **E-signature gates** with profile-aware validation and override audit
- **Encounter session binding** with mismatch detection
- **Payment idempotency** via `client_request_id`
- **Daily reconciliation** comparing module receipts vs core AR
- **Queue slip printing** (80mm thermal format)
- **Reopen consult** with reverse FSM transitions
- **Multi-facility support** with per-facility configuration
- **ACL integration** (14 granular permissions)

### 🔐 **Security & Compliance**

- Comprehensive audit logging (`new_visit_state_log`, `forms_audit`)
- E-sign override tracking
- Cross-facility access guards
- Wrong-patient prevention (duplicate detection, encounter session validation)

## Architecture

### Tech stack

| Layer | Technology |
|-------|------------|
| Backend | PHP 8.2+, PSR-4 services, Symfony events |
| Page shell | Twig 3.x templates, `PageController` |
| Desk / hub UI | **React 19 + TypeScript** — Vite islands in [`frontend/`](../../../../frontend/) |
| Built assets | `public/assets/modern/*.js` (Vite output) |
| Module shell JS | `public/assets/js/shell.js`, `ui-components.js` only |
| AJAX | `public/ajax.php` — consumed by `oeFetch` from React |
| CSS | Bootstrap 4.6 chrome + island BEM + `--oe-nc-*` design tokens |
| Tests | PHPUnit 349 (New Clinic), Vitest 172, Playwright E2E |

See [`Documentation/FRONTEND_MODULE_GUIDE.md`](../../../../Documentation/FRONTEND_MODULE_GUIDE.md) for island development.

```
oe-module-new-clinic/
├── src/
│   ├── Services/           # Business logic (82 services)
│   │   ├── VisitFsm.php    # State machine with reverse transitions
│   │   ├── VisitQueueService.php  # Visit lifecycle, optimistic locking
│   │   ├── DoctorService.php      # Consult workflow, reopen logic
│   │   ├── CashierService.php     # Payments, receipts, AR integration
│   │   ├── ReconciliationService.php  # Daily financial reconciliation
│   │   └── ...
│   ├── Controllers/        # HTTP/AJAX handlers
│   │   ├── AjaxController.php     # Single AJAX entry (40+ actions)
│   │   └── PageController.php     # Twig template rendering
│   └── Bootstrap.php       # Module initialization
├── public/                 # Entry points
│   ├── ajax.php            # AJAX dispatcher
│   ├── doctor.php, cashier.php, ...  # Desk pages
│   └── assets/
│       ├── modern/         # Vite-built React island bundles
│       └── js/             # shell.js + ui-components.js (module chrome only)
├── templates/              # Twig 3.x templates
│   ├── doctor.html.twig, cashier.html.twig, ...
│   └── partials/           # Reusable components
├── sql/
│   └── install.sql         # Schema + idempotent migrations (20+ tables)
├── bin/                    # CLI scripts
│   ├── reconcile.php       # Daily reconciliation cron
│   ├── upgrade_sql.php     # Apply migrations
│   └── install_acl.php     # ACL setup
├── tests/                  # (Located in core OpenEMR tests/)
│   └── Unit/Modules/NewClinic/  # 349 PHPUnit tests + mandatory contract tests
└── composer.json           # PSR-4 autoload
```

### Service Layer Pattern

All business logic extends `BaseService` or follows service-layer principles:
- **Controllers** orchestrate HTTP/AJAX and call services
- **Services** contain domain logic, interact with repositories
- **Repositories** handle database operations (using OpenEMR's `sqlQuery`, `sqlStatement`)

### Database Schema

**20+ tables** prefixed `new_*`:
- `new_visit` — Core visit state (FSM, queue, timestamps, `row_version`)
- `new_visit_state_log` — Audit log with `is_reverse` flag
- `new_receipt` — Module receipts with `posted_payment_id` → `payments.id`
- `new_reconciliation_run` — Daily reconciliation results
- `new_clinic_config` — Per-facility configuration (69 keys)
- See `sql/install.sql` for full schema

## Installation

### Prerequisites

- OpenEMR ≥7.0.3
- PHP ≥8.2
- MySQL/MariaDB
- Composer

### Setup

#### Option 1: XAMPP (Local Development)

```bash
# 1. Start Apache and MySQL from XAMPP Control Panel

# 2. Navigate to module directory
cd C:\xampp\htdocs\openemr\interface\modules\custom_modules\oe-module-new-clinic

# 3. Install ACLs
php bin/install_acl.php

# 4. Apply schema migrations
php bin/upgrade_sql.php

# 5. Enable module in OpenEMR admin
# Admin → Modules → Manage Modules → oe-module-new-clinic → Enable

# 6. Configure facility
# Navigate to: /openemr/interface/modules/custom_modules/oe-module-new-clinic/public/admin.php
# Enable "New Clinic operations" for target facility
```

#### Option 2: Docker (Upstream Development)

```bash
# From docker/development-easy/
docker compose up --detach --wait

# Access container
docker compose exec openemr bash

# Install ACLs
cd /var/www/localhost/htdocs/openemr/interface/modules/custom_modules/oe-module-new-clinic
php bin/install_acl.php

# Apply migrations
php bin/upgrade_sql.php

# Access: http://localhost:8300/ (admin / pass)
```

### Cron Setup (Reconciliation)

Add to crontab for daily reconciliation:

```cron
# Run at 11:55 PM every day
55 23 * * * cd /path/to/openemr && php interface/modules/custom_modules/oe-module-new-clinic/bin/reconcile.php >> /var/log/new-clinic-recon.log 2>&1
```

## Configuration

### Admin UI

Access: `/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/admin.php`

**Key Configuration Options:**

| Setting | Default | Description |
|---------|---------|-------------|
| `enable_new_clinic_ops` | `0` | Master switch for New Clinic mode |
| `print_queue_slip_on_start_visit` | `1` | Auto-print queue slips |
| `queue_slip_instruction_text` | "Please wait to be called" | Slip footer text |
| `reconciliation_enabled` | `1` | Enable daily reconciliation |
| `reconciliation_tolerance` | `0.01` | Delta tolerance (warning threshold) |
| `require_esign_before_complete_consult` | `0` | Enforce e-sign before complete |
| `billing_threshold` | `1.00` | Minimum billable amount |

**69 total configuration keys** stored in `new_clinic_config` (per-facility + global).

### Feature Flags

**V1.1** (Pilot-ready, default ON):
- `enable_new_clinic_ops` — New Clinic operations mode
- `print_queue_slip_on_start_visit` — Queue slip printing
- `reconciliation_enabled` — Daily reconciliation

**V1.2** (Post-pilot, default OFF):
- `enable_bill_ops` — Billing back office (M14)
- `enable_admin_hub` — Admin hub (M15)
- `enable_hard_provider_assignment` — Hard doctor assignment (§6.5.3)

## Testing

### Run Tests

From OpenEMR root directory:

```bash
# All New Clinic PHPUnit tests
vendor/bin/phpunit -c phpunit.xml --filter NewClinic

# Frontend (Vitest)
cd frontend && npm run check

# E2E golden path (XAMPP — seed pilot users first)
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
npx playwright test tests/e2e/new-clinic/specs/golden-path.spec.js --config tests/e2e/new-clinic/playwright.config.js
```

### Test Suites

- **Mandatory contract tests** (`NewClinicMandatoryContractTest.php`): PRD §16.1 items
- **Unit tests**: Service-layer logic (FSM, payment, reopen, reconciliation)
- **Integration tests**: Cross-service workflows
- **E2E**: Playwright — module page smoke, golden-path workflow, island bundle smoke

## Development

### Local Development (XAMPP)

```bash
# Start Apache and MySQL
# Open XAMPP Control Panel → Start All

# Install dependencies (if not done)
cd C:\xampp\htdocs\openemr
composer install

# Access application
# http://localhost/openemr/

# View PHP errors
# C:\xampp\apache\logs\error.log
```

### Asset Building

New Clinic UI is built from the repo-root **`frontend/`** workspace (not Gulp):

```bash
# From OpenEMR root
npm run frontend:install   # once
npm run frontend:build     # production → public/assets/modern/
npm run frontend:dev       # watch mode

# Or from frontend/
cd frontend && npm run check && npm run build
```

Core OpenEMR themes still use Gulp from the repo root (`npm run build`).

**Asset versioning:** `ModuleAssetVersion::VERSION` (cache-busting constant)  
**Current version:** `20260628w55cleanup`

### Code Quality

```bash
# From OpenEMR root
composer phpstan        # Static analysis
composer phpcs          # Code style check
composer phpcbf         # Auto-fix code style
composer rector-check   # Modernization suggestions
```

### Coding Standards

- **Indentation:** 4 spaces
- **Line endings:** LF (Unix)
- **PSR-4:** `OpenEMR\Modules\NewClinic` namespace
- **No strict_types:** Project convention (OpenEMR core doesn't use)
- **Conventional Commits:** `feat(scope): description` (see root `CONTRIBUTING.md`)

## Access Control

### ACL Permissions (14)

| ACL | Description |
|-----|-------------|
| `new_reception` | Front desk access |
| `new_triage` | Triage desk |
| `new_doctor` | Doctor desk |
| `new_visit_reopen` | Reopen consult permission |
| `new_visit_skip_queue` | Queue bypass (emergency) |
| `new_lab`, `new_pharmacy`, `new_cashier` | Station access |
| `new_admin` | Admin hub, configuration |
| `reports` | View reports, reconciliation |

**Installation:** Run `php bin/install_acl.php` to create ACLs.  
**Assignment:** OpenEMR Admin → ACL → Groups → Assign ACLs to groups.

## API / AJAX Actions

**Single entry point:** `public/ajax.php` → `AjaxController`

**40+ AJAX actions**, including:
- `visit.start`, `visit.start_from_appointment` (queue slip URL returned inline on start)
- `doctor.take_patient`, `doctor.complete_consult`, `doctor.reopen`
- `cashier.assess_payment`, `cashier.record_payment`
- `admin.reconciliation.run`, `reports.reconciliation`

**Request format:**
```javascript
POST /openemr/interface/modules/custom_modules/oe-module-new-clinic/public/ajax.php
{
  "action": "doctor.take_patient",
  "visit_id": 123,
  "row_version": 5,
  "_csrf": "..."
}
```

**Response format:**
```json
{
  "success": true,
  "message": "Patient taken",
  "data": { "visit": {...}, "consult": {...} }
}
```

## Documentation

### Project Documentation

- **PRD:** `Documentation/NewClinic/NEW_CLINIC_V1_PRD.md` (v1.20.50)
- **User Workflows:** `Documentation/NewClinic/NEW_CLINIC_V1_USER_WORKFLOWS.md` (v1.9.50)
- **Page Designs:** `Documentation/NewClinic/NEW_CLINIC_V1_PAGE_DESIGNS.md` (v0.6.51)
- **UI/UX Plan:** `Documentation/NewClinic/NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md` (v1.1.0)
- **Documentation Index:** `Documentation/NewClinic/README.md`

### Feature-Specific Redesigns

- **Front Desk Search:** `NEW_CLINIC_V1_FRONT_DESK_SEARCH_REDESIGN.md` (M1a)
- **Registration:** `NEW_CLINIC_V1_FRONT_DESK_REGISTRATION_REDESIGN.md` (M1b/M1c)
- **Communications Hub:** `NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md` (COM)
- **Patient Registry:** `NEW_CLINIC_V1_PATIENT_REGISTRY_REDESIGN.md` (M10)
- **Lab Operations:** `NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md` (M12)
- **Pharmacy Operations:** `NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md` (M13)
- **Billing Back Office:** `NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md` (M14)
- **Admin & Configuration:** `NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md` (M6+M15)

### OpenEMR Core Docs

- **Contributing:** `CONTRIBUTING.md` (root)
- **Development Guide:** `CLAUDE.md` (workspace root)
- **API:** `API_README.md` (root)
- **FHIR:** `FHIR_README.md` (root)

## Troubleshooting

### Common Issues

**1. Module not showing in OpenEMR admin**
- Check `openemr.bootstrap.php` is present
- Verify `version.php` exists with valid version number
- Clear browser cache

**2. "Class not found" errors**
- Run `composer dump-autoload` from OpenEMR root
- Verify `composer.json` autoload section is correct

**3. SQL migrations not applying**
- Run `php bin/upgrade_sql.php` manually
- Check OpenEMR version compatibility (≥7.0.3)

**4. Queue numbers not incrementing**
- Check `new_visit_queue_counter` table exists
- Verify facility ID is set correctly in visit start

**5. Reconciliation not running**
- Check cron is configured
- Verify `reconciliation_enabled=1` in config
- Check CLI output: `php bin/reconcile.php $(date +%Y-%m-%d)`

### Debug Mode

Enable debug logging in `public/bootstrap.php`:

```php
error_reporting(E_ALL);
ini_set('display_errors', '1');
```

**Log files:**
- XAMPP: `C:\xampp\apache\logs\error.log`
- Docker: `/var/log/apache2/error_log`
- OpenEMR: `sites/default/documents/logs_and_misc/log.txt`

## Contributing

See root `CONTRIBUTING.md` for OpenEMR contribution guidelines.

**Commit message format:**
```
<type>(<scope>): <description>

feat(new-clinic): add supervising provider combobox
fix(new-clinic): correct reconciliation deduplication
docs(new-clinic): update README with troubleshooting
```

## License

GNU General Public License v3.0 or later  
See `LICENSE` in OpenEMR root directory.

## Support

- **OpenEMR Forums:** https://community.open-emr.org/
- **GitHub Issues:** https://github.com/openemr/openemr/issues
- **Documentation:** https://www.open-emr.org/wiki/

## Credits

**Project:** New Clinic V1 Module  
**Target Market:** West Africa (Ghana, Nigeria, Kenya)  
**Billing Model:** Cash-only (V1), insurance planned for V2+  
**Contributors:** OpenEMR community

---

**Pilot Status:** ✅ Facility 3 (V1.1-OPS enabled)  
**Test Coverage:** 58/61 mandatory tests passing (95%)  
**Asset Version:** `20260626g12q`  
**Last Updated:** June 26, 2026

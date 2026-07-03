# OpenEMR Development Guide

## Project Structure

```
/src/              - Modern PSR-4 code (OpenEMR\ namespace)
/library/          - Legacy procedural PHP code
/interface/        - Web UI controllers and templates
/templates/        - Smarty/Twig templates
/tests/            - Test suite (unit, e2e, api, services)
/sql/              - Database schema and migrations
/public/           - Static assets
/docker/           - Docker configurations
/modules/          - Custom and third-party modules
```

## Technology Stack

- **PHP:** 8.2+ required
- **Backend:** Laminas MVC, Symfony components
- **Templates:** Twig 3.x (modern), Smarty 4.5 (legacy)
- **OpenEMR core UI:** Angular 1.8, jQuery 3.7, Knockout, Bootstrap 4.6 (tab shell + legacy screens)
- **New Clinic module UI:** React 19 + TypeScript + Vite 8 — island bundles in `frontend/` → `oe-module-new-clinic/public/assets/modern/` (see `Documentation/FRONTEND_MODULE_GUIDE.md`)
- **Build:** Gulp 4 + SASS (core themes); Vite (New Clinic React islands)
- **Database:** MySQL via ADODB wrapper
- **Testing:** PHPUnit 11, Vitest 4 (New Clinic frontend), Jest 29 (core JS), Playwright (New Clinic E2E)

## Local Development

### XAMPP (this workspace)

Primary local environment uses **XAMPP on Windows**. Start Apache and MySQL from the XAMPP Control Panel.

- **Project path:** `c:\xampp\htdocs\openemr`
- **App URL:** http://localhost/openemr/
- **phpMyAdmin:** http://localhost/phpmyadmin
- **PHP:** 8.2+ via XAMPP (`C:\xampp\php\php.exe`)
- **Database:** MySQL on `localhost:3306` — credentials in `sites/default/sqlconf.php`
- **PHP error log:** `C:\xampp\apache\logs\error.log`

Initial setup (from project root):

```bash
composer install
npm install
npm run build        # or npm run dev for file watching
```

### Docker (upstream contributor setup)

See `CONTRIBUTING.md` for the official setup. Quick start:

```bash
cd docker/development-easy
docker compose up --detach --wait
```

- **App URL:** http://localhost:8300/ or https://localhost:9300/
- **Login:** `admin` / `pass`
- **phpMyAdmin:** http://localhost:8310/

## Testing

### On XAMPP (host)

Run from the project root with local PHP:

```bash
vendor/bin/phpunit -c phpunit.xml              # unit tests
vendor/bin/phpunit -c phpunit.integration.xml  # integration tests
```

E2E and the full API test matrix expect additional services; use Docker for those.

### Docker (full suite)

Run from `docker/development-easy/`:

```bash
# Run all tests
docker compose exec openemr /root/devtools clean-sweep-tests

# Individual test suites
docker compose exec openemr /root/devtools unit-test
docker compose exec openemr /root/devtools api-test
docker compose exec openemr /root/devtools e2e-test
docker compose exec openemr /root/devtools services-test

# View PHP error log
docker compose exec openemr /root/devtools php-log
```

**Tip:** Install [openemr-cmd](https://github.com/openemr/openemr-devops/tree/master/utilities/openemr-cmd)
for shorter commands (e.g., `openemr-cmd ut` for unit tests) when using Docker.

## Code Quality

These run on the host (requires local PHP/Node):

```bash
# Run all PHP quality checks (phpcs, phpstan, rector)
composer code-quality

# Individual checks (composer scripts handle memory limits)
composer phpstan          # Static analysis
composer phpcs            # PHP code style check
composer phpcbf           # PHP code style auto-fix
composer rector-check     # Code modernization (dry-run)

# JavaScript/CSS
npm run lint:js           # ESLint check
npm run lint:js-fix       # ESLint auto-fix
npm run stylelint         # CSS/SCSS lint
```

## Build Commands

```bash
npm run build        # Production build
npm run dev          # Development with file watching
npm run gulp-build   # Build only (no watch)
```

## Coding Standards

- **Indentation:** 4 spaces
- **Line endings:** LF (Unix)
- **No strict_types:** Project doesn't use `declare(strict_types=1)`
- **Namespaces:** PSR-4 with `OpenEMR\` prefix for `/src/`
- New code goes in `/src/`, legacy helpers in `/library/`

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

**Types:** feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

**Examples:**
- `feat(api): add PATCH support for patient resource`
- `fix(calendar): correct date parsing for recurring events`
- `chore(deps): bump monolog/monolog to 3.10.0`

## Service Layer Pattern

New services should extend `BaseService`:

```php
namespace OpenEMR\Services;

class ExampleService extends BaseService
{
    public const TABLE_NAME = "table_name";

    public function __construct()
    {
        parent::__construct(self::TABLE_NAME);
    }
}
```

## File Headers

When modifying PHP files, ensure proper docblock:

```php
/**
 * Brief description
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Your Name <your@email.com>
 * @copyright Copyright (c) YEAR Your Name or Organization
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */
```

Preserve existing authors/copyrights when editing files.

## Common Gotchas

- **XAMPP:** Apache and MySQL must be running; rebuild frontend assets after JS/CSS changes (`npm run build` or `npm run dev`)
- Multiple template engines: check extension (.twig, .html, .php)
- Event system uses Symfony EventDispatcher
- Pre-commit hooks available via `.pre-commit-config.yaml`

## Key Documentation

- `CONTRIBUTING.md` - Contributing guidelines
- `API_README.md` - REST API docs
- `FHIR_README.md` - FHIR implementation
- `tests/Tests/README.md` - Testing guide
- `Documentation/NewClinic/` - New Clinic V1 specs (PRD v1.20.32, page designs, workflows, redesigns) — index: `Documentation/NewClinic/README.md`
- `Documentation/NewClinic/NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md` - Communications Hub (v1.0.3)
- `Documentation/NewClinic/NEW_CLINIC_V1_PATIENT_REGISTRY_REDESIGN.md` - Patient Registry (M10) cohort search (v0.2.1); PAGE_DESIGNS §7.32; REG-1–8; V1.1-REG; reception-only Finder hide — separate from M1a Front Desk search
- `Documentation/NewClinic/NEW_CLINIC_V1_FRONT_DESK_SEARCH_REDESIGN.md` - Front Desk search (M1a) (v1.0.9)
- `Documentation/NewClinic/NEW_CLINIC_V1_FRONT_DESK_REGISTRATION_REDESIGN.md` - Front Desk registration form (M1b/M1c) (v1.0.0)
- `Documentation/NewClinic/NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md` - Chart depth beyond MRD (ledger, referrals, export) (v0.1.7)
- `Documentation/NewClinic/NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md` - Lab operations & LIS beyond M8 queue (worklists, panels, DORN) (v0.1.8)
- `Documentation/NewClinic/NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md` - Pharmacy: M9 queue + optional M13 dispensary hub; **V1.1-PRINT-RX** community-pharmacy Rx print (Type A, no inventory); V3 supply chain (v0.1.8)
- `Documentation/NewClinic/NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md` - Billing back office (M14): charge corrections, payment search, close day — post-pilot **V1.2-BILL** (`enable_bill_ops` default OFF)
- `Documentation/NewClinic/NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md` - Admin & configuration (M6 + M15): clinic setup, people/access, forms, system health, day-2 runbooks — **V1.1-ADMIN** (`enable_admin_hub` default OFF)

**Multi-doctor clinics:** Shared `ready_for_doctor` pool (PRD §6.5.1). **V1.1 advisory routing** — suggestions only (§6.5.2). **V1.2 optional:** hard assignment (`enable_hard_provider_assignment`, §6.5.3) and in-app patient-ready notify (§6.5.4) — both **OFF** by default.

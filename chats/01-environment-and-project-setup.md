# Environment and Project Setup

## Local development (confirmed in chat)

| Item | Value |
|------|--------|
| OS | Windows |
| Stack | XAMPP (not Docker for this developer) |
| Project root | `c:\xampp\htdocs\openemr` |
| App URL | http://localhost/openemr/ |
| phpMyAdmin | http://localhost/phpmyadmin |
| PHP | 8.2+ via XAMPP |
| MySQL | localhost:3306 — credentials in `sites/default/sqlconf.php` |
| PHP error log | `C:\xampp\apache\logs\error.log` |
| Module path | `interface/modules/custom_modules/oe-module-new-clinic/` |

## CLAUDE.md updates (from chat)

- Documented XAMPP as primary local environment.
- Apache + MySQL must be running from XAMPP Control Panel.
- Frontend build: `npm install`, `npm run build` or `npm run dev` after JS/CSS changes.
- PHPUnit from project root with local PHP.
- Pointers to New Clinic documentation under `Documentation/NewClinic/`.

## OpenEMR version context

- PRD minimum: OpenEMR 7.0.3+ (PHP 8.2+).
- Later repo docs reference upstream baseline 8.0.0 for security/CVE tracking (separate from this chat thread).

## Product naming

- User-facing name: **New Clinic**
- Codename: New Clinic Module Suite (NCMS)
- Working prefix: `oe-module-new-clinic`

## Documentation location

Specs consolidated under `Documentation/NewClinic/` with subfolders such as `done/`, `new/`, and `worksheets/` as the project matured after this design thread.

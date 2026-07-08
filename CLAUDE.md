# OpenEMR Development Guide

## 0. Read this first — what is happening in this repo

This is a stock **OpenEMR** codebase whose real, active work is the **New Clinic module**: a
private cash-only outpatient clinic product (primary market: West Africa) built as a custom
module that *stranglers* stock OpenEMR with a modern React UI. Everything else in the repo is
upstream OpenEMR and is mostly left alone.

- **Module PHP:** `interface/modules/custom_modules/oe-module-new-clinic/` (services, `public/ajax.php`, Twig shell pages)
- **Module React:** `frontend/` at repo root (React 19 + TS + Vite 8) → builds into the module's `public/assets/modern/`
- **Specs:** `Documentation/NewClinic/` — PRD is canonical; ~20 companion redesign specs; living scorecard
- **Status (July 2026):** V1 pilot path ~92% built and QA-signed. 22 production React islands
  shipped (all role desks M1–M9, Visit Board, patient chart/MRD, scheduling, registry, comms,
  admin hub, report hub, post-pilot ops hubs M11–M18, my-profile; plus a `visit-board-hello`
  Phase 0 demo). Current work: Admin Hub People & Access (native ACL UI
  replacing stock user/group screens), gap-closure plan (`Documentation/NewClinic/new/NEW_CLINIC_OPENEMR_GAP_ANALYSIS_AND_REDESIGN_PLAN.md`),
  scalability hardening plan (SCALE-* tasks).
- **Governing invariant (PRD §5.6):** every post-pilot surface sits behind an `enable_*` flag in
  `new_clinic_config`, **default OFF**. Flag OFF = 100% legacy behavior, no half-new chrome. The
  legacy stock screen stays reachable until the replacement passes parity sign-off.
- **Deliberate non-goals (do not build without a PRD amendment):** patient portal, telehealth,
  US claims/EDI/eligibility, eRx vendor UIs, FHIR/SMART clients, DICOM, fax. See gap-analysis Tier 3.

Development is split between **desktop (this Windows XAMPP box — full verify)** and **Cursor iOS
(editor only — cannot run Apache/MySQL or watch logs)**. Backend PHP written on mobile is *draft
until desktop verification*. See `.cursor/rules/new-clinic-mobile-scope.mdc` and
`Documentation/NewClinic/new/MOBILE_IOS_CURSOR_CHECKLIST.md`.

## 1. Project structure

```
/src/              - Modern PSR-4 core code (OpenEMR\ namespace)
/library/          - Legacy procedural PHP code
/interface/        - Web UI controllers and templates
  modules/custom_modules/oe-module-new-clinic/   ← THE module (PHP, Twig, ajax.php, scripts/)
/frontend/         - New Clinic React workspace (Vite islands) — NOT inside the module folder
/templates/        - Smarty/Twig templates
/tests/            - Test suite (unit, e2e, api, services) — New Clinic under tests/Tests/Unit/Modules/NewClinic
/sql/              - Database schema and migrations
/Documentation/NewClinic/ - PRD, workflows, page designs, redesign specs, scorecard
```

## 2. Technology stack

- **PHP:** 8.2+ required (`C:\xampp\php\php.exe`)
- **Backend:** Laminas MVC, Symfony components; module uses `AjaxController` → services → ADODB
- **Templates:** Twig 3.x (modern + module shell), Smarty 4.5 (legacy)
- **OpenEMR core UI:** Angular 1.8, jQuery 3.7, Knockout, Bootstrap 4.6 (tab shell + legacy screens)
- **New Clinic UI:** React 19 + TypeScript (strict) + Vite 8 + Tailwind 4 + shadcn/Radix — island
  bundles in `frontend/` → `oe-module-new-clinic/public/assets/modern/` (see `Documentation/FRONTEND_MODULE_GUIDE.md`)
- **Database:** MySQL via ADODB wrapper
- **Testing:** PHPUnit 11, Vitest 4 (New Clinic frontend), Jest 29 (core JS), Playwright (New Clinic E2E)

## 3. New Clinic architecture (the mental model)

- **Strangler-fig islands:** PHP/Twig owns login, session, CSRF, ACL, and the page shell
  (`#nc-t1` root in `templates/base.html.twig`, carrying `data-ajax-url` + CSRF). React mounts into `<div data-island="name" data-props="...">` via
  `mountIsland()`. Desks are React-in-Twig pages, **not iframes**; menu entries use
  `top-redirect.php` to escape OpenEMR's tab iframe. Legacy screens still needed are wrapped
  (`admin-people-legacy.php`, `clinical-form-bridge.php`) or deep-linked.
- **Data:** every island calls `oeFetch<T>(action)` from `@core/oeFetch` against the module's
  `ajax.php` actions. Never `fetch` directly, never REST/FHIR for desk work. The envelope is
  `{ success, data | error }`; legacy `postJson()` returns `{ status, payload }` — **never check
  `res.ok`**. `oeFetch` must omit `undefined`/`null` params or the URL gets a literal `"undefined"`.
- **Shared code:** `frontend/src/core/` (mountIsland, oeFetch, tokens.css, types),
  `frontend/src/components/` (QueueCard, WaitTimeSpan, ConfirmModal, DataTable, SlideOver/Sheet,
  deskToast…), `frontend/src/components/ui/` (shadcn primitives), `frontend/src/lib/utils.ts` (`cn()`).
  Import via `@core/*`, `@components/*`. Don't inline what a shared component already does.
- **Encounter lifecycle (central domain model):** queue FSM on `new_visit`; encounter is created
  at **Start visit** (Take patient = queue claim only); complete-consult ≠ signed ≠ paid; Two-Step
  Cash payment (REG fee at waiting, final at ready_for_payment); e-sign is compliance, never
  optional. Deep links into core set `$_SESSION['pid']`/`$_SESSION['encounter']` (wrong-patient
  prevention, G12).
- **Two search surfaces:** M1a Front Desk search (fast single-patient) ≠ M10 Patient Registry
  (cohort filters). Legacy Finder hides for reception roles only.
- **Multi-doctor:** shared `ready_for_doctor` pool; advisory routing (V1.1) suggests only; hard
  assignment is a V1.2 flag, default OFF.

## 4. Local development — XAMPP on Windows (NOT Docker)

The user runs **XAMPP on Windows**. Do not suggest Docker for local work; it exists only for
upstream-style full test suites (see `CONTRIBUTING.md`).

- **Project path:** `c:\xampp\htdocs\openemr` · **App URL:** http://localhost/openemr/ (login with `?site=default`)
- **phpMyAdmin:** http://localhost/phpmyadmin · **MySQL CLI:** `C:\xampp\mysql\bin\mysql.exe` (credentials in `sites/default/sqlconf.php`)
- **PHP error log:** `C:\xampp\apache\logs\error.log`
- **Shell is PowerShell:** chain with `;` not `&&`; use `Get-ChildItem`, not `find`.
- Apache + MySQL must be running (XAMPP Control Panel) for bootstrap verify and browser smoke.

## 5. Verification gates — run these, in this order, every batch

### Frontend islands changed

```powershell
cd c:\xampp\htdocs\openemr\frontend
npm test -- --run src/islands/<island>   # scoped Vitest first
npm run check                            # lint + typecheck + full vitest
npm run build                            # Vite → public/assets/modern/
```

Then bump `interface/modules/custom_modules/oe-module-new-clinic/src/ModuleAssetVersion.php`
(`VERSION = 'YYYYMMDD<slug>'`) **once per batch, not per file**. Stale cached assets are the #1
cause of "you didn't fix it" reports — after building, the user must hard-refresh (Ctrl+Shift+R),
and you can confirm the loaded `?v=` in the failing URL matches the new version. Shell-CSS-only
changes (`public/assets/css/*.css`) need only the version bump, no rebuild.

### Backend module PHP changed

```powershell
cd c:\xampp\htdocs\openemr
composer verify:new-clinic     # syntax, ctor-cycle scan, controller imports, stray files, --bootstrap
```

Must print `RESULT: PASS` including AjaxController bootstrap. CI cannot run this (no MySQL) — it
is a desktop-only gate. Targeted PHP tests:

```powershell
vendor\bin\phpunit -c phpunit.xml tests\Tests\Unit\Modules\NewClinic
vendor\bin\phpunit -c phpunit.xml --filter "<ServiceName>"
composer test:new-clinic-mandatory   # contract tests (queue FSM, wrong-patient, audit timeline)
```

### Schema or ACL changed

```powershell
C:\xampp\php\php.exe interface\modules\custom_modules\oe-module-new-clinic\bin\upgrade_sql.php
C:\xampp\php\php.exe interface\modules\custom_modules\oe-module-new-clinic\bin\install_acl.php
```

New tables go in the module's `install.sql` with `#IfNotRow2D` guards; existing installs only get
them via `upgrade_sql.php` — "missing table" errors on a working feature almost always mean this
step was skipped.

### Browser smoke (any UI change)

Hard-refresh http://localhost/openemr/, open the changed desk, DevTools → Network: `ajax.php`
actions return **200** (not 500, not `ERR_CONNECTION_RESET`), no white screen or React overlay.

### Sign-off smokes (when the area is touched)

`composer registry-signoff` (M10), `composer people-signoff` (People & Access hub). Dozens more
HTTP smokes and pilot-enable scripts live in the module's `scripts/` folder — use the matching one.

### CI

Workflow **New Clinic Verify** (`.github/workflows/new-clinic-verify.yml`): static PHP verify +
scoped Vitest (front-desk, patient-registry, visit-board) + Vite build. Repo-wide `npm run
typecheck` is NOT in CI (TS debt) — run it locally when touching types. CI green does **not**
replace `composer verify:new-clinic`.

## 6. Hard-won Windows/XAMPP gotchas (do not relearn these)

- **`ERR_CONNECTION_RESET` = Apache child process crash**, not a network/frontend problem. Check
  `C:\xampp\apache\logs\error.log` and Windows Event Log for exit `3221225725` / exception
  `0xc00000fd` (stack overflow).
- **Root cause pattern: PHP constructor cycles.** Never eager-construct service trees
  (`private readonly Foo $foo = new Foo()`) that can loop back (known hot cycle: `DoctorService` ↔
  `ClinicalDocDocumentationStatusService` ↔ `EncounterNoteService`). Use lazy getters. The verifier
  scans all module classes for cycles — run it after touching any `__construct`.
- **Missing `use` import in `AjaxController`** resolves to the wrong namespace and fatals *every*
  ajax request with a 500. Every `new XxxService()` needs its `use OpenEMR\Modules\NewClinic\Services\XxxService;`.
- **File hygiene:** never leave `.broken`/`.bak` copies of services in `src/` — the verifier fails on them.
- **Facility scoping bug class:** visits with `facility_id=0` vanish from facility-scoped queues
  but still block new visits. Duplicate-check filters and queue-list filters must align.
- **Tailwind 4 `@layer utilities` LOSES to unlayered Bootstrap 4** on every OpenEMR page. Island
  visual styles must be non-layered BEM CSS in the island's `main.css` using `var(--oe-nc-*)`
  tokens. Tailwind utilities are fine only where Bootstrap doesn't compete.
- **Vitest/jsdom:** `ResizeObserver` mock and `scrollIntoView` stub live in `frontend/src/test-setup.ts`
  (needed for cmdk/Radix). Keep `eslint@^9` (v10 conflicts with eslint-plugin-react).
- **Stock forms in the module shell break** (`parent.closeTab is not a function`, broken asset
  paths) — that's why `clinical-form-bridge.php` exists; don't deep-link stock encounter forms raw.
- **Core dev toggles:** `prevent_browser_refresh=0` in globals allows F5 during dev; stale
  sessions 500 on login without `?site=default`.
- **Scalability:** the polling architecture has known bottlenecks (no `session_write_close()`,
  unbounded desk queries, reads that write). Follow `Documentation/NewClinic/new/NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md`
  (SCALE-* tasks, one per PR); don't add new polls/queries that violate its R1–R8 rules.

## 7. Frontend conventions (New Clinic islands)

- **Design tokens:** all colors/spacing from `--oe-nc-*` (`frontend/src/core/tokens.css` +
  `public/assets/css/tokens.css`). Never hardcode hex or arbitrary Tailwind palette classes.
  Note: CSS *variables* are `--oe-nc-*` but CSS *class names* use the shorter `nc-` prefix
  (`.nc-shell-main`, `.nc-page-heading`, `.nc-callout-*`). Layout: `--oe-nc-content-max` (90rem) +
  `--oe-nc-content-gutter`; centering lives in `shell.css` (`.nc-shell-main`) — don't re-solve
  centering per island (Visit Board has a deliberate full-width exception with horizontal lanes).
- **Feedback:** token callouts, not Bootstrap alerts — React variants in
  `@components/deskCalloutStyles` (`nc-error-callout`, `nc-warn-callout`, `nc-info-callout`,
  `nc-success-callout`), Twig shell equivalents `.nc-callout-*` in `components.css`;
  `showDeskToast()` from `@components/deskToast`; `ConfirmModal` (Radix) for destructive/identity
  confirmation; Badge variant is `neutral` (not `secondary`).
- **Every desk renders wait time via `<WaitTimeSpan />` / `QueueCard`** — never inline the
  formatting (see `.cursor/rules/new-clinic-big-picture-first.mdc` for the full render-path list).
- **Forms UX rules the user insists on:** inline validation while typing (not save-time only),
  form must not wipe on error, form disappears after successful save, registration stays an
  **accordion** (wizard replacements were explicitly rejected).
- **Regional:** DD/MM/YYYY dates, clinic-configurable currency (never hardcode `$` or GHS),
  insurance UI hidden when `enable_insurance=false`.
- **A11y:** WCAG 2.1 AA; aria-labels on icon buttons; 44px touch targets; visible focus ring;
  `prefers-reduced-motion` guard; Lucide icons in React (no emojis as icons).
- Every island has `*.test.tsx`; TS strict, no `any` without a justifying comment; no
  `console.log`; no business logic in components (PHP enforces ACL, services compute).

## 8. Testing (full matrix)

**On XAMPP (host):** `vendor/bin/phpunit -c phpunit.xml` (unit), `-c phpunit.integration.xml`
(integration), Vitest via `cd frontend; npm test`. Root wrappers also exist: `npm run frontend:build|test|typecheck|lint`.
**Playwright (New Clinic):** `npx playwright test tests/e2e/new-clinic/specs/<spec> --config tests/e2e/new-clinic/playwright.config.js` —
golden-path specs need seeded fixtures (`scripts/e2e-prep-golden-path.php` etc.).
**Docker (upstream full suite):** `cd docker/development-easy; docker compose up -d`; then
`docker compose exec openemr /root/devtools <clean-sweep-tests|unit-test|api-test|e2e-test|services-test>`.

## 9. Code quality

```bash
composer code-quality     # phpcs + phpstan + rector (host)
composer phpstan | phpcs | phpcbf | rector-check
npm run lint:js | lint:js-fix | stylelint          # core JS/CSS
cd frontend && npm run check                        # New Clinic gate
```

## 10. Coding standards

- **Indentation:** 4 spaces · **Line endings:** LF · **No `declare(strict_types=1)`** in PHP
- **Namespaces:** PSR-4 `OpenEMR\` for `/src/`; module code under `OpenEMR\Modules\NewClinic\`
- New core code in `/src/`, legacy helpers in `/library/`; module code stays in the module
- Services extend `BaseService` with `TABLE_NAME` const; keep PHP file-header docblocks and
  preserve existing authors/copyrights

## 11. Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <description>` —
types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert. Examples:
`feat(new-clinic): add registry cohort export`, `fix(services): break circular dependency causing
Apache crashes`, `perf(new-clinic): bounded queue query (SCALE-1.1)`. One SCALE task ID per commit
when doing hardening work.

## 12. Documentation hierarchy & upkeep

**PRD wins conflicts.** `Documentation/NewClinic/NEW_CLINIC_V1_PRD.md` (canonical) →
`NEW_CLINIC_V1_USER_WORKFLOWS.md` + `NEW_CLINIC_V1_PAGE_DESIGNS.md` (normative companions) →
per-module `*_REDESIGN.md` specs → `NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md` (living % tracker)
→ `README.md` (index). When you change a spec: bump its version, add a history row, and sync the
README index + scorecard in the same batch. Note: scorecard/PRD status matrices go stale — trust
the code over a "Not started" cell, then fix the doc. `OPENEMR_AREAS_NOT_ADDRESSED.txt` records
explicit out-of-scope items.

## 13. Working with this user (learned across sessions)

- **"Proceed"-driven:** prefers continuous incremental execution over repeated option menus or
  re-planning. For non-trivial new scope, state the approach briefly first; list affected files
  when touching more than 3.
- **Audit → todo → fix ALL → one version bump:** requests structured audits and expects every
  issue fixed critical→low in one pass, across every render path (partial fixes that need repeated
  hard-refresh reports are the #1 frustration — see big-picture-first rule).
- **Wants honesty, not flattery:** "do you think this looks modern, be honest" / "are you sure
  everything was covered" — give real assessments, second-pass audits, and honest limits (e.g.
  scale headroom is 10×–50×, not infinite).
- **Explain in simple words** for product questions — plain English, no file-name soup.
- **Naming:** the product is "New Clinic", never "Ghana-this" in docs; neutral regional examples.
- **Never claim "done"** for backend PHP without desktop `composer verify:new-clinic`, or for UI
  without build + asset bump + a hard-refresh instruction. If the user says "not fixed", first
  check the loaded asset version, then grep for the render path you missed.

## 14. Key documentation

- `CONTRIBUTING.md` / `API_README.md` / `FHIR_README.md` / `tests/Tests/README.md` — upstream guides
- `Documentation/FRONTEND_MODULE_GUIDE.md` — how to build and wire React islands (Vite, `oeFetch`, tokens, CSS cascade rule)
- `Documentation/NewClinic/README.md` — index of all New Clinic specs + relationship map
- `Documentation/NewClinic/NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md` — UI/UX master (component reference, shadcn migration)
- `Documentation/NewClinic/new/NEW_CLINIC_OPENEMR_GAP_ANALYSIS_AND_REDESIGN_PLAN.md` — what stock OpenEMR is still unaddressed + phased GAP-A–D plan
- `Documentation/NewClinic/new/NEW_CLINIC_MARKET_EXPANSION_MASTER_PLAN.md` — market segments, business plan, pilot playbook, MKT-* roadmap
- `Documentation/NewClinic/new/NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md` — SCALE-* performance tasks + R1–R8 rules
- `Documentation/NewClinic/new/MOBILE_IOS_CURSOR_CHECKLIST.md` — Cursor iOS session end checklist
- `.cursor/rules/new-clinic-big-picture-first.mdc` · `new-clinic-mobile-backend-gate.mdc` · `new-clinic-mobile-scope.mdc`

**Multi-doctor clinics:** Shared `ready_for_doctor` pool (PRD §6.5.1). **V1.1 advisory routing** —
suggestions only (§6.5.2). **V1.2 optional:** hard assignment (`enable_hard_provider_assignment`,
§6.5.3) and in-app patient-ready notify (§6.5.4) — both **OFF** by default.

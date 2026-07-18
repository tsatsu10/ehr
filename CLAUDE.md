# OpenEMR Development Guide

## 0. Read this first — what is happening in this repo

This is a stock **OpenEMR** codebase whose real, active work is the **New Clinic module**: a
private cash-only outpatient clinic product (primary market: West Africa) built as a custom
module that *stranglers* stock OpenEMR with a modern React UI. Everything else in the repo is
upstream OpenEMR and is mostly left alone.

- **Module PHP:** `interface/modules/custom_modules/oe-module-new-clinic/` (services, `public/ajax.php`, Twig shell pages)
- **Module React:** `frontend/` at repo root (React 19 + TS + Vite 8) → builds into the module's `public/assets/modern/`
- **Specs:** `Documentation/NewClinic/` — PRD is canonical; ~20 companion redesign specs; living scorecard
- **Status (July 2026):** V1 pilot path ~92% built and QA-signed. **22 production React island bundles** in
  `frontend/vite.config.ts` (23 Vite entries including the `bill-ops-correct` build variant; **`encounter-consult`**
  for the native consult form). Surfaces: all role desks M1–M9, Visit Board, patient chart/MRD, scheduling,
  registry, comms, admin hub, report hub, post-pilot ops hubs M11–M18, my-profile. Current work: gap-closure plan
  (`Documentation/NewClinic/new/NEW_CLINIC_OPENEMR_GAP_ANALYSIS_AND_REDESIGN_PLAN.md`), scalability hardening
  plan (SCALE-* tasks).
- **Governing invariant (PRD §5.6):** every post-pilot surface sits behind an `enable_*` flag in
  `new_clinic_config`, **default OFF**. Flag OFF = 100% legacy behavior, no half-new chrome. The
  legacy stock screen stays reachable until the replacement passes parity sign-off. **Flags can
  graduate:** per the 2026-07-18 §5.6 amendment, nine settings were deleted after parity (comms hub,
  registry, office notes, S1 scheduling redesign, native history editor/full-form, history wrap,
  clinical-doc hub, encounter-note engine) — those surfaces are permanent, no fallback; the M17 hub
  opens any encounter and the native consult engine is the only engine.
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
  at **Start visit** (Take patient = queue claim only); complete-consult ≠ signed ≠ paid; **cash checkout
  at `ready_for_payment` only** (M5 cashier gate — no separate registration fee at `waiting` in V1); e-sign
  is compliance, never optional. Deep links into core set `$_SESSION['pid']`/`$_SESSION['encounter']`
  (wrong-patient prevention, G12).
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

Never claim "done" for backend PHP without `composer verify:new-clinic` passing, or for UI
without a build + asset version bump + a hard-refresh instruction. Full gate sequence
(frontend, backend, schema/ACL, browser smoke, sign-off smokes) lives in the `/verify-batch`
skill — invoke it after any batch of changes.

CI (`.github/workflows/new-clinic-verify.yml`) runs a scoped subset (static PHP verify +
scoped Vitest + Vite build) and does **not** replace `composer verify:new-clinic` — CI green
alone is never enough to claim done.

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

Moved to [`frontend/CLAUDE.md`](./frontend/CLAUDE.md) (2026-07-09, `/doctor` context cleanup) — it
loads automatically whenever a session touches files under `frontend/`, instead of being resident
in every session regardless of task. Covers: design tokens, feedback/callout conventions,
`WaitTimeSpan`/`QueueCard`, forms UX rules, regional formatting, A11y, and test/TS conventions.

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

**PRD wins conflicts.** `Documentation/NewClinic/done/NEW_CLINIC_V1_PRD.md` (canonical) →
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
- **Always talk in simple, plain English — this is a standing rule, not just for product
  questions.** Short sentences, everyday words, no file-name soup or jargon dumped into prose.
  Technical detail (file paths, service names, line numbers) belongs in code blocks or brief
  asides, not the main explanation. The user has flagged this repeatedly — do not let it slide
  back once a conversation gets technical.
- **Naming:** the product is "New Clinic", never "Ghana-this" in docs; neutral regional examples.
  Deliberate exception: the `NEW_CLINIC_PERSONA_*.md` role personas are setting-specific
  composites by design (see the README personas section).
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

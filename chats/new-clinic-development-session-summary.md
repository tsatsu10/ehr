# New Clinic Development Session — Summary

**Source:** Cursor agent chat (transcript `b0a2e23c-e44f-41be-b1aa-313c57a7d51d`)  
**Primary period:** June 27–28, 2026 (with follow-on work through July 2026 on the same branch)  
**Project:** OpenEMR — `oe-module-new-clinic`  
**Purpose:** Consolidated record of decisions, environment, outcomes, and open items — no code.

---

## 1. Environment

| Item | Value |
|------|--------|
| Host | Windows + XAMPP |
| Project path | `c:\xampp\htdocs\openemr` |
| App URL | http://localhost/openemr/ |
| phpMyAdmin | http://localhost/phpmyadmin |
| PHP | 8.2+ via XAMPP |
| MySQL | localhost:3306 (credentials in `sites/default/sqlconf.php`) |
| Module public URL | http://localhost/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/ |
| Primary pilot facility | Facility ID **3** |

### Admin credentials (local)

| User | Password | Notes |
|------|----------|--------|
| Adminstrator | passpass1 | Full admin |

### Pilot desk users (seed script)

| User | Role | Password |
|------|------|----------|
| reception_user | Reception | test_pass |
| nurse_user | Nurse / triage | test_pass |
| cashier_user | Cashier (includes Cashier Lead ACL for E2E zero-close) | test_pass |
| doctor_user | Doctor | test_pass |
| lab_user | Lab | test_pass |
| pharmacy_user | Pharmacy | test_pass |
| pharmacy_lead_user | Pharmacy lead (pharm ops smoke) | test_pass |

Seed command: run `acl/seed_pilot_users.php` from the module. OpenEMR requires users in the legacy `groups` table (e.g. Default), not only phpGACL — this was fixed during E2E setup.

---

## 2. Session arc (chronological themes)

### Phase A — Design system and UI/UX alignment

- Applied **NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md** to the module.
- Explored optional UI component MCPs (21st-dev/magic, magicuidesign, context7, exa, nano banana).
- Discussed **Tailwind/shadcn** migration timing: concluded shared primitives and island patterns should stabilize first; full shadcn cutover is a later pass (repo later moved toward shadcn-style components in some islands).
- Measured “readiness %” for design-system adoption multiple times as islands landed.

### Phase B — Pre-migration audit fixes

Issues flagged and addressed before or during early React work:

| ID | Topic | Outcome |
|----|--------|---------|
| M0-F16 | Appointment “Start visit & check in” | Wired scheduled integration; appointment chips on front desk |
| T1-F18 | Legacy chart context overlay on stock `patient_file` | Implemented optional strip on allowlisted stock pages |
| M2-F11 | Visit Board wall profile (`?profile=wall`) | Kiosk/wall mode added |
| Queue cards | `oe-nc-*` vs `nc-queue-card` styling | Unified queue card styling across desks |

Other recurring work: registration form (4-section accordion, dup panel, Save / Save & start visit), CSRF 403 on React POSTs, desk conflict interrupt banners, page heading Refresh/Updated toolbars, triage vs doctor refresh UI consistency.

### Phase C — React / Vite migration (Phase 0 → cutover)

1. **Phase 0** — Vite + React proof-of-concept (`visit-board-hello` badge); fixed Tailwind-vs-Bootstrap cascade (unlayered BEM CSS required).
2. **Phases 1–7** — Visit board, triage, doctor, cashier, lab, pharmacy, front desk islands.
3. **Post-pilot hubs** — Patient registry, daily reports, communications hub, admin hub, patient chart, lab ops, chart depth, bill ops.
4. **w50react cutover** — 21 legacy desk jQuery files removed; React is the only desk UI path.
5. **Phase 0 cleanup** — `visit-board-hello` and `enable_react_islands_dev` removed (June 28).

### Phase D — Session bridge (deep links)

Standalone navigation from New Clinic desks to stock OpenEMR pages failed when forms called `top.restoreSession()` outside `tabs/main.php`.

| Surface | Fix |
|---------|-----|
| Prescription save | Top shim in `library/restoreSession.php` + prescription template injection |
| Encounter / lab results / chart depth | Core pages + module `DeepLinkRestoreSessionService` on allowlisted routes |

### Phase E — Testing and verification

| Suite | Result (at migration milestone) |
|-------|----------------------------------|
| PHPUnit New Clinic | 349 pass, 4 skip |
| Vitest (`npm run check` in frontend) | 172–175 pass |
| Module pages smoke (Playwright) | 17/17 |
| Golden-path E2E (skip-pharmacy) | 1/1 (~1.2 min) |

E2E expanded later to: pharm dispense path, lab + close day, pharm ops hub smoke, login lockout smoke.

### Phase F — Repo hygiene

- Deleted ephemeral files: audit scratch MDs, debug PHP scripts, Playwright artifacts, Smarty cache.
- Updated `.gitignore` for `test-results/`, `playwright-report/`, `.playwright-mcp/`.
- Committed cursor rule: **big-picture-first** (global grep before partial fixes).
- Fax/SMS notify routes to comm hub when `communications_hub_enable` is on.

### Phase G — Documentation stack update

Updated MDs to reflect **React 19 + TypeScript + Vite** for New Clinic (vs core OpenEMR Knockout/jQuery): `CLAUDE.md`, `FRONTEND_MODULE_GUIDE.md`, `FRONTEND_2026_MODERNIZATION_PLAN.md`, UI/UX plan §2, PRD §7.3, module README, NEXT_STEPS, comms redesign appendix.

### Phase H — Post-chat evolution (same repo, July 2026)

Work continued after the June 28 migration closure in this chat:

- Additional islands: encounter-consult, clinical-doc, report-hub, scheduling, queue-bridge, pharm-ops, my-profile, and others (22+ island entry points).
- Security hardening track (SEC-1 through SEC-8): ACL matrix, CSRF audit logging, input validation, brute-force posture, PHI in exports/logs, TLS docs.
- Spec closure batches, service test coverage expansion, AjaxController handler extraction.
- Current asset version at time of this summary file: **20260709sec5**.

---

## 3. Technology stack (as documented after migration)

### New Clinic module

| Layer | Technology |
|-------|------------|
| Server | PHP 8.2+, Twig 3, Symfony events |
| Page shell | `PageController`, `#oe-nc-t1` module chrome |
| Desk / hub UI | React 19 + TypeScript |
| Build | Vite → `public/assets/modern/` |
| Shared runtime | `mountIsland`, `oeFetch`, design tokens in `frontend/src/core/` |
| Module JS (non-React) | `shell.js` + `ui-components.js` only (nav, role switch, queue stats) |
| Styles | Bootstrap 4.6 page chrome + island BEM (`--oe-nc-*` tokens); Tailwind used at build time, not as utility classes on OpenEMR pages |
| Tests | Vitest, PHPUnit, Playwright |

### Core OpenEMR (unchanged)

Knockout tab shell, jQuery, Angular 1.8, Bootstrap 4.6, Gulp themes — stock encounter, Rx, lab results pages remain legacy unless wrapped or deep-linked from module.

---

## 4. React migration — final state (June 28 milestone)

### Removed (21 legacy desk JS bundles)

Visit board, triage, doctor, cashier, lab, pharmacy, admin, communications hub, patient registry, patient chart, reports, chart depth (3), lab ops (3), registration form, patient search, vitals validation, modal a11y, and related desk scripts.

### Remaining intentional JS

- `shell.js` — mobile nav, role switch, queue stats poll
- `ui-components.js` — shared POST helpers, completion banner, queue utilities

### React islands (16 at cutover; 22+ in current tree)

**Desks:** visit board, triage, doctor, cashier, lab, pharmacy, front desk  

**Hubs:** admin, communications, patient registry, daily reports, patient chart, lab ops, chart depth, bill ops  

**Later additions (post-cutover):** encounter consult, clinical doc, report hub, scheduling, queue bridge, pharm ops, my profile, and related entry bundles.

### Kill-switch behavior

`enable_react_*` flags default **ON**. Turning one **OFF** shows a warning — **no jQuery fallback** (legacy desks deleted). Recommendation from chat: hide these from Clinic Setup admin UI; use **product** flags instead.

---

## 5. Feature flags — two layers

### Product flags (what admins should care about)

| Flag | Purpose |
|------|---------|
| enable_triage, enable_lab_role, enable_pharmacy_role | Which desks exist |
| enable_chart_depth (+ sub-flags) | Payment history, referrals, export |
| communications_hub_enable | Staff messages + reminders hub |
| enable_bill_ops | Billing back office (M14) |
| enable_admin_hub | Admin hub (M15) |
| enable_patient_registry | Cohort search (M10) |
| enable_pharm_ops, enable_lab_ops | Ops strips / hubs |

Default OFF for post-pilot features per PRD; enable per facility for pilot.

### React flags (migration scaffolding)

Obsolete for normal ops after w50react. Double-gating (e.g. `enable_bill_ops` **and** `enable_react_bill_ops`) adds no user value now.

---

## 6. Key git commits (migration-focused)

| Commit | Summary |
|--------|---------|
| 87afda2 | Deep-link session restore on stock pages |
| c31aa15 | Pilot user seed + module page smoke spec |
| 7e37306 | Golden-path E2E + pilot login fix (groups table) |
| e13fc13 | **feat: migrate module desks to React islands** (444 files) |
| b81037e | Ignore Playwright artifacts; remove tracked MCP logs |
| d473043 | Cursor big-picture-first rule |
| 607c81d | Fax/SMS notify → comm hub when enabled |
| 3a4f436 | Remove Phase 0 hello island + `enable_react_islands_dev` |

*(Many commits followed: M14 billing, audits, security, spec closure, encounter consult, etc.)*

---

## 7. Verification commands (reference)

| Check | Command location |
|-------|------------------|
| PHPUnit New Clinic | `vendor/bin/phpunit -c phpunit.xml --filter NewClinic` |
| Frontend | `cd frontend && npm run check && npm run build` |
| Golden path E2E | Playwright spec `golden-path.spec.js` with module playwright config |
| Module smoke | `module-pages-smoke.spec.js` |
| Island bundle smoke | `phase0-island-smoke.spec.js` (static assets, no login) |

---

## 8. Known issues encountered and resolved (chat)

| Issue | Resolution |
|-------|------------|
| CSRF 403 on React POSTs | `oeFetch` auto-injects `csrf_token_form` |
| `top.restoreSession is not a function` on Rx/encounter | Session bridge shims |
| Admin save not persisting `enable_chart_depth` at facility 3 | Config cascade / facility scope investigated |
| Triage queue empty but patient on visit board in triage | Facility/filter mismatch fixed in audit pass |
| Communications hub HTTP 500 | Fixed during migration (PHP/template error) |
| Registration form UX bugs | Dup panel, accordion, save flows hardened |
| Pilot user login failures | `groups` table membership + ACL seed |
| Phase 0 badge not green | Bootstrap beats Tailwind layers — switched to token-based BEM CSS |
| Visit board modal not opening | Fixed in Phase 1 audit |
| Desk conflict banners not matching 409 API | `deskConflict` aligned with `oeFetch` envelope |

---

## 9. Design system constraints (important)

- OpenEMR loads Bootstrap 4 as **unlayered** CSS; Tailwind utilities lose in cascade.
- Island components must use **non-layered BEM** + `var(--oe-nc-*)` tokens.
- Tokens align with `design-system/openemr-2026/MASTER.md` and UI/UX plan §3.
- Regional: DD/MM/YYYY dates; clinic currency from M6 (GHS pilot); no US-only labels when insurance off.

---

## 10. MCP tools referenced in session

| MCP | Use |
|-----|-----|
| 21st-dev/magic | UI component inspiration |
| magicuidesign | UI components |
| context7 | Library/docs lookup |
| exa | Search |
| nano banana | Image generation (not used for clinical UI) |
| playwright | E2E automation |

---

## 11. Documentation index (updated during session)

| Document | Role |
|----------|------|
| Documentation/NewClinic/README.md | Spec index |
| Documentation/NewClinic/NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md | UI/UX master; §2 tech stack |
| Documentation/NewClinic/FRONTEND_2026_MODERNIZATION_PLAN.md | Platform-wide modernization; New Clinic shipped |
| Documentation/FRONTEND_MODULE_GUIDE.md | How to build islands |
| frontend/README.md | Vite workspace |
| oe-module-new-clinic/README.md | Module install, stack, tests |
| oe-module-new-clinic/NEXT_STEPS.md | Pilot rollout checklist |
| oe-module-new-clinic/CODE_AUDIT_2026-06-27-REACT-MIGRATION.md | Migration audit trail |
| tests/e2e/new-clinic/README.md | E2E workflows and prep scripts |

---

## 12. Migration complete? — answer from chat

**Yes**, for the original scope (all module desks + hubs on React, legacy desk JS removed).

**Not the same as:**

- Core OpenEMR tab shell migration (still Knockout/jQuery)
- Hiding obsolete `enable_react_*` admin toggles
- Full PRD E2E (lab + pharmacy + close day) — partially added later
- Pilot rollout (enable product flags on facility 3, real users)
- Push/PR to remote

---

## 13. Recommended next steps (from end of session)

1. **Pilot rollout** — seed users, enable product flags on facility 3, run module smoke + golden path.
2. **Push + PR** — migration commits were local on `master` during chat.
3. **Admin UI cleanup** — remove or hide React kill-switch section.
4. **Extended E2E** — lab, pharmacy, bill ops close day (specs exist in later README).
5. **Hard refresh** after deploy — bump `ModuleAssetVersion` when shipping bundles.

---

## 14. User questions — direct answers captured

| Question | Answer |
|----------|--------|
| Are we done with migration? | Yes — React cutover complete; legacy desk JS gone. |
| Has legacy code been removed? | Desk jQuery yes (21 files); shell.js + ui-components.js remain by design. |
| Do we need React flags in Clinic Setup? | No for daily ops — product flags only; React flags are obsolete kill-switches. |
| What's next? | Pilot, PR, optional admin UI cleanup, extended E2E. |
| Can we do all Tailwind/shadcn after building? | Discussed: better after primitives stable; partial shadcn adoption came later. |

---

## 15. Asset version timeline (cache bust)

| Version | Milestone |
|---------|-----------|
| 20260626g12s | Pre-migration audit baseline |
| 20260628w54restore | Deep-link session bridge |
| 20260628w55cleanup | Phase 0 hello removed |
| 20260709sec5 | Current at summary write (security / batch builds) |

Always hard-refresh or bump version after `npm run frontend:build`.

---

*This file is a human-readable digest of the agent chat. For verbatim messages, see agent transcript `b0a2e23c-e44f-41be-b1aa-313c57a7d51d`.*

# Admin & Configuration — Redesign Specification (Clinic Setup, People, Forms, System)

| Field | Value |
|-------|--------|
| **Document version** | 0.1.7 |
| **Status** | Draft for review — **Module M6 + M15** integrated in PRD v1.20.32; PAGE_DESIGNS §7.27–§7.28; USER_WORKFLOWS §14.8; PRD §17.4.8 / §19.4 / §21.1v; **D-ADMIN-1–5 closed** |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md) (v1.20.32), [NEW_CLINIC_V1_PAGE_DESIGNS.md](../NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.37), [NEW_CLINIC_V1_USER_WORKFLOWS.md](../NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.37), [FRONTEND_2026_MODERNIZATION_PLAN.md](../FRONTEND_2026_MODERNIZATION_PLAN.md) |
| **Audience** | Product, design, clinic owners, IT implementers, trainers, QA |
| **Scope** | Everything under stock OpenEMR **Admin** menu that clinic owners touch after go-live — plus **M6 Clinic Admin** — unified for **private OPD clinics in Ghana and West Africa** |
| **Implementation** | Design spec only — no code in this document |
| **Primary market** | Private outpatient clinics — **West Africa** (Ghana launch region; extensible to Nigeria, Côte d'Ivoire, Senegal, etc.) |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Gap analysis — what M6 already covers](#2-gap-analysis--what-m6-already-covers)
3. [Current-state snapshot (stock OpenEMR)](#3-current-state-snapshot-stock-openemr)
4. [Pain points by surface](#4-pain-points-by-surface)
5. [UI/UX principles for admin & configuration](#5-uiux-principles-for-admin--configuration)
6. [How leading EHRs address these needs](#6-how-leading-ehrs-address-these-needs)
7. [West Africa & Ghana context](#7-west-africa--ghana-context)
8. [Information architecture — Admin Operations Hub](#8-information-architecture--admin-operations-hub)
9. [Lens: Clinic setup (M6)](#9-lens-clinic-setup-m6)
10. [Lens: People & access](#10-lens-people--access)
11. [Lens: Forms & clinical data design](#11-lens-forms--clinical-data-design)
12. [Lens: System health & platform](#12-lens-system-health--platform)
13. [Lens: Multisite & enterprise (NG7)](#13-lens-multisite--enterprise-ng7)
14. [Day-2 admin runbook (operational)](#14-day-2-admin-runbook-operational)
15. [Setup wizard & health dashboard](#15-setup-wizard--health-dashboard)
16. [Navigation, ACL & menu cutover](#16-navigation-acl--menu-cutover)
17. [Data model, APIs & audit](#17-data-model-apis--audit)
18. [Phasing & PRD alignment](#18-phasing--prd-alignment)
19. [Acceptance criteria](#19-acceptance-criteria)
20. [Closed decisions](#20-closed-decisions-prd-241)
21. [Document history](#21-document-history)
22. [Consistency audit pass](#22-consistency-audit-pass)
23. [Appendix A — Stock file map](#appendix-a--stock-file-map)
24. [Appendix B — User stories](#appendix-b--user-stories)
25. [Appendix C — Competitive reference matrix](#appendix-c--competitive-reference-matrix)
26. [Appendix D — Day-2 task frequency matrix](#appendix-d--day-2-task-frequency-matrix)

---

## 1. Purpose & positioning

### 1.1 What this document is for

New Clinic **Module M6 (Clinic Admin)** is well-specified for **clinic operational configuration**: fee schedule, visit types, queue toggles, currency, completion weights, reconciliation, and the **Apply cash clinic profile** preset (PRD §19, Appendix E; PAGE_DESIGNS §7.9).

That is necessary but **insufficient** for a Ghanaian or West African private clinic that:

- Has **one owner–manager** who is also reception lead, IT, and trainer
- Hires a new nurse mid-pilot and needs a **safe user account in 5 minutes**
- Must **unlock a signed consult note** after the doctor made a chart error
- Needs to know **“Is backup running?”** without reading Apache logs
- Opens stock **Admin → Config** and sees **400+ globals** built for US ambulatory + insurance

PRD **§17.4** provides an excellent **Module Manager install runbook** (steps 1–12, plus slice checklists §17.4.1–§17.4.7). PRD **§24.4** closes **pilot worksheet Q4–Q9** at install time. **Neither** covers **day-2 through day-90** admin work: staff turnover, form tweaks, backup verification, audit review, fee price updates at year-end, or multisite roll-out (NG7).

This spec defines the **Admin Operations Hub (M15)** — a unified admin shell that:

| Layer | Question it answers |
|-------|---------------------|
| **M6 Clinic setup** | “What are our prices, visit types, and workflow toggles?” |
| **People & access** | “Who works here and what can they do?” |
| **Forms & data design** | “Which forms appear on encounters and what fields do we capture?” |
| **System health** | “Is the system backed up, healthy, and auditable?” |
| **Multisite (NG7)** | “How do we roll out site 2 without cloning mistakes?” |

**Training one-liner:** *Clinic Admin for how the clinic runs; Admin Hub for who can log in, what forms they see, and whether the system is healthy.*

### 1.2 Problem statement

> A clinic owner completes the pilot worksheet, runs §17.4 install steps, and trains staff. On **week 3**, the receptionist resigns. The owner opens **Admin → Users**, lands in a 780-line legacy form, assigns the wrong GACL group, and the new hire can see **Billing Manager** and **EDI** screens that PRD §19 intended to hide. There is no in-product checklist for “add user safely,” no health summary for backups, and no runbook for “doctor needs note unlocked.” Staff blame “OpenEMR is complicated” — when the real gap is **admin UX and operational documentation**, not clinical desks.

### 1.3 Positioning vs other surfaces

| Surface | Question | Relationship to M15 |
|---------|----------|---------------------|
| **M6 Clinic Admin** (`admin.php`) | “Configure clinic workflow & money” | **Lens 1** inside hub — not duplicated |
| **Module Manager** (core) | “Install/upgrade module SQL & ACL” | **Link-out** from Setup wizard step 1; not rebuilt |
| **M7 Daily Reports** | “How did today go?” | Read-only widgets on **Health** lens; M6 reconciliation |
| **M12/M13 setup wizards** | “Stand up lab/pharmacy bench” | Linked from M6 **Integrations** tab when flags ON |
| **M14 Billing back office** | “Fix money after checkout” | Separate hub (V1.2-BILL); linked from M6 Fees tab |
| **Stock Admin menu** | “Everything OpenEMR ever built” | **Hidden** for `new_admin` when hub enabled; **Advanced** escape hatch |

**Design decision (proposed D-ADMIN-1):** M6 = **clinic policy & commercial config**. M15 = **people, forms, platform, runbooks**. Stock `edit_globals.php` remains **super-admin Advanced** only — never the default owner path.

---

## 2. Gap analysis — what M6 already covers

| Capability | M6 (spec’d) | Stock Admin (today) | M15 gap |
|------------|-------------|----------------------|---------|
| Fee schedule CRUD | M6-F01, §7.9.7 | Codes / superbill (super) | CSV import wizard (V1.1); link to M14 corrections |
| Visit types → `pc_catid` | M6-F02, §7.9.6 | Calendar categories (Admin → Clinic) | Calendar category sync helper in visit-type drawer |
| Queue / lab / pharm toggles | M6-F03, §7.9.8 | Globals + M6 | Dependency validation (M6-F22–F25) — **in M6** |
| Currency (D-REG-3) | M6-F27, §7.9.4 | `gbl_currency_symbol` in globals | Single source — **in M6** |
| Cash clinic profile | M6-F07, Appendix E | 30+ globals scattered | **In M6** — hub shows profile status chip |
| Completion weights | M6-F08–F10, §7.9.10 | None in module | **In M6** |
| Receipt / queue slip | M6-F05/F12, §7.9.9 | Globals | **In M6** |
| Reconciliation | M6-F13, §7.9.12 | Cron + M7 | **In M6** + Health lens last-run |
| Role summary + ACL links | M6-F06, §7.9.5 | Users + ACL separate | **People lens** — actionable wizard |
| User CRUD | — | `usergroup_admin.php` | **People lens** — simplified + safe defaults |
| ACL editing | — | `adminacl.php` | Summary in M6; **edit in People lens** with guardrails |
| Address book | — | `addrbook_list.php` | People lens — referral contacts |
| Forms registry | — | `forms_admin.php` | **Forms lens** |
| Layout editor | — | `edit_layout.php` (2,231 lines) | Forms lens — **guided** + Advanced |
| List options | — | `edit_list.php` (1,532 lines) | Forms lens — common lists only |
| Backup | — | `backup.php` (1,087 lines) | **Health lens** — status + run now |
| Logs / audit | — | `logview.php`, tamper report | Health lens — filtered views |
| Diagnostics | — | Calendar testSystem | Health lens — preflight panel |
| API clients | — | `smart/admin-client.php` | Health lens — hidden unless API enabled |
| Multisite files | — | `manage_site_files.php` | **NG7** Multisite lens |
| Day-2 runbook | — | §17.4 install only | **§14** — **new** |
| Setup health score | — | None | **§15** — % complete dashboard |

**Conclusion:** M6 solves **“configure the clinic product.”** M15 solves **“run the clinic’s OpenEMR instance safely after go-live.”**

---

## 3. Current-state snapshot (stock OpenEMR)

Audited against OpenEMR 7.x tree in this workspace (`standard.json` Admin menu, `interface/usergroup/`, `interface/super/`, `interface/forms_admin/`).

### 3.1 Admin menu structure (`interface/main/tabs/menu/menus/standard.json`)

```text
Admin
├── Config                    → edit_globals.php          (super only — 811 lines)
├── Clinic ▾
│   ├── Facilities            → facilities.php
│   ├── Calendar              → PostCalendar modifyconfig
│   └── Import Holidays       → import_holidays.php
├── Patients ▾
│   ├── Patient Reminders     → (CDR — global gated)
│   ├── Merge Patients
│   └── Manage Duplicates
├── Practice ▾
│   ├── Practice Settings
│   ├── Rules / Alerts        → (CDR — disabled in cash profile)
├── Coding ▾
│   ├── Codes / Native loads / …
├── Forms ▾
│   ├── Forms Administration  → forms_admin.php
│   ├── Layout-Based Forms    → edit_layout.php
│   ├── List Options          → edit_list.php
│   └── …
├── System ▾
│   ├── Backup                → backup.php
│   ├── Files                 → manage_site_files.php
│   ├── Language
│   ├── Certificates
│   ├── Logs                  → logview.php
│   ├── Audit Log Tamper
│   ├── Diagnostics
│   └── API Clients           → smart/admin-client.php
├── Users                     → usergroup_admin.php       (696 lines)
├── Address Book              → addrbook_list.php
└── ACL                       → adminacl.php              (618 lines, heavy AJAX)
```

**New Clinic today:** `oe-module-new-clinic` is a **stub** (`version.php` only). M6 `admin.php` is **not started** (PRD §5.6). Clinic admin still uses stock Admin for everything except future module routes.

### 3.2 Users & groups (`interface/usergroup/`)

| File | Lines (approx.) | Role |
|------|----------------:|------|
| `usergroup_admin.php` | 696 | User list, add/edit user, GACL group assignment, MFA hooks, emergency login email |
| `adminacl.php` | 618 | php-gacl group membership + ACO matrix — AJAX via `adminacl_ajax.php` |
| `addrbook_list.php` / `addrbook_edit.php` | — | External providers, labs, pharmacies, specialists |
| `facilities.php` | — | Facility CRUD — relevant when `login_into_facility` ON |
| `facility_user.php` | — | User ↔ facility mapping (multi-facility) |
| `mfa_*.php` | — | TOTP/U2F registration |

**Integration with New Clinic:** PRD §4.2.1 defines **`new_*` + `new_*_lead` groups** created by `acl/acl_setup.php`. Stock user admin assigns groups by name — **no clinic-friendly role labels**, no warning when assigning `Administrators` or missing `new_cashier`.

### 3.3 Forms & layouts (`interface/forms_admin/`, `interface/super/`)

| File | Lines (approx.) | Role |
|------|----------------:|------|
| `forms_admin.php` | 247 | Enable/disable/register forms; priority, category, ACO |
| `edit_layout.php` | 2,231 | Layout-Based Form designer — demographics, LBF encounter forms |
| `edit_list.php` | 1,532 | List options (dropdown values) — note types, message status, etc. |
| `edit_globals.php` | 811 | All globals — US-centric defaults |

**New Clinic dependency:** Consult note (`soap` or configured `consult_note_formdir`), ancillary **`lab_intake`** / **`pharmacy_service`** LBF (§17.3 step 8), E-Sign globals (Appendix E).

### 3.4 System & platform

| File | Lines (approx.) | Role |
|------|----------------:|------|
| `backup.php` | 1,087 | mysqldump backup — requires shell `safe_mode` off |
| `logview/logview.php` | 505 | Application log viewer |
| `manage_site_files.php` | 349 | Multisite document tree upload |
| `smart/admin-client.php` | — | FHIR/SMART API client registration |

**Cron (module):** PRD §16.2 — `bin/reconcile.php`, `bin/phone-backfill.php`, optional `bin/eod-sweep.php`. Documented in M6 Cron tab (PAGE_DESIGNS §7.9.12) but **no stock backup schedule integration**.

### 3.5 Multisite (`sites/{site_id}/`)

| Topic | Rule (PRD §11.5) |
|-------|------------------|
| Site bootstrap | All data site-scoped; CLI cron `-site=default` |
| Session facility | `$_SESSION['facilityId']` when `login_into_facility` |
| Config | `new_clinic_config` keyed by `facility_id` |
| NG7 | Multi-facility **enterprise roll-out tooling** — non-goal for V1 pilot |

---

## 4. Pain points by surface

### 4.1 Global config (`edit_globals.php`)

| Pain | Impact (West Africa private OPD) |
|------|----------------------------------|
| 400+ settings in flat/search UI | Owner changes wrong global; breaks calendar or E-Sign |
| US insurance / EDI / CDR defaults visible | Training noise; “Is NHIS configured?” confusion (NG1: cash V1) |
| No concept of **profile** beyond manual checklist | Cash clinic profile (Appendix E) exists in PRD but only as M6 button — not yet built |
| Super-admin only | Owner delegates to “tech nephew” — over-privileged |
| No audit diff per field in friendly UI | `new_config_log` for module; globals changes in core audit only |

### 4.2 Users & ACL (`usergroup_admin.php`, `adminacl.php`)

| Pain | Impact |
|------|--------|
| **Technical group names** (`new_reception`, `Emergency Login`) | Wrong group → wrong desk or billing access |
| Users and ACL on **separate menu items** | Owner assigns user without verifying ACL section `new_clinic` |
| No **role template** (“Reception starter”) | Each hire is manual multi-select |
| Non-super cannot assign super groups — good — but no **Clinic admin** scoped editor | Owner needs full super for simple hire |
| MFA setup scattered | Security best practice hard on shared clinic PC |
| Address book disconnected from user creation | Referral letter contacts not linked to workflow |
| No **deactivate user** vs delete guidance | Auditors want inactive flag, not row delete |
| Facility assignment (`facility_user`) invisible on user form | Multi-site IDOR risk (PRD §11.5) |

### 4.3 Forms administration

| Pain | Impact |
|------|--------|
| Three tools (registry, layout, lists) with **no workflow** | Owner disables `fee_sheet` but breaks M5-F10 correction path |
| `edit_layout.php` is a **power-user IDE** | One wrong required field blocks cashier payment gate |
| No **New Clinic form bundle** visibility | Ancillary LBF install (§17.3) invisible until Layout search |
| Form unlock for signed notes **outside module** (PRD §6.1l) | Manager doesn’t know path: Administration → encounter forms |
| List options (note types, message status) affect COM hub | Renaming list breaks Communications filters |

### 4.4 System (backup, logs, diagnostics)

| Pain | Impact |
|------|--------|
| Backup is **manual page** — no “last success” on dashboard | Ghana clinics lose data after disk failure — common pain in region |
| Logs require reading English stack traces | Owner cannot self-serve |
| Diagnostics buried under Calendar admin URL | Never run before go-live |
| API Clients visible but **irrelevant** for cash clinic | Noise |
| No unified **health check** with module cron status | M6 Cron tab spec’d but not built; backup separate |
| phpMyAdmin link (global) | Cash profile sets `disable_phpmyadmin_link=1` — good — but no replacement self-service |

### 4.5 Multisite / NG7

| Pain | Impact |
|------|--------|
| Site creation is **manual** (copy `sites/default`, edit `sqlconf.php`) | Franchise roll-out error-prone |
| No **config export/import** for M6 settings | Second branch re-enters fee schedule manually |
| `manage_site_files.php` is raw file upload | Logo upload should be M6 Clinic tab — already spec’d |
| Enterprise reporting across sites | NG7 deferred — but owners ask early |

### 4.6 Process gaps (documentation)

| Pain | Impact |
|------|--------|
| §17.4 covers **install** only | No canonical **day-2** tasks |
| §24.4 worksheet closes Q4–Q9 | No guidance for **month 2** price change, staff leave, form unlock |
| USER_WORKFLOWS §14.1 lists tasks but **no step-by-step** | Trainer material incomplete |
| Module slice runbooks (§17.4.4–7) excellent | Lab/pharm/bill only — not users/backup |

---

## 5. UI/UX principles for admin & configuration

Aligned with Communications Hub (COM §4), Billing Back Office (M14 §5), Patient Registry (M10 §3), and T1 shell (PAGE_DESIGNS §2).

| ID | Principle | Admin application |
|----|-----------|-------------------|
| **A1** | **Owner language, not informatics language** | “Reception desk” not `new_reception`; “Can take payments” not `acct/bill` |
| **A2** | **Safe defaults over full control** | Role templates pre-select `new_*` groups; warn before superuser |
| **A3** | **Progressive disclosure** | 80% tasks in hub; **Advanced (OpenEMR)** link with ⚠ banner |
| **A4** | **Checklists beat encyclopedias** | Setup wizard + day-2 runbook as in-product tasks |
| **A5** | **Health at a glance** | Green/amber/red: backup, cron, reconciliation, disk, PHP version |
| **A6** | **Every write audited** | Extend `new_config.changed` pattern to people/forms actions |
| **A7** | **Validate before save** | M6 dependency rules (F22–F25); user must have ≥1 desk group |
| **A8** | **Mobile-aware but desktop-first** | Admin on owner laptop; tablet OK for health check |
| **A9** | **Ghana-realistic connectivity** | Optimistic saves, clear offline message, no heavy page reload |
| **A10** | **One product shell (T1)** | Hub uses TopBar, tabs, cards — not 1990s admin frames |
| **A11** | **Separation of duties** | Lead groups for overrides; solo bench = base+lead (D-STAFF-1) |
| **A12** | **Never fork core ACL engine** | Façade + links; php-gacl remains source of truth |

---

## 6. How leading EHRs address these needs

Patterns from mature ambulatory EHRs (Epic Hyperspace admin, Cerner PowerChart admin, athenahealth **athenaNet** admin, OpenMRS **Bahmni** implementer interface, **Helium Health** / **mPharma** regional SaaS). **Not** feature parity — UX pattern library.

| Need | Typical pattern | New Clinic mapping |
|------|-----------------|-------------------|
| **Initial go-live setup** | Implementation wizard: org → users → services → fees | **§15 Setup wizard** (M6 + M15); PRD §17.4 steps |
| **Role-based provisioning** | Role catalog maps to permissions bundle | **People lens** role templates → `new_*` groups |
| **Fee / service catalog** | Package pricing, not CPT obsession | **M6 Fees tab** + OPD starter CSV |
| **Form customization** | Template library + limited field editor | **Forms lens** — enable bundles; Advanced layout |
| **User lifecycle** | Invite → activate → deactivate | People lens; MFA optional P1 |
| **Audit & compliance** | Admin action log + break-glass report | Health lens + M7 override reports |
| **Backup / DR** | Automated + last-run indicator | Health lens; XAMPP/hosting doc link |
| **Multi-location** | Site clone + central policy | **NG7 Multisite lens** (V2) |
| **Support mode** | Read-only diagnostics export | Health **Support bundle** download (logs redacted) |
| **Training mode** | Sandbox patients flagged | Defer V1.1-OPS |

**Bahmni / OpenMRS (regional public sector):** Strong **implementer** tools — good for IT firms, heavy for 1-person clinic. New Clinic targets **owner-operators** with optional IT partner.

**Regional private SaaS (West Africa):** Often **hide** all admin behind vendor — clinic calls support for price changes. New Clinic differentiation: **self-service M6** + guided hub, local ownership (PRD positioning Appendix C).

---

## 7. West Africa & Ghana context

### 7.1 Staffing & literacy

| Factor | Design response |
|--------|-----------------|
| **1–2 admin staff** wearing many hats | Hub checklists, role templates, health dashboard |
| **High turnover** (reception, locum doctors) | 5-minute **Add staff** wizard; deactivate not delete |
| **Variable digital literacy** | Plain language, Twi/French i18n via OpenEMR language module (link) |
| **Shared clinic PC** | MFA optional; session timeout globals in Advanced only |
| **Locum / visiting specialist** | Address book + temporary user with expiry (P2) |

### 7.2 Regulatory & identity (Ghana-focused, region-aware)

| Topic | V1 stance |
|-------|-----------|
| **NHIS** | Optional patient profile ref; **no claims admin** in V1 (NG1) — hide insurance admin from hub |
| **Ghana Card / national ID** | Capture in Front Desk Section 2 + MRD Profile — not admin hub |
| **Region & district** | M6 seeds `ghana_regions_districts.json`; dependent dropdowns at registration (Section 2) — [FRONT_DESK_REGISTRATION §9](./NEW_CLINIC_V1_FRONT_DESK_REGISTRATION_REDESIGN.md#9-ghana-region--district-model) |
| **Data Protection Act 2012 (Act 843)** | Audit logs, access control, backup — Health lens evidence |
| **Medical council license #** | User field `state_license_number` — show on Rx print |
| **Facility registration** | M6 clinic name + receipt footer TIN (optional field P1) |

### 7.3 Infrastructure reality

| Topic | Design response |
|-------|-----------------|
| **XAMPP on Windows** (common dev/small deploy) | Backup wizard documents mysqldump + copy `sites/` |
| **Unreliable power** | UPS hint on Health lens; cron catch-up on reconcile |
| **Mobile money** | Payment method labels — NG9; not admin hub core |
| **Single currency** | M6 D-REG-3 — GHS default in cash profile |
| **Internet downtime** | Admin hub works on LAN; external SMS/API shows degraded |

### 7.4 Commercial patterns

| Pattern | Admin implication |
|---------|-------------------|
| **Year-end fee increase** | M6 Fees tab bulk edit + audit; train in §14.4 |
| **New service (e.g. ultrasound)** | Add fee line + visit type optional |
| **Second branch** | NG7 export M6 config JSON (V2) |
| **External lab send-out** | No lab role; disable M8 menu via M6 |

---

## 8. Information architecture — Admin Operations Hub

### 8.1 Two-module model (proposed)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Admin Operations Hub (M15) — shell + people + forms + system + NG7      │
│  ┌─────────────┬──────────────┬─────────────┬──────────────┬────────┐ │
│  │ Clinic setup│ People &     │ Forms &     │ System       │ Multi- │ │
│  │ (M6 embed)  │ access       │ data        │ health       │ site*  │ │
│  └─────────────┴──────────────┴─────────────┴──────────────┴────────┘ │
│  * NG7 tab visible only when multisite_enabled + super-admin             │
└─────────────────────────────────────────────────────────────────────────┘
```

| Module | Route | ACL |
|--------|-------|-----|
| **M15 Hub shell** | `…/public/admin-hub/index.php` | `new_clinic_config_admin` OR core `admin/users` (scoped) |
| **M6 Clinic setup** | `…/public/admin.php` (embedded iframe or shared tab router) | `new_clinic_config_admin` |
| **People** | `…/public/admin-hub/people.php` | `admin/users` + module admin |
| **Forms** | `…/public/admin-hub/forms.php` | `admin/forms` + module admin |
| **System** | `…/public/admin-hub/system.php` | `admin/super` OR delegated **system operator** (P2) |
| **Runbooks** | `…/public/admin-hub/runbooks.php` | `new_admin` read; super for NG7 |

**Alternative (Phase 1 minimal):** Single `admin.php` with **extra top-level tabs** instead of separate M15 module — merge into M6 shell. **Recommended:** separate hub route for clearer menu cutover.

### 8.2 Hub shell wireframe

```text
┌─ T1 TopBar ───────────────────────────────────────────────────────────────┐
│ Admin & Configuration          Health: ● OK  │  Setup: 92%  │ [ Runbooks ] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [ Clinic setup ] [ People ] [ Forms ] [ System ] [ Multisite* ] [ Runbooks ]│
├─────────────────────────────────────────────────────────────────────────────┤
│ (active lens content)                                                       │
│                                                                             │
│ Footer: Advanced → stock OpenEMR admin ⚠  ·  Documentation ↗              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Health summary chip (header)

Aggregates:

| Signal | Source | Amber when |
|--------|--------|------------|
| Backup | last `backup.log` or host cron | >7 days |
| Reconciliation | `new_reconciliation_run` | last run failed or stale |
| Phone backfill | `phone_backfill_complete` | =0 after 30 days |
| Cron | §16.2 heartbeat file | missed 2 intervals |
| Disk free | PHP `disk_free_space` | <10% on documents volume |
| OpenEMR version | core | below PRD minimum (Q7) |

### 8.4 Setup completeness score

Weighted checklist (§15) — drives **Setup: 92%** chip. Unblocks go-live sign-off with PRD §21.

---

## 9. Lens: Clinic setup (M6)

**Normative detail:** PAGE_DESIGNS **§7.9** — not duplicated here.

### 9.1 Enhancements for this redesign

| ID | Enhancement | Priority |
|----|-------------|----------|
| M6-UX-01 | **Integrations** sub-tab: links to M12/M13 setup wizards when flags ON; greyed when OFF with worksheet hint | P1 |
| M6-UX-02 | **Pilot worksheet import** — paste/sign PDF checklist → auto-set Q4–Q9 keys (§24.4) | P1 |
| M6-UX-03 | **Config snapshot export** JSON (facility-scoped) for NG7 branch clone | P2 (NG7) |
| M6-UX-04 | **Fee schedule CSV import** (M6-F01 bulk — already V1.1 in PAGE_DESIGNS) | P1 |
| M6-UX-05 | **Profile badge** on Clinic tab: Cash clinic profile ON/OFF with diff vs Appendix E | P0 |
| M6-UX-06 | **Danger zone** accordion: reset receipt counter, recompute all completion, disable module | P0 |

### 9.2 Tab map (unchanged from PAGE_DESIGNS §7.9.3)

`Clinic | Roles & ACL summary | Visit types | Fees | Queue | Receipts | Completion | Reports config | Cron / jobs | About`

**Roles & ACL tab** remains **read-only summary + deep links** into People lens (not duplicate ACL editor).

---

## 10. Lens: People & access

### 10.1 Purpose

Safe **staff lifecycle** aligned with PRD §4.2, §4.2.1, D-STAFF-1.

### 10.2 Sub-views

| View | Replaces / wraps |
|------|------------------|
| **Staff directory** | `usergroup_admin.php` list |
| **Add staff wizard** | Multi-step: identity → role template → groups review → facility → login test |
| **Access summary** | Per-user: desk apps + `new_clinic` ACL keys effective |
| **Address book** | `addrbook_list.php` — referral labs, hospitals, specialists |
| **Facilities** | `facilities.php` + `facility_user.php` when multi-facility |

### 10.3 Role templates (V1)

Maps to GACL groups — **does not replace** php-gacl.

| Template | Desk app | Groups assigned | Notes |
|----------|----------|-----------------|-------|
| **Reception** | `front_desk` | `new_reception` | + `new_reception_lead` if checkbox “Lead” |
| **Nurse** | `triage` | `new_nurse` | + lead optional |
| **Doctor** | `doctor` | `new_doctor` | Requires NPI/license field prompt (Ghana: MD license) |
| **Lab technician** | `lab` | `new_lab` + `new_lab_lead` if solo bench (D-STAFF-1) | Warn if lab role OFF in M6 |
| **Pharmacist** | `pharmacy` | `new_pharmacy` + lead if solo | Warn if pharmacy OFF |
| **Cashier** | `cashier` | `new_cashier` | + lead for manager |
| **Clinic owner / admin** | `clinic_admin` | `new_admin` | Block if user lacks core admin |
| **Read-only manager** | `reports` | Custom: M7 only | P2 |

**Wizard step — review:**

```text
This user will:
  ✓ Land on Front Desk after login
  ✓ Create patients and start visits
  ✗ Post payments (assign Cashier template to enable)
  ✗ Change fee schedule (Clinic admin only)
```

### 10.4 ACL guardrails

| Rule | Behavior |
|------|----------|
| Non-super cannot grant `Administrators` | Existing core rule — surface friendly error |
| Assigning `new_admin` requires reason + audit | `admin_hub.user_promoted` |
| Removing last `new_admin` | Block |
| User with no `new_*` group | Warn: “No clinic desk access” |
| Emergency Login group | Hidden from templates; separate Advanced |

### 10.5 Address book (Ghana context)

| Field | Use |
|-------|-----|
| Organization | Korle Bu, external lab, community pharmacy |
| Type | Specialist / Lab / Pharmacy / Hospital |
| Phone | Click-to-call on referral print (M11) |
| Region | Greater Accra / Ashanti — optional filter P2 |

### 10.6 Wireframe — Staff directory

```text
┌─ People ────────────────────────────────────────────────────────────────────┐
│ [ Staff ] [ Address book ] [ Facilities ]              [ + Add staff ]      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Search name…    Role: [ All ▾ ]   Status: [ Active ▾ ]                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Name           Role template    Desks          Last login    Actions    │ │
│ │ Akosua Mensah  Reception      Front Desk     Today 08:12   [⋯]        │ │
│ │ Dr. Kofi Asante Doctor          Doctor         Today 07:55   [⋯]        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

Row actions: Edit · Reset password · Deactivate · View access summary

### 10.7 AJAX API (sketch)

| Action | Notes |
|--------|-------|
| `staff.list` | Paginated; masks password fields |
| `staff.create` | Wraps `UserService` + group assign |
| `staff.deactivate` | Sets `active=0` |
| `staff.access_summary` | Effective ACL for `new_clinic` section |
| `addrbook.*` | CRUD proxy to existing tables |

All writes: CSRF + audit per §17.2 (`admin_hub.staff_created`, `admin_hub.staff_deactivated`, `admin_hub.role_template_applied`).

---

## 11. Lens: Forms & clinical data design

### 11.1 Purpose

Clinic owner controls **which forms appear** without breaking M5/M4/M8/M9 gates.

### 11.2 Sub-views

| View | Purpose |
|------|---------|
| **Form catalog** | Registered forms — enable/disable (wraps `forms_admin.php`) |
| **Clinic form bundle** | New Clinic required forms status board |
| **Demographics layout** | Link to layout editor — **guided** subset (completion fields only) |
| **List options (common)** | Message status, note types, visit cancel reasons |
| **Advanced** | Full `edit_layout.php`, `edit_list.php` |

### 11.3 Clinic form bundle status board

| Form | formdir | Required for | Status |
|------|---------|--------------|--------|
| Consult note | `soap` (config) | M4 Complete / M5 pay | ✓ installed, E-Sign OK |
| Lab intake | `lab_intake` | M8 Lab complete | ⚠ missing — run §17.3 step 8 |
| Pharmacy service | `pharmacy_service` | M9 Pharm complete | ✓ |
| Vitals | `vitals` | M3 | ✓ core |

Actions: **Install module forms** · **Test E-Sign on staging encounter**

### 11.4 Safe editing rules

| Rule | Rationale |
|------|-----------|
| Cannot disable `vitals` while triage ON | M3-F05 |
| Cannot disable consult note formdir while doctors enabled | Payment gate |
| Warn before enabling `fee_sheet` for clinic roles | PRD §19 hides Fees — use M5/M14 |
| Layout changes to phone fields | May affect M1a search — show banner |

### 11.5 Signed form unlock (operational path)

In-product **Runbook card** (not new UI):

> **Clinical correction on signed note** → Core: Patient chart → encounter → form → Admin unlock (requires manager). Do **not** use Reopen consult to rewrite note (PRD §6.1l).

Link: stock encounter form admin (Advanced).

---

## 12. Lens: System health & platform

### 12.1 Purpose

Owner answers: **“Is our system healthy?”** without SSH.

### 12.2 Sub-views

| View | Wraps |
|------|-------|
| **Overview** | Health chips + quick actions |
| **Backup** | `backup.php` + schedule instructions |
| **Logs** | Filtered `logview` — last 24h errors |
| **Audit** | Link tamper report + M7 override reports |
| **Cron & jobs** | M6 cron tab + host crontab helper |
| **Diagnostics** | PHP version, DB connection, file perms, calendar test |
| **API & integrations** | SMART clients — hidden unless `rest_api` enabled |
| **Support bundle** | Zip logs (redacted) + version info for vendor ticket |

### 12.2.1 Backup (Ghana / XAMPP note)

| Deployment | Guidance shown in UI |
|------------|---------------------|
| **XAMPP Windows** | Schedule `mysqldump` + robocopy `sites/default` to external drive |
| **Linux VPS** | cron + off-site sync (S3-compatible P2) |
| **Hosted by IT partner** | “Contact partner” card — read-only status |

### 12.2.2 Backup ACL (D-ADMIN-2)

| Rule | V1.1-ADMIN |
|------|------------|
| **Run backup now** | Requires core OpenEMR **`admin` super** **and** module `new_admin_hub_system` |
| **UI when blocked** | Button disabled; help text: “Backup requires administrator access — ask your IT partner or use Advanced → Backup” |
| **Health chip** | Read-only last-run status visible to all `new_admin_hub` users |
| **P2 relaxation** | Optional: hub-only ACL without core super — security review required |

### 12.3 Config export (D-ADMIN-5)

M15-F13 exports **facility-scoped M6 keys as JSON** (fee schedule, visit types, toggles) for NG7 branch prep — not a full SQL site dump.

**V1:** Manual “Run backup now” + log last result. **V1.1-OPS:** email on failure.

### 12.4 Wireframe — System overview

```text
┌─ System health ─────────────────────────────────────────────────────────────┐
│ ● All critical checks passed                          Last checked: 2 min ago │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ Backup       │ │ Reconcile    │ │ Disk space   │ │ PHP 8.2      │        │
│ │ ● 1d ago     │ │ ● OK 23:55   │ │ ● 45% free   │ │ ● Supported  │        │
│ │ [Run now]    │ │ [Run now]    │ │              │ │              │        │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
│ Recent errors (24h): 0    │    OpenEMR 7.0.3    │    Module 0.1.0           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Lens: Multisite & enterprise (NG7)

**PRD NG7:** Multi-facility enterprise roll-out tooling — **post-V1**.

### 13.1 V2 scope (design now, build later)

| Feature | Description |
|---------|-------------|
| **Site template export** | M6 config JSON + fee schedule + visit types |
| **Site bootstrap wizard** | New `sites/{id}` checklist |
| **Central policy push** | Optional read-only fee floor |
| **Cross-site reports** | Defer — not V1 |
| **Facility switcher** | Already PRD §11.5 — hub documents |

### 13.2 V1 stub (visible to super only)

- Link to `manage_site_files.php` (Advanced)
- Documentation card: “Second branch — contact implementer”
- Export M6 config JSON (manual NG7 prep)

---

## 14. Day-2 admin runbook (operational)

**Closes the gap** after PRD §17.4 (install) and §24.4 (worksheet Q4–Q9).

Rendered **in-product** as Runbooks lens with searchable cards. Normative text below.

### 14.1 Runbook index

| ID | When | Task | Lens |
|----|------|------|------|
| **RB-01** | Day 2 | Verify backup ran | System |
| **RB-02** | Day 2 | Reconcile yesterday | M6 / M7 |
| **RB-03** | Day 2 | Review open visits EOD widget | M7 |
| **RB-04** | Week 1 | Wrong-patient drill refresh | Training log |
| **RB-05** | Any | Add new receptionist | People |
| **RB-06** | Any | Doctor locum account | People |
| **RB-07** | Any | Deactivate leaving staff | People |
| **RB-08** | Any | Reset forgotten password | People |
| **RB-09** | Monthly | Update fee prices | M6 Fees |
| **RB-10** | Any | Add new fee line / service | M6 Fees |
| **RB-11** | Any | Unlock signed clinical note | Forms / Advanced |
| **RB-12** | Any | Merge duplicate patients | Advanced link |
| **RB-13** | Post-pilot | Enable lab ops hub | M6 + §17.4.4 |
| **RB-14** | Post-pilot | Enable pharmacy ops | M6 + §17.4.5 |
| **RB-15** | Post-pilot | Enable billing back office | M6 + §17.4.7 |
| **RB-16** | Quarterly | Review override audit | M7 |
| **RB-17** | Quarterly | Review user access | People |
| **RB-18** | Yearly | Renew SSL / certificates | System |
| **RB-19** | Any | Restore from backup (disaster) | System + doc |
| **RB-20** | Module upgrade | Run Upgrade SQL | Module Manager link |

### 14.2 RB-05 — Add new receptionist (canonical)

| Step | Action | Verify |
|------|--------|--------|
| 1 | People → **Add staff** | Wizard opens |
| 2 | Enter name, username, password | — |
| 3 | Select template **Reception** | Groups `new_reception` checked |
| 4 | If lead: check **Lead** | Adds `new_reception_lead` |
| 5 | Login app = **Front Desk** | §11.3 apps |
| 6 | Save | Audit row |
| 7 | User logs in — lands Front Desk | Search works |
| 8 | Trainer: 15 min walkthrough | Training log |

**Do not** assign `Administrators` or `admin` super.

### 14.3 RB-09 — Update fee prices (monthly / year-end)

| Step | Action | Verify |
|------|--------|--------|
| 1 | M6 → **Fees** tab | — |
| 2 | Export CSV backup (V1.1) or screenshot | Audit trail |
| 3 | Edit **Default price** column | Receipt preview uses `formatMoney()` |
| 4 | Save | `new_config.fee_schedule_changed` |
| 5 | Cashier desk: spot-check one visit | Total matches |

**Ghana note:** Communicate price changes to front desk **before** save — no retroactive change to open visits.

### 14.4 RB-11 — Clinical correction on signed note

| Step | Action | Verify |
|------|--------|--------|
| 1 | Confirm: correction is **documentation**, not new orders | If new orders → **Reopen consult** (PRD §6.4a) |
| 2 | Manager opens patient chart → encounter → signed form | Shows **Locked** |
| 3 | Advanced: core form unlock workflow | Reason logged in core audit |
| 4 | Clinician edits → re-signs | E-Sign chip green |
| 5 | If payment already posted and charges wrong | M14 correction (when enabled) or fee sheet Advanced |

### 14.5 RB-01 — Verify backup (day 2)

| Step | Action | Verify |
|------|--------|--------|
| 1 | System → **Backup** | Requires core `admin` super (D-ADMIN-2) |
| 2 | Run manual backup OR confirm cron log | File timestamp today |
| 3 | Copy backup to USB / cloud | Off-site copy |
| 4 | Optional: restore test on staging | Quarterly |

### 14.6 Relationship to PRD §17.4

| Phase | Document |
|-------|----------|
| **Pre go-live** | §17.4 Module Manager runbook + §24.4 worksheet |
| **Pilot week 1** | §17.4.3 G12 manual script |
| **Day 2+** | **This §14** |
| **Post-pilot slices** | §17.4.4–§17.4.7 + USER_WORKFLOWS §14.5–§14.7 |

---

## 15. Setup wizard & health dashboard

### 15.1 First-run wizard (post Module Manager install)

**Trigger:** First login to `clinic_admin` app when `admin_hub_setup_complete` ≠ 1 (§12.4).

| Step | Content | Maps to |
|------|---------|---------|
| 1 | Welcome + pilot worksheet upload | §24.4 |
| 2 | Apply **cash clinic profile** | M6-F07 |
| 3 | Set **currency** (GHS default) | M6-F27 |
| 4 | Create **visit types** (OPD, Follow-up, …) | M6-F02 |
| 5 | Enter **fee schedule** (starter CSV) | M6-F01 |
| 6 | **Staff accounts** — owner + reception + doctor minimum | §4.2.1 |
| 7 | **Install ACL** reminder | §17.4 step 4 |
| 8 | **Cron** copy-paste | §16.2 |
| 9 | **Safety drills** schedule | §17.2.2–§17.2.4 |
| 10 | Review health + mark setup complete | — |

### 15.2 Setup completeness weights

| Item | Weight |
|------|--------|
| Cash profile applied | 10% |
| ≥3 fee lines active | 10% |
| ≥1 visit type → pc_catid | 10% |
| ≥3 staff with role templates | 15% |
| ACL installed | 10% |
| Cron configured | 10% |
| Reconciliation test run | 10% |
| Backup test run | 10% |
| Worksheet Q4–Q9 recorded | 10% |
| G12 drill signed (week 1) | 5% |

---

## 16. Navigation, ACL & menu cutover

### 16.1 Menu strategy (extends PRD §19)

When `enable_admin_hub` = 1 (post-pilot opt-in; flag **defaults `0`** and is enabled manually after V1.1-ADMIN ships — no auto-flip, per PRD §12.4 / §19.4):

| Stock Admin item | `new_admin` | Core super |
|------------------|-------------|------------|
| Entire **Admin** top menu | Replace with **Admin & Configuration** → hub | Full Admin + hub |
| **Config** (globals) | Hidden | Advanced from hub |
| **Users / ACL / Address book** | Hub **People** | Both |
| **Forms / Layout / Lists** | Hub **Forms** | Both |
| **System** children | Hub **System** | Both |
| **Module Manager** | Link in M6 About + Setup | Unchanged |

**Rollback:** `enable_admin_hub` = 0 restores stock menu.

### 16.2 ACL additions (proposed)

| Key | Groups | Purpose |
|-----|--------|---------|
| `new_admin_hub` | `new_admin` | Open hub shell |
| `new_admin_hub_people` | `new_admin` | Staff CRUD |
| `new_admin_hub_system` | `new_admin`, core super | Backup/logs |
| `new_admin_hub_forms` | `new_admin` | Form bundle board |

Core `admin/users`, `admin/forms`, `admin/super` still enforced on underlying actions.

---

## 17. Data model, APIs & audit

### 17.1 New tables (module-owned — PRD §12.1)

```sql
admin_hub_setup_progress (
  facility_id INT NOT NULL,
  checklist_key VARCHAR(64) NOT NULL,
  completed_at DATETIME NULL,
  completed_by BIGINT NULL,
  PRIMARY KEY (facility_id, checklist_key)
)

admin_hub_backup_run (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  facility_id INT NOT NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  status ENUM('ok','failed','running') NOT NULL,
  file_path VARCHAR(512) NULL,
  actor_id BIGINT NULL,
  message TEXT NULL
)
```

### 17.2 Audit events

| Event | When |
|-------|------|
| `admin_hub.staff_created` | User created via wizard |
| `admin_hub.staff_deactivated` | User deactivated |
| `admin_hub.role_template_applied` | Template → groups |
| `admin_hub.backup_run` | Manual backup |
| `admin_hub.setup_step_completed` | Wizard progress |
| `admin_hub.advanced_link_followed` | User opened stock admin |

Reuse `EventAuditLogger` + PRD §9 redaction rules.

### 17.3 Config keys (§12.4 extension)

| Key | Default | Notes |
|-----|---------|-------|
| `enable_admin_hub` | `0` at install until M15 ships | Menu cutover |
| `admin_hub_show_multisite_tab` | `0` | NG7 |
| `admin_hub_backup_retention_days` | `30` | Local backup dir |
| `admin_hub_setup_complete` | `0` | Wizard completion (M15-F11) |

---

## 18. Phasing & PRD alignment

### 18.1 Module mapping

| Phase | Deliverable | PRD |
|-------|-------------|-----|
| **V1 P0** | M6 `admin.php` per PAGE_DESIGNS §7.9 | M6 — pilot-blocking |
| **V1.1-ADMIN** | M15 hub — shell, People wizard, Runbooks, Forms bundle, backup, setup wizard, menu cutover §19.4 | M15-F01–F13; `enable_admin_hub` default **0** |
| **V1.1-OPS** | Support bundle, email alerts | NG9 adjacent |
| **V2 / NG7** | Multisite export/import | NG7 |

### 18.2 Independence (D36 pattern)

M15 can ship **after** M6 P0 without blocking pilot golden path — stock admin remains fallback until `enable_admin_hub` = 1.

**PRD integration (complete):** M15 §8, §17.4.8, §19.4, §21.1v, PAGE_DESIGNS §7.27–§7.28, USER_WORKFLOWS §14.8 — see PRD v1.20.32 / D-ADMIN-1–5.

---

## 19. Acceptance criteria

### 19.1 M6 (unchanged — PAGE_DESIGNS §7.9.18)

- [ ] All §7.9.18 checks pass

### 19.2 M15 hub

- [ ] `new_admin` lands on hub from `clinic_admin` app; clinical roles get 403
- [ ] Add staff wizard assigns correct `new_*` groups for each template
- [ ] Non-super cannot grant superuser groups (parity with core)
- [ ] Health chip shows backup + reconciliation status
- [ ] Runbooks lens lists RB-01–RB-20 with deep links
- [ ] Stock Admin menu hidden when `enable_admin_hub` = 1; Advanced escape works
- [ ] All hub writes audited
- [ ] Setup wizard reaches 100% only when §15.2 checklist complete
- [ ] Backup run disabled without core super; help text shown (D-ADMIN-2)
- [ ] Mobile: tabs collapse; runbooks readable

### 19.3 Ghana / West Africa validation

- [ ] Default currency GHS in wizard for launch region
- [ ] Role template copy uses plain English (+ xl translations)
- [ ] Backup instructions include XAMPP path example
- [ ] NHIS / US insurance admin not promoted in hub

---

## 20. Closed decisions (PRD §24.1)

| ID | Decision |
|----|----------|
| **D-ADMIN-1** | M6 = clinic config; M15 = people/forms/platform/runbooks; `edit_globals.php` = Advanced only |
| **D-ADMIN-2** | Manual backup requires core `admin` super + `new_admin_hub_system` in V1.1-ADMIN |
| **D-ADMIN-3** | English V1 runbooks; UI via xl(); Twi/French snippets defer V2 |
| **D-ADMIN-4** | Owner sets password in wizard V1; SMS/email invite defer V1.1-OPS |
| **D-ADMIN-5** | M15-F13 config export = JSON for M6 keys; SQL clone defer NG7 |

**No open admin product questions remain for V1 pilot.**

---

## 21. Document history

| Version | Date | Changes |
|---------|------|---------|
| 0.1.7 | 2026-07-18 | **Setup checklist polish batch:** (1) **cashier is a core role** — the staff item and provisioning now include `new_cashier` (D-STAFF-1 solo bench still passes: one login holding all groups); (2) under global scope the card shows a "setup is tracked per clinic" note and the finish-setup banner hides (facility 0 can never truthfully complete); (3) provisioned temp passwords back-date only when the clinic enforces expiry WITH a grace window (expired-within-grace = change nag at first sign-in; backdating without grace would hard-lock the account — core `checkPasswordNotExpired` rejects login outright); (4) worksheet + drill rows link to the runbooks board; new **RB-21 go-live worksheet** runbook (catalog now RB-01–RB-21) |
| 0.1.6 | 2026-07-18 | **Starter staff provisioning (M15-F11 follow-on):** "Create starter sign-ins" on the checklist's staff row — creates only the missing core roles (reception, doctor) via the proven seeder recipe (users + users_secure + auth group + gacl), never on facility 0, one-time temp passwords shown once behind a confirm; new audited `admin.setup.provision_staff` action (`new_admin`); dry-run mode for tests |
| 0.1.5 | 2026-07-18 | **M15-F11 setup checklist completion batch** (SETUP-1..6, see `new/NEW_CLINIC_SETUP_CHECKLIST_COMPLETION_PLAN.md`): cron item now follows the health cron chip (was a defaults-on flag false positive); ACL + staff-accounts items auto-detect (`modules.acl_version`, gacl group membership) with manual override kept; new `admin.setup.unmark_item` + `admin.setup.reopen` actions (audited, `new_admin`); card stays after completion showing residual items + Reopen; plain-English labels/hints via `xl()` with take-me-there tab links (`link_tab`), weight tags, threshold explainer; Setup chip clickable + every-tab "finish setting up" banner; a11y (announced row state, per-item button names) |
| 0.1.4 | 2026-06-24 | **Consistency audit fixes** — §19.4 removed incorrect "`enable_admin_hub` default ON after M15 ships" claim (canonical default is **`0`**, no auto-flip — PRD §12.4 / §19.4); removed duplicate "Mobile: tabs collapse" acceptance line from §19.3 |
| 0.1.3 | 2026-06-22 | **Audit closure** — D-ADMIN-2–5; §12.2.2 backup ACL; §12.3 JSON export; §20 closed decisions; §22.3 all items resolved; PRD v1.20.32 |
| 0.1.2 | 2026-06-22 | **Consistency audit** — §22 findings + resolutions; phasing §18.1 aligned to V1.1-ADMIN; ACL `new_admin_hub`; audit event family; `admin_hub_setup_complete`; PRD §12.1 DDL cross-ref |
| 0.1.1 | 2026-06-22 | PRD integration — M15 §8 F01–F13; §17.4.8; §19.4; §21.1v; PAGE_DESIGNS §7.27–§7.28; USER_WORKFLOWS §14.8 |
| 0.1.0 | 2026-06-22 | Initial draft — gap analysis, pain points, M15 Admin Operations Hub IA, day-2 runbook §14, Ghana/West Africa context, competitive patterns |

---

## 22. Consistency audit pass

**Date:** 2026-06-22 · **Scope:** M6 + M15 trilogy (PRD, PAGE_DESIGNS, USER_WORKFLOWS, this spec)

### 22.1 Conflicts resolved

| ID | Issue | Resolution |
|----|-------|------------|
| C-01 | M15-F11 said `setup_complete`; §12.4 had `admin_hub_setup_complete` | Normative key: **`admin_hub_setup_complete`** everywhere |
| C-02 | PRD §4.4 / §17.4.8 used `admin_hub.staff_changed`; PAGE_DESIGNS §7.28 / §17.2 used granular events | **Granular events** are normative: `staff_created`, `staff_deactivated`, `role_template_applied` |
| C-03 | Redesign §18.1 split M15 across "V1 P1" and "V1.1-ADMIN" | Single slice **V1.1-ADMIN** (matches PRD §20.1 rule 8) |
| C-04 | O-ADMIN-1 still open while D-ADMIN-1 closed in PRD | O-ADMIN-1 removed; **D-ADMIN-1** = separate M6 vs M15 hub |
| C-05 | Redesign §16 used `new_admin_hub_view`; PRD §4.4 uses `new_admin_hub` | **`new_admin_hub`** is normative |
| C-06 | M6-F06 vs M15-F03 both cover staff assignment | M6 = summary/link; **M15 People** primary when hub ON (PRD M6-F06) |

### 22.2 Gaps closed (PRD v1.20.31)

| ID | Gap | Fix |
|----|-----|-----|
| G-01 | §7.1 `public/` tree missing `admin-hub/` | Added submodule path |
| G-02 | §7.5 build order omitted M15 | Added to **Parallel** track after B6 |
| G-03 | §12.1 DDL missing M15 tables | `admin_hub_setup_progress`, `admin_hub_backup_run` |
| G-04 | §12.4 missing `admin_hub_backup_retention_days` | Added |
| G-05 | §16.1 no ADMIN tests / CI tag | ADMIN-1–7 + `@new-clinic-v11-admin` |
| G-06 | §23.1 "Separate ships" row omitted V1.1-ADMIN | Added |
| G-07 | §4.2.1 / clinic_admin row did not mention M15 routing | Updated |

### 22.3 Remaining open items — resolved (v0.1.3)

| ID | Item | Resolution |
|----|------|------------|
| R-01 | O-ADMIN-2 backup without core super | **D-ADMIN-2** — V1 requires core super; §12.2.2; M15-F09 |
| R-02 | §7.2 mermaid M15-only gap | PRD §7.2 — full post-V1 subgraph M10–M15 + M15→M6 |
| R-03 | Twi/French runbooks (O-ADMIN-3) | **D-ADMIN-3** — English V1; defer V2 |
| R-04 | SMS user invite (O-ADMIN-4) | **D-ADMIN-4** — defer V1.1-OPS |
| R-05 | NG7 export format (O-ADMIN-5) | **D-ADMIN-5** — JSON; §12.3 |

---

## Appendix A — Stock file map

| Area | Primary files |
|------|---------------|
| Menu | `interface/main/tabs/menu/menus/standard.json` (Admin section) |
| Globals | `interface/super/edit_globals.php`, `src/Services/Globals/` |
| Users | `interface/usergroup/usergroup_admin.php`, `user_admin.php` |
| ACL | `interface/usergroup/adminacl.php`, `library/acl.inc` |
| Address book | `interface/usergroup/addrbook_*.php` |
| Forms | `interface/forms_admin/forms_admin.php`, `library/registry.inc.php` |
| Layouts | `interface/super/edit_layout.php`, `library/layout.inc.php` |
| Lists | `interface/super/edit_list.php` |
| Backup | `interface/main/backup.php` |
| Logs | `interface/logview/logview.php` |
| Multisite | `interface/super/manage_site_files.php`, `sites/` |
| Module Manager | `interface/modules/zend_modules/` + custom module listeners |
| New Clinic M6 (planned) | `oe-module-new-clinic/public/admin.php` |
| New Clinic M15 (planned) | `oe-module-new-clinic/public/admin-hub/` |

---

## Appendix B — User stories

| ID | As a… | I want to… | So that… |
|----|-------|------------|----------|
| US-ADM-1 | Clinic owner | add a receptionist in under 5 minutes | I can cover turnover without an IT firm |
| US-ADM-2 | Clinic owner | see if backup ran this week | I don’t lose patient data after disk failure |
| US-ADM-3 | Manager | unlock a signed note safely | clinical errors are corrected with audit |
| US-ADM-4 | Manager | update consultation fee for new year | prices match what we charge at window |
| US-ADM-5 | Owner | know which forms must exist for E-Sign gates | go-live is not blocked at first payment |
| US-ADM-6 | IT partner | export M6 config | second branch opens faster (NG7) |
| US-ADM-7 | Trainer | point staff to day-2 runbooks in app | post-pilot support is self-service |
| US-ADM-8 | Owner | hide US insurance admin screens | staff stop asking about NHIS claims in V1 |

---

## Appendix C — Competitive reference matrix

| Capability | Epic (ambulatory admin) | athenaNet | Bahmni implementer | Helium Health (regional SaaS) | New Clinic target |
|------------|-------------------------|-----------|-------------------|------------------------------|-------------------|
| Role templates | ✓ | ✓ | Manual | Vendor-only | **People wizard** |
| Fee schedule self-service | ✓ | ✓ | ✓ | Vendor | **M6** |
| Form layout editor | Power user | Limited | ✓ | Vendor | **Guided + Advanced** |
| Backup dashboard | Enterprise IT | Vendor | Manual | Vendor | **Health lens** |
| Day-2 runbooks | Training portal | Help center | Wiki | WhatsApp support | **In-product §14** |
| Multi-site | ✓ | ✓ | ✓ | ✓ | **NG7 V2** |
| Offline/low bandwidth | Varies | Cloud | Varies | Mobile-first | LAN-first admin |

---

## Appendix D — Day-2 task frequency matrix

| Task | Frequency | Owner | Hub path |
|------|-----------|-------|----------|
| Check backup | Weekly | Owner / IT | System |
| Add/deactivate user | Monthly | Owner | People |
| Fee price tweak | Quarterly | Owner | M6 Fees |
| Review overrides | Monthly | Manager | M7 + Runbook RB-16 |
| Unlock signed form | Rare | Manager | RB-11 |
| Module upgrade | Quarterly | IT | Module Manager |
| Re-run G12 drill | After incident | Trainer | RB-04 |
| Enable lab/pharm ops | Once post-pilot | Manager | RB-13/14 |

---

*End of document.*

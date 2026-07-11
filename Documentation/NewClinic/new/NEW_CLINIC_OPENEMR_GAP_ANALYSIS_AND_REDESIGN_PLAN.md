# New Clinic — OpenEMR Coverage Gap Analysis & Comprehensive React Redesign Plan

**Version:** v0.1.5 · **Date:** 2026-07-11 · **Status:** GAP-A: A1 + A2 closed (G1, G2); A3 re-verified, build starting
**v0.1.1:** second-pass audit added off-menu surfaces (MFA, login/auth, issue editor, growth charts, authorizations, record request, background-service monitors) — see G11, W10–W11, A6.
**v0.1.2:** re-verified A1 (Office Notes) against current code before build start — corrected the
`onotes` schema/UI claims, the ACL story, and the page-count headcount; see the A1 entry in §5 and
the version-history table at the bottom. Confirms the general rule from CLAUDE.md §12: trust the
code over this doc's status claims, then fix the doc — applied here for the first time this doc
gets touched during actual implementation rather than a planning pass.
**v0.1.3:** A1 (Office Notes) and A2's per-patient Documents tab built, reviewed, and merged to
main — closes G1, and closes the per-patient half of G2 (the clinic-wide "unfiled documents"
inbox lens is still open). Reconciled the pre-build v0.1.2 draft against the real implementation:
pin **was** shipped after all (companion table, not a core schema change), and the ACL turned out
to need zero new `acl_setup.php` wiring (the stock `Clinicians` group already covers it). See §5.
**v0.1.4:** A2's remaining "unfiled documents" inbox lens shipped in `report-hub`, closing G2 fully.
Confirmed report-hub's lens system is a hardcoded enum + generic card catalog, not a registry —
adding a 7th lens meant touching 4 files plus a Twig toolbar button, not a drop-in catalog card.
Live browser verification surfaced (and correctly attributed rather than "fixed") a pre-existing,
already-tracked scalability gap: PHP's default file-based session locking serializes concurrent
same-session ajax calls because no New Clinic handler calls `session_write_close()` yet — a
`documents.unfiled_list` call took 21s once, competing with two other in-flight requests from the
same tab, not a defect in the new action itself. See §5 and
[NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md](./NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md).
**v0.1.5:** re-verified A3 (Address Book) against current code before build start — five real
staleness points found (more than A1 or A2): `Sheet` → `Dialog` (no precedent for `Sheet` CRUD in
admin-hub), fabricated "Hospital" category, `admin/practice` → module's own `new_admin` ACO (stock
ACL would 403 real admins), wrong referral-component name, and a real safety-guard requirement for
writing to the shared `users` table that the original "no new table" framing understated. See A3
in §5.

This document answers two questions:

1. **Gap analysis (§1–§3):** Which parts of stock OpenEMR has the New Clinic module *not* yet addressed — audited against the full core menu tree (`interface/main/tabs/menu/menus/standard.json`), the implementation scorecard, and `OPENEMR_AREAS_NOT_ADDRESSED.txt`.
2. **Redesign plan (§4–§8):** A comprehensive, phased plan to close every closable gap using the **React island architecture and shared components we already ship** — no new frameworks, no new patterns.

Read alongside: [PRD](../done/NEW_CLINIC_V1_PRD.md) · [Scorecard](../NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md) · [UI/UX Plan](../NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md) · [OPENEMR_AREAS_NOT_ADDRESSED.txt](../OPENEMR_AREAS_NOT_ADDRESSED.txt)

---

## 0. TL;DR

- **Daily clinical flow is covered.** All role desks (M1–M9), Visit Board, MRD chart, Scheduling, Communications, Registry, Admin Hub, Reporting, and the post-pilot ops hubs (M11–M18) exist as React islands at 72–100% completion.
- **Three kinds of gaps remain:**
  - **Tier 1 — Unaddressed, in-market:** stock screens a cash-clinic actually uses that have *no* New Clinic treatment. **Closed:** Office Notes (G1), Documents manager (G2, both per-patient and clinic-wide unfiled inbox). Still open: Address Book, patient labels/letters, Batch Communications, patient/clinical reminders, MFA enrollment, i18n.
  - **Tier 2 — Wrapped/deep-linked, not redesigned:** legacy screens reachable through T1 iframes or gateway cards (People/ACL legacy escape hatch, LBF form engine, Backup, Audit Logs, Merge Patients, Calendar admin, Codes/superbill admin, drug inventory admin).
  - **Tier 3 — Deliberate non-goals:** patient portal, telehealth, US claims/EDI, eRx vendors, FHIR/SMART, group therapy, DICOM, fax, de-identification. These stay out; this plan re-affirms the boundary rather than sneaking them in.
- **The plan (§5) closes Tier 1 fully and converts the highest-traffic Tier 2 wrappers to native React**, in four phases (GAP-A through GAP-D), reusing `DataTable`, `SlideOver`/`Sheet`, `WidgetCard`, `SegmentedControl`, `ConfirmModal`, the wizard and dual-list patterns from Admin Hub, and the standard `oeFetch`/`ajax.php` data layer.

---

## 1. Audit method

Three sources were diffed:

1. **Core feature surface:** every entry in `standard.json` (Calendar, Finder, Flow, Recalls, Messages, Patient, Groups, Fees, Modules, Inventory, Procedures, eRx, Admin, Reports, Miscellaneous, Popups).
2. **Module surface:** the 23 top-level host/utility pages in `oe-module-new-clinic/public/` (25 files
   minus `ajax.php`/`bootstrap.php` infrastructure — re-counted 2026-07-11) plus hub subdirectories (`scheduling/`, `bill-ops/`, `lab-ops/`, `pharm-ops/`, `clinical-doc/`, `queue-bridge/`, `report-hub/`, `chart-depth/`) and the 22 React islands in `frontend/src/islands/`.
3. **Declared scope:** PRD §3.2 non-goals (NG1–NG15), PRD §5.3 exclusions, scorecard P0 backlog, and `OPENEMR_AREAS_NOT_ADDRESSED.txt`.

A core area counts as **Replaced** when a React island is the daily-use surface, **Wrapped** when it is reachable only through a T1 iframe wrapper or gateway card (e.g. `admin-people-legacy.php`, `clinical-form-bridge.php`), **Deep-linked** when desks link out to the stock screen in the OpenEMR shell, and **Unaddressed** when the module neither replaces, wraps, nor links it.

Two scope notes from the second audit pass:

- **Menu variants:** `front_office.json`, `answering_service.json`, and `chart_review.json` are role-filtered subsets of `standard.json`; auditing the standard tree covers them.
- **Off-menu surfaces:** the login screen, session/password policy, MFA enrollment (`interface/usergroup/mfa_registrations.php`), the core issue editor popup (`patient_file/problem_encounter.php` and per-issue `add_edit_issue.php`), growth charts (`interface/forms/vitals/growthchart/`), provider Authorizations, and Patient Record Request do not appear as top menu items but are part of the core surface — they are classified below.

---

## 2. Coverage map — what is already addressed

| Core OpenEMR area | New Clinic treatment | Status |
|---|---|---|
| Calendar / Flow board / Recalls | S1 `scheduling` island (calendar, flow, recalls lenses); legacy URLs behind toggle | **Replaced** (85%) |
| Finder / patient search | M1a Front Desk search + M10 `patient-registry` cohort search | **Replaced** |
| Messages (staff pnotes + dated reminders) | COM `communications-hub` island | **Replaced** (80%) |
| Patient New/Search + demographics | M1b/M1c registration form, MRD `patient-chart` Profile tab | **Replaced** |
| Visits / encounters | Queue FSM + desks; `encounter-consult` native note; `clinical-form-bridge.php` for stock forms | **Replaced + Wrapped** |
| Fees: Payment / Checkout | M5 `cashier-desk` island | **Replaced** |
| Fees: Billing Manager / Batch / Posting / EDI | M14 `bill-ops` + insurance vault gateway cards | **Wrapped/gated** (72%) |
| Procedures: orders, results, batch | M8 `lab-desk` + M12 `lab-ops` (worklists, result entry, accession) | **Replaced** (78–90%) |
| Drug inventory + dispensing | M9 `pharmacy-desk` + M13 `pharm-ops` (dispense, receive, destroy, OTC, registers) | **Replaced** (80–90%) |
| Reports (daily / financial / operational) | M7 `daily-reports` + M16 `report-hub` | **Replaced** (85–92%) |
| Admin: Config, Users, ACL, Facilities, Forms admin | M6+M15 `admin-hub` (People & Access native; `admin-people-legacy.php` escape hatch) | **Replaced + Wrapped** (85–88%) |
| Backup / Audit logs / System health | M15 System lens gateway cards to stock screens | **Wrapped** |
| Immunizations | MRD Clinical tab capture + M16 export card | **Partial** |
| User profile | `my-profile` island (account, password, role/facility) | **Replaced** |
| Issues (problems / allergies / medications) | MRD Clinical tab reads via `PatientIssuesService`/`AllergyIntoleranceService`; **editing** links to core issue editor popup | **Read replaced, write deep-linked** |
| Background services / cron health | M15 System lens health chips; M16 links stock `background_services.php` | **Partial (monitor native, admin stock)** |
| Login / session / password policy | Stock login + timeout globals (M15 Advanced) | **Deliberately stock** (auth surface not module territory) |

---

## 3. Gap inventory — what has *not* been addressed

### Tier 1 — Unaddressed, relevant to the New Clinic market (close these)

| # | Core area | Stock path | Why it matters to a cash outpatient clinic | Current state |
|---|---|---|---|---|
| G1 | **Office Notes** | `interface/main/onotes/office_comments.php` | Clinic-wide sticky notes ("fridge broken", "Dr. A away Friday"); staff use it daily in stock installs | **Closed** — `office-notes` island, 2026-07-11 |
| G2 | **Documents manager** (patient + global) | `controller.php?document`, `interface/main/display_documents.php` | Scanned IDs, referral letters, lab PDFs land here; MRD only deep-links per-patient | **Closed** — `patient-chart` Documents tab + report-hub "Unfiled documents" lens, 2026-07-11 |
| G3 | **Address Book** | `interface/usergroup/addrbook_list.php` | Referral targets (specialists, hospitals) power M11 referrals & letters; currently edited in a 2005-era screen | Unaddressed; referrals spec depends on it |
| G4 | **Letters & printed artifacts** | `patient_file/letter.php`, `label.php`, `addr_label.php`, `barcode_label.php` | Referral letters exist (V1.1-CDb) but generic letter templates, chart/address/barcode labels do not | Partial (referrals only) |
| G5 | **Patient / clinical reminders** | `patient_file/reminder/` | Distinct from COM dated reminders; recall-adjacent follow-up nudges per patient | Unaddressed (flagged in NOT_ADDRESSED) |
| G6 | **Batch Communication Tool** | `interface/batchcom/` | SMS/email outreach campaigns (vaccination drives, recall blasts) — high value in West Africa via SMS | Unaddressed |
| G7 | **Patient Education** | `reports/patient_edu_web_lookup.php` | Handout lookup at the doctor desk | Unaddressed |
| G8 | **Language / i18n** | `interface/language/` | New Clinic UI strings are hard-coded English; core has a translation engine we bypass | No localization strategy |
| G9 | **Track Anything / flowsheets** | `forms/track_anything/` | Longitudinal tracking (BP series, glucose, weight) beyond single-visit vitals | Unaddressed; MRD shows per-visit vitals only |
| G10 | **Duplicate merge (post-hoc)** | `patient_file/merge_patients.php`, `manage_dup_patients.php` | Front Desk prevents dupes at intake (NG12 bars *automated* merge), but manual cleanup still requires the stock screen | Deep-linked from M15 Advanced only |
| G11 | **MFA enrollment (TOTP/U2F)** | `interface/usergroup/mfa_registrations.php` | Admin spec flags MFA as security best practice on shared clinic PCs ("optional P1"); `my-profile` has password change but no MFA setup, and Admin Hub People lens doesn't surface enrollment status | Unaddressed (noted "optional P1" in admin spec, never built) |

### Tier 2 — Wrapped or deep-linked, not yet redesigned (convert the high-traffic ones)

| # | Core area | Current wrapper | Traffic | Convert? |
|---|---|---|---|---|
| W1 | People/ACL advanced (gacl, facility×user) | `admin-people-legacy.php` iframe views (`acl_admin`, `facility_user`) | Low (admin-only) | Partially — `FacilityUserMatrix` exists; finish native, keep gacl iframe as last resort |
| W2 | LBF / encounter form engine | `clinical-form-bridge.php` | **High** (every non-native visit form) | No rewrite (NG5) — but build native React shells for the top 3 forms by usage (vitals ✓ done, consult ✓ done, procedure order next) |
| W3 | Backup / restore | M15 gateway card → `backup.php` | Low | Keep wrapped; add native status/history panel only |
| W4 | Audit log viewer | M15 links → `logview.php` | Medium (incident review) | Yes — native read-only log browser |
| W5 | Codes / superbill admin | Stock `superbill_custom_full.php` | Medium (fee schedule upkeep) | Yes — Admin Hub already has a Fees tab; extend to full code CRUD |
| W6 | Calendar categories/admin | Stock PostCalendar admin | Low | Fold into Admin Hub Clinic tab (visit types already native) |
| W7 | Lists (`edit_list.php`) & Layouts (`edit_layout.php`) | Stock screens | Medium | Lists: native editor for the ~10 lists the module reads (regions, visit reasons, etc.). Layouts: stay stock (NG5) |
| W8 | Drug inventory *admin* (`drug_inventory.php`) | Stock screen; pharm-ops covers transactions | Medium | Yes — formulary/catalog CRUD inside pharm-ops SetupPanel |
| W9 | Practice Settings (pharmacies, insurers, x12) | `controller.php?practice_settings` | Low (cash profile) | Pharmacy list only (needed for Rx print); rest stays stock |
| W10 | Issue editor (problems/allergies/meds **write**) | Core popup `add_edit_issue.php` deep-linked from MRD Clinical tab | **High** (every chronic-condition update) | Yes — native issue drawer in `patient-chart` (see D4) |
| W11 | Growth charts (pediatric percentiles) | Stock static CSS/PDF pages (`interface/forms/vitals/growthchart/`) | Medium (pediatric-heavy outpatient mix) | Fold into B2 Trends panel as a percentile overlay for patients under 18 |
| W12 | Patient Record Request | `patient_file/transaction/record_request.php` (a transaction type) | Low | Covered by the M11 referrals/letters transactions wrapper — verify the transaction type renders there, else add it to the type filter |

### Tier 3 — Deliberate non-goals (do NOT redesign; re-affirmed)

Patient portal & portal mail, telehealth, therapy groups, prior auth / claims connectors / EDI-X12 / eligibility (NG1, NG3), Weno & Ensora eRx vendor UIs, REST/FHIR/SMART clients, EHI exporter / CCDA care-coordination module, CDR rules engine (disabled in cash profile), chart tracker (paper charts), fax/scan, DICOM viewer, de-/re-identification, IPPF statistics, product registration, Configure Tracks *authoring* (consuming tracks is G9; authoring stays stock), provider **Authorizations** (`interface/main/authorizations/` — an insurance-billing sign-off queue with no cash-flow role; M17 sign overview covers the clinical-signing need), IP Tracker and Direct Message Log reports, and the login/auth surface itself (login page, session policy, password expiry — core territory; MFA *enrollment access* is the exception, see G11).

Any of these becoming in-scope requires a PRD amendment first — not a line item here.

---

## 4. Redesign principles (unchanged, restated)

Everything below reuses the **existing** stack — no new dependencies beyond what `frontend/package.json` already carries:

- **Architecture:** one Vite island per hub, mounted with `mountIsland()` from a Twig-served host page in `oe-module-new-clinic/public/`; data via `oeFetch`/`postDeskAction` against `ajax.php` actions; page context from `readPageContext`.
- **Component kit:** `components/ui/*` (shadcn/Radix primitives), `DataTable`/`MatrixDataTable`, `SlideOver`/`Sheet`, `WidgetCard`, `StatCard`, `SegmentedControl`, `ConfirmModal`, `RowActionsMenu`, `PaginationBar`, `ChipCloud`, `StatusPill`, `AppToaster` + `deskToast`, `LiveRegion`/`SkipNav` for a11y.
- **Patterns:** tab/lens shells (Admin Hub style), worklist + setup panel (lab-ops/pharm-ops style), wizard (`AddStaffWizard` style), dual-list editor (ACL style), drawer-based row editing, `usePageHeadingToolbar` bridge, polling via `useInterval` + `useQueueVisibilityRefresh`.
- **Styling:** BEM island CSS on `--oe-nc-*` tokens (`core/tokens.css`); Tailwind 4 utilities; no `@layer` (Bootstrap 4 shell conflict).
- **Gating:** every new hub behind a global toggle defaulting **OFF** (matching `enable_bill_ops`, `enable_admin_hub` precedent); ACL via existing lead groups; legacy screen stays reachable until parity sign-off.
- **Per-batch:** bump `ModuleAssetVersion.php` once; update scorecard + README index; CI green (`New Clinic Verify`); `composer verify:new-clinic` for backend PHP.

---

## 5. The plan — gap-by-gap redesign specs

### Phase GAP-A — Daily-use gaps (highest value, smallest surface)

*Re-verified against the actual built code 2026-07-11 (merge review), superseding the pre-build
v0.1.2 draft below it in history — two of that draft's own predictions turned out wrong: pin
**was** shipped (via a companion table, not a core schema change), and the ACL turned out to need
no new `acl_setup.php` grant at all. Both corrected here against the real code, not assumed.*

- **Host:** `public/office-notes.php` (T1 shell, `PageController::renderForEncounterNotesAcl`) +
  card on desks' hub navigation (`ShellService` + `Bootstrap` nav, gated by `enable_office_notes`);
  smart-vs-legacy redirect to stock `office_comments_full.php` when the flag is OFF. *report-hub
  lens embed deferred (not required for G1 closure).*
- **UI:** single-column feed of `WidgetCard` notes with author/date, active/archived
  `SegmentedControl` (Active/Archived/All), inline compose + inline edit, **pin toggle** (pinned
  notes float to the top with a Pinned badge + accent), `RowActionsMenu` (Edit / Archive-Restore /
  Delete), delete behind `ConfirmModal`. Error/validation messages use the shared
  `deskCalloutClass('error')` convention (fixed in merge review — the first cut had a bespoke
  message class).
- **Backend:** `ajax.php` actions `onotes.list|save|archive|pin|delete` via `OfficeNotesService`.
  Writes delegate to core `OpenEMR\Services\ONoteService` (core `onotes` untouched); **pin state
  lives in the module-owned companion table `new_office_note_meta`** (`onote_id` PK) — the list
  read LEFT JOINs it so pinned notes sort first globally, not just within a page. Confirmed: no
  change to the core `onotes` table itself.
- **ACL:** core `encounters/notes` (same as stock) — wired as its own `office_notes_acl` policy
  type + `AjaxController::requireOfficeNotesAcl()`, distinct from the existing `core_notes_acl`
  type (which checks the unrelated `patients/notes` section for Communications Hub). No new
  `acl_setup.php` grant was needed: the stock `Clinicians` GACL group already holds
  `encounters => ['notes', 'relaxed']` and `patients => [..., 'docs', 'notes', ...]` at write
  level, and `ClinicRolesService` already adds every New Clinic role to `Clinicians` — so both A1
  and A2's ACL checks are satisfied for free by existing staff provisioning. **Toggle:**
  `enable_office_notes` (default OFF, `install.sql`).
- **Verification:** frontend `npm run check` (lint + typecheck + 401 vitest) + `npm run build`
  green; backend static `verify-module.php` PASS (syntax, 0 ctor cycles, controller imports, ajax
  crosscheck). Reviewed via `nc-code-review` before merge to main.
- **Effort:** S (1–2 sessions).

#### A2. Documents manager → **`patient-chart` Documents tab + report-hub inbox lens** (closes G2) — **BUILT (2026-07-11), both halves**

- **UI (per-patient) — BUILT:** new "Documents" **tab** in the MRD chart (gated by `enableDocuments`): `DataTable` of documents (name, category, date, uploader), drag-drop + choose-file upload zone with a category `native-select`, preview in `SlideOver` (`<img>` for images, `<iframe>` for PDF, download fallback otherwise), category move via `native-select` in the preview, delete behind `ConfirmModal`. Tab hidden entirely when the toggle is OFF; lazy-loads on first activation.
- **UI (clinic-wide inbox) — BUILT:** new **"Unfiled documents"** lens in `report-hub` (`UnfiledDocumentsLens.tsx`), special-cased like the `today` lens (it isn't a `ReportHubCard`-shaped catalog entry — report-hub's lens system is a hardcoded 6→7-member enum + generic date-range card catalog, not an extensible registry; adding a 7th lens meant touching 4 files: `reportHubTypes.ts`, `reportHubLensMeta.ts`, `ReportHubAccessService.php`, and special-casing the render in `ReportHubLensPane.tsx`, plus the Twig toolbar button). `DataTable` of scans with `foreign_id = 0` (name, category, scanned date, uploader), inline "Assign…" action opens a `PatientSearchDropdown`; picking a patient files it and the row disappears from the list. Reuses the exact same `PatientDocument`/`DocumentsListResponse` shapes and `formatDocDate`/`formatBytes` helpers as the per-patient tab.
- **"Unfiled" is a real, pre-existing stock concept, not new plumbing:** `Document::createDocument()` already stores `foreign_id = 0` (int, never NULL) when no patient is given — the exact sentinel stock's own "Documents → New Document Uploads" screen (`controllers/C_Document.class.php::list_action`) already uses. Filing is the same primitive as stock's `move_action_process`/`Document::change_patient()` — just `UPDATE documents SET foreign_id = ?`.
- **Backend — BUILT:** `ajax.php` actions `documents.list|categories|upload|recategorize|delete|unfiled_list|assign_patient` via `DocumentsService`, delegating storage to core `\Document::createDocument` (same path as `ReferralDocumentService`); membership in `categories_to_documents`; **delete is a soft-delete** (`documents.deleted = 1`, recoverable, matches every core read filter). Per-category ACL enforced with `AclMain::aclCheckAcoSpec`; every per-patient action re-scopes to the patient (`assertPatientChartPid`); `assign_patient` re-scopes to its *target* patient the same way. Uploads reuse the **existing** `oeFetch` FormData pass-through (no oeFetch change needed — the plan's "multipart branch" was already covered by the referral-upload precedent). Hardened like the referral service: MIME allow-list (PDF + JPEG/PNG/GIF/WebP), 10 MB cap, `isWhiteFile`/`secure_upload` policy, filename sanitize, audit log.
- **ACL:** core `patients/docs` for all `documents.*` actions (`patients_docs_acl` policy type + `AjaxController::requirePatientsDocsAcl()`), satisfied for every New Clinic role via the stock `Clinicians` group grant (no new `acl_setup.php` wiring needed — see A1's note, same mechanism). The report-hub *tab itself* additionally gates on `new_reception`/`new_admin` (reception is who actually triages batch scans) — a report-hub-local visibility rule, not a data-access rule; the underlying ajax actions don't care which lens called them. **Toggle:** `enable_documents_native` (default OFF, `install.sql`) — reused for both halves, no second flag; the inbox lens also requires `enable_report_hub` since it lives inside that hub.
- **Verification:** frontend `npm run check` + `npm run build` green; backend static `verify-module.php` PASS; live browser smoke (real PDF upload, category resolves, file lands on disk) clean. Caught and fixed a real bug in review: `DocumentsService` queried a `categories.active` column that has never existed in stock — 500'd every category-related action; neither service had test coverage before this batch (13 tests added across both).
- **Effort:** M (3–4 sessions) for the per-patient half; +1 session for the inbox lens once the report-hub lens-registry limitation was understood.

#### A3. Address Book → **Admin Hub "Directory" tab** (closes G3)

*Re-verified against current code 2026-07-11 before build start. Corrections from the original
draft below are marked ⚠ — this item had five real staleness points, more than A1 or A2.*

- **UI:** new tab in the existing `admin-hub` island (`ADMIN_TABS` array + `AdminTabId` union in
  `adminTypes.ts`, wired through `AdminHub.tsx`/`AdminHubTabPanels.tsx` — a flat hand-edited list,
  not a registry): `DataTable` of external contacts with type filter chips (`ChipCloud`), add/edit
  in a **`Dialog`** ⚠ (not `Sheet` — no existing admin-hub CRUD tab uses `Sheet`; the established,
  working pattern for exactly this shape is `Dialog`, precedent `VisitTypeModal`/`FeeModal`).
  ⚠ **Type chips are not "specialists, hospitals, labs"** — no "Hospital" category exists in stock.
  The real `abook_type` list (`list_options`, `list_id='abook_type'`): Specialist, Lab Service,
  Imaging Service, Immunization Service, Vendor, Distributor, External Provider, External
  Organization, Billing Service, Care Coordination, EMR Direct. Chips should reflect these.
  Referral-target picker in M11 ⚠ (component is **`ReferralWizard.tsx`** in `chart-depth`, not
  "`PatientReferralsLetters`" — that name doesn't exist in the codebase) can later swap its
  free-text destination `<input>` for a `Command`-based lookup against this directory (precedent:
  `PatientSearchWidget.tsx`'s `Command`/`cmdk` typeahead) — **frontend-only, optional follow-up**,
  not required for A3 itself; `destination_facility`/`destination_department` stay plain strings
  either way, no backend schema change needed to wire the picker.
- **Backend:** `ajax.php` actions `directory.list|save|delete` over the core `users` table's
  `abook_type` rows (stock address book storage — confirmed, no new table). ⚠ **This needs a real
  safety guard, not just "no new table."** Stock's own screens (`addrbook_list.php`,
  `addrbook_edit.php`) store address-book contacts and real staff login accounts in the *same*
  `users` table, distinguished only by `username = '' OR username IS NULL` + `authorized = 0`
  (contact) vs. a real username + `authorized = 1` (staff login/ACL principal). Every `directory.*`
  query and mutation must carry that exact WHERE guard on every read, write, and delete — a bug
  here risks corrupting or deleting a real staff account, not just a contact card. Mirror stock's
  own guard (`addrbook_edit.php`'s delete statement) rather than reinventing it.
- **ACL:** ⚠ **not `admin/practice`** — verified the module's `ajax.php` never checks any stock
  `admin`-section ACO for anything; every `admin.*` action (including the `VisitTypeModal`/
  `FeeModal` precedent this tab copies) is gated on the module's own `new_clinic`-section `new_admin`
  ACO via `AjaxActionPolicy.php`'s `SINGLE_ACL` map + `AclMain::aclCheckCore('new_clinic', 'new_admin')`.
  `admin/practice` is not granted to the `new_admin` role by any seed path (not stock
  `Administrators`, not `acl_setup.php`'s `$coreGrants`) — building against it as originally
  planned would 403 every real pilot admin. Use `new_admin` like every sibling admin-hub tab.
- **Toggle:** ⚠ none needed — precedent (`enable_admin_hub` only gates the `system`/`forms` tabs;
  `people`/`completion`/`clinic`/`types`/`fees`/`queue` are always-on "core clinic setup") puts
  Directory in the always-on group alongside Visit Types/Fees, not behind a new or existing flag.
- **Effort:** S–M (2 sessions) — unchanged; corrections above are scope clarifications, matching
  the A1/A2 pattern of the pre-build draft being wrong on ACL/UI-pattern specifics, not on scope.

#### A4. Letters & labels → extend **chart-depth** (closes G4)

- **UI:** M11 referrals panel gains a "Letters" sub-lens: template picker (`native-select` of `document_templates`), token-filled preview, print via existing Twig print pattern (`rx-print.php` precedent → `letter-print.php`). Labels (chart/address/barcode) become print buttons on the MRD banner `RowActionsMenu`, each a small Twig print view.
- **Backend:** `letters.templates|render` actions; label prints are plain PHP/Twig with `Barcode` lib already vendored by core.
- **Effort:** M (2–3 sessions).

#### A5. Patient reminders → **COM hub "Patient follow-ups" lens** (closes G5)

- **UI:** third lens in `communications-hub` beside Messages and Reminders: `DataTable` of per-patient follow-up flags (due date, reason, status), create from MRD banner ("flag for follow-up" action), complete/dismiss with `ConfirmModal`. Feeds the S1 recall worklist counts.
- **Backend:** reuse core `patient_reminders` table via `reminders.patientList|create|complete` actions; do **not** enable the CDR engine — these are manual flags.
- **Effort:** M (2 sessions).

#### A6. MFA enrollment → **`my-profile` Security section + People lens status** (closes G11)

- **UI:** `my-profile` gains a "Security" `WidgetCard`: MFA status, enroll TOTP (QR render + verify code input), remove device behind `ConfirmModal` with password re-entry. Admin Hub People lens staff drawer shows a read-only MFA-enrolled `StatusPill` so leads can chase stragglers.
- **Backend:** `profile.mfa.status|enrollTotp|verify|remove` actions delegating to core `MfaUtils`; no new crypto, no U2F in V1 (TOTP only — shared clinic PCs rarely have per-user keys).
- **ACL:** self-service (own account) + `admin/users` for the status column. **Effort:** M (2 sessions).

### Phase GAP-B — Outreach & tracking

#### B1. Batch communications → new **`outreach`** island (closes G6)

- **UI:** wizard pattern (clone `AddStaffWizard` steps): ① audience (reuse **patient-registry filter panel** as an embedded cohort picker — same component, `embedContext` like report-hub does), ② message (SMS/email template with token chips), ③ dry-run preview (`DataTable` of recipients), ④ send/schedule. History lens with per-campaign delivery stats (`StatCard` row).
- **Backend:** `outreach.preview|queue|history` actions; delivery through core `batchcom` sender initially; SMS gateway adapter deferred to its own spec (MoMo/SMS providers are NG9-adjacent — flag for product).
- **ACL:** `admin/batchcom`. **Toggle:** `enable_outreach` (default OFF).
- **Effort:** L (4–5 sessions). *Scripts that modify data get a dry-run step by default — the preview lens is mandatory, not optional.*

#### B2. Flowsheets / longitudinal tracking → **MRD Clinical "Trends" panel** (closes G9)

- **UI:** in `patient-chart` Clinical tab: measure picker (BP, weight, glucose, SpO₂…), sparkline/series chart (SVG line chart component — build once in `components/`, no chart lib), `DataTable` of readings with visit deep links via `BannerClinicalLink`.
- **Backend:** `chart.vitalsSeries` action aggregating `form_vitals` + track_anything data read-only. Authoring new track definitions stays in stock (Tier 3).
- **Pediatric growth overlay (closes W11):** for patients under 18, the weight/height/head-circumference series render against WHO/CDC percentile curves (static reference data already shipped with stock growth charts) on the same SVG chart component. Print stays on the stock PDF page via deep link.
- **Effort:** M–L (3–4 sessions including the overlay).

#### B3. Patient education → **Doctor Desk quick action** (closes G7)

- **UI:** button in doctor desk active-consult pane opening a `SlideOver` with condition search (`command` palette) and print/handout links; results iframe the stock lookup initially, native list later if used.
- **Effort:** S (1 session).

### Phase GAP-C — Admin depth (convert high-traffic Tier 2 wrappers)

#### C1. Audit log browser → **Admin Hub System lens** (closes W4)

- **UI:** native read-only viewer: date-range + user + event-type filters, `DataTable` with `PaginationBar`, row detail `SlideOver` (before/after payload), CSV export reusing registry export helper. Tamper-check stays a gateway card to stock.
- **Backend:** `audit.query` action over core `log` table (read-only, paginated — never unbounded).
- **Effort:** M (2 sessions).

#### C2. Codes & fee schedule → **Admin Hub Fees tab, full CRUD** (closes W5)

- **UI:** extend the existing Fees tab: searchable `DataTable` of service codes (code, description, price, active), drawer edit, bulk price update with `ConfirmModal` + dry-run diff table, CSV import wizard (reuse config import/export pattern from M15).
- **Backend:** `fees.codes.list|save|bulkUpdate|import` over `codes`/`prices` tables.
- **Effort:** M (3 sessions).

#### C3. Lists editor (scoped) → **Admin Hub Forms tab** (closes W7 lists half)

- **UI:** native editor for the ~10 `list_options` lists the module consumes (visit reasons, regions/districts, payment methods, dispense units…): list picker, orderable `DataTable` rows, inline add/edit/deactivate. All other lists remain in stock `edit_list.php` via gateway card.
- **Backend:** `lists.get|save` actions with an allow-list of editable list IDs.
- **Effort:** S–M (2 sessions).

#### C4. Formulary/catalog admin → **pharm-ops SetupPanel** (closes W8)

- **UI:** extend the existing `pharm-ops` SetupPanel: drug catalog `DataTable` (name, form, strength, reorder level, active), drawer edit, NDC/unit fields; template list for common sigs. Stock `drug_inventory.php` gateway remains until sign-off.
- **Backend:** `pharm.catalog.list|save` over `drugs` table.
- **Effort:** M (2 sessions).

#### C5. People & Access completion (closes W1)

- Finish native facility×user assignment using the already-built `FacilityUserMatrix` (`MatrixDataTable`), retire the `facility_user` iframe view; keep `acl_admin` (gacl) iframe as documented last-resort with a warning banner (`DeskAlert`).
- **Effort:** S (1 session).

#### C6. Backup status panel (closes W3, partially)

- M15 System lens gains a native "Backups" `WidgetCard`: last-run timestamp, size, result, Run-now button (existing gateway action), history `DataTable`. Restore stays stock — destructive operations remain on the legacy screen deliberately.
- **Effort:** S (1 session).

### Phase GAP-D — Platform hardening

#### D1. i18n foundation (closes G8)

- Introduce a `t()` helper in `@core` backed by a JSON dictionary per locale, seeded by extracting the module's UI strings; Twig shell strings go through core `xl()`. Locale from core user preference. English ships as the only complete locale in V1 — the deliverable is the **mechanism plus extraction**, not translations.
- **Effort:** L (mechanical but wide — do desk-by-desk behind a lint rule for new strings).

#### D2. Merge patients guardrail (closes G10)

- Not a rewrite (NG12 stands). Add a "Possible duplicates" card to Admin Hub System lens: count + `DataTable` of dup-score pairs (backend already scores at intake), each row deep-linking to stock merge in a T1 wrapper (`admin-merge-legacy.php`, clone of the people-legacy wrapper pattern). Automated merge remains excluded.
- **Effort:** S (1 session).

#### D3. Procedure order native form (closes W2 top slice)

- The highest-traffic bridged form after vitals/consult is `procedure_order`. Build a native React ordering pane inside `clinical-doc` (catalog from M12's existing panel data, priority, specimen, diagnosis links), falling back to the bridge when `enable_native_proc_order` is off. This is the incremental NG5-compatible path: replace forms by usage rank, never the engine.
- **Effort:** L (4 sessions, coordinate with M12).

#### D4. Native issue editor → **`patient-chart` Clinical tab drawer** (closes W10)

- The MRD Clinical tab already renders problems, allergies, and medications natively but sends every **edit** to the core `add_edit_issue.php` popup. Replace with a `Sheet` drawer: issue type, title (`command` lookup against `lists` codes), onset/resolution dates, severity/reaction for allergies, occurrence, comments; delete stays on the stock popup (rare, destructive).
- **Backend:** `chart.issues.save` action over the `lists` table via core `PatientIssuesService` semantics; allergy writes also refresh the banner `ChipCloud`.
- **Toggle:** `enable_native_issue_editor`, default OFF; stock popup remains one click away until parity sign-off.
- **Effort:** M–L (3 sessions). High leverage: this is the last stock popup inside the golden clinical path.

#### D5. Record request verification (closes W12)

- Verify the Record Request transaction type renders in the M11 referrals/letters transactions wrapper; if filtered out, add it to the type allow-list. **Effort:** XS (checklist item, not a build).

---

## 6. Phasing & sequencing

| Phase | Items | Depends on | Exit criteria |
|---|---|---|---|
| **GAP-A** | A1 office notes · A2 documents · A3 address book · A4 letters/labels · A5 patient follow-ups · A6 MFA | none | Each behind its toggle, QA'd, scorecard rows added |
| **GAP-B** | B1 outreach · B2 trends + growth overlay · B3 education | A5 (reminder plumbing), registry filter embed | Dry-run mandatory on B1; product sign-off on SMS provider question |
| **GAP-C** | C1 audit · C2 codes · C3 lists · C4 formulary · C5 people finish · C6 backup panel | none (parallel to B) | Corresponding legacy gateway cards demoted to "Advanced" |
| **GAP-D** | D1 i18n · D2 merge guardrail · D3 native proc order · D4 native issue editor · D5 record-request check | D3 after C4/M12 stabilization | i18n lint active; proc-order + issue-editor parity checklists signed |

Suggested cadence: GAP-A next (all Tier-1 daily-use), C1/C2 interleaved where admin pain is acute. Every phase ends with one `ModuleAssetVersion.php` bump, scorecard update, and README index row — not per-item.

---

## 7. Component & pattern reuse matrix

| New surface | Island (new/existing) | Primary reused components | Reused pattern |
|---|---|---|---|
| Office Notes | new `office-notes` | WidgetCard, SegmentedControl, RowActionsMenu | COM feed + compose |
| Documents | existing `patient-chart` + `report-hub` lens | DataTable, SlideOver, ConfirmModal, PatientSearchDropdown | MRD tab + hub lens embed |
| Address Book | existing `admin-hub` | DataTable, Sheet drawer, ChipCloud, command | Admin tab + drawer edit |
| Letters/labels | existing `chart-depth` | native-select, Twig print views | rx-print precedent |
| Patient follow-ups | existing `communications-hub` | DataTable, ConfirmModal, StatusPill | COM lens |
| Outreach | new `outreach` | wizard steps, registry filter panel (embed), DataTable, StatCard | AddStaffWizard + report-hub embed |
| Trends | existing `patient-chart` | new small SVG chart component, DataTable, BannerClinicalLink | MRD Clinical panel |
| Audit browser | existing `admin-hub` | DataTable, PaginationBar, SlideOver | registry search + export |
| Codes CRUD | existing `admin-hub` | DataTable, Sheet, ConfirmModal | M15 config import/export |
| Lists editor | existing `admin-hub` | DataTable (orderable), inline edit | Admin Forms tab |
| Formulary | existing `pharm-ops` | DataTable, drawers | SetupPanel |
| Proc order native | existing `clinical-doc` | form primitives, command palette | encounter-consult form engine |
| MFA security | existing `my-profile` + `admin-hub` | WidgetCard, ConfirmModal, StatusPill | profile section + People drawer |
| Issue editor | existing `patient-chart` | Sheet, command, ChipCloud refresh | drawer-based row editing |
| Growth overlay | existing `patient-chart` (B2 chart) | SVG trend chart + static percentile data | MRD Clinical panel |

Net-new shared components required: **one** (SVG trend chart — shared by B2 trends and the growth overlay). Everything else is composition.

---

## 8. Governance & verification

- **Toggles:** every new surface defaults OFF (`enable_office_notes`, `enable_documents_native`, `enable_outreach`, `enable_native_proc_order`, …) and appears in the M6 Clinic tab.
- **ACL:** map each action to the existing core ACL pair listed per item; no new gacl sections in this plan.
- **Legacy parity rule:** the stock screen stays reachable (gateway card or T1 wrapper) until the replacement passes its §21-style checklist; only then demote it to Advanced.
- **Verification per batch:** `New Clinic Verify` CI green; `composer verify:new-clinic` on desktop for any `ajax.php`/service change; Vitest for every new hook/util; one asset-version bump.
- **Docs:** each phase adds/updates its row in the [scorecard](../NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md) and the [README index](../README.md); items graduating from `OPENEMR_AREAS_NOT_ADDRESSED.txt` are struck from that file with a pointer here.

---

## 9. Open product questions (need a decision, not code)

1. **SMS provider for B1 outreach** — which gateway (and is this NG9-adjacent enough to defer)?
2. **Documents storage quota/virus scanning** — accept core defaults, or gate uploads by size/type in the module?
3. **i18n target locales** — French (regional) as the first non-English dictionary?
4. **Proc-order parity bar** — which fields of stock `procedure_order` are mandatory for D3 sign-off vs dropped as unused?

---

## 10. Version history

| Version | Date | Change |
|---|---|---|
| v0.1.0 | 2026-07-07 | Initial gap analysis + redesign plan (§1–§9), first audit pass |
| v0.1.1 | 2026-07-07 | Second-pass audit: off-menu surfaces added (G11, W10–W11, A6) |
| v0.1.2 | 2026-07-11 | Re-verified A1 (Office Notes) against current code before starting the build: dropped the unbacked "pin toggle," corrected the ACL story (new `office_notes_acl` policy branch + `$coreGrants` wiring needed, not a free reuse of stock ACL), renamed the ajax action domain to `office_notes.*` to avoid colliding with the existing `core_notes_acl` policy type, corrected the module page count (23, not 24). Build of A1 started same day. |
| v0.1.3 | 2026-07-11 | A1 (Office Notes) and A2's per-patient Documents tab built and merged to main, closing G1 and the per-patient half of G2. Merge review found the pre-build v0.1.2 draft wrong on two points once checked against the real code: pin *was* shipped (via a companion table `new_office_note_meta`, not a core schema change) and the ACL needed zero new `acl_setup.php` grants (stock `Clinicians` group membership already covers `encounters/notes` + `patients/docs` for every New Clinic role via `ClinicRolesService`). One code-review fix applied before merge: Office Notes error messages switched to the shared `deskCalloutClass()` convention. A2's clinic-wide "unfiled documents" inbox lens remains open. |
| v0.1.4 | 2026-07-11 | A2's "unfiled documents" inbox lens shipped in `report-hub`, closing G2 fully. Discovered report-hub's lens system is a hardcoded 6-member enum + generic date-range card catalog, not a registry — the 7th lens needed special-casing across 4 files plus a Twig toolbar button, not a drop-in catalog card. Added `documents.unfiled_list`/`documents.assign_patient` actions (reusing the existing `patients_docs_acl` policy — no new ACL type) and a new `new_reception`/`new_admin` tab-visibility gate. Live browser verification surfaced a pre-existing, already-tracked scalability gap (PHP session-file-locking queues concurrent same-session requests because no handler calls `session_write_close()` yet) — correctly attributed to `NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md`, not treated as a defect in the new code. |
| v0.1.5 | 2026-07-11 | Re-verified A3 (Address Book) before starting the build — the most stale pre-build draft of the three GAP-A items done so far: fabricated "Hospital" `abook_type` category (real list has none — Specialist/Lab Service/Imaging/Immunization/Vendor/Distributor/External Provider/External Organization/Billing Service/Care Coordination/EMR Direct), wrong UI pattern (`Sheet` has no admin-hub CRUD precedent — `Dialog` does, via `VisitTypeModal`/`FeeModal`), wrong ACL (`admin/practice` is never checked by this module's `ajax.php` and isn't granted to `new_admin` by any seed path — would 403 real pilot admins; correct gate is the module's own `new_admin` ACO), wrong referral-component name (`PatientReferralsLetters` doesn't exist; real files are `ReferralWizard.tsx`/`ReferralsPane.tsx`), and an understated safety requirement (writing to the shared `users` table risks corrupting real staff login/ACL rows without stock's exact `username=''`/`authorized=0` guard on every query). |

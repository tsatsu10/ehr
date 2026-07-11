# New Clinic — OpenEMR Coverage Gap Analysis & Comprehensive React Redesign Plan

**Version:** v0.1.2 · **Date:** 2026-07-11 · **Status:** GAP-A underway (A1 build started)
**v0.1.1:** second-pass audit added off-menu surfaces (MFA, login/auth, issue editor, growth charts, authorizations, record request, background-service monitors) — see G11, W10–W11, A6.
**v0.1.2:** re-verified A1 (Office Notes) against current code before build start — corrected the
`onotes` schema/UI claims, the ACL story, and the page-count headcount; see the A1 entry in §5 and
the version-history table at the bottom. Confirms the general rule from CLAUDE.md §12: trust the
code over this doc's status claims, then fix the doc — applied here for the first time this doc
gets touched during actual implementation rather than a planning pass.

This document answers two questions:

1. **Gap analysis (§1–§3):** Which parts of stock OpenEMR has the New Clinic module *not* yet addressed — audited against the full core menu tree (`interface/main/tabs/menu/menus/standard.json`), the implementation scorecard, and `OPENEMR_AREAS_NOT_ADDRESSED.txt`.
2. **Redesign plan (§4–§8):** A comprehensive, phased plan to close every closable gap using the **React island architecture and shared components we already ship** — no new frameworks, no new patterns.

Read alongside: [PRD](../done/NEW_CLINIC_V1_PRD.md) · [Scorecard](../NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md) · [UI/UX Plan](../NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md) · [OPENEMR_AREAS_NOT_ADDRESSED.txt](../OPENEMR_AREAS_NOT_ADDRESSED.txt)

---

## 0. TL;DR

- **Daily clinical flow is covered.** All role desks (M1–M9), Visit Board, MRD chart, Scheduling, Communications, Registry, Admin Hub, Reporting, and the post-pilot ops hubs (M11–M18) exist as React islands at 72–100% completion.
- **Three kinds of gaps remain:**
  - **Tier 1 — Unaddressed, in-market:** stock screens a cash-clinic actually uses that have *no* New Clinic treatment (Office Notes, Documents manager, Address Book, patient labels/letters, Batch Communications, patient/clinical reminders, MFA enrollment, i18n).
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
| G1 | **Office Notes** | `interface/main/onotes/office_comments.php` | Clinic-wide sticky notes ("fridge broken", "Dr. A away Friday"); staff use it daily in stock installs | No island, no link |
| G2 | **Documents manager** (patient + global) | `controller.php?document`, `interface/main/display_documents.php` | Scanned IDs, referral letters, lab PDFs land here; MRD only deep-links per-patient | Deep-linked only; no upload/browse UI in module |
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

#### A1. Office Notes → new **`office-notes`** island (closes G1)

*Re-verified against current code 2026-07-11 before build start (see history table). Corrections
from the original draft below are marked ⚠.*

- **Host:** `public/office-notes.php` (T1 shell), following the `communications.php` precedent:
  `ClinicConfigService::isEnabled('enable_office_notes', 0, $facilityId)` gates the page; disabled
  → 302 redirect to stock `interface/main/onotes/office_comments_full.php`. Card on desks' hub
  navigation; also embeddable in `report-hub` as a lens (unchanged from original plan).
- **UI:** single-column feed of `WidgetCard` notes with author/date, active/archived
  `SegmentedControl` (backed by the stock `activity` column — `enableNoteById`/`disableNoteById`);
  compose box reusing COM composer styling; `RowActionsMenu` for edit/archive.
  ⚠ **No pin toggle** — the stock `onotes` table (`id, date, body, user, groupname, activity`) has
  no pin/priority column and `ONoteService` has no such concept. Dropped from V1 scope; a pin
  feature would require a real schema change, which contradicts the "no schema change" design
  goal for this item. Revisit only as its own follow-up spec if a clinic actually asks for it.
- **Backend:** `ajax.php` actions `office_notes.list|save|update|archive|unarchive` — domain
  renamed from the original `onotes.*` to `office_notes.*` to avoid colliding with the unrelated
  `core_notes_acl` policy name already in `AjaxActionPolicy` (see ACL note below). Delegates to a
  new `OfficeNotesService` wrapping the existing stock `ONoteService`/`onotes` table — confirmed
  **no schema change** needed for list/save/archive.
- **ACL:** ⚠ more than "same as stock" — `AclMain::aclCheckCore('encounters', 'notes')` is the
  correct stock check, but it needs its **own** new policy branch (`office_notes_acl` type →
  `AjaxController::requireOfficeNotesAcl()`), distinct from the existing `core_notes_acl` type
  (which checks the unrelated `patients/notes` section for Communications Hub — reusing it by
  mistake would gate office notes on the wrong ACO). No `new_clinic`-section ACO exists for this
  today, and New Clinic role groups aren't auto-granted arbitrary stock ACOs — grant access via a
  `$coreGrants` entry in `acl_setup.php` (precedent: the `acct/rep` and `patients/pat_rep` grants
  already there), rather than assuming it's free.
- **Toggle:** `enable_office_notes`, default OFF, added to `install.sql` (`#IfNotRow2D` block,
  precedent: `enable_bill_ops`/`enable_report_hub`) and to `adminFieldDefs.ts` (M6 Clinic tab).
- **Effort:** S (1–2 sessions) — unchanged; the corrections above are scope clarifications, not
  scope growth.

#### A2. Documents manager → **`patient-chart` Documents tab + `doc-inbox` pane** (closes G2)

- **UI (per-patient):** new "Documents" section in MRD Profile tab: `DataTable` of documents (category, date, uploader), drag-drop upload zone, preview in `SlideOver` (PDF/image `<iframe>`/`<img>`), category move via `native-select`, delete behind `ConfirmModal`.
- **UI (clinic-wide inbox):** "Unfiled documents" lens in `report-hub` for scans awaiting patient assignment, reusing `PatientSearchDropdown` to file them.
- **Backend:** `ajax.php` actions `documents.list|upload|recategorize|delete` delegating to core `Document` classes and `C_Document` semantics; uploads via `multipart` branch in `oeFetch` (extend once, reuse everywhere).
- **ACL:** `patients/docs`. **Toggle:** `enable_documents_native`.
- **Effort:** M (3–4 sessions). Highest daily value in this phase.

#### A3. Address Book → **Admin Hub "Directory" tab** (closes G3)

- **UI:** new tab in the existing `admin-hub` island: `DataTable` of external contacts (specialists, hospitals, labs) with type filter chips (`ChipCloud`), row edit in `Sheet` drawer form, add via the same drawer. Referral pickers in M11 (`PatientReferralsLetters`) switch from free text to a `command`-palette lookup against this directory.
- **Backend:** `ajax.php` actions `directory.list|save|delete` over the core `users` table `abook_type` rows (stock address book storage — no new table).
- **ACL:** `admin/practice`. **Effort:** S–M (2 sessions).

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

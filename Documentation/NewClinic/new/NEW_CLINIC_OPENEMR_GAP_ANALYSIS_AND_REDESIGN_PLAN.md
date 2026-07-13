# New Clinic — OpenEMR Coverage Gap Analysis & Comprehensive React Redesign Plan

**Version:** v0.1.33 · **Date:** 2026-07-13 · **Status:** GAP-A COMPLETE (G1–G5, G11); GAP-B core done. **GAP-C COMPLETE** — C1 audit (W4), C2 fee bulk-price CRUD (W5), C3 scoped lists editor (W7), C4 drug-catalog CRUD (W8), C5 people/access (W1), C6 backup engine + recovery-key custody + **separate incremental site-files backup** (W3). **GAP-D essentially COMPLETE** — D1 i18n foundation (G8 mechanism; French seeded, `t()` string sweep **PAUSED at 3/25 islands** — office-notes, proc-order, my-profile — resume tracker in §5), D2 merge guardrail (G10), D3 native proc-order form (W2 top slice; full native form behind `enable_native_proc_order`, write-path signed off via live-DB smoke), D4 native issue editor (W10), D5 record-request reachability (W12) done; **D6 de-Bootstrap resolved to the worthwhile extent — collision bug fixed + `bs:check`-guarded, Twig clean; wholesale theme cutover deferred by decision (module borrows FontAwesome + base font from the theme; not worth rebuilding the base layer since the actual bug is already gone). Toggle retained as a dev tool**. New: `NEW_CLINIC_BACKUP_SYSTEM_DESIGN.md` (v0.5.0 — site files now backed up as a **separate incremental per-file-encrypted mirror**, closing the last backup gap). Deferred: real SMS gateway, outreach wizard/scheduling, native growth overlay (LMS data) · D6 in GAP-D
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
**v0.1.6:** A3 (Address Book → Admin Hub Directory tab) built and verified, closing G3 — all of
Phase GAP-A's daily-use items involving G1/G2/G3 are now shipped. `ChipCloud` turned out to be a
non-interactive alert-badge component, not a filter selector — used a plain type dropdown instead.
Live testing found (not a bug, a mis-assumption caught by testing rather than shipped unverified):
"External Organization" is stock `option_value = 1` (person-centric) despite the name suggesting
otherwise — only 6 of the 12 `abook_type` values are actually company-centric. The safety guard
protecting real staff login rows from directory writes is proven by a dedicated PHPUnit test, not
just asserted. See A3 in §5.
**v0.1.7:** A4 (Letters & labels → chart-depth + patient-chart) built and verified, closing G4.
The pre-build draft's central claim was wrong on research: stock letters use flat-file templates
in `documents/letter_templates` with `{TOKEN}` replacement — NOT the `document_templates` table
(that's the patient-portal system). Built on the real stock engine so templates are
interchangeable with the legacy screen. `TO_*` recipients come from the A3 directory. Post-build
audit found and fixed a pre-existing chart-killing crash (`PaymentsStrip` rendering the
`last_receipt` object as a React child). See A4 in §5.
**v0.1.8:** added D6 (de-Bootstrap the module shell) to GAP-D after the Admin Hub "read-only
checkboxes" incident: Bootstrap 4's `!important` utilities share class NAMES with Tailwind's
(`bg-white`, `border`, `rounded-sm`, …), silently freezing any island control whose state
styling uses a colliding class. Checkbox fixed immediately via unlayered `nc-checkbox` BEM in
the shell's `components.css` (covers every island); D6 tracks the full sweep + module-page theme
cutover that permanently retires this bug family. See D6 in §5.

This document answers two questions:

1. **Gap analysis (§1–§3):** Which parts of stock OpenEMR has the New Clinic module *not* yet addressed — audited against the full core menu tree (`interface/main/tabs/menu/menus/standard.json`), the implementation scorecard, and `OPENEMR_AREAS_NOT_ADDRESSED.txt`.
2. **Redesign plan (§4–§8):** A comprehensive, phased plan to close every closable gap using the **React island architecture and shared components we already ship** — no new frameworks, no new patterns.

Read alongside: [PRD](../done/NEW_CLINIC_V1_PRD.md) · [Scorecard](../NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md) · [UI/UX Plan](../NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md) · [OPENEMR_AREAS_NOT_ADDRESSED.txt](../OPENEMR_AREAS_NOT_ADDRESSED.txt)

---

## 0. TL;DR

- **Daily clinical flow is covered.** All role desks (M1–M9), Visit Board, MRD chart, Scheduling, Communications, Registry, Admin Hub, Reporting, and the post-pilot ops hubs (M11–M18) exist as React islands at 72–100% completion.
- **Three kinds of gaps remain:**
  - **Tier 1 — Unaddressed, in-market:** stock screens a cash-clinic actually uses that have *no* New Clinic treatment. **Closed:** Office Notes (G1), Documents manager (G2, both per-patient and clinic-wide unfiled inbox), Address Book (G3). Still open: patient labels/letters, Batch Communications, patient/clinical reminders, MFA enrollment, i18n.
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
| G3 | **Address Book** | `interface/usergroup/addrbook_list.php` | Referral targets (specialists, hospitals) power M11 referrals & letters; currently edited in a 2005-era screen | **Closed** — Admin Hub Directory tab, 2026-07-11 |
| G4 | **Letters & printed artifacts** | `patient_file/letter.php`, `label.php`, `addr_label.php`, `barcode_label.php` | Referral letters exist (V1.1-CDb) but generic letter templates, chart/address/barcode labels do not | **Closed** — Letters composer + chart/address/barcode labels behind `enable_letters_labels`; header "Print / Letters" menu + Clinical-tab "Open referrals" entry points, 2026-07-11 |
| G5 | **Patient / clinical reminders** | `patient_file/reminder/` | Distinct from COM dated reminders; recall-adjacent follow-up nudges per patient | **Closed** — chart "Flag for follow-up" creates a `follow_up` recall in the existing S1 Recalls worklist (no parallel `patient_reminders` store); CDR reminders already shown read-only in the chart Messages tab, 2026-07-11 |
| G6 | **Batch Communication Tool** | `interface/batchcom/` | SMS/email outreach campaigns (vaccination drives, recall blasts) — high value in West Africa via SMS | **Core built (2026-07-11); email delivery real (2026-07-12)** — `outreach` island behind `enable_outreach` (OFF). **Email now actually sends** via `EmailOutreachGateway` (OpenEMR `MyMailer`/clinic SMTP; no provider account needed). **SMS still stubbed** (needs a provider adapter behind the same port). Custom filter builder + scheduling + per-recipient log pending |
| G7 | **Patient Education** | `reports/patient_edu_web_lookup.php` | Handout lookup at the doctor desk | **Closed** — Doctor Desk "Patient handouts" quick action (native SlideOver over the clinic-configurable `external_patient_education` resource list), 2026-07-11 |
| G8 | **Language / i18n** | `interface/language/` | New Clinic UI strings are hard-coded English; core has a translation engine we bypass | **Mechanism closed (2026-07-12)** — `t()` runtime + locale plumbing + extraction + lint fence (D1); Twig shell was already on `xl()`. String sweep continues desk-by-desk (office-notes seeded) |
| G9 | **Track Anything / flowsheets** | `forms/track_anything/` | Longitudinal tracking (BP series, glucose, weight) beyond single-visit vitals | **Vitals trends built** — chart Clinical-tab "Vitals trends" panel (SVG series over `form_vitals`, `enable_vitals_trends` OFF by default), 2026-07-11. Pediatric growth-percentile overlay (W11) → B2b pending |
| G10 | **Duplicate merge (post-hoc)** | `patient_file/merge_patients.php`, `manage_dup_patients.php` | Front Desk prevents dupes at intake (NG12 bars *automated* merge), but manual cleanup still requires the stock screen | Deep-linked from M15 Advanced only |
| G11 | **MFA enrollment (TOTP/U2F)** | `interface/usergroup/mfa_registrations.php` | Admin spec flags MFA as security best practice on shared clinic PCs ("optional P1"); `my-profile` has password change but no MFA setup, and Admin Hub People lens doesn't surface enrollment status | **Closed** — `my-profile` Security section: TOTP enroll (QR + verify code) + remove (password) over stock `login_mfa_registrations`/`Totp`; Admin Hub People-lens staff drawer shows a read-only "Two-step sign-in" On/Off pill, 2026-07-11 |

### Tier 2 — Wrapped or deep-linked, not yet redesigned (convert the high-traffic ones)

| # | Core area | Current wrapper | Traffic | Convert? |
|---|---|---|---|---|
| W1 | People/ACL advanced (gacl, facility×user) | `admin-people-legacy.php` iframe views (`acl_admin`, `facility_user`) | Low (admin-only) | **Closed (2026-07-11)** — native facility×user matrix + panel + save; `facility_user` legacy view retired; `acl_admin` (gacl) kept as last resort with an expert-mode warning banner |
| W2 | LBF / encounter form engine | `clinical-form-bridge.php` | **High** (every non-native visit form) | No rewrite (NG5) — native React shells for the top 3 forms by usage: **vitals ✓, consult ✓, procedure order ✓** (D3, `enable_native_proc_order`, browser sign-off pending). Engine stays for the long tail |
| W3 | Backup / restore | M15 gateway card → `backup.php` | Low | **Native encrypted backup engine + history done (2026-07-11)** — `AdminBackupService` runs a real mysqldump → stream-gzip → CryptoGen-encrypt → target dir, records true path/size, prunes retention (behind `enable_native_backup`, super-admin). SEC6-aligned. Restore stays manual (key custody). See `NEW_CLINIC_BACKUP_SYSTEM_DESIGN.md` |
| W4 | Audit log viewer | M15 links → `logview.php` | Medium (incident review) | **Closed (2026-07-11)** — native read-only Audit log card in the Admin Hub System tab (date/user/text/result filters, pagination, detail SlideOver, CSV export). Tamper-check stays stock |
| W5 | Codes / superbill admin | Stock `superbill_custom_full.php` | Medium (fee schedule upkeep) | **RESOLVED (2026-07-13) — this row was stale AND the original scope was wrong.** Admin Hub's Fees tab already ships full fee-schedule CRUD (add/edit/archive/bulk-price/CSV import, GAP-C C2) — confirmed still current. `billing_code` on a fee line is free text, never validated against the core `codes` table (checked `CashierService`/billing-post path), so a cash clinic never actually needs the stock Codes screen for normal operation. The row's literal target, `superbill_custom_full.php`, IS what stock OpenEMR calls "Codes" (confirmed via `standard.json`'s own menu) but its scope centers on revenue codes / UB04 institutional-claims administration — insurance/EDI territory, a documented PRD non-goal for this cash-only product; building native CRUD for it would be out-of-scope work. **Real bug found and fixed:** the Fees tab's "Open OpenEMR Codes admin" escape-hatch link pointed at the wrong screen (`layout_service_codes.php`, a layout-attribute uploader unrelated to code administration) — corrected to `superbill_custom_full.php`. Nothing else to build. |
| W6 | Calendar categories/admin | Stock PostCalendar admin | Low | Fold into Admin Hub Clinic tab (visit types already native) |
| W7 | Lists (`edit_list.php`) & Layouts (`edit_layout.php`) | Stock screens | Medium | **RESOLVED (2026-07-13) — this row was stale AND its examples were wrong.** Admin Hub already ships a native lists editor (`ListsEditorCard`/`AdminListEditorService`, GAP-C C3) with real add/edit/reorder/hide CRUD — confirmed still current. The row's own examples ("regions, visit reasons") were never valid targets for this feature: regions come from `GeoService`'s JSON seed and visit reasons from the native `new_visit_type` table — neither is a `list_options` row, so a `list_options` editor could never have covered them (they already have their own correct native homes). Checked every other `list_options` list the module touches for a genuine remaining gap: `warehouse` isn't `list_options` (owned by pharm-ops setup); `rule_action`/`rule_action_category` are CDR-only (disabled in the cash profile — irrelevant); `abook_type` (directory contact categories) IS read/filtered by the Directory tab with no admin UI to add one — but its `option_value` column is load-bearing in stock `addrbook_edit.php` (drives person-vs-company field rendering) and this editor's write path never sets it, so adding it would let an admin silently create a category that misrenders the moment anyone opens that contact on the stock screen. Deliberately left off the allow-list (test added pinning the exclusion + reasoning) rather than shipped half-safe. Layouts: still stock (NG5), unchanged. Nothing to build. |
| W8 | Drug inventory *admin* (`drug_inventory.php`) | Stock screen; pharm-ops covers transactions | Medium | **RESOLVED (2026-07-13) — this row was stale, doc rot only.** `PharmCatalogAdminService::saveDrug()` does real INSERT+UPDATE against the `drugs` table (name, form, size, unit, route, reorder point, NDC, active, dispensable) via `PharmOpsCatalogPanel`/`PharmOpsSetupPanel` (GAP-C C4) — confirmed still current, matches the gap's ask exactly. Plus CSV formulary import and a controlled-substance catalog. `drug_inventory.php` deliberately stays the "advanced gateway" for rare stock-admin operations outside daily catalog upkeep — a reasonable, intentional scope line, not a gap. Nothing to build. |
| W9 | Practice Settings (pharmacies, insurers, x12) | `controller.php?practice_settings` | Low (cash profile) | Pharmacy list only (needed for Rx print); rest stays stock |
| W10 | Issue editor (problems/allergies/meds **write**) | Core popup `add_edit_issue.php` deep-linked from MRD Clinical tab | **High** (every chronic-condition update) | Yes — native issue drawer in `patient-chart` (see D4) |
| W11 | Growth charts (pediatric percentiles) | Stock static CSS/PDF pages (`interface/forms/vitals/growthchart/`) | Medium (pediatric-heavy outpatient mix) | **Deep-linked (2026-07-11)** — "Growth chart" link from the Vitals Trends panel for under-20s opens the stock CDC/WHO chart. Native percentile overlay NOT built (repo ships only PNG images, no numeric LMS data — see B2b note) |
| W12 | Patient Record Request | `patient_file/transaction/record_request.php` | Low | **RESOLVED, N/A (2026-07-13) — this row was a documentation error.** Fresh code research: `record_request.php` does NOT write to the `transactions` table and is NOT part of the LBT transaction-type registry (`grp_form_id LIKE 'LBT%'`) the M11 wrapper filters on — the original "verify the transaction type renders there" premise doesn't apply to it. It's a standalone one-button screen toggling `amc_misc_data.provide_rec_pat_amc`, a **US Meaningful Use/MIPS "timely records access" core-measure compliance flag** — regulatory tracking for a US CMS incentive program, not a cash-clinic workflow, and out of this product's market by nature (no EDI/claims/US-certification target). Zero references anywhere in the New Clinic module. The genuine need the title evokes — "give a patient a copy of their record" — is **already shipped**: M11/CDc Patient Clinical Export (`ClinicalExportService`, `chart_depth.export_builder`/`export_generate`). No routing fix needed; nothing to build. |

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

#### A3. Address Book → **Admin Hub "Directory" tab** (closes G3) — **BUILT (2026-07-11)**

*Re-verified against current code before build start (five real staleness points, more than A1 or
A2 — see the v0.1.5 history entry), then built and verified. One more correction surfaced only
during live testing, marked ⚠ below.*

- **UI — BUILT:** new tab in the existing `admin-hub` island (`ADMIN_TABS`/`AdminTabId` in
  `adminTypes.ts`, wired through `AdminHub.tsx`/`AdminHubTabPanels.tsx`), always-on (no toggle).
  `DirectoryTab.tsx`: table of contacts with a type filter (`NativeSelect` dropdown, not
  `ChipCloud` — `ChipCloud` turned out to be a non-interactive severe/warn alert-badge component,
  not a clickable filter selector; also the real category count, 12, doesn't suit a chip row).
  `DirectoryModal.tsx`: add/edit in a `Dialog` (precedent `VisitTypeModal`/`FeeModal`), switching
  between person fields (title/first/last name) and an organization-name field based on the
  selected type's `is_company` flag. Delete behind the shared `AdminHubConfirmModal`
  (`delete_directory_contact` case added to the `AdminConfirm` union).
  ⚠ **"Company-centric" doesn't map onto category names the way it sounds.** Only 6 of the 12
  stock `abook_type` values are actually `option_value = 3` (company-centric): Imaging Service,
  Immunization Service, Lab Service, Vendor, Distributor, Billing Service. "External Organization"
  — despite the name — is stock `option_value = 1` (person-centric), confirmed only by testing it
  live, not by assuming from the label. The UI correctly follows the real per-type flag from the
  backend rather than any hardcoded list, so this needed no code change — just don't assume from
  category names when testing or extending this later.
  Referral-target picker in M11 (`ReferralWizard.tsx`) swapping its free-text destination for a
  `Command`-based lookup against this directory **stays a follow-up, not built in this batch**.
- **Backend — BUILT:** `ajax.php` actions `admin.directory.save|delete` (list comes back embedded
  in `admin.config`'s payload, matching the Visit Types/Fees precedent — not a separate
  `directory.list` action as first planned) via `DirectoryContactService`, over the core `users`
  table's `abook_type` rows. Every read/write/delete carries the exact
  `username = '' OR username IS NULL` guard stock's own screens use to keep contacts and real
  staff logins apart — proven, not just asserted: a PHPUnit test seeds a fake real-username row
  and confirms `listForAdmin()` never returns it and `save()` refuses to touch it.
- **ACL:** `new_admin` (`AjaxActionPolicy.php`'s `SINGLE_ACL` map → `AclMain::aclCheckCore('new_clinic', 'new_admin')`),
  matching every sibling admin-hub CRUD tab — not stock `admin/practice`, which would have 403'd
  every real pilot admin.
- **Toggle:** none — always-on alongside Visit Types/Fees, matching the "core clinic setup" group
  (`enable_admin_hub` only gates `system`/`forms`).
- **Verification:** frontend `npm run check` (lint + typecheck + 412 vitest) + `npm run build`
  green; backend static `verify-module.php` PASS; full NewClinic PHPUnit suite 898/898. Live
  browser smoke: added a person-centric contact (Specialist) and a company-centric one (Vendor),
  confirmed correct field switching, save, list display, delete — zero console/network errors,
  9 real staff accounts confirmed untouched throughout.
- **Effort:** S–M (2 sessions) — matched the estimate.

#### A4. Letters & labels → extend **chart-depth** (closes G4) — **BUILT (2026-07-11)**

*Re-verified against current code before build, then built and verified. The pre-build draft's
single biggest claim was wrong: stock letters do NOT use the `document_templates` table (that's
the patient-portal template system, pid/profile-scoped). Corrected against the real engine.*

- **UI (letters) — BUILT:** the chart-depth referrals hub (`chart-depth/referrals.php`, already
  titled "referrals & letters hub") gains a `SegmentedControl` [Referrals | Letters] when the
  toggle is on. `LettersPanel.tsx`: template `NativeSelect` + "To (directory contact)"
  `NativeSelect` (fed by the A3 directory — `TO_*` tokens come from address-book `users` rows),
  "Fill from template" → editable letter-body textarea, "Print letter" submits a plain hidden
  form POST (stock `letter.php` parity; body carried in a hidden `<textarea>` so newlines survive)
  to `letter-print.php` in a new tab.
- **UI (entry point) — "Print / Letters" chart-header menu (Printer icon):** one discoverable
  dropdown in the patient-chart header actions — **Referral letter…** (deep-links to the hub's
  Letters view), a separator, then chart label / address label / MRN barcode label. **Discoverability
  fix (2026-07-11, post-build):** the first cut reached Letters only via the Clinical tab's
  "Open referrals" link, which `ReferralCorrespondenceService::getClinicalStrip()` hid whenever
  the patient had zero referrals on file (`'hidden' => $items === []`) or no active encounter — so
  a patient with no referrals yet had NO path to the Letters composer, exactly the case where you'd
  want to write the first letter. The header menu is unconditional on referral history (gated only
  on `enable_letters_labels`), so Letters is always reachable. **Root-cause fix (2026-07-11, follow-up):**
  the Clinical-tab strip itself no longer hides on empty — `getClinicalStrip()` now hides only when
  there are no referrals AND the user cannot open the hub (`'hidden' => $items === [] && !$canOpen`),
  so with an active encounter + view ACL the "Open referrals" entry point renders even at zero
  referrals (empty summary "No referrals on this visit yet."), matching the Visits-tab link's
  enabled-plus-ACL reachability rule rather than referral history.
- **Labels:** the three label types (chart/address/barcode) live in that same menu, each opening
  `patient-label.php?type=…&print=1` in a new tab.
- **Hub decoupling:** `chart-depth/referrals.php` now opens when EITHER the chart-depth referral
  sub-feature OR `enable_letters_labels` is on (was: both referral flags required), accepts
  `?view=letters` to land on the Letters segment, and the island shows only the panels the clinic
  enabled — so a letters-only clinic gets a clean single-panel Letters hub with no dead Referrals tab.
- **Template engine — the big correction:** templates are the STOCK flat files in
  `sites/<site>/documents/letter_templates` (decrypt-aware for `drive_encryption`, `autosaved` and
  dotfiles excluded), with stock `letter.php`'s exact `{TOKEN}` vocabulary (`PT_*`, `FROM_*` from
  the sending user, `TO_*` from the contact, `DATE`) — both raw and translated `{xl(KEY)}` forms.
  A template authored on the stock screen renders identically here and vice versa; no second
  template store. Template *authoring* stays on the legacy screen (still reachable), per scope.
- **Backend — BUILT:** `LettersService` (lazy getters, no ctor cycles); ajax `letters.templates`
  (templates + contact picker in one call) and `letters.render` in `ChartDepthActionHandler`,
  policy-registered as deferred chart-read actions with the same
  `new_chart_depth_referral`/`new_chart_depth` primary ACLs as `chart_depth.referrals_list`.
  `letter-print.php` (POST-only, CSRF-verified, body length-capped, `|text`-escaped into a
  `pre-wrap` Twig view, audited) and `patient-label.php` (GET, clinic-role ACL, audited) follow
  the `queue-slip.php`/`rx-print.php` print-page pattern. Barcode = Code 128 PNG data-URI via the
  core-vendored `Barcode::gd()` (`library/classes/php-barcode.php`) on a GD canvas — no FPDF/PDF
  dependency, guarded to degrade to a "Barcode unavailable" note if GD or the class is missing.
  Contact reads carry the same `username = '' OR username IS NULL` guard as A3.
- **Toggle:** `enable_letters_labels` (default OFF, one flag for both halves like A2), wired in
  all three places per the flag-visibility checklist (install.sql, `EDITABLE_SETTINGS`,
  `adminFieldDefs.ts` key + rendered field) with a regression test asserting exactly that.
- **Verification:** `composer verify:new-clinic` PASS (270 actions); full NewClinic PHPUnit
  918/918 (5 new `LettersServiceTest` tests — one caught a real dotfile-listing gap in
  `listTemplates()` before merge); frontend lint + typecheck + 426/426 Vitest (LettersPanel,
  PatientChart label-menu, PaymentsStrip tests added); live Playwright smoke green end-to-end
  (template list, token fill against a real patient + directory contact, print view, all three
  label types incl. rendered barcode `<img>`, label menu on the chart).
- **Post-build audit bonus:** the live smoke exposed a pre-existing crash unrelated to A4 —
  `PaymentsStrip.tsx` rendered `last_receipt` (an object from `ProfilePaymentsSummaryService`)
  directly as a React child (its type said `string | null`), killing the entire patient-chart
  island for any patient with a receipt once chart-depth finance is on. Fixed + regression test.
- **Effort:** M — 1 session (estimate was 2–3).

#### A5. Patient reminders → **chart "Flag for follow-up" → existing S1 Recalls worklist** (closes G5) — **BUILT (2026-07-11)**

*Re-researched before build (2026-07-11) and the original plan below was **superseded** — a
classic stale-spec catch. The pre-build draft proposed a new `patient_reminders` "Patient
follow-ups" lens in the Communications Hub. Two findings killed that: (1) `patient_reminders` is
the **CDR clinical-rules output** table (`due_status`/`category`/`item` → `rule_action_item`),
already surfaced **read-only** in the chart Messages tab (`PatientChartMessagesService::fetchPatientRuleReminders`,
author "Clinical rules") — writing manual rows into a rules-output table is off-pattern; (2) a full
**Recalls** system already exists (`SchedulingRecallsService`, S1 lens) on `medex_recalls` +
`new_clinic_recall_meta`, with a `follow_up` recall type, status lifecycle, worklist, and messaging
— i.e. the "flag a patient for follow-up" need was already met. Building the lens would have stood
up a duplicate follow-up surface. The plan itself even said A5 should "feed the S1 recall
worklist" — S1 IS Recalls.*

- **What was built instead:** a per-patient **"Flag for follow-up"** action in the patient-chart
  header (`FollowUpFlagModal.tsx`: due date defaulting to +14 days + optional reason) that creates
  a recall of type `follow_up` (status `open`) via `SchedulingRecallsService::flagFollowUp()`. The
  clinic works it from the existing Recalls lens — one follow-up home, no parallel store.
- **Backend:** `scheduling.recalls.flag_follow_up` action (POST, CSRF, wrong-patient guard via
  `assertPatientChartPid`) → `flagFollowUp(pid, dueDate, reason, actor)` inserts `medex_recalls`
  (provider defaults to `patient_data.providerID`, then the acting user) + `upsertMeta` with
  `recall_type='follow_up'`. Registered in `SCHEDULING_WRITE_ACTIONS` (`scheduling_write_acl`).
- **ACL/gating:** identical to every other recall write — `assertHubAccess()` (scheduling enabled +
  `new_reception`/`new_reception_lead`/`new_nurse`/`new_admin`) **and** `canBookAppointment()`
  (core `patients/appt`). The chart button is shown only when both hold (new
  `SchedulingAccessService::canAccessHub()` + `can_flag_follow_up` prop). Doctors are intentionally
  excluded — reception/nurse own the call-backs — matching the recall model. No new flag; gated by
  the existing scheduling enablement.
- **Verification:** frontend `npm run check` + `npm run build` green (3 new `FollowUpFlagModal`
  Vitest); backend `verify-module.php` PASS; 3 new `SchedulingRecallsServiceTest` cases (ACL denial,
  invalid date, missing patient).
- **Effort:** S — 1 session (estimate was M/2). Smaller because it reused Recalls end to end.

#### A6. MFA enrollment → **`my-profile` Security section + People lens status** (closes G11) — **BUILT (2026-07-11)**

*Re-researched before build: the enrollment engine is core `Totp` (`library/classes/Totp.class.php`,
RobThree TOTP + Bacon QR), the store is stock `login_mfa_registrations` (`var1` = CryptoGen-encrypted
base32 secret), and `MfaUtils` is only the login-time **check** side — not enrollment. The stock
`mfa_totp.php` screen saves the secret on QR display without ever verifying a code; this build is
deliberately stricter.*

- **UI — BUILT:** `MfaSecuritySection.tsx` in `my-profile` (a "Security" `AdminSection`): shows
  authenticator On/Off, **Set up** flow (confirm password → scan QR + shown secret → **enter a
  6-digit code**), and **Remove** behind the shared `ConfirmModal` with password re-entry. Directory
  (AD) accounts get a "managed by your directory" note instead. Inline stepper matches the island's
  existing password-change style.
- **Backend — BUILT:** `MfaEnrollmentService` + `profile.mfa.status|enroll_start|enroll_verify|remove`
  actions in `ProfileActionHandler` (`desk_acl`, self-scoped — every method acts only on the session
  user id the handler passes, never a body-supplied target). Two guards stricter than stock: the
  secret is held in the session and **only persisted after a valid code is proven** (`enroll_verify`),
  and **remove requires the password**. Reuses core `Totp`/`CryptoGen`/`AuthUtils`; TOTP only, no U2F
  (V1 scope — shared clinic PCs rarely have per-user keys). Enroll + remove are audit-logged.
- **A6b — BUILT (2026-07-11), closes the rest of G11:** the Admin Hub People-lens staff-drawer
  (`StaffAccessSummaryDrawer`) now shows a read-only **"Two-step sign-in" On/Off** `Badge`, fed by a
  new `mfa_enabled` field on `StaffAccessSummaryService::getSummary()` (a `COUNT(*)` on
  `login_mfa_registrations`, any method). Read-only — enrollment stays self-service in `my-profile`.
  Same `new_admin` ACL as the rest of the summary; no new ajax action.
- **Verification:** frontend `npm run check` + build green (`MfaSecuritySection` tests: enroll flow,
  digit-stripping, remove-with-password, AD note); backend `verify-module.php` PASS (275 actions);
  `MfaEnrollmentServiceIntegrationTest` (status shape + expired-setup guard).
- **Effort:** S–M — 1 session for self-service (People-lens pill deferred).

### Phase GAP-B — Outreach & tracking

#### B1. Batch communications → new **`outreach`** island (closes G6) — **CORE BUILT (2026-07-11); slice 1 of an L feature**

- **UI — BUILT (single-page, not the full 4-step wizard yet):** new `outreach` island
  (`OutreachHub.tsx`): channel toggle (SMS/Email), **audience = a registry cohort preset**
  (`NativeSelect`, reusing `PatientCohortSearchService::presets()`), message composer, **mandatory
  dry-run "Preview recipients"** (reachable/total + cohort summary + a sample table), then **Queue
  campaign** behind a `ConfirmModal`. "Recent campaigns" table below. A persistent banner makes clear
  no gateway is wired yet.
- **Backend — BUILT:** `OutreachService` (`presets|preview|queue|history`) + `outreach.*` actions
  (`new_admin`, POST+CSRF for preview/queue). Audience resolution reuses the registry cohort search
  for matching + count + human summary, then a bounded supplementary query for real contacts (search
  only exposes a masked phone). Recipients capped at 500 for slice 1 (R2). Campaign recorded in a new
  `new_outreach_campaign` table; audited.
- **Gateway — STUB by design:** `OutreachGatewayPort` + `NullOutreachGateway` + factory (mirrors the
  recall-messaging port). V1 records intent and sends **nothing** — the real SMS/email provider
  (MoMo/SMS gateway, NG9-adjacent) is a **deferred, separately-specced** task; wiring it is a
  one-line factory change with no service edits.
- **Toggle:** `enable_outreach` (default OFF), wired in all three places; page redirects to stock
  `batchcom.php` when off.
- **Deferred (the rest of the L estimate):** the **patient-registry filter panel** embedded as a
  full custom cohort builder (slice 1 uses presets only), the 4-step wizard chrome, **scheduling**,
  **per-recipient delivery log** + stats, SMS/email templates with token chips, and the **real
  gateway adapter**.
- **Verification:** frontend `npm run check` + build green (`OutreachHub` tests: gateway banner,
  dry-run-before-queue, email-subject gating); backend `verify-module.php` PASS (280 actions);
  `OutreachServiceTest` (refuses when disabled).
- **Effort:** slice 1 in 1 session; remaining wizard/scheduling/gateway is the bulk of the original L.

#### B2. Flowsheets / longitudinal tracking → **MRD Clinical "Trends" panel** (closes G9) — **CORE BUILT (2026-07-11); growth overlay B2b pending**

- **UI — BUILT:** `VitalsTrendsPanel.tsx` in the `patient-chart` Clinical tab: a measure picker
  (`NativeSelect`) over whichever vitals have history (BP, pulse, respiration, temperature, SpO₂,
  weight, height, BMI, head circ), a new dependency-free **`components/TrendLineChart.tsx`** SVG
  chart (auto-scale, line + points, min/max + first/last labels, multi-series for BP
  systolic/diastolic, token colors, `role="img"` summary — built once, reusable for labs later),
  and a scrollable readings table. Hidden when the flag is off or the patient has no vitals history.
- **Backend — BUILT:** `mrd.clinical_vitals_series` (deferred chart-read, `assertPatientChartPid`
  wrong-patient guard) → `ClinicalVitalsSeriesService::getSeries()` aggregating stock `form_vitals`
  (activity=1, newest 60), read-only. Units follow the clinic's `units_of_measure` global; zero/blank
  treated as "not recorded". Only measures with ≥1 reading are returned.
- **Toggle:** `enable_vitals_trends` (default OFF), wired in all three places (install.sql,
  `EDITABLE_SETTINGS`, `adminFieldDefs` allowlist + field) — the panel is fetched only when on
  (no wasted request otherwise).
- **B2b — DEEP LINK BUILT (2026-07-11); native overlay still deferred.** Research killed the
  planned approach: the plan assumed "WHO/CDC reference data ships with stock growth charts," but the
  repo ships those curves **only as PNG images** (`interface/forms/vitals/growthchart/*.png`) — the
  stock `chart.php` overlays the patient's dots on the images by hardcoded pixel math; there is **no
  numeric LMS/percentile data** to reuse. A native SVG percentile overlay would require bundling a
  WHO/CDC LMS dataset, which must be *sourced and verified*, not fabricated — wrong growth
  percentiles are a real patient-safety risk. So what shipped is the **safe** half: a **"Growth
  chart" deep link** from the Vitals Trends panel for patients under 20 (`ClinicalVitalsSeriesService`
  computes age from DOB and returns a CSRF-tokened `growth_chart_url` to the stock chart, which draws
  the *real* CDC/WHO curves + this patient's points in a new tab). The fully-native overlay remains a
  future task, explicitly **gated on obtaining a verified LMS reference dataset** — do not hand-type it.
- **Backend note:** `track_anything` form aggregation was scoped out of the first cut — `form_vitals`
  covers the high-value BP/weight/SpO₂ series clinics actually chart; track_anything can extend the
  same service later.
- **Verification:** frontend `npm run check` + build green (`TrendLineChart` + `VitalsTrendsPanel`
  tests); backend `verify-module.php` PASS (276 actions); `ClinicalVitalsSeriesServiceIntegrationTest`.
- **Effort:** M — 1 session for the core panel + reusable chart (growth overlay deferred).

#### B3. Patient education → **Doctor Desk quick action** (closes G7) — **BUILT (2026-07-11)**

*Research corrected the approach: the stock `interface/reports/patient_edu_web_lookup.php` isn't a
MedlinePlus-only screen — it's a **clinic-configurable list** (`external_patient_education` in
`list_options`, each row's `notes` a URL with a `[%]` search placeholder). So no iframe of a
2011-era Bootstrap screen was needed; a clean native SlideOver drives the same list, and clinics
can point it at locally relevant handout sources (WHO, local health authorities, MedlinePlus…).*

- **UI — BUILT:** a "Patient handouts" **More** link in the Doctor Desk active-consult
  `ConsultShortcuts`, opening `PatientEducationSlideOver.tsx` — a resource `NativeSelect` + a
  condition/topic search box → **Open handout** launches the chosen resource in a new tab with the
  term injected (url-encoded) at `[%]`. Shown only when the clinic has resources configured.
- **Backend — BUILT:** `PatientEducationService::getResources()` (reads active
  `external_patient_education` rows → `{title, url}`), passed on the Doctor Desk page payload
  (`patient_education_resources`) — no new ajax action or flag; it degrades to a config hint when the
  list is empty.
- **Not built (deferred):** a native curated handout *library* (vs. external web search) — only worth
  it if usage shows demand, per the original "native list later if used" note.
- **Verification:** frontend `npm run check` + build green (`PatientEducationSlideOver` tests: term
  injection, url-encoding, disabled-until-typed, empty config); backend `verify-module.php` PASS;
  `PatientEducationServiceIntegrationTest`.
- **Effort:** S — 1 session, as estimated.

### Phase GAP-C — Admin depth (convert high-traffic Tier 2 wrappers)

#### C1. Audit log browser → **Admin Hub System lens** (closes W4) — **BUILT (2026-07-11)**

- **UI — BUILT:** `AuditLogCard.tsx` in the Admin Hub **System** tab (self-fetching card, the
  `LockedAccountsCard` pattern): date-range + user + free-text + result (success/failure) filters,
  a paginated `Table` with prev/next, a row-detail `SlideOver` (full comments + user notes), and
  **Export CSV** (client download of the server-built CSV). Threaded `ajaxUrl`/`csrfToken` into
  `SystemTab`.
- **Backend — BUILT:** `AuditLogService` (`query|detail|export`) over the core `log` table —
  strictly read-only and **always bounded** (page size ≤ 50; export ≤ 5000 rows). Filters are
  parameterized. `admin.audit.query|detail|export` actions in `AdminActionHandler`, `new_admin` ACL.
- **Not built (deliberate):** tamper-check / hash verification stays a gateway card to the stock
  `logview.php` (destructive/forensic, kept legacy).
- **Verification:** frontend `npm run check` + build green (`AuditLogCard` tests: load, filter apply,
  detail SlideOver); backend `verify-module.php` PASS (283 actions); `AuditLogServiceTest` (ACL guard).
- **Effort:** M — 1 session.

#### C2. Codes & fee schedule → **Admin Hub Fees tab, full CRUD** (closes W5) — **DONE (2026-07-11)**

*Research finding (trust-code-over-doc): C2 was ~80% already built. `FeeScheduleAdminService` +
`FeesTab`/`FeeModal` + `admin.fee.save|archive|billing_codes|import` already provide list, drawer
add/edit, archive, billing-code validation against stock `codes`, and CSV import — over the module's
own `new_fee_schedule` (the clinic's cash price list), NOT stock `codes`/`prices` (US-billing fee
levels, irrelevant to a cash clinic). The doc's "over codes/prices tables" framing was the
pre-build assumption; the real target is `new_fee_schedule`.*

- **The one genuinely-missing piece — DONE:** **bulk price update with a dry-run diff**.
  `FeeScheduleAdminService::bulkPriceUpdate()` (modes: increase/decrease %, increase/decrease amount,
  set-to; optional category filter + round-to-whole) with a `dry_run` that returns the exact
  per-line diff without writing. New `BulkPriceModal` (self-contained, action-fetch only so it never
  fires in host tests): pick change → **Preview** → diff table (now → new, scope) → **Apply**, where
  Apply is disabled until the live form matches the previewed change (can't apply an unseen edit).
  Action `admin.fee.bulk_price` (`new_fee_schedule_admin`, POST+CSRF).
- **Audit-log fix (found in the C2 audit):** the existing `save`/`archive` `newEvent` calls recorded
  the action name in the user column and the raw uid as the group; realigned all fee audit calls
  (incl. the new bulk one) to record the acting user/group correctly.
- **Verification:** `FeeScheduleAdminServiceTest` (bulk validation guards + `applyPriceMode` math);
  `BulkPriceModal.test` (preview→apply gating, no-change notice); typecheck + build + full Vitest
  green; `verify-module.php` PASS (286 actions). Asset `20260711feebulkprice`.
- **Effort:** S — most of it was already built.

#### C3. Lists editor (scoped) → **Admin Hub Forms tab** (closes W7 lists half) — **DONE (2026-07-11)**

*Research finding (no-assumptions, verified against code + live DB): the doc's example lists were
mostly wrong for this product. "Visit reasons" live in the module's own `new_visit_type` table (not
`list_options`); "regions/districts" don't exist as lists here; and — caught in the C3 audit —
**`payment_method` is hardcoded by the cashier** (`CashierService` cash/MoMo), so editing that stock
list would be a misleading no-op. The lists the module DEMONSTRABLY reads from `list_options` are:
`immunizations` (chart), `external_patient_education` (education), `note_type` + `message_status`
(communications hub). Those four — and only those — are the grounded allow-list.*

- **Built:** `AdminListEditorService` with an `EDITABLE_LISTS` allow-list (the four above), and
  `getCatalog|getOptions|saveOption|setActive` — every write allow-list-gated so it can never touch a
  system/CDR list. Actions `admin.lists.catalog|options|save|set_active` (`new_admin`, POST+CSRF on
  writes). New self-contained `ListsEditorCard` in the Forms tab (safe: the tab panel unmounts when
  inactive, so it never self-fetches in host tests): list picker → options table → inline
  add/rename/reorder + show/hide. Everything else stays in stock `edit_list.php` via the existing
  "Advanced form editors" gateway.
- **Verification:** `AdminListEditorServiceTest` (allow-list guards, blank-label, slug);
  `ListsEditorCard.test` (mount load, add, blank-label error); typecheck + build + full Vitest green
  (464); `verify-module.php` PASS (290 actions). Asset `20260711listeditor`.
- **Effort:** S — scope was smaller than the doc imagined once grounded in real module usage.

#### C4. Formulary/catalog admin → **pharm-ops SetupPanel** (closes W8) — **DONE (2026-07-11)**

*Research finding: the bulk starter-formulary CSV import (`PharmOpsFormularyImportService`) and the
controlled-substance flag editor (`PharmDrugMetaService`/`PharmOpsControlledCatalog`) already existed.
The genuine gap was **interactive per-drug editing** — rename a product, fix a reorder point, add one
item, deactivate one — which neither bulk import nor the controlled-flag editor covers.*

- **Built:** `PharmCatalogAdminService` (`getCatalog`/`saveDrug`) over the stock `drugs` table, with
  `form`/`route`/`unit` sourced from the `drug_form`/`drug_route`/`drug_units` list_options (which is
  why those lists live here, not in the C3 Admin Hub editor — no duplicate editor). Actions
  `pharm_ops.catalog_list|catalog_save` gated by the same `PharmOpsAccessService::assertCatalogAccess()`
  as the controlled catalog (POST+CSRF on save). New `PharmOpsCatalogPanel` in the SetupPanel: searchable
  drug table (name, form, strength, reorder, status) + add/edit **drawer** (name, form, strength, unit,
  route, reorder point, NDC, active). Stock `drug_inventory.php` stays as the advanced gateway; the
  "common sigs" template list is left to the existing import-time `drug_templates` (deferred).
- **Verification:** `PharmCatalogAdminServiceTest` (blank-name/negative-reorder guards, catalog shape);
  `PharmOpsCatalogPanel.test` (disabled=no-render/no-fetch, mount load, add via drawer, blank-name
  block); typecheck + build + full Vitest green (468); `verify-module.php` PASS (292 actions). Asset
  `20260711drugcatalog`.
- **Effort:** M — per-drug CRUD was the missing slice; bulk + controlled were already built.

#### C5. People & Access completion (closes W1) — **DONE (2026-07-11)**

*Research finding: this was ~90% already built by prior sessions and the W1 "Partially" status was
stale. The native facility×user assignment (`FacilityUserMatrix` + `FacilityUserPanel` + save, via
`FacilityUserAdminService::saveForUserFacility` / `admin.facility_user.*`) is fully wired in the
People tab, and the `acl_admin` (gacl) iframe already carries the expert-mode warning banner
(`admin-people-legacy.php`, `advanced` views).*

- **The one remaining piece — DONE:** retired the redundant `facility_user` legacy iframe view. It
  had **no UI call sites** (native fully replaces it); removed from `AdminPeopleLegacyWrapService`'s
  allow-list so `admin-people-legacy.php?view=facility_user` no longer resolves. Test updated to
  assert its absence.
- **Kept deliberately:** `acl_admin` (gacl) as the last-resort advanced path, with its existing
  "expert mode" warning banner.
- **Verification:** `AdminPeopleLegacyWrapServiceTest` green; `verify-module.php` PASS (283 actions).
  PHP-only change (the frontend already didn't link the retired view — no asset bump).
- **Effort:** XS — the native work was already complete.

#### C6. Backup status panel (closes W3, partially) — **DONE (2026-07-11)**

*Research finding: last-run status chip + **Run-now**/complete (via `AdminHealthService::initiateBackup`/
`completeBackup` over the `admin_hub_backup_run` table) + retention were already built in the System
health board. The one missing piece was the **history table**.*

- **Done:** `AdminHealthService::getHealthStatus()` now returns `backup_history` (last 10 runs from
  `admin_hub_backup_run`, bounded), rendered as a **Recent backups** table in `SystemHealthBoard`
  (started / finished / result badge / note). Flowed through the existing health payload — **no new
  fetch/action** (deliberately, to avoid a self-fetching card in a shared host; see the memory note).
- **Size column dropped:** the run table has no size field (only `file_path`); statting files is
  fragile/cross-platform, so it's omitted rather than faked.
- **Restore stays stock** — destructive, kept on the legacy screen behind the "Stock backup
  (Advanced)" gateway link.
- **Verification:** `AdminHealthServiceTest` green (backup_history asserted); host `AdminHub.test`
  green (null-guarded payload); `verify-module.php` PASS (283 actions).
- **Effort:** XS — most of it was already built.

### Phase GAP-D — Platform hardening

#### D1. i18n foundation (closes G8 mechanism) — **FOUNDATION BUILT (2026-07-12); string sweep continues desk-by-desk**

*Pre-build research corrected the sketch on two counts: (1) the "Twig shell strings go through
core xl()" half was **already done** — all 41 module templates carry 259 `|xlt` filters; only the
hardcoded `<html lang="en">` needed fixing. (2) Dictionaries cannot live in `assets/modern/`
(Vite's `emptyOutDir: true` wipes it every build) — they live in the hand-managed
`public/assets/i18n/` beside `css/`/`js/`.*

- **Runtime — BUILT:** `@core/i18n.ts`: `t(message, params?)` on the core `xl()` model — the
  English source string IS the key; lookup falls back to English on a missing/empty entry, so
  English needs no dictionary and untranslated strings can never blank a desk. `{param}`
  interpolation runs **after** translation (translators can reorder placeholders). No plural
  rules in V1 (English-only ships). `mountIsland()` awaits `ensureI18nReady()` (memoized, one
  fetch, fail-open on error) before the first render.
- **Locale plumbing — BUILT:** new `ShellLocaleService` (no ctor deps) resolves the session
  user's core preference (`$_SESSION['language_choice']` → `lang_languages.lang_code`) and a
  versioned dictionary URL **only when** `public/assets/i18n/<code>.json` exists; wired once in
  `PageController::emitPage()` (the single funnel for all 28 base-extending pages) →
  `base.html.twig` stamps `<html lang>`, `data-lang-code`, `data-i18n-url` on `#nc-t1`;
  `readPageContext()` exposes both.
- **Extraction — BUILT:** `frontend/scripts/extract-i18n.mjs` statically scans `src` for `t()`
  literals (comments stripped; template literals inside `t()` are a hard error — `{param}` is
  the interpolation path) → sorted key inventory `public/assets/i18n/messages.json`;
  `--locale fr` merges a translator stub (keeps existing translations, adds new keys empty,
  drops orphans); `npm run i18n:check` (staleness gate) joined `npm run check`.
- **Lint fence — BUILT:** eslint `react/jsx-no-literals` (noStrings, ignoreProps) scoped to a
  per-island allow-list that grows as each desk migrates — new raw JSX text in a migrated island
  fails lint.
- **Seed migration — BUILT:** `office-notes` fully on `t()` (42 keys), demonstrating the one
  hazard convention: **no module-scope `t()`** — label constants become render-time functions
  (`OFFICE_NOTE_FILTERS` → `officeNoteFilters()`), because module scope evaluates at import,
  before the dictionary loads. Convention recorded in `frontend/CLAUDE.md`.
- **Deliberately NOT in this slice:** translations themselves (French = open product question
  #3), plural rules, and the remaining ~21 islands' string sweep — that is the "mechanical but
  wide" L tail, one desk per batch behind the lint fence.
- **Verification:** frontend `npm run check` green (lint + typecheck + i18n:check + 487/487
  Vitest incl. 12 new i18n tests; untouched OfficeNotes tests passing proves English-fallback
  parity) + build; `composer verify:new-clinic` PASS (295 actions, 0 cycles); full NewClinic
  PHPUnit 970 green — which surfaced and fixed two **pre-existing** failures: `backup_target_dir`
  (uncommitted prior backup work declared a `''` default the save-validator rejected) and
  `ReferralCorrespondenceServiceIntegrationTest` (asserted "hidden when disabled" without
  pinning the flags — ordering flake in full runs). Asset `20260712i18nfoundation`.
- **Effort:** foundation S–M (1 session); sweep remains L, desk-by-desk.

##### D1 string-sweep tracker — **PAUSED 2026-07-12 (resume anytime)**

The `t()` migration + French translation is **on hold by decision** after the first desk; the mechanism,
the lint fence, and the French dictionary (`fr.json`, 128 keys) are all in place, so this can be picked up
one island at a time whenever wanted. Per-island recipe: wrap every UI string (incl. props the fence
misses — `aria-label`/`alt`/`placeholder`/`AdminSection` title+description/`ConfirmModal` labels), convert
any module-scope label constants to render-time functions, add the island dir to the `react/jsx-no-literals`
block in `eslint.config.js`, `npm run i18n:extract -- --locale fr` + fill the new French keys, then
`npm run check` + build + asset bump.

- **Swept (3):** `office-notes` ✅ · `proc-order` ✅ · `my-profile` ✅
- **Remaining (~22):** visit-board, triage-desk, doctor-desk, cashier-desk, lab-desk, pharmacy-desk,
  front-desk, patient-registry, daily-reports, communications-hub, admin-hub, patient-chart, lab-ops,
  pharm-ops, chart-depth, bill-ops, report-hub, queue-bridge, scheduling, clinical-doc, encounter-consult,
  outreach.
- **Suggested order when resumed:** smaller high-traffic first (visit-board → triage-desk → queue-bridge →
  scheduling) for momentum, then the big desks one session each (cashier-desk ~20 files → doctor-desk ~33 →
  front-desk ~42). No user-visible gap meanwhile — unswept desks stay English for a French user (safe
  fallback); the fence keeps new code honest.
- **French quality caveat still stands:** the existing French is a solid first pass — get a
  native-speaker/clinical review before a French pilot goes live.

#### D2. Merge patients guardrail (closes G10) — **DONE (2026-07-12)**

- Not a rewrite (NG12 stands). Detection + surfacing only; the merge itself stays the stock tool.
- **Built:** `AdminDuplicateReviewService::getReview()` finds existing likely-duplicate **pairs** via
  two bounded, index-aware signals — exact name+DOB (self-join anchored by `idx_patient_dob`) and
  exact national ID (`ss`). Behind `enable_duplicate_review` (PRD §5.6, default OFF; wired install.sql
  + `EDITABLE_SETTINGS` + `adminFieldDefs`). Action `admin.duplicates.list` (`new_admin`). New
  self-contained `DuplicatesCard` in the System tab (renders nothing when the flag is off): a table
  of pairs + reason, each row "Review & merge" deep-linking to `admin-merge-legacy.php?pid1=&pid2=` —
  a T1 wrapper (cloned from the people-legacy pattern) that iframes stock `merge_patients.php`
  (super-admin gated, with a permanence warning). Automated merge remains excluded.
- **Audit fix:** `patient_data` has no index on `ss`, so a national-ID self-join would be O(n²)
  (`LIMIT` caps output, not work). Replaced it with an O(n) aggregate — find duplicated `ss` values in
  one `GROUP BY … HAVING COUNT(*)>1` scan, then fetch only those groups' members and pair in PHP.
- **Verification:** `AdminDuplicateReviewServiceTest` (default-OFF short-circuit, name+DOB join
  bounds, national-ID uses aggregate not self-join); `DuplicatesCard.test` (off=no chrome, pairs +
  merge deep link); **live smoke** (flag on → real pairs + correct merge URL, flag restored);
  typecheck + build green; `verify-module.php` PASS (293 actions). Asset `20260712dupreview`.
- **Effort:** S.

#### D3. Procedure order native form (closes W2 top slice) — **BUILT (2026-07-12), full native form behind `enable_native_proc_order`; live browser sign-off pending**

*Pre-build research (2026-07-12) surfaced a decisive, plan-correcting finding: **a native React
procedure-ordering path already ships.** `LabPanelModal` ("Quick lab order") in Doctor Desk →
`DoctorActionHandler` → `LabPanelOrderService::placeOrder()` (behind `enable_lab_panel_order`)
already does multi-test selection from the `procedure_type` catalog, writes the canonical
`procedure_order` + `procedure_order_code` + `forms` row + UUIDs, **auto-posts cashier charges**,
returns routing chips, and offers a "Full lab form" bridge fallback. So the plan's "build a native
ordering pane" was ~60% already met. The genuine remaining gap = exactly the stock form's extra
fields: **order priority** (was hardcoded `normal`), **specimen** type/volume, **clinical history**,
**order diagnosis**, **external/send-out lab** choice (in-house only today), **edit** of an existing
order, and availability as the `procedure_order` **catalog card** (not just the Doctor-Desk drawer).
Product decision (open Q#4, the parity bar): **full native form** — build all of the above, keeping
per-line procedure questions/answers + specimen scheduling + ABN on the stock bridge.*

- **Backend foundation — BUILT (slice 1):** `ProcedureOrderEnginePolicy` (`enable_native_proc_order`
  flag, requires Lab Ops; `shouldOpenNativeProcOrder('procedure_order')` — the routing predicate,
  mirrors `EncounterNoteEnginePolicy`) + `ProcedureOrderFormService` (`getFormData` = visit context,
  lab catalog across all active `procedure_providers` with in-house fees, `Order_Priority`/`Specimen_Type`
  option lists with a hardcoded priority fallback when unseeded, existing-order load for edit; `saveOrder`
  = create/update the two-table shape with priority/specimen/clinical-hx/order-diagnosis/external-lab,
  `forms` row on create, in-house charges via `LabOrderChargeService` posted once on create, wrong-patient
  guard on edit). Reuses `LabPanelOrderService`'s proven insert idioms — **no duplicate write/billing
  logic**. Flag wired in all three places (install.sql, `EDITABLE_SETTINGS`, `adminFieldDefs`).
- **Verification (slice 1):** `composer verify:new-clinic` PASS (295 actions, **0 ctor cycles**);
  `ProcedureOrderFormServiceTest` 5/5 (policy formdir-gate, default-OFF, priority normalization,
  priority-list fallback, empty-selection reject); frontend typecheck + i18n:check + adminFieldDefs
  test green; `ClinicAdminServiceTest` 36/36 (new bool flag survives the save-default check).
- **Slice 2 — BUILT (the React form + full wiring):** `proc-order.php` host (mirrors `encounter-consult.php`;
  redirects to the stock bridge via `ProcedureOrderDeepLinkService` when off; **maps the clinical-doc
  `form_id` = forms.id → `procedure_order_id`** — the two are not the same, a bug caught and fixed in
  slice-2 debug) + Twig; `proc-order` island (`ProcOrderForm.tsx`: lab picker, per-lab grouped test
  checkboxes with in-house fee display + running estimate, priority/specimen selects, specimen volume,
  order-diagnosis, clinical-history, edit prefill from existing codes) — fully on `t()` and added to the
  D1 eslint fence; ajax `proc_order.form_data|save` in `ClinicalDocActionHandler` (`clinical_doc_write_acl`);
  the routing hook in `ClinicalDocFormOpenService::openForm()` sends `procedure_order` to the native host
  when the flag is on (the existing catalog card needs no change — routing handles native-vs-bridge).
- **Verification (slice 2):** full NewClinic PHPUnit **975 (no failures)**; frontend `npm run check` +
  build green — `ProcOrderForm.test` 3/3, full Vitest **490/490**; `composer verify:new-clinic` PASS
  (**297 actions, 0 cycles**); asset `20260712procorder`. **Live-DB smoke** (real desk facility, flags
  toggled + restored): policy routing correct, `getFormData` returns the real catalog — 6 in-house tests
  with real fees (FBC GH₵45, GLU_F 15, HB 20), 38 real `Specimen_Type` options, priority fallback
  `normal/high/stat` — proving the schema-critical read/fee assembly against the live DB.
- **Write-path sign-off — PASSED (live-DB smoke, 2026-07-12):** drove `saveOrder` against the real DB —
  CREATE wrote a `procedure_order` (priority=stat, specimen, order_diagnosis, pid-scoped) + one
  `procedure_order_code` line + the `forms` row; EDIT on the same order flipped priority and replaced the
  lines (1→2); rows hard-deleted and flags restored via a shutdown hook (no pollution). Only the shared
  HTTP/CSRF/session-cookie layer (used by all 297 actions) is unexercised by CLI — a full click-through in
  a logged-in browser remains the final manual confidence check before prod enablement. Per-line procedure
  questions/answers + specimen scheduling + ABN stay on the stock bridge by design.
- **Effort:** L (4 sessions, coordinate with M12) — delivered in 2 verified slices.

#### D4. Native issue editor → **`patient-chart` Clinical tab drawer** (closes W10) — **DONE (2026-07-12)**

- **Built:** a `Sheet` drawer (`IssueEditorDrawer`) that adds/edits problems, allergies, and
  medications on the MRD Clinical tab instead of the stock `add_edit_issue.php` popup. Fields: title,
  onset/resolution dates, comments, and (allergy) reaction. Backend `ClinicalIssueEditorService` +
  `patients.chart.issue_get|issue_save` write through core **`PatientIssuesService`**
  (createIssue/updateIssue), so column whitelisting, type validation, and UUIDs stay canonical.
  Per-type write ACL mirrors stock exactly (`AclMain::aclCheckIssue`); every write is scoped to the
  patient (id+pid) to prevent wrong-patient edits (G12). Behind `enable_native_issue_editor`
  (default OFF, wired 3 places); when off the sections keep the stock popup links.
- **Deliberately deferred (safe):** coded diagnosis/severity/occurrence and **delete** stay on the
  stock editor. Because `updateIssue` only SETs the fields sent, omitting those columns **preserves**
  them — no clobber. The `command`-style title code lookup is deferred to a follow-up.
- **Audit fix:** with the native editor on, the stock links were fully replaced, making the stock
  popup (the only home for delete + codes) **unreachable**. Added a per-issue "Full editor (delete,
  codes…)" escape-hatch link in the drawer (edit mode) + a note explaining what stays stock.
- **Verification:** `ClinicalIssueEditorServiceTest` (flag gate, invalid-ref, date-format, canonical
  types); `IssueEditorDrawer.test` (add→save payload, blank-title block, load + stock escape hatch);
  `ClinicalTab.test` (native Add/Edit when on, stock link when off); **live write-path smoke** —
  create→read→update a disposable problem, verified in `lists`, then **hard-deleted**; flag restored.
  typecheck + build + patient-chart host tests green; `verify-module.php` PASS (295 actions, 0 cycles).
  Asset `20260712issueeditor`.
- **Left for parity sign-off (spec gate before flipping the flag on in prod):** the per-type
  `aclCheckIssue` gate (bypassed by `$ignoreAuth` in CLI, so not smoke-able) and the allergy banner
  `ChipCloud` refresh after an allergy write.
- **Effort:** M.

#### D5. Record request verification (closes W12) — **DONE (2026-07-12)**

*Research finding (no-assumptions): there is no "Record Request" transaction type in stock OpenEMR —
the transaction-type layouts are `LBTbill` (Billing), `LBTlegal` (Legal), `LBTphreq` (Physician
Request), `LBTptreq` (Patient Request), `LBTref` (Referral). The records-request equivalents are
**Patient Request / Physician Request**. The M11 transactions wrapper (`StockChartWrapService::transactionsSnippet`)
does NOT filter types — it only retitles ("Referrals & letters") and sorts referral rows first — so
those types already render. There was no type allow-list to fix.*

- **The real gap it exposed:** when `enable_chart_depth_referral` is ON, `PatientMenuRestrictService`
  **hides the stock 'transactions' patient-menu item** (the module surfaces referrals natively). The
  backend already built a `stock_transactions_url` escape hatch in the clinical-strip payload — but it
  was **never rendered in the frontend**, so the non-referral transaction types (Patient/Physician
  Request = records requests, Legal, Billing) became **unreachable** with the native surface on.
- **Fix:** surface an **"Other transactions"** link (from `stock_transactions_url`) alongside "Open
  referrals" in the patient-chart referrals strip (`ClinicalTab`), restoring reachability to every
  transaction type. Frontend-only (backend already provided the URL).
- **Verification:** `ClinicalTab.test` (new: "Other transactions" link renders from
  `stock_transactions_url`); DB check of the actual transaction-type layouts; typecheck + build +
  patient-chart host test green; `verify-module.php` PASS (293 actions). Asset `20260712recordreq`.
- **Effort:** XS build — but it turned a "verify" item into a real reachability fix.

#### D6. De-Bootstrap the module shell (kills the CSS-collision bug family)

*Added 2026-07-11 after the Admin Hub "read-only checkboxes" incident: Bootstrap 4 (bundled
unlayered in core's `style_light.css`, loaded on every page via `Header::setupHeader`) defines
`!important` utility classes whose NAMES collide with Tailwind's (`bg-white`, `border`,
`rounded-sm`, `text-white`, …). Any island control whose state styling uses a colliding class
gets silently frozen — the checkbox toggled state correctly but painted identically in both
states. See the memory note `bootstrap-tailwind-class-name-collisions` and CLAUDE.md §6's
`@layer` gotcha (this is its second, nastier half).*

- **Scope:** module pages only — stock OpenEMR keeps Bootstrap untouched (legacy screens depend
  on it; wrapped legacy screens are iframes with their own CSS and are unaffected either way).
- **Step 1 (audit):** sweep `frontend/src` for the BS4-colliding class names (~17 files use
  `bg-white` alone) and replace each with a non-colliding arbitrary value
  (`bg-[var(--oe-nc-surface)]`) or an `nc-` BEM rule — prioritize any element whose
  *state* changes its background/border/color (the invisible-state failure mode).
- **Step 2 (templates):** rewrite the Bootstrap classes in the 19 module Twig templates
  (incl. `base.html.twig`) to `nc-` BEM equivalents in `shell.css`/`components.css`.
- **Step 3 (cutover):** stop emitting the core theme stylesheet on module shell pages (keep
  `Header::setupHeader`'s JS/session side effects), behind a dev toggle first; full visual pass
  over every desk at both mobile and desktop widths before making it the default.
- **Exit criteria:** zero BS4-colliding class names in `frontend/src` (lint rule or verify-script
  check to keep it that way); every desk passes a visual smoke with the theme stylesheet absent.
- **Effort:** M (2–3 sessions: 0.5 audit/sweep, 1 templates, 1 cutover + visual QA).

**Slice 1 — BUILT (2026-07-12): audit + guard + the entire real frontend/Twig sweep. The M estimate was
wrong — the module was already ~99% de-Bootstrapped.** Deeper audit overturned the plan's premise:

- **Steps 1 & 2 were essentially already done.** The scary "474 `text-muted`" was a substring
  false-positive — **zero** bare `text-muted` classes exist; every one is already the token form
  `text-[var(--oe-nc-text-muted)]`. Of the classes the guard counts, nearly all are **dual-defined**
  (`text-right`, `border`, `rounded`, `bg-white` — Tailwind defines them too, so they *survive* the
  cutover and only risk the rare *state-freezing* case). The genuinely **BS4-only** classes (no Tailwind
  equivalent → vanish at cutover) actually used across the whole frontend numbered **three**: `d-flex`,
  `h-100`, `d-inline-block` — all fixed (→ `flex`, `h-full`, `inline-block`). The 28 module **Twig
  templates carry zero BS4 classes** — already 100% `nc-` BEM. So the module doesn't meaningfully depend
  on Bootstrap utility classes at all.
- **Guard (`frontend/scripts/check-bs-collisions.mjs`, `bs:check` in `npm run check`):** two checks —
  (1) a **ratchet** pinning the 377 dual-defined collisions (can only shrink; guards the state-freezing
  family), and (2) a **zero-tolerance** check on the BS4-only set (now 0) so no new cutover-breaking class
  can land. Both proven to fire (negative-tested).
- **Step 3 toggle — BUILT (2026-07-12).** `enable_debootstrap_shell` (Admin Hub System tab, default OFF,
  wired 3 places): when on, `PageController::emitPage()` strips **only** the core theme stylesheet `<link>`
  (`%css_header%` → `style_light.css`, which carries Bootstrap + base styling) from the captured header,
  matching on the css_header **path** so the `?v=` cache-bust is irrelevant — keeping Bootstrap **JS** and
  every other asset (plan's "keep the JS/session side effects"). `stripCoreThemeStylesheet()` is pure +
  static, unit-tested (removes only the theme link, keeps module CSS + both scripts; path-match beats
  version; no-op on empty/non-matching). **Live smoke** against the real `Header::setupHeader` output:
  theme link present→removed, Bootstrap JS retained, other links kept. `composer verify:new-clinic` PASS
  (297 actions, 0 cycles); `PageControllerThemeStripTest` 4/4; `ClinicAdminServiceTest` 36/36; frontend
  typecheck + bs:check + build green. Asset `20260712debootstrap2`.
- **Visual pass DONE (2026-07-12) → wholesale cutover DEFERRED (product decision).** Flipping the toggle
  on revealed that although the module uses **no Bootstrap utility classes**, it *does* borrow two **base**
  layers from the core theme stylesheet: **FontAwesome icons** (baked into `style_light.css` via SASS; the
  module never loads its own copy — so icons vanished) and the **base body font/typography** (nc- panels
  set their own font, but the page baseline came from the theme — so text fell back to the browser
  default). Fully dropping the theme would therefore require **rebuilding that base layer** in the module
  (load our own FontAwesome, set base font/typography/resets) + several rounds of per-desk visual QA.
- **Decision: not worth it — stop here.** The *actual* bug D6 exists to kill — Bootstrap `!important`
  utility classes freezing island state styling (the checkbox incident) — is **already fixed and guarded**
  (the 3 real fixes + the `bs:check` ratchet + BS4-only zero-tolerance). The wholesale theme-drop's payoff
  is architectural cleanliness, **not** an active bug, so its cost (rebuild the base layer + re-QA every
  desk) isn't justified now. **D6 is considered resolved to the worthwhile extent:** collisions fixed,
  regression-guarded, Twig clean. The `enable_debootstrap_shell` toggle is **retained as a dev/QA tool**
  (default OFF); if the base-layer rebuild is ever pursued, it's the ready-made harness. Revisit only if a
  concrete need (e.g. a full theme replacement) makes the base-layer work pay for itself.

---

## 6. Phasing & sequencing

| Phase | Items | Depends on | Exit criteria |
|---|---|---|---|
| **GAP-A** | A1 office notes · A2 documents · A3 address book · A4 letters/labels · A5 patient follow-ups · A6 MFA | none | Each behind its toggle, QA'd, scorecard rows added |
| **GAP-B** | B1 outreach · B2 trends + growth overlay · B3 education | A5 (reminder plumbing), registry filter embed | Dry-run mandatory on B1; product sign-off on SMS provider question |
| **GAP-C** | C1 audit · C2 codes · C3 lists · C4 formulary · C5 people finish · C6 backup panel | none (parallel to B) | Corresponding legacy gateway cards demoted to "Advanced" |
| **GAP-D** | D1 i18n ✅ foundation (sweep continues) · D2 merge guardrail ✅ · D3 native proc order · D4 native issue editor ✅ · D5 record-request check ✅ · D6 de-Bootstrap module shell | D3 after C4/M12 stabilization | i18n lint active ✅; proc-order + issue-editor parity checklists signed; D6: zero BS4-colliding classes + theme-less visual smoke on every desk |

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

1. **SMS provider for B1 outreach** — which gateway (and is this NG9-adjacent enough to defer)? **Email is no longer blocked on this** — `EmailOutreachGateway` (2026-07-12) sends via the clinic's own SMTP/`MyMailer`, no provider account needed; SMS still awaits this decision (regional aggregators — Africa's Talking / Hubtel / Termii — recommended over Twilio for West Africa).
2. **Documents storage quota/virus scanning** — accept core defaults, or gate uploads by size/type in the module?
3. **i18n target locales** — **DECIDED: French first** (Francophone West Africa — Senegal, Côte d'Ivoire, Mali, Burkina Faso, Guinea…). `fr.json` seeded 2026-07-12 for the swept islands (office-notes + proc-order, 65 keys); a French user (`language_choice` → `lang_code fr`) now sees those screens in French. **Caveat: the French is a solid first pass but should get a native-speaker/clinical review before production.** Remaining locale coverage grows as the desk-by-desk `t()` sweep proceeds.
4. **Proc-order parity bar** — which fields of stock `procedure_order` are mandatory for D3 sign-off vs dropped as unused?

---

## 10. Version history

| Version | Date | Change |
|---|---|---|
| v0.1.33 | 2026-07-13 | **W5, W7, W8 re-verified against current code and resolved — the whole "build the remaining Tier 2 items" ask turned out to be mostly doc rot, not open engineering work**, exactly why the fresh-research-not-recall discipline mattered here: the §0 TL;DR/header already claimed GAP-C (C2=W5, C3=W7, C4=W8) complete, while the Tier-2 table §3 still described them as open recommendations — the header was right, the table was stale. All three CRUD features are genuinely built and confirmed working. Two real, narrowly-scoped bugs found and fixed along the way: (1) W5 — the Fees tab's "Codes admin" escape-hatch link pointed at the wrong stock screen (`layout_service_codes.php` instead of `superbill_custom_full.php`); (2) W7 — considered adding `abook_type` (directory contact categories) to the native lists editor, but research found its `option_value` column is load-bearing in stock `addrbook_edit.php` (person-vs-company field rendering) and the editor's write path can't set it safely, so it was deliberately left out with a pinning test, not shipped half-safe. |
| v0.1.32 | 2026-07-13 | **W12 resolved as a doc error, not a gap** — fresh research (triggered by a "build the remaining Tier 2 items" pass) found `record_request.php` isn't a `transactions`-table entry at all; it's a US Meaningful Use AMC compliance flag toggle, out of this product's market, and the real underlying need (patient record copies) already ships as M11/CDc Chart Depth export. Row corrected; no code follows. Also fixed the stale §0 TL;DR line still listing G4/G5/G11 as open when the gap table has shown them Closed since 2026-07-11. |
| v0.1.31 | 2026-07-12 | **B1 outreach — email delivery is now REAL** (was a pure stub). New `EmailOutreachGateway` (first real `OutreachGatewayPort` adapter) sends patient outreach email through OpenEMR's canonical `MyMailer` (clinic's configured SMTP) — **no third-party provider account/decision needed**. Gated on mail transport + a clinic sender email (`patient_reminder_sender_email`) being set, else it honestly falls back to the stub; one email per recipient (no shared To/Cc — PHI privacy); SMS channel still stubs until its own provider adapter. Factory routes to it automatically; the `outreach` island already respects `gateway_configured`, so the "nothing sent" banner/toast flips to real success with no frontend change. `EmailOutreachGatewayTest` (channel guard, availability gate, factory fallback) + `OutreachServiceTest` green (6/6); verify 298 actions/0 cycles. Backend-only — no asset bump. Live send needs the clinic's real SMTP configured (deployment step). |
| v0.1.30 | 2026-07-12 | **D1 string sweep — `my-profile` island migrated to `t()` + translated** (the first full desk swept beyond the two built natively with `t()`). ~63 strings across `MyProfile`/`MfaSecuritySection` wrapped (incl. props: `AdminSection` title/description, `ConfirmModal` labels, `img` alt), added to the `react/jsx-no-literals` fence (`@` added to allowedStrings for the `@username` handle), and given standard French (fr.json now 128 keys, 0 empty, 0 placeholder mismatches). Full `npm run check` (lint/typecheck/i18n:check/bs:check + Vitest 490) + build green. Swept islands now: office-notes, proc-order, my-profile. Asset `20260712frsweep1`. |
| v0.1.29 | 2026-07-12 | **French locale — first dictionary seeded** (open Q#3 decided: French, for Francophone West Africa). `public/assets/i18n/fr.json` filled for the 65 keys of the already-swept islands (office-notes + proc-order), standard clinical French (*demande d'analyse*, *type d'échantillon*, …). Pipeline verified end-to-end: 0 placeholder mismatches; `ShellLocaleService` resolves a French user (`language_choice=8` → `fr`) to the `fr.json` URL, so those screens now render in French with no rebuild (static dictionary). **French is a first pass — needs native/clinical review before prod.** Full-app French continues as the desk-by-desk `t()` sweep of the remaining ~23 islands. |
| v0.1.28 | 2026-07-12 | D6 **wholesale cutover DEFERRED by decision** after the visual pass. Flipping `enable_debootstrap_shell` on showed the module borrows **FontAwesome icons + base body font** from the core theme (no Bootstrap *utility classes*, but these *base* layers) — icons vanished, font fell back. Fully dropping the theme would need the module to rebuild that base layer + re-QA every desk. Since the actual bug (utility-class `!important` freezing — the checkbox incident) is already fixed + `bs:check`-guarded, the wholesale drop's payoff is architectural, not a bug — **not worth it**. D6 marked resolved to the worthwhile extent; toggle retained as a dev/QA harness (default OFF). No code change beyond forcing the dev flag OFF. |
| v0.1.27 | 2026-07-12 | D6 **Step 3 cutover toggle built** — `enable_debootstrap_shell` (Admin Hub System, default OFF, 3-place wired). When on, `PageController::emitPage()` strips only the core theme `<link>` (`style_light.css`, path-matched so `?v=` is ignored), keeping Bootstrap JS + all other assets. `stripCoreThemeStylesheet()` pure/static, `PageControllerThemeStripTest` 4/4; live smoke vs real `Header::setupHeader` (theme removed, JS kept); verify 297/0-cycles; ClinicAdminServiceTest 36/36; frontend typecheck+bs:check+build green. Only the manual per-desk visual pass remains. Asset `20260712debootstrap2`. |
| v0.1.26 | 2026-07-12 | D3 write-path **sign-off PASSED** (live-DB smoke: create→verify→edit→cleanup, flags restored via shutdown hook). **D6 re-scoped by audit — the module was already ~99% de-Bootstrapped, not the M sweep the plan feared.** "474 text-muted" was a substring false-positive (0 bare `text-muted`; all already `text-[var(--oe-nc-text-muted)]`); counted collisions are nearly all dual-defined (survive cutover); the only genuinely BS4-only frontend usages were **3** (`d-flex`/`h-100`/`d-inline-block`, all fixed → Tailwind), and the 28 Twig templates are already 100% `nc-` BEM. Added `check-bs-collisions.mjs` (`bs:check` in `npm run check`): a 377-collision ratchet + a **zero-tolerance BS4-only check** (both negative-tested). Only Step 3 (drop the theme stylesheet behind a dev toggle + per-desk visual QA of inherited base styles) remains. Full check + Vitest 490 + build green. Asset `20260712debootstrap1`. |
| v0.1.25 | 2026-07-12 | D3 **slice 2 — React form + full wiring shipped** (full native procedure-order form behind `enable_native_proc_order`, OFF). `proc-order.php` host + Twig, `proc-order` island (`ProcOrderForm`, on `t()` + eslint fence), ajax `proc_order.form_data\|save` (`clinical_doc_write_acl`), routing hook in `ClinicalDocFormOpenService`. Debug pass fixed a real slice-1 bug: clinical-doc `form_id` is forms.id, not procedure_order_id — the host now maps it. Full PHPUnit 975 (no failures), Vitest 490/490, verify 297 actions/0 cycles, live-DB read smoke green (real catalog + fees + specimen list). Also fixed self-inflicted DB pollution: an earlier crashed smoke (fatal skips `finally`) left `enable_native_proc_order=1` at the desk facility — cleaned, and hardened `testPolicyDefaultsOff` to read the resolved facility. Live browser submit = manual parity gate. Asset `20260712procorder`. |
| v0.1.24 | 2026-07-12 | D3 procedure-order native form — **backend foundation (slice 1)**. Research finding (trust-code-over-doc): a native React lab-ordering path already ships (`LabPanelModal` → `LabPanelOrderService`, `enable_lab_panel_order`) — the plan's "build a native ordering pane" was ~60% met; the real gap is priority/specimen/diagnosis/external-lab/edit + a catalog card. Product parity-bar decision (open Q#4): **full native form**. Built `ProcedureOrderEnginePolicy` + `ProcedureOrderFormService` (full-field getFormData/saveOrder, reusing `LabPanelOrderService` idioms, no duplicate write/billing) + `enable_native_proc_order` flag (3 places). `ProcedureOrderFormServiceTest` 5/5; verify PASS (0 cycles); frontend static + ClinicAdminServiceTest green. React form island + host + routing + ajax + live smoke = slice 2 (flag inert/OFF until then). No asset bump (backend-only slice). |
| v0.1.23 | 2026-07-12 | D1 i18n foundation built (G8 mechanism closed; sweep continues desk-by-desk). Research corrected the sketch: the Twig half was already done (259 `\|xlt` uses across all 41 templates — only `<html lang>` was hardcoded), and dictionaries can't live in `assets/modern/` (Vite `emptyOutDir` wipes it) — they live in hand-managed `public/assets/i18n/`. Built: `@core/i18n` `t()` (English-as-key, xl() model, `{param}` interpolation after translation, fail-open), `mountIsland` awaits dictionary load, `ShellLocaleService` (session `language_choice` → `lang_code` + existence-gated dictionary URL) stamped on `#nc-t1`, extraction script + `i18n:check` in `npm run check`, `react/jsx-no-literals` fence per migrated island, office-notes seeded (42 keys; module-scope-t() hazard documented — label constants become render-time functions). Fixed two pre-existing full-suite failures found while verifying (blank `backup_target_dir` default; referral-strip test's unpinned premise). Asset `20260712i18nfoundation`. |
| v0.1.22 | 2026-07-12 | *(catch-up row — header was bumped without one)* D2 merge guardrail (G10), D4 native issue editor (W10), D5 record-request reachability (W12) built and verified; see those items' entries in §5. Assets `20260712dupreview` / `20260712issueeditor` / `20260712recordreq`. |
| v0.1.0 | 2026-07-07 | Initial gap analysis + redesign plan (§1–§9), first audit pass |
| v0.1.1 | 2026-07-07 | Second-pass audit: off-menu surfaces added (G11, W10–W11, A6) |
| v0.1.2 | 2026-07-11 | Re-verified A1 (Office Notes) against current code before starting the build: dropped the unbacked "pin toggle," corrected the ACL story (new `office_notes_acl` policy branch + `$coreGrants` wiring needed, not a free reuse of stock ACL), renamed the ajax action domain to `office_notes.*` to avoid colliding with the existing `core_notes_acl` policy type, corrected the module page count (23, not 24). Build of A1 started same day. |
| v0.1.3 | 2026-07-11 | A1 (Office Notes) and A2's per-patient Documents tab built and merged to main, closing G1 and the per-patient half of G2. Merge review found the pre-build v0.1.2 draft wrong on two points once checked against the real code: pin *was* shipped (via a companion table `new_office_note_meta`, not a core schema change) and the ACL needed zero new `acl_setup.php` grants (stock `Clinicians` group membership already covers `encounters/notes` + `patients/docs` for every New Clinic role via `ClinicRolesService`). One code-review fix applied before merge: Office Notes error messages switched to the shared `deskCalloutClass()` convention. A2's clinic-wide "unfiled documents" inbox lens remains open. |
| v0.1.4 | 2026-07-11 | A2's "unfiled documents" inbox lens shipped in `report-hub`, closing G2 fully. Discovered report-hub's lens system is a hardcoded 6-member enum + generic date-range card catalog, not a registry — the 7th lens needed special-casing across 4 files plus a Twig toolbar button, not a drop-in catalog card. Added `documents.unfiled_list`/`documents.assign_patient` actions (reusing the existing `patients_docs_acl` policy — no new ACL type) and a new `new_reception`/`new_admin` tab-visibility gate. Live browser verification surfaced a pre-existing, already-tracked scalability gap (PHP session-file-locking queues concurrent same-session requests because no handler calls `session_write_close()` yet) — correctly attributed to `NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md`, not treated as a defect in the new code. |
| v0.1.5 | 2026-07-11 | Re-verified A3 (Address Book) before starting the build — the most stale pre-build draft of the three GAP-A items done so far: fabricated "Hospital" `abook_type` category (real list has none — Specialist/Lab Service/Imaging/Immunization/Vendor/Distributor/External Provider/External Organization/Billing Service/Care Coordination/EMR Direct), wrong UI pattern (`Sheet` has no admin-hub CRUD precedent — `Dialog` does, via `VisitTypeModal`/`FeeModal`), wrong ACL (`admin/practice` is never checked by this module's `ajax.php` and isn't granted to `new_admin` by any seed path — would 403 real pilot admins; correct gate is the module's own `new_admin` ACO), wrong referral-component name (`PatientReferralsLetters` doesn't exist; real files are `ReferralWizard.tsx`/`ReferralsPane.tsx`), and an understated safety requirement (writing to the shared `users` table risks corrupting real staff login/ACL rows without stock's exact `username=''`/`authorized=0` guard on every query). |
| v0.1.6 | 2026-07-11 | A3 (Address Book → Admin Hub Directory tab) built and verified, closing G3 — GAP-A's G1/G2/G3 trio is fully shipped. `ChipCloud` corrected to a plain type dropdown (it's a non-interactive alert-badge component in this codebase, not a filter selector). Live testing caught, before shipping, that "External Organization" is stock `option_value = 1` (person-centric) despite its name — only 6 of 12 `abook_type` values are actually company-centric (Imaging/Immunization/Lab Service, Vendor, Distributor, Billing Service); the UI already followed the real per-type flag rather than any hardcoded assumption, so no code change was needed, just a documented gotcha for future work. The `users`-table safety guard (contacts vs. real staff logins) is proven by a dedicated PHPUnit test that seeds a fake staff row and confirms the service can neither read nor write it. |
| v0.1.9 | 2026-07-11 | A4 Letters discoverability fix. User couldn't find Letters: it was reachable only via the Clinical tab's "Open referrals" link, which `getClinicalStrip()` hides for any patient with zero referrals on file — i.e. exactly when you'd write the first letter. Fixed by (1) a "Print / Letters" chart-header menu (Referral letter… + the three labels) gated only on `enable_letters_labels`, always present regardless of referral history; (2) `?view=letters` deep-link support so it lands on the Letters segment; (3) decoupling the hub gate — `referrals.php` now opens when EITHER chart-depth-referral OR letters is enabled and shows only the enabled panels, so Letters no longer requires the referral sub-feature. Asset `20260711lettersentrypoint`. |
| v0.1.8 | 2026-07-11 | Added D6 "de-Bootstrap the module shell" to GAP-D. Trigger: Admin Hub checkboxes toggled state correctly but painted identically checked/unchecked — user-reported as "everything read-only," reproducible across browsers. Root cause was NOT the documented `@layer` gotcha alone but class-NAME collisions: Bootstrap 4 (unlayered, `!important`, bundled in core `style_light.css`) defines `.bg-white`/`.border`/`.rounded-sm` etc. with the same names Tailwind uses, so BS4 froze the checkbox background in both states. Immediate fix shipped (unlayered `nc-checkbox` BEM in shell `components.css` + colliding names stripped from the shared Checkbox component; asset `20260711checkboxlayerfix`); D6 tracks the permanent cure: sweep `frontend/src` of colliding names, rewrite Bootstrap classes out of the 19 module Twig templates, then drop the core theme stylesheet from module pages behind a dev toggle with a full per-desk visual pass. Debugging lesson recorded: attribute-level test assertions (`data-state`) kept "passing" while pixels never changed — compare screenshots for UI-state bug reports. |
| v0.1.21 | 2026-07-11 | Backup engine (W3) — the "make it track actual backups" follow-up. Found: a backup *policy* existed (SEC6 §3: encrypt-before-persist, VPS replica off-site) but no in-app *engine* — stock backup.php streams+unlinks (nothing persists). Wrote `NEW_CLINIC_BACKUP_SYSTEM_DESIGN.md` and built `AdminBackupService`: mysqldump (creds via 0600 defaults-file, never CLI) → streaming gzip → CryptoGen encrypt → write `.enc` to `backup_target_dir` → wipe plaintext → record real path/`size_bytes` → prune retention. Behind `enable_native_backup` (OFF) + super-admin; `initiateBackup` delegates when on. Live-smoked on this box (497MB dump → 68MB gz → under the 100MB encrypt cap). Restore stays manual (key custody). Deferred: streaming encryption + site-file inclusion. Asset `20260711backupengine`. |
| v0.1.20 | 2026-07-11 | C6 backup status (W3, partial) — last-run chip + Run-now + retention already existed; added the missing history: `AdminHealthService::getHealthStatus()` now returns bounded `backup_history` (last 10 `admin_hub_backup_run` rows), rendered as a Recent-backups table in `SystemHealthBoard`. No new fetch/action (added to the existing health payload to avoid a self-fetching card in a shared host). Size column omitted (no column; statting files is fragile). Restore stays stock. Asset `20260711backuphistory`. |
| v0.1.19 | 2026-07-11 | C5 people/access completion (W1) — mostly already built by prior sessions (stale "Partially" status corrected): native facility×user matrix/panel/save + gacl expert-mode warning banner already existed. Remaining piece done: retired the redundant `facility_user` legacy iframe view (no UI call sites; removed from `AdminPeopleLegacyWrapService` allow-list, test updated). PHP-only; no asset bump. |
| v0.1.18 | 2026-07-11 | GAP-C started — C1 audit-log browser built (W4). New `AuditLogService` (`query|detail|export`) over the core `log` table (read-only, bounded: page ≤50, export ≤5000, parameterized filters) + `admin.audit.*` actions (`new_admin`). `AuditLogCard` (self-fetching) in the Admin Hub System tab: date/user/text/result filters, pagination, detail SlideOver, CSV export; `ajaxUrl`/`csrfToken` threaded into `SystemTab`. Tamper-check stays stock. Asset `20260711auditlog`. |
| v0.1.17 | 2026-07-11 | B1 outreach core built (G6) — slice 1 of the L feature. New `outreach` island: SMS/email channel, registry-preset audience, mandatory dry-run preview (reachable/total + sample), queue behind confirm, recent-campaigns table; `enable_outreach` (OFF), redirects to stock batchcom when off. `OutreachService` + `outreach.presets|preview|queue|history` (`new_admin`); audience reuses `PatientCohortSearchService`; campaigns logged to new `new_outreach_campaign`. Delivery via `OutreachGatewayPort` + `NullOutreachGateway` **stub** — records intent, sends nothing; real SMS/email adapter (MoMo/NG9) deferred. Wizard/scheduling/per-recipient log/custom filter builder deferred. Asset `20260711outreach`. |
| v0.1.16 | 2026-07-11 | B2b growth-chart deep link built (W11 wrapped). Research overturned the plan's premise: the repo ships CDC/WHO growth curves **only as PNG images** (stock `chart.php` pixel-overlays dots), with no numeric LMS data to reuse — so a native percentile overlay would require bundling an unverified dataset (patient-safety risk, refused). Shipped the safe half: `ClinicalVitalsSeriesService` returns a CSRF-tokened `growth_chart_url` for under-20s; the Vitals Trends panel shows a "Growth chart" link opening the real stock chart. Native overlay deferred, gated on a sourced LMS dataset. Asset `20260711growthlink`. |
| v0.1.15 | 2026-07-11 | B3 patient education built (G7). Research corrected the plan: stock `patient_edu_web_lookup.php` is a clinic-configurable resource list (`external_patient_education`), not a MedlinePlus-only screen — so a native SlideOver ("Patient handouts" in Doctor Desk `ConsultShortcuts`) drives it, injecting the search term at `[%]` and opening in a new tab. `PatientEducationService::getResources()` feeds it via the Doctor Desk page payload; no new ajax action/flag. Asset `20260711patientedu`. |
| v0.1.14 | 2026-07-11 | GAP-B started — B2 vitals-trends core built (G9). New `mrd.clinical_vitals_series` → `ClinicalVitalsSeriesService` aggregates stock `form_vitals` into per-measure series (BP two-line, pulse, resp, temp, SpO₂, weight, height, BMI, head circ); units from `units_of_measure`. New reusable dependency-free `components/TrendLineChart.tsx` SVG chart + `VitalsTrendsPanel` in the Clinical tab, gated by `enable_vitals_trends` (default OFF, wired 3 places). Pediatric growth-percentile overlay (W11) deferred as B2b; track_anything aggregation deferred. Asset `20260711vitalstrends`. |
| v0.1.13 | 2026-07-11 | A6b built — closes the rest of G11 and completes GAP-A. Admin Hub People-lens staff drawer now shows a read-only "Two-step sign-in" On/Off badge via a new `mfa_enabled` field on `StaffAccessSummaryService::getSummary()` (`COUNT(*)` on `login_mfa_registrations`, any method); `new_admin` ACL, no new ajax action. Enrollment stays self-service. Asset `20260711mfastatuspill`. |
| v0.1.12 | 2026-07-11 | A6 self-service MFA built. Research corrected the plan: enrollment uses core `Totp` (RobThree/Bacon) + stock `login_mfa_registrations` (encrypted `var1`), not `MfaUtils` (which is only the login-time check). `my-profile` gains a Security section — TOTP enroll (password → QR → **verify a code before saving**, stricter than stock's save-on-display) + remove (password), via new `MfaEnrollmentService` + `profile.mfa.status|enroll_start|enroll_verify|remove` (self-scoped `desk_acl`). TOTP only, no U2F. Audit-logged. G11 self-enroll half done; Admin People-lens MFA status pill deferred as A6b. Asset `20260711mfaenroll`. |
| v0.1.11 | 2026-07-11 | A5 (G5 patient reminders) built — but **not** as specced. Re-research before build overturned the plan: `patient_reminders` is the CDR rules-output table (already shown read-only in the chart Messages tab), and a full Recalls system (`SchedulingRecallsService`, `medex_recalls`, `recall_type='follow_up'`) already met the "flag for follow-up" need — a `patient_reminders` COM lens would have duplicated it. Built a chart-header "Flag for follow-up" action (`FollowUpFlagModal`) that creates a `follow_up` recall via new `scheduling.recalls.flag_follow_up` + `SchedulingRecallsService::flagFollowUp()`; gated by the existing recall write ACL (assertHubAccess + canBookAppointment, new `canAccessHub()` helper). One follow-up home (Recalls), no parallel store. Asset `20260711flagfollowup`. |
| v0.1.10 | 2026-07-11 | A4 root-cause follow-up: the Clinical-tab **"Open referrals" link itself** still didn't show for a patient with zero referrals — the v0.1.9 fix only added the header "Print / Letters" menu as an alternate path to *Letters*, leaving the referral entry point on Clinical stranded (user re-reported: "the 'Open referrals' link isn't showing on the Clinical tab"). Root cause: `getClinicalStrip()` hid the whole strip on `'hidden' => $items === []`. Fixed to `'hidden' => $items === [] && !$canOpen`, so with an active encounter + `new_chart_depth`/`new_chart_depth_referral` view ACL the strip renders even at zero referrals (empty summary "No referrals on this visit yet.") — same enabled-plus-ACL reachability as the Visits-tab "Referrals for this visit" link (`buildVisitReferralsUrl`), which was already correct. G4 gap row flipped Partial→Closed (was stale — letters+labels shipped in v0.1.7). Labs/meds clinical strips keep their hide-when-empty behavior deliberately (they summarize activity and have Lab Ops / Pharm Ops desk entrances; no create-first chicken-and-egg). Asset `20260711referralstripempty`. |
| v0.1.7 | 2026-07-11 | A4 (Letters & labels) built and verified, closing G4. Pre-build research overturned the draft's core claim: stock letters use flat-file templates in `documents/letter_templates` + `{TOKEN}` str_replace (`interface/patient_file/letter.php`), not the `document_templates` table (patient-portal system). Built on the real stock engine — templates interchangeable with the legacy screen, `TO_*` recipients from the A3 directory, barcode labels via core-vendored `Barcode::gd()` as PNG data-URIs (no FPDF). One flag `enable_letters_labels` (default OFF) gates both the Letters tab (chart-depth referrals hub) and the label-print menu (patient-chart header). New unit test caught a dotfile-listing gap in `listTemplates()` pre-merge; the live smoke exposed and fixed a pre-existing chart-killing bug — `PaymentsStrip.tsx` rendered `ProfilePaymentsSummaryService`'s `last_receipt` object directly as a React child (type said `string \| null`), crashing the whole patient-chart island for any patient with a receipt once chart-depth finance is on. |

# Patient Chart Depth — Beyond MRD Redesign Specification

| Field | Value |
|-------|--------|
| **Document version** | 0.1.15 |
| **Status** | Draft for review — aligned to PRD **Module M11** (v1.20.47, decision **D61**; currency **D-REG-3** / M6-F27; M14 cross-link **D-BILL-1**) |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](../NEW_CLINIC_V1_PRD.md) (v1.20.47), [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](../MEDICAL_RECORD_DASHBOARD_REDESIGN.md) (v0.2.35), [NEW_CLINIC_V1_MEDICAL_HISTORY_BACKGROUND_REDESIGN.md](./NEW_CLINIC_V1_MEDICAL_HISTORY_BACKGROUND_REDESIGN.md) (v0.1.1), [NEW_CLINIC_V1_PAGE_DESIGNS.md](../NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.47), [NEW_CLINIC_V1_USER_WORKFLOWS.md](../NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.47), [NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md](../NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md) (v0.1.1), [NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md](./NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md) (v0.1.3) |
| **Audience** | Product, design, clinical leads, billing leads, implementers, QA |
| **Scope** | Legacy patient-chart surfaces **not fully absorbed** by the redesigned MRD — financial history, referrals & letters, clinical reports, PRO, external data, and overflow navigation |
| **Implementation** | Design only — no code in this document |
| **Wireframes** | [PAGE_DESIGNS §7.13–§7.16](../NEW_CLINIC_V1_PAGE_DESIGNS.md#713-chart-depthpaymentsphp--payment-history) · MRD host strips [§4.19](../NEW_CLINIC_V1_PAGE_DESIGNS.md#419-mrd-host-summary-strips-m11) |
| **Primary market** | Private outpatient clinics — **West Africa** (V1 launch region) |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Gap analysis — what MRD already covers](#2-gap-analysis--what-mrd-already-covers)
3. [Current-state snapshot (stock OpenEMR)](#3-current-state-snapshot-stock-openemr)
4. [Pain points by surface](#4-pain-points-by-surface)
5. [UI/UX principles for chart depth](#5-uiux-principles-for-chart-depth)
6. [How leading EHRs address these needs](#6-how-leading-ehrs-address-these-needs)
7. [West Africa context](#7-west-africa-context)
8. [Information architecture](#8-information-architecture)
9. [Financial — visit charges & patient ledger](#9-financial--visit-charges--patient-ledger)
10. [Referrals, transactions & correspondence](#10-referrals-transactions--correspondence)
11. [Clinical reports & record export](#11-clinical-reports--record-export)
12. [Patient-reported outcomes (PRO)](#12-patient-reported-outcomes-pro)
13. [External data & care outside the clinic](#13-external-data--care-outside-the-clinic)
14. [SDOH, assessments & overflow items](#14-sdoh-assessments--overflow-items)
15. [Navigation, ACL & legacy cutover](#15-navigation-acl--legacy-cutover)
16. [Data model & backend contracts](#16-data-model--backend-contracts)
17. [Phasing & PRD alignment](#17-phasing--prd-alignment)
18. [Acceptance criteria](#18-acceptance-criteria)
19. [Open questions](#19-open-questions)
20. [Document history](#20-document-history)
21. [Appendix A — Stock file map](#appendix-a--stock-file-map)
22. [Appendix B — User stories](#appendix-b--user-stories)
23. [Appendix C — Competitive reference matrix](#appendix-c--competitive-reference-matrix)

---

## 1. Purpose & positioning

### 1.1 What this document is for

The [Medical Record Dashboard (MRD) redesign](../MEDICAL_RECORD_DASHBOARD_REDESIGN.md) collapses stock OpenEMR’s 25+ dashboard cards into **five workspace tabs** (Overview · Clinical · Visits · Profile · Messages) plus a safety strip and banner-first actions. That is the right **daily full-chart** surface for New Clinic.

However, several **high-value legacy surfaces** remain reachable only via:

- Stock horizontal patient nav (`interface/main/tabs/menu/menus/patient_menus/standard.json`)
- MRD **⋯ overflow** (“Classic patient menu”, “View ledger”)
- Deep links staff memorized from stock OpenEMR training

For a **private clinic in the launch region**, doctors, cashiers, and managers still need these capabilities **in context** — without falling back to US-centric, desktop-first legacy pages.

This spec defines **Chart Depth** modules: redesigned in-chart experiences for financial history, referrals & letters, clinical reporting, PRO, and external care data — aligned with New Clinic IA, cash clinic workflows, and T1 design tokens.

### 1.2 Problem statement

> Staff who open the full chart for a returning patient can review allergies and visits in the redesigned MRD, but when they need a **receipt reprint**, a **referral letter**, a **visit summary PDF for the patient**, or the **full running account**, they still land on legacy OpenEMR pages that assume US insurance, multi-tab iframes, and power-user menu literacy — unsuitable for a 1–2 receptionist private clinic in the region.

### 1.3 Positioning vs other surfaces

| Surface | Question it answers | Relationship to Chart Depth |
|---------|---------------------|----------------------------|
| **Role desks** (Front Desk, Doctor, Cashier, …) | “What is my next task on the floor?” | **Primary** for queue work; Cashier owns **today’s payment** |
| **Redesigned MRD** | “What is this patient’s story?” | **Primary** for longitudinal clinical view; banner shows **balance due** when visit `ready_for_payment` |
| **Chart Depth (this spec)** | “Show me money history / referral letter / export / outside records / PRO scores” | **Secondary depth** — opened from MRD tabs or overflow, never replaces desks |
| **M7 Daily Reports** | “How did the clinic perform today?” | **Aggregate** — not per-patient |
| **Billing Back Office (M14)** | “Fix charges, find payments, close the day, chase balances” | **Clinic-wide finance ops** — post-pilot [V1.2-BILL](./NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md#17-phasing--prd-alignment); pilot uses M5 + Classic menu |
| **Patient Registry (M10)** | “Who matches this cohort?” | **Population** — not single-chart |

**Training copy (extends MRD):** *“Desk for queue work; chart for history; depth panels for money, letters, and exports.”*

---

## 2. Gap analysis — what MRD already covers

Stock horizontal nav (`standard.json`) vs MRD v0.2:

| Stock menu item | MRD home (v0.2) | Chart Depth gap |
|-----------------|-----------------|-----------------|
| Dashboard | MRD itself | — |
| History | Clinical → **Background** (§8.9) | **T1-F20** read summary + **Edit history** → stock editor (`history_full.php`) V1; **T1-F20b** T1 shell when `enable_history_editor_wrap` = 1 — [MEDICAL_HISTORY_BACKGROUND](./NEW_CLINIC_V1_MEDICAL_HISTORY_BACKGROUND_REDESIGN.md) |
| Assessments / SDOH | Clinical → **Background** (SDOH chips when enabled, MRD §8.9) + **This visit** for encounter questionnaires | SDOH in PAGE_DESIGNS §4.14 Background row; stock **Assessments (SDOH)** horizontal nav hidden when B7 + T1-F06 (MRD §8.2) |
| Report | Visits **View documentation** + **Export visit summary** (CDc) + ⋯ Classic | **M11-F05/F06** export builder — [PATIENT_CLINICAL_EXPORT](./NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md); pilot **M11-F11** wrapper |
| Documents | Profile → **Documents & ID** | Core document list OK; needs T1 chrome + mobile scan flow |
| Transactions | **None** — ⋯ overflow only | **Full redesign required** (referrals, letters) |
| Issues | Safety strip + Clinical | Covered |
| Ledger | Profile cash summary + ⋯ **View ledger** | **Payment history** panel (M11-F01) — [PATIENT_PAYMENT_HISTORY](./NEW_CLINIC_V1_PATIENT_PAYMENT_HISTORY_REDESIGN.md); pilot **M11-F11** wrapper |
| External Data | ⋯ overflow; MRD **Care elsewhere** when V1.2 ON | **Care elsewhere** (`#clinical-external`, M11-F10) — V1.2 |
| PRO (Easipro) | ⋯ overflow; MRD **Assessments (PRO)** when `easipro_enable` | Optional `#clinical-assessments` — V2 / optional V1.1 |
| Modules | Event hooks | Unchanged |

**Conclusion:** MRD solves **clinical longitudinal IA**. Chart Depth solves **financial transparency, correspondence, export, outside care, and PRO** without adding a sixth MRD tab (keeps D-MRD-1 five-tab IA intact).

---

## 3. Current-state snapshot (stock OpenEMR)

### 3.1 Patient horizontal menu

Source: `interface/main/tabs/menu/menus/patient_menus/standard.json`

```text
Dashboard | History | Assessments (SDOH) | Report | Documents |
Transactions | Issues | Ledger | External Data | PRO | Modules
```

Every item loads a **full PHP page** inside the Knockout tab iframe, with `dashboard_header.php` + horizontal nav repeated. No shared patient-context-banner on legacy pages (V1.2 overlay T1-F18 is optional and minimal).

### 3.2 Ledger — `interface/reports/pat_ledger.php`

| Property | Detail |
|----------|--------|
| **Purpose** | Patient ledger of charges, payments, adjustments by date range |
| **ACL** | `acct` / `rep` |
| **UI** | Report-style form (date from/to), encounter-grouped HTML tables, insurance payer columns |
| **Data** | `ar_activity`, `ar_session`, `billing`, `insurance_companies` |
| **Pain signals** | ~960 lines procedural PHP; insurance-centric labels; not mobile-friendly; separate from Cashier desk receipt flow |

New Clinic **does not** maintain a parallel ledger (PRD §M5.2) — all payments post to core AR. Chart Depth **surfaces** core AR read-only for authorized roles.

### 3.3 Transactions & referrals — `interface/patient_file/transaction/`

| File | Purpose |
|------|---------|
| `transactions.php` | List all patient transactions (`transactions` table) |
| `add_transaction.php` | Create/edit layout-based transaction (default `LBTref` = referral) |
| `print_referral.php` | Print referral from `lbt_data` + site `referral_template.html` |
| `letter.php` | General correspondence from `letter_templates` with merge fields |

Referrals use **layout-based forms (LBF)** — flexible but opaque to non-admin staff. Referral date lives in `lbt_data`, not `transactions.date`.

### 3.4 Clinical reports — `interface/patient_file/report/patient_report.php`

| Property | Detail |
|----------|--------|
| **Purpose** | Checkbox builder → generate HTML/PDF patient report |
| **ACL** | `patients` / `pat_rep` |
| **Includes** | Demographics, history, insurance, billing, immunizations, notes, transactions, issues, encounters/forms |
| **US artifacts** | CCR/CCD when `activate_ccr_ccd_report`; insurance section prominent |
| **Tech debt** | TODO in file header to refactor with `portal_patient_report.php` Twig pattern |

### 3.5 PRO / Easipro — `interface/easipro/pro.php`

| Property | Detail |
|----------|--------|
| **Purpose** | NIH Toolbox / PROMIS-style assessments via external Assessment Center API |
| **Globals** | `easipro_enable`, `easipro_server`, `easipro_name`, `easipro_pass` (encrypted) |
| **UI** | Tab toggle encounter vs procedure PRO; AJAX form catalog from `easipro_util.php` |
| **Relevance (launch region)** | Low default adoption — US-research instrument focus; requires internet + licensing |
| **Service** | `src/Easipro/Easipro.php` — REST to `assessmentcenter.net` |

### 3.6 External data — `interface/reports/external_data.php`

| Property | Detail |
|----------|--------|
| **Purpose** | View `external_encounters` and `external_procedures` imported from outside systems |
| **UI** | Bootstrap pills: Encounters | Procedures |
| **Usage** | Rare in small private clinics; relevant when interfacing with NHIS facilities or lab hubs |

### 3.7 SDOH — `interface/patient_file/history/history_sdoh_widget.php`

Embedded widget for Social Determinants of Health screening; separate from main History form. Not wired into MRD Clinical §8.9 section list.

---

## 4. Pain points by surface

### 4.1 Cross-cutting (all legacy chart pages)

| Pain | Who feels it | Impact |
|------|--------------|--------|
| **Menu archaeology** | All clinical staff | 10+ horizontal tabs; no role-based pruning except New Clinic `MENU_RESTRICT` |
| **Iframe + session fragility** | Doctor, nurse | `top.restoreSession()` on every click; lost context on popup blockers |
| **No visit awareness** | Reception, doctor | Legacy pages show patient, not **today’s queue #** or visit state |
| **US insurance vocabulary** | Cashier, manager | EOB, payer, copay, eligibility — confusing in cash clinic |
| **Desktop tables** | Nurse on tablet | Horizontal scroll; tiny touch targets on `pat_ledger.php` |
| **Duplicate patient context** | Everyone | Banner on MRD vs plain header on legacy — **wrong-patient risk** (PRD §6.1i) |
| **Print/PDF inconsistency** | Reception, doctor | Referral template vs letter template vs report PDF — three different flows |
| **No audit-friendly exports** | Manager | Hard to produce “visit summary for patient” without checking 15 boxes |

### 4.2 Ledger & billing history

| Pain | Detail |
|------|--------|
| **Disconnected from Cashier** | Today’s payment happens on Cashier desk; historical view is a separate **Reports** menu item |
| **Encounter grouping opaque** | Staff want “what did last Tuesday’s visit cost?” not accounting session IDs |
| **Insurance columns noise** | Cash clinic sees empty payer columns — looks broken |
| **No receipt link** | `new_receipt` module receipts not surfaced in stock ledger |
| **Permission too broad** | `acct/rep` is manager-grade; doctors shouldn’t need full AR to see “patient paid 120 (clinic currency)” |

### 4.3 Referrals & letters

| Pain | Detail |
|------|--------|
| **LBF complexity** | Creating referral requires understanding layout groups — doctors abandon flow |
| **Template maintenance** | `sites/default/referral_template.html` and `letter_templates` — no in-app preview for clinic letterhead |
| **No link to visit** | Referral not tied to `new_visit` or encounter — hard to find “referral from this consult” |
| **External lab reality** | Patient carries **paper referral** to a referral or private lab; clinic needs fast print + optional scan-back (PRD D34 `referral_document_id` is **inbound** scan, not **outbound** letter) |
| **Transactions ≠ only referrals** | Stock transactions include other LBF types — UI says “Transactions” not “Referrals & letters” |

### 4.4 Clinical reports

| Pain | Detail |
|------|--------|
| **Checkbox overload** | 20+ options; “Check All” exports everything including US insurance |
| **No presets** | No “Visit summary”, “Referral pack”, “Employer letter” one-click |
| **CCD/CCR pop-up dependency** | Requires pop-ups; irrelevant in West Africa private practice |
| **Encounter selection tedious** | Must hunt encounters in second column — MRD Visits tab already lists these |
| **Language** | Export titles in English only — acceptable V1 but patient-facing PDF needs clinic branding |

### 4.5 PRO / Easipro

| Pain | Detail |
|------|--------|
| **US instrument catalog** | PROMIS, Neuro-QoL — not validated for local languages |
| **External dependency** | Assessment Center API — fails on poor connectivity (common on 3G) |
| **Licensing cost** | Per Assessment Center account — unlikely for small clinic |
| **Not integrated in MRD** | Scores don’t appear on Overview or Clinical tab |
| **Menu clutter** | PRO menu item hidden by globals but confuses installers |

### 4.6 External data

| Pain | Detail |
|------|--------|
| **Empty state default** | Most clinics see blank tables — feels like broken feature |
| **No manual entry** | Cannot record “saw cardiologist at Trust Hospital last month” without custom workflow |
| **Disconnected from referrals** | Outbound referral ≠ inbound external encounter |

---

## 5. UI/UX principles for chart depth

Aligned with PRD §10, MRD §3, and [FRONTEND_2026_MODERNIZATION_PLAN.md](../FRONTEND_2026_MODERNIZATION_PLAN.md):

### 5.1 Core principles

| # | Principle | Application to Chart Depth |
|---|-----------|---------------------------|
| P1 | **Task over tool** | Label surfaces by staff intent: “Payment history”, “Referral letter”, “Visit summary PDF” — not “Transactions” or “Report” |
| P2 | **Visit-scoped default** | Open financial and correspondence views filtered to **active visit** first; expand to all history |
| P3 | **Progressive disclosure** | Summary card in MRD → full depth panel; never dump 500-row ledger on first paint |
| P4 | **Cash truth** | clinic currency formatting; no insurance columns when `enable_insurance = false` |
| P5 | **Identity anchor** | Every depth panel inherits `patient-context-banner` + visit chip (MRD Zone A / T1-F18) |
| P6 | **Least disruptive navigation** | Slide-over panel or in-tab sub-route — not new iframe tab when opened from MRD |
| P7 | **Print-first where paper wins** | Referrals and receipts must print reliably on A4 — clinics still hand paper to patients |
| P8 | **Offline-tolerant read** | Historical ledger and past referrals should render from DB without external API |
| P9 | **ACL by intent** | Separate “view own patient receipts” vs “full AR ledger” vs “issue referral letter” |
| P10 | **Audit everything** | Reprint receipt, generate export, issue referral → audit event |

### 5.2 Interaction patterns (normative)

```text
MRD tab content
  └─ Summary strip (e.g. "Last payment 150 (clinic currency) · 12 Mar")
       └─ [ View full history ] → Chart Depth panel (slide-over ≥768px, full page <768px)
            └─ Actions: Print · Export PDF · Copy link (staff only)
```

- **Slide-over width:** 480px (ledger summary) – 720px (report builder) on desktop
- **Mobile:** full-screen sheet with sticky **Close** + patient banner
- **Loading:** skeleton rows; paginate 20 at a time (match MRD Visits §8.5.3)

### 5.3 Content design (regional)

- Currency: clinic `currency_symbol` per M6 / PRD §14 — never hardcode `$`
- Dates: **DD/MM/YYYY**
- Phone on correspondence: local `0XX` format
- Avoid: Copay, EOB, Payer, Prior auth, Superbill
- Prefer: **Receipt**, **Balance**, **Amount paid**, **Change**, **NHIS No. (optional)** on demographics only

---

## 6. How leading EHRs address these needs

*Synthesis for product direction — not feature parity claims.*

### 6.1 Enterprise ambulatory (Epic, Cerner, athenahealth)

| Need | Typical pattern | Lesson for New Clinic |
|------|-----------------|----------------------|
| **Billing history** | **Account summary** widget on chart + dedicated **Billing** tab with visit-level buckets | Show **per-visit balance** first; accounting detail behind “View ledger” |
| **Referrals** | **Orders → Referral** linked to encounter; letter generated from template; status tracked (sent / completed) | Tie outbound referral to `encounter_id` + optional `new_visit_id`; one-click print |
| **Clinical export** | **Chart Summary**, **AVS (After Visit Summary)**, note-based exports | Preset: **Visit summary** = demographics + problems + allergies + meds + today’s note + vitals |
| **PRO** | Integrated flowsheet scores (PROMIS) in chart sidebar; patient completes on portal | Defer Easipro; V2 consider local questionnaires via LBF/portal |
| **Outside records** | HIE / Care Everywhere / document import queue | V1: manual document upload + optional external encounter note; V2: NHIS facility link |

### 6.2 Lightweight / emerging market systems

| System | Relevance |
|--------|-----------|
| **OpenMRS** | Concept-based forms; strong for public health — weaker private billing UX |
| **Bahmni / GNU Health** | Visit-centric billing — closer to “one visit one bill” mental model |
| **Local regional HMS products** | Heavy on **receipt + daily cash book**; weak longitudinal clinical record — New Clinic must win on **both** |

### 6.3 Best-in-class UX patterns to adopt

1. **Stripe-style receipt timeline** — chronological money events with human labels (“Consultation fee”, “Lab panel”, “Cash payment”)
2. **Notion-style export presets** — named templates instead of checkbox wall
3. **Google Docs template merge** for letters — preview before print
4. **Status chips on referrals** — Draft · Printed · Given to patient · Result received (link scanned document)
5. **Empty states that teach** — “No referrals yet — [ Create referral from today’s visit ]”

---

## 7. West Africa context

### 7.1 Clinical practice realities

| Factor | Implication for Chart Depth |
|--------|----------------------------|
| **Cash settlement at visit end** | Payment history is **patient-facing** — staff show receipt on screen or reprint |
| **Split payments at checkout** | **Not in V1** (D-BILL-2) — M5 requires **full pay** per visit; timeline may show **multiple payments on different days** (return visits); registration-fee-upfront workflows deferred |
| **MoMo (mobile money)** | V1.1-OPS: manual reference field on payment — ledger row shows “MoMo · Ref: …” (PRD §23) |
| **NHIS membership** | Attribute on profile only in V1 — **no claims ledger**; export presets hide insurance billing |
| **Referral chains** | Private GP → public tertiary (regional teaching hospitals) or private lab — **paper referral + phone photo** common |
| **Lab-direct visits** | Patient may arrive with external lab order — inbound scan (`referral_document_id`) not outbound letter (PRD §6.8) |
| **Low specialist density** | Referral letters are **high stakes** — must look professional (clinic logo, doctor reg no.) |
| **Shared devices** | Wrong-patient prevention on reprint/export is **P0** (extend PRD §6.1i to Chart Depth modals) |

### 7.2 Connectivity & devices

| Constraint | Design response |
|------------|-----------------|
| 3G latency (PRD §16) | Ledger first page ≤20 rows; no external API on initial paint |
| Tablet at reception | Touch targets ≥44px; print via browser dialog |
| Power cuts | Read-only history from local DB; queue PRO for online recovery (V2) |
| WhatsApp culture | V1: **Print/PDF** not WhatsApp share (PHI risk); patient portal deferred (PRD NG) |

### 7.3 Regulatory & privacy (practical V1)

| Topic | V1 approach |
|-------|-------------|
| **local data protection law** | Audit exports; consent checkbox at registration (PRD §15.1) |
| **Patient access to records** | Visit summary PDF handoff — not full chart export to patient by default |
| **Retention** | No auto-delete; clinic SOP (PRD §15.1) |

### 7.4 Localization

| Item | Standard |
|------|----------|
| Currency | M6 `currency_code` + `formatMoney()` (PRD §14) |
| Timezone | `clinic_tz` from M6 |
| Language | English UI V1; strings via `xl()` for Twi/French later |
| Letterhead | Facility name, address, phone from `facility` table; national address (GPS) optional field M6 |

---

## 8. Information architecture

### 8.1 Design decision: depth panels, not a sixth MRD tab

**Closed (D-CD-1):** Chart Depth surfaces open as **sub-routes or slide-overs** from existing MRD tabs — preserving D-MRD-1 five-tab IA.

### 8.2 Entry point map

| Chart Depth module | Primary entry | Secondary entry |
|--------------------|---------------|-----------------|
| **Payment history** | MRD Profile → **Payments** strip | Overview feed `payment_posted` → View receipt; Cashier → patient history link; ⋯ overflow |
| **Referrals & letters** | MRD Clinical → **This visit** → Create referral | Visits row expand; ⋯ overflow |
| **Export visit summary** | MRD Visits → row → **Export visit summary** (when `enable_chart_depth_export` = 1) | Profile → Documents → Generate report |
| **Full chart export** | ⋯ → **Export chart** (power user) | Admin compliance |
| **PRO scores** | Clinical → **Assessments (PRO)** (`#clinical-assessments`) when enabled | Hidden when `easipro_enable = 0` |
| **External care** | Clinical → **Care elsewhere** | ⋯ overflow |

### 8.3 MRD tab enhancements (minimal)

Add **summary strips** only — not full implementations:

```text
Profile tab
  ├─ … existing demographics, completion, documents …
  └─ Payments strip (NEW)
       "Balance: 0.00 · Last receipt #1042 · 18/06/2026"
       [ View payment history ]

Clinical tab
  ├─ … §8.9 sections …
  └─ Referrals strip (NEW, when any exist for active encounter)
       "Referral to Regional Cardiology Clinic · Draft"
       [ Open referrals ]

Visits tab
  └─ Past row actions (extend §8.5.4)
       [ Export visit summary ]  (NEW)
```

### 8.4 Module codename

| Element | Value |
|---------|-------|
| PRD module slot | **M11 — Chart Depth** (closed — PRD **D61**, §8 Module M11) |
| Functional traceability | PRD **M11-F01–F12** · acceptance **§21.1p** · tests **CD-1–CD-5** (§16.1) |
| Route prefix | `/interface/modules/custom_modules/oe-module-new-clinic/public/chart-depth/` |
| AJAX namespace | `chart_depth.*` |

---

## 9. Financial — visit charges & patient ledger

**Full spec:** [PATIENT_PAYMENT_HISTORY](./NEW_CLINIC_V1_PATIENT_PAYMENT_HISTORY_REDESIGN.md) — pilot **M11-F11** ledger wrapper + **V1.1-CDa** payment history (M11-F01/F02/F07/F12). Wireframes: [PAGE_DESIGNS §7.13](../NEW_CLINIC_V1_PAGE_DESIGNS.md#713-chart-depthpaymentsphp--payment-history).

### 9.1 Purpose

Answer: *“What has this patient paid and owed — by visit — in clinic currency?”* without US AR report chrome.

### 9.2 Users & ACL

| Role | Capability | ACL |
|------|------------|-----|
| Cashier / Cashier lead | Full payment history, reprint receipt | `new_chart_depth_finance` (PRD §4.4) |
| Manager / Admin | Full ledger including adjustments | `new_chart_depth_finance` or core `acct` / `rep` |
| Doctor | **Visit charges summary** for active encounter only — no historical AR | `new_chart_depth_finance_summary` — Zone A chip + Clinical **This visit** (D-FIN-8) |
| Reception | **No** historical payment history in V1 — use Cashier desk or manager | Referrals: `new_chart_depth_referral` for **reception lead** only |

**Receipt reprint confirm (M11-F02):** Modal repeats **Patient · MRN · Receipt # · Amount** before `chart_depth.receipt_reprint` — same identity pattern as Cashier payment confirm (PRD M5-F15, D-FIN-5).

**Adjustment rows (D-FIN-11):** Timeline type `adjustment` returned only when actor has `new_cashier_lead`, `new_admin`, or core `acct` / `rep`.

### 9.3 UI — Payment history panel

**Route:** `chart-depth/payments.php?pid=&visit_id=` (optional visit filter)

```text
┌─ Payment history ─────────────────────────────────────────────── [ × ] ─┐
│ [patient-context-banner]                                                 │
│ Filter: [ This visit ▾ ] [ All visits ] [ Date range… ]                  │
├──────────────────────────────────────────────────────────────────────────┤
│ SUMMARY (when filter = this visit)                                     │
│   Charges:     280.00                                              │
│   Paid:        280.00                                              │
│   Balance:     0.00                                                │
│   Receipt:     #1042 · 18/06/2026 14:32 · Cashier Akosua              │
│   [ Reprint receipt ]  [ Add correction ]*                            │
│   * when `enable_bill_ops` = 1 and ACL `new_bill_ops_correct` → M14-F01 │
├──────────────────────────────────────────────────────────────────────────┤
│ TIMELINE (newest first, paginate 20)                                   │
│   18/06/2026  Payment      280.00  Cash     Receipt #1042          │
│   18/06/2026  Charge       200.00  Consultation (OPD)              │
│   18/06/2026  Charge       80.00  FBC lab panel                   │
│   03/06/2026  Payment      150.00  Cash     Receipt #0981          │
│   … [ Load more ]                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### 9.4 Data sources (read-only)

| Row type | Source |
|----------|--------|
| Charges | `billing` + fee sheet / `new_clinic` fee schedule labels via M6 |
| Payments | `payments`, `ar_activity` (PP), `new_receipt` |
| Adjustments | `ar_activity` (adjustment types) — visible only to `new_cashier_lead`, `new_admin`, or `acct` / `rep` (D-FIN-11) |
| Insurance | **Hidden** when `enable_insurance = false` |

**Do not** duplicate AR posting logic — PRD §M5.2 forbids parallel ledger.

### 9.5 Legacy mapping

| Stock | Chart Depth |
|-------|-------------|
| `pat_ledger.php` | Replaced for Clinic roles by Payment history panel |
| MRD ⋯ View ledger | Routes to Payment history (not stock report) |
| Billing Manager | Admin-only — **M14 Insurance vault** when `enable_bill_ops` + `enable_insurance`; else Advanced under Admin |

### 9.6 Acceptance highlights

- Cashier reprints receipt from history in ≤3 clicks from MRD Profile strip or Cashier **History** link (M11-F12)
- Reprint confirm modal shows **Patient · MRN · Receipt # · Amount** before generate (D-FIN-5)
- **Add correction** visible only when `enable_bill_ops` = 1 and user has `new_bill_ops_correct`; opens [PAGE_DESIGNS §7.26](../NEW_CLINIC_V1_PAGE_DESIGNS.md#726-bill-opscorrectphp--charge-correction-slide-over) with `visit_id` pre-filled
- Doctor sees visit charge total on Zone A + Clinical **This visit** — payment panel **403** without `new_chart_depth_finance` (D-FIN-8)
- All amounts in clinic currency; no `$` or payer columns in cash profile
- First page of `chart_depth.payments_list` ≤2s for one patient with &lt;500 rows (CD-1)

---

## 10. Referrals, transactions & correspondence

**Full spec:** [PATIENT_REFERRALS_LETTERS](../NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md) — pilot **M11-F11** transactions wrapper + **V1.1-CDb** referral wizard + list (M11-F03/F04/F08). Wireframes: [PAGE_DESIGNS §7.14](../NEW_CLINIC_V1_PAGE_DESIGNS.md#714-chart-depthreferralsphp--referrals--letters).

### 10.1 Purpose

Answer: *“Generate and track referral letters and clinic correspondence for this visit.”*

Distinct from **inbound referral scan** (PRD `referral_document_id` at Start visit / lab intake).

### 10.2 Scope

| In scope V1.1 | Out of scope V1 |
|---------------|-----------------|
| Outbound **referral letter** (specialist, hospital, lab) | eReferral networks / HL7 |
| **General letter** from template (employer, school, travel) | Fax integration |
| List referrals **by patient** with encounter link | Automatic referral status from external lab |
| Print / PDF A4 | SMS referral link to patient |

### 10.3 UI — Referrals & letters hub

**Route:** `chart-depth/referrals.php?pid=&encounter_id=`

```text
┌─ Referrals & letters ─────────────────────────────────────────── [ × ] ─┐
│ [patient-context-banner]  Encounter: 18/06/2026 OPD                    │
│ [ + New referral ] [ + New letter ]                                    │
├──────────────────────────────────────────────────────────────────────────┤
│ 18/06/2026  Referral  → Regional Teaching Hospital, Cardiology         │
│             Dr. Mensah · Status: Printed · [ View ] [ Reprint ]         │
│ 02/05/2026  Letter    → Employer fitness certificate                    │
│             Status: Given to patient                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Referral composer (wizard)

Replace raw LBF editor for **default referral type** with 3-step wizard:

| Step | Fields |
|------|--------|
| 1. Destination | Facility name (autocomplete from `referral_facility_seed_json` + `list_options` + free text), department, address, phone |
| 2. Clinical reason | CC (prefill from `new_visit.chief_complaint`), diagnosis (from problem list pick), summary (textarea), relevant labs (checkbox from recent results) |
| 3. Preview & print | Render `referral_template.html` with merge fields; clinic logo; doctor name + **MDC registration** optional field |

**Backend:** Still writes `transactions` + `lbt_data` for compatibility — wizard is a façade over `LBTref`.

### 10.5 Letter composer

Reuse `letter.php` merge field model with T1 UI:

- Template picker (site `documents/letter_templates`)
- To / From address books
- Preview → Print / Save to Documents

### 10.6 Status model (`new_referral_meta`)

Module table **V1.1-CDb** (PRD §12.1) — optional metadata on stock `transactions` / `LBTref`:

| Field | Notes |
|-------|-------|
| `transaction_id` | FK to `transactions.id` |
| `encounter_id`, `visit_id`, `pid` | Links |
| `status` | `draft` \| `printed` \| `given` \| `result_received` |
| `destination_facility` | Text |
| `result_document_id` | Optional link when scan uploaded |

### 10.7 Regional defaults

- Template includes **NHIS No.** line when patient has NHIS field populated
- Common destinations seed list: major regional referral hospitals + popular private labs (M6 config JSON)
- **Referral on file** banner chip (inbound) vs **Referral issued** chip (outbound) — different colors

---

## 11. Clinical reports & record export

**Full spec:** [PATIENT_CLINICAL_EXPORT](./NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md) — pilot **M11-F11** stock wrapper + **V1.1-CDc** export builder (M11-F05/F06). Wireframes: [PAGE_DESIGNS §7.15](../NEW_CLINIC_V1_PAGE_DESIGNS.md#715-chart-depthexportphp--clinical-export).

### 11.1 Purpose

Answer: *“Give me a PDF of what matters — for this visit or for continuity — without US insurance clutter.”*

### 11.2 Export presets (replace checkbox wall)

| Preset | Includes | Default audience |
|--------|----------|------------------|
| **Visit summary** | Demographics, CC, vitals, problems, allergies, meds, today’s signed note | Patient handoff |
| **Clinical summary** | Problems, allergies, meds, immunizations, last 3 visits list | Referring doctor |
| **Employer / school letter** | Routes to letter composer | Patient request |
| **Full chart (admin)** | All authorized sections | Compliance audit |
| **Custom** | Advanced checkbox panel (legacy power user) | Admin |

### 11.3 UI — Export builder

**Route:** `chart-depth/export.php?pid=&encounter_id=`

```text
┌─ Export chart ────────────────────────────────────────────────── [ × ] ─┐
│ Preset: [ Visit summary ▾ ]                                            │
│ Encounter: [ 18/06/2026 OPD ▾ ]  (required for visit summary)          │
│ Include:  ☑ Vitals  ☑ Medications  ☐ Notes (unsigned hidden)           │
│ [ Generate PDF ]  [ Print ]                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### 11.4 Technical approach

- **V1.1:** Twig templates per preset; **mPDF** via existing OpenEMR PDF stack (same as `custom_report.php`)
- Reuse `PatientReportEvent` for module extensions
- **Hide:** CCR/CCD section when `activate_ccr_ccd_report` and clinic profile = cash clinic profile
- Unsigned notes: **excluded by default**; checkbox with warning if override ACL

### 11.5 Wrong-patient guard

Export modal repeats **Patient · MRN · Encounter date** — same pattern as Cashier confirm (PRD M5-F15).

---

## 12. Patient-reported outcomes (PRO)

### 12.1 Positioning (regional practice)

| Decision | Rationale |
|----------|-----------|
| **V1: OFF by default** | Easipro is US-research focused, licensed, connectivity-dependent |
| **V1.1: Optional** | Clinics with Assessment Center credentials enable via M6 |
| **V2: Local PRO** | LBF questionnaires + portal — Twi/English, offline capture |

**MRD anchor (when enabled):** Clinical tab section **Assessments (PRO)** at `#clinical-assessments` — hidden when `easipro_enable = 0` (MRD §8.9 #10, PAGE_DESIGNS §4.14).

### 12.2 When enabled (`easipro_enable = 1`)

| Element | Behavior |
|---------|----------|
| Entry | Clinical tab → **Assessments (PRO)** (`#clinical-assessments`) | Hidden when `easipro_enable = 0` |
| UI | Simplified instrument picker — hide US catalog tree; clinic picks **allowed instruments** in M6 |
| Display | Latest scores on Clinical tab; trend sparkline V2 |
| Offline | Block ordering new assessment when API unreachable; show cached completed scores |

### 12.3 Alternative for West Africa (recommended V2)

| Approach | Detail |
|----------|--------|
| **WHO STEPS / PHQ-9 / GAD-7** via LBF | Already supported as encounter forms — no Easipro |
| **SDOH short screen** | 5-question local widget → `history_data` summary on Background |

---

## 13. External data & care outside the clinic

### 13.1 Purpose

Answer: *“What care happened outside our facility?”*

### 13.2 V1.2 scope

**Gate:** `enable_chart_depth_external = 1` (PRD §20.1 V1.2 slice — independent of V1.1-CD).

| Feature | Detail |
|---------|--------|
| **Manual outside encounter** | Date, facility name, reason, optional document upload |
| **Imported rows** | Display `external_encounters` / `external_procedures` when present |
| **Link to referral** | When `result_received`, attach document to originating referral |

### 13.3 UI placement

Clinical tab section **Care elsewhere** (`#clinical-external`) — collapsed when empty.

```text
Care elsewhere
  12/05/2026  Trust Hospital — Echocardiogram (document)
  [ + Record outside visit ]
```

### 13.4 Non-goals

- NHIS claims API
- Automatic HIE feed
- US CCD import workflow

---

## 14. SDOH, assessments & overflow items

### 14.1 SDOH

| Item | Spec |
|------|------|
| **Capture** | `history_sdoh_widget.php` embedded in Clinical → Background subsection |
| **Display** | Summary chips on Background — not separate horizontal nav item |
| **Billing** | Not required for 70% gate (PRD §6.1h) |
| **Launch region** | Optional fields: housing stability, food security, transport to facility — configure via LBF |

### 14.2 Stock overflow mapping

| ⋯ Classic menu item | Chart Depth / MRD destination |
|---------------------|------------------------------|
| History | Clinical → Background (edit) |
| Assessments / SDOH | Clinical → Background + This visit |
| Report | chart-depth/export.php |
| Documents | Profile → Documents & ID |
| Transactions | chart-depth/referrals.php |
| Issues | Clinical → Problems |
| Ledger | chart-depth/payments.php |
| External Data | Clinical → Care elsewhere |
| PRO | Clinical → `#clinical-assessments` (if `easipro_enable`) |
| Modules | Unchanged event hooks |

---

## 15. Navigation, ACL & legacy cutover

### 15.1 Patient menu restriction (extends PRD §19)

When New Clinic module enabled + `enable_chart_depth = 1`:

| Action | Detail |
|--------|--------|
| Hide horizontal nav items | **Per sub-flag** (D-EXP-6): **Ledger** when `enable_chart_depth_finance` = 1; **Report** when `enable_chart_depth_export` = 1; **Transactions** when `enable_chart_depth_referral` = 1; **History** / **Assessments (SDOH)** when B7 + **T1-F06** — for `new_clinic` roles when redesigned MRD is chart host |
| Keep via ⋯ | **Classic patient menu** for power users (MRD **D-MRD-5**) — not admin-only |
| T1-F18 overlay | **Independent** of Chart Depth — server-injects strip on allowlisted stock URLs when `enable_legacy_patient_context_overlay` = 1 ([LEGACY_CHART_CONTEXT](./NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md)) |
| Chart Depth routes | When matching `enable_chart_depth_*` ON, M11 slide-over / module routes replace that stock menu item — **not** a redirect of T1-F18 injection |

### 15.2 ACL keys (normative)

See PRD **§4.4** — not optional:

| Key | Capability |
|-----|------------|
| `new_chart_depth` | Base read access to depth panels |
| `new_chart_depth_finance` | Payment history + receipt reprint |
| `new_chart_depth_finance_summary` | Visit charges summary only (doctor) |
| `new_chart_depth_referral` | Create/edit/print referrals (`new_doctor`, reception lead, `new_admin`) |
| `new_chart_depth_export` | Clinical export presets |
| `new_chart_depth_export_full` | Full chart export (admin) |

### 15.3 Audit events

| Event | Payload |
|-------|---------|
| `chart_depth.receipt_reprinted` | receipt_id, pid, actor |
| `chart_depth.export_generated` | preset, pid, encounter_id |
| `chart_depth.referral_printed` | transaction_id, pid, encounter_id |

---

## 16. Data model & backend contracts

### 16.1 AJAX envelope

Follow [PAGE_DESIGNS §6](../NEW_CLINIC_V1_PAGE_DESIGNS.md#6-ajax-response-envelope).

**Chart Depth namespace (`chart_depth.*`):**

| Action | Request | Response | M11-F |
|--------|---------|----------|-------|
| `chart_depth.payments_list` | `{ pid, visit_id?, encounter_id?, offset, limit }` | `{ summary?, rows[], has_more }` | F01 |
| `chart_depth.receipt_reprint` | `{ receipt_id }` | `{ pdf_url \| html }` | F02 |
| `chart_depth.referrals_list` | `{ pid, encounter_id? }` | `{ items[] }` | F04 |
| `chart_depth.referral_save` | `{ wizard DTO }` | `{ transaction_id, print_url? }` | F03 |
| `chart_depth.referral_print` | `{ transaction_id }` | `{ pdf_url \| html }` | F03–F04 |
| `chart_depth.referral_status` | `{ transaction_id, status, result_document_id? }` | `{ ok }` | F04 |
| `chart_depth.export` | `{ preset, pid, encounter_id?, sections? }` | `{ pdf_url, audit_id }` | F05–F06 |
| `chart_depth.external_list` | `{ pid }` | `{ items[], imported[] }` | F10 (V1.2) |
| `chart_depth.external_save` | `{ pid, occurred_on, facility_name, summary, document_id?, referral_meta_id? }` | `{ id }` | F10 (V1.2) |

**MRD host namespace (implemented in MRD tab loaders, not Chart Depth routes):**

| Action | Request | Response | M11-F |
|--------|---------|----------|-------|
| `mrd.profile_payments_summary` | `{ pid, visit_id? }` | `{ balance_due_amount?, last_receipt?, payments_strip_label }` | F07 |
| `mrd.clinical_referrals_strip` | `{ pid, encounter_id? }` | `{ items[], has_active_draft? }` | F08 |

Normative list: PRD **§13.1**.

### 16.2 Module tables (PRD §12.1)

| Table | Phase | Purpose |
|-------|-------|---------|
| `new_referral_meta` | V1.1-CDb | Outbound referral status + result document link |
| `new_external_care` | V1.2 | Manual outside-encounter rows for `#clinical-external` |

### 16.3 DTO sketch — `PaymentTimelineRowDto`

| Field | Notes |
|-------|-------|
| `occurred_at` | ISO8601 |
| `type` | `charge` \| `payment` \| `adjustment` |
| `label` | Human label from fee schedule |
| `amount` | Signed decimal string |
| `receipt_id` | Nullable |
| `visit_id`, `encounter_id` | Nullable |

---

## 17. Phasing & PRD alignment

Normative module requirements: PRD [§8 Module M11](../NEW_CLINIC_V1_PRD.md#module-m11--chart-depth) · pilot interim full chart: PRD [§5.6.1](../NEW_CLINIC_V1_PRD.md#561-interim-full-chart-pilot-week-1-4).

| Phase | Deliverable | PRD gate | M11-F |
|-------|-------------|----------|-------|
| **V1 pilot** | Balance due on banner + Cashier receipt; ⋯ **styled wrapper** on stock ledger/report/transactions | Chart Depth flags **OFF** | **F11** |
| **V1.1-CDa** | Payment history panel, receipt reprint, Profile **Payments strip**, Cashier **History** link, **Ledger** menu hide | `enable_chart_depth` = 1 **and** `enable_chart_depth_finance` = 1 | **F01, F02, F07, F09** (Ledger only), **F12** |
| **V1.1-CDb** | Referral wizard + list, Clinical **Referrals strip**, `new_referral_meta` status, **Transactions** menu hide | `enable_chart_depth_referral` = 1 | **F03, F04, F08, F09** (Transactions only) |
| **V1.1-CDc** | Export builder presets, Visits **Export visit summary**, admin full export, **Report** menu hide | `enable_chart_depth_export` = 1 | **F05, F06, F09** (Report only) |
| **V1.2** | **Care elsewhere** manual entry + stock import display | `enable_chart_depth_external` = 1 | **F10** |
| **V2 / OPS** | Local PRO (`#clinical-assessments`), MoMo row labels in payment timeline | `easipro_enable` / V1.1-OPS flags | *(not M11-F)* |

**Independence:** CD slices ship like PRD §20.1 — enabling finance depth does not require referral or export depth. **F09** (menu cutover) hides each stock nav item **only when its matching sub-flag ships** (D-EXP-6); see [PATIENT_CLINICAL_EXPORT §10.1](./NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md#101-menu-cutover-m11-f09).

### 17.1 Interim V1 wrapper (pilot)

Until M11 ships, T1 theme wraps stock pages:

| Stock URL | Wrapper behavior |
|-----------|------------------|
| `pat_ledger.php` | Inject banner; hide insurance columns via CSS + cash profile |
| `patient_report.php` | Banner + hide CCR/CCD when cash profile |
| `transactions.php` | Banner + rename heading **Referrals & letters** — [PATIENT_REFERRALS_LETTERS §7](../NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md#7-pilot-interim--stock-transactions-wrapper-m11-f11) |

---

## 18. Acceptance criteria

Maps to PRD **§21.1p** and post-V1 tests **CD-1–CD-5** (§16.1). Build is acceptable when:

1. **CD-1 / CDa:** Cashier opens **Payment history** from MRD Profile strip or Cashier **History** (M11-F12) and reprints receipt without stock `pat_ledger.php`; amounts in clinic currency; reprint confirm shows **Patient · MRN · Receipt # · Amount** (D-FIN-5); first page ≤2s.
2. **CD-2 / CDb:** Doctor creates referral from **today’s encounter** via wizard; print A4 with clinic header; **Referral issued** chip ≠ inbound **Referral on file** (PRD D34).
3. **CD-3 / CDc:** **Visit summary** PDF for one `encounter_id` in ≤10s; excludes insurance when `enable_insurance = false`; export confirm shows **Patient · MRN · Encounter date**.
4. **CD-4:** Profile **Payments strip** loads via `mrd.profile_payments_summary`; Clinical **Referrals strip** when outbound referral exists (MRD §8.10).
5. **CD-5:** Per D-EXP-6 — **Ledger** hidden when `_finance` = 1; **Report** when `_export` = 1; **Transactions** when `_referral` = 1; power users retain **⋯ Classic patient menu** (D-MRD-5). Full criteria: [PATIENT_CLINICAL_EXPORT §11.1](./NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md#111-acceptance-maps-to-prd-211ab-211p-tests-cd-3-cd-5-exp-1exp-6).
6. All Chart Depth panels show `patient-context-banner` with correct pid — switch patient triggers full reload (MRD D-MRD-11).
7. Easipro menu hidden when `easipro_enable = 0`; no `#clinical-assessments` section in Clinical.
8. Audit log contains `chart_depth.receipt_reprinted`, `chart_depth.export_generated`, and `chart_depth.referral_printed` events.
9. **Pilot interim (F11):** When all `enable_chart_depth_*` OFF, stock ledger/report remain reachable with T1 banner wrapper (PRD §5.6.1).
10. **V1.2 (F10):** When `enable_chart_depth_external` = 1, manual outside-encounter row appears under `#clinical-external` without stock **External Data** nav item.

---

## 19. Open questions

| # | Question | Owner | Notes |
|---|----------|-------|-------|
| O-CD-1 | Single slide-over vs dedicated routes for mobile? | Design | Leaning: slide-over ≥768px, route <768px |
| O-CD-3 | facility autocomplete seed list — who maintains? | Clinical lead | `referral_facility_seed_json` in M6 (PRD §12.4) |
| O-CD-4 | Doctor registration number on referral — required field? | Compliance | medical council registration number optional config |
| O-CD-5 | Replace Easipro entirely for pilot clinics? | Product | Leaning: hide; LBF questionnaires sufficient V1 |

**Closed decisions:**

| # | Question | Resolution |
|---|----------|------------|
| O-CD-2 | Should Payment history appear on Cashier desk? | **Yes** — M11-F12 Cashier **History** on paid visit card (≤3 clicks to reprint); PAGE_DESIGNS §7.7 |
| O-CD-6 | PRD module number M11 vs fold into T1? | **M11 submodule** — PRD **D61**; routes under `public/chart-depth/`; not folded into T1 shell |

---

## 20. Document history

| Version | Date | Changes |
|---------|------|---------|
| 0.1.15 | 2026-06-24 | **Referrals audit closure** — §16 `chart_depth.referral_status`; [PATIENT_REFERRALS_LETTERS](../NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md) v0.1.1 |
| 0.1.14 | 2026-06-24 | **Patient referrals & letters spec** — §10 cross-ref [PATIENT_REFERRALS_LETTERS](../NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md); §17.1 F11 transactions wrapper |
| 0.1.13 | 2026-06-24 | **Payment history audit closure** — §9.2 cashier_lead + Amount confirm + D-FIN-11 adjustments; §9.6 CD-1 ≤2s + doctor UI; [PATIENT_PAYMENT_HISTORY](./NEW_CLINIC_V1_PATIENT_PAYMENT_HISTORY_REDESIGN.md) v0.1.1 |
| 0.1.12 | 2026-06-24 | **Patient payment history spec** — §2 Ledger gap row; §9 cross-ref [PATIENT_PAYMENT_HISTORY](./NEW_CLINIC_V1_PATIENT_PAYMENT_HISTORY_REDESIGN.md) |
| 0.1.11 | 2026-06-24 | **Export audit closure** — §15.1 per-sub-flag F09 (D-EXP-6); §17 phasing F09 split by slice; §18 CD-5; [PATIENT_CLINICAL_EXPORT](./NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md) v0.1.1 |
| 0.1.10 | 2026-06-24 | **Patient clinical export spec** — §2 Report gap row; §11 cross-ref [PATIENT_CLINICAL_EXPORT](./NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md) |
| 0.1.9 | 2026-06-24 | **Medical history audit closure** — §2 History/SDOH gap rows; §15.1 T1-F06 History/SDOH nav hide; PRD v1.20.41 / MEDICAL_HISTORY v0.1.1 |
| 0.1.8 | 2026-06-24 | **Audit closure** — §2 SDOH gap row aligned with MRD §8.9 + PAGE_DESIGNS §4.14; companion sync PRD v1.20.40 / MRD v0.2.30 |
| 0.1.7 | 2026-06-22 | Hygiene pass — §8 title; companion sync PRD v1.20.29 |
| 0.1.6 | 2026-06-22 | **D-BILL-2** — §7.1 split payments clarified (no partial checkout); companion sync PRD v1.20.28 |
| 0.1.5 | 2026-06-22 | **M14 cross-link** — Payment history **Add correction** → M14-F01; PRD v1.20.27 / Billing v0.1.1 / PAGE_DESIGNS §7.26 |
| 0.1.4 | 2026-06-22 | **D-REG-3** — clinic currency via M6 / `formatMoney()`; neutral amount field names; PRD v1.20.24 / MRD v0.2.26 |
| 0.1.3 | 2026-06-22 | Audit closure — §17 M11-F phasing fixed; §16 AJAX + tables; §18 ↔ §21.1p/CD tests; O-CD-2 closed; §13.2 V1.2; PRO anchor; ACL normative; US-CD user stories; companions v1.20.14 / v0.2.22 / v0.6.25 |
| 0.1.2 | 2026-06-22 | **G1–G5 audit closure** — O-CD-6 closed (**D61** M11); §17 M11-F traceability; §8.4 PRD cross-refs; wireframes §7.13–§7.16 + §4.19; companions v1.20.13 / v0.2.21 / v0.6.24 / v1.9.25 |
| 0.1.1 | 2026-06-22 | PAGE_DESIGNS §7.13–§7.14 wireframes; docs in `Documentation/NewClinic/` |
| 0.1.0 | 2026-06-22 | Initial draft — pain points, UX research, regional context, IA for ledger/referrals/reports/PRO/external data; companion to MRD v0.2.19 |

---

## Appendix A — Stock file map

| Concern | Primary files |
|---------|---------------|
| Patient menu | `interface/main/tabs/menu/menus/patient_menus/standard.json` |
| Ledger | `interface/reports/pat_ledger.php` |
| Transactions | `interface/patient_file/transaction/transactions.php`, `add_transaction.php` |
| Referral print | `interface/patient_file/transaction/print_referral.php`, `sites/default/referral_template.html` |
| Letters | `interface/patient_file/letter.php`, `sites/default/documents/letter_templates/` |
| Reports | `interface/patient_file/report/patient_report.php`, `custom_report.php` |
| PRO | `interface/easipro/pro.php`, `library/ajax/easipro_util.php`, `src/Easipro/Easipro.php` |
| External data | `interface/reports/external_data.php` |
| SDOH | `interface/patient_file/history/history_sdoh_widget.php` |
| MRD overflow spec | [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](../MEDICAL_RECORD_DASHBOARD_REDESIGN.md) §8.10, §18 |

---

## Appendix B — User stories

| ID | As a… | I want to… | So that… |
|----|-------|------------|----------|
| US-CD-1 | Cashier | reprint today’s receipt from the patient chart | the patient who lost paper can leave |
| US-CD-2 | Doctor | print a referral to a specialist with today’s diagnosis | the patient can attend the referral facility with proper letter |
| US-CD-3 | Reception lead | see if patient already paid last visit balance | I know whether to collect before consult |
| US-CD-4 | Manager | export visit summary PDF for audit | I comply with clinic SOP without US report UI |
| US-CD-5 | Nurse | record that patient had echocardiogram elsewhere | the doctor sees outside care in Clinical tab |
| US-CD-6 | Doctor | not see empty insurance columns | the chart feels built for the launch region cash practice |

---

## Appendix C — Competitive reference matrix

| Capability | Epic (ambulatory) | athena | Typical regional HMS | New Clinic Chart Depth target |
|------------|-------------------|--------|-------------------|-------------------------------|
| Visit-level charges | ✓ Hub | ✓ | ✓ Receipt only | ✓ Timeline + visit filter |
| Running AR ledger | ✓ Billing tab | ✓ | Basic | ✓ Manager panel; cashier receipt-focused |
| Referral letter | ✓ Order-linked | ✓ | Word template | ✓ Wizard + encounter link |
| Patient visit summary PDF | ✓ AVS | ✓ | Rare | ✓ Visit summary preset |
| PRO instruments | ✓ Integrated | Partial | ✗ | V2 local; Easipro optional |
| Outside records | ✓ HIE | Partial | ✗ | V1.2 manual + document (M11-F10) |
| Cash clinic currency | N/A (US) | N/A | ✓ | ✓ Native |
| Mobile tablet UX | ✓ | ✓ | Variable | ✓ T1 tokens + slide-over |
| NHIS claims | ✓ | ✓ | ✓ | **Out of scope V1** (attribute only) |

---

*For MRD tab layout and activity feed, see [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](../MEDICAL_RECORD_DASHBOARD_REDESIGN.md). For cash posting rules, see [NEW_CLINIC_V1_PRD.md](../NEW_CLINIC_V1_PRD.md) §M5.2. For inbound referral scan, see PRD §6.8 D34.*

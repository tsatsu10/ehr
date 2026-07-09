# Patient Clinical Export & Reports — Redesign Specification

| Field | Value |
|-------|--------|
| **Document version** | 0.1.1 |
| **Status** | Audit closure — **pilot wrapper (M11-F11)** + **V1.1-CDc** export builder |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](../NEW_CLINIC_V1_PRD.md) (v1.20.43), [NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md) (v0.1.11), [NEW_CLINIC_V1_PAGE_DESIGNS.md](../NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.46), [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](./MEDICAL_RECORD_DASHBOARD_REDESIGN.md) (v0.2.32), [NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md](./NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md) (v0.1.2), [NEW_CLINIC_V1_USER_WORKFLOWS.md](../NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.45), [NEW_CLINIC_V1_PATIENT_DASHBOARD_B7_PRIMARY_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_DASHBOARD_B7_PRIMARY_REDESIGN.md) (v0.1.1) |
| **Audience** | Product, design, clinical leads, managers, trainers, implementers, QA |
| **Scope** | **Per-patient** clinical record export — stock **Report** menu rehosted via Chart Depth; **not** clinic-wide M16 Reporting Hub |
| **Primary market** | Private outpatient clinics — **Ghana & West Africa** |
| **Implementation** | Design spec only — no code in this document |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Research — OpenEMR patient report pain points](#2-research--openemr-patient-report-pain-points)
3. [Research — UI/UX principles for clinical export](#3-research--uiux-principles-for-clinical-export)
4. [Research — how leading EHRs address patient export](#4-research--how-leading-ehrs-address-patient-export)
5. [Research — Ghana & West Africa context](#5-research--ghana--west-africa-context)
6. [Comprehensive redesign — pilot wrapper + V1.1-CDc](#6-comprehensive-redesign--pilot-wrapper--v11-cdc)
7. [Pilot interim — stock report wrapper (M11-F11)](#7-pilot-interim--stock-report-wrapper-m11-f11)
8. [Export builder — build spec (M11-F05 / M11-F06)](#8-export-builder--build-spec-m11-f05--m11-f06)
9. [Legacy overlay on stock chart — report pages (plain English)](#9-legacy-overlay-on-stock-chart--report-pages-plain-english)
10. [Navigation, menu cutover & ACL](#10-navigation-menu-cutover--acl)
11. [Phasing, acceptance & training](#11-phasing-acceptance--training)
12. [Closed decisions](#12-closed-decisions)
13. [Document history](#13-document-history)

---

## 1. Purpose & positioning

### 1.1 What this document is for

New Clinic staff need **patient-facing and handoff PDFs** — visit summaries for the patient, clinical summaries for a referring doctor, employer letters — without wading through stock OpenEMR’s **Patient Report** checkbox wall, US **CCR/CCD** sections, and insurance billing blocks that confuse cash clinics.

This spec defines how **Reports** move from stock horizontal nav into **Chart Depth export** — a **secondary depth panel** opened from MRD (Visits, Profile, overflow) — **not** a sixth MRD tab and **not** the clinic-wide **M16 Reporting Operations Hub** (aggregate KPIs, immunization exports, daysheets).

**Two-layer model (closed):**

| Layer | When | Behavior |
|-------|------|----------|
| **Pilot wrapper (M11-F11)** | Chart Depth flags **OFF**; pilot week 1–4 | Stock `patient_report.php` with T1 banner + hide US sections when cash profile |
| **Export builder (V1.1-CDc)** | `enable_chart_depth_export` = 1 | New `chart-depth/export.php` presets — Visit summary, Clinical summary, Custom/Full (admin) |

**Trainer one-liner:** *“**Desks** run today; **chart** tells the story; **export** gives the patient or doctor a paper they can walk away with.”*

### 1.2 Problem statement (Ghana private OPD)

> Reception needs a **visit summary PDF** for a patient travelling to Kumasi. She opens **Report** from the old menu — twenty checkboxes, a CCR section that needs pop-ups, insurance and billing checked by default, and a second column to hunt encounters. She clicks **Check All** and prints 40 pages including unsigned notes and empty payer columns. The manager asks for a one-page handoff; there is no preset. Meanwhile the redesigned **Visits** tab already lists today’s encounter — but has no **Export visit summary** action until Chart Depth ships.

### 1.3 Positioning vs other surfaces

| Surface | Question | Export / report role |
|---------|----------|----------------------|
| **MRD Visits tab** | What happened each attendance? | **Export visit summary** row action → export builder (V1.1-CDc) |
| **MRD Profile / overflow** | Admin or handoff needs? | **Export chart** → preset picker |
| **Chart Depth export panel** | Give me a PDF preset | **Primary** modern path when CDc ON |
| **Stock Report menu** | Legacy power user | **Pilot:** wrapped stock page; **post-CDc:** hidden from clinic roles; admin via **⋯ Classic menu** |
| **M16 Report Hub** | How did the **clinic** perform? | **Not** per-patient — see [REPORTING_OPERATIONS](./NEW_CLINIC_V1_REPORTING_OPERATIONS_REDESIGN.md) |
| **M7 Daily Reports** | Today’s cash and throughput? | Aggregate EOD — not patient PDF |

```text
Per-patient handoff PDF     →  Chart Depth export (this spec)
Clinic-wide analytics       →  M7 + M16
Visit clinical documentation →  MRD Clinical / M17 hub (not export)
```

### 1.4 Distinction from M16 Reporting Hub

| | **Patient clinical export (M11 / this spec)** | **Reporting Operations Hub (M16)** |
|---|-----------------------------------------------|-------------------------------------|
| **Scope** | One `pid` (optional one `encounter_id`) | Facility / date range / cohort |
| **Examples** | Visit summary PDF, clinical summary for referral | Immunization export, financial lens, DHIMS prep |
| **Stock backend** | `patient_report.php` / `custom_report.php` (pilot); Twig presets (CDc) | `interface/reports/*.php` façades |
| **Menu** | Horizontal nav **Report** (patient chart) | Top menu **Reports** (clinic) |
| **Gate** | `enable_chart_depth_export` | `enable_report_hub` |

---

## 2. Research — OpenEMR patient report pain points

Evidence from stock codebase audit (`patient_report.php`, `custom_report.php`, `report.inc.php`, `PatientReportEvent`) and Chart Depth §3.4 / §4.4.

### 2.1 Information architecture

| Pain | Evidence | Ghana OPD impact |
|------|----------|------------------|
| **Tool-named, not task-named** | Menu label **Report** — staff think “billing report” vs “patient handoff” | Reception avoids feature; uses Word templates outside EMR |
| **Separate from Visits tab** | Encounter list duplicated in report form second column | MRD Visits already shows past rows — report UI ignores it |
| **No preset for common jobs** | Only **Check All** / **Clear All** | Over-export or under-export; no “visit summary” one-click |
| **Post to `custom_report.php`** | Full page reload; checkbox state easy to lose | Slow on 3G; frustrating on tablet |

### 2.2 Stock Patient Report UI (`patient_report.php`)

| Pain | Evidence | Ghana OPD impact |
|------|----------|------------------|
| **Checkbox wall** | Demographics, History, Insurance, Billing, Immunizations, Notes, Transactions, Communications, Recurring appts — plus per-issue and per-encounter checkboxes | Cognitive overload for 1–2 receptionists |
| **Insurance + billing default-on** | `include_insurance`, `include_billing` checked when not simplified demographics | Empty payer columns look broken in cash clinic |
| **CCR/CCD block** | When `activate_ccr_ccd_report` — Continuity of Care Record, pop-up dependency | Irrelevant; MU/US interoperability artifact |
| **US help file** | `report_dashboard_help.php` | Training noise |
| **Legacy chrome** | `dashboard_header.php` + horizontal nav on every step | Same iframe noise as rest of stock chart |
| **TODO refactor** | File header notes portal Twig pattern not adopted | Hard to theme consistently |

### 2.3 PDF generation (`custom_report.php`)

| Pain | Evidence | Ghana OPD impact |
|------|----------|------------------|
| **Monolithic procedural file** | 900+ lines; mPDF; many includes | Upgrade-fragile to wrap |
| **Unsigned notes included easily** | Check All selects all encounter forms | Compliance risk if unsigned SOAP exported |
| **No confirm step** | Generate → immediate PDF | Wrong-patient export risk (PRD §6.1i) |
| **English-only boilerplate** | US date formats in places | Acceptable V1; patient PDF needs clinic letterhead (M6) |
| **Extension point exists** | `PatientReportEvent::ACTIONS_RENDER_POST` | New Clinic can hook without fork V1.1 |

### 2.4 Navigation & roles

| Pain | Evidence | Ghana OPD impact |
|------|----------|------------------|
| **Report in horizontal nav** | `standard.json` — same prominence as Clinical data | Competes with MRD IA after B7 |
| **ACL `pat_rep`** | Broad — managers and doctors share path | Cashier may lack export while reception needs handoff PDF |
| **No audit preset** | Stock logs vary | Manager cannot prove who exported full chart |

---

## 3. Research — UI/UX principles for clinical export

| # | Principle | Application to export |
|---|-----------|----------------------|
| P1 | **Task over tool** | Presets: **Visit summary**, **Clinical summary**, **Employer letter** — not “Patient Report” |
| P2 | **Encounter-scoped default** | Visit summary requires `encounter_id`; pre-fill from Visits row |
| P3 | **Progressive disclosure** | Preset → optional include toggles → generate; **Custom** last for admin |
| P4 | **Cash truth** | Hide insurance, CCR/CCD, billing detail when `enable_insurance = false` |
| P5 | **Identity anchor** | Confirm modal: **Patient · MRN · Encounter date** before POST (M5-F15 pattern) |
| P6 | **Signed documentation default** | Unsigned notes **excluded** unless ACL override + warning |
| P7 | **Print-first where paper wins** | A4 PDF with clinic logo (M6 receipt header asset reuse) |
| P8 | **Audit everything** | `chart_depth.export_generated` with preset + pid + encounter_id |
| P9 | **Least disruptive navigation** | Slide-over from MRD ≥768px; route `<768px`; not new iframe tab |
| P10 | **Not a sixth tab** | Export is depth — D-CD-1 / D-MRD-1 stand |

### 3.1 Anti-patterns (do not ship)

| Anti-pattern | Why |
|--------------|-----|
| Rebuild entire `custom_report.php` engine in V1 | NG5 — use presets + events |
| Default **Check All** in new UI | Recreates stock pain |
| Export from role desk without confirm | Wrong-patient risk |
| Duplicate M16 clinic reports inside patient chart | Scope creep |
| Patient portal auto-send V1 | Out of pilot scope |

---

## 4. Research — how leading EHRs address patient export

| System | Pattern | Lesson for New Clinic |
|--------|---------|----------------------|
| **Epic Hyperspace** | **AVS (After Visit Summary)** at end of visit; **Chart Review** summary | **Visit summary** preset = AVS equivalent |
| **Cerner PowerChart** | **Chart Summary** + **Documents** outbound | **Clinical summary** for referring clinician — problems, meds, allergies |
| **athenahealth** | **Clinical Summary** C-CDA optional; patient-facing visit recap | Hide C-CDA in cash clinic; PDF handoff is enough V1 |
| **Bahmni / OpenMRS 3** | Print-friendly views; limited export | Simplicity over checkbox walls |
| **Helium Health (Africa SaaS)** | Visit summary + receipt branding | **Clinic letterhead** on every PDF — non-negotiable for trust |
| **Notion / modern SaaS** | Named templates | Presets not checkboxes |

**Takeaway:** Top systems expose **named outputs** tied to **visit or chart context**, with **patient identity repeated at generation time** — not a legacy “report builder” page left over from Meaningful Use.

---

## 5. Research — Ghana & West Africa context

### 5.1 Clinical export needs (private OPD)

| Need | Typical requester | Preset mapping |
|------|-------------------|----------------|
| **Patient travelling / second opinion** | Reception, doctor | **Visit summary** or **Clinical summary** |
| **Employer / school fitness note** | Reception | **Employer letter** → letter composer (Chart Depth referrals/letters family) |
| **Referral hospital packet** | Doctor | **Clinical summary** + separate referral letter (CDb) |
| **Insurance / NHIS (future)** | Admin | Optional sections when `enable_insurance` = 1 — not V1 default |
| **Regulatory audit** | Manager | **Full chart** (admin ACL only) |

### 5.2 Regional UX constraints

| Constraint | Design response |
|------------|-----------------|
| **Paper handoff still norm** | PDF + print; WhatsApp share out of scope V1 |
| **Low digital literacy at desk** | One primary preset visible; no checkbox wall |
| **3G / intermittent connectivity** | Server-side PDF generation; no client-heavy JS |
| **Shared clinic PC** | Confirm modal before generate (§6.1i) |
| **Clinic branding matters** | M6 logo + footer on PDF (reuse receipt header config) |
| **DD/MM/YYYY dates** | All export templates |
| **Clinic currency on any fee line** | Visit summary may show visit charges summary — `formatMoney()` (D-REG-3) |

### 5.3 What to hide in cash clinic profile

| Hide when `enable_insurance = false` | Reason |
|--------------------------------------|--------|
| CCR / CCD sections | US interoperability |
| Insurance checkbox and payer blocks | Empty / confusing |
| Billing detail in patient handoff | Use receipt from Cashier; not AR ledger in AVS |
| **Check All** emphasis in wrapper | Discourages over-export |

### 5.4 Training (Ghana OPD)

| Role | One-liner |
|------|-----------|
| **Reception** | *“For a paper for the patient, use **Export visit summary** on the visit row — not the old Report menu.”* |
| **Doctor** | *“Clinical summary for a referral doctor — Export → Clinical summary.”* |
| **Manager** | *“Full chart export is admin-only and audited — not for daily front desk.”* |

---

## 6. Comprehensive redesign — pilot wrapper + V1.1-CDc

### 6.1 Target architecture

```text
MRD (B7)
  Visits tab ── row ── [ Export visit summary ] ──► chart-depth/export.php
  Profile ⋯ ── [ Export chart ] ───────────────────► chart-depth/export.php
  Clinical / Overview ── (no export primary; use Visits)

chart-depth/export.php (V1.1-CDc)
  ├─ Preset: Visit summary | Clinical summary | Custom | Full chart (admin)
  ├─ Encounter picker (when needed)
  ├─ Confirm: Patient · MRN · Encounter date
  └─ POST chart_depth.export → PDF + audit

Pilot (flags OFF):
  ⋯ Classic menu / horizontal Report ──► patient_report.php + M11-F11 wrapper
```

### 6.2 Phasing summary

| Phase | Deliverable | Gate |
|-------|-------------|------|
| **V1 pilot** | M11-F11 wrapper on stock `patient_report.php` | Chart Depth **OFF**; optional T1-F18 strip |
| **V1.1-CDc** | Export builder M11-F05/F06; Visits **Export visit summary** | `enable_chart_depth` + `enable_chart_depth_export` |
| **Menu cutover** | Hide stock **Report** from horizontal nav when export sub-flag ON | `enable_chart_depth_export` = 1 (M11-F09, D-EXP-6) |
| **Power-user escape** | **⋯ Classic patient menu** → stock Report (wrapped) | D-MRD-5 — reception lead, admin, trained power users |

### 6.3 Wireframe — export builder (V1.1-CDc)

Normative detail: [PAGE_DESIGNS §7.15](../NEW_CLINIC_V1_PAGE_DESIGNS.md#715-chart-depthexportphp--clinical-export).

```text
┌─ Export chart ────────────────────────────────────────────────── [ × ] ─┐
│ [ patient-context-banner — Zone A parity when opened from MRD ]         │
│ Preset: [ Visit summary ▾ ]                                             │
│ Encounter: [ 18/06/2026 OPD · Queue #14 ▾ ]  (required)                 │
│ Include:  ☑ Vitals  ☑ Medications  ☐ Notes (unsigned hidden)            │
│ ── Confirm ──                                                            │
│ Patient: Akua Mensah · MRN 00482 · Encounter 18/06/2026                  │
│ [ Generate PDF ]  [ Print ]                                              │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Preset content matrix

| Preset | Includes | Excludes (cash profile) | ACL |
|--------|----------|-------------------------|-----|
| **Visit summary** | Demographics, CC, vitals, problems, allergies, meds, **signed** note for encounter | Insurance, CCR/CCD, full billing ledger | `new_chart_depth_export` |
| **Clinical summary** | Problems, allergies, meds, immunizations, last 3 visit dates | Full note bodies, billing | `new_chart_depth_export` |
| **Employer / school letter** | Routes to **letter composer** (CDb / `chart-depth/referrals.php`) — not inline PDF in export builder | — | `new_chart_depth_referral` when CDb ON; else `new_chart_depth_export` (D-EXP-10) |
| **Custom** | Advanced checkbox panel (delegates to stock logic or simplified mirror) | Per selection | `new_chart_depth_export` (D-EXP-7) |
| **Full chart** | All authorized sections | — | `new_chart_depth_export_full` |

---

## 7. Pilot interim — stock report wrapper (M11-F11)

**M11-F11 split (closed):** PRD **M11-F11** is one pilot feature covering **three** stock URLs — ledger half (**FIN-1**), report half (**EXP-1**, this spec), and transactions half (**REF-1**, [PATIENT_REFERRALS_LETTERS §7](./NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md#7-pilot-interim--stock-transactions-wrapper-m11-f11)). Shared injection pattern; acceptance is **FIN-1 + EXP-1 + REF-1** together before pilot sign-off.

**Purpose:** Pilot week 1–4 when `enable_chart_depth_export` = 0 — staff still reach stock Report without US clutter or identity loss.

### 7.1 Wrapper behavior

| Property | Value |
|----------|-------|
| **Target URL** | `patient_file/report/patient_report.php` (and POST target `custom_report.php` inherits session) |
| **Injection** | Symfony response filter / RenderEvent — same pattern as M11-F11 ledger wrapper |
| **Banner** | Inject `patient-context-banner` Tier 1 **or** T1-F18 legacy strip when B7 pending |
| **Hide CCR/CCD** | When cash clinic profile / `enable_insurance = false`: CSS + server-side omit `#ccr_report` block |
| **Hide insurance** | Uncheck and hide `include_insurance` + billing when cash profile |
| **Heading** | Optional subtitle: *“Advanced export — use Visit summary when Chart Depth is enabled”* (post-CDc) |
| **Does not** | Replace checkbox engine; add presets; change `custom_report.php` |

### 7.2 Pilot acceptance (F11)

- [ ] Stock Report reachable from horizontal nav or Classic menu with banner visible.
- [ ] CCR/CCD section not rendered when cash profile applied.
- [ ] Insurance/billing checkboxes hidden or default-off when `enable_insurance = false`.
- [ ] No duplicate banner when T1-F18 + wrapper both eligible — D-CTX-5.

---

## 8. Export builder — build spec (M11-F05 / M11-F06)

### 8.1 Routes & entry points

| Entry | Target |
|-------|--------|
| MRD Visits row **Export visit summary** | `chart-depth/export.php?pid=&preset=visit_summary&encounter_id=` |
| Profile ⋯ **Export chart** | `chart-depth/export.php?pid=&preset=clinical_summary` |
| Admin ⋯ **Full chart export** | `preset=full_chart` — ACL `new_chart_depth_export_full` |

### 8.2 AJAX

| Action | Request | Response |
|--------|---------|----------|
| `chart_depth.export` | `{ preset, pid, encounter_id?, sections? }` | `{ pdf_url, audit_id }` |

Audit: `chart_depth.export_generated` — preset, pid, encounter_id, actor.

### 8.3 Technical approach

| Item | Detail |
|------|--------|
| **Templates** | Twig per preset; clinic header/footer from M6 |
| **PDF engine** | OpenEMR mPDF stack (same as `custom_report.php`) |
| **Extensions** | `PatientReportEvent` for module sections |
| **Unsigned notes** | Query `esign_signatures` / form lock — exclude unless override ACL |
| **Performance** | Visit summary ≤10s for one encounter (CD-3) |

### 8.4 M11-F06 — Full chart (admin)

- Mirror stock **Custom** power but with confirm + audit
- Gate: `new_chart_depth_export_full` — typically `new_admin` only
- Warning copy: *“Full export includes all authorized clinical sections — for compliance use only.”*

---

## 9. Legacy overlay on stock chart — report pages (plain English)

When **Chart Depth export is not yet enabled**, staff may still open stock **Report** from horizontal nav or Classic menu. The **legacy patient context overlay** (T1-F18) applies on allowlisted report URLs per [LEGACY_CHART_CONTEXT](./NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md).

### 9.1 Report-specific behavior

| Function (plain English) | What it does |
|--------------------------|--------------|
| **Report page coverage** | Sticky strip on stock Patient Report when opened from legacy nav |
| **Identity during long export** | Checkbox scrolling on long report page — strip stays visible |
| **No visit bind** | Export is patient-scoped; optional encounter selection inside form only |
| **Print/PDF guard** | Strip suppressed on PDF output / print view |
| **After CDc cutover** | Clinic roles use MRD export actions; strip still applies if admin opens Classic → Report |

### 9.2 What overlay does NOT do on report pages

| Not included | Reason |
|--------------|--------|
| Generate PDF | Stock form + custom_report.php |
| Hide CCR/CCD | M11-F11 wrapper responsibility when cash profile |
| Replace export builder | CDc owns presets |

---

## 10. Navigation, menu cutover & ACL

### 10.1 Menu cutover (M11-F09)

Requires master `enable_chart_depth` = 1. **Each stock horizontal nav item hides only when its matching sub-flag ships** (D-EXP-6) — CD slices stay independent per PRD §20.1.

| Stock nav item | Hidden when | Modern replacement |
|----------------|-------------|-------------------|
| **Ledger** | `enable_chart_depth_finance` = 1 | M11 payment history (CDa) |
| **Transactions** | `enable_chart_depth_referral` = 1 | Referral wizard / list (CDb) |
| **Report** | `enable_chart_depth_export` = 1 | Export builder (CDc) |
| **History** / **Assessments (SDOH)** | B7 + **T1-F06** | MRD Clinical → Background |

**Between CDa and CDc:** horizontal **Report** remains until `enable_chart_depth_export` = 1; reception may use wrapped stock Report or Classic menu (§10.3).

| Role | When export sub-flag ON | Interim (export OFF, chart depth ON) |
|------|-------------------------|--------------------------------------|
| **Clinic roles** (`new_*`) | Horizontal **Report** hidden; MRD Visits / Profile → export builder | Horizontal **Report** still visible (wrapped F11) or **⋯ Classic menu** |
| **Power users** | **⋯ Classic patient menu** → stock Report (wrapped) | Same — D-MRD-5 |

### 10.2 ACL matrix

| Capability | ACL key |
|------------|---------|
| Visit / clinical summary presets | `new_chart_depth_export` |
| Custom preset (checkbox panel) | `new_chart_depth_export` (D-EXP-7) |
| Full chart export | `new_chart_depth_export_full` (M11-F06) |
| Employer / school letter (CDb route) | `new_chart_depth_referral` (D-EXP-10) |
| Stock report (legacy / pilot F11) | Core `patients` / `pat_rep` (D-EXP-11) |

### 10.3 Pilot stock Report ACL (D-EXP-11)

Until CDc ships, reception handoff PDFs use stock **Report** (F11 wrapper). **Installer / role template** grants `pat_rep` to `new_reception` and `new_reception_lead` alongside `new_chart_depth_export` (post-CDc). Doctors retain `pat_rep` from core clinical groups.

---

## 11. Phasing, acceptance & training

### 11.1 Acceptance (maps to PRD §21.1ab, §21.1p, tests CD-3, CD-5, EXP-1–EXP-6)

**Pilot wrapper (M11-F11 — EXP-1):**

- [ ] Stock Report shows banner; CCR/CCD hidden on cash profile (EXP-1).
- [ ] Insurance/billing hidden or off by default when `enable_insurance = false` (EXP-1).
- [ ] No duplicate banner when T1-F18 + wrapper both eligible — D-CTX-5 (EXP-1).
- [ ] `new_reception` / `new_reception_lead` can open stock Report during pilot — `pat_rep` granted (EXP-1 / D-EXP-11).

**Export builder (V1.1-CDc — CD-3, EXP-2–EXP-4):**

- [ ] **Visit summary** PDF for one `encounter_id` in ≤10s (EXP-2, CD-3).
- [ ] No insurance section when `enable_insurance = false` (EXP-2).
- [ ] Confirm shows **Patient · MRN · Encounter date** before POST (EXP-2).
- [ ] Audit `chart_depth.export_generated` with preset + pid + encounter_id (EXP-2).
- [ ] Unsigned notes excluded by default (EXP-2).
- [ ] Profile **Export chart** opens clinical summary preset (EXP-3).
- [ ] Visits **Export visit summary** deep-links with `encounter_id` pre-filled (EXP-4).

**Employer letter (EXP-6, D-EXP-10):**

- [ ] Preset **Employer / school letter** routes to letter composer when `enable_chart_depth_referral` = 1; blocked with clear message when CDb OFF.

**Menu (CD-5, EXP-5):**

- [ ] When `enable_chart_depth_export` = 1, clinic roles do not see stock **Report** in horizontal nav (EXP-5).
- [ ] When export sub-flag OFF but CDa/CDb ON, horizontal **Report** remains reachable (wrapped F11) until CDc (EXP-5).
- [ ] Power users retain **⋯ Classic patient menu** → stock Report — D-MRD-5 (EXP-5).

### 11.2 Training checklist

- [ ] Deliver preset one-liners (§5.4) at CDc enablement.
- [ ] Drill: reception exports visit summary from MRD Visits row.
- [ ] Drill: manager knows full chart is admin-only + audited.

---

## 12. Closed decisions

| ID | Decision |
|----|----------|
| **D-EXP-1** | **Pilot:** stock `patient_report.php` + **M11-F11 wrapper** — not new export engine until CDc |
| **D-EXP-2** | **V1.1-CDc:** preset export builder (`chart-depth/export.php`) is primary path for clinic roles |
| **D-EXP-3** | Export is **Chart Depth depth panel** — not sixth MRD tab (D-CD-1) |
| **D-EXP-4** | Hide CCR/CCD/insurance/billing noise when `enable_insurance = false` / cash profile |
| **D-EXP-5** | Unsigned encounter notes **excluded by default** from presets |
| **D-EXP-6** | **Per-sub-flag menu hide (closed):** horizontal **Report** hidden only when `enable_chart_depth_export` = 1; **Ledger** when `_finance` = 1; **Transactions** when `_referral` = 1 — master `enable_chart_depth` = 1 required |
| **D-EXP-7** | **Custom export (closed):** checkbox panel delegates to stock `custom_report.php` where needed — ACL `new_chart_depth_export`; no full engine rewrite (NG5) |
| **D-EXP-8** | Per-patient export (**M11**) is separate from clinic **M16** Reporting Hub — no merge |
| **D-EXP-9** | **Full chart (closed):** M11-F06 — ACL `new_chart_depth_export_full`; confirm + audit; distinct from Custom preset |
| **D-EXP-10** | **Employer / school letter (closed):** export preset routes to CDb letter composer — not inline PDF; ACL `new_chart_depth_referral` when CDb ON; base `new_reception` → reception lead per **D-REF-11** |
| **D-EXP-11** | **Pilot `pat_rep` (closed):** installer grants `pat_rep` to `new_reception` / `new_reception_lead` for F11 stock Report until CDc |

---

## 13. Document history

| Version | Date | Changes |
|---------|------|---------|
| 0.1.1 | 2026-06-24 | **Audit closure** — D-EXP-6 per-sub-flag menu cutover; D-EXP-7/9/10/11; EXP-1–6 acceptance; Custom vs Full ACL; employer letter routing; Classic menu = power users; pilot `pat_rep`; PRD v1.20.43 |
| 0.1.0 | 2026-06-24 | Initial spec — OpenEMR pain points, UI/UX, EHR patterns, Ghana context, M11-F11 wrapper, M11-F05/F06 export builder, legacy overlay, menu cutover, D-EXP-1–8 |

---

*Normative wireframes: [PAGE_DESIGNS §7.15](../NEW_CLINIC_V1_PAGE_DESIGNS.md#715-chart-depthexportphp--clinical-export) · Chart Depth parent: [§11](./NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md#11-clinical-reports--record-export) · MRD Visits action: [MRD §8.5.4](./MEDICAL_RECORD_DASHBOARD_REDESIGN.md#854-visits-tab--past-list-pagination) · PRD M11: [§8 Module M11](../NEW_CLINIC_V1_PRD.md#module-m11--chart-depth)*

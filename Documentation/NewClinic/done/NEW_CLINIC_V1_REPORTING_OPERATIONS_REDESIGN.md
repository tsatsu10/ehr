# Reporting & Analytics — Redesign Specification

| Field | Value |
|-------|--------|
| **Document version** | 0.1.4 |
| **Status** | Draft for review — **Module M7** (daily ops) + **M16 Reporting Operations Hub** (V1.1-REP) aligned with PRD v1.20.49; DHIMS2 = **NG8 / V2.2** |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md) (v1.20.49), [NEW_CLINIC_V1_PAGE_DESIGNS.md](../NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.49), [NEW_CLINIC_V1_USER_WORKFLOWS.md](../NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.49), [NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md](./NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md) (v0.1.3), [NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md](./NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md) (v0.1.8), [NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md](./NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md) (v0.1.3), [NEW_CLINIC_V1_PATIENT_REGISTRY_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_REGISTRY_REDESIGN.md) (v0.2.1) |
| **Audience** | Product, design, clinic owners, clinical leads, public-health liaisons, implementers, QA |
| **Scope** | Everything managers need to **see how the clinic performed** — daily operations (M7), stock OpenEMR **Reports** menu (~47 legacy screens), pharmacy/inventory compliance, clinical extracts, and **future** national reporting (Ghana DHIMS2 / West Africa MOH) |
| **Implementation** | Design spec only — no code in this document |
| **Primary market** | Private outpatient clinics — **West Africa** (Ghana launch region; Nigeria, Côte d'Ivoire, Senegal extensible) |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Gap analysis — what M7 already covers](#2-gap-analysis--what-m7-already-covers)
3. [Current-state snapshot (stock OpenEMR Reports)](#3-current-state-snapshot-stock-openemr-reports)
4. [Pain points by surface](#4-pain-points-by-surface)
5. [UI/UX principles for reporting](#5-uiux-principles-for-reporting)
6. [How leading EHRs address these needs](#6-how-leading-ehrs-address-these-needs)
7. [West Africa & Ghana context](#7-west-africa--ghana-context)
8. [Information architecture — Reporting Operations Hub](#8-information-architecture--reporting-operations-hub)
9. [Lens: Daily operations (M7 embed)](#9-lens-daily-operations-m7-embed)
10. [Lens: Clinical & population](#10-lens-clinical--population)
11. [Lens: Public health & registry (DHIMS2 prep)](#11-lens-public-health--registry-dhims2-prep)
12. [Lens: Pharmacy & inventory compliance](#12-lens-pharmacy--inventory-compliance)
13. [Lens: Financial & billing analytics](#13-lens-financial--billing-analytics)
14. [Lens: Quality, safety & audit](#14-lens-quality-safety--audit)
15. [Lens: Operations & scheduling (legacy bridge)](#15-lens-operations--scheduling-legacy-bridge)
16. [Navigation, ACL & menu cutover](#16-navigation-acl--menu-cutover)
17. [Data model, APIs & export contracts](#17-data-model-apis--export-contracts)
18. [Phasing & PRD alignment](#18-phasing--prd-alignment)
19. [Acceptance criteria](#19-acceptance-criteria)
20. [Closed decisions](#20-closed-decisions)
21. [Document history](#21-document-history)
22. [Consistency audit pass](#22-consistency-audit-pass)
23. [Day-2 reporting runbook (operational)](#23-day-2-reporting-runbook-operational)
24. [Appendix A — Stock report catalog & disposition](#appendix-a--stock-report-catalog--disposition)
25. [Appendix B — User stories](#appendix-b--user-stories)
26. [Appendix C — Competitive reference matrix](#appendix-c--competitive-reference-matrix)
27. [Appendix D — KPI orthogonality rules](#appendix-d--kpi-orthogonality-rules)

---

## 1. Purpose & positioning

### 1.1 What this document is for

New Clinic **Module M7 (Daily Reports)** is well-specified for **manager end-of-day operations**: cash collected, visit throughput, open visits at close, data quality, reconciliation, scheduling funnel, ancillary outcomes, and documentation compliance (PRD §8 M7-F01–F19; PAGE_DESIGNS §7.10).

That answers *“How did today go?”* — but **not**:

- *“Export immunizations for the district EPI review.”*
- *“Show destroyed/expired medicines for pharmacy council inspection.”*
- *“Pull a diagnosis list for malaria surveillance.”*
- *“Where is the US Meaningful Use / CQM report — and should we even see it?”*
- *“How do we prepare monthly MOH returns without a spreadsheet war?”*

Stock OpenEMR exposes **40+ report screens** under the top-level **Reports** menu — built primarily for **US ambulatory billing**, **MU/CQM certification**, and **legacy paper-chart workflows**. Private OPD clinics in Ghana and West Africa need a **curated reporting layer**: hide noise, surface what matters, prepare for **DHIMS2** (PRD NG8 / V2.2) without forking core tables.

This spec defines:

| Layer | Question it answers |
|-------|---------------------|
| **M7 Daily Reports** | “How did **today** go?” (cash, queue, EOD, exceptions) |
| **M16 Reporting Operations Hub** | “What else must we **measure, export, or prove** — clinical, pharmacy, public health, audit?” |
| **DHIMS2 bridge (V2.2)** | “How do we send **national indicators** to MOH?” (NG8 — not V1) |

**Training one-liner:** *Daily Reports for tonight’s close; Reporting Hub for monthly extracts, compliance, and national returns.*

### 1.2 Problem statement

> A clinic owner finishes the day on New Clinic’s cashier and visit board. They open stock **Reports** and see nested menus: Clients, Clinic, Visits, Financial, Inventory, Insurance, Miscellaneous — including Eligibility 270/271, Collections, CQM, AMC, Real World Testing, and IPPF statistics. None match a **cash OPD clinic in Accra**. The owner exports cash from **Front Receipts** while M7 already has reconciliation. The nurse needs an **immunization list** but cannot find it without wading through “Clinical” reports with US race/ethnicity filters. When the district asks for **destroyed drug logs**, pharmacy staff discover the report lives under Inventory, not Pharmacy Ops. Staff blame “reports are for American hospitals.”

### 1.3 Positioning vs other surfaces

| Surface | Question | Relationship to M16 |
|---------|----------|-------------------|
| **M7 Daily Reports** | “How did **today** go?” | **Lens 1** inside hub — not duplicated |
| **M14 Billing Back Office** | “Fix money & close the day” | Financial lens **links** M14 daysheet; M7 remains archive |
| **M11 Chart Depth** | “What did **this patient** pay?” | Per-patient read — not clinic-wide aggregates |
| **M12 Lab Ops / M13 Pharm Ops** | “What’s pending at the bench?” | Operational worklists; hub pulls **KPI exports** (turnaround, dispense time) |
| **M15 Admin Hub** | “Is the system healthy?” | Reconciliation **status chip** reads M7/M6; override audit links to M7-F08 |
| **M10 Patient Registry** | “Who is in our cohort?” | Interactive cohort builder — M16 clinical lens **opens M10** with optional preset (**D-COHORT-10**); aggregate `patient_list` reports stay in M16 |
| **Stock Reports menu** | “Everything OpenEMR ever reported” | **Hidden** for clinic roles when hub ON; **Advanced** escape hatch |

**Design decision (closed D-REP-1):** M7 = **daily operational truth** (visit queue + module receipts). M16 = **periodic analytics & compliance façades** over stock reports + module tables. US quality programs (CQM/AMC/RWT) = **hidden by default** in cash clinic profile; Advanced only. Separate hub route — matches M14/M15 pattern (**D-REP-1** closes former O-REP-1).

---

## 2. Gap analysis — what M7 already covers

| Capability | M7 (spec’d) | Stock Reports (today) | M16 gap |
|------------|-------------|----------------------|---------|
| Daily cash total + category breakdown | M7-F03 | `front_receipts_report`, `daily_summary_report` | Unified in M7; hide duplicates |
| Visit throughput (module queue) | M7-F02 | `encounters_report`, `daily_summary_report` | M7 uses `new_visit` — **do not sum** with appointment reports |
| EOD open visits + unsigned alerts | M7-F15, F17 | — | **M7 only** |
| Reconciliation module vs core AR | M7-F10–F11 | `front_receipts_report`, `pat_ledger` | M7 + M14 close-day; hide ledger for clinic roles |
| Data quality / completion | M7-F06–F09 | — | **M7 only** |
| Duplicate prevention analytics | M7-F07 | — | **M7 only** |
| Override / bypass audit | M7-F08, F12 | `audit_log_tamper_report` (partial) | M7 operational + hub **audit lens** |
| Scheduling funnel | M7-F16 | `appointments_report`, `patient_flow_board_report` | M7 orthogonal KPIs; legacy hidden after S1 |
| Ancillary services outcomes | M7-F18 | — | **M7 only** (V1.1-ANC) |
| Immunization registry export | — | `immunization_report` | **Clinical lens** — CVX/HL7 oriented; needs Ghana EPI mapping (V2) |
| Diagnosis / clinical cohort | — | `clinical_reports` | **Clinical lens** — simplify filters |
| Syndromic surveillance | — | `non_reported` | **Public health lens** — US HL7 A01; map to DHIMS2 prep |
| CQM / AMC / standard measures | — | `cqm.php`, `report_results`, `amc_*` | **Hidden** default; certification-only |
| Destroyed drugs | — | `destroyed_drugs_report` | **Pharmacy lens** — link from M13 when ON |
| Inventory activity / transactions | — | `inventory_*`, `sales_by_item` | **Pharmacy lens** or M13-F08 |
| Prescriptions report | — | `prescriptions_report` | Clinical lens; Type A print-Rx clinics |
| Referrals aggregate | — | `referrals_report` | Link M11 referral meta when chart depth ON |
| Patient list / messaging | — | `patient_list`, `message_list` | Registry/COM cross-links |
| Insurance / collections / ERA | — | Financial subtree | **Hidden** (cash profile §19) |
| IPPF / CYP statistics | — | `ippf_*` | **Hidden** — not launch region |
| DHIMS2 / MOH indicators | NG8 | — | **V2.2** export hub |

**Conclusion:** M7 solves **intraday manager control**. M16 solves **everything else in Reports** — curated for West Africa private OPD.

---

## 3. Current-state snapshot (stock OpenEMR Reports)

### 3.1 Menu structure (Reports top-level)

Stock menu (`standard.json`, `menu_id: repimg`) groups **~47 PHP entry points** into:

| Group | Examples | Typical US intent |
|-------|----------|-------------------|
| **Clients** | Patient list, Rx, clinical, referrals, immunizations | Cohort extracts |
| **Clinic** | CQM, AMC, report results, alerts log, RWT 2026 | MU certification |
| **Visits** | Daily, appointments, flow board, encounters, superbill, syndromic | Utilization + public health |
| **Financial** | Sales, receipts, collections, ledger, insurance allocation | AR / claims |
| **Inventory** | List, activity, transactions, destroyed drugs | Pharmacy compliance |
| **Insurance** | Allocation, unique seen patients | Payer analytics |
| **Miscellaneous** | Background services, direct message log, IP tracker, IPPF | Ops / legacy NGO |

**New Clinic clinic roles** already hide insurance/EDI via `MENU_RESTRICT` (PRD §11.2) — but **Reports** subtree largely remains, creating a **second navigation system** parallel to M7.

### 3.2 Technology pattern (all stock reports)

| Pattern | Pain |
|---------|------|
| Procedural PHP per report | Inconsistent filters, no shared date-range component |
| POST + full page reload | Slow on poor connectivity; no saveable views |
| Mixed Bootstrap 3/4 eras | Visual clash with T1 shell |
| Separate ACL per report (`patients/med`, `acct/rep_a`) | Owner doesn’t know which permission unlocks which report |
| US-coded fields (CVX, race, ethnicity, superbill) | Wrong defaults for Ghana OPD |
| Comment in `cqm.php`: *“TODO: This needs a complete makeover”* | Quality reports unmaintained UX |

### 3.3 Overlap with New Clinic module tables

| Stock report source | New Clinic source of truth | Rule |
|--------------------|----------------------------|------|
| `encounters_report` | `new_visit` + `new_visit_state_log` | **Prefer M7** for operational throughput |
| `appointments_report` | `openemr_postcalendar_events` + M7-F16 | **Orthogonal** — scheduling funnel |
| `front_receipts_report` | `new_receipt` + M7-F03 | **Prefer M7** for pilot cash |
| `pat_ledger` | M5/M14 + core `billing` | Hide for clinic roles; M14 Advanced |
| Immunization tables | Core `immunizations` | Unchanged data; **new export UX** |

---

## 4. Pain points by surface

### 4.1 Discovery & navigation

| Pain | Impact (West Africa private OPD) |
|------|--------------------------------|
| **40+ reports in nested menus** | Owner never finds the one needed monthly |
| **Duplicate cash reports** (Front Rec, Daily Summary, M7) | Conflicting totals; trust erodes |
| **No “recommended for your clinic type”** | Cash clinic sees insurance collections |
| **Reports open in legacy frame** (`target: rep`) | Breaks T1 shell; feels like a different product |
| **English-only labels** (CQM, AMC, Syndromic) | Training burden |

### 4.2 Date range & export

| Pain | Impact |
|------|--------|
| Inconsistent date pickers (some default YTD, some today) | Wrong range submitted to district |
| CSV export inconsistent or missing | Staff re-type into Excel for MOH |
| No “last month” / “last quarter” presets | Finance loses time |
| Print CSS not mobile-friendly | Owner screenshots on phone |

### 4.3 Clinical & public health reports

| Pain | Impact |
|------|--------|
| **Immunization report** uses CVX codes — Ghana EPI uses national schedule names | District wants antigens by local label |
| **Clinical report** powerful but overwhelming (diagnosis, drug, age, race, ethnicity) | Wrong filter → empty export → “system broken” |
| **Syndromic surveillance** (`non_reported`) built for US HL7 A01 MU2 | Irrelevant UI; DHIMS2 is different pipeline (NG8) |
| **Referrals report** disconnected from New Clinic referral wizard (M11) | Duplicate mental models |

### 4.4 Pharmacy & inventory

| Pain | Impact |
|------|--------|
| **Destroyed drugs** buried under Reports → Inventory | Pharmacy council inspection prep is frantic |
| Inventory reports assume **US warehouse** semantics | Tablet-counting clinics (M6-F26) need unit summaries |
| No link from **M13 Pharm Ops** to compliance exports | Ops hub and reports siloed |

### 4.5 US quality & certification (CQM / AMC / RWT)

| Pain | Impact |
|------|--------|
| CQM/AMC visible when globals accidentally ON | Owner clicks, sees meaningless PQRS measures |
| Real World Testing 2026 report | US regulatory — pure noise |
| Report Results / Clinical Decision Rules | Requires `enable_cdr` — conflicts with cash profile |

### 4.6 Financial reports (cash clinic)

| Pain | Impact |
|------|--------|
| Collections / insurance allocation | Implies US payer model |
| Patient ledger | Complex AR — M5/M14 replace golden path |
| Service code financial report | CPT-centric — fee schedule is M6 |

### 4.7 Trust & reconciliation

| Pain | Impact |
|------|--------|
| Summing appointment counts + visit counts | PRD §6.7.8 **double-count** risk |
| Stock daily summary ≠ `new_receipt` sum | Owner reconciles manually in Excel |
| No single “source of truth” label on each KPI | Arguments at month-end |

---

## 5. UI/UX principles for reporting

Aligned with M14 Billing, M15 Admin, COM Hub, and T1 shell patterns.

| ID | Principle | Reporting application |
|----|-----------|----------------------|
| **R1** | **One front door** | Clinic → **Reports & Analytics** hub; stock Reports hidden |
| **R2** | **Daily vs periodic** | M7 = default landing (today); other lenses = date range |
| **R3** | **Label the source of truth** | Every KPI shows `new_visit` vs `appointment` vs `core AR` badge |
| **R4** | **No double-counting** | Footer warnings on scheduling vs visits (PRD §6.7.8) |
| **R5** | **Progressive disclosure** | 6–8 hub cards; Advanced opens stock report in iframe/new tab |
| **R6** | **Export-first** | CSV + print for every periodic report; PDF for MOH binders |
| **R7** | **Saved views (P2)** | “Last month immunizations”, “Q1 destroyed drugs” |
| **R8** | **Role-scoped lenses** | Manager sees all; pharmacist sees pharmacy lens only |
| **R9** | **Cash clinic profile respects** | CQM/AMC/insurance reports not in default IA |
| **R10** | **Ghana-realistic connectivity** | Async export with download link; no 60s blocking POST |
| **R11** | **Audit on export** | `reports.export_run` with actor, report id, row count, date range |
| **R12** | **Never fork clinical tables** | Façade + query service; stock SQL reused where stable |

---

## 6. How leading EHRs address these needs

Patterns from **Epic Clarity/Caboodle**, **Cerner HealtheIntent**, **athenahealth Analytics**, **OpenMRS Reporting Module**, **Bahmni Reports**, **Helium Health** (West Africa SaaS). Not feature parity — UX pattern library.

| Need | Typical pattern | New Clinic mapping |
|------|-----------------|-------------------|
| **Daily operations dashboard** | Unit manager dashboard — today’s volume, revenue, exceptions | **M7** (spec’d) |
| **Curated report catalog** | Role-based catalog with descriptions | **M16 hub cards** + plain-language blurbs |
| **Regulatory / MOH returns** | Scheduled indicator export + validation | **DHIMS2 lens** V2.2 (NG8) |
| **Immunization coverage** | EPI register + defaulter list | **Clinical lens** — immunization export + reminders link S1 |
| **Pharmacy compliance** | Destruction register, controlled substance log | **Pharmacy lens** — destroyed drugs + M13 link |
| **Quality measures** | Hidden unless on quality contract | **US CQM** Advanced only |
| **Self-service BI deferral** | No Tableau for 10-bed clinic | CSV + Excel pivot sufficient V1 |
| **Single source of truth** | Semantic layer / metric definitions | **Appendix D** orthogonality rules |
| **Drill-down** | KPI → patient list → chart | M7 EOD → Visit Board; clinical → MRD |
| **Comparison periods** | vs yesterday, vs same day last week | M7 V1.1 sparkline (optional) |

**Regional SaaS pattern:** Vendor runs MOH reports — clinic calls support. **New Clinic differentiation:** owner-run **M7 + curated hub**, DHIMS2 when national API matures (PRD positioning).

---

## 7. West Africa & Ghana context

### 7.1 Who runs reports

| Actor | Typical tasks |
|-------|----------------|
| **Owner–manager** | Daily close (M7), month cash, staff override review |
| **Clinical lead / nurse incharge** | Immunization defaulters, chronic disease cohorts |
| **Pharmacist** | Destroyed/expired medicines, stock movement |
| **District EPI / malaria coordinator** | Periodic extracts (often Excel today) |
| **Accountant (external)** | Receipt CSV, daysheet — not live system access |

Design for **1–2 people** who report wearing multiple hats (same as Admin hub).

### 7.2 Ghana & regional regulatory touchpoints

| Topic | V1 stance | Hub lens |
|-------|-----------|----------|
| **NHIS claims reporting** | NG1 — not V1 | Hidden |
| **DHIMS2 / MOH indicators** | NG8 — V2.2 | Public health lens — **placeholder** + manual CSV templates V1.1 |
| **Ghana FDA pharmacy records** | Destruction & expiry traceability | Pharmacy lens |
| **Data Protection Act 2012 (Act 843)** | Export audit trail | Audit lens |
| **EPI / immunization** | Capture in chart; reporting often paper | Clinical lens export |
| **Notifiable diseases** | Syndromic US report **not** fit-for-purpose | V2 mapping to national case notification |
| **NHIS patient ID** | Profile field only | Not in reports V1 |

### 7.3 Practice patterns affecting reports

| Pattern | Reporting implication |
|---------|----------------------|
| **Cash same-day pay** | M7 cash tab = primary; no aging report needed V1 |
| **Walk-in heavy** | Visit throughput ≠ appointments — show both, never sum |
| **Shared accountant** | Monthly CSV email export; no login |
| **Low connectivity** | Async export job + notification |
| **Year-end fee change** | M6 fee audit + M7 category breakdown month compare |
| **Locum doctors** | Provider filter on clinical exports by `provider_id` |
| **Type A pharmacy (print Rx only)** | Prescription report; no inventory lens |

### 7.4 Language & literacy

- UI strings via `xl()`; report **column headers** localized P2.
- **Plain-language card titles**: “Vaccinations given this month” not “Immunization Registry CVX export”.
- Tooltips explain **what to send where** (e.g. “Give this file to your district EPI officer”).

---

## 8. Information architecture — Reporting Operations Hub

### 8.1 Two-module model (closed D-REP-1)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Reporting Operations Hub (M16)                                              │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┬───────────┐ │
│  │ Daily ops    │ Clinical &   │ Public health│ Pharmacy &   │ Financial │ │
│  │ (M7 embed)   │ population   │ (DHIMS2 prep)│ inventory    │ analytics │ │
│  ├──────────────┴──────────────┴──────────────┴──────────────┴───────────┤ │
│  │ Quality & audit │ Scheduling (legacy bridge) │ Advanced (stock Reports) │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Module | Route | ACL |
|--------|------------------|-----|
| **M16 Hub shell** | `…/public/report-hub/index.php` | `new_reports_hub` |
| **M7 Daily Reports** | `…/public/reports.php` (embedded tab) | `new_clinic` `reports` (existing) |
| **Clinical exports** | `…/public/report-hub/clinical.php` | `new_reports_clinical` |
| **Public health** | `…/public/report-hub/public-health.php` | `new_reports_public_health` |
| **Pharmacy compliance** | `…/public/report-hub/pharmacy.php` | `new_reports_pharmacy` |
| **Financial analytics** | `…/public/report-hub/financial.php` | `new_reports_financial` |
| **Audit & quality** | `…/public/report-hub/audit.php` | `new_reports_audit` |

### 8.2 Hub shell wireframe

```text
┌─ T1 TopBar ───────────────────────────────────────────────────────────────┐
│ Reports & Analytics     Today: GHS 4,280 collected │ 42 visits completed  │
├─────────────────────────────────────────────────────────────────────────────┤
│ [ Today (M7) ] [ Clinical ] [ Public health ] [ Pharmacy ] [ Financial ]  │
│ [ Audit ] [ Scheduling ]                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Lens body — cards or embedded M7 tabs                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Advanced (OpenEMR Reports) ⚠                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Header KPIs** pull from M7-F03/F02 for **today** only — quick orientation without opening M7 tab.

### 8.3 Report card pattern (periodic lenses)

Each non-M7 report is a **card**:

```text
┌─ Immunizations this period ─────────────────────────────────────────────┐
│ Count of doses administered · filter by antigen · facility               │
│ Date: [ Last month ▾ ]  [ Run ]  [ Export CSV ]                          │
│ Last run: 12 Jun 2026 · 184 rows · Akosua M.                             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Lens: Daily operations (M7 embed)

**Normative detail:** PAGE_DESIGNS **§7.10** + PRD **M7-F01–F19** — not duplicated here.

### 9.1 M7 tab summary (plain English)

| Tab / report area | What the manager sees |
|-------------------|----------------------|
| **Cash** | How much money came in today, receipt count, breakdown by service type |
| **Visits** | How many patients started, finished, cancelled; who’s still in the building |
| **EOD open** | Stuck visits at close of day; unsigned notes blocking payment |
| **Scheduling** | Appointments booked, who showed up, walk-ins vs booked, recalls due; when `enable_queue_bridge` = 1 — **exception summary** + **View exceptions** → M18 hub ([SCHEDULING_QUEUE_BOUNDARY](./NEW_CLINIC_V1_SCHEDULING_QUEUE_BOUNDARY_REDESIGN.md) §12) |
| **Data quality** | New patients registered; how complete their records are |
| **Reconciliation** | Whether module receipts match accounting system |
| **Overrides** | When staff bypassed safety rules (with reasons) |
| **Queue bypass** | When lab/pharmacy queue was skipped |
| **Pediatric DOB** | Under-5 patients still on estimated birthdate |
| **Unpaid** | Patients who left without paying |
| **Unsigned** (V1) | Visits with documentation not signed |
| **Ancillary** (V1.1) | Lab-direct and pharmacy walk-in outcomes |
| **Documentation integrity** (V1.1) | Signature and reopen audit trail |

### 9.2 Hub integration rules

- **Default lens** on hub open = **Today (M7)**.
- M7 date picker scopes **all M7 tabs** consistently.
- Hub header chips = subset of M7 Cash + Visits KPIs.
- **Do not** embed stock `daily_summary_report` — M7 replaces it for clinic roles.

---

## 10. Lens: Clinical & population

### 10.1 Purpose

Cohort extracts for clinical leads — **without** the 1,000-line `clinical_reports` form on first screen.

### 10.2 Report cards (V1.1-REP)

| Card | Stock backend | Plain English |
|------|---------------|---------------|
| **Immunizations given** | `immunization_report` | List of vaccines administered in date range; export for EPI review |
| **Immunization defaulters** | New query on `medex_recalls` + immunization due | Children overdue for next dose — links S1 Recall Worklist |
| **Diagnosis summary** | `clinical_reports` (diagnosis mode) | Counts by ICD-10/ICD-11 code — malaria, HTN, etc. |
| **Prescriptions written** | `prescriptions_report` | Rx volume by drug — audits prescribing patterns |
| **Referrals sent** | `referrals_report` + `new_referral_meta` when M11 ON | Outbound referrals by destination |
| **New patients registered** | `patient_list_creation` | Registrations by user, date — overlaps M7 data quality; link |
| **Patient cohort export** | `patient_list` (aggregate) | **M16 only** — periodic facility-wide list; for interactive filters + CSV use **M10 Patient Registry** (**D-COHORT-10**); hub card may deep-link to M10 with preset when `enable_patient_registry` = 1 |

### 10.3 Simplified filter bar (replaces stock first screen)

| Filter | Notes |
|--------|-------|
| Date range | Presets: today, this week, this month, custom |
| Facility | When multi-facility |
| Age band | Pediatric/adult — Ghana under-5 focus |
| Sex | Optional |
| Diagnosis / vaccine | Typeahead — not free-text SQL |
| Provider | Consulting doctor |

**Hide by default:** US race/ethnicity filters — available under **Advanced filters** only.

### 10.4 Ghana EPI note (V2)

Map CVX codes to **Ghana EPI antigen names** in export column headers (config table `new_epi_antigen_map` — V2). V1 exports CVX + vaccine name as stored.

---

## 11. Lens: Public health & registry (DHIMS2 prep)

### 11.1 Purpose

Prepare for **NG8 / V2.2 DHIMS2** integration without promising live API in V1.

### 11.2 V1.1 manual templates

| Card | Content |
|------|---------|
| **OPD attendance summary** | From `new_visit` — new vs follow-up; age/sex bands — maps common MOH monthly return lines |
| **Malaria suspected / tested** | From diagnosis + lab orders — manual indicator prep |
| **Immunization coverage** | Doses by antigen — bridge to EPI |
| **Syndromic placeholder** | Replaces US `non_reported` card with **“Notifiable conditions — manual log”** until national feed defined |

### 11.3 V2.2 DHIMS2 bridge (NG8 — design hook)

| Component | Behavior |
|-----------|----------|
| **Indicator catalog** | JSON definitions aligned to MOH DHIMS2 data elements (versioned) |
| **Validation** | Pre-flight: missing age/sex, incomplete encounters flagged |
| **Export package** | ZIP: CSV indicators + manifest + audit log |
| **Submission** | Manual upload to national portal V2; API adapter P3 |

**Closed for V1:** No live DHIMS2 API; clinics continue district Excel workflow with **cleaner exports**.

### 11.4 US syndromic surveillance

`non_reported.php` (HL7 A01 MU2) — **not promoted**. Card text: “US certification report — use Advanced if required.”

---

## 12. Lens: Pharmacy & inventory compliance

### 12.1 Purpose

Inspection-ready pharmacy reports — especially **destroyed/expired** medicines.

### 12.2 Report cards

| Card | Stock backend | When visible |
|------|---------------|--------------|
| **Destroyed medicines register** | `destroyed_drugs_report` | `enable_pharmacy_role` or `enable_pharm_ops` |
| **Stock movement** | `inventory_activity` | M13 hub ON |
| **Sales by product** | `sales_by_item` | Dispensing active |
| **Low stock summary** | M13 `pharm_ops.stock_summary` | M13 hub ON — not stock report |
| **Dispense turnaround** | M13 → M7 export (M13-F12) | Manager KPI |

### 12.3 UX integration with M13

When **Pharmacy Operations Hub** ON:

- M13 **Reports** tab embeds same cards — hub is superset for managers.
- Pharmacist role sees **pharmacy lens only** (no financial).

### 12.4 Ghana context

- Destruction witness + method fields already in stock report — surface prominently (regulatory expectation).
- Export PDF formatted for **binder inspection** (clinic name, date range, pharmacist signature line).

---

## 13. Lens: Financial & billing analytics

### 13.1 Purpose

**Periodic** money analytics — distinct from M7 **today** cash and M14 **operator** workflows.

### 13.2 Report cards

| Card | Source | Plain English |
|------|--------|---------------|
| **Receipts by period** | `new_receipt` | All receipts in range — accountant export |
| **Revenue by fee category** | M7 aggregation API | REG/CONS/LAB/PHARM trend |
| **Cashier totals** | `new_receipt` group by cashier | Drawer accountability |
| **Unpaid visits history** | M7-F14 extended range | Who left without paying — not AR aging |
| **Close-day archive** | M7-F10 + M14-F03 link | Reconciliation status by day |
| **Outstanding balances** | M14-F04 when enabled | Optional credit list — NG2 softening |

### 13.3 Hidden / Advanced (cash profile)

Collections, insurance allocation, patient ledger, service code financial, payment processing — **Fees → Advanced** or M14 insurance vault only.

**Training:** *Today’s money = M7 Cash tab. Month-end = Financial lens. Fixing mistakes = Billing Back Office.*

---

## 14. Lens: Quality, safety & audit

### 14.1 Purpose

Compliance and governance — overrides, tamper evidence, optional US quality programs.

### 14.2 Report cards

| Card | Source | Plain English |
|------|--------|---------------|
| **Override log** | M7-F08 + module tables | Who bypassed completion, billing, queue rules |
| **Duplicate patient events** | M7-F07 | Near-duplicate create outcomes |
| **Audit tamper review** | `audit_log_tamper_report` | Security — superuser |
| **Documentation integrity** | M7-F19 | Signatures, reopens, amendments |
| **Background services** | `background_services` | Cron health — overlaps M15; link |
| **Quality measures (US)** | `cqm.php`, `report_results` | **Advanced only** — `enable_cqm` must be ON |

---

## 15. Lens: Operations & scheduling (legacy bridge)

### 15.1 Purpose

Transition stock scheduling reports until **S1 + M7-F16** fully replace them (PRD §19.1).

| Card | Stock backend | Disposition |
|------|---------------|-------------|
| **Appointments** | `appointments_report` | Hide after S1 Phase C; until then bridge |
| **Patient flow board** | `patient_flow_board_report` | Hide with `hide_legacy_scheduling_menus` |
| **Encounters** | `encounters_report` | Advanced — prefer M7 visits |
| **Appt–encounter link** | `appt_encounter_report` | Advanced — billing-centric |
| **Unique patients seen** | `unique_seen_patients_report` | Optional monthly KPI |

**Banner on every card:** *“For today’s queue truth, use Visit Board or M7 Visits tab.”*

---

## 16. Navigation, ACL & menu cutover

### 16.1 Menu strategy

When `enable_report_hub` = 1:

| Stock | Clinic manager | Notes |
|-------|----------------|-------|
| Top-level **Reports** menu | Hidden | Replaced by **Clinic → Reports & Analytics** |
| M7 `reports.php` | Reachable via hub **Today** tab | Also `clinic_reports` app |
| Stock report URLs | **Advanced** footer — new tab with warning banner | |

### 16.2 ACL additions (normative — PRD §4.4)

| Key | Groups | Purpose |
|-----|--------|---------|
| `new_reports_hub` | `new_admin` | Open hub |
| `new_reports_clinical` | `new_admin`, `new_nurse_lead` | Clinical lens |
| `new_reports_public_health` | `new_admin` | DHIMS2 prep exports |
| `new_reports_pharmacy` | `new_admin`, `new_pharmacy_lead` | Pharmacy lens |
| `new_reports_financial` | `new_admin`, `new_cashier_lead` | Financial lens |
| `new_reports_audit` | `new_admin` | Audit lens |

Existing `new_clinic` `reports` ACL remains for M7.

### 16.3 Audit events

| Event | When |
|-------|------|
| `reports.export_run` | Any CSV/PDF export — report id, row count, range |
| `reports.hub_advanced_open` | User opened stock Reports escape hatch |

---

## 17. Data model, APIs & export contracts

### 17.1 New tables (normative — PRD §12.1)

```sql
report_hub_export_run (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  facility_id INT NOT NULL,
  report_key VARCHAR(64) NOT NULL,
  date_from DATE NULL,
  date_to DATE NULL,
  row_count INT NULL,
  file_path VARCHAR(512) NULL,
  status ENUM('ok','failed','running') NOT NULL,
  actor_user_id BIGINT NOT NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  message TEXT NULL
)
```

### 17.2 AJAX actions (normative — PRD §13.1)

| Action | Purpose |
|--------|---------|
| `reports.hub_summary` | Header KPIs (today) |
| `reports.run` | Execute report by key + filters |
| `reports.export` | CSV/PDF generation |
| `reports.export_status` | Poll async job |
| `reports.catalog` | List cards visible for role + flags |

### 17.3 Config keys

| Key | Default | Notes |
|-----|---------|-------|
| `enable_report_hub` | `0` | Master gate — V1.1-REP |
| `report_hub_show_us_quality` | `0` | CQM/AMC cards in audit lens |
| `report_hub_show_legacy_scheduling` | `1` | Until S1 Phase C |
| `report_hub_async_export_threshold` | `5000` | Row count above which `reports.export` runs async job + `reports.export_status` poll (**D-REP-4**) |
| `report_hub_moh_pack` | `ghana_v1` | MOH indicator / OPD attendance template pack; `nigeria_v1` in V3 (**D-REP-5**) |
| `dhims2_export_enabled` | `0` | NG8 — V2.2 |

---

## 18. Phasing & PRD alignment

### 18.1 Module mapping

| Phase | Deliverable | PRD |
|-------|-------------|-----|
| **V1 P0** | M7 `reports.php` per PAGE_DESIGNS §7.10 | M7 — pilot manager EOD |
| **V1.1-REP** | M16 hub shell + clinical + pharmacy + financial lenses + menu cutover | New M16 |
| **V1.1-ANC/LAB/PHARM** | M7-F18; M12/M13 KPI cards in hub | Cross-links |
| **V2.0** | Public health templates + indicator validation | NG8 prep |
| **V2.2** | DHIMS2 export package | PRD roadmap §23 |

### 18.2 Independence

M16 ships **after M7 P0** — hub embeds M7. Independent of M14/M15 slices. DHIMS2 does not block pilot.

### 18.3 PRD follow-on — closed (v0.1.1 audit)

| Item | Status |
|------|--------|
| Module **M16** in PRD §5.1 / §8 | Done — PRD v1.20.33 |
| **§19.5** report menu cutover | Done |
| PAGE_DESIGNS **§7.10.18–7.10.20** (M7-F17–F19) + **§7.29** hub shell | Done |
| USER_WORKFLOWS **§14.9** periodic reporting | Done |
| Close **D-REP-1**, **D-REP-2**, **D-REP-3** in PRD §24.1 | Done |
| Close **D-REP-4**–**D-REP-7**; §23 RR runbooks; PRD §17.4.9 + §18 expansion | Done — v0.1.2 |
| PRD §4.4 `reports` + M16 ACL keys; §12.1 DDL; §16.1 REP tests | Done |

---

## 19. Acceptance criteria

### 19.1 M7 (unchanged — PAGE_DESIGNS §7.10)

- [x] All §7.10 acceptance checks pass — M7 pilot-signed (scorecard §5.6)

### 19.2 M16 hub

- [x] Manager lands on **Today (M7)** tab; header KPIs match M7 cash/visits — `smoke-report-hub-http.php` (`today_summary=yes`)
- [x] Stock **Reports** menu hidden when hub ON; Advanced works — `MainMenuRestrictReportHubTest`
- [x] Immunization export returns rows; CSV downloads; audit `reports.export_run` — `ReportHubNativeReportServiceTest` + `ReportHubExportServiceTest`
- [x] Destroyed drugs card visible when pharmacy enabled; export suitable for inspection binder — `ReportHubPharmacyNativeReportServiceTest` (CSV; PDF via browser print)
- [x] Financial lens receipts match sum of `new_receipt` for range — receipts-by-method card reuses M7 reconciliation source
- [x] CQM/AMC cards hidden when `report_hub_show_us_quality` = 0 — `ReportHubCatalogService::show_us_quality`
- [x] Scheduling bridge cards show orthogonality warning — `SCHEDULING_STOCK_IDS` note in `ReportHubLensPane`
- [x] Clinical role without ACL cannot open financial lens — `ReportHubAccessServiceTest`
- [x] Regression: hub OFF → stock Reports + M7 unchanged — `MainMenuRestrictReportHubTest` flag-off path

### 19.3 Ghana / West Africa validation

- [x] No insurance/collections cards in default hub IA — catalog has no insurance lens cards (cash-only default)
- [x] Immunization export includes patient name, date, vaccine, dose # — `ReportHubNativeReportServiceTest` column contract
- [ ] OPD attendance template matches common district monthly return structure (pilot review with clinical lead) — **open: Product/pilot**
- [x] Export audit trail satisfies Act 843 evidence expectation — `reports.export_run` + distinct `reports.hub_advanced_open` (§16.3) audit events

- [x] Export &gt; `report_hub_async_export_threshold` rows uses async job + poll (D-REP-4) — `testRequestExportReturnsAsyncWhenAboveThreshold`

---

## 20. Closed decisions

Former open questions — normative in PRD §24.1 as **D-REP-4**–**D-REP-7**.

| ID | Decision |
|----|----------|
| D-REP-4 | **Async export (closed):** When estimated rows &gt; `report_hub_async_export_threshold` (default **5000**), `reports.export` returns job id; UI polls `reports.export_status`; user notified when file ready — sync path for smaller exports |
| D-REP-5 | **MOH indicator pack (closed):** Default pack **`ghana_v1`**; clinical lead + owner sign pilot worksheet row before first district submit; **`nigeria_v1`** ships V3 behind `report_hub_moh_pack` — no multi-country pack in V1.1-REP |
| D-REP-6 | **Stock report integration (closed):** V1.1-REP uses **iframe/deep link** to stock `interface/reports/*.php` for periodic lenses; **native reimplemented cards** only for immunization + destroyed drugs in **P2** (high-traffic Ghana inspections) |
| D-REP-7 | **Nurse lead clinical lens (closed):** `new_nurse_lead` receives `new_reports_clinical` by default (PRD §4.4); hub shell still requires `new_reports_hub` (`new_admin` only) — nurse opens clinical lens when manager shares hub URL or future role expansion |

---

## 21. Document history

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-06-22 | Initial draft — gap analysis, stock Reports catalog, M16 Reporting Operations Hub IA, Ghana/West Africa public health context, DHIMS2 prep, competitive patterns |
| 0.1.1 | 2026-06-22 | **Consistency audit pass** — §22; closed D-REP-1/2/3; PRD v1.20.33 integration; PAGE_DESIGNS M7-F17–F19 tabs + §7.29; USER_WORKFLOWS §14.9 |
| 0.1.2 | 2026-06-22 | **Audit closure** — D-REP-4–7; §23 RR-01–RR-12 runbooks; async export + MOH pack config; PRD §17.4.9 + §18 M16 table |
| 0.1.3 | 2026-06-24 | **M10 boundary** — §1.3 + §10.2 Patient cohort export vs M10 interactive builder (**D-COHORT-10**); PRD v1.20.49 |
| 0.1.4 | 2026-07-09 | **Implementation audit closure** — §19 acceptance ticked with engineering evidence (hub smoke, `ReportHub*` PHPUnit, `MainMenuRestrictReportHubTest`); §16.3 `reports.hub_advanced_open` now a distinct audit event in `ReportHubExportService`; OPD attendance pilot review remains open (Product) |

---

## 22. Consistency audit pass

**Date:** 2026-06-22 · **Scope:** M7 + M16 trilogy (PRD, PAGE_DESIGNS, USER_WORKFLOWS, this spec)

### 22.1 Conflicts resolved

| ID | Issue | Resolution |
|----|-------|------------|
| C-REP-01 | PRD §5.6 labeled M7 **“Post-pilot ops”** while M7 is **V1 P0** elsewhere (B6, G9/G10, EOD gates) | §5.6 row → **V1 P0 — manager EOD**; M16 row added as post-pilot **V1.1-REP** |
| C-REP-02 | **D-REP-1** proposed here; **O-REP-1** recommended same split | **Closed D-REP-1** — separate M16 hub; O-REP-1 removed |
| C-REP-03 | **M13-F08** (V1.2-PHARM in-hub reports) vs **M16 pharmacy lens** overlap | **Closed D-REP-2** — M13-F08 = bench inventory embed in `pharm-ops`; M16 pharmacy lens = clinic-wide compliance (destroyed drugs, transactions); cross-link, no duplicate cards |
| C-REP-04 | PRD §13.1 `reports.daily` only vs PAGE_DESIGNS §7.10.13 `get_*` names | Normative **`reports.*`** prefix in PRD §13.1; PAGE_DESIGNS §7.10.13 lists full action map |
| C-REP-05 | M7-F18 ships **V1.1-ANC**; reporting spec §18 bundled under **V1.1-REP** cross-links | **Closed D-REP-3** — M7-F18 tab stays on M7 under **V1.1-ANC** gate; M16 clinical lens links export only; slice boundaries explicit in §18.1 |

### 22.2 Gaps closed (PRD v1.20.33)

| ID | Gap | Fix |
|----|-----|-----|
| G-REP-01 | No **Module M16** in PRD §5.1 / §8 | M16 row + §8 module stub |
| G-REP-02 | No **§19.5** report menu cutover | Added (parallel §19.3 M14, §19.4 M15) |
| G-REP-03 | No **PAGE_DESIGNS §7.29** report-hub wireframes | §7.29 hub shell stub |
| G-REP-04 | No **USER_WORKFLOWS** periodic reporting | §14.9 manager monthly/quarterly workflows |
| G-REP-05 | PRD companion-docs list missing REPORTING spec | Added |
| G-REP-06 | §7.1 `public/` tree missing `report-hub/` | Added |
| G-REP-07 | §7.2 mermaid missing **M16** | M16 node + `M16 --> M7` embed edge |
| G-REP-08 | §23.1 D36 “Separate ships” missing **V1.1-REP** | Added to closed slice list + §20.1 row |
| G-REP-09 | No **§16.1** REP tests / `@new-clinic-v11-rep` / §21.1w | REP-1–7 + acceptance block |
| G-REP-10 | `report_hub_export_run` DDL not in PRD §12.1 | Added |
| G-REP-11 | §11.2 `MENU_RESTRICT` missing stock **Reports** cutover | Row when `enable_report_hub` = 1 |
| G-REP-12 | PRD §4.4 missing **`reports`** ACL used by PAGE_DESIGNS §7.10.2 | `reports` + M16 lens keys added |
| G-REP-13 | **PAGE_DESIGNS §7.10** missing M7-F17–F19 tabs | §7.10.18–7.10.20 wireframes |

### 22.3 Remaining open items — resolved (v0.1.2)

| ID | Item | Resolution |
|----|------|------------|
| R-REP-01 | O-REP-3 async export threshold | **D-REP-4** — default 5000 rows; `report_hub_async_export_threshold` |
| R-REP-02 | O-REP-4 DHIMS2 / MOH pack owner | **D-REP-5** — `ghana_v1` default; clinical lead + owner sign-off; Nigeria V3 |
| R-REP-03 | O-REP-5 iframe vs native queries | **D-REP-6** — iframe V1.1-REP; native immunization + destroyed drugs P2 |
| R-REP-04 | PRD §18 M16 pointer thin | PRD §18 expanded + **§17.4.9** + this **§23** RR runbooks |

---

## 23. Day-2 reporting runbook (operational)

**Closes the gap** after PRD §17.4 (install) and daily M7 pilot — ongoing manager/clinical-lead reporting tasks.

**Normative in PRD:** [§17.4.9](./NEW_CLINIC_V1_PRD.md#1749-day-2-reporting-runbook-m16). Trainer workflows: [USER_WORKFLOWS §14.9](../NEW_CLINIC_V1_USER_WORKFLOWS.md#149-periodic-reporting-workflows). In-product (V1.2+): optional **Runbooks** footer on M16 hub linking RR cards.

### 23.1 Runbook index

| ID | When | Task | Screen |
|----|------|------|--------|
| **RR-01** | Daily | Manager EOD close — cash, EOD open, reconciliation | M7 |
| **RR-02** | Daily | Chase unsigned documentation | M7 **Unsigned** |
| **RR-03** | Weekly | Review override / bypass sample | M7 **Overrides** |
| **RR-04** | Monthly | Immunization export for EPI | M16 Clinical |
| **RR-05** | Monthly | Destroyed / expired drugs log | M16 Pharmacy |
| **RR-06** | Monthly | Receipt analytics vs M7 daily totals | M16 Financial |
| **RR-07** | Monthly | OPD attendance return (Ghana template) | M16 Public health |
| **RR-08** | Quarterly | Diagnosis summary for clinical meeting | M16 Clinical |
| **RR-09** | Inspection | District / council binder pack | M16 multi-lens |
| **RR-10** | Post-pilot | Enable report hub checklist | M6 + §17.4.9 |
| **RR-11** | Any | Large export (&gt;5k rows) — async job | M16 card → poll |
| **RR-12** | Year-end | Archive CSV exports off-site | Owner + IT |

### 23.2 RR-01 — Daily manager close (canonical)

| Step | Action | Verify |
|------|--------|--------|
| 1 | Open **Daily Reports** (M7) — today’s date | Cash + visits KPIs load |
| 2 | **EOD open** tab — resolve or document each stuck visit | Zero unexplained `with_doctor` overnight |
| 3 | **Reconciliation** — run if scheduled job missed | Status `ok` or explained delta |
| 4 | **Unsigned** tab — assign chase to doctors before tomorrow | G10 compliance |
| 5 | Optional: export cash CSV for owner spreadsheet | Audit `reports.export_run` |

**Pilot:** hub may be OFF — use M7 only; ignore stock Reports US menus.

### 23.3 RR-10 — Enable report hub (post-pilot)

| Step | Action | Verify |
|------|--------|--------|
| 1 | Confirm **M7 P0** signed — REP-7 regression green | M7 stable ≥2 weeks |
| 2 | Run `@new-clinic-v11-rep` tests REP-1–REP-7 on staging | CI green |
| 3 | Set `enable_report_hub` = 1 in M6 | Stock Reports hidden for clinic roles |
| 4 | Manager walkthrough RR-04–RR-07 once | Exports open in Excel |
| 5 | Clinical lead confirms `ghana_v1` OPD template | Worksheet sign-off (**D-REP-5**) |
| 6 | Train staff: Daily = M7; monthly = hub lenses | USER_WORKFLOWS §14.9 |

### 23.4 RR-11 — Large async export

| Step | Action | Verify |
|------|--------|--------|
| 1 | Run report card with wide date range | UI estimates row count |
| 2 | If &gt; `report_hub_async_export_threshold` | Confirm modal → background job |
| 3 | Poll **Export ready** toast / status chip | `report_hub_export_run.status` = `ok` |
| 4 | Download CSV; store in inspection binder | `reports.export_run` audit |

### 23.5 Relationship to other runbooks

| Phase | Document |
|-------|----------|
| **Pre go-live** | PRD §17.4 + §24.4 worksheet |
| **Pilot daily** | **RR-01**, **RR-02** (M7) |
| **Post V1.1-REP** | **RR-04**–**RR-11** |
| **Admin platform** | ADMIN_CONFIGURATION RB-01–RB-20 (backup, staff — not duplicated here) |

---

## Appendix A — Stock report catalog & disposition

| Report (stock label) | Hub disposition | Lens | Notes |
|----------------------|-----------------|------|-------|
| Patient List | Card | Clinical | Cohort export |
| Prescriptions | Card | Clinical | |
| Patient List Creation | Link M7 | Daily ops | Overlap data quality |
| Message List | Link COM | — | Communications hub |
| Clinical | Simplified card | Clinical | Diagnosis/drug modes |
| Referrals | Card | Clinical | M11 when ON |
| Immunization Registry | Card | Clinical / Public health | EPI |
| Report Results (CDR) | Advanced | Audit | US CQM |
| Standard Measures | Advanced | Audit | `enable_cdr` |
| Automated Measures (AMC) | Advanced | Audit | US MU |
| 2026 Real World Testing | Advanced | Audit | US regulatory |
| Alerts Log | Advanced | Audit | |
| Daily Report | **Replace M7** | — | Hide clinic roles |
| Appointments | Bridge | Scheduling | Orthogonal KPI |
| Patient Flow Board | Hide Phase C | Scheduling | S1 replaces |
| Encounters | Advanced | Scheduling | Prefer M7 |
| Appt-Enc | Advanced | Scheduling | Billing |
| Superbill | Advanced | — | US |
| Eligibility 270/271 | Hidden | — | Cash profile |
| Chart Activity / Charts Out | Advanced | — | Paper chart era |
| Services by Category | Card | Financial | |
| Syndromic Surveillance | Deprecated card | Public health | US HL7 — replace V2 |
| Sales / Cash Rec / Front Rec / Pmt Method | Hide / M7 | Financial | Duplicate |
| Collections | Hidden | — | US AR |
| Patient Ledger | M14 Advanced | Financial | |
| Svc Code Financial | Advanced | Financial | CPT-centric |
| Payment Processing | Advanced | Financial | |
| Inventory List / Activity / Transactions | M13 / Card | Pharmacy | |
| Destroyed Drugs | Card | Pharmacy | Compliance |
| Insurance Allocation | Hidden | — | |
| Unique Seen Patients | Card | Scheduling | Monthly KPI |
| IPPF statistics / CYP / daily | Hidden | — | Not region |
| Background Services | Link M15 | Audit | |
| Direct Message Log | Advanced | Audit | |
| IP Tracker | Advanced | Audit | |
| Patient Education Web Lookup | Hidden | — | US |
| Audit Log Tamper | Card | Audit | |
| Receipts by Method | M7 / Financial | Financial | |

---

## Appendix B — User stories

| ID | Story |
|----|-------|
| US-REP-1 | As **owner**, I want **today’s cash and visits on one screen** so I can close the day without Excel. |
| US-REP-2 | As **owner**, I want **one Reports entry point** so staff stop opening the wrong legacy menu. |
| US-REP-3 | As **nurse lead**, I want **immunization export for last month** so I can submit to the district EPI officer. |
| US-REP-4 | As **pharmacist**, I want **destroyed medicines register** so I pass FDA inspection. |
| US-REP-5 | As **accountant**, I want **CSV of all receipts for May** without a live login. |
| US-REP-6 | As **owner**, I want **override audit** so I see who bypassed billing rules. |
| US-REP-7 | As **manager**, I want **scheduling vs visits explained** so I don’t double-count patients. |
| US-REP-8 | As **MOH liaison** (V2), I want **DHIMS2 indicator export** so monthly returns are faster. |

---

## Appendix C — Competitive reference matrix

| Capability | Epic | athena | Bahmni | Helium Health | New Clinic M7+M16 |
|------------|------|--------|--------|---------------|-------------------|
| Daily manager dashboard | ✓ | ✓ | partial | ✓ | **M7** |
| Curated report catalog | ✓ | ✓ | ✓ | ✓ | **M16** |
| National MOH export | custom | ✗ | ✓ (India) | ✓ (NG) | **V2.2 DHIMS2** |
| Immunization register | ✓ | ✓ | ✓ | ✓ | Clinical lens |
| Pharmacy destruction log | ✓ | partial | ✓ | ✓ | Pharmacy lens |
| US quality measures | ✓ | ✓ | ✗ | ✗ | Advanced only |
| Self-serve BI | ✓ | partial | ✗ | partial | CSV V1; BI defer |

---

## Appendix D — KPI orthogonality rules

**Normative — prevents double-counting (PRD §6.7.8, §6.7 scheduling audit).**

| KPI family | Source | May compare with | Must NOT sum with |
|------------|--------|------------------|-------------------|
| **Visit throughput** | `new_visit` | Prior day visits | Appointments booked |
| **Appointments booked** | `openemr_postcalendar_events` | Arrival funnel | Visit started |
| **Arrived (`@`)** | Appointment status | No-show rate | Completed visits |
| **Cash collected** | `new_receipt` | M7 reconciliation | Ledger insurance payments |
| **Encounters (core)** | `form_encounter` | — | `new_visit` without translation note |
| **Immunizations** | `immunizations` table | EPI targets | Visit count |
| **Rx dispensed** | `drug_sales` | M13 worklist | Visit count |

**UI rule:** Any screen showing two families prints footer: *“These metrics measure different things — do not add them together.”*

---

*End of document.*

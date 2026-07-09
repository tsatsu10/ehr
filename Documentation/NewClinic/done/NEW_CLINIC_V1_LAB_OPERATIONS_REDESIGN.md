# Lab Operations & LIS — Redesign Specification

| Field | Value |
|-------|--------|
| **Document version** | 0.1.9 |
| **Status** | Draft for review — **Module M12** integrated in PRD v1.20.29; **M8 Lab Desk** remains V1 queue; PAGE_DESIGNS §7.17–§7.20 |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](../NEW_CLINIC_V1_PRD.md) (v1.20.49), [NEW_CLINIC_V1_PAGE_DESIGNS.md](../NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.49), [NEW_CLINIC_V1_USER_WORKFLOWS.md](../NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.49), [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](../MEDICAL_RECORD_DASHBOARD_REDESIGN.md) (v0.2.36), [NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md) (v0.1.15) |
| **Audience** | Product, design, lab leads, clinical leads, implementers, QA |
| **Scope** | Everything **beyond M8 queue + core shortcuts** — procedure providers, compendium, pending review, manual results, send-out labs, HL7/LIS (DORN pattern), and region-relevant lab admin |
| **Implementation** | Design only — no code in this document |
| **Primary market** | Private outpatient clinics — **West Africa** (V1 launch region) |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Gap analysis — what M8 and MRD already cover](#2-gap-analysis--what-m8-and-mrd-already-cover)
3. [Current-state snapshot (stock OpenEMR)](#3-current-state-snapshot-stock-openemr)
4. [Pain points by surface](#4-pain-points-by-surface)
5. [UI/UX principles for lab operations](#5-uiux-principles-for-lab-operations)
6. [How leading EHRs address these needs](#6-how-leading-ehrs-address-these-needs)
7. [West Africa context](#7-west-africa-context)
8. [Information architecture](#8-information-architecture)
9. [Lab Desk enhancements (M8)](#9-lab-desk-enhancements-m8)
10. [Lab Operations Hub (M12) — worklists & manual entry](#10-lab-operations-hub-m12--worklists--manual-entry)
11. [Test catalog & clinic panels](#11-test-catalog--clinic-panels)
12. [Pending review & result release](#12-pending-review--result-release)
13. [Send-out & external labs](#13-send-out--external-labs)
14. [Electronic LIS / HL7 (DORN pattern)](#14-electronic-lis--hl7-dorn-pattern)
15. [Doctor ordering & MRD integration](#15-doctor-ordering--mrd-integration)
16. [Billing, fees & currency](#16-billing-fees--currency)
17. [Navigation, ACL & admin runbook](#17-navigation-acl--admin-runbook)
18. [Data model & backend contracts](#18-data-model--backend-contracts)
19. [Phasing & PRD alignment](#19-phasing--prd-alignment)
20. [Acceptance criteria](#20-acceptance-criteria)
21. [Open questions](#21-open-questions)
22. [Document history](#22-document-history)
23. [Appendix A — Stock file map](#appendix-a--stock-file-map)
24. [Appendix B — User stories](#appendix-b--user-stories)
25. [Appendix C — Competitive reference matrix](#appendix-c--competitive-reference-matrix)

---

## 1. Purpose & positioning

### 1.1 What this document is for

New Clinic **V1 Module M8 (Lab Desk)** is deliberately narrow: a **visit queue** for lab techs — take patient, bind encounter session, deep-link to stock `procedure_order` / `orders_results.php` / `labdata.php`, mark **Lab complete**. It does **not** replace OpenEMR’s lab engine, compendium loader, or HL7 interfaces.

That is correct for **pilot week 1** when most private OPD clinics run a **small in-house bench** and enter results in core screens. It is **insufficient** for:

- Clinic-wide **pending orders** and **result review** without hunting menus
- **Test catalog** maintenance without `admin/super` fear
- **Send-out** workflows (patient → external lab → manual or electronic result return)
- **Electronic LIS** (HL7) when a clinic connects to a hub lab or installs DORN-style routing
- **Installer/runbook** guidance so implementers know what stays stock vs what New Clinic wraps

This spec defines **Lab Operations** — the operational layer around stock OpenEMR lab tables — aligned with New Clinic IA, visit FSM, T1 tokens, and West Africa practice patterns.

### 1.2 Problem statement

> A lab tech takes a patient from the Lab Desk queue, opens stock **Procedure Results** in an iframe-style legacy page, loses the **queue #** context, cannot see **today’s pending worklist** across all patients, and has no guided path when results arrive on **paper from an external lab** two days later. The clinic manager cannot configure a **OPD starter panel** (CBC, malaria RDT, urinalysis) without reading OpenEMR wiki pages on NPI compendium loaders built for US reference labs.

### 1.3 Positioning vs other surfaces

| Surface | Question it answers | Relationship to Lab Ops |
|---------|---------------------|-------------------------|
| **Doctor Desk (M4)** | “What does this patient need today?” | **Orders** labs via core `procedure_order` — not lab operations |
| **Lab Desk (M8)** | “Who is at the bench right now?” | **Primary queue** for `ready_for_lab` / `in_lab`; launches ops tools for **active visit** |
| **Lab Operations Hub (M12)** | “What work is pending / how do I run the lab?” | **Clinic-wide** worklists, catalog, release, LIS — not visit FSM |
| **MRD Clinical `#clinical-labs`** | “What were their results over time?” | **Read** trends; links to result detail |
| **Chart Depth (M11)** | “Show external lab PDF / referral” | Inbound scan (`referral_document_id`); not LIS |
| **M7 Daily Reports** | “How did the clinic perform?” | Aggregate; optional lab turnaround KPIs V1.2 |

**Training one-liner:** *Desk for who’s at the bench; ops hub for what’s pending; chart for history.*

**Design decision (closed D-LAB-1, PRD D62):** M8 = **visit queue** (unchanged scope). M12 = **lab operations hub** (new submodule) — analogous to M11 Chart Depth vs MRD.

---

## 2. Gap analysis — what M8 and MRD already cover

| Capability | M8 Lab Desk (V1) | MRD / Doctor | Lab Ops gap (M12) |
|------------|------------------|--------------|-------------------|
| Visit queue `ready_for_lab` / `in_lab` | Yes | — | — |
| Take patient + session bind | Yes (M8-F02, F10) | — | — |
| Deep link `procedure_order` | Yes (preflight) | Yes (M4-F03) | **Doctor panel quick order** — deferred **V1.1-LAB-ORD** (D-LAB-2); stock form until then |
| Deep link `orders_results.php` | Yes | — | In-hub **result entry** façade V1.1-LAB |
| Deep link `labdata.php` | Yes | MRD `#clinical-labs` trends; **Labs strip** when `enable_lab_ops` = 1 (MRD §8.10.3) | — |
| Lab-direct intake (`lab_direct`) | V1.1-ANC (M8-F08) | — | Same encounter; ops hub sees intake orders |
| Pending orders (all patients today) | No | — | **M12 worklist** |
| Procedure provider setup | No | — | **Guided setup** + link to stock admin |
| Compendium / test codes | No | — | **Clinic panel packs** (OPD) |
| Pending result review | No | — | **M12-F07** Review tab (P2); V1.1-LAB: lab lead **Release** on slide-over (F03, D-LAB-3) |
| HL7 / Quest / Labcorp / universal | No | — | **LIS connector** layer V1.2; DORN reference |
| Send-out requisition print | No | Chart Depth referral | **Lab requisition** template V1.1 |
| Billing per test (clinic currency) | Cashier fee hints V1.1 | — | Auto fee-sheet link on order complete |

**Conclusion:** M8 solves **where lab fits in the OPD visit**. M12 solves **how the lab runs as a department** without forking OpenEMR’s `procedure_*` schema.

---

## 3. Current-state snapshot (stock OpenEMR)

### 3.1 Data model (core tables)

| Table | Role | In simple terms |
|-------|------|-----------------|
| `procedure_providers` | Lab / facility sending & receiving orders (NPI, HL7 endpoint, compendium version) | **Who is the lab?** Each row is a lab partner — your in-house bench, a send-out lab in the city, or a hospital network. Stores how to reach them (paper, HL7, account number). |
| `procedure_type` | Orderable test codes per provider (code, name, lab_id) | **What tests can you order?** The test catalog for that lab — e.g. code `CBC` = “Full blood count”. Doctors pick from this list when ordering. |
| `procedure_questions` | AOEs (ask-at-order-entry) per test | **Extra questions before the test runs.** Some tests need more info at order time — fasting? urine mid-stream? pregnancy? — asked on the order form. |
| `procedure_order` | Order header — `patient_id`, `encounter_id`, `provider_id`, `date_ordered`, `order_status` | **The lab requisition slip (header).** One order per patient visit chunk: who, when, which lab, overall status (ordered → complete). |
| `procedure_order_code` | Line items on an order | **The tests on that slip (lines).** One row per test ordered — CBC, malaria RDT, urinalysis — each with its own status. |
| `procedure_report` | Result report per order line — `date_collected`, `date_report`, `review_status` | **The result packet for one test.** When sample was taken, when result came back, and whether a doctor has **signed off** (reviewed). |
| `procedure_result` | Analyte rows — `result`, `units`, `range`, `abnormal`, `result_code` | **The actual numbers and text.** Haemoglobin 11.2 g/dL, “Positive”, “No malaria seen” — each measurable piece on the report. |
| `forms` | `procedure_order` registered as encounter form (`formdir = procedure_order`) | **Links the order to the visit.** Tells OpenEMR “this lab order belongs to today’s OPD encounter” so billing and chart stay together. |

**How they fit together (one patient, one visit):**

```
procedure_order          ← “Order labs for Kofi, visit #4521”
    └── procedure_order_code   ← CBC, Malaria RDT
            └── procedure_report   ← result packet per test
                    └── procedure_result   ← Hb 11.2, RDT Negative, …
```

New Clinic **does not** duplicate this schema (same rule as AR / Chart Depth).

### 3.2 Ordering — `forms/procedure_order` + `load_form.php`

| Piece | In simple terms |
|-------|-----------------|
| **`forms/procedure_order`** | The **order form** the doctor (or lab intake) fills in — pick lab, pick tests, add clinical notes. Lives inside the patient’s visit record. |
| **`load_form.php`** | The **door** that opens that form. New Clinic passes `formname=procedure_order` so the right patient and visit are already selected. |

- Doctor (or lab intake) creates orders **in encounter context** — requires `$_SESSION['encounter']` (the system must know *which visit* this order is for).
- Layout: multi-step procedural form; US-centric labels; diagnosis pointers; provider dropdown from `procedure_providers`.
- New Clinic: M4 **Order lab** → `load_form.php?formname=procedure_order` with session bind (PRD Appendix F).

### 3.3 Results entry & review — `interface/orders/`

| File | Purpose | ACL | In simple terms |
|------|---------|-----|-----------------|
| `orders_results.php` | Enter/review results for patient encounter; batch & review modes | `patients` / `sign` | **Main results screen** — type in or edit results for the current patient, mark abnormal values, and **sign** so the doctor has reviewed them. |
| `single_order_results.php` | Single order result UI | lab | **One test at a time** — simpler view when you only need to enter results for a single order line (less clutter than the full batch screen). |
| `pending_orders.php` | **Clinic-wide** pending orders report (date range, facility) | `patients` / `lab` | **Today’s backlog** — every patient who still has tests ordered but not finished, across the whole clinic (not just whoever is at the bench now). |
| `pending_followup.php` | Follow-up queue | lab | **Needs action later** — results or orders that need a callback, repeat test, or doctor follow-up. |
| `procedure_provider_list.php` | Admin: list procedure providers | `admin` / `users` | **Lab partner list (admin)** — see all configured labs (in-house, send-out, HL7). |
| `procedure_provider_edit.php` | Admin: HL7 host, compendium, account # | `admin` / `super` | **Set up a lab (admin)** — add account numbers, HL7 server address, which test catalog version to use. |
| `types.php` / `types_edit.php` | Procedure types / categories | admin | **Group tests into categories** — e.g. Haematology, Microbiology — for easier browsing in admin. |
| `load_compendium.php` | **CSV compendium import** — US NPI map hardcoded | `admin` / `super` | **Bulk-import the test menu** from a CSV file the lab vendor supplies. Stock version is built for US labs (NPI codes); clinics usually need a **custom CSV**. |
| `list_reports.php` | List procedure reports | lab | **Browse finished reports** — search and open result packets that already exist. |
| `procedure_stats.php` | Stats | lab | **Lab volume numbers** — how many tests run, turnaround, etc. (reporting, not day-to-day bench work). |
| `gen_hl7_order.inc.php` | Generate HL7 order message | — | **Build the electronic order** — converts your order into HL7 format to send to a lab computer (not used for paper/send-out workflows). |
| `receive_hl7_results.inc.php` | Parse inbound HL7 results | — | **Read results from the lab computer** — when HL7 messages arrive, this breaks them into rows in `procedure_result`. |

**Pain signal:** `load_compendium.php` ships a **US NPI allowlist** (`$lab_npi`) — not usable for the launch region private labs without custom CSV and provider rows.

### 3.4 Patient lab trends — `labdata.php`

| Piece | In simple terms |
|-------|-----------------|
| **`labdata.php`** | **Lab history graphs** — pick tests (e.g. Hb, glucose) and see values over time on a chart. Useful for chronic care; needs result codes filled in when results are entered. |

- Checkbox wall of `result_code` values; graphs per analyte.
- Requires populated `procedure_results.result_code` — often missing if results entered without codes.
- MRD `#clinical-labs` should surface trends; stock page remains fallback.

### 3.5 HL7 vendor tools — `interface/procedure_tools/`

| Path | Purpose | In simple terms |
|------|---------|-----------------|
| `quest/gen_hl7_order.inc.php` | Quest Diagnostics HL7 | **Send orders to Quest (US)** — vendor-specific electronic order format. |
| `labcorp/gen_hl7_order.inc.php` | Labcorp HL7 | **Send orders to Labcorp (US)** — same idea, different vendor rules. |
| `gen_universal_hl7/` | Universal HL7 order generator | **Generic electronic order builder** — when your lab speaks standard HL7 but isn’t Quest/Labcorp. |
| `ereqs/ereq_universal_form.php` | Electronic requisition form | **Printable / electronic req form** — structured requisition some send-out labs accept instead of handwritten slips. |
| `libs/labs_ajax.php` | AJAX helpers | **Behind-the-scenes helpers** — small server calls that power lab UI widgets without full page reload. |

**Relevance (launch region):** Low for typical 1–3 bench private clinic; relevant for **send-out** to hub labs or hospital networks when electronic interfaces exist.

### 3.6 DORN module — `oe-module-dorn` (reference pattern)

| Element | Detail | In simple terms |
|---------|--------|-----------------|
| **Name** | Diagnostic Ordering Result Network | Optional OpenEMR add-on for **electronic lab ordering and result pickup** over HL7. |
| **Tables** | `mod_dorn_routes`, `mod_dorn_compendium`, `mod_dorn_orderable_items` | **Routes** = how to reach each lab; **compendium** = imported test catalog; **orderable items** = which tests are active for ordering. |
| **UI** | `public/lab_setup.php`, `compendium_install.php`, `routes.php`, `get_lab_results.php`, `results.php` | **Setup wizard** → install test list → configure connections → **poll for new results** → view in results UI. |
| **Pattern** | Compendium install → route config → HL7 order → poll/receive results | **Typical LIS workflow:** load catalog, wire the lab, send orders electronically, check periodically for results. |

**New Clinic stance:** Do **not** fork DORN in V1. **M12 LIS slice** may wrap DORN when installed, or follow its **route + compendium + poll** pattern for a future regional hub connector.

### 3.7 New Clinic M8 today (PRD + PAGE_DESIGNS §7.5)

| Piece | In simple terms |
|-------|-----------------|
| **Lab Desk queue** | **Who is waiting at the bench** — patients in `ready_for_lab` or `in_lab`, with queue number and visit context. |
| **Active panel** | **The patient you’re serving now** — name, orders on this visit, quick actions. |
| **`lab_shortcut_preflight`** | **Safe launch** — checks patient + encounter are set before opening stock `orders_results.php` or `labdata.php` (avoids wrong-patient mistakes). |
| **Status panel** | **Friendly hints only** — “2 tests pending” is UX; the database tables above are the source of truth. |

- Queue + active panel + order summary from `procedure_order`.
- **Open core orders/results** via `lab_shortcut_preflight`.
- Status panel is **UX hints only** — truth is `procedure_report` / `procedure_result`.
- **No** clinic-wide pending list, **no** catalog admin, **no** HL7 status.

---

## 4. Pain points by surface

### 4.1 Cross-cutting (stock lab UX)

| Pain | Who feels it | Impact |
|------|--------------|--------|
| **Encounter session dependency** | Lab tech, doctor | Any lab screen without bound encounter → wrong patient or empty form |
| **Legacy procedural PHP** | Lab tech | `orders_results.php` ~700+ lines; batch/review modes confusing |
| **No queue context** | Lab tech | Stock pages show patient name only — not **queue #** or visit state |
| **Iframe / tab sprawl** | All | Knockout tabs, `top.restoreSession()`, popup blockers |
| **result_code discipline** | Doctor, lab | Missing codes → empty `labdata.php` trends |
| **Review status opaque** | Doctor | `review_status` not surfaced on Doctor Desk chips consistently |
| **Admin-only catalog** | Manager | Fear of breaking production when adding a test |

### 4.2 Procedure provider & compendium

| Pain | Detail |
|------|--------|
| **US NPI centric** | `load_compendium.php` assumes US reference lab NPIs |
| **No starter panel templates** | No out-of-box CBC/malaria/UA panel for West Africa OPD |
| **HL7 fields scary** | `procedure_provider_edit.php` exposes host/port/protocol with no guided setup |
| **Duplicate providers** | Clinics create multiple rows for same external lab |

### 4.3 Pending orders & worklists

| Pain | Detail |
|------|--------|
| **Report, not workflow** | `pending_orders.php` is date-range HTML table — not integrated with Lab Desk queue |
| **No priority sort** | Urgent visits (PRD `is_urgent`) not reflected in lab worklist |
| **No specimen state** | Collect → process → result not tracked in visit FSM (only hints on M8) |

### 4.4 Results entry & review

| Pain | Detail |
|------|--------|
| **Multi-click per analyte** | Entering CBC 12 parameters is tedious on tablet |
| **No panel templates** | Cannot enter “CBC” as a group with defaults |
| **Critical value handling** | Abnormal flags exist (`abnormal` column) but no banner escalation to doctor |
| **Unsigned gate** | `patients/sign` ACL for review — not aligned to `new_lab` role labels |

### 4.5 Send-out & external labs

| Pain | Detail |
|------|--------|
| **Paper loop** | Requisition printed separately; results return on paper → double entry |
| **Delayed results** | No “expected by” date; doctor unaware results pending |
| **External vs in-house** | Same UI for bench RDT and send-out PCR |
| **Patient carries sample** | No handoff checklist (labels, fasting, container) |

### 4.6 Electronic LIS

| Pain | Detail |
|------|--------|
| **Quest/Labcorp useless locally** | Menu clutter for regional installers |
| **DORN unknown** | Documented only in module README; not in clinic runbooks |
| **HL7 failure opaque** | No clinic-friendly “last poll / last error” dashboard |
| **Connectivity** | 3G drops — need manual fallback without duplicate results |

---

## 5. UI/UX principles for lab operations

Aligned with PRD §10, PAGE_DESIGNS §4, MRD §3:

| # | Principle | Application |
|---|-----------|-------------|
| L1 | **Visit-first at bench** | M8 active panel always shows queue #, visit chip, ordered tests |
| L2 | **Worklist-second** | M12 shows **all** pending work; clicking row opens patient in Lab Desk or result entry |
| L3 | **Do not fork lab schema** | Read/write `procedure_*` via services — same as M5.2 for AR |
| L4 | **Panel over analyte** | OPD: enter **CBC**, **Malaria RDT**, **Urinalysis** as panels with expandable analytes |
| L5 | **Manual-first, electronic-optional** | V1.1 manual entry; V1.2 HL7 when `enable_lab_lis` ON |
| L6 | **Identity anchor** | Every lab ops screen: `patient-context-banner` + encounter # (T1-F17 on core shortcuts) |
| L7 | **Role language** | “Collect sample”, “Enter results”, “Release to doctor” — not “Procedure report review” |
| L8 | **Critical result path** | Abnormal/critical → doctor banner chip + optional COM message V1.2 |
| L9 | **Send-out clarity** | Badge **In-house** vs **Send-out** on every order line |
| L10 | **Admin guided** | Manager configures panel packs in M6 — not raw compendium CSV |

### 5.1 Interaction patterns

```text
Lab Desk (M8) — active visit
  └─ Order summary (procedure_order lines)
       ├─ [ Enter results ] → M12 slide-over OR core orders_results (V1.1 → M12 façade)
       ├─ [ Print labels ] (V1.1-LAB, in-house only)
       └─ [ Lab complete ] → FSM when results released / policy met

Lab Operations Hub (M12) — clinic-wide
  └─ Tabs: Pending │ In progress │ Send-out │ LIS status (V1.2); **To review** tab when M12-F07 (P2)
       └─ Row → Take in Lab Desk OR open result entry
```

- **Slide-over** on ≥768px for result entry; full page on mobile
- **Touch targets** ≥48px for bench tablets
- **Offline read** of pending list from last sync; block HL7 poll when offline

---

## 6. How leading EHRs address these needs

*Synthesis for direction — not parity claims.*

### 6.1 Enterprise (Epic Beaker, Cerner PowerChart Lab, athenaLab)

| Need | Pattern | Lesson for New Clinic |
|------|---------|----------------------|
| **Worklist** | Collection worklist + processing + result verification queues | M12 tabbed worklists; urgent sort |
| **Panel ordering** | Order sets / favorites | M6 **OPD starter panel** on Doctor Desk |
| **Result review** | Tech verify → pathologist release → clinician inbox | `review_status` workflow with `new_lab` / `new_doctor` roles |
| **Send-out** | Requisition + manifest + interfaced tracking | Print requisition V1.1; HL7 status V1.2 |
| **Critical values** | Escalation + acknowledgment | Banner chip + audit (V1.1) |

### 6.2 Lightweight / emerging market

| System | Relevance |
|--------|-----------|
| **OpenMRS + lab extension** | Concept-based tests — strong public lab; weak private UX |
| **Bahmni lab** | Accession + worklist — good queue metaphor |
| **Local regional HMS** | Simple test pick list + manual result; weak doctor integration |
| **OpenEMR + DORN** | Full HL7 path exists — needs clinic-facing hub |

### 6.3 Patterns to adopt

1. **Accession #** — optional barcode/sequential ID per collection (V1.1)
2. **Panel favorites** — 8–12 tests cover 90% OPD lab volume in the launch region private practice
3. **Result release** — explicit “Release to doctor” → sets `review_status` + `results_ready` chip (M4-F11)
4. **Turnaround timer** — ordered → collected → reported timestamps visible on worklist
5. **Send-out manifest** — daily batch sheet for courier / external lab

---

## 7. West Africa context

### 7.1 Practice models

| Model | % private OPD (est.) | Implication |
|-------|----------------------|-------------|
| **Small in-house bench** | Common | CBC, RDT, UA, pregnancy test, Hb — manual entry same day |
| **Send-out only** | Common | Collect → external lab → results 24–72h → manual entry |
| **Hybrid** | Growing | Routine in-house; specialized send-out |
| **Hospital lab network** | Urban | Possible HL7 to hub — V1.2 |

### 7.2 High-volume tests (configure as default panel)

| Test | Notes |
|------|-------|
| **Malaria RDT / smear** | National priority; discrete positive/negative + parasite density if smear |
| **CBC / FBC** | Anemia, infection workup |
| **Urinalysis** | Dipstick + microscopy fields |
| **Blood glucose** | Fasting/random; units mmol/L common |
| **HIV rapid / screening** | Counselling documentation separate; result entry only |
| **Hb / sickling** | Sickle endemic regions |
| **Pregnancy test** | Ward/OPD |
| **LFT / RFT panels** | Send-out more often than in-house |

### 7.3 Operational realities

| Factor | Design response |
|--------|-----------------|
| **Paper requisitions** | Print clinic-branded requisition with Patient · MRN · tests · date |
| **Patient carries sample** | Send-out checklist on printed req |
| **Results on WhatsApp photo** | Manual entry — attach scan to `documents` (link from M12) |
| **referral or teaching hospital** | Chart Depth **referral** + lab send-out provider row |
| **NHIS** | Attribute only V1 — no lab claims module |
| **cash clinic** | Each `procedure_order_code` maps to `new_fee_schedule` row (§16) |
| **Power / connectivity** | Manual entry works offline; LIS poll queues when online |
| **Regulation** | Lab lead sign-off on release — map to `review_status` + optional E-Sign profile |

### 7.4 Localization

| Item | Standard |
|------|----------|
| Units | mmol/L glucose; g/dL Hb; SI where clinician-friendly |
| Dates | DD/MM/YYYY |
| Currency | clinic currency on fee hints and cashier bridge |
| Language | English UI V1; `xl()` for local labels later |

---

## 8. Information architecture

### 8.1 Two-layer model (D-LAB-1)

```text
┌─────────────────────────────────────────────────────────────────┐
│  M8 Lab Desk (visit queue)          │  M12 Lab Ops Hub (dept)   │
│  ─────────────────────────          │  ─────────────────────    │
│  ready_for_lab / in_lab             │  Pending worklist       │
│  Take patient · Lab complete        │  Result entry façade    │
│  Active visit order summary         │  Review & release       │
│  Shortcuts → M12 or core            │  Catalog / panels (M6)  │
│                                     │  Send-out · LIS status  │
└─────────────────────────────────────────────────────────────────┘
           │                                      │
           └──────────────┬───────────────────────┘
                          ▼
              Stock OpenEMR procedure_* tables
```

### 8.2 Entry points

| User | Primary | Secondary |
|------|---------|-----------|
| Lab tech | **Lab Desk** `lab.php` | M12 **Pending** tab; Visit Board |
| Lab lead | M12 **Review** + **Catalog** | Admin → stock provider edit (power) |
| Doctor | Doctor Desk **Order lab** | MRD `#clinical-labs` trends |
| Manager | M6 **Lab panels** + M12 setup wizard | Stock compendium load (super) |
| Reception | — | Lab-direct Start visit (V1.1-ANC) |

### 8.3 Module codename

| Element | Value |
|---------|-------|
| PRD module slot | **M12 — Lab Operations Hub** |
| Route prefix | `/interface/modules/custom_modules/oe-module-new-clinic/public/lab-ops/` |
| AJAX namespace | `lab_ops.*` |
| M8 relationship | M8 **consumes** M12 result entry slide-over; FSM unchanged |

---

## 9. Lab Desk enhancements (M8)

Existing M8 scope preserved. **Enhancements** (not replacements):

| ID | Enhancement | Phase |
|----|-------------|-------|
| M8-F11 | **Enter results** opens M12 slide-over (preferred) vs raw `orders_results.php` when `enable_lab_ops` ON | V1.1-LAB |
| M8-F12 | Order line badges: **In-house** / **Send-out** from `new_lab_order_meta.fulfillment` (set at order time; default from provider type) | V1.1-LAB |
| M8-F13 | **Unreleased results** count on queue card (`procedure_report.review_status` ≠ released) | V1.1-LAB |
| M8-F14 | **Critical unreleased** banner when abnormal result saved but not yet released for active visit (M12-F10 = post-release doctor notify, P2) | V1.1-LAB |
| M8-F15 | Link **Print requisition** for send-out lines (M12 template) | V1.1-LAB |

Wireframes: [PAGE_DESIGNS §7.17–§7.20](../NEW_CLINIC_V1_PAGE_DESIGNS.md#717-lab-opsindexphp--lab-operations-hub) (normative build spec); ASCII in §10 below is illustrative.

---

## 10. Lab Operations Hub (M12) — worklists & manual entry

### 10.1 Purpose

Answer: *“What lab work exists across the clinic today — and let me complete it without admin menus?”*

### 10.2 Hub layout — `lab-ops/index.php`

```text
┌─ Lab Operations ─────────────────────────────────────────────────────────┐
│ [ Pending (14) ] [ In progress (3) ] [ Send-out (5) ]                     │
│                              [ LIS ● ] (V1.2)  [ ⚙ Setup ]               │
├────────────────────────────────────────────────────────────────────────────┤
│ Filter: [ Today ▾ ] [ In-house ▾ ] [ Urgent first ☑ ]                      │
├────────────────────────────────────────────────────────────────────────────┤
│ ⚡ Q#12  Akua M.   CBC, Malaria RDT   ordered 09:02   not collected          │
│    Q#15  Kwame O.  LFT panel         ordered 09:18   collected 09:25       │
│    Q#18  Ama K.    Send-out: PCR     ordered 08:40   awaiting results      │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Row actions

| Action | Behavior |
|--------|----------|
| **Open in Lab Desk** | If visit `ready_for_lab`/`in_lab` — navigate `lab.php?visit_id=` |
| **Enter results** | Open slide-over `lab-ops/results.php?procedure_order_id=` |
| **Print requisition** | Send-out only — PDF with clinic header |
| **Mark collected** | Sets `procedure_report.date_collected` (or M12 metadata) — audit `lab_ops.specimen_collected` |

### 10.4 Manual result entry façade — `lab-ops/results.php`

Replaces direct `orders_results.php` for `new_lab` role when hub enabled:

```text
┌─ Enter results — CBC ─────────────────────────────────────── [ × ] ─┐
│ Patient: Akua Mensah · MRN 00123 · Q#12 · Enc 2026-06-22           │
│ Collected: [ 22/06/2026 09:30 ]   Reported: [ 22/06/2026 10:15 ]    │
├──────────────────────────────────────────────────────────────────────┤
│ WBC    [ 7.2  ] ×10⁹/L    (4.0–11.0)                                 │
│ Hgb    [ 11.1 ] g/dL      (12.0–16.0)  ⚠ low                         │
│ … panel rows …                                                       │
│ [ Save draft ]  (lab tech)     [ Release to doctor ]  (lab lead ACL)       │
└──────────────────────────────────────────────────────────────────────┘
```

**Model A (closed D-LAB-3):** **V1.1-LAB** — lab tech **Save draft** (`new_lab_ops_enter`); lab lead **Release to doctor** (`new_lab_ops_release`) from the same slide-over. **No** separate **To review** hub tab until **M12-F07** (P2).

**Backend:** Writes `procedure_report` + `procedure_result` — same as core. **Release** sets `review_status` = `reviewed`, audit `lab_ops.result_released`, emits MRD feed `lab_result_ready`, triggers `results_ready` on Doctor Desk (M4-F11).

### 10.5 M12 functional requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| M12-F01 | **Pending worklist** — all open `procedure_order` for facility today + filter | P1 (V1.1-LAB) |
| M12-F02 | **Result entry façade** over `procedure_result` with panel templates | P1 |
| M12-F03 | **Release to doctor** — lab lead only; `review_status` + audit `lab_ops.result_released`; feed + M4-F11 (D-LAB-3) | P1 |
| M12-F04 | **Specimen collected** timestamp + optional accession # | P1 |
| M12-F05 | **Send-out requisition** PDF (clinic letterhead) | P1 |
| M12-F06 | **Setup wizard** — create in-house provider + load OPD starter panel CSV | P1 |
| M12-F07 | **Review queue tab** — separate hub tab for saved-but-unreleased results; optional two-step clinics (P2) | P2 |
| M12-F08 | **LIS dashboard** — last poll, error count, route status (DORN-aware) | P2 (V1.2-LIS) |
| M12-F09 | **HL7 poll trigger** manual + scheduled (wrap DORN or core receive) | P2 (V1.2-LIS) |
| M12-F10 | **Critical result notify** — after release: doctor banner + optional COM (distinct from M8-F14 unreleased) | P2 |
| M12-F11 | Link document scan to order (WhatsApp paper results) | P2 |
| M12-F12 | Turnaround KPI export for M7 (median hours order→release) | P3 |
| M12-F13 | **Menu cutover** — hide stock Procedures → Pending orders / Load compendium for Clinic roles when `enable_lab_ops` = 1; **Advanced** for admin | P1 |

---

## 11. Test catalog & clinic panels

### 11.1 Problem

Stock compendium load is **super-admin** and US-centric. Clinics need **8–15 tests** on day one.

### 11.2 Clinic panel packs (M6)

| Pack | Tests (example) |
|------|-----------------|
| **OPD Basic starter** | Malaria RDT, Hb, Urinalysis dipstick |
| **OPD Extended starter** | + CBC, Blood glucose, Pregnancy test |
| **Send-out Metabolic** | LFT, RFT, Lipid panel (send-out provider) |

**Storage:** `new_clinic_config` key `lab_panel_pack_json` or CSV import via M12-F06 wizard into `procedure_type`. Sample asset: [samples/opd_lab_panel_starter.csv](../samples/opd_lab_panel_starter.csv).

### 11.3 Setup wizard (M12-F06)

| Step | Action |
|------|--------|
| 1 | Choose model: **In-house bench** / **Send-out only** / **Hybrid** |
| 2 | Create `procedure_providers` row — “{Clinic name} Lab” (in-house) |
| 3 | Import panel CSV → `procedure_type` |
| 4 | Map each code to `new_fee_schedule` charge (clinic currency) |
| 5 | Smoke test: place order on test patient → enter result → see in MRD |

**Power users:** Link **Advanced → stock procedure provider edit** for HL7 fields (V1.2).

---

## 12. Pending review & result release

### 12.1 States (map to `procedure_report.review_status`)

| UI label | Stock value | Who |
|----------|-------------|-----|
| Draft | `received` / partial | Lab tech saving |
| Ready for review | `complete` unreleased | Lab lead |
| Released | `reviewed` / released flag | Doctor notified |

### 12.2 Review queue tab (M12-F07 — P2 only)

**Not in V1.1-LAB (D-LAB-3).** When enabled in P2:

- Adds **To review** hub tab for clinics wanting explicit two-step sign-off
- Filter: abnormal only, send-out only, date range
- Bulk release **not** in V1 — one patient at a time (wrong-patient prevention)

Until F07 ships, lab lead uses **Release to doctor** on the result slide-over (F03).

### 12.3 Doctor visibility

- **Results ready** chip on Doctor Desk (M4-F11) when all ordered tests released
- MRD Overview feed event `lab_result_ready` on `lab_ops.result_release` (MRD §8.6)
- **M8-F14:** critical **unreleased** abnormal on Lab Desk active visit
- **M12-F10 (P2):** critical **released** — doctor acknowledgment + optional COM

---

## 13. Send-out & external labs

### 13.1 Workflow

```text
Doctor orders send-out test
  → M12 marks line Send-out
  → Print requisition (patient carries sample)
  → Optional: HL7 order (V1.2)
  → Results: manual entry OR HL7 receive
  → Release to doctor
```

### 13.2 Provider configuration

| Field | In-house | Send-out (e.g. external reference lab) |
|-------|----------|------------------------|
| `procedure_providers.name` | Clinic Lab | External lab name |
| `send_out` flag | — | `new_lab_order_meta.fulfillment` = `send_out` |
| HL7 | blank V1 | V1.2 |

### 13.3 Link to Chart Depth

- Inbound referral scan (`referral_document_id`) on lab-direct visit — PRD §6.8
- Outbound **lab requisition** is **not** the same as specialist referral letter (M11) — separate template

---

## 14. Electronic LIS / HL7 (DORN pattern)

### 14.1 Phasing

| Phase | Capability |
|-------|------------|
| **V1 pilot** | Manual only; stock HL7 menus hidden for clinic roles |
| **V1.2-LIS** | `enable_lab_lis` — M12 LIS dashboard + DORN module detection |
| **V2** | regional hub connector (partner-specific) following DORN route pattern |

### 14.2 DORN integration (when module installed)

| M12 surface | DORN backend |
|-------------|--------------|
| LIS status tab | `mod_dorn_routes`, last poll from `get_lab_results.php` |
| Compendium | Reuse `compendium_install.php` OR M12 wizard redirect |
| Order transmission | Event on `procedure_order` save → DORN subscriber |

**Do not** bundle DORN in New Clinic — **detect and wrap**.

### 14.3 Stock procedure_tools (Quest / Labcorp)

- **Hidden** from clinic role menus (PRD §19 pattern)
- Documented in **admin runbook** only — for diaspora clinics with US send-out (edge case)

### 14.4 Failure handling

| Failure | UX |
|---------|-----|
| HL7 timeout | M12 shows last error + **Enter manually** CTA |
| Duplicate result | Idempotent receive — match `procedure_order_id` + analyte |
| Wrong patient HL7 | Reject + admin log — never auto-attach without match confidence |

---

## 15. Doctor ordering & MRD integration

### 15.1 Doctor Desk (M4)

**Design decision (closed D-LAB-2):** **Doctor panel quick order** is **not** in **V1.1-LAB** (lab hub). It ships as **V1.1-LAB-ORD** after panels exist from the M12 setup wizard. Until then doctors use stock `procedure_order` via M4-F03.

| Phase | Doctor ordering |
|-------|-----------------|
| **V1 pilot / V1.1-LAB** | Core `procedure_order` form only (M4-F03) |
| **V1.1-LAB-ORD** | **Quick order** drawer: OPD starter panel packs from `lab_panel_pack_json` / imported `procedure_type`; **Custom / full form** fallback |
| **Either** | Complete consult polls `lab_ordered`; send-out vs in-house chips when metadata present |

**Dependency:** V1.1-LAB-ORD requires **V1.1-LAB** complete (≥1 panel pack imported, fees mapped). Gate: `enable_lab_panel_order` = 1 (PRD §12.4).

**Owner:** Doctor Desk (M4-F36) — reads catalog from M6/M12; does **not** edit `procedure_type`.

### 15.2 MRD Clinical `#clinical-labs`

| Element | Behavior |
|---------|----------|
| Recent results | Last 3 encounters — abnormal highlighted |
| Pending | “CBC — sample collected, Awaiting results” |
| Actions | **View trends** → `labdata.php` or M12; **Order lab** → Doctor Desk path |

### 15.3 Order sets by visit type

- `lab_direct` visit: intake creates orders (M8-F08) — panel from visit type defaults (M6-F20)

---

## 16. Billing, fees & currency

### 16.1 Rule

Lab charges post to **`billing`** via fee sheet / checkout — same as PRD §M5.2. No parallel lab billing engine.

### 16.2 Mapping

| Event | Billing action |
|-------|----------------|
| Order placed | Optional auto-add charge per `procedure_type` → `new_fee_schedule` map |
| Lab complete | Cashier sees hints (M5-F14) — send-out may post at order vs result per M6 policy |
| Cancelled order | Remove unc posted line — manager ACL |

### 16.3 Currency display

- All hub and desk summaries show mapped test price via `formatMoney()` when fee schedule linked
- Send-out: show **estimated** external price as note only — actual may differ

---

## 17. Navigation, ACL & admin runbook

### 17.1 ACL groups (D-STAFF-1)

| Group | Tier | Typical user assignment |
|-------|------|-------------------------|
| `new_lab` | Bench tech | Enter results, Lab Desk queue — **no** release to doctor |
| `new_lab_lead` | Supervisor | Release to doctor, lab-direct order intake, ancillary start |

**Solo clinic:** one `lab01` user in **both** groups. **Split clinic:** `lab_tech` → `new_lab` only; `lab_lead` → `new_lab` + `new_lab_lead`.

| Key | Groups |
|-----|--------|
| `new_lab_ops` | `new_lab`, `new_lab_lead`, `new_doctor` (read), `new_admin` |
| `new_lab_ops_enter` | `new_lab`, `new_lab_lead` |
| `new_lab_ops_release` | **`new_lab_lead` only** |
| `new_lab_ops_catalog` | `new_admin` |
| `new_lab_ops_lis` | `new_admin` |

Existing: `new_lab_order_intake` → `new_lab_lead`, `new_doctor`; core `patients` / `lab` / `sign`.

### 17.2 Menu strategy (extends PRD §19)

| Stock menu | Clinic role | New Clinic |
|------------|-------------|------------|
| Procedures → Providers | Hidden | M6 wizard + **Advanced** link |
| Procedures → Pending orders | Hidden | M12 Pending tab |
| Procedures → Load compendium | Hidden | M12 wizard CSV import |
| Quest/Labcorp tools | Hidden | Admin runbook only |
| DORN module menu | Hidden until LIS ON | M12 LIS tab gateway |

### 17.3 Installer runbook (summary)

1. Enable `enable_lab_role` + `enable_lab_ops` when bench ready (post-pilot); M6 rejects `enable_lab_ops` without lab role (M6-F24).
2. Run M12 setup wizard — in-house provider + OPD starter panel.
3. Map fees in M6.
4. Train lab tech: **Lab Desk** queue + M12 **Enter results**.
5. If electronic send-out: install `oe-module-dorn` (or partner module) → enable `enable_lab_lis` → configure routes (V1.2).
6. **Do not** enable HL7 until manual path verified.

### 17.4 Audit events

| Event | Payload |
|-------|---------|
| `lab_ops.specimen_collected` | procedure_order_id, visit_id, actor |
| `lab_ops.result_saved` | procedure_report_id, draft flag |
| `lab_ops.result_released` | procedure_report_id, abnormal_flag |
| `lab_ops.panel_imported` | provider_id, imported_count |
| `lab_ops.critical_acknowledged` | doctor user_id, result_id |
| `lab_ops.lis_poll` | route_id, status, error |

---

## 18. Data model & backend contracts

### 18.1 New module tables (PRD §12.1 `new_lab_order_meta`)

```sql
-- Optional metadata when procedure_report columns insufficient
new_lab_order_meta (
  id, procedure_order_id, visit_id, pid,
  fulfillment ENUM('in_house','send_out') NOT NULL,
  accession_no VARCHAR(32) NULL,
  collected_at DATETIME NULL,
  collected_by BIGINT NULL,
  requisition_printed_at DATETIME NULL,
  document_id INT NULL  -- scanned external result
)
```

### 18.2 AJAX (`lab_ops.*`)

| Action | Request | Response |
|--------|---------|----------|
| `lab_ops.worklist` | `{ tab, date, facility_id, filters }` | `{ rows[] }` |
| `lab_ops.result_get` | `{ procedure_order_id }` | `{ panel_template, rows[], report }` |
| `lab_ops.result_save` | `{ procedure_order_id, rows[], draft? }` | `{ ok }` |
| `lab_ops.result_release` | `{ procedure_report_id }` | `{ ok, results_ready }` — also emits MRD feed `lab_result_ready` |
| `lab_ops.specimen_collect` | `{ procedure_order_id, accession_no? }` | `{ ok }` |
| `lab_ops.requisition_pdf` | `{ procedure_order_id }` | `{ pdf_url }` |
| `lab_ops.panel_import` | `{ csv, provider_id }` | `{ imported_count }` |
| `lab_ops.lis_status` | `{ }` | `{ routes[], last_poll, errors[] }` (V1.2) |

Envelope: PAGE_DESIGNS §6.

---

## 19. Phasing & PRD alignment

| Phase | Deliverable | Gate | Modules |
|-------|-------------|------|---------|
| **V1 pilot** | M8 queue + core shortcuts only | `enable_lab_role` | M8 |
| **V1.1-ANC** | Lab-direct intake (existing) | `enable_ancillary_services` | M8-F08/F09 |
| **V1.1-LAB** | M12 hub: worklist, manual entry, panels, send-out print, menu cutover | `enable_lab_ops` = 1 | M12-F01–F06, F13; M8-F11–F15 |
| **V1.1-LAB-ORD** | Doctor **panel quick order** drawer (M4-F36) | `enable_lab_panel_order` = 1 | Requires V1.1-LAB; US-LAB-4 |
| **V1.2-LIS** | HL7 poll, DORN wrap, LIS dashboard | `enable_lab_lis` = 1 | M12-F08/F09 |
| **P2 lab** | Review tab (F07), critical notify (F10), document link (F11) | OPS / clinic policy | M12-F07/F10/F11 |
| **V3** | Turnaround KPI export (F12) | — | M12-F12 |

**Independence:** V1.1-LAB optional without ancillary; ancillary lab-direct benefits from M12 but does not require LIS.

**Config gates (defaults — PRD §12.4):** `enable_lab_ops` **default `0`** (master gate — M12 hub; not pilot-blocking when `0`); `enable_lab_lis` **default `0`** (V1.2-LIS); `enable_lab_panel_order` **default `0`** (requires `enable_lab_ops` = 1). M6-F24 rejects `enable_lab_ops` = 1 when `enable_lab_role` = 0.

**CI tag:** `@new-clinic-v11-lab` (PRD §16.1, §20.1).

---

## 20. Acceptance criteria

1. Lab tech **Save draft** for **CBC + malaria RDT** from M12 slide-over without opening stock `orders_results.php` UI.
2. Lab lead **Release to doctor** sets `results_ready` on Doctor Desk within 2s (M4-F11) and MRD feed `lab_result_ready` (D-LAB-3).
3. M12 **Pending** list shows all open orders for today — sorted urgent first; **no To review tab** in V1.1-LAB.
4. Send-out order prints **requisition PDF** with Patient · MRN · tests · mapped prices.
5. M12 setup wizard creates in-house provider + imports OPD Basic starter panel (≥5 tests).
6. M8 queue card shows **unreleased result** count per visit (M8-F13); fulfillment badges from `new_lab_order_meta` (M8-F12).
7. **Mark collected** writes `lab_ops.specimen_collected` audit (M12-F04).
8. With `enable_lab_ops` ON, stock Procedures pending/compendium menus hidden for Clinic roles (M12-F13).
9. M6 rejects `enable_lab_ops` = 1 when `enable_lab_role` = 0 (M6-F24).
10. With `enable_lab_lis` ON and DORN installed, M12 LIS tab shows route status and last poll time.
11. With `enable_lab_ops` OFF, M8 still works via core shortcuts (no regression).
12. Lab ops screens show `patient-context-banner`; session bind rules unchanged (**PRD Appendix G**).
13. Audit log contains `lab_ops.result_released` for every doctor-visible release.
14. Ancillary **lab-direct** visit with a same-day OPD appointment surfaces as **EX-07** (informational) in the Queue Bridge Hub (M18-F15) — staff dismiss per D-BRIDGE-9 (see SCHEDULING_QUEUE_BOUNDARY §9.2).

---

## 21. Open questions

| # | Question | Owner | Notes |
|---|----------|-------|-------|
| O-LAB-1 | Accession # mandatory for in-house? | Lab lead | Leaning: optional V1.1, required V1.2 multi-bench |
| O-LAB-2 | Auto-post billing on order vs on release? | Finance | Leaning: on order for in-house; on release for send-out |
| O-LAB-3 | M12 as submodule vs fold into M8? | Engineering | **Closed D62:** M12 separate (`lab-ops/`) — mirrors M11 |
| O-LAB-4 | regional hub LIS partner for V2 connector? | Product | TBD — DORN pattern first |
| O-LAB-5 | Lab lead must E-Sign on every release? | Clinical | Leaning: required for send-out; optional in-house |
| ~~O-LAB-6~~ | ~~Doctor quick order in V1.1-LAB?~~ | — | **Closed D-LAB-2:** deferred to **V1.1-LAB-ORD** (M4-F36); stock form until then |

---

## 22. Document history

| Version | Date | Changes |
|---------|------|---------|
| 0.1.9 | 2026-06-24 | **Consistency audit fixes** — §20 acceptance renumbered (was duplicate 9/10 → now 12/13); "Appendix G" clarified as **PRD Appendix G**; added EX-07/M18-F15 cross-ref (§20 item 14); §19 added explicit config-gate defaults (`enable_lab_ops` **default `0`**, G5) |
| 0.1.8 | 2026-06-22 | Companion sync — PRD v1.20.29; PAGE_DESIGNS v0.6.33; §8 title hygiene |
| 0.1.7 | 2026-06-22 | **D-STAFF-1** — §17.1 formal `new_lab` / `new_lab_lead` groups; solo vs split assignment; PRD v1.20.25 |
| 0.1.6 | 2026-06-22 | **D-REG-3** — clinic currency via M6; `formatMoney()`; §16 currency display |
| 0.1.5 | 2026-06-22 | **D-REG-2** — country-neutral naming; OPD starter panels; `opd_lab_panel_starter.csv`; West Africa context |
| 0.1.4 | 2026-06-22 | Audit fixes — **D-LAB-3** Model A release; M12-F13 menu cutover; M8-F12 fulfillment; no Review tab V1.1-LAB; LAB-6–8 |
| 0.1.3 | 2026-06-22 | **D-LAB-2:** doctor panel quick order deferred to **V1.1-LAB-ORD** (M4-F36) |
| 0.1.2 | 2026-06-22 | Doc-suite integration — PAGE_DESIGNS §7.17–§7.20 wireframes; PRD §4.4/§12.1/§13.1/§17.4.4/§21.1q; USER_WORKFLOWS §8.4b/§14.5; MRD §8.10.3; sample CSV; tests LAB-1–LAB-5 |
| 0.1.1 | 2026-06-22 | §3 plain-language explanations for stock lab tables and screens |
| 0.1.0 | 2026-06-22 | Initial draft — stock lab/LIS gap analysis, regional context, M12 Lab Ops Hub proposal, M8 enhancements, DORN reference, phasing V1.1-LAB / V1.2-LIS |

---

## Appendix A — Stock file map

| Concern | Primary files |
|---------|---------------|
| Results entry | `interface/orders/orders_results.php`, `single_order_results.php` |
| Pending reports | `interface/orders/pending_orders.php`, `pending_followup.php` |
| Providers | `interface/orders/procedure_provider_list.php`, `procedure_provider_edit.php` |
| Compendium | `interface/orders/load_compendium.php`, `types.php` |
| HL7 generate/receive | `interface/orders/gen_hl7_order.inc.php`, `receive_hl7_results.inc.php` |
| Vendor HL7 | `interface/procedure_tools/quest/`, `labcorp/`, `gen_universal_hl7/` |
| Lab trends | `interface/patient_file/summary/labdata.php` |
| Order form | `interface/forms/procedure_order/` |
| Lab helpers | `library/lab.inc.php` |
| DORN module | `interface/modules/custom_modules/oe-module-dorn/` |
| New Clinic Lab Desk | PAGE_DESIGNS §7.5; PRD Module M8 |
| Session bind | PAGE_DESIGNS §4.13; PRD Appendix F, G |

---

## Appendix B — User stories

| ID | As a… | I want to… | So that… |
|----|-------|------------|----------|
| US-LAB-1 | Lab tech | see all pending samples for today in one list | I do not miss a patient who left the waiting area |
| US-LAB-2 | Lab tech | enter CBC results on a tablet without legacy forms | bench work is faster |
| US-LAB-3 | Lab lead | release results to the doctor with one action | the consult can continue |
| US-LAB-4 | Doctor | order a standard OPD panel in three clicks | I spend time on diagnosis not checkboxes | **V1.1-LAB-ORD** (M4-F36) — after lab hub + panel import |
| US-LAB-5 | Manager | load a starter test panel without super-admin | go-live is not blocked |
| US-LAB-6 | Reception | print a send-out requisition with clear patient ID | the external lab matches the sample |
| US-LAB-7 | Doctor | get a banner when critical Hb is low | I act before the patient leaves |
| US-LAB-8 | IT installer | follow a runbook for manual vs HL7 lab | stock admin is not a mystery |

---

## Appendix C — Competitive reference matrix

| Capability | Epic Beaker | athena | Typical regional HMS | New Clinic target |
|------------|-------------|--------|-------------------|-------------------|
| Collection worklist | ✓ | ✓ | Basic | ✓ M12 Pending |
| Panel ordering | ✓ | ✓ | ✓ | ✓ M6 clinic panel packs |
| Manual result entry | ✓ | ✓ | ✓ | ✓ M12 façade |
| Send-out tracking | ✓ | Partial | Paper | ✓ Requisition + status |
| HL7 LIS | ✓ | ✓ | Rare | V1.2 DORN wrap |
| Visit queue integration | ✓ | Partial | ✗ | ✓ M8 FSM |
| cash clinic bridge | N/A | N/A | ✓ | ✓ Fee schedule map |
| Malaria/CBC focus | Regional | Regional | ✓ | ✓ Default panels |

---

*For visit queue behavior, see PRD **Module M8** and PAGE_DESIGNS **§7.5** (+ **§7.5.13** when hub ON). For M12 build spec, see PAGE_DESIGNS **§7.17–§7.20**. For inbound referral scans on lab-direct visits, see PRD **§6.8** and Chart Depth **§10**. For doctor session bind, see PRD **Appendix F** and **Appendix G**.*

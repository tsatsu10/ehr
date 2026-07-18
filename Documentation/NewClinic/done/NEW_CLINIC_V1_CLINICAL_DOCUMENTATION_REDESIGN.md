# Clinical Documentation & Encounter Forms — Redesign Specification

| Field | Value |
|-------|--------|
| **Document version** | 0.1.3 |
| **Status** | **Built + always-on** — the M17 hub is a permanent surface since **2026-07-18** (`enable_clinical_doc_hub` retired, `encounter_note_engine` removed — **native consult engine is the only engine**; PRD §5.6 amendment). The hub opens **any** encounter (encounter-only mode) and offers the **full** form registry via the clinical-form-bridge; **every flag/rollback/legacy-fallback reference in this document is historical**. **NG5** (no form-engine rewrite) still stands — the bridge is the permanent seam |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md) (v1.20.35), [NEW_CLINIC_V1_PAGE_DESIGNS.md](../NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.40), [NEW_CLINIC_V1_USER_WORKFLOWS.md](../NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.40), [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](./MEDICAL_RECORD_DASHBOARD_REDESIGN.md) (v0.2.29), [NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md](./NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md) (v0.1.3), [NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md](./NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md) (v0.1.8) |
| **Audience** | Product, design, clinical leads, doctors, nurses, implementers, QA |
| **Scope** | Everything about **documenting the visit** — stock OpenEMR encounter forms (~35 packaged + unlimited LBF), dynamic **Visit Forms** menu, Doctor Desk deep-links, MRD **This visit**, E-Sign gates, and clinic-specific bundles for Ghana/West Africa OPD |
| **Implementation** | Design spec only — no code in this document |
| **Primary market** | Private outpatient clinics — **West Africa** (Ghana launch region) |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Gap analysis — what M4 and MRD already cover](#2-gap-analysis--what-m4-and-mrd-already-cover)
3. [Current-state snapshot (stock OpenEMR forms)](#3-current-state-snapshot-stock-openemr-forms)
4. [Pain points by surface](#4-pain-points-by-surface)
5. [UI/UX principles for clinical documentation](#5-uiux-principles-for-clinical-documentation)
6. [How leading EHRs address these needs](#6-how-leading-ehrs-address-these-needs)
7. [West Africa & Ghana context](#7-west-africa--ghana-context)
8. [Information architecture — Clinical Documentation Hub](#8-information-architecture--clinical-documentation-hub)
9. [Lens: Active visit documentation (M17 embed)](#9-lens-active-visit-documentation-m17-embed)
10. [Lens: Consult & narrative notes](#10-lens-consult--narrative-notes)
11. [Lens: Structured assessments & screening](#11-lens-structured-assessments--screening)
12. [Lens: Nursing & vitals](#12-lens-nursing--vitals)
13. [Lens: Orders, Rx & instructions](#13-lens-orders-rx--instructions)
14. [Lens: Specialty & optional modules](#14-lens-specialty--optional-modules)
15. [Doctor Desk & role-desk integration](#15-doctor-desk--role-desk-integration)
16. [MRD, Chart Depth & E-Sign](#16-mrd-chart-depth--e-sign)
17. [Navigation, ACL, bundles & menu cutover](#17-navigation-acl-bundles--menu-cutover)
18. [Data model, APIs & backend contracts](#18-data-model-apis--backend-contracts)
19. [Phasing & PRD alignment](#19-phasing--prd-alignment)
20. [Acceptance criteria](#20-acceptance-criteria)
21. [Closed decisions](#21-closed-decisions)
22. [Consistency audit pass](#22-consistency-audit-pass)
23. [Day-2 clinical documentation runbook](#23-day-2-clinical-documentation-runbook)
24. [Document history](#24-document-history)
23. [Appendix A — Stock form catalog & disposition](#appendix-a--stock-form-catalog--disposition)
24. [Appendix B — Ghana OPD starter bundle](#appendix-b--ghana-opd-starter-bundle)
25. [Appendix C — User stories](#appendix-c--user-stories)
26. [Appendix D — Competitive reference matrix](#appendix-d--competitive-reference-matrix)
27. [Appendix E — Stock file map](#appendix-e--stock-file-map)

---

## 1. Purpose & positioning

### 1.1 What this document is for

New Clinic **V1 Doctor Desk (M4)** already solves the **queue** problem: take patient, show consult-ready banner, deep-link to a **small set** of core actions — open encounter, order labs, prescribe, complete consult. Those deep-links land on stock OpenEMR:

- `encounter_top.php` → `forms.php` (iframe) — the full encounter form workspace
- `load_form.php?formname=procedure_order` — lab orders
- Core **Rx** screens — prescriptions

That is correct for **pilot week 1** when the doctor already knows “open SOAP and type.” It is **insufficient** for:

- *“Which form do I use for malaria OPD vs mental health screening?”*
- *“Why does the Visit Forms menu list 30 items including Fee Sheet and Group Attendance?”*
- *“I lost the queue number when I opened the encounter.”*
- *“The nurse saved vitals but I can’t see them without opening five accordions.”*
- *“US Meaningful Use checkboxes appeared on my consult screen.”*
- *“We installed eye clinic forms but general OPD doctors see them every day.”*

Stock OpenEMR ships **~35 packaged form modules** under `interface/forms/` plus **unlimited Layout-Based Forms (LBF)** from `registry`. The **Visit Forms** top menu is populated **dynamically** from `registry` — every installed form appears unless disabled. PRD **NG5** explicitly defers **full replacement** of this engine in V1.

This spec defines **Clinical Documentation Operations** — a **curated façade** over stock forms (same pattern as M16 over Reports, M13 over pharmacy inventory) — aligned with visit FSM, E-Sign profile gates (§6.1.1), T1 shell, and West Africa OPD practice.

### 1.2 Problem statement

> Dr. Mensah takes a patient from the Doctor Desk. He taps **Open encounter** and lands in a legacy page inside an iframe: a long **Add form** dropdown grouped by category, US **medication reconciliation** AMC widgets, orphaned lab-order JavaScript prompts, and no visible **queue #** or **visit state**. He needs PHQ-9 for a student visit but cannot find it without scrolling past Eye Exam and Bronchitis Form. The consult note is SOAP — fine — but the clinic owner wants a **Ghana OPD consult template** with malaria, HTN, and ANC prompts without hiring a developer to learn `edit_layout.php`. When he returns via browser Back, the banner refresh works — but the form page itself still looks like 2010 US ambulatory software.

### 1.3 Positioning vs other surfaces

| Surface | Question | Relationship to clinical docs |
|---------|----------|-------------------------------|
| **Doctor Desk (M4)** | “Who am I seeing and what next?” | **Shortcuts** to document — not the documentation home |
| **Triage (M3)** | “Record vitals fast” | Deep-link **vitals** form; M17 nursing lens for review |
| **Lab Desk (M8) / Lab Ops (M12)** | “Fulfill orders” | **procedure_order** + results — not consult narrative |
| **Pharmacy Desk (M9) / Pharm Ops (M13)** | “Dispense” | Rx list / dispense — not SOAP |
| **MRD Clinical `#clinical-encounter-forms`** | “What was documented this visit?” | **Read** list + link to forms; M17 writes |
| **M15 Admin — Form bundle board** | “Are required forms installed?” | Install/E-Sign health — M17 consumes bundle |
| **Stock Visit Forms menu** | “Every form OpenEMR ever shipped” | **Hidden** when hub ON; Advanced escape |
| **Fee sheet / billing forms** | “What do we charge?” | **M5 / M14** — never primary in consult path |

**Training one-liner:** *Desk for who you’re seeing; documentation hub for what to write; chart for what was written before.*

**Design decision (closed D-FORM-1):** M4 shortcuts = **fast path** (unchanged entry points). **M17 Clinical Documentation Hub** = **curated encounter documentation** for active visit — embeds session context, bundles forms by role/profile, wraps stock `load_form.php` / `view_form.php` (**D-FORM-2**). **NG5 stands:** no rewrite of `eye_mag`, `SOAP` engine, or LBF runtime.

---

## 2. Gap analysis — what M4 and MRD already cover

| Capability | M4 / M3 (V1) | MRD §8.9 | M17 gap |
|------------|--------------|----------|---------|
| Open encounter editor | M4-F03 deep-link `encounter_top` | **This visit** lists `forms` rows | Curated launcher + context strip |
| Consult note (SOAP) | Shortcut only | Link to encounter forms | **Primary card** + Ghana template LBF option |
| Vitals | M3-F05 triage | Vitals section + today chip | Nursing lens; repeat vitals link |
| Lab order | M4-F03 `procedure_order` | Clinical labs strip | Orders lens; panel quick order (M4-F36) |
| Rx | M4-F03 core Rx | Clinical meds strip | Orders lens; allergy gates (§6.1k) |
| E-Sign before complete | M4-F25/F26, §6.1.1 | Signed chip on banner | Hub shows sign status per required form |
| Unsigned backlog | M4-F05 list | — | M7-F17 manager report |
| PHQ-9 / GAD-7 / questionnaires | Not surfaced | Hidden in feed until V1.1-OPS | Screening lens when enabled |
| Eye exam / specialty forms | In Visit Forms menu | — | Specialty lens — opt-in per clinic |
| LBF clinic templates | `edit_layout.php` only | `#clinical-lbf` | Bundle import wizard (M17-F08) |
| US AMC / MU widgets on `forms.php` | Visible | — | **Hidden** in cash clinic profile |
| Visit Forms dynamic menu | Stock | — | Replace with hub for clinic roles |

**Conclusion:** M4 solves **access**. MRD solves **read-back**. M17 solves **which form, when, with what context** — without forking OpenEMR form tables.

---

## 3. Current-state snapshot (stock OpenEMR forms)

### 3.1 Packaged form directories (this workspace — 35)

| Directory | Display name (registry) | Typical use |
|-----------|-------------------------|-------------|
| `soap` | SOAP | General consult note — **default** `consult_note_formdir` |
| `clinical_notes` | Clinical Notes | Structured multi-note (newer) |
| `clinic_note` | Clinic Note | Short clinic note |
| `vitals` | Vitals | BP, temp, SpO₂, etc. — **triage path** |
| `procedure_order` | Procedure Order | Lab/imaging orders |
| `questionnaire_assessments` | New Questionnaire | LForms / FHIR questionnaires |
| `gad7` | GAD-7 | Anxiety screen |
| `phq9` | PHQ-9 | Depression screen |
| `ros` | Review Of Systems | ROS checklist |
| `reviewofs` | Review of Systems Checks | Variant ROS |
| `physical_exam` | Physical Exam | Exam documentation |
| `CAMOS` | CAMOS | Legacy structured note (power users) |
| `eye_mag` | Eye Exam | Ophthalmology — **high complexity** |
| `observation` | Observation | FHIR observation capture |
| `clinical_instructions` | Clinical Instructions | Patient instructions |
| `note` | Work/School Note | Excuse notes |
| `dictation` | Speech Dictation | Dictation workflow |
| `painmap` | Graphic Pain Map | Pain diagram |
| `sdoh` | Social Screening Tool | Social determinants |
| `functional_cognitive_status` | Functional and Cognitive Status | US quality measure oriented |
| `care_plan` | Care Plan | Care planning |
| `treatment_plan` | Treatment Plan | Behavioral health |
| `aftercare_plan` | Aftercare Plan | Discharge planning |
| `bronchitis` | Bronchitis Form | US acute illness template |
| `ankleinjury` | Ankle Evaluation Form | Ortho injury template |
| `track_anything` | Track anything | Custom tracked metrics |
| `LBF` | (dynamic) | Layout-based forms — **lab_intake**, **pharmacy_service**, custom |
| `fee_sheet` | Fee Sheet | **Billing** — not consult |
| `misc_billing_options` | Misc Billing Options HCFA | **US billing** |
| `prior_auth` | Prior Authorization | **US insurance** |
| `requisition` | Lab Requisition | Send-out paper |
| `transfer_summary` | Transfer Summary | Referral/transfer narrative |
| `newpatient` | New Patient Form | Created at Start visit — not daily doc |
| `newGroupEncounter` | New Group Encounter Form | Group therapy — not OPD |
| `group_attendance` | Group Attendance Form | Group therapy |

Plus **unlimited** LBF instances created via Administration → Layouts.

### 3.2 Core encounter UI flow

```text
Doctor Desk → consult_shortcut_preflight → encounter_top.php
    └─► iframe → forms.php
            ├─► Dynamic "Add form" menu (registry × category)
            ├─► Accordion list of forms on this encounter
            ├─► E-Sign controls per form / encounter
            ├─► US AMC medication reconciliation widgets (amc_misc_data)
            └─► Orphaned procedure_order attach prompts
```

**Session dependency:** `$_SESSION['pid']` + `$_SESSION['encounter']` — module `EncounterSessionService` (M0-F22) binds before shortcuts (PAGE_DESIGNS §4.13).

### 3.3 Visit Forms menu

`standard.json` declares **Visit Forms** with **empty static children** — runtime fills from registry for the logged-in user. Result: **flat explosion** of every active form.

---

## 4. Pain points by surface

### 4.1 `forms.php` / encounter workspace

| Pain | Impact (Ghana/West Africa OPD) |
|------|--------------------------------|
| **Iframe inside legacy UI** — no T1 tokens, no queue # | Doctor forgets which patient; wrong-patient risk (mitigated by T1-F17 strip on allowlisted pages only) |
| **Add form** dropdown — 30+ items, opaque names | “CAMOS vs SOAP vs Clinical Notes?” — training cost |
| **US AMC widgets** (med reconciliation) on encounter | Confusion in cash clinics; looks like broken NHIS |
| **Orphaned lab order** JavaScript `confirm()` dialogs | Interrupts consult; English-only |
| **Accordion UX** — all forms expanded/collapsed inconsistently | Hard on tablet; slow on 768px consult room |
| **No role-based catalog** | Nurses see billing forms; doctors see group therapy forms |
| **E-Sign buried** in accordion headers | Unsigned notes reach cashier (G10 failure) |
| **Sensitivity ACL** errors opaque | Locum doctor blocked with generic message |

### 4.2 Visit Forms top menu

| Pain | Impact |
|------|--------|
| Mirrors full registry | Same clutter as dropdown |
| No visit context | Opens forms without binding encounter — session errors |
| Competes with **Clinic** menu IA | Staff use wrong entry point |

### 4.3 Individual form modules

| Form area | Pain |
|-----------|------|
| **eye_mag** | Massive specialty UI — wrong for general OPD |
| **fee_sheet / misc_billing** | US billing fields; cashier should own charges (M5) |
| **gad7 / phq9** | Useful but buried — mental health stigma; need gentle framing |
| **questionnaire_assessments** | Powerful but US LForms library heavy |
| **CAMOS** | Steep learning curve — power users only |
| **bronchitis / ankleinjury** | US-centric single-condition templates |
| **track_anything** | Clinic must configure — no starter pack |

### 4.4 Layout admin (`edit_layout.php`)

| Pain | Impact |
|------|--------|
| Power-user IDE | Owner breaks required fields → blocks payment gate |
| No diff / preview | One wrong “required” on allergies blocks Rx |
| **lab_intake** / **pharmacy_service** invisible until installed | Ancillary V1.1 blocked (PRD §17.3 step 8) |

### 4.5 Process & New Clinic integration

| Pain | Impact |
|------|--------|
| Doctor expected to **pick from Visit Forms** after training on **Doctor Desk shortcuts** | Two mental models |
| MRD **This visit** shows list but creation is still core | Extra clicks |
| Reopen consult + locked note (§6.1l) | Doctor thinks documentation “broken” |
| No **Ghana OPD** defaults | Every clinic reinvents SOAP sections |

---

## 5. UI/UX principles for clinical documentation

| Principle | Application |
|-----------|-------------|
| **Tasks over catalogs** | Show **3–7 cards** for this visit type — not 35-form dropdown |
| **Context always visible** | Patient name · MRN · queue # · encounter # · visit state · profile (`full_opd` / `lab_direct`) |
| **Progressive disclosure** | SOAP first; screening / ROS / specialty behind **More forms** |
| **Role-appropriate** | Nurse sees vitals + nursing notes; doctor sees consult + orders |
| **Same-tab return path** | Preserve M4 §7.4.7d — Back to Doctor Desk; no orphan core pages |
| **Sign status is first-class** | Unsigned = red chip on card + hub header — not buried in accordion |
| **Fail safe** | Preflight session bind; no form write without encounter |
| **Mobile consult wizard** | One column cards ≥44px tap targets (PAGE_DESIGNS §7.4.14) |
| **Plain language** | “Consult note” not “SOAP”; “Anxiety screen (GAD-7)” not “gad7” |
| **No US noise in cash profile** | Hide AMC, prior auth, HCFA, functional/cognitive status defaults |
| **Ghana-ready templates** | Malaria, HTN, diabetes, ANC prompts as **optional LBF packs** — not mandatory US ROS |

---

## 6. How leading EHRs address these needs

| Pattern | Epic / Cerner / athena | Bahmni / OpenMRS | Helium Health / African SaaS | **New Clinic M17 proposal** |
|---------|----------------------|------------------|------------------------------|----------------------------|
| **Note template picker** | SmartForms / dot phrases | HTML Form / concept sets | Visit-type templates | **Bundle cards** per `service_profile` |
| **Single active encounter** | Ambulatory context bar | Active visit concept | Queue + encounter | **EncounterSessionService** + hub header |
| **Structured + narrative mix** | Structured body + free text | Obs forms + narrative | Mixed | Stock SOAP + LBF — no new editor (NG5) |
| **Screening instruments** | PHQ-9 in flowsheet | Program forms | Chronic disease packs | **Screening lens** — GAD-7/PHQ-9 cards |
| **Orders separated from note** | Order entry module | Orders tab | eRx + lab modules | **Orders lens** — procedure_order + Rx shortcuts |
| **Role-based form sets** | Security classes | Privileges | Role templates | ACL lenses + M15 bundle |
| **Specialty modules** | Optional apps | Optional modules | Add-ons | **Specialty lens** — eye, ortho — OFF in default Ghana OPD |
| **US quality reporting** | CQM built-in | Not primary | N/A | **Hidden** — Advanced only |
| **Mobile rounding** | Haiku / mobile rounds | Tablet Bahmni | Phone-first | M4 mobile wizard + fullscreen core |

**Takeaway:** Top systems **curate** what appears per visit type and role. None expect the clinician to browse 35 forms in a flat menu.

---

## 7. West Africa & Ghana context

### 7.1 Practice realities

| Reality | Design response |
|---------|-----------------|
| **High OPD volume** — 3–8 min consults common | Default **one consult card** + vitals already from nurse; ROS optional |
| **Paper habits** — doctors trained on paper SOAP | Ghana OPD LBF mirrors paper sections (CC, HPC, Exam, Dx, Plan) |
| **Malaria / typhoid / URTI** heavy | Quick-pick diagnosis row in template — not US bronchitis form |
| **ANC** in same building as OPD | ANC LBF pack optional — link from visit type or chief complaint chip |
| **Mental health under-documented** | PHQ-9/GAD-7 **offered** not forced; private clinic sensitivity |
| **Eye clinic dual practice** | Enable **eye_mag** only in specialty bundle — not general OPD |
| **English UI** V1 | All labels via `xl()`; Twi prompts defer V2 |
| **Shared consult PC** | Session bind + restore banner (M4-F20) |
| **E-Sign as attestation** | Cultural fit: “sign before patient pays” matches owner expectation |
| **No NHIS claims in V1** | Hide prior auth, misc billing, HCFA on encounter path |
| **Limited bandwidth** | Wrap stock forms — avoid heavy new SPA; optional async template load |

### 7.2 Regulatory & professional context

| Topic | V1 stance |
|-------|-----------|
| **HFFL / Act 843** patient record | Export + audit via E-Sign logs (M7-F19) — forms are source |
| **Medical & Dental Council** record keeping | Consult note required per attendance — `consult_note_formdir` |
| **Pharmacy Council** | Destroyed drugs in M16 — separate from consult forms |
| **District health** monthly returns | Diagnosis from encounter forms feeds M16 clinical lens — documentation quality matters |

### 7.3 Starter clinic profiles

| Profile | Default documentation bundle |
|---------|------------------------------|
| **General OPD** (pilot) | SOAP + vitals + procedure_order + Rx + clinical_instructions |
| **OPD + screening** | + PHQ-9, GAD-7 on demand |
| **Eye clinic** | + eye_mag (specialty lens ON) |
| **Ancillary lab-direct** | lab_intake LBF (§6.8) |
| **Ancillary pharmacy walk-in** | pharmacy_service LBF (§6.8) |

---

## 8. Information architecture — Clinical Documentation Hub

### 8.1 Two-layer model (D-FORM-1)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Clinical Documentation Hub (M17) — active visit only                        │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┬─────────────┐ │
│  │ This visit   │ Consult      │ Screening    │ Nursing      │ Orders      │ │
│  │ (summary)    │ & notes      │              │ & vitals     │ & Rx        │ │
│  ├──────────────┴──────────────┴──────────────┴──────────────┴─────────────┤ │
│  │ Specialty (opt) │ Instructions │ Advanced (stock forms.php)              │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │                              │
   Doctor Desk shortcuts          MRD This visit (read)
   (unchanged fast path)          links back to hub/cards
```

| Module | Route | ACL |
|--------|-------|-----|
| **M17 Hub shell** | `…/public/clinical-doc/index.php` | `new_clinical_doc_hub` |
| **Active visit summary** | same shell — default tab | `new_clinical_doc_hub` (read); lens write ACLs below |
| **Consult lens** | `…/public/clinical-doc/consult.php` | `new_clinical_doc_consult` |
| **Screening lens** | `…/public/clinical-doc/screening.php` | `new_clinical_doc_screening` |
| **Nursing lens** | `…/public/clinical-doc/nursing.php` | `new_clinical_doc_nursing` |
| **Orders lens** | `…/public/clinical-doc/orders.php` | `new_clinical_doc_orders` |
| **Specialty lens** | `…/public/clinical-doc/specialty.php` | `new_clinical_doc_specialty` |

**Entry:** Doctor Desk shortcut **Open encounter** / **Open documentation** (M4-F41 when hub ON) → hub **This visit** tab with same session bind as today (`consult_shortcut_preflight`, shortcut `encounter` or `encounter_hub`).

### 8.2 Hub shell wireframe

```text
┌─ T1 TopBar ───────────────────────────────────────────────────────────────────┐
├─ Clinical Documentation   Queue #12 · Mensah, Kofi · Enc #1842 · with_doctor │
│  Documentation: ⚠ Unsigned consult — [ Open consult note ]  [ Sign ]         │
├─────────────────────────────────────────────────────────────────────────────┤
│ [ This visit ] [ Consult ] [ Screening ] [ Nursing ] [ Orders ] [ More ▾ ]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Form cards for active lens (see §9–§14)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ← Back to Doctor Desk          Advanced (stock encounter forms) ⚠          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Form card pattern

```text
┌─ Consult note (SOAP) ────────────────────────────────────────────────────────┐
│ Required for payment · Last saved 14:32 by Dr. Mensah · ⚠ Not signed      │
│ [ Continue editing ]  [ Sign note ]  [ View print ]                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

Card actions open stock form via **`consult_shortcut_preflight`** (shortcut `form:{formdir}` or stock `encounter` / `lab` / `rx`) → `load_form.php` / `view_form.php` in **same tab** with T1 identity strip (T1-F17). Hub shell routes are added to the T1-F17 allowlist (PAGE_DESIGNS §4.13).

### 8.4 M17 functional requirements (summary)

| ID | Requirement | Phase |
|----|-------------|-------|
| M17-F01 | **Hub shell** — lens nav + visit context header (queue #, patient, encounter, sign status) | P1 (V1.1-DOC) |
| M17-F02 | **This visit tab** — required/started forms, sign overview, bundle-limited add picker | P1 |
| M17-F03 | **Consult lens** — primary `consult_note_formdir` card + optional alternates in **More note types** | P1 |
| M17-F04 | **Screening lens** — PHQ-9/GAD-7 when `clinical_doc_show_screening` = 1 | P1 |
| M17-F05 | **Nursing lens** — vitals + clinical instructions; triage last-saved chip | P1 |
| M17-F06 | **Orders lens** — procedure_order, Rx, requisition, excuse note; cross-link M4-F36 when **V1.1-LAB-ORD** ON | P1 |
| M17-F07 | **Menu cutover** — when `enable_clinical_doc_hub` = 1, hide stock **Visit Forms** for clinic roles; **Advanced** escape | P1 |
| M17-F08 | **Ghana OPD LBF wizard** — import `ghana_opd_consult` layout pack; set `consult_note_formdir` optional | P1 |
| M17-F09 | **Form open audit** — `clinical_doc_form_open` row + `clinical_doc.form_opened` event | P1 |
| M17-F10 | **US quality hide** — when `clinical_doc_show_us_quality` = 0, suppress AMC widgets on wrapped encounter pages (CSS/event subscriber — not fork `forms.php`) | P1 |

---

## 9. Lens: Active visit documentation (M17 embed)

**Normative M4 behavior unchanged for pilot** — hub is **post-pilot** when `enable_clinical_doc_hub` = 1.

### 9.1 This visit tab

| Row | Content |
|-----|---------|
| **Required forms** for `service_profile` | consult note / lab intake / pharmacy service — §6.1.1 |
| **Started forms** on encounter | From `forms` table — status chip each |
| **Sign overview** | Encounter-level + per-form E-Sign |
| **Quick actions** | Add common form (bundle-limited picker) |

### 9.2 Rules

- Hub requires **active `new_visit`** in clinical state for actor (same guards as shortcuts).
- **No hub** without `encounter` on visit — `409 no_encounter_on_visit`.
- **Read-only** when encounter locked — cards show **Locked**; link to §6.1l unlock path via M15 runbook.

---

## 10. Lens: Consult & narrative notes

**Primary card rule (D-FORM-7):** Show **one** required consult card for `consult_note_formdir` (default `soap`). Alternate note types (`clinical_notes`, `clinic_note`, `dictation`) appear under **More note types** — not as duplicate primary cards.

| Card | Stock backend | Plain English | Default Ghana OPD |
|------|---------------|-----------------|-------------------|
| **Consult note** | `soap` or `consult_note_formdir` | Main visit story — CC, exam, plan | **Required** |
| **Clinical Notes** | `clinical_notes` | Multi-section structured note | Alternative if clinic prefers |
| **Clinic Note** | `clinic_note` | Short free-text | Urgent care |
| **SOAP (legacy)** | `soap` | Same as consult when dir=soap | Pilot default |
| **Transfer summary** | `transfer_summary` | Referral narrative | When M11 referral ON |
| **Dictation** | `dictation` | Audio/transcription workflow | Optional |

**Ghana OPD LBF pack (Appendix B):** optional `ghana_opd_consult` LBF — installer wizard M17-F08.

---

## 11. Lens: Structured assessments & screening

| Card | Stock backend | When shown |
|------|---------------|------------|
| **PHQ-9** | `phq9` | Screening lens ON; age ≥12 |
| **GAD-7** | `gad7` | Screening lens ON |
| **Review of systems** | `ros` / `reviewofs` | **Advanced** — not default OPD |
| **Physical exam** | `physical_exam` | Secondary care / clinic policy |
| **Social screening** | `sdoh` | CHPS-style programs — opt-in |
| **Questionnaires** | `questionnaire_assessments` | When LForms library configured |
| **Pain map** | `painmap` | Ortho/pain clinic |

**UX:** Frame as **“Optional screens”** — no stigma copy; result score visible on card after save.

---

## 12. Lens: Nursing & vitals

| Card | Stock backend | Role |
|------|---------------|------|
| **Vitals** | `vitals` | Nurse triage (M3) + doctor review |
| **Observation** | `observation` | FHIR obs — rarely needed V1 |
| **Clinical instructions** | `clinical_instructions` | Nurse-driven patient education |

**Integration:** Triage saves vitals — hub card shows **Last vitals · nurse Akua · 10:42** with link to view (read-only for doctor unless ACL).

---

## 13. Lens: Orders, Rx & instructions

| Card | Stock backend | Notes |
|------|---------------|-------|
| **Lab orders** | `procedure_order` | Same as M4 lab shortcut; M4-F36 panel drawer when ON |
| **Prescriptions** | core Rx | Allergy / pediatric ack modals (§6.1k) before open |
| **Lab requisition** | `requisition` | Send-out paper — M12 link when ON |
| **Work/school note** | `note` | Excuse letter |

**Billing forms excluded:** `fee_sheet`, `misc_billing_options`, `prior_auth` — not in hub catalog.

---

## 14. Lens: Specialty & optional modules

| Card | Stock backend | Default |
|------|---------------|---------|
| **Eye exam** | `eye_mag` | **OFF** general OPD |
| **Bronchitis** | `bronchitis` | OFF |
| **Ankle injury** | `ankleinjury` | OFF |
| **CAMOS** | `CAMOS` | Power users — Advanced |
| **Track anything** | `track_anything` | Clinic-configured |
| **Care / treatment / aftercare plans** | respective forms | Chronic care clinics |

Enable via M6 **`clinical_doc_specialty_pack`** JSON (§17.3) — wizard checkboxes.

---

## 15. Doctor Desk & role-desk integration

### 15.1 V1 pilot (unchanged)

| Shortcut | Target | Change in V1.1-DOC |
|----------|--------|-------------------|
| Open encounter | `encounter_top.php` or M17 hub when flag ON | `consult_shortcut_preflight` shortcut `encounter` → legacy; `encounter_hub` → M17 (D-FORM-8) |
| Lab order | `procedure_order` | Also card on Orders lens |
| Prescribe | core Rx | Also card on Orders lens |
| Problems | core problems | Link from hub header |

### 15.2 Proposed Doctor Desk enhancements (V1.1-DOC)

| ID | Enhancement |
|----|-------------|
| M4-F40 | **Documentation status chip** on active panel — lists unsigned **required** forms by plain name |
| M4-F41 | **Open documentation** shortcut → M17 hub (when `enable_clinical_doc_hub` = 1) else legacy encounter |
| M4-F42 | **Form drawer** — 3-pin favorites from bundle without full hub |

### 15.3 Other desks

| Desk | Forms touchpoint |
|------|------------------|
| **Triage** | Vitals only — nursing lens |
| **Lab** | `procedure_order` read; lab_intake for lab-direct |
| **Pharmacy** | pharmacy_service LBF; not SOAP |

---

## 16. MRD, Chart Depth & E-Sign

| Topic | Rule |
|-------|------|
| **MRD This visit** | Lists same `forms` rows — **Open** launches M17 card when hub ON, else stock view (MRD §8.9 follow-on) |
| **Background vs assessments** | PMH in Background — not duplicated in SOAP (§6.1h) |
| **E-Sign profile** | `full_opd` → consult note; ancillary profiles → LBF formdirs |
| **Complete consult gate** | M4-F26 unchanged — hub does not bypass |
| **Payment gate** | M5 `assertProfileSigned` — hub shows blockers before cashier |
| **Reopen + locked** | Hub cards show **Signed (locked)** — orders still allowed (§6.1l) |

---

## 17. Navigation, ACL, bundles & menu cutover

### 17.1 Menu strategy

When `enable_clinical_doc_hub` = 1:

| Stock | Clinic clinical roles | Notes |
|-------|----------------------|-------|
| **Visit Forms** top menu | Hidden | Use **Clinic → Documentation** or desk shortcuts |
| **Encounter → forms.php** | Reachable via **Advanced** | Warning banner |
| **Patient → Visit Forms** (if any) | Hidden | |

### 17.2 ACL keys (proposed)

| Key | Groups | Purpose |
|-----|--------|---------|
| `new_clinical_doc_hub` | `new_doctor`, `new_admin` | Open hub |
| `new_clinical_doc_consult` | `new_doctor` | Consult lens write |
| `new_clinical_doc_screening` | `new_doctor`, `new_nurse_lead` | Screening instruments |
| `new_clinical_doc_nursing` | `new_nurse`, `new_nurse_lead` | Nursing lens |
| `new_clinical_doc_orders` | `new_doctor` | Orders + Rx cards |
| `new_clinical_doc_specialty` | `new_doctor` | Specialty pack |

### 17.3 Bundle config (M6)

| Key | Default | Notes |
|-----|---------|-------|
| `enable_clinical_doc_hub` | **retired 2026-07-18** | Hub always on (PRD §5.6 amendment) |
| `clinical_doc_bundle` | `ghana_opd_v1` | Appendix B |
| `clinical_doc_show_screening` | `0` | PHQ-9/GAD-7 lens |
| `clinical_doc_show_specialty` | `0` | eye_mag, etc. |
| `clinical_doc_show_us_quality` | `0` | AMC widgets on encounter |
| `clinical_doc_specialty_pack` | `[]` | JSON list of enabled specialty formdirs (eye_mag, etc.) |
| `consult_note_formdir` | `soap` | Existing §12.4 key — primary consult card |

### 17.4 M15 form bundle board relationship

**M15-F06** lists payment/triage-gated forms: `soap` (or `consult_note_formdir`), `lab_intake`, `pharmacy_service`, `vitals`. **`procedure_order`** is a core packaged module — not on the M15 board; hub greys the lab-order card only if registry disables it. When `enable_admin_hub` = 1, M17 **consumes** M15 install/E-Sign health for board forms; when hub OFF, M17 reads registry + M6 config directly (**D-FORM-9**).

### 17.5 T1 identity strip

`clinical-doc/*` routes and hub-wrapped `load_form.php` responses are on the T1-F17 allowlist (PAGE_DESIGNS §4.13). Hub header duplicates queue # + patient for pages that cannot inject strip (legacy iframe).

---

## 18. Data model, APIs & backend contracts

### 18.1 No fork of `forms` / `form_*` tables

M17 reads/writes through stock form PHP — same as M4 shortcuts (NG5).

### 18.2 Optional audit table

```sql
clinical_doc_form_open (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  facility_id INT NOT NULL,
  visit_id BIGINT NOT NULL,
  encounter INT NOT NULL,
  formdir VARCHAR(64) NOT NULL,
  form_id INT NULL,
  actor_user_id BIGINT NOT NULL,
  opened_at DATETIME NOT NULL,
  action ENUM('open','save','sign') NOT NULL
)
```

### 18.3 AJAX actions (sketch)

| Action | Purpose |
|--------|---------|
| `clinical_doc.visit_summary` | Cards + sign status for visit |
| `clinical_doc.open_form` | Wraps `consult_shortcut_preflight` — returns `{ ok, redirect_url }` |
| `clinical_doc.catalog` | Bundle-filtered form list |
| `clinical_doc.sign_status` | Poll E-Sign state |

---

## 19. Phasing & PRD alignment

| Phase | Deliverable | PRD |
|-------|-------------|-----|
| **V1 P0** | M4 shortcuts → stock forms; M3 vitals; §6.1.1 E-Sign gates | M4-F03, M3-F05 — **no M17** |
| **V1.1-DOC** | M17 hub + Ghana OPD bundle + Visit Forms cutover | New M17 — after **M4 P0**; **independent** of M15/M16 (§23.1) |
| **V1.1-ANC** | lab_intake + pharmacy_service cards in hub | §6.8 |
| **V1.1-OPS** | Feed expand `encounter_document_saved` (MRD) | Optional |
| **V2** | Native wrapper for SOAP (still stock save endpoint) | Partial NG5 relaxation only if justified |

**NG5 remains:** full engine replacement out of scope through V2 unless product revises.

---

## 20. Acceptance criteria

### 20.1 V1 pilot (no hub)

- [ ] Doctor completes consult via SOAP shortcut; E-Sign gate works per worksheet.
- [ ] Session bind + restore works (tests 25–27).
- [ ] M15 bundle board shows required forms when M15 ON.

### 20.2 M17 hub

- [ ] Hub OFF → Visit Forms + legacy encounter unchanged (DOC-7).
- [ ] Hub ON → **≤7 primary cards total** across Consult + Nursing + Orders lenses for `ghana_opd_v1`; Consult lens shows **one** primary note card (D-FORM-7).
- [ ] Required consult unsigned → red hub header + M4-F40 chip.
- [ ] fee_sheet not in catalog for clinic roles.
- [ ] Advanced opens stock `forms.php` with warning.
- [ ] Ghana OPD LBF pack imports via wizard (DOC-8).
- [ ] `consult_shortcut_preflight` shortcuts `encounter_hub` and `form:{formdir}` succeed with session bind (DOC-3).

### 20.3 Mandatory tests (proposed — PRD §16.1 follow-on)

| ID | Test |
|----|------|
| DOC-1 | Hub ON — Ghana bundle cards match `clinical_doc_bundle` JSON |
| DOC-2 | Hub ON — Visit Forms hidden for `new_doctor`; Advanced escape works |
| DOC-3 | `consult_shortcut_preflight` — `encounter_hub`, `form:soap` redirect with bound session |
| DOC-4 | Unsigned consult — hub header + M4-F40 chip; Complete consult gate unchanged |
| DOC-5 | Hub OFF regression — M4-F03 legacy paths unchanged |
| DOC-6 | MRD **This visit** Open → hub card when hub ON |
| DOC-7 | Hub OFF — stock Visit Forms + `forms.php` unchanged |
| DOC-8 | M17-F08 — Ghana OPD LBF import sets optional `consult_note_formdir` |

---

## 21. Closed decisions

| ID | Decision |
|----|----------|
| D-FORM-1 | **Two-layer model:** M4 shortcuts = fast path; M17 = curated documentation hub — NG5 respected |
| D-FORM-2 | **Iframe/wrap stock forms** V1.1-DOC — native SOAP shell P2 only |
| D-FORM-3 | **fee_sheet / US billing forms** never in hub catalog — M5/M14 only |
| D-FORM-4 | **Default Ghana OPD bundle** = SOAP + vitals + procedure_order + Rx — screening/specialty opt-in |
| D-FORM-5 | **Visit Forms menu** hidden when hub ON — Advanced escape for super |
| D-FORM-6 | **Preflight reuse:** extend `consult_shortcut_preflight` — no parallel `doc_shortcut_preflight` endpoint |
| D-FORM-7 | **One primary consult card** — `consult_note_formdir` only; alternates under **More note types** |
| D-FORM-8 | **Fast path preserved:** `encounter` shortcut may redirect to hub (`encounter_hub`) when flag ON — still one tap from Doctor Desk |
| D-FORM-9 | **M15 optional:** hub reads registry when `enable_admin_hub` = 0; enriches from M15-F06 when ON |
| D-FORM-10 | **US AMC hide:** event/CSS suppress on wrapped pages when `clinical_doc_show_us_quality` = 0 — no fork of stock `forms.php` |

---

## 22. Consistency audit pass

**Date:** 2026-06-22 · **Scope:** M4 + M17 clinical documentation (PRD, PAGE_DESIGNS, USER_WORKFLOWS, MRD, ADMIN, this spec)

### 22.1 Conflicts resolved

| ID | Issue | Resolution |
|----|-------|------------|
| C-DOC-01 | **D-FORM-6** cited in §1.3 but missing from §21; duplicate naming with D-FORM-2 | **Closed D-FORM-6** — wrap = D-FORM-2; preflight = extend `consult_shortcut_preflight` only |
| C-DOC-02 | **`doc_shortcut_preflight`** in §8.3 vs normative **`consult_shortcut_preflight`** (PRD M4-F19, PAGE_DESIGNS §4.13) | **D-FORM-6** — single preflight; new shortcuts `encounter_hub`, `form:{formdir}` |
| C-DOC-03 | §17.4 claimed **`procedure_order`** on M15-F06 board; PRD M15-F06 + ADMIN §11.3 list only soap, vitals, lab_intake, pharmacy_service | **D-FORM-9** — procedure_order is registry/core; M15 board unchanged |
| C-DOC-04 | §8.1 ACL **`new_clinical_doc`** orphan — not in §17.2 or PRD §4.4 | Removed; **This visit** tab uses `new_clinical_doc_hub` read + per-lens write ACLs |
| C-DOC-05 | §10 listed SOAP + Clinical Notes + Clinic Note as parallel primary cards — conflicts with `consult_note_formdir` gate | **D-FORM-7** — one primary card; alternates in **More note types** |
| C-DOC-06 | Acceptance “≤7 cards on **Consult lens**” vs bundle spans Consult + Nursing + Orders | §20.2 — ≤7 **primary cards total** across default lenses |
| C-DOC-07 | MRD §8.9 primary action **Open encounter → core** vs hub **Open documentation** | When hub ON, same CTA label may stay **Open encounter**; target = M17 via `encounter_hub` (PAGE_DESIGNS §7.30 follow-on) |
| C-DOC-08 | D-FORM-1 marked “proposed” in §8.1 while closed in §21 | **Closed** everywhere — matches D-REP-1 / D-ADMIN-1 pattern |

### 22.2 Gaps closed (this spec v0.1.1)

| ID | Gap | Fix |
|----|-----|-----|
| G-DOC-01 | No **M17-F01–F10** functional list | §8.4 summary table |
| G-DOC-02 | No **T1-F17** allowlist note for `clinical-doc/` | §8.3, §17.5 |
| G-DOC-03 | **`clinical_doc_specialty_pack`** in §14 but not config table | §17.3 |
| G-DOC-04 | No **DOC-1–8** test matrix | §20.3 |
| G-DOC-05 | No **slice independence** rule vs M15/M16 | §19 phasing row + **D-FORM-9** |
| G-DOC-06 | No **day-2 runbook** for documentation ops | §23 DR-01–DR-08 |
| G-DOC-07 | M4-F40–F42 proposed without PRD reservation note | §15.2 — pending PRD §8 integration |
| G-DOC-08 | US AMC hide mechanism unspecified | **D-FORM-10** + M17-F10 |

### 22.3 Remaining open items — resolved (v0.1.2 trilogy integration)

| ID | Item | Resolution |
|----|------|------------|
| R-DOC-01 | Module **M17** in PRD §5.1 / §8 | PRD v1.20.35 — M17-F01–F10 stub |
| R-DOC-02 | **§19.6** Visit Forms menu cutover | PRD §11.2 + §19.6 |
| R-DOC-03 | **PAGE_DESIGNS §7.30** hub wireframes | PAGE_DESIGNS v0.6.40 |
| R-DOC-04 | **USER_WORKFLOWS** doctor documentation section | USER_WORKFLOWS §14.10 v1.9.40 |
| R-DOC-05 | **§20.1** slice **V1.1-DOC** + rule 10 | PRD §20.1 |
| R-DOC-06 | **§24.1** D-FORM-1–10 in closed decisions | PRD §24.1 |
| R-DOC-07 | **§16.1** `@new-clinic-v11-doc` + DOC-1–8 | PRD §16.1 |
| R-DOC-08 | MRD §8.9 **Open** target when hub ON | MRD v0.2.29 |
| R-DOC-09 | **§7.1** `public/clinical-doc/` tree | PRD §7.1 |
| R-DOC-10 | **§13.1** `clinical_doc.*` AJAX actions | PRD §13.1 |

---

## 23. Day-2 clinical documentation runbook

**Closes the gap** after PRD §17.3 (form install) and V1 pilot shortcuts — ongoing clinical-lead / owner documentation tasks.

**Normative in PRD:** [§17.4.10](./NEW_CLINIC_V1_PRD.md#17410-day-2-clinical-documentation-runbook-m17). Trainer workflows: [USER_WORKFLOWS §14.10](../NEW_CLINIC_V1_USER_WORKFLOWS.md#1410-clinical-documentation-workflows). Wireframes: [PAGE_DESIGNS §7.30](../NEW_CLINIC_V1_PAGE_DESIGNS.md#730-clinical-docindexphp--clinical-documentation-hub).

### 23.1 Runbook index

| ID | When | Task | Screen |
|----|------|------|--------|
| **DR-01** | Go-live | Confirm consult note formdir + E-Sign test encounter | M6 / M15 Forms |
| **DR-02** | Go-live | Import Ghana OPD LBF pack (optional) | M17-F08 wizard |
| **DR-03** | Weekly | Review unsigned consult backlog with doctors | M7 **Unsigned** (RR-02) |
| **DR-04** | Monthly | Audit disabled forms — no fee_sheet on consult path | M15 Forms catalog |
| **DR-05** | Post-pilot | Enable documentation hub checklist | M6 + DR-06 |
| **DR-06** | Post-pilot | Train: Desk shortcut = hub; Visit Forms hidden | USER_WORKFLOWS §14.10 |
| **DR-07** | Specialty add-on | Enable eye_mag pack for eye clinic only | M6 `clinical_doc_specialty_pack` |
| **DR-08** | Correction | Signed note error — manager unlock path | M15 §11.5 runbook card |

### 23.2 DR-05 — Enable documentation hub (post-pilot)

| Step | Action | Verify |
|------|--------|--------|
| 1 | Confirm **M4 P0** signed — DOC-5 regression green | Doctor Desk stable ≥2 weeks |
| 2 | Run `@new-clinic-v11-doc` tests DOC-1–DOC-8 on staging | CI green |
| 3 | Set `enable_clinical_doc_hub` = 1 in M6 | Visit Forms hidden for clinic roles |
| 4 | Clinical lead walkthrough DR-02 once | Ghana template or SOAP OK |
| 5 | Train staff: **Open encounter** → hub; Advanced = escape hatch | USER_WORKFLOWS §14.10 |
| 6 | Manager confirms RR-02 unsigned chase still uses M7 | G10 unchanged |

**Rollback:** none — the flag was retired 2026-07-18; the hub is a permanent surface (PRD §5.6 amendment).

### 23.3 DR-08 — Signed note correction (canonical)

| Step | Action | Verify |
|------|--------|--------|
| 1 | Do **not** use Reopen consult to rewrite locked note (PRD §6.1l) | Doctor informed |
| 2 | Manager: stock encounter → form → admin unlock | Audit trail |
| 3 | Doctor edits via hub **Consult** card or Advanced | Re-sign required |
| 4 | Cashier payment gate still passes only when re-signed | M5 gate |

---

## 24. Document history

| Version | Date | Changes |
|---------|------|---------|
| 0.1.3 | 2026-07-18 | **Flip (PRD §5.6 amendment)** — hub permanent (`enable_clinical_doc_hub` retired) and native consult engine the only engine (`encounter_note_engine` removed); encounter-only mode for visits without a queue row; Add form offers the full registry via the bridge; both stock 302 fall-throughs deleted; header marks all flag/rollback references historical |
| 0.1.2 | 2026-06-22 | **Trilogy integration** — PRD v1.20.35 / PAGE_DESIGNS §7.30 / USER_WORKFLOWS §14.10 / MRD §8.9; §22.3 R-DOC-01–10 closed |
| 0.1.1 | 2026-06-22 | **Consistency audit pass** — §22; D-FORM-6–10; M17-F01–F10; preflight/ACL/M15 fixes; §20.3 DOC tests; §23 DR runbooks |
| 0.1.0 | 2026-06-22 | Initial draft — stock forms inventory, pain points, M17 Clinical Documentation Hub IA, Ghana/West Africa bundles, competitive patterns |

---

## Appendix A — Stock form catalog & disposition

| Formdir | Hub disposition | Lens | Notes |
|---------|-----------------|------|-------|
| soap | **Primary card** | Consult | Default consult |
| clinical_notes | Card | Consult | Alternative note |
| clinic_note | Card | Consult | Short note |
| vitals | **Primary card** | Nursing | Triage path |
| procedure_order | **Primary card** | Orders | Lab |
| (core Rx) | **Primary card** | Orders | Not formdir |
| clinical_instructions | Card | Nursing | |
| gad7 | Card | Screening | Opt-in |
| phq9 | Card | Screening | Opt-in |
| questionnaire_assessments | Card | Screening | LForms |
| ros / reviewofs | Advanced | Screening | Hide default OPD |
| physical_exam | Card | Consult | Policy |
| sdoh | Card | Screening | Opt-in |
| note | Card | Orders | Excuse |
| dictation | Advanced | Consult | |
| painmap | Specialty | Specialty | |
| eye_mag | Specialty | Specialty | OFF default |
| bronchitis / ankleinjury | Hidden | — | US templates |
| CAMOS | Advanced | Consult | Power users |
| track_anything | Config | Specialty | |
| care_plan / treatment_plan / aftercare_plan | Card | Consult | Chronic care |
| functional_cognitive_status | Hidden | — | US quality |
| observation | Advanced | Nursing | |
| requisition | Card | Orders | Send-out |
| transfer_summary | Card | Consult | Referrals |
| fee_sheet | **Hidden** | — | M5/M14 |
| misc_billing_options | **Hidden** | — | US billing |
| prior_auth | **Hidden** | — | US insurance |
| newpatient | System | — | Start visit |
| newGroupEncounter / group_attendance | **Hidden** | — | Not OPD |
| LBF (dynamic) | Card per install | Consult / ancillary | lab_intake, pharmacy_service, ghana_opd_consult |

---

## Appendix B — Ghana OPD starter bundle (`ghana_opd_v1`)

| Priority | Form | Role | Required for profile |
|----------|------|------|----------------------|
| 1 | Consult (`soap` or LBF `ghana_opd_consult`) | Doctor | `full_opd` E-Sign |
| 2 | Vitals | Nurse | No E-Sign — triage |
| 3 | Procedure order | Doctor | Optional |
| 4 | Rx (core) | Doctor | Optional |
| 5 | Clinical instructions | Doctor/Nurse | Optional |

**LBF `ghana_opd_consult` sections (illustrative):** Presenting complaint · History · Examination · Vitals summary (read-only embed) · Assessment/Diagnosis · Plan · Follow-up · Malaria/HTN quick codes.

---

## Appendix C — User stories

| ID | As a… | I want to… | So that… |
|----|-------|------------|----------|
| US-DOC-1 | Doctor | see only forms relevant to today's consult | I am not lost in 30-item menus |
| US-DOC-2 | Doctor | know if my note is signed before sending patient to cashier | G10 compliance |
| US-DOC-3 | Nurse | open vitals without seeing billing forms | I finish triage quickly |
| US-DOC-4 | Owner | install Ghana OPD template without coding | go-live is not blocked |
| US-DOC-5 | Manager | hide eye clinic forms from general doctors | daily workflow stays simple |
| US-DOC-6 | Doctor | return to Doctor Desk with Back after saving note | queue context is restored |
| US-DOC-7 | Clinical lead | optionally enable PHQ-9 for student health | mental health screening is available |
| US-DOC-8 | IT | verify M15 board forms + registry match hub required cards | install is consistent |

---

## Appendix D — Competitive reference matrix

| Capability | Epic | OpenMRS/Bahmni | athena | Helium Health | New Clinic M4+M17 |
|------------|------|----------------|--------|---------------|-------------------|
| Visit-type form sets | ✓ | ✓ | ✓ | ✓ | **Bundle** |
| Queue context on doc screen | ✓ | partial | ✓ | ✓ | **Hub header** |
| No flat 30-form menu | ✓ | ✓ | ✓ | ✓ | **M17** |
| Wrap legacy forms | — | HTML Form | ✓ | partial | **Stock PHP wrap** |
| Ghana OPD template pack | — | configurable | — | partial | **LBF wizard** |
| US quality hidden | N/A | N/A | configurable | N/A | **Cash profile** |
| Mobile consult | Haiku | tablet | ✓ | ✓ | **M4 wizard** |

---

## Appendix E — Stock file map

| Area | Primary files |
|------|---------------|
| Encounter workspace | `interface/patient_file/encounter/forms.php`, `encounter_top.php`, `load_form.php`, `view_form.php` |
| Visit Forms menu | `interface/main/tabs/menu/menus/standard.json` (dynamic registry children) |
| Form registry | `library/registry.inc.php`, `interface/forms_admin/forms_admin.php` |
| Layouts / LBF | `interface/super/edit_layout.php`, `library/layout.inc.php` |
| E-Sign | `library/ESign/` (encounter + form sign) |
| New Clinic M17 (planned) | `oe-module-new-clinic/public/clinical-doc/` |

---

**Trilogy integration complete (v0.1.2):** PRD v1.20.35 · PAGE_DESIGNS §7.30 · USER_WORKFLOWS §14.10 · MRD §8.9 · §22.3 R-DOC-01–10 closed.

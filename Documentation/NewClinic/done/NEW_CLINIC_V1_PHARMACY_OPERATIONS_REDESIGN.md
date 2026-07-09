# Pharmacy Operations & Dispensing — Redesign Specification

| Field | Value |
|-------|--------|
| **Document version** | 0.1.9 |
| **Status** | Draft for review — **Module M13** integrated in PRD v1.20.29; **D-PHARM-3/4/5/6** closed; **D-REG-3** clinic currency; **D-STAFF-1** lead groups; PAGE_DESIGNS §7.21–§7.24; M9 remains V1 queue |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](../NEW_CLINIC_V1_PRD.md) (v1.20.29), [NEW_CLINIC_V1_PAGE_DESIGNS.md](../NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.34), [NEW_CLINIC_V1_USER_WORKFLOWS.md](../NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.34), [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](./MEDICAL_RECORD_DASHBOARD_REDESIGN.md) (v0.2.28), [NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md](./NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md) (v0.1.8) |
| **Audience** | Product, design, pharmacy leads, clinical leads, implementers, QA |
| **Scope** | Everything **beyond M9 queue + core Rx/inventory shortcuts** — drug master, lots, receiving, reorder, destruction, dispensing façade, clinic formulary starter packs, and (V3) supply-chain country packs |
| **Implementation** | Design only — no code in this document |
| **Primary market** | Private outpatient clinics — **West Africa** (V1 launch region) |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Gap analysis — what M9 and MRD already cover](#2-gap-analysis--what-m9-and-mrd-already-cover)
3. [Current-state snapshot (stock OpenEMR)](#3-current-state-snapshot-stock-openemr)
4. [Pain points by surface](#4-pain-points-by-surface)
5. [UI/UX principles for pharmacy operations](#5-uiux-principles-for-pharmacy-operations)
6. [How leading EHRs address these needs](#6-how-leading-ehrs-address-these-needs)
7. [West Africa context](#7-west-africa-context)
8. [Information architecture](#8-information-architecture)
9. [Pharmacy Desk enhancements (M9)](#9-pharmacy-desk-enhancements-m9)
10. [Pharmacy Operations Hub (M13) — worklists & dispensing façade](#10-pharmacy-operations-hub-m13--worklists--dispensing-façade)
11. [Formulary & clinic starter packs](#11-formulary--clinic-starter-packs)
12. [Receiving, lots & stock integrity](#12-receiving-lots--stock-integrity)
13. [External Rx, print-and-go & community pharmacy](#13-external-rx-print-and-go--community-pharmacy)
14. [eRx & vendor tools (out of V1 scope)](#14-erx--vendor-tools-out-of-v1-scope)
15. [Doctor prescribing & MRD integration](#15-doctor-prescribing--mrd-integration)
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

New Clinic **V1 Module M9 (Pharmacy Desk)** is deliberately narrow: a **visit queue** for pharmacists — take patient, bind encounter session, deep-link to stock **prescriptions list** and **`drug_inventory.php` / dispense**, mark **Pharmacy complete**. It does **not** replace OpenEMR’s drug catalog, lot engine, inventory reports, or US-centric eRx integrations.

That is correct for **pilot week 1** when most private OPD clinics either (a) run a **small in-house dispensary** with manual stock books + core inventory screens, or (b) **print Rx** and send patients to a community pharmacy. It is **insufficient** for:

- Clinic-wide **pending dispense worklist** without hunting menus
- **Drug master** and **OPD starter formulary** maintenance without `admin/drugs` fear
- **Receiving / lot entry** at the loading bay without legacy popup forms
- **Reorder / low-stock** visibility on the dispensary counter (not only admin reports)
- **Lot destruction & expiry** discipline with audit trail
- **Installer/runbook** guidance so implementers know what stays stock vs what New Clinic wraps

This spec defines **Pharmacy Operations** — the operational layer around stock OpenEMR `drugs` / `drug_inventory` / `drug_sales` / `prescriptions` — aligned with New Clinic IA, visit FSM, T1 tokens, ancillary pharmacy walk-in (§6.8), and West Africa practice patterns.

### 1.2 Problem statement

> A pharmacist takes a patient from the Pharmacy Desk queue, opens stock **Prescriptions** in a legacy popup, loses the **queue #** context, cannot see **today’s pending dispenses** across all patients, and enters lot numbers on a separate **Inventory** screen that looks nothing like the queue. The store manager receives a WhatsApp photo of a supplier invoice and has no guided path to record purchase + lot without reading OpenEMR wiki pages built around **NDC codes** and **US eRx**. Meanwhile the doctor prescribed amoxicillin without seeing **real quantity on hand**, and the cashier bills a drug line that was never dispensed.

### 1.3 Positioning vs other surfaces

| Surface | Question it answers | Relationship to Pharmacy Ops |
|---------|---------------------|----------------------------|
| **Doctor Desk (M4)** | “What should this patient take?” | **Prescribes** via core `prescriptions` / Rx list — not pharmacy operations |
| **Pharmacy Desk (M9)** | “Who is at the counter right now?” | **Primary queue** for `ready_for_pharmacy` / `in_pharmacy`; launches ops tools for **active visit** |
| **Pharmacy Operations Hub (M13)** | “What must we dispense / receive / reorder today?” | **Clinic-wide** worklists, catalog, stock, reports façade — not visit FSM |
| **MRD Clinical `#clinical-meds`** | “What do they take long-term?” | **Read** medication issues + Rx history; links to dispense detail |
| **Chart Depth (M11)** | “Show external Rx scan / referral” | Inbound paper Rx scan on walk-in; not inventory |
| **M7 Daily Reports** | “How did the clinic perform?” | Aggregate; optional dispense KPIs V1.2 |
| **Cashier (M5)** | “What do they owe?” | Bills `drug_sales` / fee sheet lines after dispense |

**Training one-liner:** *Desk for who’s at the counter; ops hub for what’s pending to dispense or receive; chart for medication history.*

**Design decision (closed D-PHARM-1, PRD D63):** M9 = **visit queue** (unchanged scope). M13 = **pharmacy operations hub** (new submodule) — analogous to M12 Lab Operations vs M8 Lab Desk.

**Design decision (closed D-PHARM-4):** **Print Rx pack** (M13-F10 capability) is a **shared document service** — **not** gated by `enable_pharm_ops` or `inhouse_pharmacy`. Gate: `enable_rx_print` (default ON in cash clinic profile). Entry points: **M4-F38** (doctor — Type A pad replacement), **M9-F20** (pharmacy desk when pharmacy role ON). Complements paper prescription pads; does not require inventory or the operations hub.

**Explicit non-goal (V1 / V1.1):** Full **supply chain** — multi-branch central warehouse, wholesaler EDI, NHIS claims medicines pricing, barcode hardware mandate. PRD **V3.0** defers “inventory country packs”; this spec **names** that future track without blocking pilot.

---

## 2. Gap analysis — what M9 and MRD already cover

| Capability | M9 Pharmacy Desk (V1) | MRD / Doctor | Pharmacy Ops gap (M13) |
|------------|----------------------|--------------|------------------------|
| Visit queue `ready_for_pharmacy` / `in_pharmacy` | Yes | — | — |
| Take patient + session bind | Yes (M9-F02, F13) | — | — |
| Deep link Rx list (`controller.php?prescription&list`) | Yes (pid-only) | Yes (M4 Rx) | — |
| Deep link dispense / `drug_inventory.php` | Yes when `inhouse_pharmacy` | — | In-hub **dispense façade** V1.1-PHARM |
| Pharmacy walk-in triage (OTC / external Rx / refer OPD) | V1.1-ANC (M9-F07–F15) | — | Same encounter; ops hub sees walk-in orders |
| Pending dispenses (all patients today) | No | — | **M13 worklist** |
| Drug master (`add_edit_drug.php`) | No | — | **Guided catalog** + starter pack import |
| Lot receive / transfer / adjustment | No | — | **Receiving wizard** V1.1-PHARM |
| Low-stock / reorder report | No | — | **Stock alerts** strip + report façade |
| Lot destruction | No | — | **Destruction workflow** P2 |
| Inventory activity / transactions reports | No | — | **Ops reports** tab (wrap stock reports) |
| Billing per dispense (clinic currency) | Cashier fee hints V1.1 | — | Auto fee-sheet link on dispense |
| Barcode / GS1 scan | No | — | **V3** optional hardware |
| Community pharmacy send-out | Print Rx only | — | **Print Rx pack** — **V1.1-PRINT-RX** (`enable_rx_print`); **not** tied to M13 hub |

**Conclusion:** M9 solves **where pharmacy fits in the OPD visit** (and ancillary walk-in). M13 solves **how the dispensary runs as a department** without forking OpenEMR’s `drugs` schema.

**PRD alignment note:** PRD §8 lists **M9** (visit queue) and **M13** (ops hub, integrated v1.20.19). V1 pilot uses M9 + stock shortcuts only when `enable_pharm_ops` = 0; no full inventory redesign in V1.

---

## 3. Current-state snapshot (stock OpenEMR)

### 3.1 Data model (core tables)

| Table | Role | In simple terms |
|-------|------|-----------------|
| `drugs` | Product catalog — name, NDC, form, size, unit, route, reorder_point, dispensable | **What products exist?** Amoxicillin 500 mg capsule, Paracetamol syrup, etc. |
| `drug_templates` | Dispense templates — selector, dosage, period, quantity, refills, fee links | **How we usually dispense it** — “500 mg TID × 7 days, qty 21”. |
| `drug_inventory` | Lots — lot_number, expiration, manufacturer, on_hand, warehouse_id | **What’s on the shelf?** Batch ABC, expires Dec 2026, 240 capsules left. |
| `drug_sales` | **All stock movements** — sale, purchase, return, transfer, adjustment, consumption | **Every in/out event** — dispensed to patient, received from supplier, wasted. |
| `prescriptions` | Clinical Rx orders — drug_id, dosage, route, quantity, encounter, patient | **What the doctor ordered** — may exist before stock is decremented. |
| `lists` + `lists_medication` | Chart **medication issues** (longitudinal meds) | **What they take chronically** — not the same as today’s dispense slip. |
| `pharmacies` | External pharmacy directory (eRx routing) | **Community pharmacy down the road** — not in-house stock. |
| `prices` | Fee sheet pricing per drug template selector | **How much to charge** in clinic currency when dispensed. |
| `list_options` | `warehouse`, `drug_form`, `drug_units`, `drug_route`, `drug_interval`, `act_pharmacy_supply_type` | **Dropdown reference data**. |

**How they fit together (one patient, one visit):**

```text
prescriptions          ← “Dr Mensah ordered Amoxicillin 500 mg TID × 7d”
    └── drug_sales (trans_type=sale)   ← “Dispensed 21 caps from lot XYZ”
            └── drug_inventory.on_hand ↓
```

New Clinic **does not** duplicate this schema (same rule as lab `procedure_*` and Chart Depth AR).

### 3.2 Prescribing — `controller.php?prescription` + Twig templates

| Piece | In simple terms |
|-------|-----------------|
| **`C_Prescription.class.php`** | **Rx list and edit** — add/change/stop prescriptions; print/fax/email; optional **Save and Dispense** when `inhouse_pharmacy` ON. |
| **`templates/prescription/`** | List + edit UI; `_dispense_drug.html.twig` for quantity, fee, supply type, encounter picker. |
| **`Prescription.class.php`** | Database ORM for `prescriptions` table. |
| **Drug–drug interaction check** | RxNorm / RxNav when `rx_show_drug_drug` ON — **US-oriented**; rarely configured in private OPD clinics. |

- Doctor (or pharmacist on walk-in) creates Rx **in patient context** — encounter required for dispense, not always for list view.
- New Clinic: M4 issues Rx during consult; M9 opens **Rx list** (pid-only) or **dispense** with `pharmacy_shortcut_preflight` + session bind (PRD Appendix F).

### 3.3 Inventory & lots — `interface/drugs/`

| File | Purpose | ACL | In simple terms |
|------|---------|-----|-----------------|
| `drug_inventory.php` | Main inventory browser — drugs × lots × warehouses | `inventory/*` or `admin/drugs` | **Stock room dashboard** — what’s on hand, where, expiring when. |
| `add_edit_drug.php` | Product master CRUD | `admin/drugs` | **Add a new medicine** to the catalog — scary for non-admin. |
| `add_edit_lot.php` | Lot transactions — purchase, return, transfer, adjustment, consumption | `inventory/*` | **Record stock in/out** — supplier delivery, ward transfer, count correction. |
| `dispense_drug.php` | Post-sale **label popup** after `sellDrug()` | `admin/drugs` | **Print bottle label** — provider, lot, expiry (legacy popup). |
| `destroy_lot.php` | Mark lot destroyed — witness, method, date | `admin/drugs` | **Write off expired/damaged stock** with audit fields. |
| `drugs.inc.php` | Shared helpers — `sellDrug()` wrapper, warehouse restrictions | — | **Behind-the-scenes rules** — which warehouse staff may use. |

**Modern service layer:** `src/Services/DrugSalesService.php` — **canonical dispense logic** (FEFO lot pick, expired-lot warnings, `drug_sales` insert, `on_hand` decrement). New Clinic M13 **must call this service**, not reimplement stock math.

### 3.4 Inventory reports — `interface/reports/inventory_*.php`

| File | Purpose | In simple terms |
|------|---------|-----------------|
| `inventory_list.php` | Reorder / min-max — QOH vs reorder point, velocity | **What should we buy this week?** |
| `inventory_activity.php` | Period summary — purchases, sales, transfers | **Month-end stock movement** |
| `inventory_transactions.php` | Line-level ledger of all `drug_sales` | **Audit trail** — every transaction row |
| `prescriptions_report.php` | Rx + dispensations join | **What was prescribed vs dispensed** |
| `destroyed_drugs_report.php` | Destroyed lots | **Regulatory destruction log** |

Gated by `inhouse_pharmacy` global + `inventory/reporting` or `admin/drugs` ACL.

### 3.5 Globals & configuration (stock)

| Global | Meaning |
|--------|---------|
| **`inhouse_pharmacy`** | `0` = off; `1` = drugs; `2` = drugs + non-drug products; `3` = products only. Master switch for inventory menus. |
| **`disable_prescriptions`** | Hides Rx features entirely. |
| **`simplified_prescriptions`** | Free-text dosage — common in low-resource clinics. |
| **`gbl_min_max_months`** | Reorder/min expressed as **months of supply** (default ON) — confusing when staff count **tablets**. |
| **`SELL_FROM_ONE_WAREHOUSE`** | Hardcoded in `drugs.inc.php` — dispense from user default warehouse only. |
| **`gbl_fac_warehouse_restrictions`** | Per-user warehouse permissions. |
| **`rx_*` / `erx_*` / `weno_rx_enable`** | Print margins, US eRx vendors — **out of V1 launch-region scope**. |

**Planned (New Clinic M6):** `enable_pharmacy_role`, `enable_ancillary_services`, `pharmacy_walkin` visit type — mirror `inhouse_pharmacy` at install (PRD §6.8.7a).

### 3.6 New Clinic M9 today (PRD + PAGE_DESIGNS §7.6)

| Piece | In simple terms |
|-------|-----------------|
| **Pharmacy Desk queue** | **Who is waiting at the counter** — `ready_for_pharmacy` / `in_pharmacy`. |
| **Active panel** | **Patient you’re serving** — Rx lines, allergy chips, walk-in triage when ancillary ON. |
| **`pharmacy_shortcut_preflight`** | **Safe launch** before encounter-scoped dispense (wrong-patient prevention). |
| **Allergy gates** | Cross-check ack (M9-F14); documentation gate before walk-in complete (M9-F11). |
| **External Rx validation** | Prescriber name, ID, date on walk-in (M9-F15). |

- Queue + active panel + Rx summary from `prescriptions`.
- **Open core Rx / dispense** via preflight — **no** clinic-wide pending list, **no** catalog admin, **no** stock alerts on desk.

---

## 4. Pain points by surface

### 4.1 Cross-cutting (stock pharmacy UX)

| Pain | Who feels it | Impact |
|------|--------------|--------|
| **Three disconnected UIs** | Pharmacist | Prescribing (Rx edit), stock (inventory), dispense (popup) — no single “pharmacy day” view |
| **Encounter session dependency** | Pharmacist | Dispense without bound encounter → wrong patient or empty form |
| **Legacy popup / table UI** | Pharmacist | `dlgopen`, pre-BS4 tables; poor tablet experience at counter |
| **No queue context** | Pharmacist | Stock pages show patient name only — not **queue #** or visit state |
| **Two medication concepts** | Doctor, pharmacist | Chart **medication issues** vs **prescriptions** vs **drug_sales** — staff confuse “on chart” vs “dispensed today” |
| **QOH invisible at prescribe time** | Doctor | Orders drug that is out of stock — patient discovers at counter |
| **Admin-only catalog** | Manager | Fear of breaking production when adding paracetamol syrup SKU |
| **No barcode** | Pharmacist | Manual lot entry; look-alike/sound-alike pack confusion |

### 4.2 Drug master & formulary (`add_edit_drug.php`)

| Pain | Detail |
|------|--------|
| **US-centric fields** | NDC, RxNorm codes prominent; clinics use **brand + generic + strength** |
| **No OPD pack** | No out-of-box “Primary care essentials” import (antimalarials, ORS, amoxicillin, paracetamol, etc.) |
| **Template complexity** | `drug_templates` + `prices` linkage hard to explain to clinic manager |
| **Consumable vs dispensable** | Confusing flags for clinics that sell gloves separately from Rx meds |

### 4.3 Inventory & lots (`drug_inventory.php`, `add_edit_lot.php`)

| Pain | Detail |
|------|--------|
| **Manual everything** | Every supplier delivery = multi-field lot form; no invoice photo → structured receive |
| **Months-of-supply min/max** | `gbl_min_max_months` default mismatches tablet counting |
| **Warehouse / facility model** | Heavy for single-store-room clinic |
| **FEFO invisible** | `DrugSalesService` picks lot, but staff don’t see **which lot** until after dispense |
| **Expired lot discipline** | Email alerts need mail config; counter staff often miss expiry |
| **Destruction buried** | `destroy_lot.php` separate; no link from “expired on shelf” report to action |

### 4.4 Dispensing (`C_Prescription` + `dispense_drug.php`)

| Pain | Detail |
|------|--------|
| **Save and Dispense buried** | Only on Rx **edit** screen — not on queue-driven workflow |
| **Label popup ACL** | `dispense_drug.php` requires `admin/drugs` — stricter than dispense sales ACL |
| **Fee coupling opaque** | `drug_sales.fee` → fee sheet; cashier may bill undispensed Rx if process breaks |
| **Partial dispense** | Refills / short stock not surfaced on Pharmacy Desk card |
| **Allergy UX split** | Cross-check on desk (M9-F14) vs core Rx interaction check — inconsistent |

### 4.5 Reports (`inventory_*.php`)

| Pain | Detail |
|------|--------|
| **Admin menu only** | Pharmacist on duty cannot see low-stock without leaving patient |
| **Report, not workflow** | `inventory_list.php` is HTML table — no “create purchase draft” action |
| **No MoMo / currency dashboard** | Cash inventory value useful for owner; not on role desk |

### 4.6 Regional practice

| Pain | Detail |
|------|--------|
| **Cedi volatility** | Cost price stale → margin blind spot (operational, not OpenEMR-specific) |
| **FDA registration** | No field for **FDA reg #** on product — clinics track in spreadsheets |
| **NHIS / cash mix** | V1 cash-only; future NHIS medicine lists need country pack (V3) |
| **Community pharmacy default** | Many clinics **print Rx** only — in-house inventory is optional; UX must not force inventory ON |
| **Pharmacy Council expectations** | Dispensing records, batch traceability, expiry — stock OpenEMR **can** support if used correctly, but UI discourages discipline |

---

## 5. UI/UX principles for pharmacy operations

Aligned with PAGE_DESIGNS §2 (T1 tokens), PRD §6.1k safety patterns, and clinical UI accessibility norms.

### 5.1 Safety first (non-negotiable)

| Principle | Implementation |
|-----------|----------------|
| **Patient · MRN · Queue #** on every dispense surface | Sticky `#patient-context-banner` on M9 active panel and M13 dispense slide-over |
| **Confirm before decrement stock** | Release/dispense modal repeats drug, strength, qty, lot (when known) |
| **Allergy cross-check** | Amber chip + **ack + reason** (M9-F14); never silent override |
| **Undocumented allergies** | Hard block on walk-in dispense complete (§6.8.7b) — link to allergy form |
| **External Rx metadata** | Prescriber + date required (M9-F15) — paper prescription norm |
| **Session bind** | `pharmacy_shortcut_preflight` before encounter-scoped shortcuts |
| **Audit everything** | `pharmacy_ops.dispense`, `pharmacy_allergy_ack`, stock transactions via stock tables + New Clinic event envelope |

### 5.2 Counter speed (dispensary reality)

| Principle | Implementation |
|-----------|----------------|
| **One active patient** | M9 queue pattern — same as Lab/Doctor desks |
| **≤3 taps to dispense common Rx** | M13 façade: panel row → qty confirm → dispense (wrap `DrugSalesService`) |
| **Touch targets ≥44px** | Gloved hands, shared tablet at counter |
| **No color-only alerts** | Low stock, expiry, interaction — icon + text |
| **Offline-tolerant labels** | Print Rx / label still works if AJAX refresh fails (queue state stale) |

### 5.3 Progressive disclosure

| User | Show | Hide |
|------|------|------|
| **Pharmacist on duty** | Pending dispense, dispense façade, low-stock chips | Drug master NDC fields, destruction witness legalese |
| **Store manager** | Receiving wizard, reorder report, catalog import | Visit FSM details |
| **Doctor** | Formulary favorites + QOH hint on prescribe | Lot numbers |
| **Admin** | Advanced → stock `add_edit_drug.php` | — |

### 5.4 Do not fork — façade

Same rule as M12 Lab Ops:

- **Read/write** stock tables through `DrugSalesService`, `DrugService`, `PrescriptionService`
- M13 is **workflow + IA**, not a second inventory database
- When `enable_pharm_ops` = 0, M9 **still works** via core deep links (regression test PHARM-5)

---

## 6. How leading EHRs address these needs

Synthesis from inpatient/outpatient pharmacy modules (Epic Willow, Cerner PowerChart Rx, athenaMedication, OpenMRS dispensing apps, and clinic point-of-dispense vendors). Patterns applicable to **small West Africa OPD clinics**, not US hospital pharmacy.

### 6.1 Unified pharmacy workbench

| Pattern | What top systems do | New Clinic mapping |
|---------|---------------------|-------------------|
| **Central work queue** | Rx awaiting verification, fill, pickup — sort by urgency | **M13 Pending dispense** tab |
| **Status per line** | Ordered → verified → filled → picked up → billed | Map to `prescriptions` + `drug_sales` dispensation count |
| **Patient context always visible** | Banner with allergies, problems, age | T1 banner + MRD deep links |

### 6.2 Formulary-aware prescribing

| Pattern | What top systems do | New Clinic mapping |
|---------|---------------------|-------------------|
| **In-formulary favorites** | Top 50 clinic meds as quick picks | **OPD starter formulary pack** (M13-F06) + future M4 quick Rx (V1.2) |
| **Real-time QOH** | “12 on hand” next to drug search | **M13-F02** QOH badge on M9 Rx lines when hub ON |
| **Therapeutic substitution** | Suggest generic alt when OOS | P2 — policy flag; national standard treatment guidelines alignment |

### 6.3 Inventory integrity

| Pattern | What top systems do | New Clinic mapping |
|---------|---------------------|-------------------|
| **Perpetual inventory** | Every dispense decrements QOH | Stock `DrugSalesService` — do not bypass |
| **FEFO / expiry** | Pick oldest lot first; block expired | Service already FEFO; M13 **shows lot** before confirm |
| **Receiving workflow** | Scan invoice → match PO → receive lots | **M13 receiving wizard** (manual entry V1.1; barcode V3) |
| **Cycle count** | Periodic count adjustments | Link to `add_edit_lot.php` adjustment type 5 |
| **Reorder points** | Par levels → suggested order list | Wrap `inventory_list.php` in M13 Reports tab |

### 6.4 Safety & compliance

| Pattern | What top systems do | New Clinic mapping |
|---------|---------------------|-------------------|
| **BCMA barcode scan** | Scan patient wristband + drug barcodes | **V3** optional; V1 manual confirm modal |
| **Override with reason** | All interaction overrides audited | M9-F14 pattern extended to interaction overrides P2 |
| **Dispense label** | Patient label with counseling cues | Wrap `dispense_drug.php` label or Twig PDF — English + optional Twi prompt text (content, not i18n framework) |
| **Separation of duties** | Pharmacist verifies what doctor ordered | Walk-in: pharmacist is prescriber-of-record on service note (§6.8) |

### 6.5 What we deliberately skip in V1

| Enterprise feature | Why skip for the launch region private OPD V1 |
|--------------------|----------------------------------|
| **340B / payer carve-out** | US program |
| **US eRx (Surescripts)** | Not applicable; print Rx + walk-in |
| **IV admixture / chemo** | Out of scope — outpatient tablet/syrup focus |
| **Robotic dispensing** | — |
| **Wholesaler EDI** | V3 supply chain |

---

## 7. West Africa context

### 7.1 Regulatory & professional landscape

| Body / document | Relevance |
|-----------------|-----------|
| **national drug regulator** | Registered products; batch traceability expectations for dispensaries |
| **national pharmacy council** | Licensed premises; wholesale license verification for suppliers |
| **MoH Essential Medicines List (EML)** | Guides what clinics **should** stock — basis for formulary pack |
| **Standard Treatment Guidelines (STG)** | Prescribing norms — future CDS hints |
| **NHIS medicine lists** | V2+ when insurance module ships — not V1 cash model |

Private clinics often operate as **clinic + dispensary** (same entity). Pharmacy Council rules distinguish **pharmacy** vs **clinic** licenses — product positioning must allow **print-and-go Rx** without forcing in-house inventory.

### 7.2 Operational realities

| Reality | Design response |
|---------|-----------------|
| **~70% imported medicines** (India, China) | Cost price field on receive; FX note in runbook — not automated FX |
| **Cash + MoMo at cashier** | Dispense creates billable `drug_sales`; M5 collects in clinic currency |
| **Manual stock book habit** | M13 receiving must be **faster than paper** or adoption fails |
| **Single store room** | Default **one warehouse**; hide multi-warehouse until multi-branch V3 |
| **High patient volume OPD** | Pending dispense sort: urgent visit first, then FIFO |
| **External paper Rx common** | M9 walk-in path + scan to `document_id` (Chart Depth link) |
| **OTC sold at counter** | Pharmacist decides (D35) — dispense without `prescriptions` row uses consumption/sale path |
| **Look-alike packs** | Large drug name on confirm modal; photo on catalog optional P2 |

### 7.3 OPD starter formulary seed (illustrative categories)

Not a clinical authority — **installer seed** for wizard; clinician lead must approve.

| Category | Example lines (generic) |
|----------|-------------------------|
| **Antimalarials** | Artemether-lumefantrine, RTS |
| **Antibiotics** | Amoxicillin, Metronidazole, Ciprofloxacin (per STG policy) |
| **Analgesics / antipyretics** | Paracetamol, Ibuprofen |
| **ORS / rehydration** | ORS sachets |
| **GI** | Omeprazole, Hyoscine butylbromide |
| **Respiratory** | Salbutamol inhaler, cough syrup (policy-limited) |
| **Topicals** | Chlorhexidine, hydrocortisone cream |
| **Chronic staples** | Metformin, amlodipine, losartan (when clinic manages chronic OPD) |

Sample CSV path: [samples/opd_formulary_starter.csv](../samples/opd_formulary_starter.csv) — mirrors lab panel CSV pattern.

### 7.4 West Africa expansion (V3 country packs)

| Pack | Notes |
|------|-------|
| **Launch region** | clinic currency, regulator fields, EML seed |
| **NG** (Nigeria) | NAFDAC reg field; naira |
| **SN** (Senegal) | French labels option; ANSM parallels |

PRD **V3.0** row: *“Multi-branch, inventory, WA country packs”* — M13 is the **host** for country pack import, not V1.

---

## 8. Information architecture

### 8.1 Two-layer model (D-PHARM-1)

```text
┌─────────────────────────────────────────────────────────────────┐
│  M9 Pharmacy Desk (visit queue)          enable_pharmacy_role   │
│  ready_for_pharmacy / in_pharmacy                               │
│  Take → dispense shortcuts → Pharmacy complete                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ when enable_pharm_ops = 1
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  M13 Pharmacy Operations Hub (pharm-ops/)                       │
│  Clinic-wide: pending dispense │ receive │ stock │ reports      │
│  Wraps drugs/* + DrugSalesService — no schema fork                │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Module codename

| Item | Value |
|------|-------|
| **PRD module** | **M13** — Pharmacy Operations Hub (PRD §8, v1.20.19) |
| **Route prefix** | `public/pharm-ops/` |
| **Menu label** | **Pharmacy Operations** (manager + pharmacist); **Advanced** → stock admin |
| **Config gate** | `enable_pharm_ops` (default `0`) |
| **Depends on** | `enable_pharmacy_role` = 1, `inhouse_pharmacy` ≠ 0 |

### 8.3 Personas & primary screens

| Persona | M9 Desk | M13 Hub |
|---------|---------|---------|
| **Dispensing pharmacist** | Active visit, dispense | Pending dispense all patients |
| **Store manager** | — | Receive stock, reorder report, catalog import |
| **Duty doctor** | — | (M4 only) — QOH hints when ops ON |
| **Cashier** | — | (M5) — sees dispensed lines on fee sheet |

### 8.4 Menu strategy (extends PRD §19)

When `enable_pharm_ops` = 1:

| Stock menu item | Clinic role | Replacement |
|-----------------|-------------|-------------|
| Inventory → Management | Hidden | M13 **Stock** tab + Advanced link |
| Inventory → Reports | Hidden | M13 **Reports** tab |
| Drugs → Add drug | Hidden | M13 Setup wizard + Advanced |
| Prescriptions (global) | Unchanged | Still per-patient via M9/MRD |

When `enable_pharm_ops` = 0 but `enable_pharmacy_role` = 1:

- M9 deep links to stock screens (pilot behavior).

---

## 9. Pharmacy Desk enhancements (M9)

Existing M9 scope preserved.

### 9.1 When `enable_pharm_ops` ON (V1.1-PHARM)

| ID | Enhancement | Phase |
|----|-------------|-------|
| M9-F16 | **Dispense** opens M13 slide-over (preferred) vs raw Rx edit dispense when hub ON | V1.1-PHARM |
| M9-F17 | Rx line badges: **In stock** / **Low** / **Out** from `drug_inventory` aggregate QOH | V1.1-PHARM |
| M9-F18 | **Undispensed Rx** count on queue card | V1.1-PHARM |
| M9-F19 | **Expiry warning** on active visit when selected lot near expiry | P2 |
| M9-F21 | **Block Pharmacy complete** when undispensed Rx remain on an in-house encounter; override via ACL `new_pharmacy_undispensed_override` + reason (**D-PHARM-5**; test PHARM-9) | V1.1-PHARM |

### 9.2 Print-only / community pharmacy (V1.1-PRINT-RX — D-PHARM-4)

| ID | Enhancement | Phase | Gate |
|----|-------------|-------|------|
| M9-F20 | **Print patient Rx** — PDF for community pharmacy; **no** in-house dispense | P1 (V1.1-PRINT-RX) | `enable_rx_print` = 1; `enable_pharmacy_role` = 1; **`enable_pharm_ops` may be 0**; `inhouse_pharmacy` may be 0 |

Doctor-only Type A clinics (`enable_pharmacy_role` = 0) use **M4-F38** on Doctor Desk instead of M9-F20.

Wireframes: PAGE_DESIGNS §7.6 (existing); M13 wireframes §10 below (normative when PRD/PAGE_DESIGNS integration lands).

---

## 10. Pharmacy Operations Hub (M13) — worklists & dispensing façade

### 10.1 Purpose

Answer: *“What must we dispense, receive, or reorder across the clinic today — without admin menus?”*

### 10.2 Hub layout — `pharm-ops/index.php`

```text
┌─ Pharmacy Operations ────────────────────────────────────────────────────┐
│ [ Pending dispense (9) ] [ Low stock (4) ] [ Receive ] [ Reports (P2) ]    │
│                              [ Sell OTC ]  [ ⚙ Setup ]                    │
├────────────────────────────────────────────────────────────────────────────┤
│ Filter: [ Today ▾ ] [ Urgent first ☑ ]                                   │
├────────────────────────────────────────────────────────────────────────────┤
│ ⚡ Q#7  Akua M.   Amoxicillin 500mg TID   ordered 10:02   not dispensed     │
│    Q#12 Kwame O.  Paracetamol 1g QID     partial (14/21)                  │
└────────────────────────────────────────────────────────────────────────────┘
```

**V1.1-PHARM tabs:** Pending dispense, Low stock, Receive (shortcut). **Reports** tab = **V1.2-PHARM** (M13-F08). **Model B (D-PHARM-3):** no separate verification queue — pharmacist verifies during dispense slide-over.

**Worklist scope (D-PHARM-6):** **Prescription rows only** — undispensed `prescriptions` for today. **OTC counter sales (M13-F04) do not appear** as worklist rows.

### 10.3 Row actions

| Action | Behavior |
|--------|----------|
| **Open in Pharmacy Desk** | If visit `ready_for_pharmacy`/`in_pharmacy` — `pharmacy.php?visit_id=` |
| **Dispense** | Open slide-over `pharm-ops/dispense.php?prescription_id=` |
| **Sell OTC** | Toolbar / Pharmacy Desk — M13-F04 counter sale (**not** a worklist row) |
| **Receive stock** | Navigate Receive wizard |
| **Open full chart** | MRD `#clinical-meds` new tab |

### 10.4 Dispense façade — `pharm-ops/dispense.php`

Replaces Rx edit **Save and Dispense** popup for `new_pharmacy` role when hub enabled:

```text
┌─ Dispense — Amoxicillin 500 mg ─────────────────────────────── [ × ] ─┐
│ Patient: Akua Mensah · MRN 00123 · Q#7 · Enc 22/06/2026               │
│ Prescribed: 500 mg PO TID × 7 days (21 caps)   Allergies: Penicillin ⚠ │
├──────────────────────────────────────────────────────────────────────────┤
│ QOH: 240 caps (3 lots)   FEFO lot: BN2026A  exp 12/2026                 │
│ Dispense qty: [ 21 ]     Supply type: [ Outpatient ▾ ]                  │
│ Fee:    [ 18.00 ]  (from fee schedule; editable)                  │
├──────────────────────────────────────────────────────────────────────────┤
│ [ Cancel ]                    [ Confirm dispense ]  (pharmacist ACL)      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Backend:** Calls `DrugSalesService::sellDrug()` — same as core. Writes `drug_sales` trans_type **sale**, links `prescription_id`, decrements `drug_inventory.on_hand`, audit `pharmacy_ops.dispensed`.

**Safety:** Confirm modal repeats Patient · MRN · Drug · Qty · Lot. Allergy cross-check chip if class match (routes to M9-F14 ack if not already recorded).

### 10.5 M13 functional requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| M13-F01 | **Pending dispense worklist** — undispensed `prescriptions` for facility today; urgent visits first; **excludes** OTC (D-PHARM-6) | P1 (V1.1-PHARM) |
| M13-F02 | **Dispense façade** over `DrugSalesService` with FEFO lot preview; fee auto-suggest (D-PHARM-5) | P1 |
| M13-F03 | **QOH badges** on worklist + M9 active panel + M4-F39 read-only hint | P1 |
| M13-F04 | **OTC / consumable sale** — Pharmacy Desk **Sell OTC** or hub toolbar; **no** `prescriptions` row; reception or pharmacist **Start visit** for encounter; **not** on worklist; ancillary OFF OK (D-PHARM-6) | P1 |
| M13-F05 | **Receive stock wizard** — purchase lot entry façade | P1 |
| M13-F06 | **Setup wizard** — warehouse + import OPD starter formulary CSV | P1 |
| M13-F07 | **Low-stock strip** — items at/below `reorder_point` | P1 |
| M13-F08 | **Reports façade** — wrap stock inventory reports | P2 (V1.2-PHARM) |
| M13-F09 | **Lot destruction** — guided write-off workflow | P2 |
| M13-F10 | **Print Rx pack** PDF — shared service (D-PHARM-4); not hub-gated | P1 (V1.1-PRINT-RX) |
| M13-F11 | **Expiring lots** report (≤90 days) | P2 |
| M13-F12 | Dispense KPI export for M7 | P3 |
| M13-F13 | **Menu cutover** — hide stock Inventory menus when hub ON | P1 |
| M13-F14 | **Partial dispense** — qty &lt; prescribed when short stock; worklist `partial (n/m)`; audit `pharmacy_ops.partial_dispensed` (O-PHARM-2 closed) | P1 |
| M13-F15 | **Dispense label** — post-dispense patient label PDF | P2 (V1.2-PHARM) |

### 10.6 OTC counter sale (M13-F04) — normative

| Rule | Detail |
|------|--------|
| **Who starts visit** | **Reception** or **pharmacist** may **Start visit** (standard OPD or pharmacy counter visit type) — creates `pid` + `encounter` |
| **Ancillary** | **Does not** require `enable_ancillary_services` = 1 |
| **Worklist** | **Does not** appear on M13-F01 pending tab |
| **UI entry** | Pharmacy Desk active panel **Sell OTC**; hub toolbar **Sell OTC** |
| **Stock** | `drug_sales` sale row via `DrugSalesService`; optional link to visit for billing |
| **vs walk-in** | `pharmacy_walkin` ancillary profile (M9-F07) is separate triage path — OTC at counter uses M13-F04 without ancillary |

### 10.7 Dispense verification — Model B (D-PHARM-3)

V1.1-PHARM uses **Model B** — pharmacist verifies drug, dose, and patient identity **during** the dispense slide-over (M13-F02). There is **no** separate “To verify” hub tab (contrast lab Model A draft/release in M12).

| Step | Verification |
|------|--------------|
| Open dispense | Banner shows patient identity + allergies |
| Confirm qty | FEFO lot preview; partial allowed when short (M13-F14) |
| Confirm | `pharm_ops.dispense_confirm` → audit `pharmacy_ops.dispensed` |

**M9 undispensed gate (D-PHARM-5):** M9-F21 blocks **Pharmacy complete** when undispensed Rx remain on an in-house encounter; override ACL `new_pharmacy_undispensed_override` + reason.

---

## 11. Formulary & clinic starter packs

### 11.1 Problem

`add_edit_drug.php` is admin-hostile. Clinics need **approved essentials** on day one.

### 11.2 Wizard (M13-F06)

| Step | Action |
|------|--------|
| 1 | Confirm `inhouse_pharmacy` level (drugs vs products) |
| 2 | Create default **warehouse** tied to facility |
| 3 | Import [samples/opd_formulary_starter.csv](../samples/opd_formulary_starter.csv) — creates `drugs` + `drug_templates` + `prices` |
| 4 | Map to `new_fee_schedule` fee schedule lines (M6) |
| 5 | Set reorder points in **units** (override `gbl_min_max_months` OFF for New Clinic sites — **M6-F26**) |

### 11.3 Catalog maintenance

| Task | V1.1 | Advanced |
|------|------|----------|
| Add new SKU | M13 **Add product** simplified form (name, strength, form, mapped price) | Stock `add_edit_drug.php` |
| Deactivate SKU | Toggle active in M13 | Stock admin |
| Update price | M6 fee schedule link | `prices` table |

**Do not** fork `drugs` schema for FDA reg in V1.1 — optional `new_drug_meta` table (PRD §12.1 pattern) for `fda_reg_no`, `eml_code` P2.

---

## 12. Receiving, lots & stock integrity

### 12.1 Receive wizard (M13-F05)

| Step | Fields |
|------|--------|
| Select product | Search `drugs` — barcode V3 |
| Lot | Lot/batch #, expiry, manufacturer |
| Quantity | Units received |
| Cost | Unit cost in clinic currency (optional margin report) |
| Document | Optional invoice photo `document_id` |

Writes **purchase** transaction via same logic as `add_edit_lot.php` trans_type 2.

### 12.2 Stock states (UI labels)

| UI label | Stock signal |
|----------|--------------|
| **In stock** | Sum `on_hand` > reorder_point |
| **Low** | `on_hand` ≤ reorder_point |
| **Out** | `on_hand` = 0 or no lots |
| **Expired** | All lots past expiration — block dispense |

### 12.3 Destruction (M13-F09 — P2)

- List lots past expiry or damaged
- Witness + method fields per `destroy_lot.php`
- Audit `pharmacy_ops.lot_destroyed`

---

## 13. External Rx, print-and-go & community pharmacy

### 13.1 Type A clinic — paper pad + system print (D-PHARM-4)

Most private OPD clinics in the launch region **do not stock medicine**. The doctor writes on a **paper prescription pad**; the patient buys at a community pharmacy. New Clinic supports this without enabling inventory or the operations hub.

| Clinic pattern | `inhouse_pharmacy` | `enable_pharm_ops` | `enable_pharmacy_role` | How Rx leaves the clinic |
|----------------|-------------------|--------------------|------------------------|--------------------------|
| **Doctor pad only** | 0 | 0 | 0 | Paper pad; optional **M4-F38** system print when `enable_rx_print` = 1 |
| **Doctor pad + system print** | 0 | 0 | 0 | Document Rx in EMR → **Print Rx** (M4-F38) — PDF with letterhead |
| **Pharmacist print-only** | 0 | 0 | 1 | M9 queue + **Print patient Rx** (M9-F20); no dispense |
| **In-house dispensary** | ≠ 0 | 0 or 1 | 1 | Dispense + optional print for send-out lines |

**Training:** *Paper pad is still valid. System print is for chart record, reprint, and a cleaner slip — not a requirement to run inventory.*

### 13.2 When clinic has no in-house stock

| Mode | Behavior |
|------|----------|
| **`inhouse_pharmacy` = 0** | No inventory menus; **Print Rx** when `enable_rx_print` = 1 |
| **Rx printed, patient buys outside** | `pharmacy_complete` or routing to payment after consult; **no** `drug_sales` |
| **Walk-in external Rx** | M9-F15 metadata; dispense only if clinic later stocks the drug |

### 13.3 Print Rx pack (M13-F10 — shared service)

**Gate:** `enable_rx_print` = 1 (default ON in cash clinic profile). **Does not** require `enable_pharm_ops`.

**Entry points:**

| Entry | Requirement | ID |
|-------|-------------|-----|
| Doctor Desk — active consult | `new_doctor`; encounter with ≥1 `prescriptions` row | **M4-F38** |
| Pharmacy Desk — active visit | `new_pharmacy`; same | **M9-F20** |
| Pharmacy Operations hub row | `new_pharm_ops` when hub ON | M13 hub **Print Rx** action |
| MRD Clinical meds strip | Optional overflow when hub ON | Same backend |

**Backend:** `pharm_ops.rx_print_pdf` — ACL `new_doctor` or `new_pharmacy` or `new_pharm_ops`; audit `pharmacy_ops.rx_printed`.

clinic-letterhead PDF:

- Patient name, age, sex, MRN
- Drug (generic **bold**, brand in parentheses per MoH labeling norm)
- Sig line, quantity, refills
- Prescriber name, reg #, clinic stamp
- Optional QR → clinic contact (not FHIR)

Distinct from **M11 referral letter** — do not merge templates.

---

## 14. eRx & vendor tools (out of V1 scope)

| Stock path | Relevance launch region V1 |
|------------|-------------------|
| `interface/eRx.php` (NewCrop/Ensora) | **Hidden** — US |
| `oe-module-weno` | **Hidden** unless diaspora clinic requests |
| `C_Pharmacy.class.php` | External pharmacy **directory** only |

**New Clinic stance:** Document in admin runbook; **no M13 dependency** on eRx.

---

## 15. Doctor prescribing & MRD integration

### 15.1 Doctor Desk

| Feature | Phase | Notes |
|---------|-------|-------|
| Stock Rx list / new Rx | V1 | M4 deep link — unchanged |
| **Print Rx** | V1.1-PRINT-RX | **M4-F38** — PDF for community pharmacy; `enable_rx_print` = 1; **no** inventory or hub required (D-PHARM-4) |
| **Formulary favorites** | V1.2-PHARM-RX | Quick prescribe from starter formulary pack — mirror deferred M4-F36 lab pattern |
| **QOH hint** on drug search | V1.1-PHARM | Read-only badge when `enable_pharm_ops` = 1 |

### 15.2 MRD Clinical `#clinical-meds`

| Strip | When |
|-------|------|
| **Meds summary** | Active Rx + key chart meds |
| **Last dispensed** | Latest `drug_sales` sale row |
| **Open in Pharm Ops** | When hub ON + ACL |

AJAX: `mrd.clinical_meds_summary` (mirrors `mrd.clinical_labs_summary`).

### 15.3 Overview feed

Extend MRD §8.6 enum:

| Event | Feed behavior |
|-------|---------------|
| `rx_prescribed` | Navigate → `#clinical-meds` (existing) |
| `pharmacy_dispensed` | **Expand inline** — drug, qty, lot summary |

---

## 16. Billing, fees & currency

| Rule | Detail |
|------|--------|
| **Cash V1** | `drug_sales.fee` in clinic currency; map via `prices` + `new_fee_schedule` |
| **Dispense → bill** | Fee sheet auto-line on dispense when configured |
| **OTC walk-in** | M5 cashier fee hints from visit type (§6.8.11) |
| **No NHIS split** | V1 — single cash column |
| **Receipt** | M5 shows drug lines from `drug_sales` join |

### 16.1 Currency display

- Hub fee hints, dispense totals, receive cost fields, and M5 cashier bridges use `formatMoney()` (M6-F27, D-REG-3)
- Changing clinic currency does not auto-convert fee schedule or stock cost values — manager reviews prices in M6

---

## 17. Navigation, ACL & admin runbook

### 17.1 ACL groups (PRD §4.4, D-STAFF-1)

| Group | Tier | Typical user assignment |
|-------|------|-------------------------|
| `new_pharmacy` | Counter staff | Dispense, allergy ack, Pharmacy Desk queue |
| `new_pharmacy_lead` | Supervisor | Stock receive, undispensed override, external Rx override |

**Solo clinic:** `pharm01` → **`new_pharmacy` + `new_pharmacy_lead`**. **Split clinic:** tech → `new_pharmacy` only; lead → both groups.

| ACL | Default groups | Audit event |
|-----|----------------|-------------|
| `new_pharm_ops` | `new_pharmacy`, `new_pharmacy_lead`, `new_admin` | hub access |
| `new_pharm_ops_dispense` | `new_pharmacy`, `new_pharmacy_lead` | `pharmacy_ops.dispensed` |
| `new_pharm_ops_receive` | **`new_pharmacy_lead`**, `new_admin` | `pharmacy_ops.stock_received` |
| `new_pharm_ops_catalog` | `new_admin` | `pharmacy_ops.formulary_imported` |
| `new_pharmacy_undispensed_override` | `new_pharmacy_lead`, `new_admin` | M9-F21 |
| `new_pharmacy_external_rx_override` | `new_pharmacy_lead`, `new_admin` | M9-F15 |

Existing M9 keys unchanged (`new_pharmacy`, `new_pharmacy_allergy_ack`, etc.).

### 17.2 Installer runbook (summary)

**Type A — print-only (no dispensary):**

1. Set `enable_pharmacy_role` per clinic (0 = doctor-only print path; 1 = pharmacy desk).
2. Leave `inhouse_pharmacy` = 0 and `enable_pharm_ops` = 0.
3. Set `enable_rx_print` = 1 (cash clinic profile default).
4. Train: document Rx in encounter → **Print Rx** (M4-F38) or paper pad; patient buys outside.
5. Runbook: [PRD §17.4.6](../NEW_CLINIC_V1_PRD.md#1746-print-rx-checklist-v11-print-rx--type-a).

**Type B — in-house dispensary (post-pilot hub):**

1. Enable `enable_pharmacy_role`; set `inhouse_pharmacy` if dispensary (M6-F25 validates pairing).
2. Run M13 setup wizard — warehouse + OPD starter formulary CSV.
3. Set `enable_pharm_ops` = 1 when ready for hub (V1.1-PHARM).
4. Map clinic-currency fees in M6.
5. Train: **Pharmacy Desk** queue + M13 **Pending dispense**.
6. **Do not** enable multi-warehouse until V3.

### 17.3 Config dependencies (PRD §6.8.7a)

| Rule | Behavior |
|------|----------|
| **Print Rx gate** | `enable_rx_print` = 1 enables M4-F38 / M9-F20 / `pharm_ops.rx_print_pdf`; **independent** of `enable_pharm_ops` (D-PHARM-4) |
| **Pharm ops gate** | `enable_pharm_ops` = 1 only when `enable_pharmacy_role` = 1 |
| **Inventory global** | `enable_pharm_ops` = 1 requires `inhouse_pharmacy` ≠ 0 |
| **Invalid save** | M6 rejects with operator message |

### 17.4 Audit events

| Event | Payload |
|-------|---------|
| `pharmacy_ops.dispensed` | prescription_id, drug_id, inventory_id, qty, visit_id |
| `pharmacy_ops.stock_received` | drug_id, lot, qty, document_id |
| `pharmacy_ops.formulary_imported` | imported_count |
| `pharmacy_ops.lot_destroyed` | inventory_id, witness, method |
| `pharmacy_ops.rx_printed` | prescription_id, encounter_id, actor (M13-F10 / M4-F38 / M9-F20) |
| `new_visit.pharmacy_allergy_ack` | (existing M9-F14) |

---

## 18. Data model & backend contracts

### 18.1 Optional metadata (PRD §12.1)

```sql
new_drug_meta (
  id, drug_id,
  fda_reg_no VARCHAR(32) NULL,
  eml_code VARCHAR(16) NULL,
  local_brand_name VARCHAR(128) NULL,
  created_at, updated_at
)
```

### 18.2 AJAX endpoints (PRD §13.1)

| Endpoint | Purpose |
|----------|---------|
| `pharm_ops.worklist` | Pending / low-stock tabs |
| `pharm_ops.dispense_get` | Rx + QOH + FEFO lot preview |
| `pharm_ops.dispense_confirm` | Wrap `DrugSalesService::sellDrug()` |
| `pharm_ops.receive_save` | Purchase lot |
| `pharm_ops.formulary_import` | CSV import |
| `pharm_ops.stock_summary` | QOH + reorder flags |
| `pharm_ops.rx_print_pdf` | Print Rx PDF — gate `enable_rx_print`; not hub-gated (D-PHARM-4) |
| `mrd.clinical_meds_summary` | MRD strip |

Envelope: PAGE_DESIGNS §6 JSON shape.

---

## 19. Phasing & PRD alignment

| Phase | Deliverable | Gate | Modules |
|-------|-------------|------|---------|
| **V1 pilot** | M9 queue + core Rx/inventory shortcuts | `enable_pharmacy_role` | M9 |
| **V1.1-ANC** | Pharmacy walk-in (existing) | `enable_ancillary_services` | M9-F07–F15 |
| **V1.1-PRINT-RX** | Print Rx PDF — doctor + pharmacy desk; Type A pad alternative | `enable_rx_print` = 1 | M13-F10, M4-F38, M9-F20 — **no** `enable_pharm_ops` |
| **V1.1-PHARM** | M13 hub: pending dispense, dispense façade, receive, formulary, OTC counter, partial dispense | `enable_pharm_ops` = 1 | M13-F01–F07, F13–F14, F04; M9-F16–F21; M4-F39 |
| **V1.2-PHARM** | Reports façade, destruction, expiry alerts | OPS flags | M13-F08–F09, F11 |
| **V1.2-PHARM-RX** | Doctor formulary quick prescribe (deferred) | `enable_pharm_rx_favorites` | M4-F37 |
| **V3.0** | Multi-branch inventory, barcode, country packs, wholesaler hooks | PRD §23 | M13-F12 + supply chain |

**Independence:** V1.1-PRINT-RX, V1.1-PHARM, and V1.1-ANC are **separate** slices (PRD §20.1, D36). Type A clinics may ship **V1.1-PRINT-RX only** with hub OFF.

**CI tags:** `@new-clinic-v11-print-rx` (PHARM-8); `@new-clinic-v11-pharm` (PHARM-1–7, PHARM-9–10).

**Relationship to PRD V3.0:** *“Multi-branch, inventory, WA country packs”* — M13 is the **module anchor** for that milestone, not M9.

---

## 20. Acceptance criteria

1. Pharmacist **dispenses Amoxicillin 21 caps** from M13 slide-over without Rx edit popup; `drug_sales` row + QOH decrement.
2. **Pending dispense** lists undispensed **prescription** rows for today; urgent visits first; **no** OTC counter rows (D-PHARM-6).
3. M13 wizard imports OPD starter formulary (≥10 products) + clinic-currency fee mapping.
4. **Receive** 100 caps Paracetamol lot → `on_hand` increases; audit `pharmacy_ops.stock_received`.
5. M9 card shows **undispensed count** + **Low/Out** badge when hub ON.
6. **Menu cutover:** stock Inventory hidden for Clinic roles; M13 hub + Advanced for admin.
7. M6 rejects `enable_pharm_ops` without `enable_pharmacy_role` / `inhouse_pharmacy`.
8. With `enable_pharm_ops` = 0, M9 **Open core Rx** unchanged (PHARM-5 regression).
9. **Print Rx pack** PDF shows Patient · MRN · generic name · prescriber block.
10. Walk-in **allergy gate** and **external Rx validation** still enforced (M9-F11, F15).
11. **Pharmacy complete** blocked when undispensed Rx on in-house encounter; override works (M9-F21, PHARM-9).
12. **Sell OTC** from desk toolbar — `drug_sales` without `prescriptions` row; not on hub worklist (M13-F04, PHARM-10).
13. **Partial dispense** when QOH short — worklist shows `partial (n/m)` (M13-F14).
14. Doctor **Prescribe** shows read-only QOH badge when hub ON (M4-F39).
15. Ancillary **pharmacy-direct** visit with a same-day OPD appointment surfaces as **EX-07** (informational) in the Queue Bridge Hub (M18-F15) — staff dismiss per D-BRIDGE-9 (see SCHEDULING_QUEUE_BOUNDARY §9.2).

---

## 21. Open questions

| ID | Question | Owner | Leaning |
|----|----------|-------|---------|
| O-PHARM-1 | Require lot # on every receive? | Pharmacy lead | Optional V1.1; required V1.2 |
| O-PHARM-2 | Allow dispense when QOH insufficient (partial)? | Clinical | **Closed:** M13-F14 partial dispense + worklist `partial (n/m)` |
| O-PHARM-3 | M13 submodule vs fold into M9? | Engineering | **Closed D63:** M13 separate (`pharm-ops/`) — mirrors M12 |
| O-PHARM-4 | Auto-post fee on dispense vs cashier manual? | Finance | **Closed D-PHARM-5:** auto-suggest line; cashier confirms |
| O-PHARM-5 | Controlled drugs register? | Regulatory | P2 — simple log; national controlled-substances schedule alignment TBD |
| O-PHARM-6 | Integrate mPharma / Mutti franchise APIs? | Product | V3 partner track |
| O-PHARM-7 | Therapeutic substitution at dispense? | Clinical | P3 — out of V1.1-PHARM |

---

## 22. Document history

| Version | Date | Changes |
|---------|------|---------|
| 0.1.9 | 2026-06-24 | **Consistency audit fixes** — added formal **M9-F21** row to §9.1 enhancements table (block Pharmacy complete on undispensed Rx, D-PHARM-5 — previously only referenced in ACL/phasing/tests); added EX-07/M18-F15 cross-ref (§20 item 15) |
| 0.1.8 | 2026-06-22 | Hygiene pass — §8 title; companion sync PRD v1.20.29 / USER_WORKFLOWS v1.9.34 |
| 0.1.7 | 2026-06-22 | **D-STAFF-1** — §17.1 `new_pharmacy` / `new_pharmacy_lead`; receive lead-only; PRD v1.20.25 |
| 0.1.6 | 2026-06-22 | **D-REG-3** — clinic currency via M6; `formatMoney()`; §16 billing |
| 0.1.5 | 2026-06-22 | **D-REG-2** — country-neutral naming; OPD starter formulary; `enable_rx_print`; `opd_formulary_starter.csv` |
| 0.1.4 | 2026-06-22 | Pharmacy audit pass — **D-PHARM-3/5/6**; M9-F21; M13-F14 partial; M13-F04 OTC rules; §10.6–§10.7; scrub “proposed”; close O-PHARM-2/4 |
| 0.1.3 | 2026-06-22 | **D-PHARM-4** Type A print-only — `enable_rx_print`; M4-F38; M9-F20 / M13-F10 decoupled from hub; §13 Type A table; **V1.1-PRINT-RX** slice; §17.4.6 runbook cross-ref |
| 0.1.2 | 2026-06-22 | Integration cleanup — PRD alignment note post-integration; companion version sync; M13 no longer “proposed” |
| 0.1.1 | 2026-06-22 | Doc-suite integration — PRD M13 §8; PAGE_DESIGNS §7.21–§7.24; USER_WORKFLOWS §8.4c/§14.6; MRD §8.10.5; D63 closed |
| 0.1.0 | 2026-06-22 | Initial comprehensive spec — D-PHARM-1 two-layer model; M13 hub; stock pain points; regional context; phasing through V3 |

---

## Appendix A — Stock file map

| Path | Role |
|------|------|
| `interface/drugs/drug_inventory.php` | Inventory browser |
| `interface/drugs/add_edit_drug.php` | Drug master |
| `interface/drugs/add_edit_lot.php` | Lot transactions |
| `interface/drugs/dispense_drug.php` | Label popup |
| `interface/drugs/destroy_lot.php` | Destruction |
| `interface/drugs/drugs.inc.php` | Shared helpers |
| `interface/reports/inventory_list.php` | Reorder report |
| `interface/reports/inventory_activity.php` | Activity summary |
| `interface/reports/inventory_transactions.php` | Transaction ledger |
| `interface/reports/prescriptions_report.php` | Rx vs dispense |
| `controller.php?prescription` | Rx list/edit |
| `controllers/C_Prescription.class.php` | Rx controller |
| `src/Services/DrugSalesService.php` | Dispense/stock service |
| `src/Services/DrugService.php` | Drug search API |
| `src/Services/PrescriptionService.php` | Prescription service |
| `templates/prescription/*` | Rx Twig UI |
| `interface/eRx.php` | US eRx (hidden V1) |
| `oe-module-weno` | Weno eRx module |

---

## Appendix B — User stories

| ID | As a… | I want to… | So that… | Phase |
|----|--------|------------|----------|-------|
| US-PHARM-1 | Pharmacist | see all pending dispenses for today in one list | I do not miss a patient who left the waiting area | V1.1-PHARM |
| US-PHARM-2 | Pharmacist | dispense from a tablet-friendly screen | the counter line moves faster | V1.1-PHARM |
| US-PHARM-3 | Store manager | receive a supplier delivery without legacy popups | stock matches physical shelves | V1.1-PHARM |
| US-PHARM-4 | Manager | load a OPD starter formulary without super-admin | go-live is not blocked | V1.1-PHARM |
| US-PHARM-5 | Doctor | see if a drug is in stock when prescribing | patients are not sent to an empty shelf | V1.1-PHARM |
| US-PHARM-6 | Pharmacist | print a clear Rx for community pharmacy | the patient can buy medicine outside | V1.1-PHARM |
| US-PHARM-7 | Owner | know what is low or expiring | I order before stockouts | V1.2 |
| US-PHARM-8 | IT installer | follow a runbook for dispensary vs print-only | I do not enable inventory by mistake | V1.1 |

---

## Appendix C — Competitive reference matrix

| Capability | Epic / Cerner | athena | OpenMRS dispense | **New Clinic M13** |
|------------|---------------|--------|------------------|-------------------|
| Pharmacy work queue | Yes | Yes | App-level | **M13-F01** |
| In-formulary prescribing | Yes | Yes | Manual | **V1.2-PHARM-RX** |
| QOH at prescribe | Hospital | Limited | Sometimes | **M13-F03** |
| FEFO dispensing | Yes | Yes | Varies | **DrugSalesService** |
| Receiving / lots | Yes | Inventory module | Yes | **M13-F05** |
| Barcode BCMA | Yes | Add-on | Plugin | **V3** |
| Print Rx only mode | Yes | Yes | Yes | **M4-F38 + M9-F20** (V1.1-PRINT-RX); hub optional |
| Essential medicines list seed | No | No | Local impl | **M13-F06** |
| Cash/MoMo clinic | Varies | Varies | Varies | **M5 cash** |

---

*End of document.*

# Billing & AR Back Office — Redesign Specification

| Field | Value |
|-------|--------|
| **Document version** | 0.1.3 |
| **Status** | Draft for review — **Module M14** integrated in PRD v1.20.29; **M5 Cashier** remains V1 golden-path payment; D-BILL-1 **closed**; O-BILL-1–4 **closed**; O-BILL-5 **open** (PRD §24.2) |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](../NEW_CLINIC_V1_PRD.md) (v1.20.29), [NEW_CLINIC_V1_PAGE_DESIGNS.md](../NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.34), [NEW_CLINIC_V1_USER_WORKFLOWS.md](../NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.34), [NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md) (v0.1.7), [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](../MEDICAL_RECORD_DASHBOARD_REDESIGN.md) (v0.2.28) |
| **Audience** | Product, design, billing leads, clinic owners, implementers, QA |
| **Scope** | Everything **beyond M5 same-day cash checkout** — charge corrections, payment search/edit, daysheet, simplified outstanding balances, and **admin-only** insurance/EDI backlog — without forking OpenEMR `billing` / `ar_*` tables |
| **Implementation** | Design only — no code in this document |
| **Primary market** | Private outpatient clinics — **West Africa** (V1 launch region) |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Gap analysis — what M5, M7, and M11 already cover](#2-gap-analysis--what-m5-m7-and-m11-already-cover)
3. [Current-state snapshot (stock OpenEMR)](#3-current-state-snapshot-stock-openemr)
4. [Pain points by surface](#4-pain-points-by-surface)
5. [UI/UX principles for billing back office](#5-uiux-principles-for-billing-back-office)
6. [How leading EHRs address these needs](#6-how-leading-ehrs-address-these-needs)
7. [West Africa context](#7-west-africa-context)
8. [Information architecture](#8-information-architecture)
9. [Charge corrections façade (M14-F01)](#9-charge-corrections-façade-m14-f01)
10. [Payment search & adjustment (M14-F02)](#10-payment-search--adjustment-m14-f02)
11. [Daysheet & cash close (M14-F03)](#11-daysheet--cash-close-m14-f03)
12. [Outstanding balances — simplified (M14-F04)](#12-outstanding-balances--simplified-m14-f04)
13. [Insurance backlog gateway (M14-F05)](#13-insurance-backlog-gateway-m14-f05)
14. [POS & batch payment policy](#14-pos--batch-payment-policy)
15. [Navigation, ACL & menu cutover](#15-navigation-acl--menu-cutover)
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

New Clinic **V1 Module M5 (Cashier)** is deliberately narrow: a **visit payment queue** for `ready_for_payment` — fee schedule picker, cash tender, receipt, FSM → `completed`. It posts to core AR via **`CashCheckoutService`** (PRD §M5.2) and does **not** replace OpenEMR’s billing engine.

That is correct for **pilot week 1** when private OPD clinics collect **cash at the window** and rarely touch insurance menus. It is **insufficient** when:

- A manager must **correct charges** after payment without opening a 1,600-line fee sheet
- Finance staff must **find and void/repost** a payment from yesterday
- The owner needs a **daysheet** that matches M7 reconciliation and the physical cash drawer
- A clinic runs **tab/credit** patients (owe the clinic) — common in the region but **not** the V1 golden path
- A site with **legacy insurance backlog** still needs ERA/EDI tools — hidden from daily roles but not deleted

This spec defines **Billing Back Office (M14)** — the operational layer around stock OpenEMR AR tables — aligned with New Clinic IA, cash clinic profile (PRD §19), admin-configurable currency (D-REG-3), and West Africa practice patterns.

### 1.2 Problem statement

> A cashier completes today’s visits on the New Clinic desk, but when the owner asks “how much did we collect yesterday?” or “this patient was undercharged — add a line,” staff fall back to stock **Fees** menus: Billing Manager built for US claims, **Fee Sheet** with insurance columns, **Collections** reports with “Due Ins” buckets, and EDI screens scattered under **Reports**. None of these match a 1–2 person private clinic in the launch region that runs **cash-first** and needs **five clear back-office actions**, not forty menu items.

### 1.3 Positioning vs other surfaces

| Surface | Question it answers | Relationship to M14 |
|---------|---------------------|---------------------|
| **Cashier (M5)** | “Who must pay **right now** for this visit?” | **Primary** payment posting; M14 never duplicates queue |
| **M7 Daily Reports** | “How did the **clinic** perform today?” | Aggregate; M14-F03 daysheet **feeds** M7-F10 reconciliation |
| **Chart Depth payments (M11)** | “What did **this patient** pay over time?” | **Per-patient read** + receipt reprint; M14 handles **write** corrections |
| **M6 Clinic Admin** | “What are our prices and currency?” | Fee schedule source; M14 uses M6 codes for corrections |
| **Billing Back Office (M14)** | “Fix money mistakes, close the day, chase balances, clear insurance backlog” | **Clinic-wide** finance ops — not visit FSM |

**Training one-liner:** *Cashier for today’s queue; chart depth for patient history; back office for corrections and close-of-day.*

**Design decision (closed D-BILL-1):** M5 = **visit cash checkout** (unchanged). M11 = **patient financial depth** (read-heavy). M14 = **billing back office hub** — analogous to M12 Lab Ops / M13 Pharm Ops. Normative PRD: §8 Module M14, §4.4 ACL, §12.4 config, §13.1 `bill_ops.*`, §21.1u, §17.4.7 runbook.

---

## 2. Gap analysis — what M5, M7, and M11 already cover

| Capability | M5 Cashier (V1) | M7 Reports | M11 Chart Depth | M14 gap |
|------------|-----------------|------------|-----------------|---------|
| `ready_for_payment` queue | Yes | — | — | — |
| Fee schedule charge picker | Yes (M6) | — | — | — |
| Cash post + receipt | Yes (`CashCheckoutService`) | — | Reprint (CDa) | — |
| Idempotent payment | Yes (`client_request_id`) | — | — | — |
| Daily cash summary | — | Yes (M7-F01) | — | Daysheet detail (F03) |
| AR reconciliation | — | Yes (M7-F10) | — | Drill-down to receipts (F03) |
| Per-patient payment timeline | — | — | Yes (M11-F01) | — |
| Post-payment charge add/remove | M5-F10 deep link only | — | Read-only | **Façade (F01)** |
| Payment search / edit | — | — | — | **F02** |
| Outstanding / aging list | — | Exception report (M7-F14) | — | **Simplified F04** (distinct — see D-BILL-4) |
| Billing Manager / X12 / HCFA | Hidden (§19) | — | — | **Admin gateway (F05)** |
| Batch family payment | — | — | — | **Policy §14** (V1.2 optional) |
| POS popup checkout | — | — | — | **Deprecated for Clinic roles** |

**Conclusion:** M5 solves **collect at checkout**. M11 solves **show patient money history**. M14 solves **how the clinic runs finance after the queue** without US claim-generation UX.

---

## 3. Current-state snapshot (stock OpenEMR)

Audited against OpenEMR 7.x tree in this workspace (line counts from source).

### 3.1 Billing Manager & claim pipeline

| Path | Lines (approx.) | Role |
|------|----------------:|------|
| `interface/billing/billing_report.php` | 1,372 | Claim search, batch select, X12/HCFA/UB04 |
| `interface/billing/billing_process.php` | 60 | Delegates to `BillingProcessor` |
| `src/Billing/BillingReport.php` | 284 | Query builder |
| `src/Billing/Claim.php` | 1,605 | Claim object |
| `src/Billing/BillingUtilities.php` | 1,928 | `addBilling`, AR helpers |

**ACL:** `acct/eob` write OR `acct/bill` write.

### 3.2 Fee sheet (charge editor)

| Path | Lines (approx.) | Role |
|------|----------------:|------|
| `interface/forms/fee_sheet/new.php` | 1,673 | Main charge UI |
| `library/FeeSheet.class.php` | 1,450 | Save to `billing` / `drug_sales` |
| `library/FeeSheetHtml.class.php` | — | HTML layer |

Opened from **Fees → Fee Sheet** with active encounter; ACL `encounters/coding` / form ACL.

### 3.3 Cashier / payment entry

| Path | Lines (approx.) | Role |
|------|----------------:|------|
| `interface/patient_file/front_payment.php` | 1,738 | Record payment — cash, copay, invoice, CC |
| `library/payment.inc.php` | 270 | `frontPayment()` → `payments` only |
| `interface/patient_file/pos_checkout_normal.php` | 1,169 | POS popup checkout |
| `interface/patient_file/pos_checkout.php` | 12 | Routes to normal vs IPPF |

**Normative cash path for New Clinic:** `front_payment.php` cash branch → `ar_session` + `ar_activity` (PP) + `payments` + `billing.billed=1` (PRD §M5.2).

### 3.4 Collections, ledger, reports

| Path | Lines (approx.) | Role |
|------|----------------:|------|
| `interface/reports/collections_report.php` | 1,325 | Aging — Due Ins / Due Pt / All |
| `interface/reports/pat_ledger.php` | 875 | Patient ledger |
| `interface/billing/new_payment.php` | 380 | Batch payment entry |
| `interface/billing/edit_payment.php` | 1,011 | Edit posted payments |
| `interface/billing/search_payments.php` | 567 | Payment search |

### 3.5 EDI / ERA / eligibility

| Path | Lines (approx.) | Role |
|------|----------------:|------|
| `interface/billing/edi_270.php` | 414 | Batch 270 eligibility |
| `interface/billing/edi_271.php` | 172 | 271 upload |
| `interface/billing/era_payments.php` | 333 | ERA (835) posting |
| `interface/billing/sl_eob_search.php` | 1,260 | EOB search |
| `src/Billing/ParseERA.php` | 507 | 835 parser |
| `src/Billing/EDI270.php` | 1,069 | 270 generator |

### 3.6 Menu placement (`interface/main/tabs/menu/menus/standard.json`)

Under **Fees** (when `enable_fees_in_left_menu`): Fee Sheet, Charges, Payment (`front_payment.php`), Checkout (`pos_checkout.php`), Billing Manager, batch/posting/EDI children.

**New Clinic today:** PRD §19 + `MenuEvent::MENU_RESTRICT` hides insurance/EDI/claims for clinic roles; M5 not yet implemented (`oe-module-new-clinic` stub).

---

## 4. Pain points by surface

### 4.1 Billing Manager (`billing_report.php`)

| Pain | Impact (West Africa private OPD) |
|------|----------------------------------|
| US claim centric (X12, CMS-1500, UB-04, `bill_process` states) | Irrelevant for cash clinic; confuses trainers |
| 1,300+ line monolith | High training cost; error-prone batch selection |
| Mixed with daily cash workflow under **Fees** | Cashier lands in wrong screen |
| Partner / clearinghouse assumptions | No local payer rails in V1 |

### 4.2 Fee sheet (`fee_sheet/new.php`)

| Pain | Impact |
|------|--------|
| 1,600+ lines; justification, modifiers, price levels | Overkill for “add one missed consult line” |
| Insurance columns, copay, `billed` flags | Noise when `enable_insurance = false` |
| Encounter-session coupling | No `visit_id` / queue context |
| Separate from visit payment queue | Staff post charges in one place, pay in another |

### 4.3 `front_payment.php` / POS checkout

| Pain | Impact |
|------|--------|
| Multi-mode form (cash, copay, invoice, card gateways) | Cashier sees US payment types |
| No visit queue / confirm modal contract | Wrong-patient payment risk (G12) |
| No module receipt numbering / idempotency | Double-post on retry |
| `pos_checkout_normal.php` parallel path | Two checkout mental models |

### 4.4 Collections & ledger

| Pain | Impact |
|------|--------|
| **Due Ins** / policy# / SSN columns | Meaningless for cash clinic |
| Report-first UI (not task-based) | Manager exports CSV instead of calling patient |
| `acct/rep` / `acct/rep_a` too broad | Reception sees ledger by accident |
| Desktop tables | Poor on tablet at owner’s desk |

### 4.5 EDI / ERA / eligibility

| Pain | Impact |
|------|--------|
| X12 vocabulary | Requires US-billing-trained admin |
| Scattered menus (Fees vs Reports) | Hard to find when legacy backlog exists |
| Eligibility under `patients/demo` ACL | Wrong role mapping |

### 4.6 Cross-cutting

```text
Stock OpenEMR billing assumes:
  insurance primary → patient secondary → complex fee sheet → claim batch → ERA post

New Clinic assumes:
  visit queue → fee schedule → cash checkout → receipt → daily reconcile
  (insurance optional backlog in admin vault only)
```

---

## 5. UI/UX principles for billing back office

Aligned with PRD §10 and Chart Depth §5.

| # | Principle | M14 application |
|---|-----------|-----------------|
| P1 | **Cash truth** | Labels: “Balance due”, “Paid today”, “Owed to clinic” — never “Insurance pending” when insurance OFF |
| P2 | **Tasks over menus** | Hub tabs: **Corrections · Payments · Close day · Outstanding · Admin** — not 31 PHP files |
| P3 | **Progressive disclosure** | Default: today + this facility; expand to date range / advanced |
| P4 | **Identity on every write** | Modals repeat **Patient · MRN · Visit # · Receipt #** (G12 family) |
| P5 | **Reason + audit on override** | Charge reversal, payment void, credit write-off require reason |
| P6 | **No parallel ledger** | All writes go through core `billing` / `ar_*` / `payments` — same as §M5.2 |
| P7 | **Role-appropriate depth** | Cashier → M5 only; manager → M14; admin → M14 + insurance vault |
| P8 | **Mobile-tolerant** | Owner desk may be tablet; tables collapse to cards ≤768px |
| P9 | **Currency from M6** | All amounts via `formatMoney()` (D-REG-3) |
| P10 | **Advanced = gated link** | Stock screen behind **Advanced (OpenEMR)** with warning banner — not daily path |

---

## 6. How leading EHRs address these needs

Patterns observed in mature ambulatory EHRs (Epic, Cerner ambulatory, athenahealth, OpenMRS/Bahmni, regional private-clinic SaaS). **Not** a feature parity checklist — a UX pattern library.

| Need | Typical pattern | New Clinic mapping |
|------|-----------------|-------------------|
| **Front-desk checkout** | POS-style “amount due → tender → receipt” | **M5 Cashier** |
| **Patient account history** | Ledger tab on chart — charges/payments timeline | **M11 Payment history** |
| **Charge capture at checkout** | Order-driven charges + fee catalog picker | M5 + M6 (not full fee sheet) |
| **Post-visit charge correction** | “Add charge” wizard with supervisor PIN | **M14-F01** (limited lines) |
| **Payment inquiry** | Search by receipt #, date, patient | **M14-F02** |
| **End-of-day** | Cash drawer reconciliation vs system totals | **M14-F03** + M7-F10 |
| **A/R aging** | Buckets 0–30 / 31–60 days | **M14-F04 simplified** (optional V1.2) |
| **Insurance claims** | Separate **Revenue Cycle** module | **M14-F05 vault** — off golden path |
| **Patient balance on banner** | Single “balance due” chip | MRD + M5 queue (PRD §19) |

**Regional private-clinic SaaS (West Africa):** Often **visit-priced packages**, **MoMo as payment method label**, **no integrated NHIS claims in OPD tier** — aligns with PRD NG1/NG9 and M14 scope.

---

## 7. West Africa context

### 7.1 Payment reality

| Topic | V1 / M14 stance |
|-------|-----------------|
| **Cash** | Primary; M5 tender UI |
| **Mobile money** | Label on receipt / daysheet only (NG9 — no API) |
| **Card** | Hidden in cash clinic profile |
| **NHIS / private insurance** | Profile reference optional; **no claims** in V1 (NG1) |
| **Currency** | One clinic currency in M6 (D-REG-3) — GHS, NGN, XOF, etc. |
| **VAT / TIN** | Receipt footer config (M5); daysheet tax column optional P2 |

### 7.2 Credit / “tab” patients

Common in neighborhood clinics: patient leaves owing; pays later. PRD **NG2** excludes credit as **primary V1 workflow**, but owners ask for it.

**M14-F04 (optional V1.2):** “Owed to clinic” list — patients with `closed_unpaid` visits or positive AR balance — **call list**, not US collections with insurer buckets.

**Not in V1:** automated SMS reminders, credit limits, interest.

### 7.3 Staffing

| Role | M14 usage |
|------|-----------|
| Owner / manager | Close day, outstanding list, payment search |
| Senior cashier (`new_cashier_lead`) | Charge corrections with reason |
| Clinic admin | Insurance vault if `enable_insurance` |
| Reception / nurse | **No** M14 — M5 or MRD only |

### 7.4 Compliance & audit

- Every M14 write: `EventAuditLogger` + structured JSON (PRD §9).
- National ID redaction on exports (SEC10).
- No silent delete of `billing` rows — soft-delete / adjustment pattern per `BillingUtilities`.

---

## 8. Information architecture

### 8.1 Three-layer money model (closed — D-BILL-1)

```text
Layer 1 — FLOOR (V1 P0)     M5 Cashier          Visit queue payment
Layer 2 — CHART (V1.1-CDa)  M11 Chart Depth     Patient payment history (read)
Layer 3 — OFFICE (V1.2-BILL) M14 Back Office    Corrections, search, close, credit, admin EDI
```

### 8.2 M14 hub — route & tabs

**Route:** `/interface/modules/custom_modules/oe-module-new-clinic/public/bill-ops/index.php`

**Gate:** `enable_bill_ops` (default **0** at install; post-pilot opt-in)

| Tab | F-ID | Primary user |
|-----|------|--------------|
| **Corrections** | M14-F01 | `new_cashier_lead`, `new_admin` |
| **Payments** | M14-F02 | `new_cashier_lead`, `new_admin` |
| **Close day** | M14-F03 | Manager, `new_admin` |
| **Outstanding** | M14-F04 | Manager (when enabled) |
| **Insurance vault** | M14-F05 | `new_admin` only — visible when `enable_insurance` |

```text
┌─ Billing back office ─────────────────────────────────────────────────────┐
│ [ Corrections ] [ Payments ] [ Close day ] [ Outstanding ] [ Insurance* ] │
├───────────────────────────────────────────────────────────────────────────┤
│  (tab content — visit-scoped or date-scoped)                              │
│                                                                           │
│  Footer: Advanced → stock OpenEMR (fee sheet / billing report) ⚠        │
└───────────────────────────────────────────────────────────────────────────┘
  * Insurance vault tab hidden when enable_insurance = false
```

### 8.3 Menu cutover (extends PRD §19)

When `enable_bill_ops` = 1:

| Stock menu (Fees) | Clinic roles | `new_admin` |
|-------------------|--------------|-------------|
| Fee Sheet | Hidden | Advanced link from M14 |
| Payment / Checkout | Hidden | M5 + M14 |
| Billing Manager | Hidden | M14 Insurance vault → Advanced |
| Batch / Posting / EDI | Hidden | M14-F05 gateway |

---

## 9. Charge corrections façade (M14-F01)

### 9.1 Purpose

Allow **supervised** post-payment charge fixes without full fee sheet — e.g. missed injection fee, wrong quantity.

### 9.2 Entry

- M14 **Corrections** tab: search **Visit #**, **MRN**, or **date**
- M11 Payment history: **Add correction** link (manager only) → opens M14 slide-over with visit pre-filled

### 9.3 UI (wireframe)

```text
┌─ Charge correction — Visit #1042 ─────────────────────────── [ × ] ─┐
│ [patient-context-banner]  State: completed · Paid 18/06/2026        │
├──────────────────────────────────────────────────────────────────────┤
│ EXISTING CHARGES (read-only)                                        │
│   Consultation OPD          200.00                                  │
│   FBC panel                  80.00                                  │
├──────────────────────────────────────────────────────────────────────┤
│ ADD LINE                                                            │
│   Fee schedule [ Injection — IM ▾ ]  Qty [1]  Price [ 25.00 ]      │
│   OR [ Advanced fee sheet → ] (admin only)                          │
├──────────────────────────────────────────────────────────────────────┤
│ REMOVE LINE (supervisor)                                            │
│   [ ] FBC panel  80.00  — requires reason                           │
├──────────────────────────────────────────────────────────────────────┤
│ Reason (required): [________________________________]               │
│ [ Cancel ]                                    [ Save correction ]     │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.4 Rules

| Rule | Detail |
|------|--------|
| ACL | `new_bill_ops_correct` → `new_cashier_lead`, `new_admin` |
| Backend | `BillingUtilities::addBilling` / soft-delete per core rules |
| Receipt | Does **not** auto-reprint; cashier uses M11 reprint or M5 |
| Balance | If visit `completed` and new charges &gt; paid → create **outstanding** flag for F04 |
| Audit | `bill_ops.charge_corrected` with before/after JSON |

### 9.5 Stock mapping

| Stock | M14 |
|-------|-----|
| `fee_sheet/new.php` full editor | **Advanced** link only |
| M5-F10 “Advanced billing” | Redirect to M14-F01 when `enable_bill_ops` = 1 |

---

## 10. Payment search & adjustment (M14-F02)

### 10.1 Purpose

Find a payment by **receipt #**, **patient**, **date**, or **cashier**; view detail; **void/reverse** with supervisor reason (wrap `search_payments.php` / `edit_payment.php` patterns).

### 10.2 UI

```text
┌─ Payments ─────────────────────────────────────────────────────────────┐
│ Search: [ Receipt # / MRN / name ]   Date [ Today ▾ ]  [ Search ]      │
├────────────────────────────────────────────────────────────────────────┤
│ #1042  18/06/2026  Kofi A.   280.00  Cash  Akosua   Visit #1042      │
│ #1041  18/06/2026  …                                                         │
├────────────────────────────────────────────────────────────────────────┤
│ DETAIL (selected)                                                       │
│   Linked: new_receipt.id=…  payments.id=…  ar_session.id=…             │
│   [ Reprint receipt ]  [ Reverse payment ] (reason required)             │
└────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Rules

| Rule | Detail |
|------|--------|
| ACL | `new_bill_ops_payment` → `new_cashier_lead`, `new_admin` |
| Reverse | Creates offsetting `ar_activity`; does not delete rows |
| Idempotency | Cannot reverse twice — show prior reversal |
| Visit FSM | Reversal on `completed` visit may set `ready_for_payment` if balance &gt; 0 (config) |

---

## 11. Daysheet & cash close (M14-F03)

### 11.1 Purpose

Manager **close-of-day** view: receipts issued, cash total, comparison to M7 reconciliation status — replaces hunting `print_daysheet_report_*.php` for cash clinics.

### 11.2 UI

```text
┌─ Close day — 18/06/2026 — Main clinic ────────────────────────────────┐
│ Receipts issued: 47    Voided: 0    No-charge closes: 2               │
│ Cash collected:     12,450.00                                       │
│ MoMo (label only):   1,200.00    (manual tally field, optional)      │
│ Reconciliation:     ✓ OK (M7-F10)   last run 18:05                    │
│ [ Run reconciliation now ]  [ Export CSV ]  [ Print daysheet ]        │
├────────────────────────────────────────────────────────────────────────┤
│ By cashier: Akosua 8,200.00 · Kofi 4,250.00                          │
│ By visit type: OPD 82% · Lab-direct 12% · …                           │
└────────────────────────────────────────────────────────────────────────┘
```

### 11.3 Data sources

| Metric | Source |
|--------|--------|
| Receipt totals | `new_receipt` WHERE `receipt_date` = day |
| Core AR | `ar_session` / `payments` joined via `posted_payment_id` |
| Reconciliation | `new_reconciliation_run` (M7-F10) |
| Excluded | `closed_no_charge=1` receipts per M5-F12 |

---

## 12. Outstanding balances — simplified (M14-F04)

### 12.1 Purpose

**NG2** says collections is not primary V1 — but managers need a **short list** of who owes money after `closed_unpaid` or underpayment.

### 12.2 Scope (V1.2 optional)

| In scope | Out of scope |
|----------|----------------|
| List patients with balance &gt; 0 | US “Due Ins” aging |
| Age buckets: 0–7 / 8–30 / 31+ days | Automated dialer / SMS |
| Link to M11 payment history | Legal collections workflow |
| Mark “contacted” note | Interest / finance charges |

### 12.3 UI sketch

```text
Outstanding — 12 patients — Total owed: 3,420.00
[ Patient ] [ Phone ] [ Owed ] [ Since ] [ Last note ] [ Open chart ]
```

**ACL:** `new_bill_ops_outstanding` → `new_admin`, manager mapping via `new_admin` or future `new_manager` group.

---

## 13. Insurance backlog gateway (M14-F05)

### 13.1 Purpose

When `enable_insurance = true` (non-default), clinic may still have **legacy claims or ERA files**. NG3 excludes insurance from **golden path** — not from **admin vault**.

### 13.2 UI

Single **Insurance vault** tab with cards:

| Card | Stock target | When shown |
|------|--------------|------------|
| Billing Manager | `billing_report.php` | `enable_insurance` |
| ERA upload | `era_payments.php` | Same |
| EOB posting | `sl_eob_search.php` | Same |
| Eligibility 270/271 | `edi_270.php`, `edi_271.php` | Same |
| EDI history | `edih_view.php` | `enable_edihistory_in_left_menu` |

Each opens in **new tab** with banner: *“Legacy US billing tool — not used for daily cash workflow.”*

**ACL:** `new_bill_ops_insurance` → `new_admin` only.

---

## 14. POS & batch payment policy

### 14.1 POS checkout (`pos_checkout_normal.php`)

| Decision | Rationale |
|----------|-----------|
| **Do not** expose to Clinic roles | Duplicates M5; session-popup UX |
| Admin **Advanced** only | Rare legacy use |

### 14.2 Batch payments (`new_payment.php`)

| Phase | Policy |
|-------|--------|
| V1 | Not exposed |
| V1.2-BILL optional | **Family batch** — one cash amount split across siblings’ visits — manager wizard; uses same AR posting discipline |

---

## 15. Navigation, ACL & menu cutover

### 15.1 ACL keys

| Key | Default groups | Audit |
|-----|----------------|-------|
| `new_bill_ops` | `new_admin`, `new_cashier_lead` | hub access |
| `new_bill_ops_correct` | `new_cashier_lead`, `new_admin` | `bill_ops.charge_corrected` |
| `new_bill_ops_payment` | `new_cashier_lead`, `new_admin` | `bill_ops.payment_reversed` |
| `new_bill_ops_close` | `new_admin` | `bill_ops.daysheet_exported` |
| `new_bill_ops_outstanding` | `new_admin` | `bill_ops.outstanding_note` |
| `new_bill_ops_insurance` | `new_admin` | — |

Existing M5/M11 keys unchanged.

### 15.2 Installer runbook (summary)

1. Pilot runs **M5 only** — `enable_bill_ops` = 0.
2. When manager needs corrections beyond M5-F10 stock link → enable `enable_bill_ops` = 1 (post-pilot **V1.2-BILL**).
3. Train **one** finance owner on M14 tabs; cashiers stay on M5.
4. Verify `MENU_RESTRICT` hides Fees children for clinic roles (PRD §11.2).
5. Run M7 reconciliation after first M14 close-day export.

---

## 16. Data model & backend contracts

### 16.1 No fork rule

M14 **does not** add parallel charge/payment tables. Writes use:

- `billing`, `drug_sales`
- `ar_session`, `ar_activity`
- `payments`
- `new_receipt` (read/link for reprint)

### 16.2 AJAX (`ajax.php` namespace `bill_ops.*`)

| Action | Method | Body | Notes |
|--------|--------|------|-------|
| `bill_ops.visit_charges` | GET | `{ visit_id }` | Charges + paid summary |
| `bill_ops.charge_correct` | POST | `{ visit_id, add[], remove[], reason }` | F01 |
| `bill_ops.payments_search` | GET | `{ q, date_from, date_to }` | F02 |
| `bill_ops.payment_reverse` | POST | `{ payment_id, reason }` | F02 |
| `bill_ops.daysheet` | GET | `{ facility_id, date }` | F03 |
| `bill_ops.outstanding_list` | GET | `{ facility_id, bucket? }` | F04 |

### 16.3 Config keys (`new_clinic_config`)

| Key | Default | Notes |
|-----|---------|-------|
| `enable_bill_ops` | `0` | M14 hub master gate |
| `enable_bill_ops_outstanding` | `0` | F04 — credit list |
| `bill_ops_reopen_on_correction` | `0` | If 1, underpaid correction reopens visit to `ready_for_payment` |

---

## 17. Phasing & PRD alignment

| Phase | Deliverable | PRD / slice |
|-------|-------------|-------------|
| **V1 pilot** | M5 Cashier + M7 reconciliation | §M5, M7-F10 |
| **V1.1-CDa** | M11 payment history + reprint | [PATIENT_PAYMENT_HISTORY](./NEW_CLINIC_V1_PATIENT_PAYMENT_HISTORY_REDESIGN.md) |
| **V1.2-BILL** | M14 hub F01–F03 (corrections, payments, close day) | This spec |
| **V1.2-BILL+** | F04 outstanding (optional) | NG2 softening |
| **V1.2-BILL-INS** | F05 insurance vault | When `enable_insurance` |

**Non-goals unchanged:** NG1 (NHIS claims), NG3 (EDI as daily workflow) — F05 is **admin backlog only**.

---

## 18. Acceptance criteria

### 18.1 V1.2-BILL core (BILL-1–BILL-5)

- [ ] **BILL-1:** With `enable_bill_ops` = 1, `new_cashier_lead` adds fee-schedule line to **completed** visit; `billing` row exists; audit `bill_ops.charge_corrected`.
- [ ] **BILL-2:** Payment search finds receipt by `new_receipt` number; detail shows linked `payments.id`.
- [ ] **BILL-3:** Payment reverse creates offsetting AR; receipt status `reversed`; cannot double-reverse.
- [ ] **BILL-4:** Daysheet total matches sum of `new_receipt` for date; M7-F10 reconciliation `ok` on clean day.
- [ ] **BILL-5:** Clinic role user does **not** see Fees → Billing Manager in menu; admin reaches ERA only via M14 Insurance vault.

### 18.2 Regression

- [ ] M5 golden path unchanged when `enable_bill_ops` = 0.
- [ ] M11 payment history remains read-only for cashier (no correction buttons without ACL).

---

## 19. Open questions

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| O-BILL-1 | Underpaid correction reopens visit automatically? | Product | **Closed (D-BILL-5)** — `bill_ops_reopen_on_correction` default **0** |
| O-BILL-2 | Partial payments in V1.2? | Product | **Closed (D-BILL-2)** — **No** at checkout; M5 full-pay; F04 for debt tracking only |
| O-BILL-3 | MoMo tally on daysheet — manual entry field? | Product | **Closed** — **Yes** P2 label-only field until NG9 lifted |
| O-BILL-4 | Merge M14-F03 with M7 UI vs separate tab? | Design | **Closed (D-BILL-3)** — same data; M14 = operator workflow; M7 = report archive |
| O-BILL-5 | Credit patient limit per MRN? | Clinical lead | **Open — defer V2** (PRD §24.2) |

---

## 20. Document history

| Version | Date | Changes |
|---------|------|---------|
| 0.1.3 | 2026-06-22 | Hygiene pass — §15.1/§16.2 normative titles; O-BILL-5 → PRD §24.2; companion sync PRD v1.20.29 |
| 0.1.2 | 2026-06-22 | Medium-gap pass — O-BILL-1–4 closed → PRD D-BILL-2–6; M7-F14 vs F04; §8 title; PRD v1.20.28 |
| 0.1.1 | 2026-06-22 | PRD integration pass — D-BILL-1 closed; PAGE_DESIGNS §7.25–§7.26; PRD §8/§4.4/§12.4/§13.1/§21.1u/§17.4.7; O-BILL-4 closed |
| 0.1.0 | 2026-06-22 | Initial draft — stock billing/AR audit; M14 hub proposal; West Africa context; D-BILL-1; phasing V1.2-BILL |

---

## Appendix A — Stock file map

| Stock path | M14 replacement / wrapper |
|------------|---------------------------|
| `interface/billing/billing_report.php` | F05 Insurance vault (admin) |
| `interface/forms/fee_sheet/new.php` | F01 façade + Advanced link |
| `interface/patient_file/front_payment.php` | **M5** (cash branch) — not M14 |
| `interface/patient_file/pos_checkout_normal.php` | Deprecated Clinic roles |
| `interface/billing/new_payment.php` | Batch — §14.2 future |
| `interface/billing/search_payments.php` | F02 |
| `interface/billing/edit_payment.php` | F02 reverse flows |
| `interface/reports/collections_report.php` | F04 simplified (optional) |
| `interface/reports/pat_ledger.php` | **M11** read façade |
| `interface/billing/era_payments.php` | F05 |
| `interface/billing/edi_270.php` / `edi_271.php` | F05 |
| `library/FeeSheet.class.php` | Service layer for F01 |
| `library/payment.inc.php` | Partial — M5 uses full cash path |
| `src/Billing/BillingUtilities.php` | Charge add/remove |
| `src/Billing/BillingReport.php` | F05 only |

---

## Appendix B — User stories

| ID | As a… | I want to… | So that… |
|----|--------|------------|----------|
| US-BILL-1 | senior cashier | add a missed charge to a paid visit with a reason | the clinic collects the right amount without learning fee sheet |
| US-BILL-2 | manager | find yesterday’s receipt # | I can answer patient disputes |
| US-BILL-3 | manager | reverse a duplicate payment safely | AR matches the cash drawer |
| US-BILL-4 | owner | print a daysheet that matches reconciliation | I trust daily totals |
| US-BILL-5 | owner | see who still owes the clinic | I can call them — without US insurance columns |
| US-BILL-6 | admin | open ERA upload when insurance backlog exists | legacy claims clear without exposing EDI to reception |

---

## Appendix C — Competitive reference matrix

| Capability | Epic (ambulatory) | athena | Bahmni / OpenMRS | New Clinic target |
|------------|-------------------|--------|-------------------|-------------------|
| POS checkout | Front desk payment | Payment collection | Cash module | **M5** |
| Patient ledger | Account summary | Patient balance | Patient account | **M11** |
| Charge correction | Superbill edit | Activity edit | Order edit | **M14-F01** |
| EOD reconciliation | Cash drawer | Reconciliation tool | — | **M14-F03 + M7** |
| Claims / ERA | Revenue cycle suite | Clearinghouse | — | **F05 vault** (optional) |
| Credit / aging | A/R workqueues | Collections | — | **F04** (simplified, optional) |
| West Africa MoMo | Partner-specific | — | Local adapters | Label only V1 (NG9) |

---

*For normative cash posting, see PRD §M5.2. For per-patient ledger UX, see [PATIENT_PAYMENT_HISTORY](./NEW_CLINIC_V1_PATIENT_PAYMENT_HISTORY_REDESIGN.md). For menu hiding, see PRD §19.*

# Patient Payment History & Ledger — Redesign Specification

| Field | Value |
|-------|--------|
| **Document version** | 0.1.1 |
| **Status** | Audit closure — **pilot wrapper (M11-F11 ledger)** + **V1.1-CDa** payment history panel |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md) (v1.20.45), [NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md) (v0.1.13), [NEW_CLINIC_V1_PAGE_DESIGNS.md](../NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.46), [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](./MEDICAL_RECORD_DASHBOARD_REDESIGN.md) (v0.2.33), [NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md](./NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md) (v0.1.3), [NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md](./NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md) (v0.1.2), [NEW_CLINIC_V1_USER_WORKFLOWS.md](../NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.46), [NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md) (v0.1.1) |
| **Audience** | Product, design, billing leads, cashiers, managers, trainers, implementers, QA |
| **Scope** | **Per-patient** payment and charge history — stock **Ledger** menu rehosted via Chart Depth finance slice; **not** clinic-wide M7/M14 billing ops |
| **Primary market** | Private outpatient clinics — **Ghana & West Africa** |
| **Implementation** | Design spec only — no code in this document |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Research — OpenEMR patient ledger pain points](#2-research--openemr-patient-ledger-pain-points)
3. [Research — UI/UX principles for payment history](#3-research--uiux-principles-for-payment-history)
4. [Research — how leading EHRs address patient financial history](#4-research--how-leading-ehrs-address-patient-financial-history)
5. [Research — Ghana & West Africa context](#5-research--ghana--west-africa-context)
6. [Comprehensive redesign — pilot wrapper + V1.1-CDa](#6-comprehensive-redesign--pilot-wrapper--v11-cda)
7. [Pilot interim — stock ledger wrapper (M11-F11)](#7-pilot-interim--stock-ledger-wrapper-m11-f11)
8. [Payment history panel — build spec (M11-F01 / F02 / F07 / F12)](#8-payment-history-panel--build-spec-m11-f01--f02--f07--f12)
9. [Legacy overlay on stock chart — ledger pages (plain English)](#9-legacy-overlay-on-stock-chart--ledger-pages-plain-english)
10. [Navigation, menu cutover & ACL](#10-navigation-menu-cutover--acl)
11. [Phasing, acceptance & training](#11-phasing-acceptance--training)
12. [Closed decisions](#12-closed-decisions)
13. [Document history](#13-document-history)

---

## 1. Purpose & positioning

### 1.1 What this document is for

Cashiers and managers need to answer *“What did this patient pay today — and can I reprint the receipt?”* without opening a US-style **Patient Ledger by Date** report under **Reports → Accounting**, hunting payer columns that are empty in a cash clinic, or leaving the patient context they already have on the Cashier desk or MRD Profile tab.

This spec defines how **Ledger** moves from stock horizontal nav into **Chart Depth payment history** — a **read-only depth panel** opened from MRD Profile strip, Overview feed, or Cashier **History** — **not** a sixth MRD tab and **not** duplicate AR posting (PRD §M5.2, **D-BILL-1**).

**Two-layer model (closed):**

| Layer | When | Behavior |
|-------|------|----------|
| **Pilot wrapper (M11-F11)** | Chart Depth finance flags **OFF**; pilot week 1–4 | Stock `pat_ledger.php` with T1 banner + hide insurance/payer columns when cash profile |
| **Payment history (V1.1-CDa)** | `enable_chart_depth_finance` = 1 | New `chart-depth/payments.php` timeline + receipt reprint; MRD Profile **Payments strip** |

**Trainer one-liner:** *“**Cashier desk** takes payment; **chart depth** shows what was paid before — same money, clearer screen.”*

### 1.2 Problem statement (Ghana private OPD)

> A patient returns saying she lost her receipt from last Tuesday. The cashier opens **Ledger** from the old menu — a report form with date from/to, facility and provider filters, and tables labelled with payer names and insurance session IDs. Empty payer cells make staff think the system is broken. She scrolls horizontally on a tablet, cannot find **Receipt #1042**, and asks the manager who knows `acct/rep` ACL. Meanwhile the redesigned **Profile** tab already shows today’s balance — but has no **View payment history** until Chart Depth CDa ships.

### 1.3 Positioning vs other surfaces

| Surface | Question | Payment / ledger role |
|---------|----------|----------------------|
| **M5 Cashier desk** | Take payment for **today’s visit** | **Post** cash to core AR; print receipt |
| **MRD Profile strip** | Quick balance + last receipt? | **View payment history** → CDa panel |
| **Chart Depth payments panel** | Full timeline + reprint | **Primary** read path when CDa ON |
| **Stock Ledger menu** | Legacy accounting report | **Pilot:** wrapped `pat_ledger.php`; **post-CDa:** hidden when `_finance` ON |
| **M7 Daily Reports** | Clinic cash today? | Aggregate EOD — not per-patient |
| **M14 Billing Back Office** | Fix charges, reverse payment, close day? | **Write** corrections — link from panel when `enable_bill_ops` ON |

```text
Take payment today     →  M5 Cashier desk
Read patient timeline  →  Chart Depth payment history (this spec)
Fix wrong charge       →  M14 (V1.2-BILL) — not M11
Clinic EOD cash        →  M7 + M16
```

### 1.4 Three-layer billing model (D-BILL-1)

| Layer | Module | Read / write | This spec |
|-------|--------|--------------|-----------|
| **Checkout** | M5 | **Write** payments | Cashier posts; M11 **reads** result |
| **Chart depth** | M11 (CDa) | **Read** timeline + reprint | **This document** |
| **Back office** | M14 (V1.2-BILL) | **Write** corrections, search, daysheet | **Add correction** deep-link only |

**Closed:** M11 does **not** duplicate billing — still reads core `billing`, `ar_activity`, `payments`, `new_receipt`. New surface, same data.

---

## 2. Research — OpenEMR patient ledger pain points

Evidence from stock codebase audit (`interface/reports/pat_ledger.php`, ~960 lines) and Chart Depth §3.2 / §4.2.

### 2.1 Information architecture

| Pain | Evidence | Ghana OPD impact |
|------|----------|------------------|
| **Report, not workflow** | Lives under **Reports**; title *Patient Ledger by Date* | Cashiers trained on **Cashier desk** never discover ledger |
| **Separate from receipt flow** | Payment on M5; history on different menu tree | “Reprint receipt” requires manager |
| **Date-range form first** | `form_from_date` / `form_to_date` before any rows | Extra step for “what did she pay today?” |
| **Facility / provider filters** | `form_facility`, `form_provider` on a patient-scoped page | Noise for single-site private clinic |
| **Not visit-scoped** | Encounter grouping by accounting session | Staff think in **queue # / visit date** |

### 2.2 Stock Patient Ledger UI (`pat_ledger.php`)

| Pain | Evidence | Ghana OPD impact |
|------|----------|------------------|
| **ACL `acct` / `rep`** | Line 51 — manager-grade permission | Cashiers lack access; doctors blocked appropriately but no lighter read role |
| **Insurance payer columns** | JOIN `insurance_companies`; payer labels per payment row | Empty payer cells in cash clinic |
| **US accounting vocabulary** | Adjustments, sessions, unapplied amounts | Training burden |
| **Report-style HTML tables** | Wide tables, `#FFFFDD` row striping, desktop layout | Unusable on tablet at front desk |
| **CSV export default name** | `svc_financial_report_{dates}.csv` | Sounds like US **svc** financial report |
| **No `new_receipt` link** | Module receipt numbers not first-class in UI | Cashier receipt #1042 hard to find |
| **Legacy chrome** | Full report header + horizontal nav | Same iframe noise as rest of stock chart |

### 2.3 Data layer (what we keep)

| Source | Used for |
|--------|----------|
| `billing` | Charge lines per encounter |
| `ar_activity` | Payments (PP), adjustments |
| `payments` | Core payment records |
| `new_receipt` | New Clinic receipt # + cashier metadata |
| `insurance_companies` | **Hidden** when `enable_insurance = false` |

Posting remains **CashCheckoutService** (PRD §M5.2) — Chart Depth is a **read façade**.

### 2.4 Navigation & roles

| Pain | Evidence | Ghana OPD impact |
|------|----------|------------------|
| **Ledger in horizontal nav** | `standard.json` — same prominence as Clinical | Competes with MRD after B7 |
| **Disconnected from MRD banner** | Banner shows balance due; ledger is separate page | Two truths unless same AR read |
| **No reprint audit** | Stock reprint paths vary | Manager cannot prove who reprinted |

---

## 3. Research — UI/UX principles for payment history

| # | Principle | Application |
|---|-----------|-------------|
| P1 | **Visit-first filter** | Default **This visit** when opened from active visit or Profile strip |
| P2 | **Timeline over ledger table** | Newest-first rows: charge / payment / adjustment with plain labels |
| P3 | **Receipt-centric** | Surface **Receipt #** + cashier + timestamp prominently |
| P4 | **Cash truth** | Hide payer / insurance columns when `enable_insurance = false` |
| P5 | **Clinic currency** | All amounts via `formatMoney()` — symbol from M6 (D-REG-3) |
| P6 | **Identity anchor** | Reprint confirm: **Patient · MRN · Receipt # · Amount** (M5-F15 pattern) |
| P7 | **Read-only default** | No post payment in M11 — redirects to Cashier desk |
| P8 | **Progressive depth** | Profile strip summary → slide-over timeline → M14 correction (admin) |
| P9 | **≤3 clicks to reprint** | M11-F12 from Cashier active card or Profile strip |
| P10 | **Not a sixth tab** | Depth panel — D-CD-1 / D-MRD-1 stand |

### 3.1 Anti-patterns (do not ship)

| Anti-pattern | Why |
|--------------|-----|
| Parallel `new_ledger` table | Violates D-BILL-1 / PRD §M5.2 |
| Post payment from payment history panel | Blurs M5 vs M11; wrong-patient risk |
| Show full AR to reception | Scope creep; use Cashier or manager |
| Rebuild `pat_ledger.php` engine in V1 | NG5 — read façade + events |
| Insurance columns default-on in cash profile | Recreates stock confusion |

---

## 4. Research — how leading EHRs address patient financial history

| System | Pattern | Lesson for New Clinic |
|--------|---------|----------------------|
| **Epic Hyperspace** | Hospital Account snapshot + **Transaction history** filtered by encounter | **Visit summary card** at top of panel |
| **Cerner PowerChart** | **Charges** tab on chart + **Payment history** modal | Separate **post** (registration/cashier) from **read** (chart) |
| **athenahealth** | Patient **Activity** stream with charges and payments | Timeline UX over accounting report |
| **Helium Health (Africa SaaS)** | Visit receipt + **payment history** on patient profile | **Receipt reprint** with clinic branding |
| **Bahmni / OpenMRS billing** | Cash payment at visit; limited historical view | Simplicity over full AR for small sites |
| **Square / modern POS** | Receipt # search + email/SMS reprint | **Receipt #** as primary key for staff |

**Takeaway:** Top systems expose **visit-scoped financial activity** with **receipt identity** at reprint time — not an accounting report left over from US practice management.

---

## 5. Research — Ghana & West Africa context

### 5.1 Payment history needs (private OPD)

| Need | Typical requester | CDa mapping |
|------|-------------------|-------------|
| **Reprint lost receipt** | Cashier, cashier lead | **Reprint receipt** on timeline row |
| **Verify last visit paid** | Cashier, cashier lead, manager | Profile strip + **This visit** filter — reception redirects to Cashier (D-FIN-9) |
| **Dispute charge amount** | Patient at desk | Cashier/manager opens timeline; M14 correction post-V1.2 |
| **MoMo reference lookup** | Cashier | Payment row shows `method: momo` + reference (V1.1-OPS) |
| **Doctor “what are today’s charges?”** | Doctor | `new_chart_depth_finance_summary` — active visit totals only |
| **Audit trail** | Manager | `chart_depth.receipt_reprinted` audit |

### 5.2 Regional UX constraints

| Constraint | Design response |
|------------|-----------------|
| **Cash primary** | Payment method **Cash** default label; MoMo when OPS flag ON |
| **Receipt as proof** | Patient expects paper with clinic logo — reprint uses M6 receipt template |
| **Low accounting literacy** | Plain labels: *Consultation (OPD)* not *CPT 99213* |
| **Shared front-desk PC** | Reprint confirm modal before generate |
| **Single-site clinic** | Hide facility/provider filters from CDa panel |
| **DD/MM/YYYY dates** | All timeline dates |
| **Cedi / Naira / etc.** | M6 `currency_code` — never hardcode GH₵ in templates |

### 5.3 What to hide in cash clinic profile

| Hide when `enable_insurance = false` | Reason |
|--------------------------------------|--------|
| Payer / insurance company columns | Empty / confusing |
| EOB / eligibility language | US artifact |
| Unapplied insurance session blocks | Not used in V1 golden path |
| **Export CSV** named `svc_financial_report` in wrapper | Rename or hide in F11 wrapper |

### 5.4 Training (Ghana OPD)

| Role | One-liner |
|------|-----------|
| **Cashier** | *“Take payment on your desk; **History** or Profile **View payment history** to reprint.”* |
| **Reception** | *“You don’t need Ledger — send payment questions to Cashier.”* |
| **Manager** | *“Payment history is read-only; fixes go to Billing back office after V1.2.”* |
| **Doctor** | *“See today’s charges on the banner — not full payment history.”* |

---

## 6. Comprehensive redesign — pilot wrapper + V1.1-CDa

### 6.1 Target architecture

```text
M5 Cashier desk
  Take payment → core AR + new_receipt → Overview feed payment_posted

MRD (B7)
  Profile tab ── Payments strip ── [ View payment history ] ──► chart-depth/payments.php
  Overview feed payment_posted ──► same panel (visit pre-filter)

Cashier desk (M11-F12)
  Active paid visit card ── [ History ] ──► chart-depth/payments.php?visit_id=

chart-depth/payments.php (V1.1-CDa)
  ├─ Filter: This visit | All visits | Date range
  ├─ Summary card (charges / paid / balance / last receipt)
  ├─ Timeline (paginate 20) — read-only
  ├─ [ Reprint receipt ] → confirm → chart_depth.receipt_reprint
  └─ [ Add correction ]* → M14-F01 when enable_bill_ops

Pilot (finance flags OFF):
  ⋯ Classic menu / horizontal Ledger ──► pat_ledger.php + M11-F11 wrapper
```

### 6.2 Phasing summary

| Phase | Deliverable | Gate |
|-------|-------------|------|
| **V1 pilot** | M11-F11 wrapper on stock `pat_ledger.php` | Chart Depth **OFF**; optional T1-F18 strip |
| **V1.1-CDa** | Payment history M11-F01/F02; Profile strip F07; Cashier History F12 | `enable_chart_depth` + `enable_chart_depth_finance` |
| **Menu cutover** | Hide stock **Ledger** from horizontal nav | `enable_chart_depth_finance` = 1 (M11-F09, D-EXP-6) |
| **Corrections link** | **Add correction** → M14 slide-over | `enable_bill_ops` = 1 (V1.2-BILL) |

### 6.3 Wireframe — payment history (V1.1-CDa)

Normative detail: [PAGE_DESIGNS §7.13](../NEW_CLINIC_V1_PAGE_DESIGNS.md#713-chart-depthpaymentsphp--payment-history).

```text
┌─ Payment history ─────────────────────────────────────────────── [ × ] ─┐
│ [ patient-context-banner ]                                               │
│ Filter: [ This visit ▾ ]  [ All visits ]  [ Date range… ]                │
│ SUMMARY: Charges 280.00 · Paid 280.00 · Balance 0.00                     │
│ Receipt #1042 · 18/06/2026 · Akosua (Cashier)                            │
│ [ Reprint receipt ]  [ Add correction ]*                                 │
│ TIMELINE (newest first)                                                  │
│   18/06/2026  Payment   280.00  Cash   Receipt #1042                   │
│   18/06/2026  Charge    200.00  Consultation (OPD)                     │
│   18/06/2026  Charge     80.00  FBC lab panel                            │
│ [ Load more ]                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Pilot interim — stock ledger wrapper (M11-F11)

**Purpose:** Pilot week 1–4 when `enable_chart_depth_finance` = 0 — staff still reach stock **Ledger** without insurance clutter or identity loss.

**M11-F11 split (closed):** PRD **M11-F11** is one pilot feature covering **three** stock URLs — ledger half (**FIN-1**, this spec), report half (**EXP-1**, [PATIENT_CLINICAL_EXPORT §7](./NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md#7-pilot-interim--stock-report-wrapper-m11-f11)), and transactions half (**REF-1**, [PATIENT_REFERRALS_LETTERS §7](./NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md#7-pilot-interim--stock-transactions-wrapper-m11-f11)). Shared injection pattern; acceptance is **FIN-1 + EXP-1 + REF-1** together before pilot sign-off.

### 7.1 Wrapper behavior

| Property | Value |
|----------|-------|
| **Target URL** | `interface/reports/pat_ledger.php` |
| **Injection** | Symfony response filter / RenderEvent — same pattern as export F11 wrapper |
| **Banner** | Inject `patient-context-banner` Tier 1 **or** T1-F18 legacy strip when B7 pending |
| **Hide insurance** | When cash profile / `enable_insurance = false`: CSS + server-side hide payer / insurance company columns |
| **Heading** | Optional subtitle: *“Advanced ledger — use Payment history when Chart Depth is enabled”* |
| **Does not** | Replace report engine; add receipt reprint; change AR data |

### 7.2 Pilot acceptance (F11 ledger)

- [ ] Stock Ledger reachable from horizontal nav or Classic menu with banner visible.
- [ ] Payer / insurance columns not rendered when cash profile applied.
- [ ] No duplicate banner when T1-F18 + wrapper both eligible — D-CTX-5.
- [ ] `new_cashier` / `new_cashier_lead` can open wrapped ledger during pilot — installer grants core `acct` / `rep` per **D-FIN-10** (FIN-1).

---

## 8. Payment history panel — build spec (M11-F01 / F02 / F07 / F12)

### 8.1 Routes & entry points

| Entry | Target |
|-------|--------|
| MRD Profile **Payments strip** → **View payment history** | `chart-depth/payments.php?pid=&visit_id=` — requires `new_chart_depth_finance` |
| Overview feed `payment_posted` | Navigate → Profile strip → **View payment history** when user has `new_chart_depth_finance`; else **expand inline** only (receipt #, amount, cashier) — **D-FIN-12** |
| Cashier active visit **History** (F12) | `chart-depth/payments.php?pid=&visit_id=` |
| MRD ⋯ **View ledger** (flags OFF) | Wrapped `pat_ledger.php` |
| Doctor (`new_chart_depth_finance_summary`) | **No payment panel** — see §8.7 (banner + Clinical **This visit** charges line) |

### 8.2 AJAX

| Action | Request | Response |
|--------|---------|----------|
| `mrd.profile_payments_summary` | `{ pid, visit_id? }` | `{ balance_due_amount?, last_receipt?, payments_strip_label }` |
| `chart_depth.payments_list` | `{ pid, visit_id?, encounter_id?, offset, limit }` | `{ summary?, rows[], has_more }` |
| `chart_depth.receipt_reprint` | `{ receipt_id }` | `{ pdf_url \| html }` |

Audit: `chart_depth.receipt_reprinted` — receipt_id, pid, actor.

### 8.3 Technical approach

| Item | Detail |
|------|--------|
| **Service** | `PaymentHistoryService` — read-only queries over core AR + `new_receipt` |
| **Labels** | Fee schedule / M6 labels for charge rows — not raw billing codes |
| **Pagination** | 20 rows; **Load more** without full page reload |
| **Performance** | First page ≤2s for one patient with &lt;500 rows (CD-1, FIN-2) |
| **Insurance** | Payer fields omitted from JSON when `enable_insurance = false` |
| **Adjustment rows** | Timeline type `adjustment` returned only when actor has `new_cashier_lead`, `new_admin`, or core `acct` / `rep` — **D-FIN-11** |
| **Doctor scope** | `new_chart_depth_finance_summary` — summary totals for active encounter only; no payment rows; direct URL to payment panel → **403** |

### 8.4 M11-F07 — Profile Payments strip

Lazy-fetch on Profile tab activation. Hidden when `enable_chart_depth_finance` = 0 (use ⋯ View ledger wrapper instead).

### 8.5 M11-F12 — Cashier History link

On Cashier desk **active visit** card after payment: **History** opens payment panel with `visit_id` — ≤3 clicks to reprint (CD-1).

### 8.6 M14 handoff (read → write)

**Add correction** visible only when `enable_bill_ops` = 1 and ACL `new_bill_ops_correct` — opens [PAGE_DESIGNS §7.26](../NEW_CLINIC_V1_PAGE_DESIGNS.md#726-bill-opscorrectphp--charge-correction-slide-over) with `visit_id` pre-filled. M11 never posts corrections directly.

### 8.7 Doctor active-visit charge summary (D-FIN-8)

Doctors with `new_chart_depth_finance_summary` see **active-visit charge totals only** — never historical payment rows or reprint.

| Surface | Placement | Content |
|---------|-----------|---------|
| **MRD Zone A banner** | When active visit today and visit state is clinical (`with_doctor`, `ready_for_lab`, etc.) | Read-only chip: **Visit charges: {amount}** — same AR read as `ready_for_payment` balance |
| **Clinical tab — This visit** (`#clinical-encounter-forms`) | Above encounter forms list when active `encounter_id` | One line: **Charges total: {amount}** (clinic currency) — no receipt #, no payment method |
| **Payment history panel** | Blocked | Direct navigation to `chart-depth/payments.php` → **403** with *“Payment history requires Cashier”* |

Fetch: reuse `mrd.profile_payments_summary` charge portion or dedicated `chart_depth.visit_charges_summary` — **no** `chart_depth.payments_list` payment rows for this ACL.

---

## 9. Legacy overlay on stock chart — ledger pages (plain English)

When **Chart Depth finance is not yet enabled**, staff may open stock **Ledger** from horizontal nav or Classic menu. The **legacy patient context overlay** (T1-F18) applies on allowlisted ledger URLs per [LEGACY_CHART_CONTEXT](./NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md).

### 9.1 Ledger-specific behavior

| Function (plain English) | What it does |
|--------------------------|--------------|
| **Ledger page coverage** | Sticky strip on stock Patient Ledger when opened from legacy nav |
| **Identity during long scroll** | Wide ledger tables — strip stays visible |
| **No visit bind** | Ledger is patient-scoped; optional date range inside form |
| **Print guard** | Strip suppressed on print view |
| **After CDa cutover** | Clinic roles use MRD payment history; strip still applies if power user opens Classic → Ledger |

### 9.2 What overlay does NOT do

| Not included | Reason |
|--------------|--------|
| Hide insurance columns | M11-F11 wrapper responsibility when cash profile |
| Receipt reprint | CDa panel + `chart_depth.receipt_reprint` |
| Post payments | M5 Cashier desk |

---

## 10. Navigation, menu cutover & ACL

### 10.1 Menu cutover (M11-F09 — Ledger only)

Per **D-EXP-6**: horizontal nav **Ledger** hidden when `enable_chart_depth_finance` = 1 (master `enable_chart_depth` = 1 required). **Report** and **Transactions** follow their own sub-flags.

| Role | When finance sub-flag ON | Modern path |
|------|--------------------------|-------------|
| **Cashier / manager** | Ledger nav hidden | Profile strip / Cashier **History** → payment panel |
| **Power users** | Ledger nav hidden | **⋯ Classic patient menu** → wrapped stock ledger (D-MRD-5) |

### 10.2 ACL matrix

| Capability | ACL key |
|------------|---------|
| Full payment history + reprint | `new_chart_depth_finance` → `new_cashier`, `new_cashier_lead`, `new_admin` (PRD §4.4) |
| Active visit charge summary (doctor) | `new_chart_depth_finance_summary` |
| Adjustment timeline rows | `new_cashier_lead`, `new_admin`, or core `acct` / `rep` (D-FIN-11) |
| Stock ledger (legacy / pilot F11) | Core `acct` / `rep` — pilot installer grant **D-FIN-10** |
| Add correction (M14) | `new_bill_ops_correct` |

### 10.3 Pilot stock Ledger ACL (D-FIN-10)

Until CDa ships, cashiers reach payment history via stock **Ledger** (F11 wrapper). `pat_ledger.php` requires core **`acct` / `rep`**. **Installer / role template** grants `acct` read + `rep` to `new_cashier` and `new_cashier_lead` alongside existing M5 **`acct` bill write** — same pattern as **D-EXP-11** `pat_rep` for reception on stock Report. Post-CDa, `new_chart_depth_finance` replaces pilot ledger path for clinic cashiers.

---

## 11. Phasing, acceptance & training

### 11.1 Acceptance (maps to PRD §21.1ac, §21.1p, tests CD-1, FIN-1–FIN-6)

**Pilot wrapper (M11-F11 — FIN-1):**

- [ ] Stock Ledger shows banner; insurance/payer columns hidden on cash profile (FIN-1).
- [ ] No duplicate T1-F18 + wrapper banner (FIN-1).
- [ ] `new_cashier` / `new_cashier_lead` can open wrapped ledger — `acct` / `rep` granted per D-FIN-10 (FIN-1).
- [ ] Report half of M11-F11 verified per [PATIENT_CLINICAL_EXPORT EXP-1](./NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md#11-phasing-acceptance--training) (FIN-1 / F11 combined sign-off).

**Payment history (V1.1-CDa — CD-1, FIN-2–FIN-4):**

- [ ] `chart_depth.payments_list` returns charge/payment rows in clinic currency (FIN-2).
- [ ] No insurance UI when `enable_insurance = false` (FIN-2).
- [ ] First page loads ≤2s for one patient with &lt;500 rows (FIN-2, CD-1).
- [ ] Adjustment rows visible only to `new_cashier_lead`, `new_admin`, or `acct` / `rep` (FIN-2, D-FIN-11).
- [ ] Reprint confirm **Patient · MRN · Receipt # · Amount** before POST (FIN-3, D-FIN-5).
- [ ] Audit `chart_depth.receipt_reprinted` on every reprint (FIN-3).
- [ ] Cashier reprint ≤3 clicks from Profile strip or Cashier **History** (FIN-4, CD-1).
- [ ] Overview `payment_posted` navigates to payment history only when user has `new_chart_depth_finance`; else expand inline (D-FIN-12).
- [ ] Doctor with `finance_summary` sees visit totals on Zone A + Clinical **This visit** only — payment panel 403 (FIN-6, §8.7).

**Menu (FIN-5):**

- [ ] **Ledger** hidden only when `enable_chart_depth_finance` = 1 (FIN-5).
- [ ] Power users retain Classic menu → stock ledger (FIN-5).

### 11.2 Training checklist

- [ ] Deliver role one-liners (§5.4) at CDa enablement.
- [ ] Drill: cashier reprints receipt from Profile strip.
- [ ] Drill: reception knows to redirect payment questions to Cashier.

---

## 12. Closed decisions

| ID | Decision |
|----|----------|
| **D-FIN-1** | **No parallel ledger (closed):** M11 reads core AR — PRD §M5.2 / D-BILL-1 |
| **D-FIN-2** | **V1.1-CDa:** `chart-depth/payments.php` is primary read path when `enable_chart_depth_finance` = 1 |
| **D-FIN-3** | **Pilot:** stock `pat_ledger.php` + **M11-F11 wrapper** — not new engine until CDa |
| **D-FIN-4** | Hide payer / insurance columns in wrapper and panel when `enable_insurance = false` |
| **D-FIN-5** | **Reprint confirm (closed):** **Patient · MRN · Receipt # · Amount** before `chart_depth.receipt_reprint` — M5-F15 pattern |
| **D-FIN-6** | **Ledger menu hide** only when `enable_chart_depth_finance` = 1 — per D-EXP-6 |
| **D-FIN-7** | **M5 write / M11 read / M14 correct** — three layers; no post payment in M11 |
| **D-FIN-8** | **Doctor scope (closed):** `new_chart_depth_finance_summary` — active visit charge total on Zone A + Clinical **This visit** only; payment panel **403** |
| **D-FIN-9** | **Reception (closed):** no historical payment history ACL in V1 — Cashier desk or manager |
| **D-FIN-10** | **Pilot `acct/rep` (closed):** installer grants core `acct` / `rep` to `new_cashier` / `new_cashier_lead` for F11 stock Ledger until CDa |
| **D-FIN-11** | **Adjustment rows (closed):** timeline type `adjustment` visible only to `new_cashier_lead`, `new_admin`, or core `acct` / `rep` |
| **D-FIN-12** | **Overview feed ACL (closed):** `payment_posted` navigate action requires `new_chart_depth_finance`; otherwise expand inline only |

---

## 13. Document history

| Version | Date | Changes |
|---------|------|---------|
| 0.1.1 | 2026-06-24 | **Audit closure** — D-FIN-5 Amount in reprint confirm; D-FIN-10 pilot `acct/rep`; D-FIN-11 adjustment row ACL; D-FIN-12 overview feed gate; D-FIN-8 doctor UI placement (§8.7); `new_cashier_lead` finance ACL; M11-F11 FIN-1+EXP-1 cross-ref; mobile back (PAGE_DESIGNS §7.13.9); CD-1 ≤2s; PRD v1.20.45 |
| 0.1.0 | 2026-06-24 | Initial spec — OpenEMR pain points, UI/UX, EHR patterns, Ghana context, M11-F11 ledger wrapper, M11-F01/F02/F07/F12 payment history, legacy overlay, menu cutover, D-FIN-1–9 |

---

*Normative wireframes: [PAGE_DESIGNS §7.13](../NEW_CLINIC_V1_PAGE_DESIGNS.md#713-chart-depthpaymentsphp--payment-history) · Chart Depth parent: [§9](./NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md#9-financial--visit-charges--patient-ledger) · MRD Profile strip: [MRD §8.10.1](./MEDICAL_RECORD_DASHBOARD_REDESIGN.md#8101-profile--payments-strip) · PRD M11: [§8 Module M11](./NEW_CLINIC_V1_PRD.md#module-m11--chart-depth)*

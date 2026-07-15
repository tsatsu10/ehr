# New Clinic — Cashier Billing Completion Plan (CBILL-*)

**Version:** v0.1.3
**Status:** CBILL-1 **built + live-smoke validated** (`pharmacy_auto_bill_on_dispense` default OFF); CBILL-2 **built + live-smoke validated** (`enable_partial_payment` default OFF); CBILL-3 scoped (gated on a PRD amendment)
**Owner:** Engineering
**Related:** M5 Cashier · M13 Pharmacy Ops · M14 Billing Back Office (V1.2-BILL) ·
[PRD](../done/NEW_CLINIC_V1_PRD.md) · [Pharmacy Ops Redesign](../done/NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md)

---

## 1. Problem / why now

The cashier is meant to be the clinic's single collection point. Today it is not complete:
the cashier's bill is built **only** from the encounter `billing` table, so it shows the
consult fee (suggested from the visit type) and lab charges (auto-posted on order via
`LabOrderChargeService`, flag `lab_auto_bill_on_order` default ON). It does **not** show
dispensed medicines — pharmacy records each dispense in `drug_sales` (with its patient
price), and the cashier never reads that table. The result: a cashier has to physically ask
"did this patient go to the pharmacy? the lab?" to be sure the bill is whole.

Separately, two capabilities the legacy core payment screen offers — **partial payment**
(patient pays part now, carries a balance) and **insurance scheme split** (a scheme covers
some lines, the patient pays the rest in cash) — are absent from the New Clinic cashier.
The core "Open payments (core)" escape hatch (`front_payment.php`) exists partly to cover
these, but paying there does **not** advance the `new_visit` FSM, so it is a footgun.

This plan closes the cashier billing story in three dependency-ordered slices.

## 2. Scope and non-scope

**In scope (this plan):**
- **CBILL-1** — surface dispensed-medicine charges on the cashier bill, payment total, and
  receipt, behind a new flag, default OFF.
- **CBILL-2** — partial payment with balance tracking (patient pays part of *their* portion).
- **CBILL-3** — insurance scheme split (scheme-covered vs patient-pay lines; collect the
  patient part now; track the scheme part as a claim to submit). **Requires a PRD amendment**
  (insurance is a formal non-goal — PRD §3.2 NG3, principle "cash truth").

**Explicit non-scope (all slices):**
- Electronic NHIS claim submission (CLAIM-it), automatic G-DRG tariff lookup, and scheme
  pre-authorization automation. Claims are tracked and exported for **manual** submission.
- Insurance eligibility checks, coordination of benefits, copay-vs-coinsurance math beyond a
  flat per-line covered/not-covered split, claim aging dashboards (that is M14 territory).
- Refunds / payment reversal (stays core / M14 correction).
- Re-opening a `completed` visit (PRD §6.4b — unchanged).

## 3. Roadmap (build in this order)

| ID | Slice | Size | Depends on | Flag | PRD amendment? |
|----|-------|------|-----------|------|----------------|
| **CBILL-1** | Pharmacy charges at the cashier | Small | — | `pharmacy_auto_bill_on_dispense` (OFF) | No |
| **CBILL-2** | Partial payment / balance | Medium | CBILL-1 | `enable_partial_payment` (OFF) | Softens NG2 — note in PRD |
| **CBILL-3** | Insurance scheme split | Large | CBILL-2 | `enable_insurance_scheme` (OFF) | **Yes — required before build** |

Order rationale: CBILL-1 makes the bill *complete*; CBILL-2 introduces "amount due vs paid
vs balance"; CBILL-3 reuses that same balance machinery to split "scheme owes" from "patient
owes." Building them in order means each slice extends the last instead of three half-done
threads.

---

## 4. CBILL-1 — Pharmacy charges at the cashier (full spec)

### 4.1 Design (plain English)

When the flag is ON, the cashier's bill includes the patient's dispensed medicines — each
drug, quantity, and price — added to the consult and lab charges. The cashier collects one
total and never has to ask whether the patient visited the pharmacy. When the flag is OFF,
nothing changes: the cashier behaves exactly as today.

**Important mechanism note.** We do **not** copy the lab pattern of writing a new `billing`
line. Lab tests are *services* (they belong in `billing`); medicines are *products*, and
OpenEMR records products in `drug_sales` — which the pharmacy dispense already writes on
every dispense (`DrugSalesService::sellDrug`, carrying `pid`, `encounter`, `quantity`,
`fee`). Writing the drug into `billing` *as well* would double-record the same charge. So
CBILL-1 has the cashier **read the medicines from where they already live** (`drug_sales`),
gated by the flag. This means **zero changes to the pharmacy dispense path.**

### 4.2 States

- **Flag OFF:** cashier queue totals, visit detail, payment total, and receipt are unchanged.
- **Flag ON, no dispenses:** identical to today (medicine section empty / hidden).
- **Flag ON, one or more dispenses:** medicine lines appear in the visit detail under a
  "Medicines" group; each line = drug name, quantity, line fee. The queue-card `charges_total`
  and the checkout total include the sum of unbilled `drug_sales.fee` for the encounter.
- **Partial / multiple dispenses:** each dispense is its own `drug_sales` row and shows as its
  own line — naturally handled, no dedup needed (unlike lab, which dedups by billing code).
- **Payment guard:** the existing "no charges — add fees before taking payment" guard
  (`recordPayment`, `totalDue <= 0`) now counts medicines too, so a visit with only medicines
  can be checked out.

### 4.3 Data & backend

**Flag (new):** `pharmacy_auto_bill_on_dispense` in `new_clinic_config`, default `0`, added
to `sql/install.sql` with an `#IfNotRow2D` guard (mirror `lab_auto_bill_on_order` at
install.sql ~L816). Facility-scoped read via `ClinicConfigService::getInt(..., $facilityId)`.
Wire into the three admin-flag places (install.sql, `ClinicAdminService::EDITABLE_SETTINGS`,
`adminFieldDefs.ts` allowlist + field def) so it is reachable in the Admin Hub.

**Read model — a new helper** `CashierService::getEncounterDrugCharges(int $pid, int $encounter)`:
```sql
SELECT ds.sale_id, ds.drug_id, d.name AS drug_name, ds.quantity, ds.fee
FROM drug_sales ds
LEFT JOIN drugs d ON d.drug_id = ds.drug_id
WHERE ds.pid = ? AND ds.encounter = ? AND ds.billed = 0
ORDER BY ds.sale_id ASC
```
Only `billed = 0` rows are unpaid; `billed = 1` means already collected (see payment below).

**Touch points (all cashier-side), gated on the flag:**
1. `getCashierQueue()` / `resolvePatientCheckout()` — add the drug-charge sum to each visit's
   `charges_total`. Keep the SQL sargable; prefer a single grouped `drug_sales` sum joined to
   the visit list over a per-row correlated subquery at queue scale (respect SCALE R-rules).
2. `selectVisit()` — return a `drug_charges` array + `drug_charges_total`; the sum feeds
   `charges_total`.
3. `recordPayment()` — `totalDue = sumCharges(billing) + sumDrugCharges(drug_sales)`; the
   `totalDue <= 0` guard counts both. On successful payment, mark the collected sales billed:
   `UPDATE drug_sales SET billed = 1, bill_date = NOW() WHERE pid = ? AND encounter = ? AND billed = 0`
   inside the existing payment transaction (`sqlBeginTrans` block).
4. Receipt (`buildPaymentResponse`) — `amount_paid` is the grand total (already includes
   medicines, since `totalDue` does). The current receipt does **not** itemize any charges
   (services included), so CBILL-1 keeps it consistent: no new itemization, the total simply
   reflects medicines. Line-item receipts are a separate future change if wanted.

**Frontend (cashier-desk island):** extend `CashierSelectData` types with `drug_charges`;
render a separate "Medicines" section in `CashierActivePane` via a new `DrugChargesTable`
(billing `ChargesTable` keeps its billing-only subtotal so its footer stays honest; the
payment "Total due" shows the grand total). No new fetch — data rides the existing
`cashier.select` / `cashier.pay` envelopes. Token-based BEM only; `*.test.tsx` coverage for
the flag ON/OFF total.

**ACL:** unchanged — the cashier already owns `cashier.*` actions. No new action.

### 4.4 Edge cases

- **Dispense after payment:** rare (FSM routes Dispense → pharmacy_complete → ready_for_payment).
  If it happens, the new sale is `billed = 0` on a `completed` visit and shows as outstanding;
  resolution is a core/M14 correction — out of scope here (documented, not silently handled).
- **Fee edited by pharmacist:** we bill exactly `drug_sales.fee` (the pharmacist's dispense
  fee), per the product decision — cashier total always matches what pharmacy charged.
- **Non-dispensable / zero-fee rows:** `fee = 0` lines show but add nothing to the total.

### 4.5 Flag + rollout + parity sign-off

- Ships **OFF**. Flag OFF = 100% legacy cashier behavior (parity invariant, PRD §5.6).
- **Parity sign-off checklist:** (a) flag OFF — cashier totals/receipt byte-identical to
  pre-change; (b) flag ON, service-only visit — unchanged; (c) flag ON, drugs-only visit —
  total = drug fees, payment marks `drug_sales.billed=1`, receipt itemizes; (d) flag ON,
  mixed consult+lab+drugs — total = sum of all three, no double count; (e) partial dispense —
  each sale line present; (f) core Sales/AR report shows the sale as billed after payment.

---

## 5. CBILL-2 — Partial payment / balance (BUILT)

**Goal:** allow the cashier to collect *part* of the patient's total now and carry a balance,
instead of the current "pay full amount or mark left-unpaid."

**Decisions (locked with product):** (1) a partial payment **completes the visit**; the
remainder becomes an outstanding balance that surfaces on the existing M14 "owed to clinic"
list (no new FSM state — reuses the outstanding query's *completed-with-balance* branch).
(2) **Manager-gated**: reuses the existing `new_visit_mark_outstanding` ACL and **requires a
reason** (same pattern as "mark left unpaid" — no new ACL to register).

**As built:**
- New action `cashier.pay_partial` → `CashierService::recordPartialPayment()`: same flow as a
  full payment but the amount may be `0 < amount < totalDue`, a reason is required, and it
  records the partial amount to AR (`postPatientPayment($amount)`), completes the visit, and
  marks CBILL-1 medicines billed. E-sign + completion gates still enforced.
- Balance is **core AR** (charges − payments); no parallel ledger. The M14 outstanding list
  already surfaces `completed AND charges > paid`, so the remainder appears automatically
  **when `enable_bill_ops_outstanding` is on** (documented dependency; balance always exists
  in AR regardless).
- Receipt gains a **Balance owed** line; the Change line is suppressed on a partial.
- Idempotent via `client_request_id` (reuses the CBILL-1/full-pay replay cache).
- Frontend: `PartialPayModal` (amount + reason + method) + a footer "Partial payment" button
  shown only when `enable_partial_payment` + the permission + a full payment would also be
  allowed (signed, completion satisfied — keeps the modal to amount + reason).
- Flag `enable_partial_payment`, default OFF. Softens PRD NG2 (credit/aging) — PRD note pending.

**Live-smoke validated** (dev DB, real `recordPartialPayment` on a seeded 50.00 charge, then
full restore): guards reject empty reason / amount≥total / amount≤0; a 30.00 partial →
`balance_due=20`, visit `completed`, AR PP=30, receipt marked partial; the visit appears on
the outstanding list with `owed=20`; idempotent replay did not double-charge; e-sign +
completion gates fired when overrides were withheld.

**Open for CBILL-2 spec:** FSM state vs pure balance field; how balance surfaces on the queue
card; interaction with `closed_unpaid`; reporting of outstanding (ties to M14
`enable_bill_ops_outstanding`).

---

## 6. CBILL-3 — Insurance scheme split (scope outline, **PRD amendment required**)

### 6.1 Why a PRD amendment first

Insurance is a **formal non-goal**: PRD §3.2 NG3 (insurance backlog), Goal G3 "cash-only
checkout, zero insurance claim screens," and the "cash truth" principle ("if it's not paid,
it's *pending payment*, not *insurance pending*"). Per the docs rule, a spec touching a
non-goal needs a PRD amendment, not just a new spec. **CBILL-3 does not start until the PRD
is amended** to permit an optional, flag-gated scheme-split at the cashier for the West
Africa market.

### 6.2 Grounding (Ghana market research)

The design follows how insurance actually works at a Ghanaian private clinic (researched
2026-07-15):
- **Two payer types:** public **NHIS** (G-DRG tariffs, claims to NHIA regional centres via
  CLAIM-it — many private clinics decline it as underpaying/late) and **private HMOs/PHIS**
  (annual outpatient limits, clinic is a partner facility, bills the scheme monthly).
- **The decisive finding:** even insured patients routinely **still pay cash at the desk** —
  studies found insured clients paid out-of-pocket for consultation (~75%) and drugs (~63%),
  mostly for **non-covered** items. So the real model is a **split bill**, not "insurance pays."

Sources: [NHIS G-DRG tariffs](https://www.nhis.gov.gh/files/TARIFFS%20OPERATION%20MANUAL%20v22.pdf) ·
[PHIS study (PMC11806611)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11806611/) ·
[Out-of-pocket study (PMC8106211)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8106211/) ·
[PHIS guidelines](https://www.nhis.gov.gh/files/GUIDELINES%20FOR%20PHIS%20INDUSTRY%20IN%20GHANA.pdf)

### 6.3 Shape (to detail after amendment)

- **Split bill:** each charge line (consult, lab, drug) is marked **scheme-covered** or
  **patient-pay**. The cashier collects the patient-pay part **now**; the scheme part is
  recorded as a claim to submit later.
- **Reuse core insurance tables** — `insurance_companies` (payers/schemes) + `insurance_data`
  (patient membership). New Clinic *hid* these; CBILL-3 selectively re-exposes and simplifies
  them for the scheme model rather than building from zero.
- Capture per visit: scheme (payer), membership number, covered lines, patient co-pay total,
  scheme claim total. Claims are listed/exported for manual submission (no CLAIM-it upload).
- Flag `enable_insurance_scheme`, default OFF; insurance UI stays hidden when off (matches
  existing `enable_insurance=false` behavior).

**Open for CBILL-3 spec:** per-line coverage UI vs whole-bill percentage; membership
verification (manual card entry in V1); where the scheme-claim register lives (M5 vs M14);
annual-limit tracking (likely out of V1).

---

## 7. Open questions

1. CBILL-1 queue total: grouped `drug_sales` sum join vs materialized column — pick the
   sargable option at pilot queue scale.
2. CBILL-2: new `new_visit` sub-state vs pure AR balance — decide in the CBILL-2 spec.
3. CBILL-3: does the clinic accept NHIS at all, or private schemes only? Affects whether
   G-DRG tariff structure matters (research suggests many private clinics decline NHIS).
4. CBILL-3 claim register home: extend M14 Billing Back Office (`enable_bill_ops_*`) vs a new
   M5 surface.

## 8. Version history

| Version | Date | Author | Change |
|---------|------|--------|--------|
| v0.1.0 | 2026-07-15 | Engineering | Initial plan: 3-slice cashier billing roadmap; CBILL-1 (pharmacy charges) full spec; CBILL-2/CBILL-3 scoped; CBILL-3 gated on PRD amendment; Ghana insurance research captured. |
| v0.1.1 | 2026-07-15 | Engineering | CBILL-1 built: flag `pharmacy_auto_bill_on_dispense` (install.sql + admin), `CashierService` drug-charge read/fold/mark-billed across queue/select/pay, `DrugChargesTable` + Medicines section, tests. Verified: PHP verify PASS, 711 vitest pass, `npm run check` green, live SQL schema smoke PASS. Pending: live e2e payment run with flag ON. |
| v0.1.2 | 2026-07-15 | Engineering | CBILL-1 live-smoke validated on the dev DB (seeded medicine on a real `ready_for_payment` visit, drove the real `CashierService`): `selectVisit` surfaces the medicine + folds it into `charges_total`; `getCashierQueue` card total includes it; `markDrugSalesBilled` flips `billed=1` + stamps `bill_date` — all PASS on live data, seed cleaned up, flag restored OFF, no collateral changes. Flag-OFF path covered by unit test (in-process config cache makes it untestable in one CLI run). Full `recordPayment` transition/AR-post is unchanged pre-existing code; its two new pieces (drug total fold, mark-billed) are the live-validated ones. Committed `643d9cb2`. |
| v0.1.3 | 2026-07-15 | Engineering | CBILL-2 built + live-smoke validated: `enable_partial_payment` (default OFF); `cashier.pay_partial` → `recordPartialPayment` (manager-gated via `new_visit_mark_outstanding` + reason); `PartialPayModal` + footer button + receipt Balance-owed line; reuses M14 outstanding for the balance (no new FSM state/table). Verified: PHP verify PASS, 724 vitest pass, `npm run check` green, and a 12/12 live smoke (guards, 30/50 partial → balance 20 + completed + AR + on owed list, idempotent replay, gate enforcement) with full visit restore. Pending: PRD NG2 softening note for partial payment. |

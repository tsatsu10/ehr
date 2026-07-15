# New Clinic — Insurance Scheme-Split at the Cashier (CBILL-3)

**Version:** v0.1.0
**Status:** Design — for review before build. Authorised by **PRD D-BILL-8 (v1.20.53)**.
**Flag:** `enable_insurance_scheme` (default **OFF**)
**Related:** [Cashier Billing Completion Plan](./NEW_CLINIC_CASHIER_BILLING_COMPLETION_PLAN.md) §6 ·
M5 Cashier · M14 Billing Back Office · CBILL-1/CBILL-2

---

## 1. Problem / why now

In the launch region, even insured patients usually **still pay cash at the desk** for items
their scheme doesn't cover (research in plan §6.2). The real model is a **split bill**: some
lines the scheme covers (billed to the scheme later), the rest the patient pays now. Today the
New Clinic cashier is cash-only — it can't split a bill or track what a scheme owes. CBILL-3
adds that, opt-in and default OFF, without becoming a claims/EDI engine.

## 2. Scope

**In scope (V1):**
- Mark a visit as covered by a **scheme** (a payer from `insurance_companies`) + a **membership
  number**, at the cashier.
- **Per-line coverage:** for each charge already on the bill (billing lines + CBILL-1 medicine
  lines), tick **scheme-covered** or **patient-pay**.
- Collect the **patient-pay** total now (reuses CBILL-2 machinery: full or partial).
- Record the **scheme-owed** total as a **claim** with status *to submit*.
- A **"Scheme claims to submit"** list the clinic works from (mirrors the M14 owed list).

**Explicit non-scope (stays non-goal per NG1/NG3):**
- Automated claim submission, NHIS CLAIM-it upload, pre-authorisation, insurer APIs, X12/EDI/
  ERA (835), 270/271 eligibility. The claim register is **manual** — export/print only.
- Annual benefit-limit tracking, coordination of benefits, secondary/tertiary schemes.
- Scheme/payer admin CRUD — reuse the existing core insurance-company list (M14-F05 vault
  gateway already exists for admin).

## 3. User workflow (plain English)

At the cashier, on a visit for an insured patient:
1. Cashier ticks **"Patient has a scheme,"** picks the scheme, types the membership number.
2. Each charge line shows a **scheme / patient** toggle. Cashier ticks what the scheme covers.
3. The screen shows two totals: **Patient pays** (collect now) and **Scheme owes** (the claim).
4. Cashier collects the patient part (full or partial, per CBILL-2) and prints a receipt that
   shows both figures.
5. The scheme part lands on the **"Scheme claims to submit"** list for the clinic to bill later;
   a manager marks a claim **submitted** (and later **settled**) as they work it.

When the flag is OFF: none of this appears — the cashier is exactly as today.

## 4. Data & backend

**Reuse (no fork):** `insurance_companies` for the scheme picker (`WHERE inactive = 0`,
name only — ignore the X12/CMS columns).

**New module tables** (install.sql, `#IfNotTable` guards):

```sql
-- One scheme claim per visit that used the split.
new_scheme_claim (
  id BIGINT PK, facility_id INT, visit_id BIGINT, pid BIGINT, encounter BIGINT,
  insurance_company_id INT,            -- the scheme (payer)
  scheme_name VARCHAR(255),            -- snapshot (payer may be renamed later)
  membership_number VARCHAR(64),
  scheme_owed DECIMAL(12,2),           -- sum of scheme-covered lines
  patient_pay DECIMAL(12,2),           -- sum of patient-pay lines
  status ENUM('to_submit','submitted','settled','void') DEFAULT 'to_submit',
  actor_user_id BIGINT, created_at DATETIME, submitted_at DATETIME NULL, settled_at DATETIME NULL,
  UNIQUE(visit_id)
)
-- Per-line coverage snapshot (which charge lines the scheme covered).
new_scheme_claim_line (
  id BIGINT PK, claim_id BIGINT, source ENUM('billing','drug'),
  source_id BIGINT,                    -- billing.id or drug_sales.sale_id
  description VARCHAR(255), amount DECIMAL(12,2), covered TINYINT(1)
)
```

**Service:** `SchemeClaimService` (lazy-constructed, no eager cycle):
- `getSchemes(facilityId)` → active `insurance_companies` for the picker.
- `previewSplit(visitId, coverage[])` → given per-line coverage flags, return patient_pay +
  scheme_owed totals (validation, no write).
- `recordSplitPayment(...)` → in one transaction: create `new_scheme_claim` + lines, collect the
  patient part via the **existing** `recordPayment`/`recordPartialPayment` path (so CBILL-1/2
  gates, receipts, and the owed list all still apply to the patient portion), stamp the claim
  `to_submit`. Idempotent via `client_request_id`.
- `listClaims(facilityId, status, bucket)` → the "scheme claims to submit" list.
- `setClaimStatus(claimId, status, reason)` → manager marks submitted/settled/void (audited).

**Cashier total interaction:** the patient-pay total is what M5 collects; the scheme portion is
**not** an AR charge against the patient, so the M14 "owed to clinic" list must **exclude**
scheme-covered amounts (guard: outstanding counts patient-owed only, not scheme-owed). The
scheme portion lives only in `new_scheme_claim`.

**Ajax actions** (CashierActionHandler or a new SchemeActionHandler):
`cashier.scheme.list`, `cashier.scheme.preview`, `cashier.scheme.pay`,
`bill_ops.scheme_claims`, `bill_ops.scheme_claim_status`.

**ACL:** cashier actions gated `new_cashier`; the claim-status changes gated
`new_bill_ops` / `new_bill_ops_insurance` (the existing insurance-vault ACL). Service
`assertAccess` + the `enable_insurance_scheme` flag gate on every action.

## 5. Feature flag + rollout + parity sign-off

- `enable_insurance_scheme` in `new_clinic_config`, default `0`, facility-scoped, wired in the
  three admin places (install.sql, `ClinicAdminService::EDITABLE_SETTINGS`, `adminFieldDefs.ts`).
- Flag OFF = 100% current cashier behaviour, no scheme chrome (matches `enable_insurance=false`).
- **Parity sign-off:** (a) flag OFF — cashier byte-identical; (b) flag ON, no scheme selected —
  behaves as a normal cash checkout; (c) scheme + all lines patient-pay — equals a normal
  payment, empty claim; (d) mixed coverage — patient_pay collected, scheme_owed on the claim
  list, receipt shows both; (e) scheme-owed does **not** appear on the M14 patient owed list;
  (f) claim status transitions audited.

## 6. Build slices (each shippable behind the flag)

1. **CBILL-3a — data model + service core: BUILT** (commit 58faa48a, 2026-07-15). Tables,
   `SchemeClaimService`, `CashierService::recordSchemePayment`, M14 owed-list scheme subtraction,
   flag + ACL. Verified: PHP verify, PHPUnit 4/4, 11/11 live smoke (patient pays uncovered
   portion, scheme portion → claim, scheme kept off the patient owed list, claim list + status).
2. **CBILL-3b — cashier split UI: BUILT** (commit 72c94a6d, 2026-07-15). `SchemeSplitModal`
   (scheme picker + membership + per-line coverage toggles + scheme/patient totals + collect
   patient part), "Scheme split" footer button, `cashier.scheme.list`/`cashier.scheme.pay`
   actions, receipt scheme-owed line. Behind `enableInsuranceScheme`. 735 vitest + full gate green.
3. **CBILL-3c — claims list: BUILT** (commit 47ce4eca, 2026-07-15). `SchemeClaimsList` in the
   M14 bill-ops Insurance pane: status filter (to_submit/submitted/settled/void) + Mark
   submitted/settled/void; actions `bill_ops.scheme_claims` + `bill_ops.scheme_claim_status`
   (insurance-vault ACL). Hidden when the scheme feature is off. CSV export deferred (later).
   **CBILL-3 complete.** Audit fixes in commit cdbc1013 (server recomputes the split from real
   charges — client amounts can't tamper the split; tamper-smoke 5/5).

## 7. Open questions

1. Membership: capture per-visit only (lean, recommended) vs also write back to core
   `insurance_data` for the patient? V1 leans per-visit snapshot on the claim.
2. Does a partial patient-pay (CBILL-2) combine with a scheme-split in V1, or is scheme-split
   full-patient-pay only for the first cut? (Proposed: allow, since both reduce to "collect the
   patient portion.")
3. Claim list home: extend M14 bill-ops (recommended — it owns billing back office) vs a new M5
   surface.

## 8. Version history

| Version | Date | Author | Change |
|---------|------|--------|--------|
| v0.1.0 | 2026-07-15 | Engineering | Initial CBILL-3 design: per-line coverage + scheme claim register; lean new_scheme_claim(+_line) tables reusing insurance_companies for the picker; 3 build slices; authorised by PRD D-BILL-8. |

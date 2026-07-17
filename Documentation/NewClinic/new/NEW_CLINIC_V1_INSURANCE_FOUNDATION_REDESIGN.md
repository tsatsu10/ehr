# New Clinic — NHIS & Private Insurance Foundation (CBILL-4)

**Version:** v0.1.0
**Status:** Design — for review before build. Requires **PRD D-BILL-9** (new amendment, not yet
authorised — see §9).
**Flag:** `enable_payer_billing` (default **OFF**) — requires `enable_insurance_scheme` = 1
(builds on CBILL-3's claim register; behaves as CBILL-3-only when this flag is OFF)
**Related:** [Insurance Scheme-Split (CBILL-3)](./NEW_CLINIC_V1_INSURANCE_SCHEME_SPLIT_REDESIGN.md) ·
[Cashier Billing Completion Plan](./NEW_CLINIC_CASHIER_BILLING_COMPLETION_PLAN.md) ·
[Market Expansion Plan](./NEW_CLINIC_MARKET_EXPANSION_MASTER_PLAN.md) §T3/T4 (MKT-NHIS-*, MKT-PAYER-*, MKT-PHI-*) ·
M5 Cashier · M1 Front Desk · M14 Billing Back Office

---

## 1. Problem / why now

CBILL-3 shipped a working, manual insurance-split at the cashier: mark charge lines as
scheme-covered or patient-pay, collect the patient's part now, track the scheme's part as a
claim. That is real and it works. But it treats every scheme the same way stock OpenEMR
treats "insurance" in the abstract — one flat clinic price for everyone, one payer per visit,
no way to know if the patient's cover is even still active before the visit happens, and a
claim list that only tells you *what* you are owed, never *how overdue* it is.

Two concrete gaps came out of research this session:

1. **NHIS does not use flat cash pricing.** It pays against a fixed government tariff
   (G-DRG codes + a standard medicines list). A clinic running CBILL-3 today has no way to
   price an NHIS-covered line differently from a cash line — the "scheme owed" total is
   just the cash price of whatever was ticked covered, which will not match what NHIS
   actually pays.
2. **NHIS eligibility is checkable today, cheaply, without any integration.** Ghana's NHIA
   runs a USSD code (`*842#` / `*842*10#`) that any phone can dial to confirm a member's
   status in seconds. Nothing in New Clinic today gives staff a place to log that check
   happened, or shows the result before the patient reaches the cashier.

Private insurance (HMOs) is a different problem — every insurer has its own tariff and its
own claim rules, and there is no USSD-style shortcut. The honest posture there is: give the
clinic the same tools (payer-aware pricing, a place to log how eligibility was checked,
better claim tracking) without pretending to talk to any specific insurer's system, because
no pilot clinic has signed on a specific HMO integration yet.

This spec is the next increment on CBILL-3 — not a claims/EDI engine, and not a live
integration with NHIA's e-claims system (CLAIM-it) or any HMO portal. It generalises what
CBILL-3 built so it treats "which payer, at what price, checked how" as first-class facts,
because that is what actually differs between clinics that only see cash patients and
clinics that also see NHIS/HMO patients.

## 2. Scope

**In scope (V1 of this increment):**

- **Payer-aware pricing (CBILL-4a):** a payer (NHIS or a private scheme) can have its own
  price for a billable item, separate from the clinic's cash price. When a claim line is
  priced under a payer that has an override, use the override; otherwise fall back to the
  clinic's normal price (today's behaviour, unchanged).
- **Eligibility check log (CBILL-4b):** a place to record that staff checked a patient's
  cover — method (USSD, phone call, portal, physical card, other), result (eligible / not
  eligible / unknown), a free-text reference (e.g. the USSD Claims Check Code), who checked
  it and when. This is a **log of a check staff performed themselves** — the system does not
  perform the check.
- **More than one payer on record (CBILL-4c):** a patient can have a primary payer (NHIS,
  as today) *and* a secondary payer (a private top-up scheme) on file, and a single visit's
  split can send different lines to different payers, not just one scheme vs cash.
- **Claims workbench upgrades (CBILL-4d):** the existing "Scheme claims to submit" list gets
  an age view (how long has this been sitting unsettled), a per-payer filter, and a
  free-text rejection note so a claim that comes back queried/rejected can be tracked and
  either corrected and resubmitted, or voided — without inventing a structured rejection-code
  taxonomy no clinic has validated yet.

**Explicit non-scope (needs real clinic discovery + its own future amendment — do not build):**

- Any live integration with NHIA's CLAIM-it e-claims system, its XML claim format, or any
  automated USSD dialing/parsing. Eligibility stays a **logged manual check**.
- Any live API/portal integration with a specific private HMO. Pre-scoping a generic
  "payer adapter" plugin framework is explicitly rejected here — build the adapter when a
  real pilot clinic has a real HMO to connect to, not before.
- Pre-authorisation workflow (HMO auth codes above a payer threshold). Noted as a future
  hook on the claim/visit record (a free-text field would already hold one if a clinic
  wants to write it down), not a tracked workflow with its own states.
- Annual benefit-limit tracking or coordination-of-benefits math (e.g. automatically
  splitting a bill 70/30 across two payers). Multi-payer in this spec means "more than one
  payer can be on file and a line can point at either one" — a human still decides the
  split, same as CBILL-3 today.
- Claim **batching** for physical/portal submission (grouping claims into a monthly
  submission bundle). Real clinics submit three different ways today (online portal, hand
  delivery on a flash drive, or a private HMO's own form) and guessing the right batch
  shape without a real claims officer in the room is exactly the mistake the market plan
  warns against — left as an open question (§8).
- Payer/scheme admin CRUD beyond price overrides — still reuses core `insurance_companies`
  for the payer identity list (M14-F05 vault gateway already owns that).

## 3. User workflows affected

| Desk/role | What changes |
|-----------|--------------|
| **M1 Front Desk (reception)** | Registration can record a second payer on the patient. A "Check eligibility" action logs a USSD/phone/portal check result, visible on the patient banner as a small badge (Eligible / Not eligible / Unchecked) when a scheme is on file. |
| **M5 Cashier** | The existing scheme-split screen (CBILL-3) now shows a payer-priced amount per line (when an override exists) instead of always the cash price, and each line can be assigned to whichever payer is on file for that visit (not just one scheme vs cash). |
| **M14 Billing Back Office — Insurance tab** | "Scheme claims to submit" gains an age column/filter and a per-claim rejection note field. A new small **"Payer prices"** section (admin only) lists price overrides per payer, add/edit/delete. |

Nothing changes for a clinic with `enable_payer_billing` OFF — CBILL-3 behaves exactly as it
does today (cash-priced lines, one payer per claim, no eligibility badge).

## 4. Design (plain English)

### 4.1 Registration — second payer

Today registration has one "Insurance" choice: Cash, NHIS, or Private (with that scheme's
own number/expiry fields). When the flag is ON, after picking a primary payer, an **"Add a
second payer"** link appears (off by default, collapsed) — same fields, but explicitly
labelled *secondary*. A patient who has NHIS *and* a private top-up scheme can have both on
file. This is additive only: the existing single-payer fields and their data are untouched;
a second payer is new, optional information.

### 4.2 Eligibility check log

On the patient banner (wherever the insurance/payer summary already shows — front desk and
cashier), a **"Check eligibility"** button opens a small form: pick the payer (if more than
one on file), pick how it was checked (USSD / phone / portal / card / other), pick the
result, and an optional reference code / note. Saving stamps who and when. The banner then
shows a small badge next to that payer: a green "Eligible" chip, an amber "Not eligible"
chip, or nothing if never checked (not a hard block — staff can still proceed, this is
information, not a gate). Old checks do not auto-expire in this version; the badge always
shows the most recent one with its date, so stale checks are visible, not hidden.

### 4.3 Cashier — payer-priced split

The existing CBILL-3 split screen (pick payer → per-line coverage → collect patient part)
changes in two ways:
1. If more than one payer is on the patient's file, each line's "who covers this" control
   becomes a small select (Patient / Payer A / Payer B) instead of a toggle.
2. Each line shows the amount that payer will actually be billed — the payer's override
   price if one exists for that item, otherwise the normal cash price, with a small "payer
   price" label so it is visually clear when a different number applies. No override
   configured for that item → identical to CBILL-3 today.

### 4.4 M14 — claims workbench

The "Scheme claims to submit" table gains:
- An **age column** (days since the claim was created) and a filter (0–30 / 31–60 / 61–90 /
  90+), same bucket pattern the Outstanding-balances tab already uses — nothing new to
  learn.
- A **payer filter** (when a clinic works more than one scheme).
- A **rejection note**: any claim in `submitted` can be marked **Rejected** (a new status)
  with a free-text reason; a rejected claim can be sent back to `to_submit` (correct and
  resubmit) or voided. The note is just a text field — this project cannot assume any
  particular rejection-code format from any specific payer today.

### 4.5 Payer prices (admin)

A small admin-only screen (in the Insurance tab, gated the same as the vault links today):
pick a payer, see its price-override list, add a row (item code + price), edit or remove a
row. No bulk import in this slice — a clinic with a large NHIS tariff list types or edits
entries as they come up; CSV import is a candidate future slice once a real clinic's tariff
sheet is in hand (see §8).

### 4.6 States / empty / error / a11y

- **Empty states:** no payer on file → no "Add a second payer" link shown (nothing to add
  a second *to*); no price overrides for a payer → the payer-prices list shows a plain
  "No price overrides yet — lines bill at the clinic's normal price" message, not a blank
  table.
- **Errors:** eligibility-check save failure and price-override save failure use the
  existing `nc-error-callout` pattern with retry, same as every other New Clinic form.
  Payer-priced totals never silently fail to a wrong number: if the price lookup errors,
  the line falls back to the clinic's cash price and shows a small warning icon, not a
  blocked screen.
- **A11y:** eligibility result badges carry `aria-label`s describing payer + result + date
  (not colour alone); the payer-per-line select on the cashier screen is a real `<select>`
  with a visible label per row, keyboard-operable like every other New Clinic control.

## 5. Data & backend

**Reuse (no fork):** `insurance_companies` stays the only payer-identity source (as CBILL-3
already does). `new_scheme_claim` / `new_scheme_claim_line` (CBILL-3) are extended, not
replaced.

### 5.1 Schema changes

```sql
-- Extend the CBILL-3 claim table: allow more than one payer per visit, add rejection tracking.
#IfMissingColumn new_scheme_claim rejection_note
ALTER TABLE `new_scheme_claim` ADD COLUMN `rejection_note` TEXT NULL AFTER `status`;

#IfNotRow2D list_options list_id insurance_claim_status option_id rejected
INSERT INTO list_options (list_id, option_id, title, seq, is_default)
VALUES ('insurance_claim_status', 'rejected', 'Rejected', 5, 0);
-- (status stays an ENUM column on new_scheme_claim itself, widened via migration; the
-- list_options row is only if a display-label lookup table is preferred over hardcoding
-- the label in the frontend -- implementer's call, matching whatever convention
-- SchemeClaimsList.tsx's buildStatusLabel-equivalent already uses.)

-- The visit-level UNIQUE constraint assumed one claim per visit; multi-payer needs one
-- claim per (visit, payer) instead.
#IfNotIndex new_scheme_claim uniq_visit_payer
ALTER TABLE `new_scheme_claim` DROP INDEX `uniq_visit`,
  ADD UNIQUE KEY `uniq_visit_payer` (`visit_id`, `insurance_company_id`);
```

```sql
-- CBILL-4a: per-payer price overrides.
#IfNotTable new_payer_price
CREATE TABLE IF NOT EXISTS `new_payer_price` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `facility_id` INT NOT NULL DEFAULT 0,
    `insurance_company_id` INT NOT NULL,
    `item_code` VARCHAR(64) NOT NULL,       -- matches FeeScheduleItem.code
    `item_name` VARCHAR(255) NOT NULL DEFAULT '',  -- snapshot for display
    `price_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `actor_user_id` BIGINT NOT NULL DEFAULT 0,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_payer_item` (`facility_id`, `insurance_company_id`, `item_code`)
) ENGINE=InnoDB COMMENT='CBILL-4a per-payer price overrides (e.g. NHIS G-DRG tariff)';
```

```sql
-- CBILL-4b: eligibility check log.
#IfNotTable new_insurance_eligibility_check
CREATE TABLE IF NOT EXISTS `new_insurance_eligibility_check` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `pid` BIGINT NOT NULL,
    `visit_id` BIGINT NULL,
    `insurance_company_id` INT NOT NULL DEFAULT 0,
    `membership_number` VARCHAR(64) NOT NULL DEFAULT '',
    `method` ENUM('ussd','phone','portal','card','other') NOT NULL DEFAULT 'other',
    `result` ENUM('eligible','not_eligible','unknown') NOT NULL DEFAULT 'unknown',
    `reference_code` VARCHAR(64) NOT NULL DEFAULT '',
    `note` VARCHAR(255) NOT NULL DEFAULT '',
    `actor_user_id` BIGINT NOT NULL DEFAULT 0,
    `checked_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_pid` (`pid`, `checked_at`)
) ENGINE=InnoDB COMMENT='CBILL-4b manual eligibility check log (no live API)';
```

```sql
-- CBILL-4c: second (or later) payer on a patient. The existing single-payer fields in the
-- module's registration meta table remain the primary payer; this table holds any
-- additional payer only -- no migration of existing data required.
#IfNotTable new_patient_payer
CREATE TABLE IF NOT EXISTS `new_patient_payer` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `pid` BIGINT NOT NULL,
    `rank` ENUM('secondary','tertiary') NOT NULL DEFAULT 'secondary',
    `payer_type` ENUM('nhis','private') NOT NULL,
    `insurance_company_id` INT NULL,        -- NULL for nhis (implicit payer)
    `membership_number` VARCHAR(64) NOT NULL DEFAULT '',
    `expiry_date` DATE NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_pid_rank` (`pid`, `rank`)
) ENGINE=InnoDB COMMENT='CBILL-4c additional patient payers beyond the primary';
```

### 5.2 Services

- **`PayerPriceService`** (new): `listOverrides(facilityId, insuranceCompanyId)`,
  `upsertOverride(...)`, `deleteOverride(id)`, `resolvePrice(facilityId, insuranceCompanyId,
  itemCode, fallbackPrice)` — the one method the cashier split screen actually calls; always
  returns a price (override or fallback), never throws on a missing override.
- **`EligibilityCheckService`** (new): `logCheck(pid, visitId, insuranceCompanyId, method,
  result, referenceCode, note, actorUserId)`, `latestForPatient(pid)` → most recent check per
  payer on file, used to render the banner badge.
- **`SchemeClaimService`** (extends CBILL-3): `previewSplit`/`recordSplitPayment` gain an
  optional per-line `insurance_company_id` (defaults to the single scheme, preserving CBILL-3
  behaviour when only one payer is on file) and call `PayerPriceService::resolvePrice` for
  the scheme-owed amount instead of always using the flat price. `listClaims` gains
  `age_bucket` (computed, not stored — same pattern as `OutstandingPane`'s bucket filter) and
  payer filter params. `setClaimStatus` accepts `rejected` with a required `rejection_note`
  when transitioning into it (mirrors the existing required-reason pattern for `void`).
- **`PatientRegistrationService`** (extends existing): reads/writes `new_patient_payer` rows
  alongside the existing primary-payer meta fields; primary payer storage is unchanged.

### 5.3 Ajax actions

| Action | Method | Notes |
|--------|--------|-------|
| `bill_ops.payer_prices` | GET | List overrides for a payer (admin, Insurance tab) |
| `bill_ops.payer_price_upsert` | POST | Add/edit a price override |
| `bill_ops.payer_price_delete` | POST | Remove a price override |
| `cashier.eligibility_check` | POST | Log an eligibility check (reception or cashier) |
| `cashier.eligibility_status` | GET | Latest check(s) for the patient banner badge |
| `bill_ops.scheme_claim_status` | POST | Extended (existing action) to accept `rejected` + `rejection_note` |
| `patients.registration.payer_add` / `payer_remove` | POST | Add/remove a secondary payer on the patient record |

### 5.4 ACL

- `bill_ops.payer_prices*` — `new_bill_ops_insurance` (same admin-only gate as the vault
  today).
- `cashier.eligibility_check` / `eligibility_status` — `new_cashier` **or** `new_reception`
  (eligibility is useful at either desk; matches where scheme selection and registration
  already happen).
- `patients.registration.payer_*` — same ACL as the rest of registration (`new_reception`).
- Every action additionally gated on `enable_payer_billing` = 1, in front of the existing
  `enable_insurance_scheme` = 1 dependency (both must be ON).

## 6. Feature flag + rollout + parity sign-off

- `enable_payer_billing` in `new_clinic_config`, default `0`, facility-scoped, wired in the
  three required admin places (install.sql, `ClinicAdminService::EDITABLE_SETTINGS`,
  `adminFieldDefs.ts`). Requires `enable_insurance_scheme` = 1 — if the prerequisite flag is
  off, `enable_payer_billing` has no effect regardless of its own value (documented, not
  silently ignored — admin UI should show it disabled/greyed with an explanatory note until
  the prerequisite is on).
- Flag OFF = CBILL-3 exactly as it behaves today: flat pricing, one payer per claim, no
  eligibility badge, no age/payer filters on the claims list, no payer-prices screen.
- **Parity sign-off:**
  (a) flag OFF — Insurance tab and cashier split screen byte-identical to current CBILL-3;
  (b) flag ON, no price overrides configured — split totals identical to CBILL-3 (fallback
  price path exercised, not the override path);
  (c) flag ON, an override exists for an item — scheme-owed total uses the override price,
  patient-pay total unaffected;
  (d) two payers on a patient's file, split screen offers both as line targets, each claim
  is a separate row keyed by `(visit_id, insurance_company_id)`;
  (e) eligibility check saved → badge shows on banner at both front desk and cashier with
  correct payer, result, and date;
  (f) claim marked rejected requires a note, appears in the rejected filter, can be
  resubmitted (→ `to_submit`) or voided;
  (g) age bucket filter matches the same day-boundary logic as Outstanding balances (shared
  test fixture, not reimplemented math).

## 7. Build slices (each shippable behind the flag, in dependency order)

1. **CBILL-4a — payer-aware pricing.** `new_payer_price` table, `PayerPriceService`, cashier
   split screen price-resolution change, admin payer-prices screen. Depends on CBILL-3.
2. **CBILL-4b — eligibility check log.** `new_insurance_eligibility_check` table,
   `EligibilityCheckService`, banner badge, "Check eligibility" action at front desk +
   cashier. Independent of 4a; can ship in either order.
3. **CBILL-4c — multi-payer patient + claim.** `new_patient_payer` table, registration
   "add a second payer," `new_scheme_claim` unique-key change + per-line payer assignment on
   the split screen. Depends on 4a (price resolution needs to work per-payer before
   per-line-per-payer makes sense).
4. **CBILL-4d — claims workbench upgrades.** Age bucket + payer filter + rejected status +
   rejection note on `SchemeClaimsList`. Depends on 4c (payer filter needs multi-payer
   claims to be meaningful; age bucket alone could ship earlier if sequencing pressure
   requires it).

None of these are built yet — this document is the design, authored before any code.

## 8. Open questions

1. **Second-payer registration UX** — is "Add a second payer" discoverable enough as a
   collapsed link, or does it need to be a visible two-row layout from the start? Proposed:
   start collapsed (most patients have zero or one payer; a visible second row by default
   adds clutter for the common case), revisit after pilot feedback.
2. **Payer-price CSV import** — worth building in 4a, or wait for a real clinic's tariff
   sheet to shape the import format? Proposed: wait — a hand-typed list is enough to prove
   the pricing mechanism works; building an importer against a guessed CSV shape risks
   guessing wrong (same caution as the deferred CLAIM-it format work).
3. **Claim batching for submission** (§2 non-scope) — genuinely deferred, but worth
   re-opening the moment a specific pilot clinic describes how they actually submit today
   (portal export vs flash drive vs an HMO's own form) rather than guessing a shape now.
4. **Does a rejected claim's note need any structure** (a reason-code picker) or stay free
   text indefinitely? Proposed: free text until enough real rejection notes accumulate to
   see if a pattern is worth codifying.

## 9. PRD amendment required

This spec needs a new PRD decision entry (**D-BILL-9**, amending NG1 further) before any
build slice starts, following the same pattern D-BILL-8 used to unblock CBILL-3:
payer-aware pricing, a manual eligibility log, multiple payers on file, and claim-list aging/
rejection tracking are permitted as flag-gated, default-OFF, **manual** extensions of the
CBILL-3 register. **Automated** claims submission, live eligibility APIs, and insurer
integrations remain non-goals (NG1/NG3 unchanged). See the companion PRD edit for the exact
wording.

## 10. Version history

| Version | Date | Author | Change |
|---------|------|--------|--------|
| v0.1.0 | 2026-07-15 | Engineering | Initial CBILL-4 design: payer-aware pricing, manual eligibility check log, multi-payer patient/claim support, claims-workbench aging + rejection tracking. Grounded in NHIS USSD eligibility (`*842#`) and G-DRG tariff research, and Ghana/Nigeria private-HMO claim-variability research. Explicitly excludes live NHIA/HMO API integration, claim batching, and COB math pending real clinic discovery. Not yet authorised — requires PRD D-BILL-9. |

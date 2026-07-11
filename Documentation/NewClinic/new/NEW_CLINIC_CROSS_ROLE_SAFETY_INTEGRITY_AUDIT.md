# New Clinic — Cross-Role Safety & Integrity Audit

| Field | Value |
|-------|--------|
| **Document version** | 0.1.0 |
| **Status** | Findings only — nothing implemented yet. Each item is design-ready, not yet scoped into a PR. |
| **Companion to** | All 7 role personas ([Akua](../NEW_CLINIC_PERSONA_NURSE_AKUA.md), [Dr. Mensah](../NEW_CLINIC_PERSONA_DOCTOR_MENSAH.md), [Labik](../NEW_CLINIC_PERSONA_LAB_TECH_LABIK.md), [Esi](../NEW_CLINIC_PERSONA_PHARMACIST_ESI.md), [Ama](../NEW_CLINIC_PERSONA_RECEPTIONIST_AMA.md), [Kofi](../NEW_CLINIC_PERSONA_CASHIER_KOFI.md), [Selorm](../NEW_CLINIC_PERSONA_ADMIN_SELORM.md)); [NEW_CLINIC_TRIAGE_URGENCY_ESCALATION_GAP.md](../done/NEW_CLINIC_TRIAGE_URGENCY_ESCALATION_GAP.md) (the finding that triggered this wider pass — shipped 2026-07-09) |
| **Researched** | 2026-07-09 — 7 parallel research passes (one per role), each independently grounded in that role's persona doc, the relevant PRD/workflows sections, direct code verification (Grep/Read against the real handlers/services/islands), and external research into real-world clinical/operational practice for that role |

---

## 0. TL;DR

A user flagged that the Nurse role had no way to escalate urgency during triage — verified true, and
documented separately. That raised the question: what else got missed? This audit repeats the same
method across all 7 roles: read what the persona/spec claims, verify against the actual code, check
against real-world practice for that profession, report only what's code-confirmed.

**17 findings, all code-verified, none speculative.** They cluster into five themes:

- **A — Patient/specimen identity** (3 findings): the same "wrong person" risk shows up independently
  at Front Desk search, at Reception's dead photo-capture feature, and at lab specimen collection.
- **B — Medication & order safety** (4 findings): allergy checking exists in exactly one place
  (Pharmacy dispense) and nowhere else a drug is ordered; no interaction/duplicate-therapy checking
  anywhere; controlled substances can be sold with no prescription.
- **C — Critical-result communication** (1 finding): lab computes an "abnormal" flag that never
  reaches the ordering doctor once the patient leaves the queue.
- **D — Triage assessment accuracy** (2 findings): vitals thresholds are fixed adult values with no
  pediatric adjustment; pain score is collected but never evaluated.
- **E — Financial integrity** (3 findings, Cashier): payment and receipt aren't written atomically;
  reconciliation doesn't account for reversed payments; there's no in-product drawer count/sign-off.
- **F — Business continuity** (3 findings, Admin): backup is a self-attested checkbox with no
  restorability check; no post-install schema self-check despite already being bitten by this bug
  class once (AUDIT-3); health chips don't link to the runbooks the floor-admin design (§8.1 of
  Selorm's persona) depends on.
- **G — Operational friction** (1 finding): the fee schedule — which Reception's own persona names as
  one of her two most-asked questions — is nowhere on the Front Desk screen.

None of these require new infrastructure, new vendors, or scope the PRD has excluded — every fix
direction reuses a pattern the codebase already has somewhere else (the ACL matrix, the audit-event
convention, `AllergyGateService`, `RevisitCompletionGateService`'s existing age-lookup, etc.).

---

## 1. Method

Each of the 7 research passes independently:
1. Read the role's persona doc in full (ground truth for claimed behavior + stated pain points).
2. Read the relevant PRD/workflows sections for that role (what's *specified*).
3. Read the actual frontend island(s) and backend handler(s)/service(s) for that role (what's
   *built* — Grep/Read, not inference).
4. Ran 2–4 targeted web searches on real-world standard practice for that specific role in a small
   outpatient setting (clinical-safety literature, patient-ID standards, cash-control practice,
   IT-continuity guidance — not generic blog content).
5. Reported a finding **only if verified against actual code** — several plausible-sounding gaps
   were checked and dropped because the code already handles them (e.g. Nurse's form-dirty guard,
   allergy chips on the triage banner, pediatric growth-chart tracking already scoped as W11).
6. Excluded anything already tracked in the SEC-1..8 hardening prompt, the G1-G11/W1-W12 gap
   analysis, or the SCALE plan, to avoid duplicate findings.

---

## 2. Theme A — Patient & specimen identity

The same failure mode — acting on the wrong person or the wrong specimen — surfaces independently
at three unrelated points in the product. None of the three cross-reference each other in code,
which is itself notable: there is no single "positive identification" pattern reused across desks.

### A1. Front Desk search auto-selects the top match and opens Start Visit with no forced re-verification

**Why it matters:** The Joint Commission's National Patient Safety Goal on positive identification
requires confirming ≥2 identifiers before any clinical action — precisely to catch same-name
mismatches. Common Ghanaian surnames (Mensah, Asante, Osei) make this a real, not theoretical, risk.
The product already has `SimilarSurnameQueueService` on the Visit Board, proving the team knows this
risk exists — it just isn't closed at the point of selection.

**Evidence:** `frontend/src/islands/front-desk/PatientSearchWidget.tsx:191` (`autoSelectFirst = true`
by default) → `frontend/src/core/usePatientSearch.ts:45-51` (`applySearchSuccess` auto-fires
`onSelectPatient(patients[0].pid)` the instant results return) → `frontend/src/islands/front-desk/useFrontDesk.ts:310-330`
(the only interrupt is for unsaved registration, never identity) → `StartVisitForm.tsx:328-339`
(Start Visit has no identity-confirm gate).

**Fix direction:** Require an explicit "Confirm: [Name], [DOB/age]" acknowledgment before Start
Visit is enabled, or suppress `autoSelectFirst` when multiple results share surname/DOB-decade.

### A2. Patient photo capture is fully built but never wired into registration — dead code

**Why it matters:** Low-resource patient-identification literature recommends photo capture
specifically because name/DOB alone is unreliable when patients lack ID and don't know exact
birthdates — exactly the "Tuesday-normal" case Ama's own persona describes. Without a photo, a
same-name/estimated-age patient returning weeks later is indistinguishable from another with an
identical profile.

**Evidence:** `frontend/src/islands/front-desk/PhotoCaptureField.tsx` is a complete, working
camera-capture component. It is imported nowhere — not in `RegistrationForm.tsx`,
`RegistrationFormSections.tsx`, or `QuickAddRegistration.tsx`.

**Fix direction:** Wire `PhotoCaptureField` into registration Section 1 or 2 as the de facto
secondary identifier when phone/ID are absent.

### A3. Specimen collection ("Mark collected") has no two-identifier check

**Why it matters:** NPSG.01.01.01 / CLIA-CAP require ≥2 identifiers verified and documented at
specimen collection — exactly the "wrong-patient" scenario Labik's persona names as his single
largest professional fear.

**Evidence:** `frontend/src/islands/lab-ops/AccessionModal.tsx:1-47` — the entire dialog is a title
and one *optional* text input (`Accession number (optional)`); no patient banner, no DOB
confirmation. `LabOpsOrderMetaService::collectSpecimen()` (`interface/modules/custom_modules/oe-module-new-clinic/src/Services/LabOpsOrderMetaService.php:28-62`)
accepts a nullable accession number and proceeds identically either way.

**Fix direction:** Require accession entry or an explicit "confirmed patient identity (name + DOB)"
checkbox before `specimen_collect` can submit.

---

## 3. Theme B — Medication & order safety

Allergy checking exists in exactly one place in the whole product — Pharmacy's dispense-time
`AllergyGateService`. Every other point a drug or test is ordered has no equivalent safety net,
including a *newer* fast-path that bypasses even the one gate that does exist.

### B1. The doctor's "quick prescribe" fast path bypasses the allergy gate entirely

**Why it matters:** Drug-allergy checking before an order is finalized is a baseline CPOE safety
standard (ONC/HealthIT.gov CPOE certification criteria) — not a workflow nicety.

**Evidence:** The only allergy check on the doctor's side is `ConsultShortcutService::preflight()`
(`.../Services/ConsultShortcutService.php:71-77`), which fires *only* for the legacy `'rx'` shortcut
deep-linking to stock OpenEMR's prescription screen, and even that only checks "has any allergy been
documented" — not against the actual drug. The newer, faster
`PharmFormularyRxService::placePrescriptions()` (`doctor.formulary_rx_place` in
`DoctorActionHandler.php:263-275`) inserts directly into `prescriptions`
(`PharmFormularyRxService.php:285-323`) with **zero** call to any allergy or interaction check —
contrast directly with Pharmacy's `AllergyGateService::assertDocumented()`
(`AllergyGateService.php:28-33`), used at dispense.

**Fix direction:** Route `placePrescriptions()` through the same `require_allergies_for_rx` gate
before insert.

### B2. No drug-drug interaction or duplicate-therapy check anywhere in the dispense/OTC flow

**Why it matters:** Community-pharmacy safety practice treats interaction/duplicate-therapy
screening as a core safety net alongside allergy checking. Esi is the clinic's only pharmacy-trained
safety check (her own persona, §10) — if the tool doesn't even show her the patient's other active
medications, she's flying blind on interactions no one can be expected to remember from a paper
chart glance.

**Evidence:** `PharmOpsDispenseService::getDispenseForm()`/`confirmDispense()`
(`.../Services/PharmOpsDispenseService.php:48,94,137-141`) and
`PharmOpsOtcSaleService::confirmSale()` (`.../PharmOpsOtcSaleService.php:180-183`) call only
`loadAllergies($pid)` / `PharmOpsSafetyService::hasDrugAllergyWarning()` — token-matching against
allergy titles only. `frontend/src/islands/pharm-ops/PharmOpsDispenseDrawer.tsx:43-263` renders only
an allergy panel; no current-medications list is fetched or shown at all.

**Fix direction:** Not a full licensed DDI database (First Databank/Medi-Span) — that's a vendor/cost
decision out of scope for a small-clinic V1. Realistically buildable: surface the patient's other
active `prescriptions`/`drug_sales` as an "also currently taking" list, plus a small in-house
duplicate-therapy/class-clash table using the same token-matching approach already used for
allergies.

### B3. No duplicate-order/duplicate-therapy check on the doctor's quick-prescribe or quick-lab-order paths

**Why it matters:** Duplicate-therapy checking is bundled with allergy/interaction CDS as a
recognized CPOE safety feature to prevent inadvertent double-dosing or duplicate testing.

**Evidence:** Neither `PharmFormularyRxService::placePrescriptions()` nor
`LabPanelOrderService::placeOrder()` (`.../Services/LabPanelOrderService.php:83-150`) queries
existing active `prescriptions`/`procedure_order` rows for the same drug/test before inserting.

**Fix direction:** Add an existing-active-order check (warn, not hard-block) before insert in both
services.

### B4. Controlled substances can be sold via "Sell OTC" with no prescription requirement; the controlled-drug register is retrospective, not a running-balance ledger

**Why it matters:** This is a **legal/regulatory** finding, not just a safety one. Ghana FDA's
Guidelines for the Sale, Supply and Use of Controlled Drugs require controlled drugs be "dispensed
only upon receipt of a valid prescription," and mandate a Controlled Drugs Register with a running
balance recalculated after every transaction — direct license accountability, exactly what Esi's
persona says she personally protects.

**Evidence:** `PharmOpsOtcSaleService::loadDrugRow()` (`.../PharmOpsOtcSaleService.php:277-288`)
filters sellable drugs by `active = 1 AND dispensable = 1` only — no `is_controlled` check, so a
controlled item can be sold OTC with no prescription and no witness field.
`PharmOpsControlledRegisterService::fetchRegister()` (`.../PharmOpsControlledRegisterService.php:41-99`)
is explicitly commented "placeholder" and derives figures via a `UNION` query at report time — no
computed running balance exists per transaction.

**Fix direction:** Block `is_controlled = 1` drugs from the Sell-OTC path (require a
prescription-linked dispense instead), and add a computed running-balance column or dedicated ledger
table updated per transaction.

---

## 4. Theme C — Critical-result communication

### C1. Lab computes an "abnormal" flag that never reaches the ordering doctor once the patient leaves the queue

**Why it matters:** CLIA 1988 and CLSI GP47 ("Management of Critical and Significant-Risk Results")
mandate immediate, *distinct* notification for life-threatening results, separate from routine
reporting. This is the exact patient-safety failure mode Dr. Mensah's persona names as his top fear
about late orders, and Labik's persona names as his top professional fear about results — the gap
sits precisely at the handoff between their two roles.

**Evidence (lab side):** `LabOpsResultService::orderHasAbnormal()`
(`.../Services/LabOpsResultService.php:515-527`) and the `$abnormal` computation in
`releaseOrder()` (`:157-179`) exist and are correct — but the value is only ever logged to an audit
event, never passed to any notification path. **Evidence (doctor side):**
`DoctorReadyNotifyService.php:34-44` only triggers on `state === 'ready_for_doctor'` for a *new*
visit entering the queue; `labResultsToast.ts:27-84` and `useDoctorDeskQueue.ts:126` read only the
boolean `routing_chips.results_ready` — severity-blind, and scoped to the live queue, which stops
including the visit once it leaves `ready_for_doctor`/`with_doctor`. The only fallback,
`DoctorService::fetchReopenableToday()` (`:440-464`), is a passive, non-notifying list scoped to
`visit_date = today` — a next-day abnormal result has no surfacing mechanism at all.

**Fix direction:** Extend `DoctorReadyNotifyService` (or a sibling) to fire on `orderHasAbnormal()`
for the ordering provider regardless of current visit state, independent of the "today only"
reopenable window — and give it a visually distinct, non-dismissible treatment on the Doctor Desk,
not the same toast as routine "results ready."

---

## 5. Theme D — Triage assessment accuracy

### D1. Vitals abnormal-range thresholds are fixed adult values with no age adjustment

**Why it matters:** Normal vital signs differ sharply by age — a well infant's resting heart rate of
100–150 bpm is normal under pediatric references but would be flagged abnormal under adult ranges,
while a genuinely dangerous low pulse for an infant sits comfortably inside the adult "normal" band
and would never be flagged. For a clinic serving a normal mix of children, this risks both false
reassurance on a sick infant and alarm fatigue on well ones — either erodes the clinical trust
Akua's persona says is fragile.

**Evidence:** `VitalsValidationService.php:21-31` (fixed numeric ranges, e.g. pulse 20–250 for
everyone) and `:171-182` (`warningThresholds()` — pulse warn band 50–120, temp 35–38.5°C, applied
uniformly regardless of age; no `$patientAge`/DOB parameter anywhere in the class or its callers).
Notably, `RevisitCompletionGateService.php:158-183` *already computes patient age and treats
under-5s specially* for a different purpose — the DOB/age plumbing this fix needs already exists in
the codebase, it's just never wired into vitals evaluation.

**Fix direction:** Pass patient age into `VitalsValidationService::warningThresholds()`/
`evaluateWarnings()` and branch to age-banded pulse/RR/BP ranges before rendering any warning.

### D2. Pain score (0–10) is collected but never evaluated for a warning

**Why it matters:** Standard triage acuity tools (ESI) explicitly use severe pain/distress as a
criterion for elevating a patient's triage level (ESI Level 2 = "severe pain/distress"). A patient
entering "10/10" currently looks visually identical to "0" everywhere in the product.

**Evidence:** `VitalsValidationService.php:30` defines `pain` with min/max for form validation only
— `warningThresholds()` (`:171-182`) has no `pain` case, and neither `evaluateFieldWarning()`
(`:146-166`) nor `evaluateWarnings()` (`:200-231`) reference it. Confirmed downstream: `pain_score`
renders as plain text with no conditional styling anywhere (`patient-chart/OverviewTab.tsx:369-373`,
`ClinicalTab.tsx:159-162`).

**Fix direction:** Add a severe-pain threshold (e.g. ≥7/10) to `warningThresholds()`/
`evaluateWarnings()` so it drives the same amber field warning and "Vitals abnormal" banner chip
every other vital already gets.

---

## 6. Theme E — Financial integrity (Cashier)

### E1. Payment posting and receipt writing are not atomic

**Why it matters:** Standard cash-control practice requires every settled sale to produce a
sequentially-numbered receipt tied atomically to the tender. A payment that "goes through" with no
receipt is exactly the ambiguous state Kofi's own mobile-money-trained instincts exist to prevent
("'Pending' is a word for other people's money").

**Evidence:** `CashierService::recordPayment()` — the DB transaction covers only
`postPatientPayment` + the queue-state transition (`interface/modules/custom_modules/oe-module-new-clinic/src/Services/CashierService.php:318-343`);
`issueReceipt()` is called afterward at line 353, **outside** that transaction and any try/catch. If
that insert fails, core AR already shows the revenue and the visit is `completed`, but `new_receipt`
— the exact table `ReconciliationService` sums for both totals — has no row, so the discrepancy is
invisible to daily reconciliation.

**Fix direction:** Wrap `postPatientPayment` + queue transition + the `issueReceipt` insert in one
atomic transaction.

### E2. Daily reconciliation math never subtracts reversed payments

**Why it matters:** Internal cash-control practice treats reversals as a distinct, separately-tracked
category precisely because they're where shrinkage hides. A reconciliation blind to reversals can
show "balanced" on a day where cash actually left the drawer with no matching adjustment.

**Evidence:** `ReconciliationService::fetchTotals()` (`ReconciliationService.php:232-261`) sums
`new_receipt.amount_paid` and joins to `payments`, with zero references to `reversed_at` anywhere in
the file. `BillOpsPaymentsSearchService` reverses a receipt by marking `reversed_at`/
`reversal_reason` on the *same row* and posting an offsetting negative `ar_activity` entry
(`BillOpsPaymentsSearchService.php:151-206`) — but since that entry isn't tied to its own
`new_receipt` row, both reconciliation totals still include the original, now-reversed amount
unchanged.

**Fix direction:** Exclude `reversed_at IS NOT NULL` receipts from `module_total`, and net reversal
amounts into `core_total`.

### E3. No in-product "count my drawer, compare to system, sign off" action exists

**Why it matters:** This is the textbook control (X/Z-report-style over/short capture with cashier
sign-off) that makes a drawer's "balances to zero" claim auditable rather than merely asserted.
Without it, there is no record of what Kofi actually counted, when, or that he attested to it — only
a verbal/paper report to the manager the next morning, which the persona doc itself confirms is the
current state.

**Evidence:** Exhaustive search of `frontend/src/islands/cashier-desk/**` and the module's schema for
shift/drawer/cash-count/over-short/denomination concepts returns nothing — `ReconciliationService`
only ever compares two *system-side* totals, never a physically-counted figure.

**Fix direction:** Add a lightweight end-of-day "counted cash" entry on the Cashier Desk (single
number + optional note, cashier ACL, timestamped) that `ReconciliationService` stores and diffs
against `module_total`.

---

## 7. Theme F — Business continuity (Admin)

### F1. "Backup" is a self-attested checkbox with zero integrity/restorability verification

**Why it matters:** Standard small-business continuity guidance treats an unverified backup as
equivalent to no backup — the bar is "provably restorable," not "a job ran." This directly
contradicts Selorm's own stated practice ("twice a year we restore one, and twice a year I sleep
better" — her persona's own representative quote).

**Evidence:** `AdminHealthService::initiateBackup()`/`completeBackup()`
(`.../Services/AdminHealthService.php:86-173`) only insert/update a `status` string when the admin
clicks a button — no mysqldump is triggered, no file is written by the module, and `file_path`
(schema at `sql/install.sql:965`) is never populated anywhere. The RB-19 restore runbook just links
to stock `backup.php` with no restore-test date ever recorded.

**Fix direction:** Require `completeBackup()` to record an actual artifact (size + checksum) before
marking success, and add a `restore_tested_at` field surfaced as a health chip that goes amber past
~180 days.

### F2. No post-install/schema self-check exists, despite Selorm's persona explicitly requesting one and the codebase already having been bitten by this exact bug class once

**Why it matters:** Config-drift/fresh-install verification is standard small-IT-shop
change-management practice, and it's the concrete gap Selorm's own persona §8 names: "a post-install
self-check... would convert her staging paranoia into a product feature." AUDIT-3 (the
`recall_type` column missing on a fresh single-pass install, now fixed) was exactly this bug class —
nothing prevents its sibling from happening again undetected.

**Evidence:** No self-check/schema-verification pattern exists anywhere under
`interface/modules/custom_modules/oe-module-new-clinic/src` — `AdminHealthService` has no chip for
schema/table drift beyond the already-fixed `acl_version` consolidation.

**Fix direction:** A lightweight chip/CLI comparing `INFORMATION_SCHEMA` against the tables/columns
`install.sql`/`upgrade_sql.php` expect, surfaced red/amber on the health panel.

### F3. Health chips carry no runbook link, failing the floor-admin acceptance bar the persona itself just set

**Why it matters:** Selorm's persona §8.1 (added 2026-07-09, in the same batch as the earlier
persona-hardening pass) states the explicit design floor: *"could the owner-doctor complete this
with the runbook alone? If not, it serves only the ceiling."* A health chip with no runbook pointer
fails that bar directly — and §10 of the same persona says the non-Selorm staffing pattern is the
*common* case, not the exception.

**Evidence:** `AdminHealthService::chipPayload()` (`AdminHealthService.php:462-482`) returns
`key/label/status/summary/detail/action_label/action_available/overall_impact` — no `runbook_id`/
`runbook_url` field. `SystemHealthBoard.tsx:63-95` renders only `chip.detail` text and an action
button, never an RB-xx reference, even though `AdminRunbookService.php` already has the structured
RB-01..RB-20 catalog to link from.

**Fix direction:** Add `runbook_id` to `chipPayload()`, wire it to `AdminRunbookService`'s existing
catalog, render "How to fix — RB-01" as a link in `SystemHealthBoard.tsx`.

---

## 8. Theme G — Operational friction (Reception)

### G1. No fee schedule is exposed anywhere on the Front Desk

**Why it matters:** Ama's own persona doc names "how much?" as one of her two most-asked questions
and states an explicit product requirement: *"the fee schedule and queue state need to be answerable
at a glance without leaving her screen"* (persona §4/§8). This finding is a direct contradiction of
an already-stated requirement, not a newly discovered need — real revenue-adjacent friction results
dozens of times a day when she has to guess or leave her screen.

**Evidence:** `VisitTypeAdminService::listForDesk()`
(`.../Services/VisitTypeAdminService.php:218-259`, the exact query powering the Front Desk
visit-type dropdown) selects only `id, label, service_profile, pc_catid, referral_required` — no
fee/amount field. `FeeScheduleAdminService.php` exists in the codebase but is never surfaced to
Reception.

**Fix direction:** Add a fee hint (price or range) to `listForDesk`'s payload and render it inline
next to the visit-type selector in `StartVisitForm.tsx`.

---

## 9. Doc-drift correction found along the way

Labik's persona ([NEW_CLINIC_PERSONA_LAB_TECH_LABIK.md](../NEW_CLINIC_PERSONA_LAB_TECH_LABIK.md) §5)
names "send-out limbo" (no tracked state for a specimen sent to an external lab) as a live
frustration. Verified during this pass: **this is already fixed.**
`LabOpsWorklistService.php:155-184,287-303` and `new_lab_order_meta`
(`sql/install.sql:784-799` — `fulfillment`, `requisition_printed_at`, `collected_at`) fully track a
distinct "Send-out · not collected" / "Send-out · awaiting results" state via a dedicated tab. This
is the same class of drift the persona-hardening pass on 2026-07-09 already fixed elsewhere — see
the persona's own version history. Corrected in the same batch as this document (see
NEW_CLINIC_PERSONA_LAB_TECH_LABIK.md v1.1.3 history row).

---

## 10. Non-goals for this audit

- **No full licensed drug-interaction database** (First Databank/Medi-Span or similar) — B2's fix
  direction is an in-house token-match list, not a vendor integration; a real DDI feed is a cost/
  vendor decision outside this audit's scope.
- **No ESI-style algorithmic acuity scoring** — D1/D2 ask for threshold adjustments and a missing
  evaluation, not a new scoring engine.
- **No changes to any deliberate PRD non-goal** (portal, telehealth, FHIR/SMART, claims/EDI, DICOM,
  fax) — none of these findings touch that boundary.
- **Session-kill-on-deactivate** was investigated for the Admin pass but not confirmed as a gap or
  a non-gap with enough certainty to report either way — flagged here as unresolved, not as a
  finding, so it isn't silently dropped.

---

## 11. Suggested sequencing (not yet authorized — a scope decision for the user)

If/when this moves to implementation, the natural order by blast radius and shared plumbing:

1. **Identity findings (A1–A3)** first — they reinforce each other thematically and the fixes are
   independent/parallelizable across three different desks.
2. **Medication safety (B1–B4)** next — B1 (route the existing gate) and B4 (block controlled OTC
   sales) are both small, surgical fixes; B2/B3 are the larger net-new features.
3. **C1 (critical-result notification)** — touches both Doctor and Lab; do after A/B so the
   notification plumbing can reuse whatever pattern comes out of B1's gate-routing work.
4. **D1–D2 (vitals)** — small, isolated, no dependency on anything else; could ship anytime.
5. **E1–E3 (Cashier)** and **F1–F3 (Admin)** are independent tracks from the clinical findings and
   from each other — sequence by whichever the clinic's actual risk appetite prioritizes.
6. **G1 (fee schedule)** — smallest, most isolated fix; could go first as a quick win if desired.

---

## 12. Sources

Consolidated from all 7 research passes (2026-07-09):

- [Two Patient Identifiers — Joint Commission NPSG](https://www.jointcommission.org/standards/standard-faqs/critical-access-hospital/national-patient-safety-goals-npsg/000001545/)
- [Drug-Drug, Drug-Allergy Interaction Checks for CPOE — HealthIT.gov](https://www.healthit.gov/test-method/drug-drug-drug-allergy-interaction-checks-cpoe)
- [Eight Recommendations for Policies for Communicating Abnormal Test Results](https://www.sciencedirect.com/science/article/abs/pii/S1553725010360375)
- [Critical Lab/Radiology Results Not Communicated — Painter Law Firm](https://painterfirm.com/medmal/what-happens-when-critical-lab-or-radiology-results-are-not-communicated-to-the-doctor/)
- [Critical laboratory values communication: summary recommendations — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5107409/)
- [Critical values notification: a nationwide survey across Nigeria — PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10729493/)
- [Pediatric Vital Signs Ranges and Charts — ACLS](https://aclsnow.com/blog/pediatric-vital-signs-normal-ranges/)
- [Pediatric Vital Signs by Age: Charts and Ranges](https://www.emedicinehealth.com/pediatric_vital_signs/article_em.htm)
- [Emergency Severity Index (ESI) Handbook, 5th Edition](https://media.emscimprovement.center/documents/Emergency_Severity_Index_Handbook.pdf)
- Pharmacy drug-interaction screening practice (Pharmacy Times; PMC12921910; PMC10572962)
- Ghana FDA Guidelines for the Sale, Supply and Use of Controlled Drugs (controlled-drug register /
  running-balance requirement)

---

## Document history

| Version | Date | Changes |
|---|---|---|
| 0.1.0 | 2026-07-09 | Initial cross-role audit: 7 parallel research passes (Nurse, Doctor, Lab, Pharmacy, Reception, Cashier, Admin), 17 code-verified findings across identity, medication safety, critical-result communication, triage accuracy, financial integrity, business continuity, and operational friction; one doc-drift correction found and fixed (Labik persona) |

# New Clinic — User Persona: Esi Adjei, Pharmacist

| Field | Value |
|-------|--------|
| **Document version** | 1.1.0 |
| **Companion to** | [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) §4 (Roles and landing screens), §8.5 (Pharmacy — Pharmacy Desk), §8.5a (Pharmacy walk-in triage), §8.5b (OTC counter sale), §8.4c (Pharmacy Operations Hub) |
| **Last audited** | 2026-07-07 — spec anchors and product claims verified against code (see [NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md](./NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md)) |
| **Audience** | Product, design, trainers, QA, implementers |
| **Purpose** | Ground design and copy decisions for the Pharmacy Desk, Pharmacy Operations Hub, and allergy/dispense gates in a real counter worker's day |

> Composite persona for design purposes — no real name, facility, or patient data is used. Claims
> about Ghanaian pharmacy licensing reflect general, stable knowledge of the system rather than a
> specific individual.

---

## 1. Snapshot

| | |
|---|---|
| **Name** | Esi Adjei |
| **Age** | 39 |
| **Role** | Pharmacist — runs the in-house pharmacy counter: dispensing against doctor Rx, OTC counter sales, external-prescription verification, and (post-pilot) clinic-wide pending-dispense and stock work |
| **Experience** | 15 years, starting in community/retail pharmacy before moving into clinical/outpatient pharmacy practice |
| **Credential** | BPharm (or PharmD-track equivalent); licensed and annually renewed with the **Pharmacy Council of Ghana** |
| **Location** | Sole pharmacist at a private cash-only outpatient clinic with an in-house pharmacy counter; the clinic's only pharmacy-trained staff member, so she is also its de facto medicines-safety authority |
| **Household** | Married with one child (age 5); her husband's more flexible work schedule covers most school pickups, which she is grateful for given how unpredictable her own counter traffic can be |
| **In the product** | Maps to the **Pharmacy** role in [§4 Roles and landing screens](./NEW_CLINIC_V1_USER_WORKFLOWS.md#4-roles-and-landing-screens) — landing screen **Pharmacy Desk**, plus **Pharmacy Operations** (post-pilot) and full chart (meds tab) access |

---

## 2. Career journey

- **Training:** Bachelor of Pharmacy degree, followed by a mandatory internship year (rotating through community and hospital pharmacy settings) and Pharmacy Council of Ghana licensing examinations.
- **Early career (years 1–6):** Community/retail pharmacy — high OTC counter volume, constant informal triage of walk-in customers deciding for themselves whether they need a doctor, and the first years of learning to say no to a customer who wants a prescription-only medicine without a script.
- **Mid-career (years 7–11):** Hospital outpatient pharmacy — more structured dispensing against doctor orders, formal allergy/interaction checking discipline, and her first real exposure to any kind of electronic dispensing log (a basic in-house tool, not a full EMR).
- **Recent (years 12–15):** Sole pharmacist at her current private clinic, running both the doctor-order dispensing counter and OTC sales from the same station. Has trained the clinic's cashiers on which fee lines come from her counter and why.
- **Digital exposure:** Confident with structured data-entry screens (drug names, quantities, lot numbers) from her hospital pharmacy years; less confident with anything requiring free-text clinical narrative, which she keeps deliberately short and templated.

---

## 3. A day in her life (mapped to the product)

| Time | What happens | Where it touches New Clinic |
|------|--------------|------------------------------|
| 8:30am | Opens **Pharmacy Desk** (or, once enabled, **Pharmacy Operations**) to see the pending-dispense queue for the morning's early consults | §8.5 step 1, §8.4c step 1 |
| Throughout | **Take patient** binds her session before she dispenses against the core Rx/drug inventory or the **Dispense** slide-over (when the ops hub is enabled); confirms quantity and lot before completing | §8.5 steps 2–3, §8.4c step 3 |
| Several times a day | A customer walks up wanting something without ever having a visit — she uses **Sell OTC**, which creates a `drug_sales` row with **no** prescription row and does **not** appear on the hub's pending worklist, since it was never a doctor order | §8.5b |
| On ancillary/pharmacy-walk-in days | Works from `service_profile = pharmacy_walkin` intake — decides herself, patient by patient, whether the need is OTC, an external paper Rx to verify, or something requiring a doctor she doesn't have available that day | §8.5a |
| Before every dispense | Documents the patient's allergies (or explicitly "None known") on the chart — she treats this as non-negotiable, and the product backs her up by blocking **Pharmacy complete** until it's done | §8.5a step 3e |
| When the allergy cross-check chip fires | Reviews the class-match warning; if she still proceeds, writes a real reason (≥10 characters) rather than a throwaway acknowledgment — she's aware the chip alone is not a substitute for actually documenting the allergy | §8.5a step 3f |
| End of each dispense | **E-Signs** the pharmacy service note, then completes **Pharmacy complete**, which is blocked if any in-house Rx on the encounter is still undispensed unless she documents an override reason | §8.5 step 4, §8.5a steps 4–5 |
| Occasionally | A walk-in genuinely needs a prescription she can't fill (no script, no doctor on duty, or the patient declines to see one) — she records the specific reason code and closes the visit without a dispense, which she takes seriously since it's the difference between "we couldn't help" and "we didn't try" | §8.5a steps 3c–3d |
| Occasionally | A queued patient **declines their Rx today** (cost, changed mind, will buy elsewhere) — instead of forcing the dispense flow or the undispensed override, she uses **Skip to payment** with a documented reason so the patient goes straight to the cashier; PRD names this the alternate path to the undispensed-Rx gate (D-PHARM-5) | §8.5 step 5 (Optional Skip to payment), PRD M9-F06/M9-F21, `new_visit_skip_queue` ACL |

---

## 4. Goals and motivations

- **Never dispense against an undocumented allergy.** This is her strongest professional instinct and the one area where she wants the system to be strict with her, not permissive — a blocked **Pharmacy complete** until allergies are documented is a feature to her, not friction.
- **Keep OTC sales honest and separate from prescription dispensing.** She's protective of the distinction between a `drug_sales` counter sale and a real `prescriptions` row — conflating them, even accidentally, would blur accountability for what was actually prescribed versus sold over the counter.
- **Verify external prescriptions properly, every time.** Transcribing prescriber name, registration/ID, and Rx date isn't paperwork to her — it's the only real check she has against a forged or altered script, and she resents any UI shortcut that makes skipping a field feel easy.
- **Be the clinic's actual stopping point for inappropriate Rx requests**, and have that decision respected upstream — when she records `rx_required_refer_to_opd` or `rx_required_patient_declined`, she wants that to read clearly to anyone reviewing the visit later, not look like an unexplained dead end.
- **Move fast enough that the counter doesn't become the clinic's bottleneck**, especially on days she's doing both hub-based pending dispenses and walk-in OTC/triage simultaneously.
- **Protect her license the same way the nurse and doctor protect theirs** — every dispense and every override reason she writes is something she could be asked to explain later.

---

## 5. Frustrations and pain points

- **Two queues that must never merge in her head or on screen** — the visit-scoped **Pharmacy Desk** (patient in the building, part of the FSM) and the clinic-wide **Pharmacy Operations Hub** (pending-dispense/low-stock worklist, prescription rows only, no OTC) need to stay visually and functionally distinct, exactly as the training one-liner describes; a UI that blurs them risks her dispensing against the wrong context.
- **OTC sales feeling like an afterthought.** Because OTC counter sales don't appear on the hub's pending worklist by design, she needs the **Sell OTC** path to still feel like a first-class, well-supported action rather than a workaround bolted onto a prescription-focused tool.
- **Allergy documentation treated as a checkbox instead of real information.** She specifically distrusts any pattern where a cross-check chip acknowledgment could be mistaken for "the allergy is documented" — the two are deliberately kept separate in the product's rules, and the UI needs to reinforce that distinction rather than let staff conflate them under time pressure.
- **External-Rx verification friction in the wrong direction.** She wants friction on *skipping* required fields (prescriber name, registration/ID, Rx date), not friction on *entering* them quickly when she's doing it correctly — slow, clunky data entry here just tempts staff to eventually take a manager override shortcut instead of doing the check properly.
- **Ambiguity around "why we didn't dispense."** The reason codes (`rx_required_refer_to_opd`, `rx_required_no_doctor_available`, `rx_required_patient_declined`) matter to her because they protect her professionally — if the UI makes these hard to find or easy to skip in favor of just closing the visit, she loses the documented trail that shows she made the right call.
- **Undispensed-Rx block feeling punitive rather than protective** if the override-reason flow is clunky — she agrees with the rule in principle (don't let a patient pay and leave with an Rx never actually filled) but wants the override path, when legitimately needed, to be quick and clearly logged rather than a dead end.
- **Lot and quantity confirmation during a rush** — partial dispense on short stock is a real, frequent scenario for her, and a fumbly slide-over here directly slows the busiest part of her day.

---

## 6. Technology and device profile

| Aspect | Detail |
|---|---|
| **Primary device at work** | A desktop at the pharmacy counter, positioned so she can see the queue while also facing walk-up customers |
| **Personal device** | A mid-range smartphone — mostly used for mobile money and messaging suppliers about stock deliveries |
| **Browser habits** | Simple, few tabs; not inclined to customize settings herself |
| **Typing speed** | Fast for structured fields (drug names, quantities, lot numbers, dates); more deliberate and careful with free-text reason fields since she knows those become part of the record |
| **Trust in software** | High trust in strict gates that match her own professional caution (e.g. allergy-documentation blocks); low patience for friction that doesn't map to an actual safety or accountability reason |
| **Language** | Fluent English (dispensing records, Pharmacy Council documentation); speaks Twi and Fante with most patients depending on their background |
| **Currency/units** | Local currency (GHS) for every fee line she's responsible for auto-suggesting or confirming; standard local date format DD/MM/YYYY |

---

## 7. Representative quotes

> "Ask me for the allergy every single time. I would rather the system be strict with me here than fast."

> "An OTC sale and a prescription are not the same thing, and if the screen ever makes them look the same, that's the day something goes wrong that I can't explain later."

> "When I write down why I didn't dispense, that sentence is doing real work — it's the difference between 'we couldn't fill this safely' and 'we just didn't bother.'"

> "Let me move fast on the parts I've already checked. Slow me down on the parts I haven't."

---

## 8. How the New Clinic product should serve her

Direct implications for the Pharmacy Desk, Pharmacy Operations Hub, and dispense gates, cross-referenced to existing product rules:

- **Allergy documentation gate before Pharmacy complete must stay strict and cannot be satisfied by chip acknowledgment alone** — this matches her own professional standard exactly; any product change here should be reviewed against her trust in the system's rigor, not just usability metrics.
- **Sell OTC must be a fully supported, fast, first-class action** even though it deliberately doesn't appear on the hub's pending-dispense worklist — the absence from that worklist is correct by design (it was never a doctor order), but the action itself needs equal polish to prescription dispensing.
- **External-Rx transcription fields (prescriber name, registration/ID, Rx date) should be quick to fill correctly and hard to skip incorrectly** — friction should sit on the "leave it blank" path, not on the "enter it properly" path; manager override for unverifiable fields should stay a deliberate, logged exception (§6.1k), not a routine shortcut.
- **Reason codes for non-dispense outcomes** (`rx_required_refer_to_opd`, `rx_required_no_doctor_available`, `rx_required_patient_declined`) **should be easy to find and select precisely**, since these are her documented defense for a clinically correct "no" — burying them behind extra clicks undermines the very accountability they're meant to provide.
- **Undispensed-Rx block on Pharmacy complete should have a fast, clearly logged override path** for legitimate cases, so the safety rule doesn't turn into a workflow dead end during a busy counter rush.
- **Skip to payment (with a required reason) must stay available as the honest alternative to that override** — when a patient declines their Rx today, skipping to the cashier with reason "Patient declined Rx today" is the *correct* record, and PRD D-PHARM-5 explicitly keeps it as the alternate path beside the undispensed gate (M9-F06/M9-F21). ⚠️ **Known regression (2026-07-07):** the codebase audit found the skip UI was accidentally removed from the Pharmacy and Lab desks in the 2026-07-06 desk redesign while the backend stayed intact — restoration is tracked as **AUDIT-1** in the [audit roadmap](./NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md). Until it lands, her only path for a declined Rx is the override flow the skip was designed to avoid.
- **Partial-dispense (short stock) and lot/quantity confirmation in the Dispense slide-over must be quick under pressure** — this is a frequent, not exceptional, part of her day; any added friction here compounds across every short-stock item, every day.
- **Desk vs. hub distinction, and OTC vs. prescription distinction, must both be visually unmistakable** — she is the one person in the clinic for whom conflating these categories is a direct professional and safety risk, not just a UX inconsistency.

---

## 9. Non-goals for this persona

This persona does **not** drive requirements for triage/vitals (Nurse), consult/ordering decisions (Doctor), specimen/result workflows (Lab), or cashier/payment flows beyond the fee lines her counter generates. Stock receiving and purchase-lot management (manager-run, §7.23 wizard) are referenced only where they intersect her dispense flow, not as a full requirement set for this persona.

---

## 10. Background: Ghanaian pharmacy licensing context (for readers unfamiliar with it)

- Pharmacists in Ghana complete a Bachelor of Pharmacy (or equivalent) degree followed by a mandatory internship year and licensing examinations.
- Ongoing registration and practice are regulated by the **Pharmacy Council of Ghana**, which maintains the professional register — Esi's insistence on documented allergy checks, verified external prescriptions, and clearly reasoned non-dispense outcomes reflects direct professional and legal accountability under this licensing body, not personal preference.
- Small private outpatient clinics of the kind New Clinic targets commonly run a single in-house pharmacist covering both doctor-order dispensing and walk-in OTC/triage from one counter — this dual load, and her role as the clinic's only pharmacy-trained safety check, is why her frustrations center on gates that protect her judgment rather than pure speed.

---

*Maintained alongside [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) and the other role personas ([Ama](./NEW_CLINIC_PERSONA_RECEPTIONIST_AMA.md), [Akua](./NEW_CLINIC_PERSONA_NURSE_AKUA.md), [Dr. Mensah](./NEW_CLINIC_PERSONA_DOCTOR_MENSAH.md), [Labik](./NEW_CLINIC_PERSONA_LAB_TECH_LABIK.md), [Kofi](./NEW_CLINIC_PERSONA_CASHIER_KOFI.md), [Selorm](./NEW_CLINIC_PERSONA_ADMIN_SELORM.md)). If the Pharmacy role's ACL, dispense gates, or OTC rules change, revisit §3 and §8 of this persona for drift.*

---

## Document history

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-07-07 | Initial persona |
| 1.1.0 | 2026-07-07 | Audited against code: allergy gate verified real and blocking (`AllergyGateService::assertDocumented` → `AllergiesUndocumentedException`), `pharmacy_walkin` profile and all three `rx_required_*` reason codes verified in `PharmacyWalkinService`. **Added the missing Skip-to-payment path** (D-PHARM-5 alternate to the undispensed gate) to §3 and §8, with a warning that the skip UI is currently regressed (AUDIT-1). Added history table + README index entry |

# New Clinic — User Persona: Kwabena "Labik" Owusu, Medical Laboratory Technologist

| Field | Value |
|-------|--------|
| **Document version** | 1.1.0 |
| **Companion to** | [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) §4 (Roles and landing screens), §8.4 (Lab — Lab Desk), §8.4a (Lab-direct intake), §8.4b (Lab Operations Hub) |
| **Last audited** | 2026-07-07 — spec anchors and product claims verified against code (see [NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md](./NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md)) |
| **Audience** | Product, design, trainers, QA, implementers |
| **Purpose** | Ground design and copy decisions for the Lab Desk and Lab Operations Hub in a real bench worker's day |

> Composite persona for design purposes — no real name, facility, or patient data is used. Claims
> about Ghanaian allied health licensing reflect general, stable knowledge of the system rather
> than a specific individual.

---

## 1. Snapshot

| | |
|---|---|
| **Name** | Kwabena Owusu — goes by **"Labik"** on the floor, the nickname staff and doctors actually use day to day (short for "Lab" + a shortened form of his name) |
| **Age** | 40 |
| **Role** | Medical Laboratory Technologist — runs the in-house lab bench: specimen collection, basic haematology/chemistry/microbiology panels, results entry, and send-out coordination for tests beyond the clinic's in-house capacity |
| **Experience** | 15 years, split roughly evenly between a public hospital laboratory and his current private clinic |
| **Credential** | HND or BSc in Medical Laboratory Technology/Science; licensed and annually renewed with the **Allied Health Professions Council of Ghana (AHPC)** |
| **Location** | Sole lab bench operator at a private cash-only outpatient clinic; occasionally the only person on duty who can process a sample, which makes him a bottleneck he's very aware of |
| **Household** | Single, supports his mother and a younger sibling still in school; picks up occasional weekend shifts at a diagnostic center for extra income |
| **In the product** | Maps to the **Lab** role in [§4 Roles and landing screens](./NEW_CLINIC_V1_USER_WORKFLOWS.md#4-roles-and-landing-screens) — landing screen **Lab Desk**, plus **Lab Operations** (post-pilot) and full chart (labs tab) access |

---

## 2. Career journey

- **Training:** Diploma/HND in Medical Laboratory Technology, followed by mandatory supervised practical placement and AHPC licensing examinations.
- **Early career (years 1–8):** Public hospital laboratory — very high sample volumes, shared equipment across shifts, and a heavy manual logbook system (a paper register cross-referenced against a separate results book, prone to transcription mismatches he still worries about).
- **Recent (years 9–15):** Sole lab technologist at his current private clinic. Runs a smaller, more controlled bench — in-house panels for the common OPD tests (malaria, full blood count, basic chemistry, urinalysis, pregnancy tests) with a send-out arrangement to a reference lab for anything more specialized.
- **Additional duties beyond the pure technical role:** because he's the only lab person on-site most days, he has become the de facto point of contact for stock levels, reagent ordering, and equipment maintenance scheduling — work that has nothing to do with running a test but eats a real part of his day.
- **Digital exposure:** Comfortable with a computer from prior job's LIS-lite system (a basic results-entry tool, not a full EMR); moderate confidence with spreadsheets for tracking reagent stock before the clinic had any digital inventory tooling.

---

## 3. A day in his life (mapped to the product)

| Time | What happens | Where it touches New Clinic |
|------|--------------|------------------------------|
| 8:00am | Opens **Lab Desk** (`ready_for_lab`, `in_lab`) to see who's already queued from early doctor consults | §8.4 step 1 |
| Throughout | **Take patient** binds the session to the visit encounter, then he opens core **procedure order/results** or, once the Lab Operations Hub is enabled, the **Enter results** slide-over | §8.4 steps 2–3 |
| Mid-morning | A doctor's order for a send-out test (beyond in-house capacity) arrives — he **prints a requisition** so the patient can carry it to the external lab, and separately tracks that this specimen is "out" rather than pending on his own bench | §8.4b step 6 |
| Same scenario, next step | Once the patient is carrying the requisition to the external lab, there is nothing left for his bench to do — he uses **Skip to payment** with a documented reason (e.g. "External lab") so the patient goes straight to the cashier instead of sitting in his queue | §8.4 step 5 (Optional Skip to payment), PRD M8-F07, `new_visit_skip_queue` ACL |
| When the hub is enabled | Works primarily from **Lab Operations** rather than the visit-scoped Lab Desk — filters **Today** + **Urgent first**, marks specimens **collected**, enters results into a **draft**, and only **releases to doctor** when confident in the values, which triggers the **Results ready** chip on the Doctor Desk | §8.4b steps 1–5 |
| Occasionally | A patient arrives with `service_profile = lab_direct` (never saw a doctor today) — he reviews an optional **referral upload**, creates the **procedure order** himself under lab-lead authorization, completes a signed **lab intake note**, and only then processes the sample | §8.4a |
| End of consult | **Lab complete** auto-routes the patient to pharmacy or payment — he doesn't decide that routing, but he needs to trust it happens correctly so he isn't fielding "where do I go now?" questions from patients who've already left his station | §8.4 step 4 |
| Between patients | Handles reagent stock checks, equipment QC logs, and the occasional supplier phone call — none of this shows up in the product today, but it's a real claim on his attention during "quiet" bench time | — |

He is also the person a nurse's "urgent" flag actually reaches in practice: an urgent lab request needs to visibly jump his queue, not just the visit board's, or the clinical intent behind flagging urgency is lost at his bench.

---

## 4. Goals and motivations

- **Never let a specimen or result get mixed up with the wrong patient.** This is his single largest professional fear — a lab error is invisible until it causes real harm, and he has seen near-misses from the paper-logbook era that still bother him.
- **Keep the bench moving without cutting corners.** He is proud of running a tight, accurate lab on a small footprint; he resents any UI friction that tempts staff (including himself, under pressure) to skip a step like collection confirmation.
- **Make send-out tracking visible.** A specimen that left the building for an external lab is easy to lose track of if the system only shows what's "pending" on his own bench — he wants a place that acknowledges it's out, not just missing.
- **Be trusted to release results, not just enter them.** The distinction between drafting a result and formally **releasing to doctor** matters to him — he wants a clear moment where he's confirmed the value before a doctor acts on it.
- **Reduce his role as an accidental bottleneck.** Being the only lab person on-site most days means any system slowness or confusion directly delays every patient behind the one he's currently helping.
- **Get some credit and visibility for the non-bench work** (stock, equipment) that currently has no home in the product but consumes real time.

---

## 5. Frustrations and pain points

- **Two different "queues" to keep straight** — the visit-scoped **Lab Desk** (patient physically in the building, part of the FSM) versus the clinic-wide **Lab Operations Hub** (bench worklist, not tied to the visit queue) can blur together under pressure; he needs the training one-liner ("desk for who's at the bench; ops hub for what's pending; chart for history") to actually hold up in the UI, not just in documentation.
- **Send-out limbo.** Once a requisition is printed for an external lab, if the product has no way to mark "sample sent, awaiting external result," he ends up tracking this in his head or on a sticky note — precisely the kind of shadow system New Clinic is supposed to replace.
- **Urgent flag getting lost between roles.** A nurse's `is_urgent` on the visit doesn't automatically mean his own bench worklist treats the sample as urgent unless the Lab Operations Hub's "Urgent first" sort genuinely reflects the same flag — a mismatch here is a patient-safety issue, not a cosmetic one.
- **Lab-direct intake documentation load.** Walk-ins with no doctor visit today still require him to create the order and complete a signed intake note himself — more clinical documentation responsibility than his public-hospital job ever asked of him, and something he's still building confidence in.
- **Being the default IT contact for lab equipment/reagent issues** with no product surface for it — frustration born of scope, not of the software itself, but it colors how much patience he has left for software friction on top of everything else.
- **Result entry that doesn't obviously distinguish "draft" from "released"** — if the UI doesn't make this boundary crisp, he worries a doctor could act on a value he hadn't actually finished verifying.

---

## 6. Technology and device profile

| Aspect | Detail |
|---|---|
| **Primary device at work** | A desktop or shared laptop at the lab bench, often positioned to be readable while wearing gloves or standing at the bench rather than seated |
| **Personal device** | A mid-range Android smartphone — used for messaging suppliers and checking reagent order confirmations |
| **Browser habits** | Straightforward — one or two tabs, rarely customizes anything |
| **Typing speed** | Moderate; more confident with structured result-entry fields (numeric values, dropdown flags) than free text |
| **Trust in software** | Cautious and detail-oriented by professional training — he double-checks values before confirming, and wants the system to support that instinct (e.g. a clear review step before **Release to doctor**) rather than rush him past it |
| **Language** | Fluent English (lab reporting, AHPC documentation); speaks Twi with most patients during specimen collection |
| **Currency/units** | Local currency (GHS) for any lab fees he's asked about at the counter; standard local date format DD/MM/YYYY; expects lab values in the units his training and reference ranges use |

---

## 7. Representative quotes

> "A wrong result is worse than a slow result. If the system makes me choose between the two, something is designed wrong."

> "When a sample goes out to the reference lab, it isn't 'done' and it isn't 'pending' on my bench either — it needs its own place, or I'm the only record of where it is."

> "I don't mind being the one who orders the test myself for a walk-in who skipped the doctor. I do mind if the system makes that feel like less oversight than a doctor's order would get."

> "Urgent from the nurse has to mean urgent on my worklist too. If those two things don't agree, I find out the hard way."

---

## 8. How the New Clinic product should serve him

Direct implications for the Lab Desk and Lab Operations Hub, cross-referenced to existing product rules:

- **Desk vs. hub distinction must be visually unmistakable**, not just documented in a training one-liner — different chrome, different queue semantics (visit-scoped vs. clinic-wide bench worklist) so he never confuses "who's physically at my bench" with "what's pending across the clinic."
- **Urgent-first sort in the Lab Operations Hub must trace back to the same `is_urgent` flag used elsewhere** — any drift between the nurse's urgent flag and his own worklist sort is a patient-safety gap, not a display inconsistency.
- **Send-out specimens need a visible state distinct from pending/in-progress/complete** — even a simple "Sent out — awaiting external result" status, tied to the printed requisition, removes a shadow-tracking burden he currently carries himself.
- **Draft vs. Release to doctor must be a deliberate, hard-to-fumble step** — this is the moment he wants to feel in control of, matching his professional instinct to verify before a result becomes actionable to a clinician.
- **Lab-direct intake (`lab_direct` service profile) should make the required E-Sign and order-creation steps feel like a supported workflow, not an improvised one** — since these walk-ins never touched a doctor today, the product is effectively asking him to carry documentation weight a public-hospital job never did; clear step sequencing and confirmations reduce his anxiety here.
- **Referral-on-file chip and requisition printing must be fast and unambiguous** — he is often doing this between patients at a single-operator bench, so any extra clicks compound across a full day.
- **Skip to payment (with a required reason) is a core part of his day, not an exception path** — every send-out specimen ends with the patient bypassing his queue to the cashier, so the skip button + reason modal on the Lab Desk (PRD M8-F07, ACL `new_visit_skip_queue`, audit event `new_visit.queue_skipped`) must be as reliable as **Lab complete** itself. Shipped: `SkipToPaymentModal`, `#nc-lab-skip-btn`, `lab.skip_to_payment`.
- **No pretense of a stock/equipment management surface unless one is actually planned** — better to acknowledge this is out of scope for now than to build something half-useful that doesn't match his actual reagent/equipment tracking needs.

---

## 9. Non-goals for this persona

This persona does **not** drive requirements for triage/vitals (Nurse), consult/prescribing decisions (Doctor), dispensing/OTC sales (Pharmacist), or cashier/payment flows. Reagent and equipment inventory management is explicitly **not** a current product surface reflected here — flagged as a known gap in his day, not a requirement to build without further scoping.

---

## 10. Background: Ghanaian allied health licensing context (for readers unfamiliar with it)

- Medical laboratory technologists/scientists in Ghana typically train through an HND or BSc program in Medical Laboratory Technology/Science, followed by supervised practical placement.
- Ongoing registration and practice are regulated by the **Allied Health Professions Council of Ghana (AHPC)**, which maintains the professional register for laboratory technologists alongside other allied health cadres — the accountability Labik feels toward correct specimen handling and result reporting is a direct professional and legal concern under this licensing body.
- Small private outpatient clinics of the kind New Clinic targets commonly run a lean, single-operator lab bench with a mix of in-house testing capacity and a send-out arrangement for anything more specialized — this is why send-out tracking and being the sole point of failure for the bench are treated as everyday realities in this persona, not edge cases.

---

*Maintained alongside [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) and the other role personas ([Ama](./NEW_CLINIC_PERSONA_RECEPTIONIST_AMA.md), [Akua](./NEW_CLINIC_PERSONA_NURSE_AKUA.md), [Dr. Mensah](./NEW_CLINIC_PERSONA_DOCTOR_MENSAH.md), [Esi](./NEW_CLINIC_PERSONA_PHARMACIST_ESI.md), [Kofi](./NEW_CLINIC_PERSONA_CASHIER_KOFI.md), [Selorm](./NEW_CLINIC_PERSONA_ADMIN_SELORM.md)). If the Lab role's ACL, Lab Operations Hub, or lab-direct intake rules change, revisit §3 and §8 of this persona for drift.*

---

## Document history

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-07-07 | Initial persona |
| 1.1.1 | 2026-07-08 | AUDIT-13: skip-to-payment UI confirmed restored (AUDIT-1); removed regression warning |
| 1.1.0 | 2026-07-07 | Audited against code: spec anchors (§8.4/.4a/.4b), `lab_direct` service profile (`LabDirectService`), and urgent-flag claims verified. **Added the missing Skip-to-payment step** to §3 and §8 — it is step 5 of his own playbook (workflows §8.4) and the natural end of every send-out scenario — with a warning that the skip UI is currently regressed (AUDIT-1). Added history table + README index entry |

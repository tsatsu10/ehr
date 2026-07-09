# New Clinic — User Persona: Dr. Kwame Mensah, General Practitioner

| Field | Value |
|-------|--------|
| **Document version** | 1.1.0 |
| **Companion to** | [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) §4 (Roles and landing screens), §8.3 (Doctor — Doctor Desk), §8.3.1–.4 (multi-doctor, advisory routing, hard assignment, notifications) |
| **Last audited** | 2026-07-07 — spec anchors and product claims verified against code (see [NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md](./done/NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md)) |
| **Audience** | Product, design, trainers, QA, implementers |
| **Purpose** | Ground design and copy decisions for the Doctor Desk, consult routing, and E-Sign gates in a real working day |

> Composite persona for design purposes — no real name, facility, or patient data is used. Claims
> about Ghanaian medical licensing and training reflect general, stable knowledge of the system
> rather than a specific individual.

---

## 1. Snapshot

| | |
|---|---|
| **Name** | Dr. Kwame Mensah |
| **Age** | 43 |
| **Role** | General Practitioner / Medical Officer — sole or lead doctor at the clinic; sees walk-in OPD consults all day |
| **Experience** | 15 years since qualifying (MBChB), including two years of mandatory housemanship/internship and a year of rural district posting before moving to private practice |
| **Credential** | MBChB; licensed and annually renewed with the **Medical and Dental Council of Ghana (MDC)**; general practice (no sub-specialty residency) |
| **Location** | Owner-doctor or lead clinician at a private cash-only outpatient clinic in a regional capital; some weeks covers a second, smaller satellite clinic on specific days |
| **Household** | Married with three children (ages 15, 11, 6); often the family's primary earner, which sharpens his sensitivity to the clinic's cash flow and patient throughput |
| **In the product** | Maps to the **Doctor** role in [§4 Roles and landing screens](./NEW_CLINIC_V1_USER_WORKFLOWS.md#4-roles-and-landing-screens) — landing screen **Doctor Desk**, plus core encounter, lab order, and Rx deep links, and full chart (depth) access |

---

## 2. Career journey

- **Training:** Six-year MBChB program, followed by two years of housemanship rotating through internal medicine, surgery, paediatrics, and O&G at a teaching hospital, then a mandatory rural district posting (part of Ghana's medical licensing pathway).
- **Early career (years 1–5):** District hospital medical officer — extremely high patient volumes, minimal support staff, paper folders, and frequent stock-outs. Learned to triage his own time as much as patients.
- **Mid-career (years 6–10):** Moved to urban private practice; briefly worked two jobs (hospital shift plus private clinic hours) before committing fully to private outpatient care. Took on a junior doctor as apprentice/locum cover during this period.
- **Recent (years 11–15):** Lead/owner-doctor at his current clinic. Makes non-clinical decisions too — staffing, some pricing, and (reluctantly) some IT decisions, because "someone has to." Increasingly delegates routine cases to a junior colleague on the days both are on duty, which is when the shared `ready_for_doctor` pool and multi-doctor behavior in New Clinic matter to him directly.
- **Digital exposure:** Uses smartphone banking and WhatsApp fluently (patients and suppliers message him there constantly, which he tries to firewall from clinical decisions). Has used OpenEMR's stock encounter/Rx/lab-order screens for years and is fluent in them — his friction is almost entirely with **workflow and speed**, not with basic computer literacy.

---

## 3. A day in his life (mapped to the product)

| Time | What happens | Where it touches New Clinic |
|------|--------------|------------------------------|
| 8:00am | Opens **Doctor Desk**; checks the `ready_for_doctor` queue and, on shared days, toggles **Filter: Me** vs **All** depending on how busy the junior doctor's list looks | §8.3, §8.3.1 Multi-doctor filters |
| Throughout | **Take patient** claims the queue slot; opens the **encounter editor** in the same tab, orders labs/Rx as needed, returns to desk with **Back** | §8.3 steps 2–5 |
| Mid-morning | A patient needs a lab test; he places the **Lab order**, tells the patient to wait, and later sees a **Results ready** badge on the card while the patient is still in the building | §8.3 step 6b |
| Before each **Complete consult** | Signs the SOAP/consult note when he remembers to (pilot default does not force this before handoff, but he treats "sign before pay" as a personal non-negotiable habit regardless of the worksheet setting) | §8.3 step 5b, training one-liner |
| After consult | Reviews **Confirm routing** (lab / pharmacy / payment) before releasing the patient — occasionally overrides when the system's routing guess doesn't match what he actually ordered | §8.3 step 6a |
| Occasionally | A patient he already released needs a late lab order or prescription change — he uses **Reopen consult**, adds the order, and is careful that the **signed note text stays locked** (he orders the addition rather than trying to edit the old note) | §8.3 "Reopen consult" |
| End of day | Scans for any patient stuck `with_doctor` or `ready_for_payment` unsigned before closing up — he is ultimately the one accountable if a chart goes unsigned at end of day | §14 EOD open-visit checks referenced in workflows doc |

On multi-doctor days, he is the "Dr. A" of the shared-pool scenario in [§8.3.1](./NEW_CLINIC_V1_USER_WORKFLOWS.md#831-multi-doctor-clinics) — he expects **no hard lock**, a **Suggested provider** chip to be informational only, and an **In use by Dr. X** tooltip so he never double-books a colleague's active consult.

---

## 4. Goals and motivations

- **Protect clinical judgment from workflow friction.** He wants ordering a lab or writing an Rx to be at least as fast as it was on paper, or he'll route around the system.
- **Sign before pay, every time — by habit, not just by config.** Even though the pilot default (`require_esign_before_complete_consult = 0`) doesn't force this before handoff, he holds himself to the stricter standard because it's his signature and his license on the line, not the clinic's.
- **Keep the shared doctor pool fair.** On days he and a colleague share the floor, he doesn't want routing "suggestions" to feel like a rule he's breaking when he legitimately takes a patient outside his suggested list.
- **Never let unsigned or unresolved charts pile up.** He's the person who gets asked, weeks later, "why does this chart say nothing happened after the visit?" — his professional exposure is direct and personal.
- **Run the business, not just the medicine.** As owner-doctor, throughput and cash flow are his problem too — a slow Doctor Desk costs him money as well as time.
- **Delegate without losing control.** He wants to trust a junior colleague with the shared queue without hovering, but still be able to see the full picture (**All** filter) when something looks off.

---

## 5. Frustrations and pain points

- **Redundant re-entry.** Anything that makes him retype information the nurse or reception already captured (chief complaint, vitals) reads as wasted seconds multiplied across dozens of patients a day.
- **Ambiguous "done."** He's acutely aware of the distinction between *Complete consult* (releases the patient to the next queue), *E-Sign* (attests the note), and *visit is done* (cashier posted payment) — and gets frustrated when any part of the system, or a staff member's language, blurs these ("chart is signed" vs "consult is done" are not interchangeable to him).
- **Losing his place mid-consult.** If the **encounter session** is lost and he has to hunt for a **Restore encounter session** banner, that's a direct interruption to a patient sitting in front of him.
- **Late orders after the fact.** When a lab comes back positive after he already released the patient, he needs **Reopen consult** to be fast and obvious — a patient who's already left the building because this took too long is now his liability.
- **Being second-guessed by "the system's routing guess."** Advisory routing suggestions are useful context, never an instruction — he's mildly annoyed by any UI treatment that makes an override feel like he did something wrong.
- **Hard assignment friction (V1.2, when enabled).** If a clinic turns on hard assignment, being **blocked (409)** from taking a colleague's patient without a documented override reason is something he understands clinically but finds bureaucratic when he's just trying to cover for a colleague who stepped out.
- **Mobile consults on a tablet during a busier satellite day** — small touch targets or a cramped one-patient wizard slow him down when he's moving between exam rooms.

---

## 6. Technology and device profile

| Aspect | Detail |
|---|---|
| **Primary device at work** | Desktop at his main consult room; a tablet when covering the satellite clinic or moving between rooms |
| **Personal device** | A recent-model Android or iPhone — comfortable, fast, expects the same responsiveness from clinic software |
| **Browser habits** | Comfortable with multiple tabs; deliberately keeps **Open full chart** in a separate tab per product convention so the desk queue stays live behind it |
| **Typing speed** | Fast and confident — years of typing consult notes; impatient with anything that feels slower than paper used to be |
| **Trust in software** | High baseline trust, conditional on speed; he is the first to notice and complain when the 30-second queue refresh feels stale or when a **Back** from the encounter editor doesn't refresh his patient's card immediately |
| **Language** | Fluent English (clinical documentation, MDC licensing); speaks Twi and some Ga with patients depending on the clinic's location |
| **Currency/units** | Local currency (GHS) for any pricing decisions he's involved in as owner; expects DD/MM/YYYY dates consistent with clinic norms |

---

## 7. Representative quotes

> "Complete consult is not the same as the visit being over. If a patient still owes lab or pharmacy, I haven't finished my part of the handoff — I've started theirs."

> "I don't need the system to force me to sign before I hand off. I need it to never make signing harder than it has to be, because I'm going to do it anyway."

> "When I'm covering for my colleague and I take a patient off her list, don't make the screen act like I did something wrong. I know what I'm doing — just log it."

> "If a lab result changes my plan after I've already released the patient, getting back into that chart needs to take seconds, not a phone call to whoever built this."

---

## 8. How the New Clinic product should serve him

Direct implications for the Doctor Desk and shared components, cross-referenced to existing product rules:

- **Same-tab clinical tools, new-tab full chart** — the existing navigation convention (`encounter editor`, `lab order`, `prescribing` in the same tab; **Open full chart** always in a new tab) matches exactly how he wants to keep his queue alive behind deeper work; any regression here is a direct hit to his daily speed.
- **Immediate refresh on Back, 30-second background refresh otherwise** — he notices both extremes: a stale queue after finishing a patient, and unnecessary flicker if refresh happens more often than needed. Hold this contract precisely.
- **Confirm routing must be fast to review and easy to override with a reason** — he treats the system's lab/pharmacy/payment detection as a helpful guess, not a gate; overriding it should never feel adversarial in tone or extra clicks.
- **Restore encounter session banner must be impossible to miss** but should not block him from doing anything else useful while he re-establishes it, since a patient is physically present and waiting.
- **Reopen consult must clearly preserve the signed note as locked** while making it obvious how to add a late lab/Rx order — this is the exact moment he's most worried about legal/documentation exposure, so the UI needs to visibly reassure him nothing was silently altered.
- **Suggested provider / advisory routing chips read as informational, never as a rule** — copy and visual weight matter here more than logic; this is a case where the PRD's stated principle ("routing suggests; Take patient decides," D29) needs to show up in tone, not just behavior.
- **Multi-doctor "In use by Dr. X" and Me/All filters must be trustworthy at a glance** — he relies on this to avoid double-claiming a colleague's active consult, especially on busy shared-floor days.
- **Mobile one-patient wizard (≤767px) with 48px touch targets and a sticky Complete consult bar** — this is his daily reality on satellite-clinic days, not an edge case; regressions here cost him real time between exam rooms.
- **EOD visibility into unsigned / stuck charts** — as the person ultimately accountable for what a chart says (or doesn't) weeks later, any end-of-day view that surfaces `with_doctor` or unsigned `ready_for_payment` rows directly serves his risk management, even beyond what the pilot's minimum E-Sign gate requires.

---

## 9. Non-goals for this persona

This persona does **not** drive requirements for: nurse triage vitals capture, cashier/payment UI, scheduling/booking screens, or admin configuration (ACL, fee maps, clinic setup wizards) — those belong to other role personas. His interaction with lab and pharmacy is limited to **ordering** and **reviewing results/Rx status** from the Doctor Desk and core EMR screens, not to the Lab or Pharmacy Operations Hubs themselves.

---

## 10. Background: Ghanaian medical licensing context (for readers unfamiliar with it)

- Doctors in Ghana complete a six-year MBChB (or equivalent) degree, followed by a mandatory housemanship (internship) period rotating through major specialties, and typically a period of rural/district service as part of licensing requirements before or during early independent practice.
- Ongoing registration and practice are regulated by the **Medical and Dental Council of Ghana (MDC)**, which maintains the professional register — the weight Dr. Mensah places on "his signature, his license" is a direct professional and legal concern, not a figure of speech.
- Many private outpatient clinics of the kind New Clinic targets are owner-operated by a lead doctor who also carries business responsibilities (staffing, pricing, some IT decisions) alongside clinical work — this dual load is why his frustrations skew toward workflow speed and business risk as much as pure clinical concerns.

---

*Maintained alongside [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) and the other role personas ([Ama](./NEW_CLINIC_PERSONA_RECEPTIONIST_AMA.md), [Akua](./NEW_CLINIC_PERSONA_NURSE_AKUA.md), [Labik](./NEW_CLINIC_PERSONA_LAB_TECH_LABIK.md), [Esi](./NEW_CLINIC_PERSONA_PHARMACIST_ESI.md), [Kofi](./NEW_CLINIC_PERSONA_CASHIER_KOFI.md), [Selorm](./NEW_CLINIC_PERSONA_ADMIN_SELORM.md)). If the Doctor role's ACL, routing rules, or E-Sign gates change, revisit §3 and §8 of this persona for drift.*

---

## Document history

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-07-07 | Initial persona |
| 1.1.0 | 2026-07-07 | Audited against code: all claims verified exactly — `require_esign_before_complete_consult` defaults to `0` (install.sql, ClinicAdminService), the 30-second queue refresh is the real default (`DoctorDesk.tsx` `pollMs = 30_000`), and advisory routing/Me–All filters are live post desk-redesign (renamed to `DoctorTeamRoster`/`useDoctorRoster`). No factual corrections needed. Added history table + README index entry |

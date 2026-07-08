# New Clinic — User Persona: Ama Darko, Receptionist

| Field | Value |
|-------|--------|
| **Document version** | 1.0.0 |
| **Companion to** | [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) §4 (Roles and landing screens), §8.1 (Reception — Front Desk), §8.1a–d (Booking, Recalls, Communications, Registry), §9 (Registration & duplicate decision tree), §10 (Profile completion framework) |
| **Audience** | Product, design, trainers, QA, implementers |
| **Purpose** | Ground design and copy decisions for the Front Desk, registration accordion, and check-in flows in the day of the clinic's single highest-frequency user |
| **Last audited** | 2026-07-07 — created from spec anchors and code verified during the [codebase audit](./NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md) |

> Composite persona for design purposes — no real name, facility, or patient data is used. She is
> the "Ama" named in the PRD's role table (workflows §4). Claims about Ghanaian front-office work
> reflect general, stable knowledge of the setting rather than a specific individual.

---

## 1. Snapshot

| | |
|---|---|
| **Name** | Ama Darko |
| **Age** | 27 |
| **Role** | Receptionist — patient search and registration, visit start, queue slips, appointment check-in, booking, recall calls, and the first face (and voice) of the clinic |
| **Experience** | 6 years front-desk work: two years at a busy pharmacy counter, four at her current clinic; no formal clinical training, extensive on-the-job knowledge of how the clinic actually runs |
| **Credential** | SHS (WASSCE) plus a front-office/secretarial certificate course; learned everything patient-facing on the job |
| **Location** | Front desk of a private cash-only outpatient clinic; the desk faces the entrance, the waiting area, and a phone that rings all day |
| **Household** | Single, lives with an aunt; saving toward a healthcare administration diploma she studies for in the evenings |
| **In the product** | Maps to the **Reception** role in [§4 Roles and landing screens](./NEW_CLINIC_V1_USER_WORKFLOWS.md#4-roles-and-landing-screens) — landing screen **Front Desk**, plus **Scheduling & Flow** (S1), Visit Board (read), queue slip printing, and full chart (secondary). The stock OpenEMR patient finder is deliberately **hidden** for her role — module search only (§8.1 "Do not") |

---

## 2. Career journey

- **Training:** Senior high school, then a short front-office certificate. Her real qualification is four years of knowing every regular patient's face, which doctor runs late, and how to keep a full waiting room calm.
- **Early career (years 1–2):** Pharmacy shop counter — learned cash handling, queue management by force of personality, and how to spell-check a customer's name from their own mouth on the first try.
- **Recent (years 3–6):** Front desk at her current clinic. Started on paper: a registration ledger, a numbered-card queue system, and a lot of shouting names across the waiting room. She was the clinic's most enthusiastic adopter when New Clinic replaced the ledger — and its sharpest critic when the search was slow in the first week.
- **Informal responsibilities:** Answers the clinic phone, fields "how much is consultation?" questions dozens of times a day, chases patients for recall follow-ups, and quietly maintains the real waiting-room order when the queue numbers and human patience disagree.
- **Digital exposure:** Smartphone-native — fast on WhatsApp, mobile money, and any app-shaped interface. The desktop keyboard slowed her at first; now she's the fastest typist in the clinic and treats keyboard-first search as a point of pride.

---

## 3. A day in her life (mapped to the product)

| Time | What happens | Where it touches New Clinic |
|------|--------------|------------------------------|
| 7:45am | Opens **Front Desk**; search box is already focused — the way she likes it | §8.1 step 1 |
| All day, ~40–80×/day | Types a name, phone number, or card number; live results in ≤1.5s; picks the patient and scans the **preview panel** (allergies, completion %, last visit) before starting anything | §8.1 steps 2–3a; M1a search spec |
| Several times a day | **No match** → **Register patient** → the 4-section registration accordion; Section 1 (name, sex, phone or no-phone, estimated age) is enough to create the patient and get them moving | §8.1 steps 3b–5, §9 |
| When the dup check fires | Score ≥ 17: she's **blocked** and switches to the existing record (or calls her lead for an override); score 10–16: she confirms "different patient" with a note — she has learned the hard way that a duplicate folder costs the clinic an hour downstream | §8.1 steps 4a–4b, §9 decision tree |
| Per visit | Chooses **visit type** (OPD / Lab-only / Pharmacy walk-in when ancillary is on), optionally types a short **Reason for visit**, sets a **priority flag** when it applies (elderly, pregnant, under-5, urgent), clicks **Start visit** → queue number assigned, optional **thermal queue slip** prints | §8.1 steps 6–8; priority flags per Front Desk form |
| Returning patients | If the profile is under 70% complete, **Start visit is blocked** — she picks the honest path each time: complete Sections 2–4 now, ask her lead for a `new_revisit_skip_completion` override with a reason, or hold the visit while the patient fetches documents | §8.1 returning-patient gate, §10 |
| Follow-up patients | Reception sent a stable follow-up **straight to the doctor** (Skip to doctor, reception ACL) — she knows this makes the Triage queue look quiet and the Doctor column busy, and that this is normal | §5 state machine (`waiting → ready_for_doctor`), §12.2 |
| Morning + slow moments | **Scheduling & Flow**: checks today's appointments; when a booked patient arrives, the **Appointment today** chip → **Start visit & check in** creates one encounter and marks arrival in one action | §8.1a, §8.1b step 5 |
| Assigned afternoons | Works the **Recalls** tab: calls patients due for follow-up, books from the recall so the loop closes automatically when they arrive | §8.1b |
| Occasionally | Cohort questions from the manager ("how many under-5s this month?") go through **Patient Registry** — she knows registry is for lists and Front Desk search is for the person standing in front of her, and never confuses the two | §8.1d; M1a ≠ M10 rule |
| End of shift | Glances at the Visit Board for anything still `waiting` that she started, hands the desk over with **Switch role / Logout** | §8.7, shared-device rule |

---

## 4. Goals and motivations

- **Keep the line moving without losing anyone.** Her whole job is throughput with names attached — every extra click at the desk is multiplied by every patient in the queue behind this one.
- **Never create a duplicate folder.** She's the person who has to untangle it later when a patient has two records with two histories — the dup gate is her ally, not her obstacle, as long as it's fast and clear about *why* it fired.
- **Get the minimum right, fast; finish the rest honestly.** Section-1-minimum registration matches how patients actually arrive (sick, impatient, sometimes without documents); she relies on the completion % and the revisit gate to make sure "we'll finish it next time" actually happens next time.
- **Be believed when she flags urgency.** When she marks a visibly struggling patient urgent at Start visit, she needs that flag to genuinely reach the triage and doctor queues — she's the first assessor in the building even though nothing in her title says so.
- **Answer money and time questions confidently.** "How much?" and "how long?" are her two most-asked questions; the fee schedule and queue state need to be answerable at a glance without leaving her screen.
- **Look competent in front of a full waiting room.** The desk is a stage. Software that stalls, loses her half-typed registration, or makes her ask the patient the same question twice costs her face, not just time.

---

## 5. Frustrations and pain points

- **The phone and the desk compete for the same two hands.** She is mid-registration when the phone rings, constantly — a form that survives being abandoned for ninety seconds is the difference between usable and not.
- **Patients without documents, exact ages, or consistent name spellings.** "Estimated age" and no-phone paths aren't edge cases at her desk; they're Tuesday. Any required field the patient can't answer becomes her problem to invent or fight.
- **Slow search at peak hours.** Between 8 and 10am the queue at her desk is physical, visible, and audible. The ≤1.5s search target is the number her patience lives and dies by.
- **Being blamed for queue physics.** When the doctor is slow, the waiting room complains to *her*. Accurate wait context on the board — and a queue slip in the patient's hand — deflects arguments she otherwise absorbs personally.
- **Override theater.** When the dup gate or revisit gate blocks her for a good reason, fine — but if she has to interrupt her lead for an override on a case the rules could have handled (a returning patient whose file is 68% because of one missing field), the gate teaches staff to resent it.
- **The old two-systems habit.** Colleagues from other clinics still ask "but where's the *real* patient list?" — the stock Finder being hidden for her role is correct, and she defends it, but only because module search has never yet failed to find someone she knew was there.

---

## 6. Technology and device profile

| Aspect | Detail |
|---|---|
| **Primary device at work** | The front-desk desktop with a thermal slip printer; the screen is angled so patients can't read it, which she checks reflexively |
| **Personal device** | A current mid-range Android — she is faster on it than most people are on anything |
| **Browser habits** | One tab for Front Desk, one for Scheduling & Flow; hard-refreshes without fear because IT taught her to (Ctrl+Shift+R is muscle memory) |
| **Typing speed** | The fastest in the clinic — keyboard-first search and Enter-to-select matter more to her than to any other role |
| **Trust in software** | Earned per feature: search earned it in week two; anything that once lost a half-typed registration is on probation forever |
| **Language** | Fluent English; runs the desk in Twi, English, and gesture, often in the same sentence; types names carefully because she knows a misspelling breaks tomorrow's search |
| **Currency/units** | Quotes prices in the clinic's configured currency (GHS at her clinic); DD/MM/YYYY dates — she reads appointment dates aloud to patients and a US-format date would cause real missed appointments |

---

## 7. Representative quotes

> "If I can't find the patient in two seconds, the patient decides I'm slow — not the computer. Me."

> "Every duplicate folder is a fight six months from now with a patient standing right there. Block me now, please, while it's cheap."

> "Half my patients don't know their exact birthday and a quarter don't have their phone. Ask me what I *can* answer and let the rest wait."

> "The queue slip isn't paper — it's the argument I don't have to have at two o'clock."

---

## 8. How the New Clinic product should serve her

Direct implications for the Front Desk island and registration flow, cross-referenced to existing product rules:

- **Search is the product, for her.** Keyboard-focused on load, live results within the ≤1.5s target, match on name/phone/NHIS/ID/pubpid — every regression here hits the highest-frequency interaction in the entire clinic (§8.1 steps 1–2; M1a spec).
- **The registration accordion must stay an accordion** — Section-1 minimum to create, live inline validation while typing, never wiping on error, disappearing only after a successful save. This is an explicitly settled product decision (wizard replacements were rejected) and her interrupted, phone-juggling reality is the reason why.
- **Dup gate messages must say *why* and *who*** — "Blocked: strong match with [existing patient, age, phone]" turns the gate from an obstacle into a colleague; a bare "duplicate detected" turns it into a thing she works around.
- **The revisit completion gate must present all three legitimate paths with equal clarity** (complete now / lead override with reason / patient fetches documents) — the workflows doc is explicit that this is "not a hard turn-away," and the UI tone needs to match.
- **Priority flags and Skip-to-doctor must be one-gesture cheap** — she sets them while a queue watches; anything over a click-and-confirm gets skipped under pressure, which silently degrades the triage queue's meaning.
- **Queue slip printing must be fire-and-forget** (`print_queue_slip_on_start_visit`, slip URL returned inline with Start visit) — if printing fails, tell her *on the success screen*, not in a console she'll never see.
- **Appointment check-in must stay one action** — the Appointment-today chip → Start visit & check-in (one encounter, arrival marked, recall auto-completed) collapses what used to be three chances to make an error into one.
- **Front Desk search ≠ Patient Registry, visibly** — she holds this distinction well, but new reception hires won't; the two surfaces should never look similar enough to confuse (M1a vs M10 is a load-bearing product rule).
- **Shared-device role clarity** ("Reception — Ama" in the top bar) — the front desk is the most-handed-over station in the clinic; the switch-role discipline the product enforces protects her from entries made on her login by whoever covered her lunch.

---

## 9. Non-goals for this persona

This persona does **not** drive requirements for: vitals/triage capture (Nurse), consult/ordering (Doctor), dispensing (Pharmacy), specimen work (Lab), payment posting or receipts (Cashier), or admin configuration. She *reads* the Visit Board but does not move cards (that's reception **lead** + admin, §8.7); she starts visits but never takes payment — money changes hands only at the cashier's window. Any design that starts routing payment or clinical actions through the front desk should be checked against this persona and the PRD before proceeding.

---

## 10. Background: the Ghanaian front-office context (for readers unfamiliar with it)

- Reception staff at small private clinics typically enter through general secretarial/front-office paths rather than clinical training; their expertise is local, personal, and institutional — patient recognition, queue diplomacy, and the unwritten rules of the waiting room.
- Patients commonly arrive without ID documents, without knowing an exact date of birth, or without a working phone — which is why estimated-age and no-phone registration paths are core product flows rather than edge cases, and why profile completion is designed as a *progressive* framework (§10) rather than a gate at first contact.
- The front desk is also the clinic's informal call center and price desk. Any product change that makes "how much?" or "when?" harder to answer from the reception screen pushes that cost onto the clinic's most interrupted employee.

---

*Maintained alongside [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) and the other role personas ([Akua](./NEW_CLINIC_PERSONA_NURSE_AKUA.md), [Dr. Mensah](./NEW_CLINIC_PERSONA_DOCTOR_MENSAH.md), [Labik](./NEW_CLINIC_PERSONA_LAB_TECH_LABIK.md), [Esi](./NEW_CLINIC_PERSONA_PHARMACIST_ESI.md), [Kofi](./NEW_CLINIC_PERSONA_CASHIER_KOFI.md), [Selorm](./NEW_CLINIC_PERSONA_ADMIN_SELORM.md)). If the Reception role's ACL, search behavior, registration form, or completion gates change, revisit §3 and §8 of this persona for drift.*

---

## Document history

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-07-07 | Initial persona, written from workflows §8.1/.1a–d, §9, §10 and code verified during the 2026-07-07 codebase audit (search actions, StartVisitForm priority flags, queue-slip inline delivery, revisit gate) |

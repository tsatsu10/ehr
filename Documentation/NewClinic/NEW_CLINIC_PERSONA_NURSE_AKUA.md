# New Clinic — User Persona: Akua Boateng, Staff Nurse

| Field | Value |
|-------|--------|
| **Document version** | 1.1.0 |
| **Companion to** | [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) §4 (Roles and landing screens), §8.2 (Nurse — Triage playbook) |
| **Last audited** | 2026-07-07 — spec anchors and product claims verified against code (see [NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md](./NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md)) |
| **Audience** | Product, design, trainers, QA, implementers |
| **Purpose** | Give a concrete, evidence-grounded face to the "Nurse" role so design and copy decisions are checked against a real working day, not an abstraction |

> This persona is a composite drawn from common staffing patterns at private outpatient clinics
> in Ghana. It is not a real patient-facing record — no real name, facility, or patient data is
> used. Where it makes a claim about clinical regulation or training pathways, that reflects
> general, stable knowledge of the Ghanaian nursing system rather than a specific individual.

---

## 1. Snapshot

| | |
|---|---|
| **Name** | Akua Boateng |
| **Age** | 38 |
| **Role** | Staff Nurse (Registered General Nurse) — triage, vitals, wound care, injections, minor procedures |
| **Experience** | 15 years post-qualification, all in outpatient/OPD settings |
| **Credential** | Registered General Nurse (RGN), licensed with the Nursing and Midwifery Council of Ghana (NMC); Diploma in General Nursing from a Nurses' Training College, with a top-up BSc in Nursing completed part-time in her ninth year of practice |
| **Location** | Works in a private cash-only outpatient clinic in a regional capital (the kind of clinic New Clinic is built for); commutes ~45 minutes each way by trotro and shared taxi |
| **Household** | Married, two children (13 and 8); shares school-run and household duties with her husband and a live-in relative who helps with childcare |
| **In the product** | Maps to the **Nurse** role in [§4 Roles and landing screens](./NEW_CLINIC_V1_USER_WORKFLOWS.md#4-roles-and-landing-screens) — landing screen **Triage**, read-only **Visit Board**, and **full chart (vitals depth)** access |

---

## 2. Career journey

- **Training:** Three-year Diploma in General Nursing, followed by mandatory national licensing exams through the Nursing and Midwifery Council of Ghana. Did her housemanship/internship year rotating through medical, surgical, and OPD wards at a regional hospital.
- **Early career (years 1–5):** Worked in a busy public hospital OPD — high patient volumes, paper-based vitals charts, frequent double documentation (paper first, then a ward register).
- **Mid-career (years 6–10):** Moved to a private clinic for better hours and pay predictability; completed a part-time BSc top-up during this period, largely self-funded, attending block-release classes on days off.
- **Recent (years 11–15):** Senior staff nurse at her current clinic — the most experienced nurse on shift most days, frequently the person newer nurses and reception staff ask when something in the patient flow doesn't look right. Has trained three junior nurses on the clinic's intake and vitals process.
- **Digital exposure:** Learned basic computer use informally (smartphone first, then a desktop at a previous job that used a simple Access-based patient log). Has never used a full EMR before this clinic adopted OpenEMR / New Clinic. Comfortable with WhatsApp, mobile money, and basic web forms; slower and more deliberate with anything that looks like "office software" — she reads labels and confirmation dialogs carefully rather than clicking through them.

---

## 3. A day in her life (mapped to the product)

| Time | What happens | Where it touches New Clinic |
|------|--------------|------------------------------|
| 7:30am | Arrives, checks the **Visit Board** (read-only) to see who's already waiting from early walk-ins | Visit Board — Triage / Doctor columns |
| 8:00am–12:00pm | Opens the **Triage** queue, calls patients in order (urgent patients sorted to top), takes vitals, records chief complaint, **Send to doctor** | §8.2 Nurse — Triage playbook |
| Throughout | Occasionally a walk-in arrives directly to the triage room with no visit yet — she searches the patient, confirms **Start visit + Start triage** in one modal | §8.2 "Patient search (no visit)" / §12.2.2 Auto-start at triage |
| Mid-morning | A returning follow-up patient is sent straight to the doctor by reception (**Skip triage**) — she notices the **Triage** queue is quieter than the Visit Board's **Doctor** column and knows this is expected, not a system fault | §8.2 "Empty-state hint" |
| 12:30pm | Lunch, often eaten standing at the nurses' station between patients — she does not get an uninterrupted break most days | — |
| 1:00–4:00pm | Afternoon triage load, dressing changes and injections ordered by the doctor, occasional urgent case (chest pain, high fever in a child) that she flags **Urgent** | is_urgent sort, §12.2 exceptions |
| 4:00–5:00pm | Handover to the closing shift or documentation clean-up; double-checks that no patient is left on her screen with unsaved vitals before logging out | Role indicator in top bar ("Nurse — Akua"), Switch role / Logout discipline |

She rarely uses the full patient chart beyond vitals depth — that's the doctor's domain — but will open it to check a returning patient's last visit notes or allergy flags before triage.

---

## 4. Goals and motivations

- **Get through the queue safely, not just fast.** Her professional pride is in not missing a deteriorating patient, not in throughput numbers.
- **Never lose vitals she's already entered.** A system that wipes a half-completed form on an error, or times out silently, is a direct threat to patient safety and her own accountability.
- **Hand off cleanly.** She wants the doctor to receive a patient with the right chief complaint and vitals already visible — no re-asking the patient the same questions.
- **Protect her license.** Every action she takes is something she could be asked to explain later (in an audit, a complaint, or a bad outcome). She wants the system to make correct, defensible documentation the easy path.
- **Keep the shared device sane.** Multiple staff use the same triage-room computer across a shift; she wants to know at a glance whose session is active before she touches anything.
- **Not be slowed down by her own inexperience with software.** She's proud of her clinical skill and doesn't want the computer to make her look incompetent in front of patients or junior colleagues.

---

## 5. Frustrations and pain points

- **Paper-era habits die hard.** Fifteen years of vitals charts trained her to write everything down first, then transcribe — she still keeps a small paper vitals slip in her pocket as a personal backup during power blips or slow screens, even when the system is working fine.
- **Ambiguous system feedback.** She distrusts confirmations that don't clearly say what happened ("Saved" alone isn't enough — saved *what*, *for which patient*, *what's next*).
- **Interruptions mid-task.** A crying child, a fainting patient, a doctor calling her name — she is constantly pulled away mid-form. A form that discards her entry because she stepped away for two minutes is actively dangerous, not just annoying.
- **Shared-device confusion.** Before role-switching was clear, she has previously (at other jobs, on other systems) accidentally acted "as" a colleague who forgot to log out — a source of real anxiety since it implicates her license for someone else's entry.
- **Small text and low contrast in bright rooms.** The triage room has strong midday light through a window; low-contrast UI is hard to read quickly between patients.
- **Network and power instability.** Ghana's private clinics commonly run on a mix of grid power, inverters, and generators; brief outages and slow mobile-data failover are a fact of life, not an edge case.
- **Being asked to "trust the computer" over her own clinical judgment** — she wants the system to support urgent-patient prioritization, not silently override her sense of who needs to be seen next.

---

## 6. Technology and device profile

| Aspect | Detail |
|---|---|
| **Primary device at work** | A shared desktop/laptop at the triage station, usually a mid-range Windows machine, sometimes running slow by mid-shift with several browser tabs open |
| **Personal device** | An Android smartphone (mid-range, e.g. Tecno/Infinix/Samsung A-series) — this is where she is fastest and most confident |
| **Browser habits** | Whatever is already open (Chrome), rarely changes zoom/settings herself, relies on IT-savvy colleagues or the admin lead for anything that looks like configuration |
| **Typing speed** | Moderate — comfortable with structured forms and dropdowns, slower with free text; prefers tapping/selecting to typing long notes |
| **Trust in software** | Cautiously positive if it's fast and gives clear confirmation; quickly loses trust after one bad experience of a lost entry or a confusing error |
| **Language** | Fluent English (language of clinical documentation and NMC licensing); speaks Twi with most patients and sometimes narrates vitals results to them in Twi while entering English text into the system |
| **Currency/units** | Local currency (Ghana cedi, GHS) for any patient-facing costs she's asked about; expects local date format DD/MM/YYYY, consistent with clinic norms |

---

## 7. Representative quotes

> "If I put in the numbers and the screen freezes, I need to know — did it save or not? I can't guess with a patient's blood pressure."

> "I don't need it to be fancy. I need it to still have my patient's information when I come back from calming a screaming toddler."

> "The doctor should not have to ask the patient the same three questions I already asked. That's the whole point of me being there first."

> "When I hand the computer to the next nurse, it should be obvious to both of us whose name is on the screen."

---

## 8. How the New Clinic product should serve her

Direct implications for the Triage island and shared components, cross-referenced to existing product rules:

- **Form must never wipe on error, and never auto-discard on navigation away** — matches the existing forms-UX rule in [`NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md`](./NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md) and CLAUDE.md §7; for Akua this isn't a nicety, it's a patient-safety requirement given how often she's interrupted mid-vitals.
- **Every desk shows wait time and state via `<WaitTimeSpan />` / `QueueCard`**, never inline formatting — she reads the Triage queue and Visit Board dozens of times a shift and needs the same visual language every time.
- **Urgent patients sort to top but still go through normal triage** unless reception also used Skip to doctor — the UI must make this distinction unambiguous so she isn't second-guessing whether a case was actually triaged.
- **Skipped-triage patients must never look like a missing/broken queue** — the empty-state hint pointing to the Doctor column (§8.2) is exactly the kind of reassurance she needs mid-shift, since a "did the system lose this patient?" moment costs her time and trust.
- **Active role clearly visible at all times** ("Nurse — Akua" in the top bar) with a deliberate Switch role / Logout step — protects her personally as much as it protects data integrity.
- **High contrast, large touch targets (44px), visible focus states** — the triage room's bright window light and her habit of quick taps between patients make this a real usability need, not just an accessibility checkbox (WCAG 2.1 AA per CLAUDE.md §7 is the floor, not the ceiling, for her environment).
- **Confirmations must say what happened and what's next**, not a bare "Saved" — e.g. "Vitals saved. Sent to Dr. [Name]'s queue," using `showDeskToast()` conventions already established for desk feedback.
- **Resilience to flaky connectivity** — Akua's environment is the reason `oeFetch` error handling matters more here than in a well-provisioned reference clinic. Today the product's contract is: a failed save must surface a **clear inline error while preserving everything she typed**, so she can retry manually without re-entering vitals — `oeFetch` does **not** retry automatically, and there is no offline queue (verified 2026-07-07; the codebase audit found the once-drafted offline-registration hook is unused). Any future automatic retry/queueing work should treat her interrupted-mid-form reality as its primary test case; until then, never imply to trainers that the system retries on its own.
- **DD/MM/YYYY dates and no hardcoded currency symbols** — already a stated regional convention (CLAUDE.md §7); confirms rather than introduces a requirement.

---

## 9. Non-goals for this persona

To keep scope honest, this persona does **not** drive requirements for: prescribing decisions (Doctor persona's domain), billing/cashier flows, scheduling/booking, or admin configuration screens. She has *read-only* Visit Board access and *does not* pick a doctor for a patient (shared `ready_for_doctor` pool, per [§8.2](./NEW_CLINIC_V1_USER_WORKFLOWS.md#82-nurse--triage)) — any design work that starts giving her a provider-picker or write access to scheduling should be checked against this persona and the PRD before proceeding.

---

## 10. Background: the Ghanaian nursing context (for readers unfamiliar with it)

- Nurses in Ghana are trained through Nurses'/Nursing Training Colleges (diploma level) or university nursing programs (degree level), with many diploma-holders completing a part-time BSc top-up later in their careers, as Akua did.
- Licensing and continued practice are regulated by the **Nursing and Midwifery Council of Ghana (NMC)**, which maintains the professional register and licensing renewal requirements — the accountability Akua feels toward "her license" is a direct, practical concern, not an abstraction.
- Private outpatient clinics of the kind New Clinic targets are typically cash-only, staffed lean (a handful of nurses across shifts rather than large nursing floors), and commonly deal with intermittent power and internet — this is why the product's resilience and clarity requirements are treated as core, not edge-case, throughout this document.

---

*Maintained alongside [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) and the other role personas ([Ama](./NEW_CLINIC_PERSONA_RECEPTIONIST_AMA.md), [Dr. Mensah](./NEW_CLINIC_PERSONA_DOCTOR_MENSAH.md), [Labik](./NEW_CLINIC_PERSONA_LAB_TECH_LABIK.md), [Esi](./NEW_CLINIC_PERSONA_PHARMACIST_ESI.md), [Kofi](./NEW_CLINIC_PERSONA_CASHIER_KOFI.md), [Selorm](./NEW_CLINIC_PERSONA_ADMIN_SELORM.md)). If the Nurse role's ACL, landing screens, or Triage playbook change, revisit §3 and §8 of this persona for drift.*

---

## Document history

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-07-07 | Initial persona |
| 1.1.0 | 2026-07-07 | Audited against code: all spec anchors (§4, §8.2, §12.2.2) and product claims verified. Corrected §8 connectivity bullet — `oeFetch` has no automatic retry/backoff and no offline queue; the real contract is error-surfacing + form preservation for manual retry. Added history table + README index entry |

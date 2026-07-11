# New Clinic — User Persona: Kofi Asante, Cashier

| Field | Value |
|-------|--------|
| **Document version** | 1.1.0 |
| **Companion to** | [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) §4 (Roles and landing screens), §8.6 (Cashier — Cashier), §10 (Profile completion framework), §12 (Exceptions); PRD D-BILL-2 (no partial payments), §6.1.1 (payment E-Sign gate) |
| **Audience** | Product, design, trainers, QA, implementers |
| **Purpose** | Ground design and copy decisions for the Cashier Desk, payment confirmation, and end-of-day cash discipline in the day of the person whose drawer has to balance |
| **Last audited** | 2026-07-07 — created from spec anchors and code verified during the [codebase audit](./done/NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md) |

> Composite persona for design purposes — no real name, facility, or patient data is used. He is
> the "Kofi" named in the PRD's role table (workflows §4). Claims about Ghanaian cash-handling
> norms reflect general, stable knowledge of the setting rather than a specific individual.
> Where §8 restates a product rule, it is rationale, not authority — the PRD and workflows stay
> canonical and win any conflict; drift is resolved by updating the persona, never the spec.

---

## 1. Snapshot

| | |
|---|---|
| **Name** | Kofi Asante |
| **Age** | 34 |
| **Role** | Cashier — collects full cash settlement at visit end, prints receipts, closes visits, and reconciles his physical drawer against the system total every single day |
| **Experience** | 10 years handling other people's money: four as a mobile-money agent and shop till operator, six at his current clinic's cashier window |
| **Credential** | SHS (WASSCE) plus an accounting technician certificate (started, not yet completed — he takes one paper a year); trained on the clinic's cash procedures by the manager |
| **Location** | The cashier window of a private cash-only outpatient clinic — a physical window with a cash drawer, a receipt printer, and a chair he rarely leaves between 10am and 2pm |
| **Household** | Married, one child; his wife runs a small provisions shop, so evenings at home often involve *two* cash boxes being counted at the same table |
| **In the product** | Maps to the **Cashier** role in [§4 Roles and landing screens](./NEW_CLINIC_V1_USER_WORKFLOWS.md#4-roles-and-landing-screens) — landing screen **Cashier** (queue = `ready_for_payment` only), plus receipt print and full chart (completion / balance check) |

---

## 2. Career journey

- **Training:** Learned money discipline the unforgiving way — as a mobile-money agent, where a mismatch at close-out came straight out of his own pocket. That experience shaped everything: count twice, confirm once, never let a transaction float in an ambiguous state.
- **Early career (years 1–4):** Shop till and mobile-money kiosk work. Fast mental arithmetic, change-making under pressure, and a permanent habit of announcing amounts out loud ("fifty received, fifteen your change") so there's a witness to every hand-off.
- **Recent (years 5–10):** Cashier at his current clinic. On paper days he ran a carbon-copy receipt book and a handwritten daily summary the manager re-added every night. New Clinic replaced that with a payment queue, printed receipts, and a daily cash summary that matches his drawer — when everyone upstream did their part.
- **Informal responsibilities:** He is the clinic's de facto explainer of bills ("why is it 80 and not 60 today?"), its front line for "can I pay half now?" conversations, and — because his window faces the exit — often the last staff member a patient speaks to.
- **Digital exposure:** Very comfortable with transactional interfaces — mobile-money menus, POS-style flows, structured numeric entry. Uninterested in software beyond that; he wants a payment screen that behaves like a good cash register, not like a computer.

---

## 3. A day in his life (mapped to the product)

| Time | What happens | Where it touches New Clinic |
|------|--------------|------------------------------|
| 8:00am | Counts his float, opens the **Cashier** desk — the queue shows only patients in `ready_for_payment`, which is exactly how he wants it | §8.6 step 1 |
| Per patient | Selects the patient; the charge list appears with **suggested fee lines** pre-populated from the visit type where configured; he adds lines the visit earned (consult, lab, dispense) against the fee schedule | §8.6 steps 2 and 4 |
| Before touching money | Two gates can stop him, and he respects both: the **profile completion gate** (<70% → block or manager override with reason) and the **E-Sign re-check** — an unsigned consult blocks payment, and he sends word back to the doctor rather than overriding | §8.6 steps 3 and 6; PRD §6.1.1 `assertProfileSigned` |
| If the visit has no charges | The system refuses to take payment on an empty visit ("No charges on this visit — add fees before taking payment") — he treats that guard as protection, because a zero-line payment is exactly the kind of thing that unbalances a drawer invisibly | Verified server guard, `CashierService` |
| The money moment | Enters **cash tendered**, reads the calculated change aloud, **Confirm payment** — the confirm modal repeats his role, and the posting is **idempotent** so a double-click or a network hiccup can't charge twice | §8.6 steps 5–6, shared-device rule |
| After payment | Prints the receipt (with queue number when configured), visit → `completed`, patient leaves all queues | §8.6 steps 7–8 |
| Several times a week | A patient at the window genuinely cannot pay in full — V1 rule is **no partial payments** (D-BILL-2), so the choices are the manager's, not his: **Left without paying** → `closed_unpaid` with a reason (lead/manager ACL), or **Close without charge** for a courtesy case | §8.6 steps 9–10, V1 rules |
| Mixed in the queue | Patients arrive at his window having **skipped** the lab or pharmacy queue (external lab, declined Rx) — the visit card's context tells him why, so he isn't guessing which services to charge for | §5 state machine skip paths; Visit Board badges §8.7 |
| 5:00pm | Counts the drawer against the **daily cash summary**; the manager runs reconciliation the next morning (RB-02) — his professional pride is that the delta is zero, boringly, every day | §14.2 manager daily; M7 cash summary |

---

## 4. Goals and motivations

- **A drawer that balances to zero, every day, without drama.** This is the entire job. Every product behavior either serves that number or threatens it.
- **One payment, one posting, one receipt — no ambiguity.** He came from a world where an ambiguous transaction cost him personally; idempotent payment posting and an unmissable success state are, to him, the system's most important features.
- **Never be the one who decides exceptions.** "Pay half," "I'll come back tomorrow," "the doctor said it's free" — he wants those decisions to visibly belong to the manager's ACL and reason field, not to his discretion at the window. The system holding that line protects him from pressure he otherwise absorbs face-to-face.
- **Explain any bill in one breath.** Each fee line should map to something the patient experienced ("consultation, lab test, two medicines") — line names written for billing systems rather than humans turn every receipt into an argument.
- **Move the after-lunch rush fast.** `ready_for_payment` stacks up when the doctor and pharmacy finish their morning queues; a slow charge picker at 1pm delays the whole clinic's exit.
- **Leave a clean trail.** Every unpaid or no-charge closure with its reason is his alibi — when the owner reviews `closed_unpaid` rows (M7-F14), Kofi wants the record to show he followed procedure, every time.

---

## 5. Frustrations and pain points

- **Upstream sloppiness lands at his window.** A missing fee line, an unsigned consult, an incomplete profile — none of these are his doing, but the patient standing at his window experiences them as *his* delay. Gates that fire at payment time need to tell him *what to say* and *who fixes it*, not just "blocked."
- **The "small small" negotiation.** Partial-payment requests are constant and culturally normal in cash retail — the product's hard no-partial-payments rule (D-BILL-2) is correct for V1 accounting sanity, but it means the *softening language* falls to him. A visible, official "Left without paying / manager correction" path lets him say "the system has a proper way to record this" instead of "no."
- **Change-making under pressure.** He does the arithmetic faster in his head than the screen does, but he *wants* the screen's number as the witness — a cash-tendered/change display that's small, low-contrast, or below the fold defeats its purpose as the thing both he and the patient can point at.
- **Receipt printer failures at the worst moment.** A payment that posted but didn't print needs an obvious, immediate reprint path — the patient will not leave without paper, and he will not un-post a payment to regenerate one.
- **Queue pile-ups he can see coming.** The cashier queue is the clinic's drain — when it backs up, everyone's day ends late. He watches the `ready_for_payment` count the way reception watches the waiting room.
- **Being handed someone else's session.** Money actions on the wrong login are the nightmare scenario of shared-device work — the confirm modal repeating the active role before payment is, for him, the single most reassuring pattern in the product.
- **His "pending is a word for other people's money" standard isn't actually guaranteed by the system.** Verified 2026-07-09: payment posting and receipt writing aren't in the same transaction — a receipt-insert failure can leave a visit marked paid and completed with no receipt row at all, invisible to the very reconciliation meant to catch it. The reconciliation math also never subtracts reversed payments, so a same-day reversal can leave the day looking "balanced" when it isn't.
- **His drawer count never actually touches the system.** There's no in-product "count what's in the drawer, compare to system total, sign it" step anywhere — his whole professional pride ("boringly, every day") currently rests entirely on a paper/verbal report to the manager the next morning. See [NEW_CLINIC_CROSS_ROLE_SAFETY_INTEGRITY_AUDIT.md](./new/NEW_CLINIC_CROSS_ROLE_SAFETY_INTEGRITY_AUDIT.md) §6 (E1–E3).

---

## 6. Technology and device profile

| Aspect | Detail |
|---|---|
| **Primary device at work** | The cashier-window desktop with a receipt printer and cash drawer; positioned so the patient sees him, not the screen |
| **Personal device** | Android smartphone — his mobile-money years made him fluent in transactional apps and permanently suspicious of "pending" states |
| **Browser habits** | One tab, the Cashier desk, all day; he treats the computer as a till, not a browser |
| **Typing speed** | Fast and precise on the numeric keypad; deliberate everywhere else — reason fields get short, correct sentences because he knows who reads them |
| **Trust in software** | Transactional: total trust in anything that has never double-posted or lost a receipt; zero patience for the first time it does. Idempotency is not a feature to him — it's the contract |
| **Language** | Fluent English; conducts the money conversation in Twi or English matching the patient, always announcing amounts in both when there's any doubt |
| **Currency/units** | The clinic's configured currency (GHS at his clinic) on every line, receipt, and summary — and DD/MM/YYYY dates on receipts, because a patient disputing a receipt date is an argument he refuses to have |

---

## 7. Representative quotes

> "My drawer and that screen have to tell the same story at five o'clock. Everything else is decoration."

> "Don't make me the man who says no. Give me the button the manager owns, and let me say 'this is the proper way we record it.'"

> "If the payment went through, show me like you mean it. 'Pending' is a word for other people's money."

> "Every line on the receipt should be something the patient remembers happening. If I can't explain a line, I shouldn't be charging it."

---

## 8. How the New Clinic product should serve him

Direct implications for the Cashier Desk and payment flow, cross-referenced to existing product rules:

- **Payment posting must stay idempotent and its success state unmistakable** (§8.6 step 6) — a double-click, a stutter, or a retry after timeout must never double-charge; the post-payment screen should be visually terminal (receipt, change amount, next-patient) so there is no "did it go through?" moment, ever.
- **Blocking gates at payment time must name the fix and the fixer** — completion gate: "Profile 62% — complete at Front Desk or manager override"; E-Sign gate: "Consult not signed — Dr. [Name]" — because Kofi's job in that moment is to route the problem away from his window in one sentence.
- **The empty-charge guard is a feature; keep it server-side** — refusing payment on a visit with no fee lines protects reconciliation; the UI should pair it with a fast path to add the suggested lines rather than a dead end.
- **Cash tendered / change due must be the biggest numbers on the screen** — they are read aloud across a counter to a patient; this is a shared display, not a form field.
- **Left-without-paying and Close-without-charge must be visible, ACL-gated, reason-required, and slightly ceremonial** — their weight in the UI is what lets him deflect pressure ("it's recorded properly") while the audit trail (M7-F14, override reports) protects him at review time.
- **Skip-to-payment arrivals need their context visible on the payment screen** — a patient who bypassed pharmacy with reason "Patient declined Rx today" should not get charged for a dispense; the skip reason on the card is billing-relevant information, not just workflow trivia. *(The upstream skip UI was briefly regressed — AUDIT-1 in the [audit roadmap](./done/NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md) — and confirmed restored 2026-07-08; the golden-path E2E now exercises lab skip-to-payment through his queue.)*
- **Receipt reprint must exist and never re-post** — printer failures are routine; the recovery path has to be one click from the completed visit.
- **The daily cash summary is his scoreboard** — it must match core AR posting to the pesewa, because the manager's morning reconciliation (RB-02) is, from Kofi's seat, a daily performance review he intends to pass forever.
- **Confirm modals repeat the active role before money moves** (shared-device rule, §8.6) — hold this pattern permanently; it is the product's promise that nobody spends money on his name but him.

---

## 9. Non-goals for this persona

This persona does **not** drive requirements for: registration/search (Reception), clinical documentation (Nurse/Doctor), dispensing or bench work (Pharmacy/Lab), fee-schedule *configuration* or reconciliation *administration* (Admin/Manager), or the post-pilot Billing Back Office (M14 — corrections, payment search, and close-day belong to the manager/operator, not the window cashier, per D-BILL-3). V1 explicitly excludes partial payments and refunds UI at his window (D-BILL-2) — any design reintroducing them must go through a PRD amendment, not through cashier-screen convenience.

---

## 10. Background: the Ghanaian cash-handling context (for readers unfamiliar with it)

- Cash remains the dominant settlement method at small private clinics; the cashier's physical drawer, counted against a system total at close, is the clinic's core financial control — which is why reconciliation is a *daily manager ritual* (RB-02) rather than a monthly accounting task.
- Mobile-money agency work is a common background for cashier hires and instills exactly the habits this role needs: personal liability for mismatches, out-loud amount confirmation, and deep suspicion of ambiguous transaction states. Product patterns that mirror mobile-money UX conventions (explicit confirm, terminal success screens, printed proof) feel immediately trustworthy to staff from this background.
- Negotiated and installment payment is culturally routine in retail contexts, so a cash-only, full-settlement clinic policy needs the *system* to be the visible enforcer — the product's ACL-gated exception paths exist precisely so the person at the window never has to be the policy in person.

---

*Maintained alongside [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) and the other role personas ([Ama](./NEW_CLINIC_PERSONA_RECEPTIONIST_AMA.md), [Akua](./NEW_CLINIC_PERSONA_NURSE_AKUA.md), [Dr. Mensah](./NEW_CLINIC_PERSONA_DOCTOR_MENSAH.md), [Labik](./NEW_CLINIC_PERSONA_LAB_TECH_LABIK.md), [Esi](./NEW_CLINIC_PERSONA_PHARMACIST_ESI.md), [Selorm](./NEW_CLINIC_PERSONA_ADMIN_SELORM.md)). If the Cashier role's ACL, payment gates, or closure paths change, revisit §3 and §8 of this persona for drift.*

---

## Document history

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-07-07 | Initial persona, written from workflows §8.6, §10, §14.2 and code verified during the 2026-07-07 codebase audit (`ready_for_payment`-only queue gate, empty-charge guard, idempotent confirm, E-Sign payment re-check) |
| 1.0.1 | 2026-07-09 | Removed stale AUDIT-1 regression warning in §8 — skip UI confirmed restored 2026-07-08 (audit roadmap §7.0). Preamble: §8 restates product rules as rationale only; PRD/workflows stay canonical |
| 1.1.0 | 2026-07-09 | Cross-role safety audit pass: added three new verified gaps — payment posting and receipt writing aren't atomic, reconciliation never subtracts reversed payments, no in-product drawer-count/sign-off action exists — linked to [NEW_CLINIC_CROSS_ROLE_SAFETY_INTEGRITY_AUDIT.md](./new/NEW_CLINIC_CROSS_ROLE_SAFETY_INTEGRITY_AUDIT.md) |

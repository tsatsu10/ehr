# New Clinic — User Persona: Selorm Attipoe, Clinic Administrator (IT-confident)

| Field | Value |
|-------|--------|
| **Document version** | 1.0.0 |
| **Companion to** | [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) §4 (Roles and landing screens), §14 (Manager & admin workflows: §14.1 setup, §14.1.1 staff/ACL, §14.4 pilot worksheet, §14.8 day-2 runbooks RB-01–RB-20); [NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md](./done/NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md) (M6 + M15 Admin Hub); PRD §5.6 (flag invariant), §17.4 (technical runbooks) |
| **Audience** | Product, design, trainers, QA, implementers |
| **Purpose** | Ground design and copy decisions for the Admin Hub (config, People & Access, health/system), feature-flag enablement, and day-2 operations in the day of the clinic's only technical staff member |
| **Last audited** | 2026-07-07 — created from spec anchors and code verified during the [codebase audit](./done/NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md) |

> Composite persona for design purposes — no real name, facility, or patient data is used. She is
> the "Owner / IT" seat in the PRD's role table (workflows §4), given a face: a dedicated,
> IT-trained administrator rather than the owner-doctor wearing a second hat. Claims about the
> Ghanaian IT-career context reflect general, stable knowledge of the setting rather than a
> specific individual.

---

## 1. Snapshot

| | |
|---|---|
| **Name** | Selorm Attipoe |
| **Age** | 31 |
| **Role** | Clinic Administrator — runs everything about the clinic that isn't clinical or cash-in-hand: system configuration, staff accounts and permissions, fee schedules, backups, upgrades, feature enablement, reconciliation oversight, and every "the computer is doing something strange" report from all seven other staff |
| **Experience** | 8 years in IT: three in telecom/ISP customer-infrastructure support, two as an MIS officer at a mid-size hospital, three at her current clinic as its first and only administrator-with-a-technical-background |
| **Credential** | BSc Information Technology; industry short-courses (networking, Linux basics, a database administration certificate); no clinical training and careful never to pretend otherwise |
| **Location** | A small office behind reception with the clinic's server/router cabinet, a UPS she personally specified, and a desk that every staff member visits at least once a week |
| **Household** | Engaged; her fiancé teaches at a technical institute — their dinner conversation debugging is mutual |
| **In the product** | Maps to the **Clinic admin** role in [§4 Roles and landing screens](./NEW_CLINIC_V1_USER_WORKFLOWS.md#4-roles-and-landing-screens) — landing screen **Clinic Admin** (Admin Hub M6 + M15): fees, config, users/People & Access, reconciliation, system health, plus full chart access she deliberately almost never uses |

---

## 2. Career journey

- **Training:** BSc IT with a networking bias; discovered during her ISP years that she was better at — and happier — being the calm person between confused users and misbehaving systems than being a pure back-room engineer.
- **Early career (years 1–3):** Telecom/ISP support — field visits, router configs, and the formative discipline of *change windows*: you do not touch a live system at peak hours, you always have a rollback, and you write down what you changed.
- **Mid-career (years 4–5):** MIS officer at a hospital running a patchwork of stock OpenEMR, spreadsheets, and paper. She knows stock OpenEMR's admin screens well — Module Manager, user/group admin, backups — and knows exactly how hostile they are to hand to a non-technical owner.
- **Recent (years 6–8):** First administrator at her current clinic, hired when the owner-doctor admitted the clinic's growth had outrun his patience for IT. She led the New Clinic module adoption: ran the pilot config worksheet with the owner and clinical lead (§14.4), did the install and ACL setup, trained every role on their desk, and now owns the day-2 runbooks (§14.8) end to end.
- **Digital exposure:** The highest in the building by a wide margin. Comfortable in phpMyAdmin when she has to be, careful to *not need* to be — her operating principle is that anything she does through raw SQL instead of the product is a bug report she owes somebody.

---

## 3. A day in her life (mapped to the product)

| Time | What happens | Where it touches New Clinic |
|------|--------------|------------------------------|
| 7:30am | Runs the owner-morning checklist: confirms last night's **backup** actually ran (RB-01), runs **reconciliation** for yesterday and reviews the delta (RB-02) before the owner asks | §14.8.1; Admin Hub System / M6 Run reconciliation |
| 8:30am | Skims **Daily Reports** with the manager hat on: open visits, unsigned documentation, `closed_unpaid` rows, completion overrides — anything that smells like a training issue gets a friendly word to the right desk, not a memo | §14.2; M7 reports |
| Weekly | Staff lifecycle in **People & Access**: a new receptionist gets the Reception template (RB-05); a locum doctor gets the Doctor template with license number and explicitly **no** admin group (RB-06); leavers get **deactivated, never deleted** (RB-07); the eternal password reset (RB-08) | §14.8.2; M15 People wizard (`enable_admin_hub` = 1) |
| Monthly-ish | Fee updates with ceremony: edits the consultation price in **M6 Fees**, but only after telling the front desk first — open visits keep prior quoted amounts, and she learned to sequence the announcement before the save (RB-09/RB-10) | §14.8.3 |
| Per feature, post-pilot | The part of the job she genuinely enjoys: enabling a new capability behind its flag — lab ops (RB-13), pharmacy ops (RB-14), billing back office (RB-15) — each one run first on **staging**, against the PRD §17.4 checklist, with a smoke test by the actual role user before she flips it in production | §14.5–14.8.5; PRD §5.6 flag invariant |
| Quarterly | Governance sweep: **who has admin/lead access** (RB-17), completion-override review with the manager (RB-16), an optional restore-test from backup because a backup that's never been restored is a rumor (RB-01 extended), and **module upgrades** through Module Manager's Upgrade SQL (RB-20) | §14.8.6 |
| Constantly, in fragments | The human help-desk: "it says blocked," "the slip didn't print," "I can't see the patient" — she triages by asking for the exact message, checks the loaded asset version when a fix "didn't work" (hard-refresh first, then the `?v=` in the URL), and files what's real | Support reality; asset-version cache discipline |
| Rarely, gladly | Config **export** before any risky change, so she always has a rollback of the clinic's settings — a habit imported straight from her change-window years | Admin Hub config export/import |

---

## 4. Goals and motivations

- **Boring is the win condition.** Her ideal month is one where the clinical staff never think about her. Every unplanned visit to her office is a small failure of configuration, training, or product design — she wants to fix the category, not the ticket.
- **Change with a rollback, always.** Config export before edits, staging before production flags, backups she has personally restored — she doesn't trust a change she can't undo, and she extends that standard to the product itself.
- **Least privilege as a kindness.** She gives staff exactly the access their role needs — not out of distrust but because she's seen what an accidental admin click costs, and because the quarterly access review (RB-17) is much shorter when nobody has permissions they can't explain.
- **Make the owner self-sufficient for the small stuff.** Every runbook she can hand to the owner (password reset, fee edit) is a vacation she can actually take. The Admin Hub replacing stock OpenEMR's admin screens matters to her precisely because stock screens were never handable.
- **Trust the flags.** The PRD §5.6 invariant — every post-pilot surface behind an `enable_*` flag, default OFF, flag OFF meaning 100% legacy behavior — is her deployment safety model. She plans enablement like the small change-windows of her ISP years, and the invariant is what makes that planning possible.
- **Be the professional she trained to be, in a building full of other professions.** The nurse has her license, the pharmacist hers; Selorm's version is systems that are patched, backed up, documented, and quietly excellent.

---

## 5. Frustrations and pain points

- **Single point of failure, human edition.** There is no second IT person. Her sick days are the clinic's IT sick days. Everything about the product that is self-explanatory, self-healing, or safely delegable is personal relief; everything that requires her specifically is technical debt with her name on it.
- **Flag sprawl and drift.** The `enable_*` family has grown large, and she has personally hit the gap between the PRD's flag table and what's actually in the database — the 2026-07-07 audit confirmed the drift she suspected (flags in the PRD absent from code, and a couple dozen in code absent from the PRD). She wants **one** authoritative flag list, generated from reality, with defaults and dependencies (`enable_pharm_ops` requires `enable_pharmacy_role`) stated where she flips them.
- **Fresh-install landmines.** Her staging discipline exists because she doesn't trust installers blindly — and the audit proved the instinct right (a fresh single-pass install currently leaves `new_clinic_recall_meta.recall_type` missing until the upgrade runs again; **AUDIT-3**). A second clinic site is on the owner's mind, so fresh-install correctness is not hypothetical to her.
- **The stale-cache "you didn't fix it" loop.** Staff report a bug; a fix ships; staff report it again because the browser cached the old bundle. She now checks the loaded `?v=` asset version reflexively, but she resents every minute spent proving a fix that already worked.
- **Stock OpenEMR admin screens she still needs.** Until People & Access reaches full parity, some tasks bounce her into wrapped legacy screens — she understands the strangler-fig deal (legacy stays reachable until parity sign-off) and holds the product to the second half of that promise.
- **Version numbers that disagree.** Three different `acl_version` values across setup files (audit finding, **AUDIT-11**) means "is ACL up to date?" is answerable only by her memory. Systems should answer their own status questions.
- **Power and network as weather.** UPS, generator changeover, mobile-data failover — infrastructure instability is her baseline, and it's why she cares that the system fails *loudly and recoverably* (a clear error, an idempotent retry) rather than quietly and ambiguously.

---

## 6. Technology and device profile

| Aspect | Detail |
|---|---|
| **Primary device at work** | A decent laptop she specified herself, plus admin access to the clinic server; two monitors, one usually holding a runbook or checklist |
| **Personal device** | Android flagship-adjacent; runs her home lab's dashboards on it, because of course she has a home lab |
| **Browser habits** | DevTools open without hesitation; reads the Network tab when an ajax action fails; hard-refresh is her first move and checking the `?v=` asset version her second |
| **Typing speed** | Fast; writes real sentences in reason and note fields and expects the same of others, because she's the one reading them at review time |
| **Trust in software** | Calibrated, not given: trusts what she has staged, smoked, and restored; assumes everything else has a failure mode she just hasn't met yet. Vendor claims are hypotheses |
| **Language** | Fluent English; speaks Ewe at home and Twi across the clinic floor; writes all system documentation in plain English deliberately, for the owner's benefit |
| **Currency/units** | Configures rather than consumes: she is the person who sets `currency_code`/`currency_symbol` and date conventions in M6 for everyone else (M6-F27, D-REG-3) — and the reason the product must never hardcode either |

---

## 7. Representative quotes

> "I don't flip anything in production I haven't flipped in staging first. The flag being default-OFF is the product keeping that promise with me."

> "A backup nobody has restored is a bedtime story. Twice a year we restore one, and twice a year I sleep better."

> "Every permission I hand out is something I have to explain at the quarterly review. Give people their job, exactly, and reviews take twenty minutes."

> "When a fix 'doesn't work,' I check which version the browser actually loaded before I believe anyone — including the fix."

---

## 8. How the New Clinic product should serve her

Direct implications for the Admin Hub (M6 + M15), flag management, and operational surfaces, cross-referenced to existing product rules:

- **The flag invariant (PRD §5.6) is her contract — honor it absolutely.** Default OFF, OFF = 100% legacy, no half-new chrome. Her staged-enablement discipline is built on it; any surface that leaks through a disabled flag breaks her deployment model, not just a spec line.
- **One authoritative flag surface in M6** — every `enable_*` with its current value, default, dependency (e.g. `enable_pharm_ops` requires `enable_pharmacy_role` and `inhouse_pharmacy` ≠ 0), and a link to its runbook. The PRD-vs-code flag drift found by the audit (AUDIT-13) is exactly the class of problem this surface should make structurally impossible.
- **People & Access must reach honest parity before the legacy screens disappear** — templates (RB-05/06), deactivate-never-delete (RB-07), and the access-summary view that makes the quarterly RB-17 review a report she reads rather than a spreadsheet she builds. Until parity sign-off, the wrapped legacy screens remain a deliberate feature, not an embarrassment.
- **Config export/import as first-class rollback** — export before change is her habit; the product should encourage it (offer an export at the moment of risky edits) and make import a reviewed, confirmable diff rather than a blind overwrite.
- **System health that answers its own questions** — backup age, reconciliation status, ACL version vs expected, module/asset version, pending upgrade SQL. Every status she can read from a health panel (admin health-status surface) is a question the owner doesn't need her physically present to answer — and version drift like the `acl_version` mismatch (AUDIT-11) should be *visible* there, not archaeological.
- **Fresh-install and upgrade paths must be trustworthy** — her multi-site future depends on the installer being idempotent and complete in one pass; the `recall_type` ordering bug (AUDIT-3) is the counterexample to design against, and a post-install self-check ("all expected tables/columns present") would convert her staging paranoia into a product feature.
- **Fee edits with operational sequencing in mind** — the product already implies "tell the front desk before you save" (RB-09); surfacing that guidance at the point of change (and showing that open visits keep prior quoted amounts) turns tribal knowledge into UI.
- **Errors that respect a technical reader** — she is the one user who *wants* the action name, the HTTP status, and the asset version in a diagnostic view; give the admin role a debug-friendly error surface so her bug reports arrive pre-triaged.
- **Keep the plain-English layer for the owner** — everything she can delegate must read like the runbooks: numbered, jargon-free, safe. The product serves her best when it lets her be *optional* for the routine 80%.

---

## 9. Non-goals for this persona

This persona does **not** drive requirements for: clinical workflows of any kind (she has chart access and a firm policy of not using it), desk-level UI for reception/triage/doctor/lab/pharmacy/cashier, or patient-facing surfaces. She is also **not** the Manager persona: daily cash review and clinical-quality follow-ups are the manager/owner's morning (§14.2) — Selorm builds and maintains the machine that makes those reviews possible, and covers them only where the clinic's staffing collapses the two seats into one. Out-of-scope Tier-3 items (portal, telehealth, claims/EDI, FHIR clients) stay out of scope regardless of her technical ability to want them.

---

## 10. Background: the Ghanaian IT-career context (for readers unfamiliar with it)

- IT professionals in Ghana commonly enter through university BSc/HND programs in IT or computer science, with the telecom and banking sectors as the classic first employers — support roles there instill exactly the change-management discipline (staging, rollback, documentation) that Selorm brings to clinic administration.
- A dedicated administrator with a genuine IT background is the *aspirational* staffing pattern for the clinics New Clinic targets; many pilot clinics will instead have the owner-doctor or a manager covering this seat part-time. The product should treat Selorm as the ceiling and the §14.8 runbooks' plain-English register as the floor — designs that only work if the admin is Selorm exclude the clinics that need the product most.
- Infrastructure instability (grid power, generator changeovers, mobile-data failover) is a planning assumption, not an incident, in this setting — which is why backup verification, restore testing, and loud-and-recoverable failure modes carry more weight in this persona than they might in a well-provisioned reference deployment.

---

*Maintained alongside [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md), [NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md](./done/NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md), and the other role personas ([Ama](./NEW_CLINIC_PERSONA_RECEPTIONIST_AMA.md), [Akua](./NEW_CLINIC_PERSONA_NURSE_AKUA.md), [Dr. Mensah](./NEW_CLINIC_PERSONA_DOCTOR_MENSAH.md), [Labik](./NEW_CLINIC_PERSONA_LAB_TECH_LABIK.md), [Esi](./NEW_CLINIC_PERSONA_PHARMACIST_ESI.md), [Kofi](./NEW_CLINIC_PERSONA_CASHIER_KOFI.md)). If the Admin Hub, People & Access parity, flag registry, or day-2 runbooks change, revisit §3 and §8 of this persona for drift.*

---

## Document history

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-07-07 | Initial persona (IT-background clinic administrator), written from workflows §14 (setup, staff/ACL, worksheet, RB-01–RB-20 runbooks), the Admin Configuration redesign, PRD §5.6/§17.4, and audit findings AUDIT-3/-11/-13 verified 2026-07-07 |

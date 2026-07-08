# New Clinic — User Research & Competitive Analysis

| Field | Value |
|-------|-------|
| **Version** | 0.1.0 |
| **Date** | 2026-07-07 |
| **Status** | Draft for review |
| **Method** | Desk research: existing software analysis + competitor review synthesis, mapped against PRD §2/§4 and the shipped V1 module |
| **Related** | [NEW_CLINIC_V1_PRD.md](../NEW_CLINIC_V1_PRD.md) §2, §4 · [NEW_CLINIC_OPENEMR_GAP_ANALYSIS_AND_REDESIGN_PLAN.md](./NEW_CLINIC_OPENEMR_GAP_ANALYSIS_AND_REDESIGN_PLAN.md) · [NEW_CLINIC_MARKET_EXPANSION_MASTER_PLAN.md](./NEW_CLINIC_MARKET_EXPANSION_MASTER_PLAN.md) |

---

## 1. Purpose & scope

Secondary user research for New Clinic (cash-only private outpatient clinic product, West Africa focus). Covers: analysis of existing software in the segment, synthesis of published competitor reviews, user personas, needs, goals, pain points, jobs-to-be-done, a journey snapshot, and a competitive comparison against New Clinic as built (July 2026, V1 pilot ~92%).

**Limits of this method:** all findings are from published sources plus the product's own PRD research — no primary interviews. §10 proposes a lightweight primary-research plan to validate during the pilot.

---

## 2. Existing software analysis

### 2.1 The landscape (segment: 1–5 clinician private OPD clinics, West Africa)

| System | Type | Positioning | Relevance |
|--------|------|-------------|-----------|
| **Paper + Excel** | Status quo | Free, familiar, offline | The real #1 competitor; most small clinics still run on folders |
| **Stock OpenEMR** | Open source, self-hosted | Full US-centric EHR, free license | New Clinic's own substrate; the baseline being strangled |
| **OpenMRS / Bahmni** | Open source | Reference platform for resource-limited settings; Bahmni adds hospital modules (Odoo ERP) atop OpenMRS | Dominant open-source mindshare in Africa; implementer-driven |
| **Helium Health (HeliumOS)** | Commercial SaaS (Nigeria; 7 countries incl. Ghana) | Cloud EMR + billing + wallet + credit; 300+ facilities, ~300k visits/month | Best-funded direct commercial competitor in West Africa |
| **LHIMS (Lightwave)** | Government contract system (Ghana) | National public-facility EMR linking records + NHIS verification | Sets staff expectations in Ghana; its failures shape buyer skepticism |
| **ClinikEHR** | Commercial SaaS (Nigeria) | Offline-first, phone-first, NHIS integration, ₦15k–₦80k/month tiers | Closest in price/positioning to New Clinic's segment |
| **ClinicMaster** | Commercial (Uganda; East Africa, 180+ facilities) | Integrated visits, billing, lab, pharmacy, inventory, cash + insurance | Proof the "clinic-in-a-box with cash billing" model wins in Africa |
| **HospitalOS / EasyClinic and similar** | Commercial, regional | One-time licensing, offline capability, NHIS compatibility, local support | Long tail of local vendors competing on price + support proximity |

### 2.2 What each teaches us

**Stock OpenEMR.** Reviews consistently praise the free license and customizability, and consistently flag: dated UI, complex setup (database, roles, code imports), need for an IT consultant, no mobile app, incomplete translations. For this segment its structural gaps are the PRD's own list: US insurance UX, one mega-menu for all roles, no visit-state concept, unforgiving patient search, duplicate creation at the front desk (PRD §2.2, §2.4).

**OpenMRS/Bahmni.** Strong clinical data model and configurable patient queues (Bahmni), but implementer-centric: deployments need NGO or vendor engineering capacity. Usability literature on these systems repeats the same themes — lack of intuitiveness, complexity, time per clinical task. Bahmni's queue feature is a configuration exercise, not an opinionated FSM; nothing enforces "e-sign before payment" or two-step cash.

**Helium Health.** The strongest commercial narrative: integrated EMR/billing/pharmacy/lab/analytics plus a fintech moat (HeliumCredit loans, HeliumWallet payments — $10.9M disbursed to 460+ facilities). Weaknesses surfaced in reviews and its own terms: cloud dependence (no liability for downtime), staff resistance during adoption, limited record sharing between facilities. Its financing arm is a genuine differentiator New Clinic cannot match in software alone.

**LHIMS.** Cautionary tale and expectation-setter. Praised for replacing folders; plagued by network downtime outside regional capitals — nurses revert to paper during outages and double-enter later; sustainability threatened by unpaid ministry commitments. Two lessons: (1) offline/degraded-mode resilience is existential in this market; (2) staff who lived through LHIMS outages will judge any new system first on "does it work when the network doesn't."

**ClinikEHR.** Validates New Clinic's segment thesis from the commercial side: offline-first, works on 2G/3G and cheap smartphones, priced for African budgets (~$30/month starter vs $200–500 international), NHIS eligibility integration. Its marketing leads with exactly the pains the PRD identified — power cuts, connectivity, affordability, phone-first staff.

**ClinicMaster.** Validates the workflow thesis: its core loop is register → doctor alerted to who's waiting → consult → lab/pharmacy → cash billing with audit trails. 180+ facilities across five countries on essentially New Clinic's golden path, delivered as a paid product with local support.

### 2.3 Review-derived pain themes (cross-competitor)

Ranked by frequency across sources:

1. **Downtime/connectivity fragility** (LHIMS, cloud SaaS generally) — reversion to paper, double entry.
2. **Complexity / not intuitive** (OpenEMR, OpenMRS/Bahmni, EMR usability literature) — menu diving, time per task, training burden.
3. **Setup and support burden** (OpenEMR, OpenMRS) — needs IT capacity small clinics don't have.
4. **Staff adoption resistance** (Helium Health, LHIMS) — change management, not features, kills rollouts.
5. **Price misfit** (international SaaS) — $200–500/month products priced out of the segment.
6. **US/insurance-centric workflow noise** (OpenEMR) — irrelevant screens erode trust and speed.
7. **Mobile/tablet weakness** (OpenEMR) — front desk and triage are shared-device, small-screen contexts.

---

## 3. User personas

PRD §4.1 defines seven role personas (Ama/reception, Akua/nurse, Dr. Mensah, Kofi/cashier, Labik/lab, Ama Pharm/pharmacy, clinic manager). This research **confirms them** against the market evidence and adds two buyer-side personas the PRD treats only implicitly.

### Persona H — Owner-doctor (Dr. Owusu, buyer + user)

- **Profile:** 38–55, owns the clinic, consults 60% of the day, makes the software decision personally. No IT staff.
- **Needs:** See daily cash without asking the cashier; trust that money and records reconcile; software that staff can learn in hours, not weeks; a system that survives power/network cuts; predictable cost.
- **Buying triggers:** Lost revenue from unbilled visits; a duplicate-chart near-miss; NHIA/GHS inspection pressure; a peer's recommendation.
- **Blockers:** LHIMS-shaped skepticism ("computers go down"); fear of staff resistance; upfront cost; fear of vendor lock-in when local vendors fold.
- **Evidence:** Helium Health's whole go-to-market (credit + wallet) targets this person's cash-flow anxiety; ClinikEHR prices to his budget.

### Persona I — Practice administrator (Efua, multi-hat)

- **Profile:** In 1–3 clinician clinics, one person is receptionist + cashier + records officer + de facto admin. Variable computer literacy; phone-first.
- **Needs:** One screen per job she's doing *right now*; forgiving search; forms that don't punish interruptions (she is interrupted constantly); receipts that print first time.
- **Pain:** Every extra click multiplies across 40–80 patients/day; systems that assume dedicated staff per role.
- **Design implication:** Role desks must be fast to *switch between*, not just fast within — she wears three lanyards. (New Clinic's role-based desks + single Visit Board serve this; watch switching cost in pilot.)

The PRD's seven staff personas need no revision — competitor evidence independently reproduces their pain lists (e.g., ClinicMaster's "doctor is alerted who is waiting" = Persona C's queue pain; Bahmni's configurable queues = the same need expressed as configuration).

---

## 4. User needs (synthesized)

Ordered by criticality, with market evidence:

1. **Resilience to power/network failure** — LHIMS outage reports; ClinikEHR's offline-first pitch. *New Clinic status: LAN/XAMPP self-hosted deployment is inherently network-resilient vs cloud SaaS; no offline client mode, but no internet dependence either. This is a stronger story than cloud competitors and should be marketed as such.*
2. **Speed at the front desk** — search-first, sub-2s answers, minimal required fields (PRD §2.4; ClinikEHR 2G/3G claims). *Shipped: M1a search, progressive capture, G7 targets.*
3. **Visible queues / visit state** — "who is waiting and for whom" (ClinicMaster core loop; Bahmni queue config demand). *Shipped: Visit Board + per-desk queues, FSM.*
4. **Cash integrity** — every visit billed, receipts, daily totals reconcile (ClinicMaster billing + audit trails). *Shipped: Two-Step Cash, cashier desk, daysheet, M14.*
5. **Low training burden** — staff trained on task order, not menu trees (PRD §2.1; adoption-resistance evidence). *Target G6: ≤10h total training.*
6. **Duplicate prevention** — fragmented records are a clinical risk (PRD §2.4.2). *Shipped: real-time dup scoring at create. No surveyed competitor advertises create-time duplicate blocking — this is a differentiator.*
7. **Compliance without slowdown** — e-sign enforcement, audit trail, completion chokepoints. *Shipped; unique among segment competitors, who treat documentation attestation loosely.*
8. **Affordability & predictable cost** — segment prices: ₦15k–₦80k/month (ClinikEHR), one-time licenses (HospitalOS). *New Clinic pricing TBD — must land in this band; see MARKET_EXPANSION plan.*
9. **Local support proximity** — recurring theme in why local vendors beat international SaaS. *Open: New Clinic support model is a business question, not a code question.*
10. **NHIS awareness (not claims)** — competitors integrate eligibility; New Clinic deliberately stores NHIS ref only (V1 non-goal). *Correct for cash V1; the gap becomes real when targeting NHIS-credentialed clinics — already flagged as Tier 3 / PRD amendment territory.*

---

## 5. User goals

| Role | Goal (measurable where possible) |
|------|----------------------------------|
| Reception | Find or create the right patient in <30s; zero duplicate creations; patient told where to wait |
| Nurse | Vitals captured and patient in doctor pool in <3 min; never hunting a form |
| Doctor | See own queue instantly; consult documented + signed in the room; labs/Rx ordered without menu diving |
| Lab / Pharmacy | Worklist-driven day; nothing dispensed/resulted without an order; done before payment |
| Cashier | Zero unbilled exits; receipt on first attempt; end-of-day drawer matches daysheet |
| Owner/manager | Daily revenue + patient count + unpaid visits at a glance; audit-ready records; staff productive in week 1 |

These map 1:1 to PRD goals G1–G9; no goal surfaced in competitor research that the PRD lacks, except **"survive the outage day"** (implicitly covered by self-hosted architecture, worth an explicit acceptance scenario) and **"owner sees the business from home"** (remote access — currently a deployment/ops question).

---

## 6. Pain points (consolidated register)

**With current tools (paper / stock OpenEMR / competitors):**

| # | Pain | Who | Severity | Source | New Clinic answer |
|---|------|-----|----------|--------|-------------------|
| P1 | System down → paper fallback → double entry | All staff | Critical | LHIMS reports | Self-hosted LAN; no cloud dependence |
| P2 | Slow/exact-match patient search under queue pressure | Reception | Critical | PRD §2.4.1; OpenEMR reviews | M1a fuzzy/phonetic + phone-normalized search |
| P3 | Duplicate charts → clinical risk | Reception → Doctor | Critical | PRD §2.4.2 | Create-time dup scoring |
| P4 | No "who's waiting" visibility | Nurse/Doctor | High | ClinicMaster/Bahmni demand signal | Visit Board + queue FSM |
| P5 | Menu diving, click cost | Doctor | High | OpenEMR/OpenMRS reviews | Role desks; G1 ≥30% click reduction |
| P6 | Unbilled visits / leakage | Cashier/Owner | High | ClinicMaster billing pitch | ready_for_payment gate; completion chokepoint |
| P7 | US insurance screen noise | All | High | OpenEMR reviews; PRD §2.2 | Hidden in role menus (G3) |
| P8 | Long registration forms → garbage data | Reception | High | PRD §2.4.3 | Progressive capture, 70% at billing |
| P9 | Unsigned notes reaching payment | Doctor/Owner | Medium | PRD D32 | assertProfileSigned |
| P10 | Training burden / staff resistance | Owner | Medium | Helium/LHIMS adoption evidence | ≤10h curriculum; task-order UI |
| P11 | International SaaS pricing | Owner | Medium | ClinikEHR positioning | Pricing TBD — open business risk |
| P12 | No mobile app / poor small-screen UX | Nurse/Reception | Medium | OpenEMR reviews | Responsive islands; no native app (accepted V1) |

**Anticipated pains with New Clinic itself (honest register, for pilot watch-list):**

- **W1 — Legacy seams.** Wrapped stock screens (clinical forms bridge, history editors) still expose old-OpenEMR UX mid-flow; the strangler boundary is visible to users. Mitigation: gap-closure plan already sequences these.
- **W2 — Single-server risk.** Self-hosting on a clinic PC trades cloud downtime for backup/hardware risk; a dead disk is worse than a dead network. Needs a documented backup runbook + tested restore before pilot exit (fits M15 system-health scope).
- **W3 — Role-switch friction for multi-hat staff (Persona I).** Desks optimize per role; a 2-person clinic lives across 3 desks. Measure switch cost in pilot.
- **W4 — No patient-facing layer.** Competitors are adding patient apps/portals; deliberate non-goal, but expect owners to ask.
- **W5 — Polling scale ceilings.** Known and planned (SCALE-*), invisible at pilot size.

---

## 7. Jobs to be done

1. *When a patient walks in at peak hour,* I want to confirm who they are and get them queued in seconds, *so the line keeps moving and their history stays on one chart.*
2. *When I finish a consult,* I want ordering, documenting, and signing to be one motion, *so nothing chases me at end of day.*
3. *When the patient is ready to leave,* I want the system to tell me exactly what they owe and refuse to let compliance gaps through, *so the drawer, the records, and the law all agree.*
4. *When I close the clinic,* I want today's money and patient counts without counting paper, *so I know the business is healthy.*
5. *When the power or network fails,* I want to keep working, *so I never run a paper shadow system.*

---

## 8. Journey snapshot (walk-in, cash, as-built vs segment norm)

Arrive → **Search-first find** (vs paper folder hunt / OpenEMR finder) → **Start visit** creates encounter (vs no visit concept) → waiting + **REG fee** (Two-Step Cash; segment norm: single bill at end, leakage risk) → triage vitals from queue card → **shared doctor pool** (vs "whose patient is this" ambiguity) → consult + orders + **e-sign** (segment norm: signing optional/absent) → lab/pharmacy worklists → **ready_for_payment gate** → cash + receipt → closed visit, on the daysheet. Every stage answers "where is the patient and who owns them" — the single question the review literature says existing systems fail.

---

## 9. Competitive comparison — New Clinic vs the field

| Dimension | New Clinic (as built) | Stock OpenEMR | OpenMRS/Bahmni | Helium Health | ClinikEHR | ClinicMaster |
|-----------|----------------------|---------------|----------------|---------------|-----------|--------------|
| Role-based task desks | ● 9 desks shipped | ○ one menu | ◐ configurable | ◐ | ◐ | ◐ |
| Visit-state FSM / live board | ● opinionated FSM | ○ | ◐ config queues | ◐ | ◐ | ● core loop |
| Cash-first billing (two-step) | ● | ○ US-centric | ○ (Odoo ERP) | ● + wallet | ● | ● |
| Create-time duplicate blocking | ● | ○ post-hoc merge | ○ | unknown | unknown | unknown |
| E-sign enforced before payment | ● | ○ | ○ | ○ | ○ | ○ |
| Offline/outage resilience | ● self-hosted LAN | ● self-hosted | ● self-hosted | ○ cloud | ● offline-first | ◐ |
| Works without IT staff | ◐ needs installer | ○ | ○ | ● SaaS | ● SaaS | ◐ vendor |
| NHIS eligibility/claims | ○ (ref only, by design) | ○ | ○ | ◐ | ● | ◐ insurance |
| Patient app/portal/telehealth | ○ (non-goal) | ◐ | ◐ | ● | ● telemedicine | ○ |
| Financing/payments moat | ○ | ○ | ○ | ● credit+wallet | ○ | ○ |
| Clinical depth (full EHR) | ● (OpenEMR core) | ● | ● | ◐ | ◐ | ◐ |
| Price for segment | TBD | free + IT cost | free + IT cost | opaque | ● ₦15–80k/mo | paid, regional |

● strong ◐ partial ○ absent/weak

**Where New Clinic wins:** workflow opinionation (FSM + chokepoints + e-sign — nobody else enforces the golden path), duplicate prevention at create, full OpenEMR clinical depth under a modern UI, outage resilience versus cloud rivals, and zero-license-cost economics.

**Where it lags:** no financing/payments ecosystem (Helium), no NHIS eligibility (ClinikEHR), no patient-facing layer, installation/ops still needs a technical hand (SaaS rivals win "sign up today"), and support/pricing model unproven.

**Positioning implication:** sell the *operational discipline* ("no unbilled exits, no unsigned notes, no duplicate charts, works when the network doesn't") rather than feature count — it is the one column where every competitor scores ○.

---

## 10. Recommended primary research (pilot-embedded, low cost)

1. **Contextual observation, week 1 + week 4 of pilot:** shadow reception and cashier for one peak morning each; count workarounds, paper artifacts, role switches (validates G1, W3).
2. **Staff interviews (5–7, 30 min, all roles):** PRD's click-script tasks as prompts; probe P1–P12 register above.
3. **Owner interview:** willingness-to-pay anchored against ClinikEHR band (₦15–80k / GHS equivalent), support expectations, backup anxiety (W2).
4. **Outage drill:** deliberately pull the network mid-morning once; observe whether work continues (validates the resilience claim before marketing it).
5. **Instrument the existing telemetry** (login landing, search timing, override logs) as passive research — G2/G7/G9 already define the metrics.

---

## 11. Sources

- Helium Health: [heliumhealth.com](https://heliumhealth.com/) · [YC profile](https://www.ycombinator.com/companies/helium-health) · [Silicon Africa company profile](https://siliconafrica.org/company/helium-health/) · [Nigeria Health Watch — Helium Credit](https://nigeriahealthwatch.medium.com/helium-credit-is-financing-africas-private-clinics-one-loan-at-a-time-c254e10ee9d7) · [softwarereview.com](https://softwarereview.com/helium-health) · [ITQlick review](https://www.itqlick.com/helium-health)
- LHIMS Ghana: [NewsGhana — challenges](https://www.newsghana.com.gh/challenges-arise-as-ghanas-lhims-revolutionizes-healthcare/) · [GhanaWeb — system on brink](https://www.ghanaweb.com/GhanaHomePage/features/Ghana-s-digital-health-system-on-the-brink-of-collapse-2004093) · [BMC Health Services Research — LHIMS effectiveness study](https://link.springer.com/article/10.1186/s12913-024-11883-3)
- OpenEMR reviews: [Capterra](https://www.capterra.com/p/131911/OpenEMR/reviews/) · [Medesk review](https://www.medesk.net/en/blog/openemr-review/) · [SelectHub](https://www.selecthub.com/p/emr-software/openemr/) · [The CFO Club](https://thecfoclub.com/tools/openemr-review/)
- OpenMRS/Bahmni: [bahmni.org](https://www.bahmni.org/) · [Bahmni patient queues wiki](https://bahmni.atlassian.net/wiki/spaces/BAH/pages/32014629) · [SolDevelo — OpenMRS accessibility](https://soldevelo.com/blog/advancing-digital-healthcare-accessibility-in-openmrs/) · [EMR usability qualitative study (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11401339/)
- ClinikEHR: [Best EMR for private clinics Nigeria](https://clinikehr.com/blog/best-emr-private-clinics-nigeria) · [Top 5 free EHR for African clinics](https://clinikehr.com/blog/top-5-free-ehr-african-clinics) *(vendor content — pricing claims useful, rankings self-serving)*
- ClinicMaster: [clinicmaster.net](https://www.clinicmaster.net/) · [Dignited review](https://www.dignited.com/4030/review-clinicmaster-towards-paperless-health-facilities-and-tech-empowered-medics/)
- Market context: [Kapsule — EHR in Africa](https://kapsuletech.com/blog/electronic-health-records-africa/) · [MedSoftwares — West Africa 2026 trends](https://www.medsoftwares.com/news/healthcare-software-trends-west-africa-2026)

---

## 12. Version history

| Version | Date | Change |
|---------|------|--------|
| 0.1.0 | 2026-07-07 | Initial desk-research draft: landscape, personas H/I, needs/goals/pain register, JTBD, comparison matrix, pilot research plan |

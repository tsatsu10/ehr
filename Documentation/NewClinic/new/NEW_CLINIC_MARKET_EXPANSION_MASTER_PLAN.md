# New Clinic — Market Expansion Master Plan (Product · Delivery · Business)

**Version:** v0.1.2 · **Date:** 2026-07-07 · **Status:** Draft for review
**v0.1.1:** T4 broadened from corporate-only to all third-party payers — adds private health
insurance / HMO billing (MKT-PHI-*), Ghana PHIS and Nigeria HMO market numbers.
**v0.1.2:** second-pass audit — §3.0 cross-segment realities (mobile money tender, Ghana Card
identity, WhatsApp patient channel, offline posture, data-rescue kit), §6.4 upstream OpenEMR
patch policy, fleet operations in §7.3, migration offering in §7.4, indemnity/trademark/grants
in §7.5, new risk rows, new open questions.
**Owner:** Product/Founder · **Scope:** everything from first pilot to multi-market operation

This is the end-to-end plan for taking New Clinic from "built" to "in business": which
markets and facility types we serve, in what order, what features each one needs, how the
work is managed, and how the business around it runs (pricing, support, hosting, regulatory,
sales). It sits **above** the PRD in ambition but **below** it in authority: nothing here
overrides PRD §3.2 non-goals — every scope expansion is explicitly marked
**[PRD amendment required]** and must land in the PRD before code starts.

Read alongside: [PRD](../NEW_CLINIC_V1_PRD.md) ·
[Gap analysis & GAP-A–D plan](./NEW_CLINIC_OPENEMR_GAP_ANALYSIS_AND_REDESIGN_PLAN.md) ·
[Scorecard](../NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md) ·
[Scalability plan](./NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md) ·
[Pilot readiness pack](../worksheets/NEW_CLINIC_V1_PILOT_READINESS_PACK.md)

---

## 0. TL;DR

- **One rail, many stations.** Everything we sell is the same product: a workflow engine for
  *small outpatient facilities that collect money at the point of care*. Each market segment
  is a packaging + a small feature delta on that rail — never a second product.
- **Six target segments, in order:** T0 single cash clinic (prove it) → T1 clinic chains →
  T2 specialist verticals (maternity/ANC first) →   T3 NHIS hybrid clinics (the big Ghana
  unlock: ~20M active members, GH¢2.69bn claims paid 2025) → T4 third-party payers
  (corporate accounts + private health insurance/HMO panels) → T5 standalone diagnostics &
  pharmacy → T6 Nigeria/anglophone expansion.
- **Five things gate everything:** (1) one live pilot with real patients, (2) mobile-money
  tender recording at the cashier (day-one reality in Ghana — "cash-only" clinics take MoMo
  daily), (3) SMS outreach (GAP-B1), (4) NHIS claims preparation **[PRD amendment
  required]**, (5) the SCALE-* hardening tasks before any multi-tenant hosting.
- **Business model:** subscription per facility per month, three tiers, sold with data
  ownership as the lead pitch (the LHIMS collapse is our best marketing story). Local-first
  deployment (clinic server or managed VPS), never a foreign cloud dependency we can't defend.
- **Hard no's stay no:** government/national tenders, donor HIV/TB programs, inpatient ward
  management as a primary target, telehealth/portal. Section §4 exists so we stop re-debating
  these.

---

## 1. Baseline — what we have on day zero

| Asset | State (July 2026) |
|---|---|
| Product | V1 pilot path ~92% built, QA-signed; 22 production React islands; all role desks M1–M9 + ops hubs M11–M18 |
| Coverage vs stock OpenEMR | 72–100% per area; 11 Tier-1 gaps (G1–G11) with a phased close plan (GAP-A–D) |
| Live deployments | **0** — no production patients, no uptime history, no reference customer |
| Scale headroom | 10×–50× (polling architecture; SCALE-* tasks open) — fine for a clinic or small chain, not for hosting dozens of tenants on one box |
| Languages | English only (i18n mechanism planned as GAP-D1) |
| Interoperability | None by design (no FHIR/DHIS2/claims connectors) |
| Team | One development seat (bus factor 1) |
| Foundation | OpenEMR core (auth, ACL, data model — 20+ years battle-tested) |

The honest read: product risk is low, execution/market risk is 100% of the risk. This plan
is therefore sequenced around *proof*, not features.

---

## 2. Market segments — overview and priority

| # | Segment | Size signal | Feature delta | Effort | Revenue quality | Phase |
|---|---|---|---|---|---|---|
| **T0** | Single private cash clinic (current PRD target) | Thousands in Ghana; the design centre | None — ship what exists | — | Low per unit, proof value ∞ | **E0 (now)** |
| **T1** | Private clinic chains (2–20 branches) | Fastest-professionalizing segment; one sale = many sites | Near zero (facility scoping exists) | S | High (multi-site contracts, sticky) | **E1** |
| **T2** | Specialist cash practices (maternity/ANC, eye, dental, dermatology, fertility) | Urban cash-rich niches (Accra, Kumasi, Lagos) | Per-vertical module (ANC series, dental chart) | M per vertical | High willingness to pay | **E1–E2** |
| **T3** | NHIS-accepting private clinics (hybrid cash + insurance) | ~20M active NHIS members (~60–66% of Ghana); GH¢2.69bn claims paid 2025; 5,449 accredited facilities; 28M visits/yr | NHIS claims prep + batch submission **[PRD amendment required]** | L (one hard feature) | The domestic unlock — 2/3 of patients carry the card | **E2** |
| **T4** | Third-party-payer clinics: corporate accounts + private health insurance / HMO panels | Corporate: small count, high contract value. PHI: 12 licensed schemes in Ghana (~500k+ lives, urban formal sector); Nigeria: 83 accredited HMOs, ~2.17M private-HMO enrollees (1.18M in Lagos alone) | Payer accounts, member verification, co-pay split, per-payer tariffs, invoicing/claims, reconciliation | M–L | Very high, sticky B2B; PHI panel status is a clinic acquisition magnet | **E2** |
| **T5** | Standalone diagnostic centres & retail pharmacies | Thousands of registered pharmacies + licensed OTC sellers in Ghana; diagnostics fastest-growing private segment | Unbundle lab-ops / pharm-ops as standalone entry points (walk-in without visit) | M (packaging, not capability) | Medium, high volume | **E3** |
| **T6** | Nigeria + anglophone West Africa (Liberia, Sierra Leone, Gambia) | ~40,000 registered facilities in Nigeria; private sector delivers 60–70% of care; mostly <10-bed cash facilities | None technically (English); everything operationally (local support partner) | Ops-L | 10× home market | **E4** |
| T7 | Faith-based outpatient (CHAG clinics/health centres) | CHAG: 344–375 facilities, 30–40% of national services, 8–10M patients/yr — but outpatient slice only (~160 clinics + ~56 health centres) | NHIS (T3) is the prerequisite; mission-network sales motion | Inherits T3 | Medium; institutional buyers | E4 (behind T3) |
| T8 | Francophone West Africa | Large but blocked | i18n French (GAP-D1 + dictionary) | L | Deferred | E5 / unscheduled |

**Priority logic:** effort-to-unlock divided into market size. T1/T2 are nearly free. T3 is
one expensive feature that unlocks the majority of the domestic market. T6 is an operations
problem, not a code problem, and must wait for reference customers.

---

## 3. Segment deep dives

Each deep dive lists: profile → what we already have → feature delta → go-to-market →
pricing posture → success metric. Feature IDs use a new `MKT-*` prefix; they join the
existing GAP-A–D backlog in one roadmap (§5).

### 3.0 Cross-segment realities (apply to every segment, T0 included)

Things that are not "a market" but shape all of them — surfaced by second-pass audit:

- **Mobile money is part of "cash".** In Ghana, a large share of point-of-care payment
  arrives as MoMo transfer, not notes. The Two-Step Cash flow needs a **tender type**
  (cash / MoMo / card) recorded per payment, and the M7 close-of-day must reconcile the
  physical drawer and the MoMo wallet **separately** — they fail in different ways.
  - `MKT-MOMO-1` — Tender type on payment capture + per-tender close-of-day reconciliation
    lines (S–M; **W1, pilot-blocking** — pilots will hit this in week one).
  - `MKT-MOMO-2` — Optional per-provider payment confirmation/API reconciliation (deferred;
    per-provider adapter like insurer verification — never a blocking dependency).
  - **[PRD amendment required]** only if PRD currently defines payment as physical cash;
    otherwise a config/tender extension.
- **Ghana Card is the identity anchor.** NHIS membership is now linked to the Ghana Card,
  and clinics increasingly ask for it at registration.
  - `MKT-GHCARD-1` — Ghana Card number field on registration (validated format, unique
    index, duplicate-check joins it) and on the MRD banner. Cheap (S) and strengthens both
    duplicate prevention (G10/D2) and future NHIS verification (`MKT-NHIS-1` should accept
    Ghana Card as the lookup key, not only the NHIS number).
- **WhatsApp is a patient channel, not just a support channel.** Urban patients read
  WhatsApp before SMS. GAP-B1 outreach and appointment/result notifications should treat
  the channel as pluggable (SMS first, WhatsApp Business API as a second sender —
  `MKT-WA-1`, deferred until outreach volume justifies the API cost).
- **Offline/degraded operation must be a written promise, not an implication.** The on-prem
  posture (§7.2) already tolerates internet loss (LAN-only operation continues). What's
  missing is the documented drill: UPS sizing, what stops working offline (SMS, off-site
  backup), power-loss recovery steps, and the "server dead" fallback (paper forms + same-day
  re-entry). Deliverable: a one-page **Outage Runbook** per deployment (docs, not code) —
  part of the E0 pilot pack.
- **Data rescue is an onboarding asset.** Facilities stranded by the LHIMS shutdown and
  clinics on dying local systems need their data moved, not just a fresh install.
  - `MKT-MIG-1` — Reusable migration kit: patient demographics + balances importer (CSV
    mapping tool with dry-run report, per user-rule §2 scripts discipline), plus a
    per-source checklist (what we take: demographics, balances, allergies; what we don't:
    full encounter history in V1). Sold as part of setup fee; see §7.4 (migration offering).

### T0 — Single private cash clinic (the proof segment)

- **Profile:** 1–3 consulting rooms, 5–15 staff, cash at point of care, owner-doctor or
  owner-manager. This is the PRD design centre; no feature work.
- **Have:** the entire V1 pilot path.
- **Delta:** `MKT-MOMO-1` tender types (§3.0) + Outage Runbook delivered. Otherwise none —
  the deliverable is a **live pilot**: real patients, real cash/MoMo, 90 days of uptime.
  Pilot playbook in §6.5.
- **GTM:** founder-led; 1–3 clinics recruited through personal/professional network; free or
  near-free in exchange for reference rights, testimonials, and weekly feedback sessions.
- **Success metric:** 1 clinic live 90 days, ≥80% of visits fully processed in-system
  (registration → consult → payment → dispense), zero data-loss incidents, owner willing to
  be a reference call.

### T1 — Private clinic chains (2–20 branches)

- **Profile:** ambitious owner operating 2–20 sites, usually with an operations manager;
  wants cross-branch visibility (cash totals, stock, staff performance).
- **Have:** multi-facility scoping, facility×user matrix, per-facility queues, report hub.
- **Delta (small):**
  - `MKT-CHAIN-1` — Cross-facility roll-up lens in Report Hub (cash by branch, visits by
    branch, exception summary). Mostly report queries; reuses `StatCard`/`DataTable`.
  - `MKT-CHAIN-2` — Central formulary/price-list push (define once, apply to branches) on top
    of GAP-C2 codes CRUD and GAP-C4 formulary admin.
  - `MKT-CHAIN-3` — Branch-comparison daily report email/print (extends M7).
  - Hard prerequisite: relevant SCALE-* items if branches share one server.
- **GTM:** direct sales to the ~dozens of visible chains in Accra/Kumasi/Tema; the T0 pilot
  reference is the door-opener. Chains convert from "clinic software" to "management
  visibility" pitch.
- **Pricing posture:** per-facility/month with a chain discount; setup fee per branch.
- **Success metric:** 1 chain (≥3 branches) live; owner uses the roll-up report weekly.

### T2 — Specialist cash practices

Pick **two** verticals max for E1–E2; the others follow demand. Recommended first two:
**maternity/ANC** (highest volume, clearest module) and **eye** (near-zero delta).

- **Maternity / ANC:**
  - `MKT-ANC-1` — ANC visit series: gestational-age-aware visit schedule, per-visit checklist
    (BP, weight, fundal height, urine protein), series view on the GAP-B2 Trends chart.
  - `MKT-ANC-2` — Delivery-referral letter template (extends GAP-A4 letters).
  - Note: intrapartum/delivery itself is **inpatient — out of scope** (§4). We serve the
    antenatal/postnatal outpatient loop only.
- **Eye clinics:** visual-acuity fields on the consult form + optical shop sale via pharm-ops
  OTC flow (`MKT-EYE-1`, S effort).
- **Dental:** `MKT-DENT-1` — tooth chart (odontogram) component + per-tooth procedure
  coding. M–L effort; only build against a signed pilot dental customer.
- **Dermatology/fertility:** largely served by existing consult + documents (photos need
  GAP-A2 documents manager); no dedicated module until demand proves out.
- **GTM:** vertical-specific one-pagers; specialist associations and suppliers (dental depots,
  optical suppliers) as channels.
- **Success metric:** 2 specialist practices live on tailored flows without custom code forks.

### T3 — NHIS-accepting private clinics **[PRD amendment required]**

The single biggest domestic unlock, and the single biggest build in this plan.

- **Market numbers (late 2025):** ~20M active NHIS members (60–66% of population);
  GH¢2.69bn paid to providers in 2025; 5,449 accredited facilities; 28.11M facility visits;
  government currently paying claims inside the statutory 3-month window (a cyclical
  tailwind — private providers re-warming to NHIS).
- **Why the PRD must be amended:** PRD V1 is cash-only with insurance UI behind
  `enable_insurance`; claims connectors are a non-goal (scoped to US EDI/X12). NHIS claims
  are a *different* thing — a Ghana-specific batch submission — and need their own PRD
  section defining scope, not a reinterpretation of NG1.
- **Feature set:**
  - `MKT-NHIS-1` — Membership capture & verification: NHIS card number on registration,
    validity check (manual first; NHIA API if/when accessible), eligibility badge on the
    banner and cashier desk.
  - `MKT-NHIS-2` — Tariff mapping: NHIS medicines list + G-DRG/tariff codes mapped onto the
    existing codes/prices tables (extends GAP-C2); per-item "NHIS vs cash" price resolution.
  - `MKT-NHIS-3` — Split billing at cashier: NHIS-covered items zero-rated/queued for claim,
    non-covered items collected as cash — same Two-Step Cash flow, one extra branch.
  - `MKT-NHIS-4` — Claims workbench in M14 bill-ops: batch assembly per month, validation
    (member expiry, tariff mismatches), export in NHIA claims format (start with the format
    accredited facilities actually submit — verify current e-claims spec during discovery),
    submission status tracking, reconciliation of payments against batches.
  - `MKT-NHIS-5` — Claims aging & rejection reports in Report Hub.
- **Sequencing:** discovery first (2 weeks with a real NHIS-accredited clinic and their
  claims officer — do not design this from documentation alone), then PRD amendment, then
  build behind `enable_nhis` (default OFF).
- **Effort:** L (est. 10–15 sessions + discovery). **Success metric:** one accredited clinic
  submits a real monthly batch generated by the system and gets it paid.

### T4 — Third-party-payer clinics (corporate accounts + private health insurance / HMOs)

One engine, two payer flavours. A corporate account and a private insurer are mechanically
the same thing from the clinic's side: a third party guarantees payment for a defined member
list at agreed tariffs, the patient pays a co-pay in cash, and the clinic invoices/claims the
payer periodically and chases the money. Build the **payer engine once**; corporate is the
simple flavour (shipped first), private insurance adds verification and claim formats on top.

- **Market numbers:**
  - **Ghana PHI:** 12 NHIA-licensed Private Health Insurance Schemes (Act 852) — commercial
    players like Acacia, Nationwide, Glico, Metropolitan/Hollard, Enterprise, Premier —
    covering ~500k+ lives, overwhelmingly urban formal-sector employees. Small share of the
    population, but *concentrated exactly where our target clinics are* (Accra/Tema/Kumasi),
    and PHI members are the highest-revenue patients a private clinic sees. Insurers set
    their own tariffs and provider panels; being "on panel" for 2–3 insurers is a real
    patient-acquisition channel for a clinic — which makes claim handling a selling point
    for *us*.
  - **Nigeria HMOs (for T6 later):** 83 NHIA-accredited HMOs; ~2.17M private-HMO enrollees
    nationwide with **1.18M in Lagos alone** (over half the national total) — top insurers
    include AXA Mansard (~368k), United Healthcare (~305k), Reliance (~266k), Hygeia (~183k).
    Any Lagos clinic ambition (T6) *requires* HMO billing; cash-only software is a
    non-starter there.
- **Feature set — payer engine (corporate flavour first):**
  - `MKT-PAYER-1` — Payer account entity: payer (company or insurer), contact, agreed price
    list/tariff, covered member roster (CSV import), coverage rules (covered services,
    exclusions, co-pay %/caps, annual limits).
  - `MKT-PAYER-2` — Charge-to-payer at cashier: covered lines accrue to the payer, co-pay
    and non-covered items stay in the existing cash flow; visit-level payer badge on the
    banner and cashier desk.
  - `MKT-PAYER-3` — Statement/invoice/claim batch generation per payer per period (print/PDF
    via the Twig print pattern) + payment recording and aging against batches in M14.
  - `MKT-CORP-4` — Pre-employment / periodic medical exam report template (extends GAP-A4).
- **Feature set — private insurance flavour (on top of the engine):**
  - `MKT-PHI-1` — Member verification at registration/check-in: policy number, plan,
    validity, co-pay terms; manual card check first, insurer portal/API per payer where one
    exists (each insurer differs — treat integrations as per-payer adapters, never a
    blocking dependency).
  - `MKT-PHI-2` — Pre-authorization tracking: procedures/amounts above a payer threshold
    need an auth code before service; capture code + status on the visit, warn at cashier
    when missing.
  - `MKT-PHI-3` — Per-payer claim formats and rejection/resubmission workflow (extends
    `MKT-PAYER-3`); claims aging and rejection-rate reports in Report Hub, per payer.
- **Sequencing:** payer engine + corporate in E2 (simplest payer, no verification problem);
  PHI flavour immediately after, piloted with a clinic already on 1–2 insurer panels. The
  NHIS workbench (`MKT-NHIS-4`) and `MKT-PAYER-3`/`MKT-PHI-3` should share claim-batch
  plumbing — design them together, even though they ship separately.
- **Effort:** M for the engine + corporate (5–7 sessions); +M for PHI (4–6 sessions, mostly
  verification UX and per-payer claim formats). **[PRD amendment required]** (introduces
  non-cash payers; one amendment covers corporate + PHI + NHIS as a "payers" section).
- **GTM:** corporate via HR/EHS managers and T1 chains holding contracts; PHI via clinics
  already on insurer panels drowning in paper claims — and via the insurers' provider-
  relations teams themselves, who benefit from clean claims and may recommend software that
  reduces their rejection load.
- **Success metric:** one clinic invoicing ≥2 corporate accounts monthly from the system;
  one clinic submitting claims to ≥2 private insurers with a rejection rate below their
  previous paper process.

### T5 — Standalone diagnostics & retail pharmacy

- **Profile:** lab-only diagnostic centres and retail pharmacies with walk-in customers and
  no doctor visit. We already built the operational cores (M12 lab-ops, M13 pharm-ops);
  the work is **packaging**: an entry point that doesn't assume a clinic visit.
- **Feature set:**
  - `MKT-LAB-SA-1` — Walk-in requisition flow: register client (lightweight), capture
    external doctor's order, pay, collect sample, result, print/SMS report — no encounter/queue
    FSM required. Reuses accession/worklist/result entry wholesale.
  - `MKT-PHARM-SA-1` — Pharmacy-first mode: OTC sale as the home screen, stock and registers
    as primary nav, clinic desks hidden by config profile.
  - `MKT-SA-COMMON-1` — "Facility profile" concept in M6: `clinic | lab | pharmacy` presets
    that pre-toggle the enable_* flags and menu (config, not new architecture).
- **Effort:** M each. **Success metric:** one lab and one pharmacy live on profile presets
  with zero code forks.

### T6 — Nigeria and anglophone West Africa

- **Market numbers:** ~40,000 registered hospitals/clinics in Nigeria (85% primary care);
  private sector delivers 60–70% of services; typical private facility is <10 beds,
  cash-dominant — exactly our profile. Plus Liberia, Sierra Leone, Gambia as low-competition
  smaller entries.
- **Feature delta:** `MKT-NG-1` — country config pack (states/LGA lists, phone formats).
  **Hard prerequisite: the T4 payer engine + MKT-PHI flavour** — Lagos, the only city where
  private HMO enrollment is dense (1.18M lives), is effectively closed to cash-only software;
  a Lagos clinic without HMO billing loses its best patients. Nigeria entry therefore comes
  after W5, never before.
- **The real work is operational:** a local support partner (revenue-share reseller or
  first hire), local hosting arrangement, WhatsApp-first support channel, Naira pricing.
  Competitive note: funded local players (e.g. Helium Health) own the top of this market —
  we compete underneath on price, offline-tolerance, and data ownership, not head-on.
- **Gate:** do not enter before 5+ paying Ghanaian references and the support playbook (§7.3)
  is written and tested. **Success metric:** 3 paying Nigerian facilities via a partner we
  don't personally operate.

### T7 / T8 — Faith-based outpatient · Francophone (parked)

- **T7 (CHAG-type):** real market (344–375 facilities, 30–40% of national service volume,
  8–10M patients/yr) but NHIS-heavy and half hospitals. Enter *after* T3 ships, targeting
  their ~160 clinics + ~56 health centres. Sales motion is institutional (diocese/church
  health boards) — one relationship can open many facilities.
- **T8 (Francophone):** blocked on GAP-D1 i18n + a French dictionary. Schedule only when a
  concrete customer or partner exists; do the i18n *mechanism* (GAP-D1) earlier regardless,
  because retrofitting gets more expensive every sprint.

---

## 4. Markets we deliberately do NOT enter (re-affirmed)

Recorded here so future sessions stop re-litigating them:

1. **Government / national health systems.** The LHIMS lesson: $100M contract, ~$77M paid,
   ~450 of 950 facilities delivered, contract killed, replaced by state-owned GHIMS. Politics
   decides winners there, not product. We sell to facility owners who control their own money.
2. **Donor/NGO disease programs (HIV, TB, vertical programs).** OpenMRS is entrenched
   (thousands of sites, national programs) and mandatory DHIS2/FHIR reporting is a stack we
   deliberately don't carry.
3. **Inpatient hospitals as a primary target.** Ward/bed/theatre management is a
   product-sized build. Small hospitals may still buy us *for their OPD* — that's T0/T3
   packaging, not an inpatient module.
4. **Telehealth, patient portal, US claims/EDI, eRx vendors, FHIR/SMART clients** — PRD §3.2
   non-goals, all still in force.

Any change here is a PRD amendment + a new version of this document, not a quiet exception.

---

## 5. Consolidated feature roadmap (product workstream)

One backlog, three sources: existing GAP-A–D plan (platform completeness), SCALE-* plan
(performance), and the new MKT-* items (market deltas). Order of operations:

| Wave | Contents | Why this order |
|---|---|---|
| **W1 — Pilot enablement** | Pilot readiness pack items; **MKT-MOMO-1 tender types + per-tender reconciliation**; MKT-GHCARD-1 Ghana Card field; MKT-MIG-1 migration kit; Outage Runbook (docs); GAP-A1 office notes, GAP-A2 documents, GAP-A5 patient follow-ups, GAP-A6 MFA | Everything a single live clinic needs day-to-day; MoMo tender is pilot-blocking (week-one reality); A2 (documents) is the highest daily-value gap |
| **W2 — Retention & outreach** | GAP-B1 outreach/SMS (with provider decision, §9-Q1 of gap plan), GAP-A3 address book, GAP-A4 letters/labels, GAP-B2 trends | SMS recalls/campaigns are the killer regional feature and feed T2 (ANC recall) directly |
| **W3 — Chain & admin depth** | MKT-CHAIN-1..3, GAP-C1 audit browser, GAP-C2 codes CRUD, GAP-C3 lists, GAP-C4 formulary | T1 sales need roll-ups; C2/C4 are prerequisites for chain price-push and NHIS tariffs |
| **W4 — NHIS** | MKT-NHIS-1..5 (after discovery + PRD amendment) | The domestic unlock; deliberately after the platform is stable under real use |
| **W5 — Verticals & payers** | MKT-ANC-1..2, MKT-EYE-1, MKT-PAYER-1..3 + MKT-CORP-4 (corporate), then MKT-PHI-1..3 (private insurance) | Sold against signed customers, not speculatively; payer engine shares claim-batch plumbing with W4 NHIS |
| **W6 — Unbundling & expansion** | MKT-LAB-SA-1, MKT-PHARM-SA-1, MKT-SA-COMMON-1, MKT-NG-1, GAP-D1 i18n mechanism | Packaging plays once references exist |
| Continuous | SCALE-* tasks (one per PR, per hardening plan), GAP-D2–D5 | Interleaved; SCALE items become blocking before any multi-tenant hosting |

Rules that don't change: every new surface behind an `enable_*` flag default OFF; one
`ModuleAssetVersion.php` bump per batch; scorecard + README index updated per phase;
`composer verify:new-clinic` for backend PHP; CI green is necessary but not sufficient.

---

## 6. Project management workstream

### 6.1 Operating cadence

- **Weekly build rhythm:** 4 build days, 1 day reserved for support/pilot feedback (grows as
  customers grow). Mobile (Cursor iOS) sessions stay scoped per `new-clinic-mobile-scope.mdc`;
  backend PHP remains draft until desktop verification.
- **Per-wave definition of done:** features QA'd behind flags → pilot clinic exercises them →
  scorecard row updated → docs synced. A wave is not done because code merged; it's done when
  a real user has used it.
- **Release trains:** cut a tagged release monthly (`v1.x`) with a human-readable changelog
  (CHANGELOG.md); customers upgrade from tags, never from `master`. Hotfix path documented.

### 6.2 Team & bus-factor plan

Bus factor 1 is the plan's biggest risk. Mitigation ladder, in order:

1. **Now (free):** docs discipline (already strong), runbooks for install/upgrade/backup
   (M15 day-2 runbooks exist — extend to "new facility onboarding" runbook), verified nightly
   off-site backups at every deployment.
2. **First revenue:** contract part-time support tech (installs, first-line support,
   training delivery) — this is a trainable role, unlike development.
3. **~10 facilities:** second developer or a standing contract with an OpenEMR-experienced
   firm for emergency cover; recorded walkthrough videos of the architecture.

### 6.3 Tooling & process

- **Tracking:** GitHub issues/projects, one board per wave; MKT-*/GAP-*/SCALE-* IDs in issue
  titles and Conventional Commit scopes (existing convention).
- **Verification gates:** unchanged (frontend check/build + asset bump; `composer
  verify:new-clinic`; upgrade_sql/install_acl on schema/ACL; browser smoke; sign-off smokes).
- **Environments:** dev (XAMPP box) → staging VPS mirroring a customer install (create this
  before the first paying customer — pilots must never receive untested upgrades) → per-
  customer production.

### 6.4 Upstream OpenEMR maintenance policy

We are a strangler on OpenEMR core: when a security advisory lands upstream, every customer
deployment is exposed until we merge and redeploy. Once there is one paying customer, this
is a standing obligation, not optional hygiene:

- **Watch:** subscribe to OpenEMR security advisories and release notes; check monthly at
  minimum (calendar item, not memory).
- **Classify within 48h of an advisory:** does it touch surfaces our deployments expose
  (login, session, ajax paths, document upload)? Severity → emergency patch (days) vs next
  release train (monthly).
- **Rebase cadence:** evaluate upstream patch releases quarterly; module isolation
  (`custom_modules` + separate `frontend/`) keeps merges cheap — verify with
  `composer verify:new-clinic` + CI + the §21 smoke set after every rebase.
- **Fleet rule:** no customer runs a version older than N-1 release trains; emergency
  security patches ship to the whole fleet inside one week, canary first.

### 6.5 Pilot program playbook (T0 — run this before anything else)

1. **Recruit:** 1–3 clinics; selection criteria: owner personally motivated, ≤15 staff,
   stable power/internet or willingness to host a small UPS'd server, within reach for
   on-site visits.
2. **Terms:** free for 6 months in writing, in exchange for weekly feedback, reference
   rights, and case-study data (anonymized volumes/timings).
3. **Deploy:** on-site server (mini-PC, UPS) or managed VPS per §7.2; import existing patient
   list via `MKT-MIG-1` migration kit (dry-run first); deliver Outage Runbook (§3.0); staff
   training: 2 half-days by role using desk one-liners from the README map.
4. **Operate:** WhatsApp support group per clinic; response SLA 4 business hours; weekly
   on-site/remote check-in for the first month, then biweekly.
5. **Measure (90-day scorecard):** % visits fully processed in-system; cash reconciliation
   discrepancies; queue wait-time trend; uptime; support tickets/week; staff satisfaction
   (simple 1–5 pulse). Targets in §9.
6. **Convert:** at day 90, present the case-study numbers back to the owner and convert to a
   paid plan (grandfathered discount). A pilot that won't convert at a discount is a signal
   about the pitch or the price, not just that clinic.

---

## 7. Business workstream

### 7.1 Pricing model (hypotheses to validate in E0/E1 — not commitments)

Subscription per facility per month, three tiers + setup fee. Anchor: price against the cost
of one junior admin salary, not against enterprise software.

| Tier | Target | Includes | Indicative price (validate!) |
|---|---|---|---|
| **Core** | T0 single clinic | All desks, chart, reports, 1 facility | ~US$50–80/facility/mo |
| **Plus** | T1 chains, T2 verticals | + roll-ups, price push, vertical modules, priority support | ~US$80–150/facility/mo (chain discount ≥3 sites) |
| **Pro** | T3 NHIS, T4 payers | + NHIS claims workbench, corporate invoicing, private-insurer claims & verification | ~US$150–250/facility/mo |
| Setup | all | install, data import, training (2 half-days) | one-time ~US$300–800 by size |

Principles: price in local currency with quarterly FX review; annual prepay discount
(cash-flow); pilot conversions grandfathered; **never** per-patient or per-record pricing
(it punishes success and sours trust). Standalone lab/pharmacy (T5) prices as Core.

### 7.2 Deployment & hosting model

Data ownership is the lead pitch — the LHIMS fight (vendor-controlled system, cloud in a
foreign jurisdiction, source-code standoff) is the cautionary tale every Ghanaian health
administrator now knows. Our answer, in order of preference:

1. **On-premise clinic server** (mini-PC + UPS + nightly encrypted off-site backup we
   monitor). Clinic owns the box and the data. Best offline story for unstable internet.
2. **Managed single-tenant VPS** (one VPS per customer, in-country or nearest region;
   we operate it, customer holds an exportable full backup). No shared-tenant hosting until
   SCALE-* work lands and a real multi-tenant isolation review is done.
3. **Customer's own IT** (chains/corporates with IT staff) — we support, they operate.

Every contract includes: customer owns their data; full export on demand (SQL dump +
documents); source-escrow or license terms that survive vendor failure. This is a
competitive weapon, not legal boilerplate — put it on the sales one-pager.

### 7.3 Support, training & fleet operations

- **Channels:** WhatsApp group per facility (regional norm) + email for paper trail;
  phone for P1. Response SLAs by tier (Core: next business day; Plus: 4h; Pro: 4h + named
  contact).
- **Knowledge base:** grow the desk one-liners into printable per-role quick cards (1 page
  per desk, laminated — clinics love these); short screen-recorded task videos.
- **Training:** standard 2-half-day onboarding by role; refresher included annually in
  Plus/Pro; train-the-trainer model for chains.
- **Upgrades:** staged — staging VPS first, then a canary customer, then fleet; maintenance
  windows agreed per contract; every upgrade preceded by verified backup.
- **Fleet operations (required before ~15 facilities):** one person cannot babysit twenty
  on-prem boxes without tooling. Minimum fleet stack:
  - Remote access per deployment (Tailscale/WireGuard VPN — clinic approves in writing).
  - Centralized backup-success monitoring (nightly encrypted off-site backup must report
    OK; alert on miss).
  - Uptime/health heartbeat (simple cron ping or lightweight agent; alert before the
    clinic calls).
  - Fleet version registry (which customer runs which release train — pairs with §6.4
    upstream patch policy).
  - Target: one support tech can operate ~15–20 facilities with this stack; without it,
    cap at ~5.

### 7.4 Sales, marketing & migration offering

- **E0–E1 (founder-led):** pilot case study is the entire marketing department. Deliverables:
  one 2-page case study with real numbers (wait times, cash reconciliation, revenue capture),
  a 10-minute demo video, a WhatsApp-shareable one-pager per segment.
- **Data rescue as a sales weapon:** facilities stranded by the LHIMS shutdown and clinics on
  dying local systems are warm leads — "we'll move your patients in, dry-run first, you keep
  the data" is a concrete pitch the competition rarely offers. Deliver via `MKT-MIG-1`
  (§3.0): scoped import (demographics, balances, allergies — not full encounter history in
  V1), priced in the setup fee tier (simple CSV: included; messy legacy export: premium).
  Document per-source checklists as we encounter them (LHIMS export, Excel registers, paper
  backlog re-entry playbook).
- **Channels that fit this market:** clinic-owner associations and private medical
  practitioner associations; medical suppliers/distributors as referral partners (they visit
  every clinic already — commission per closed deal); NHIS claims consultants (for T3);
  denominational health boards (for T7); **LHIMS-displaced facilities** (post-2024) as a
  targeted outreach list once migration kit is proven.
- **What we don't do:** paid digital ads before 10 customers; conferences before a case
  study; any tender that smells like §4.
- **Positioning line:** *"Modern software your clinic actually owns — built for how West
  African outpatient clinics really work: queue, consult, cash, dispense."* Against Bahmni:
  fitted vs generic. Against LHIMS-type vendors: you own it. Against paper: reconciled cash
  and no lost folders.

### 7.5 Legal, regulatory & compliance (Ghana first)

- **Entity & contracts:** register the operating company; standard MSA + per-facility order
  form; liability cap; data-ownership and escrow clauses per §7.2.
- **Data protection:** Ghana Data Protection Act, 2012 (Act 843) — register with the Data
  Protection Commission as data processor; DPA annex in the MSA; breach-notification
  procedure in the runbook. (Nigeria later: NDPR/NDPA registration — gate item for T6.)
- **Health-sector rules:** we are software, not a health facility — HeFRA licensing is the
  *customer's* obligation, but our NHIS claims feature (T3) must match NHIA e-claims
  requirements; verify the current NHIA submission spec during T3 discovery.
- **Clinical-records retention:** configurable retention/archive posture documented per
  deployment (align with MoH records guidance; do not delete clinical data, ever — the
  product already treats deletes as destructive).
- **Open-source hygiene:** OpenEMR is GPL — our module distribution model must comply
  (module source ships with the product; our commercial value is hosting, support, packaging,
  and pace, not source secrecy). Get one formal legal opinion on the licensing model before
  the first paid contract. **[Action, E0]**
- **Professional indemnity / E&O insurance:** once selling to paying clinics, carry errors-
  and-omissions coverage appropriate for clinical software (data loss, downtime during
  critical hours). Get a broker quote at entity registration — cost is usually modest at
  small scale but contract reviewers will ask. **[Action, E0]**
- **Trademark & product name:** "New Clinic" is generic — run a Ghana trademark search and
  pick a defensible commercial name before printing marketing materials or signing MSAs.
  The module slug can stay; the customer-facing brand should be ownable. **[Action, E0]**
- **Non-dilutive funding (optional accelerator):** digital-health challenge funds, AfDB/GIZ-
  style SME grants, and incubator programs in the region can fund fleet tooling, pilot
  hardware (UPS/mini-PC kits), or the first support hire without giving up equity. Treat as
  optional — the business must work without grants — but apply once the pilot case study
  exists (most funds want evidence, not slides).

### 7.6 Simple financial model (sanity check, not a forecast)

Assumptions: blended ~US$100/facility/mo; setup fees roughly cover onboarding cost; support
tech hired at ~15 facilities (~US$500–800/mo cost).

| Milestone | Facilities | MRR | Covers |
|---|---|---|---|
| End E1 | 5–8 | ~US$500–800 | Server/tooling costs; proof of willingness-to-pay |
| End E2 | 15–25 | ~US$1.5k–2.5k | + part-time support tech; founder still primary income earner elsewhere or ramen-profitable |
| End E3 | 40–60 | ~US$4k–6k | + second technical seat becomes affordable |
| E4 target | 100+ (incl. Nigeria via partner) | ~US$10k+ | Real business; partner rev-share reduces margin ~30% on Nigerian units |

The model's sensitivity is entirely in **churn and support load**, not price: one clinic that
churns after heavy onboarding erases months of margin. Hence the pilot playbook's obsession
with fit before conversion.

### 7.7 Top risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Bus factor 1 | Certain until addressed | §6.2 ladder; docs/runbooks now; support hire at first revenue |
| Pilot fails to convert | Medium | Selection criteria; 90-day measured scorecard; convert on evidence, not friendship |
| NHIS spec/discovery surprises | Medium-high | 2-week discovery with a real claims officer before any T3 build; PRD amendment gate |
| Power/internet instability breaks trust | Medium | On-prem + UPS default; offline-tolerant posture; SCALE-* keeps the box light |
| Funded competitor undercuts in Nigeria | Medium | Don't compete head-on; partner-led, price-under, ownership pitch; stay profitable at home first |
| GPL/licensing misstep | Low-medium | Legal opinion before first paid contract (§7.5) |
| Scope creep toward "full HIS" | High (self-inflicted) | §4 of this doc; PRD amendment ritual; one-rail principle |
| Upstream OpenEMR CVE exposure | Medium (grows with fleet) | §6.4 patch policy; quarterly rebase; emergency fleet patch inside one week |
| Fleet ops overwhelm support | Medium-high at ~10+ sites | §7.3 fleet stack before scaling past ~5; cap sales until tooling lands |
| Migration/import corrupts records | Medium | `MKT-MIG-1` dry-run mandatory; scoped import only; never promise full history in V1 |
| MoMo/cash reconciliation mismatch | Medium-high (pilot) | `MKT-MOMO-1` in W1; separate tender lines in close-of-day; train cashier on tender rules |
| Generic product name / trademark conflict | Low-medium | Trademark search + ownable brand before marketing (§7.5) |

---

## 8. Phase timeline (E-phases; quarters indicative, evidence-gated not date-gated)

| Phase | Window | Product waves | Business milestones | Exit gate |
|---|---|---|---|---|
| **E0 — Prove** | Q3 2026 | W1 (pilot enablement) + pilot fixes | 1–3 pilots live; entity + contracts + Act 843 registration + GPL opinion | Pilot 90-day scorecard hits targets (§9) |
| **E1 — First revenue** | Q4 2026 | W2 (SMS/outreach) + W3 start | Pilots convert to paid; first chain signed; case study published | ≥5 paying facilities; support SLA held for 60 days |
| **E2 — Unlock** | Q1–Q2 2027 | W4 (NHIS) + W5 (ANC, corporate) | NHIS discovery → PRD amendment → build; first Pro-tier customers | First real NHIS batch paid; ≥15 facilities |
| **E3 — Widen** | Q3–Q4 2027 | W6 (standalone lab/pharmacy, i18n mechanism) | Lab + pharmacy customers; support tech hired; staging/canary pipeline mature | ≥40 facilities; churn <5%/yr known |
| **E4 — Expand** | 2028 | MKT-NG-1 + hardening | Nigeria partner signed; T7 institutional outreach | 3 paying Nigerian facilities via partner |

If an exit gate misses, the phase extends — the next phase's spend does not start early.

---

## 9. KPIs & decision gates

**Product/pilot KPIs (E0):** ≥80% of visits fully processed in-system · cash **and MoMo**
reconciliation discrepancy <1% of daily takings · uptime ≥99% business hours · support
tickets trending down week-over-week after week 4 · staff pulse ≥4/5 by day 60 · backup
success 100% of nights (fleet monitor once live).

**Business KPIs (E1+):** paying facilities · MRR · logo churn (target <5%/yr) · support
tickets per facility per month (target <2 after onboarding) · onboarding cost per facility
(target < one month's subscription × 6) · reference-willing customers (target: all).

**Standing decision gates:**
1. No multi-tenant hosting before SCALE-* blocking items land.
2. No T3 build before discovery + PRD amendment.
3. No Nigeria before 5+ paying Ghanaian references.
4. No new vertical module without a signed customer for it.
5. Any §4 market requires a PRD amendment and a version bump of this document.

---

## 10. Open questions (decisions needed, not code)

1. **SMS provider** for W2 outreach (shared with gap-plan §9-Q1) — which gateway, and does
   MoMo/SMS billing integration ride along or stay separate?
2. **Pricing validation** — the §7.1 numbers are hypotheses; test willingness-to-pay in pilot
   conversion conversations before printing a rate card.
3. **NHIS e-claims current spec** — obtain the actual submission format/portal requirements
   during T3 discovery (documentation online is often stale).
4. **Hosting jurisdiction** — in-country VPS options vs nearest-region cloud for managed
   deployments; cost/latency/politics trade-off.
5. **Nigeria partner profile** — reseller with existing clinic relationships vs first hire?
   Decide at E3 exit, not before.
6. **First vertical after ANC/eye** — dental (bigger build, clear demand) vs dermatology
   (small build, unclear demand)?
7. **Commercial product name** — trademark search result; customer-facing brand vs internal
   module name.
8. **MoMo API vs tender-only** — is recording tender type + manual reconciliation enough for
   V1, or does a specific provider (MTN MoMo) need API confirmation before first paid sale?
9. **Fleet remote-access policy** — VPN tool choice and clinic consent wording for §7.3.
10. **WhatsApp Business API timing** — ship SMS-only outreach first (GAP-B1) or bundle
    WhatsApp from day one in urban pilots?

---

## History

| Version | Date | Change |
|---|---|---|
| v0.1.0 | 2026-07-07 | Initial draft: segments T0–T8, avoid-list, MKT-* feature roadmap merged with GAP/SCALE waves, PM operating model, pilot playbook, business plan (pricing, hosting, support, GTM, legal, financial model, risks), E0–E4 timeline, KPIs, open questions |
| v0.1.1 | 2026-07-07 | Private health insurance added (was missing): T4 generalized to third-party payers — shared payer engine (MKT-PAYER-1..3) with corporate and PHI (MKT-PHI-1..3) flavours; Ghana PHIS (12 licensed schemes, ~500k+ lives) and Nigeria HMO (83 accredited, ~2.17M enrollees, 1.18M Lagos) numbers; T6 gated on MKT-PHI; W5, pricing, TL;DR synced |
| v0.1.2 | 2026-07-07 | Second-pass blind-spot audit: §3.0 cross-segment realities (MKT-MOMO-1, MKT-GHCARD-1, MKT-WA-1, MKT-MIG-1, Outage Runbook); §6.4 upstream OpenEMR patch policy; §7.3 fleet ops; §7.4 migration offering + LHIMS-displaced leads; §7.5 E&O, trademark, grants; five new risks; MoMo in pilot KPIs; open questions 7–10 |

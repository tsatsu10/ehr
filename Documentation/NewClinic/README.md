# New Clinic V1 — Documentation Index

Private outpatient clinic layer for OpenEMR. **Primary market:** West Africa. **V1 billing:** cash only. **Currency:** admin-configurable in M6 (M6-F27, D-REG-3). **Staff ACL:** lead groups (`new_lab_lead`, `new_pharmacy_lead`, etc.) ship at install; solo bench = one login with base + lead groups ([PRD §4.2.1](./done/NEW_CLINIC_V1_PRD.md#421-staff-accounts--lead-groups-d-staff-1), D-STAFF-1).

## Core trilogy

Read in this order for a full picture:

1. **[NEW_CLINIC_V1_PRD.md](./done/NEW_CLINIC_V1_PRD.md)** — What we build (requirements, modules M0–M18, ACL, data model) — **v1.20.51**
2. **[NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md)** — How staff work day-to-day (v1.9.50)
3. **[NEW_CLINIC_V1_PAGE_DESIGNS.md](./NEW_CLINIC_V1_PAGE_DESIGNS.md)** — What each screen looks like (wireframes, AJAX) (v0.6.51)

**UI/UX entry point:** **[NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md](./NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md)** (v2.0.0) — start at **§0 TL;DR** for 60-second orientation. Full rewrite: trunk-test IA, single component reference with contract template, interaction-state taxonomy, scoring rubric, and phased **shadcn/ui migration plan (§9)**. PAGE_DESIGNS remains normative for per-page build detail.

**Implementation tracking:** **[NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md](./NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md)** — living module × slice × % tracker synced to PRD §5.6 and §20.1 (last audited 2026-07-08). **§21 E2E map:** [NEW_CLINIC_V1_SECTION21_E2E_MAP.md](./NEW_CLINIC_V1_SECTION21_E2E_MAP.md) · **§21 QA sign-off:** [NEW_CLINIC_V1_SECTION21_QA_SIGNOFF.md](./NEW_CLINIC_V1_SECTION21_QA_SIGNOFF.md) · **Pilot readiness:** [worksheets/NEW_CLINIC_V1_PILOT_READINESS_PACK.md](./worksheets/NEW_CLINIC_V1_PILOT_READINESS_PACK.md)

**Doc upkeep:** When editing any spec, bump its document version + history row and update this index (see repo root `CLAUDE.md` §12).

## Feature redesign specs

| Spec | Module | Status |
|------|--------|--------|
| [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](./done/MEDICAL_RECORD_DASHBOARD_REDESIGN.md) | MRD / `core.mrd` | **Implementation-closed v0.2.37** (archived in done/) |
| [NEW_CLINIC_V1_PATIENT_DASHBOARD_B7_PRIMARY_REDESIGN.md](./done/NEW_CLINIC_V1_PATIENT_DASHBOARD_B7_PRIMARY_REDESIGN.md) | **B7** MRD primary redesign + legacy chart boundary research | **Implementation-closed v0.1.2** (archived in done/; trainer checklist open) |
| [NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md](./done/NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md) | M11 Chart Depth | Draft v0.1.15 |
| [NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md](./done/NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md) | M12 Lab Operations Hub | Draft v0.1.9 |
| [NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md](./done/NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md) | M13 Pharmacy Operations Hub | Draft v0.1.9 |
| [NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md](./done/NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md) | M14 Billing Back Office | Draft v0.1.3 |
| [NEW_CLINIC_V1_FRONT_DESK_SEARCH_REDESIGN.md](./done/NEW_CLINIC_V1_FRONT_DESK_SEARCH_REDESIGN.md) | M1a | **Implementation-closed v1.0.10** (archived in done/) |
| [NEW_CLINIC_V1_FRONT_DESK_REGISTRATION_REDESIGN.md](./done/NEW_CLINIC_V1_FRONT_DESK_REGISTRATION_REDESIGN.md) | M1b / M1c | Approved v1.0.0 — 4-section desk form; supersedes L1-only Quick Add |
| [NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md](./done/NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md) | COM | Approved Phase 1 |
| [NEW_CLINIC_V1_SCHEDULING_REDESIGN.md](./done/NEW_CLINIC_V1_SCHEDULING_REDESIGN.md) | S1 | Draft v0.2.6 |
| [NEW_CLINIC_V1_PATIENT_REGISTRY_REDESIGN.md](./done/NEW_CLINIC_V1_PATIENT_REGISTRY_REDESIGN.md) | M10 Patient Registry / cohort search | **Implementation-closed v0.2.2** (archived in done/) · [PAGE_DESIGNS §7.32](./NEW_CLINIC_V1_PAGE_DESIGNS.md#732-patient-registryphp--patient-registry) · **V1.1-REG** |
| [NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md](./done/NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md) | M6 + M15 Admin Hub | Draft v0.1.4 |
| [NEW_CLINIC_V1_REPORTING_OPERATIONS_REDESIGN.md](./done/NEW_CLINIC_V1_REPORTING_OPERATIONS_REDESIGN.md) | M7 + M16 Reporting Hub | **Implementation-closed v0.1.4** (archived in done/) |
| [NEW_CLINIC_V1_CLINICAL_DOCUMENTATION_REDESIGN.md](./done/NEW_CLINIC_V1_CLINICAL_DOCUMENTATION_REDESIGN.md) | M4 + M17 Clinical Documentation Hub | Draft v0.1.2 |
| [NEW_CLINIC_V1_ENCOUNTER_FORM_HIGH_LEVEL_FACILITY_REDESIGN.md](./new/NEW_CLINIC_V1_ENCOUNTER_FORM_HIGH_LEVEL_FACILITY_REDESIGN.md) | **Encounter consult form** — high-level / referral-hospital tier (native React target) | Draft v0.1.7 |
| [NEW_CLINIC_V1_SCHEDULING_QUEUE_BOUNDARY_REDESIGN.md](./done/NEW_CLINIC_V1_SCHEDULING_QUEUE_BOUNDARY_REDESIGN.md) | M18 Queue Bridge Hub (scheduling ↔ visit queue) | Draft v0.1.3 |
| [NEW_CLINIC_V1_MEDICAL_HISTORY_BACKGROUND_REDESIGN.md](./done/NEW_CLINIC_V1_MEDICAL_HISTORY_BACKGROUND_REDESIGN.md) | Clinical → Background / History & Lifestyle (T1-F20 read · stock edit) | Draft v0.1.1 |
| [NEW_CLINIC_V1_PATIENT_PAYMENT_HISTORY_REDESIGN.md](./done/NEW_CLINIC_V1_PATIENT_PAYMENT_HISTORY_REDESIGN.md) | Patient payment history / Ledger (M11-F11 wrapper · V1.1-CDa) | Audit closure v0.1.1 |
| [NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md](./done/NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md) | Patient referrals & letters / Transactions (M11-F11 wrapper · V1.1-CDb) | **Implementation-closed v0.1.3** (archived in done/) |
| [NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md](./done/NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md) | Patient clinical export / Reports (M11-F11 wrapper · V1.1-CDc presets) | Draft v0.1.1 |
| [NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md](./done/NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md) | T1 legacy chart overlay (stock `patient_file` visit context) | Draft v0.1.2 |

## Platform

| Document | Purpose |
|----------|---------|
| [NEW_CLINIC_OPENEMR_GAP_ANALYSIS_AND_REDESIGN_PLAN.md](./new/NEW_CLINIC_OPENEMR_GAP_ANALYSIS_AND_REDESIGN_PLAN.md) | Coverage audit vs stock OpenEMR menu tree + phased GAP-A–D React redesign plan; GAP-A/C/D essentially complete, GAP-B core built. Remaining real work: B1 outreach SMS gateway + wizard/scheduling (G6), D1 i18n string sweep (3/25 islands), B2b growth-chart overlay (data exists via WHO/CDC — blocked on a WHO commercial-licensing decision, open question #5 in §9). W5/W7/W8/W12 (Tier-2 "convert the wrapper" items) re-verified 2026-07-13 and closed — mostly already done, doc rot (v0.1.33). Audit pass (v0.1.35) found and fixed a real ACL gap behind the W5 fix (`new_admin` group lacked core `admin`/`superbill`). |
| [NEW_CLINIC_MARKET_EXPANSION_MASTER_PLAN.md](./new/NEW_CLINIC_MARKET_EXPANSION_MASTER_PLAN.md) | Market segments T0–T8, MKT-* feature roadmap merged with GAP/SCALE waves, pilot playbook, project-management operating model, and business plan (pricing, hosting, support, GTM, legal, risks) (v0.1.3) |
| [NEW_CLINIC_VPS_REPLICA_DEPLOYMENT_PROMPT.md](./new/NEW_CLINIC_VPS_REPLICA_DEPLOYMENT_PROMPT.md) | Executable deployment prompt: one-way clinic→VPS MySQL/documents replication (on-prem primary + VPS read-replica per master plan §7.2), monitoring hooks, disaster-path runbook (v0.1.0) |
| [NEW_CLINIC_V1_SECURITY_HARDENING_PROMPT.md](./new/NEW_CLINIC_V1_SECURITY_HARDENING_PROMPT.md) | Consolidated pre-pilot security pass (SEC-1..8): per-action ACL audit (blocks pilot), CSRF coverage, input validation, auth-error uniformity, brute-force + humane lockout recovery, PHI in logs/backups, TLS/network access, upstream CVE process (v0.1.0) |
| [AJAX_ACTION_ACL_MATRIX.md](./new/AJAX_ACTION_ACL_MATRIX.md) | SEC-1 living control: every dispatchable ajax action → policy type → required ACL → deferred re-auth (253 rows) |
| [NEW_CLINIC_LOGIN_RECOVERY_QUICK_CARD.md](./new/NEW_CLINIC_LOGIN_RECOVERY_QUICK_CARD.md) | SEC-5 printable card: "Can't log in?" — 3 steps for staff, 3 for the admin (unlock + temporary password) |
| [NEW_CLINIC_SEC6_DATA_AT_REST_RUNBOOK.md](./new/NEW_CLINIC_SEC6_DATA_AT_REST_RUNBOOK.md) | SEC-6 runbook: identifier-only logging, export retention/perms, display_errors off, log rotation, backup encryption + key custody |
| [NEW_CLINIC_SEC7_TLS_NETWORK_RUNBOOK.md](./new/NEW_CLINIC_SEC7_TLS_NETWORK_RUNBOOK.md) | SEC-7 runbook: tunnel-only default + public-exposure variant, TLS/HSTS, session-cookie notes, MySQL binding, fleet healthcheck, outage additions |
| [VERSION_BASELINE.md](./new/VERSION_BASELINE.md) | SEC-8: the OpenEMR upstream release this fork tracks (8.0.0) — makes CVE triage mechanical |
| [NEW_CLINIC_SEC8_EXPOSURE_MAP.md](./new/NEW_CLINIC_SEC8_EXPOSURE_MAP.md) | SEC-8: which core surfaces our deployments expose (login/session/ajax/upload/bridge YES; portal/API/FHIR NO) |
| [NEW_CLINIC_SEC8_CVE_DRILL_RUNBOOK.md](./new/NEW_CLINIC_SEC8_CVE_DRILL_RUNBOOK.md) | SEC-8: advisory-check cadence, mechanical triage table, emergency-patch drill command sequence + a real dry-run |
| [NEW_CLINIC_USER_RESEARCH_COMPETITIVE_ANALYSIS.md](./new/NEW_CLINIC_USER_RESEARCH_COMPETITIVE_ANALYSIS.md) | User research + competitive positioning (West Africa private clinic segment) (v0.1.0) |
| [NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md](./NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md) | UI/UX master — §0 TL;DR · §1 architectural model · §2 design principles · §3 visual system · §4 component reference · §5 interaction states · §6 IA + module map · §9 shadcn migration plan · §10 governance (v2.0.0) |
| [FRONTEND_2026_MODERNIZATION_PLAN.md](./FRONTEND_2026_MODERNIZATION_PLAN.md) | OpenEMR-wide modernization strategy; **New Clinic React islands shipped** |
| [FRONTEND_MODULE_GUIDE.md](../FRONTEND_MODULE_GUIDE.md) | How to build and wire React islands (Vite, `oeFetch`, tokens) |
| [MOBILE_IOS_CURSOR_CHECKLIST.md](./new/MOBILE_IOS_CURSOR_CHECKLIST.md) | Post-session verify checklist when coding from **Cursor iOS** (CI + desktop gates) |
| [NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md](./new/NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md) | SCALE-* performance hardening tasks + R1–R8 rules — Phases 0–5 executed; **Phase 6 (§8A) added from a post-launch online-research review — SCALE-6.1–6.4 not yet built** + an offline-first product decision routed to a PRD amendment (v1.1.0) |
| [NEW_CLINIC_SCALE_OUT_RUNBOOK.md](./NEW_CLINIC_SCALE_OUT_RUNBOOK.md) | 1→N-server ops runbook: Stage 0/1/2 progression, incident response, backup/restore (v1.0.1, SCALE-5.2 consolidated) |
| [NEW_CLINIC_SSE_DESIGN.md](./NEW_CLINIC_SSE_DESIGN.md) | Design-only doc for Server-Sent Events queue invalidation — worker-count math, go/no-go criteria; not implemented (v0.1.1, SCALE-5.1) |
| [NEW_CLINIC_OUTAGE_RUNBOOK.md](./NEW_CLINIC_OUTAGE_RUNBOOK.md) | Clinic-facing per-deployment outage card: what keeps working vs stops by outage type × on-prem/VPS flavor, UPS/power, server-dead paper fallback + same-day back-entry, recovery checklist (v1.0.0; market plan W1 pilot-pack deliverable) |
| [NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md](./done/NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md) | Full-codebase audit 2026-07-07 — verified endpoint/feature inventory, gap analysis, file dispositions, AUDIT-1..15 refactoring roadmap (v0.1.3, all tasks closed) |
| [NEW_CLINIC_TRIAGE_URGENCY_ESCALATION_GAP.md](./done/NEW_CLINIC_TRIAGE_URGENCY_ESCALATION_GAP.md) | **Implementation-closed v1.0.0** (archived in done/) — nurse-side urgency escalation (`triage.set_urgent`), designed against ESI clinical-triage practice, shipped 2026-07-09 |
| [NEW_CLINIC_CROSS_ROLE_SAFETY_INTEGRITY_AUDIT.md](./new/NEW_CLINIC_CROSS_ROLE_SAFETY_INTEGRITY_AUDIT.md) | Proposed: 17 code-verified findings across all 7 roles — patient/specimen identity, medication safety, critical-result communication, triage accuracy, cashier financial integrity, admin business continuity — each researched against real-world practice, none yet implemented (v0.1.0) |

## User personas

Composite role personas grounding design/copy decisions in a real working day; companions to USER_WORKFLOWS §4 + §8.x role playbooks. Audited against code 2026-07-07. Two standing rules: **(1)** persona §8 sections restate product rules only as *rationale* — the PRD/workflows stay canonical and win any conflict; **(2)** personas are deliberately **setting-specific** (Ghana pilot context) — an intentional exception to the neutral-regional-examples convention that governs product copy and specs.

| Persona | Role / product mapping | Status |
|---------|------------------------|--------|
| [NEW_CLINIC_PERSONA_NURSE_AKUA.md](./NEW_CLINIC_PERSONA_NURSE_AKUA.md) | Nurse — Triage desk, read-only Visit Board (§8.2), nurse-side urgency escalation (§8.2 step 3b, shipped); flags pediatric-vitals + pain-score gaps (§5) | v1.4.0 |
| [NEW_CLINIC_PERSONA_DOCTOR_MENSAH.md](./NEW_CLINIC_PERSONA_DOCTOR_MENSAH.md) | Doctor — Doctor Desk, routing, E-Sign (§8.3–8.3.4); flags allergy-gate-bypass + no-duplicate-order + silent-abnormal-result gaps | v1.2.0 |
| [NEW_CLINIC_PERSONA_LAB_TECH_LABIK.md](./NEW_CLINIC_PERSONA_LAB_TECH_LABIK.md) | Lab — Lab Desk, Lab Ops Hub, lab-direct intake (§8.4/.4a/.4b); flags specimen-ID + critical-result gaps | v1.2.0 |
| [NEW_CLINIC_PERSONA_PHARMACIST_ESI.md](./NEW_CLINIC_PERSONA_PHARMACIST_ESI.md) | Pharmacy — Pharmacy Desk, Pharm Ops Hub, OTC, walk-in triage (§8.5/.5a/.5b); flags interaction-check + controlled-substance gaps | v1.2.0 |
| [NEW_CLINIC_PERSONA_RECEPTIONIST_AMA.md](./NEW_CLINIC_PERSONA_RECEPTIONIST_AMA.md) | Reception — Front Desk search/registration, booking, recalls, check-in (§8.1/.1a–d, §9, §10); flags identity-verification + fee-schedule gaps | v1.1.0 |
| [NEW_CLINIC_PERSONA_CASHIER_KOFI.md](./NEW_CLINIC_PERSONA_CASHIER_KOFI.md) | Cashier — payment queue, gates, receipts, closure paths, daily cash discipline (§8.6, D-BILL-2); flags payment-atomicity + reconciliation gaps | v1.1.0 |
| [NEW_CLINIC_PERSONA_ADMIN_SELORM.md](./NEW_CLINIC_PERSONA_ADMIN_SELORM.md) | Clinic Admin (IT-confident ceiling + §8.1 owner-doctor floor) — Admin Hub config, People & Access, flags, backups, day-2 runbooks (§14, RB-01–RB-20); flags backup-verification + schema-self-check gaps | v1.2.0 |

## Relationship map

```text
Role desks (PAGE_DESIGNS §7.2–7.9)     ← daily queue work
        │
        ├─► MRD (5 tabs)               ← full chart / history
        │       └─► Chart Depth panels   ← ledger, referrals, export (slide-over)
        │
        ├─► Lab Desk (M8)              ← visit queue at bench
        │       └─► Lab Ops Hub (M12)    ← worklists, results, LIS (post-pilot)
        │
        ├─► Pharmacy Desk (M9)         ← visit queue at counter
        │       └─► Pharm Ops Hub (M13)  ← dispense worklist, stock, formulary (post-pilot)
        │
        ├─► Cashier (M5)                 ← same-day cash checkout (V1 pilot)
        │       └─► Billing Back Office (M14)  ← corrections, close day (V1.2-BILL post-pilot)
        │
        ├─► Doctor Desk (M4)             ← consult queue + shortcuts
        │       └─► Clinical Doc Hub (M17)  ← curated encounter forms (V1.1-DOC post-pilot)
        │
        ├─► Daily Reports (M7)           ← manager EOD: cash, visits, exceptions
        │       └─► Reporting Hub (M16)    ← clinical, pharmacy, public health, audit (V1.1-REP post-pilot)
        │
        ├─► Scheduling (S1)            ← booking & recalls
        │       └─► Queue Bridge Hub (M18)  ← schedule vs queue exceptions (V1.1-BRIDGE post-pilot)
        ├─► Communications Hub         ← staff messages
        └─► Patient Registry (M10)       ← cohort search (not Front Desk search)
        │
        └─► Admin & Configuration (M6 + M15)  ← clinic setup, staff, forms, system health, day-2 runbooks
```

**Training one-liner:** *Desk for queue work; chart for history; depth panels for money, letters, and exports; ops hubs for what's pending at the lab bench or pharmacy counter; billing back office for corrections and close-of-day after V1.2-BILL; system Rx print for send-out does not require a dispensary; Admin Hub for who works here and whether the system is healthy.*

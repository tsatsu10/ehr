# New Clinic V1 — Documentation Index

Private outpatient clinic layer for OpenEMR. **Primary market:** West Africa. **V1 billing:** cash only. **Currency:** admin-configurable in M6 (M6-F27, D-REG-3). **Staff ACL:** lead groups (`new_lab_lead`, `new_pharmacy_lead`, etc.) ship at install; solo bench = one login with base + lead groups ([PRD §4.2.1](./NEW_CLINIC_V1_PRD.md#421-staff-accounts--lead-groups-d-staff-1), D-STAFF-1).

## Core trilogy

Read in this order for a full picture:

1. **[NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md)** — What we build (requirements, modules M0–M18, ACL, data model) — **v1.20.50**
2. **[NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md)** — How staff work day-to-day (v1.9.50)
3. **[NEW_CLINIC_V1_PAGE_DESIGNS.md](./NEW_CLINIC_V1_PAGE_DESIGNS.md)** — What each screen looks like (wireframes, AJAX) (v0.6.51)

**UI/UX entry point:** **[NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md](./NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md)** (v2.0.0) — start at **§0 TL;DR** for 60-second orientation. Full rewrite: trunk-test IA, single component reference with contract template, interaction-state taxonomy, scoring rubric, and phased **shadcn/ui migration plan (§9)**. PAGE_DESIGNS remains normative for per-page build detail.

**Implementation tracking:** **[NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md](./NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md)** — living module × slice × % tracker synced to PRD §5.6 and §20.1 (last audited 2026-07-04). **§21 E2E map:** [NEW_CLINIC_V1_SECTION21_E2E_MAP.md](./NEW_CLINIC_V1_SECTION21_E2E_MAP.md)

## Feature redesign specs

| Spec | Module | Status |
|------|--------|--------|
| [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](./MEDICAL_RECORD_DASHBOARD_REDESIGN.md) | MRD / `core.mrd` | Draft v0.2.36 |
| [NEW_CLINIC_V1_PATIENT_DASHBOARD_B7_PRIMARY_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_DASHBOARD_B7_PRIMARY_REDESIGN.md) | **B7** MRD primary redesign + legacy chart boundary research | Draft v0.1.1 |
| [NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md) | M11 Chart Depth | Draft v0.1.15 |
| [NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md](./NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md) | M12 Lab Operations Hub | Draft v0.1.9 |
| [NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md](./NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md) | M13 Pharmacy Operations Hub | Draft v0.1.9 |
| [NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md](./NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md) | M14 Billing Back Office | Draft v0.1.3 |
| [NEW_CLINIC_V1_FRONT_DESK_SEARCH_REDESIGN.md](./NEW_CLINIC_V1_FRONT_DESK_SEARCH_REDESIGN.md) | M1a | Approved Phase 1 |
| [NEW_CLINIC_V1_FRONT_DESK_REGISTRATION_REDESIGN.md](./NEW_CLINIC_V1_FRONT_DESK_REGISTRATION_REDESIGN.md) | M1b / M1c | Approved v1.0.0 — 4-section desk form; supersedes L1-only Quick Add |
| [NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md](./NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md) | COM | Approved Phase 1 |
| [NEW_CLINIC_V1_SCHEDULING_REDESIGN.md](./NEW_CLINIC_V1_SCHEDULING_REDESIGN.md) | S1 | Draft v0.2.6 |
| [NEW_CLINIC_V1_PATIENT_REGISTRY_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_REGISTRY_REDESIGN.md) | M10 Patient Registry / cohort search | Draft v0.2.1 · [PAGE_DESIGNS §7.32](./NEW_CLINIC_V1_PAGE_DESIGNS.md#732-patient-registryphp--patient-registry) · **V1.1-REG** |
| [NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md](./NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md) | M6 + M15 Admin Hub | Draft v0.1.4 |
| [NEW_CLINIC_V1_REPORTING_OPERATIONS_REDESIGN.md](./NEW_CLINIC_V1_REPORTING_OPERATIONS_REDESIGN.md) | M7 + M16 Reporting Hub | Draft v0.1.2 |
| [NEW_CLINIC_V1_CLINICAL_DOCUMENTATION_REDESIGN.md](./NEW_CLINIC_V1_CLINICAL_DOCUMENTATION_REDESIGN.md) | M4 + M17 Clinical Documentation Hub | Draft v0.1.2 |
| [NEW_CLINIC_V1_SCHEDULING_QUEUE_BOUNDARY_REDESIGN.md](./NEW_CLINIC_V1_SCHEDULING_QUEUE_BOUNDARY_REDESIGN.md) | M18 Queue Bridge Hub (scheduling ↔ visit queue) | Draft v0.1.3 |
| [NEW_CLINIC_V1_MEDICAL_HISTORY_BACKGROUND_REDESIGN.md](./NEW_CLINIC_V1_MEDICAL_HISTORY_BACKGROUND_REDESIGN.md) | Clinical → Background / History & Lifestyle (T1-F20 read · stock edit) | Draft v0.1.1 |
| [NEW_CLINIC_V1_PATIENT_PAYMENT_HISTORY_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_PAYMENT_HISTORY_REDESIGN.md) | Patient payment history / Ledger (M11-F11 wrapper · V1.1-CDa) | Audit closure v0.1.1 |
| [NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md) | Patient referrals & letters / Transactions (M11-F11 wrapper · V1.1-CDb) | Audit closure v0.1.2 |
| [NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md) | Patient clinical export / Reports (M11-F11 wrapper · V1.1-CDc presets) | Draft v0.1.1 |
| [NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md](./NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md) | T1 legacy chart overlay (stock `patient_file` visit context) | Draft v0.1.2 |

## Platform

| Document | Purpose |
|----------|---------|
| [NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md](./NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md) | UI/UX master — §0 TL;DR · §1 architectural model · §2 design principles · §3 visual system · §4 component reference · §5 interaction states · §6 IA + module map · §9 shadcn migration plan · §10 governance (v2.0.0) |
| [FRONTEND_2026_MODERNIZATION_PLAN.md](./FRONTEND_2026_MODERNIZATION_PLAN.md) | OpenEMR-wide modernization strategy; **New Clinic React islands shipped** |
| [FRONTEND_MODULE_GUIDE.md](../FRONTEND_MODULE_GUIDE.md) | How to build and wire React islands (Vite, `oeFetch`, tokens) |

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

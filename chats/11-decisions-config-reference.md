# Decisions, Config Keys, and Module Map

Quick reference distilled from design-thread conversations. Canonical source: `Documentation/NewClinic/NEW_CLINIC_V1_PRD.md`.

---

## Closed decisions (multi-doctor thread)

| ID | Topic |
|----|--------|
| D28 | Shared `ready_for_doctor` pool; soft `assigned_provider_id`; no nurse picker V1 |
| D29 | V1.1 advisory routing — suggestions only; Take never blocked |
| D30 | V1.2 opt-in hard assignment via `hard_assigned_provider_id`; default OFF |
| D31 | V1.2 opt-in doctor-ready in-app notify; default OFF |
| D36 | Post-V1 named release slices ship independently (V1.1-ANC, RT, CD, LAB, etc.) |

---

## Multi-doctor and routing config

| Key | Default | Effect |
|-----|---------|--------|
| `enable_multi_doctor_filters` | 0 | Doctor Desk All/Me; Visit Board provider filter |
| `doctor_desk_default_filter` | me | Default Me when multi-doctor ON |
| `enable_doctor_roster` | 0 | V1.1 on-duty roster |
| `enable_advisory_routing` | 0 | V1.1 routing suggestions |
| `enable_hard_provider_assignment` | 0 | V1.2 hard assign |
| `enable_doctor_ready_notify` | 0 | V1.2 in-app ready toast |
| `enable_doctor_ready_web_push` | 0 | V1.2b browser push |

---

## Communications and search config

| Key | Default | Effect |
|-----|---------|--------|
| `communications_hub_enable` | 0 | COM vs legacy Message Center |
| `enable_patient_registry` | 0 | M10 + hide Finder |

---

## Visit queue key fields

| Field | V1 meaning |
|-------|------------|
| `assigned_provider_id` | Appointment hint or actual taker |
| `routing_suggested_provider_id` | V1.1 advisory chip |
| `hard_assigned_provider_id` | V1.2 hard lock |
| `new_doctor_availability.taking_patients` | Roster; OFF excludes from suggestions only |

---

## ACL additions (V1.2)

| ACL | Purpose |
|-----|---------|
| `new_hard_assign_provider` | Set hard assignment |
| `new_take_assigned_override` | Take visit assigned to another doctor |

---

## Module map M0–M18 (post expanded PRD)

| ID | Name |
|----|------|
| M0 | New Clinic Core |
| M1 | Front Desk (M1a–M1d) |
| M2 | Visit Board |
| M3 | Triage |
| M4 | Doctor Desk |
| M5 | Cashier |
| M6 | Clinic Admin |
| M7 | Daily Reports |
| M8 | Lab Desk |
| M9 | Pharmacy Desk |
| M10 | Patient Registry |
| M11 | Chart Depth |
| M12 | Lab Operations Hub |
| M13 | Pharmacy Operations Hub |
| M14 | Billing Back Office |
| M15 | Admin Operations Hub |
| M16 | Reporting Operations Hub |
| M17 | Clinical Documentation Hub |
| M18 | Queue Bridge Hub |
| COM | Communications Hub |
| S1 | Scheduling & Flow |
| T1/T2 | Theme + globals profile |
| MRD | Medical Record Dashboard |

---

## Mandatory vs post-V1 tests (design thread)

| Range | Gate |
|-------|------|
| Tests 1–22 | `@new-clinic-mandatory` — V1 CI |
| Test 23 | Advisory routing — `@new-clinic-v11` |
| Test 24 | Hard assignment — `@new-clinic-v12` |
| Test 25 | Doctor ready notify — `@new-clinic-v12` |

---

## Non-goals (PRD §3.2 sample)

| NG | Topic |
|----|--------|
| NG1 | NHIS claims, prior auth APIs |
| NG2 | Credit/aging as primary workflow |
| NG3 | X12/EDI/ERA |
| NG4 | IPD/theatre |
| NG5 | Full clinical form replacement |
| NG6 | Offline mobile sync |
| NG7 | Enterprise multi-facility rollout |
| NG8 | DHIMS2 national export |
| NG9 | MoMo API (label optional V1.1-OPS) |
| NG13–NG15 | ESI, embedded CDS, in-chart search |

---

## Pilot minimum (design thread §5.6)

**Pilot-ready:** M0 + M1 + M2 + M3 + M4 + M5 + M6 + M7 + T1 on module routes.

**May follow per worksheet:** S1, M8, M9, M10, COM, MRD B7, M11+.

---

## Two systems rule (H3)

- `new_visit` = clinical floor truth (Visit Board).
- S1 Flow Board = appointment arrivals only.
- **No bidirectional sync** between `new_visit` and `patient_tracker`.
- Bridge = M0-F16 Start visit & check in.

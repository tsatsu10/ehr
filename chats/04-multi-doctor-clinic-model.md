# Multi-Doctor Clinic Model (V1)

## Core rule (D28)

The nurse **never picks a doctor** in V1/V1.1 default mode. Patients go to a **shared** `ready_for_doctor` pool. Any doctor with `new_doctor` ACL may **Take patient**.

## Visit fields

| Field | Meaning |
|-------|---------|
| `assigned_provider_id` | Soft hint: appointment `pc_aid` at check-in **or** doctor who actually took the patient (always updated on Take) |
| `routing_suggested_provider_id` | V1.1 advisory only — informational chip |
| `hard_assigned_provider_id` | V1.2 opt-in only — hard lock when `enable_hard_provider_assignment` = 1 |

## Nurse workflow

**Send to doctor** transitions `in_triage` → `ready_for_doctor` into the **shared pool**. No doctor dropdown unless V1.2 hard assignment is ON.

## Doctor Desk filter

- **All** — entire shared pool.
- **Me** — rows where `assigned_provider_id` is NULL or equals current user (and in V1.1 also where `routing_suggested_provider_id` = current user).

## Appointment hint

`startVisitFromAppointment()` copies `pc_aid` → `assigned_provider_id` as hint only. Visit stays in shared pool until a doctor Takes.

## Take patient

- Transition: `ready_for_doctor` → `with_doctor`.
- Sets `assigned_provider_id` to the taking doctor (M0-F17, M4-F06).
- Overwrites appointment hint if a different doctor sees the patient.

## Pilot worksheet (Q4)

When multi-doctor = Yes:

- `enable_multi_doctor_filters` = 1
- Doctor Desk default filter = **Me**
- Train shared pool + All/Me semantics

## Still deferred (discussed, not V1)

- Per-doctor sub-queues on Doctor Desk (separate lanes per doctor).
- Specialty-tag routing lanes (V1.2+ discussion).

## Documents updated in chat pass

- PRD §6.5.1, D28
- USER_WORKFLOWS §8.3.1
- PAGE_DESIGNS §5.6, §7.4.5, queue cards
- SCHEDULING §9.1a bridge for `pc_aid` hint
- Mandatory test **#22** multi-doctor

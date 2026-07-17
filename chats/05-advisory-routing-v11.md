# Advisory Routing (V1.1)

## Principle (D29)

**Routing suggests; Take patient decides.**

Advisory routing never blocks manual Take for any doctor with `new_doctor` ACL. Shared `ready_for_doctor` pool remains canonical.

## Config (default OFF)

| Key | Purpose |
|-----|---------|
| `enable_doctor_roster` | On-duty roster UI |
| `enable_advisory_routing` | Compute `routing_suggested_provider_id` |

## On-duty roster

- Table: `new_doctor_availability` per facility per day.
- **Taking patients** toggle per doctor.

### Taking patients OFF

- Excluded from routing suggestions and fairness math.
- Shown **dimmed** on roster (“Paused — not taking”).
- **Still** sees All queue and **may Take patient** — no hard block.

## Workload metric (conceptual)

Load score combines weighted counts such as:

- Patients in `with_doctor` for that doctor.
- `ready_for_doctor` rows where `assigned_provider_id` = doctor.
- Unassigned `ready_for_doctor` rows (shared pool weight).
- Time since last taken (`last_taken_at`).
- Urgent visits bump sort but do not hard-assign.

Tie-breakers include appointment hint boost when `pc_aid` doctor is on duty.

## Exceptions discussed

| Case | Behavior |
|------|----------|
| Urgent (`is_urgent`) | Stays at top of pool; suggestion uses same algorithm |
| Continuity / last doctor | Soft boost in tie-break (not hard lock in V1.1) |
| Walk-in vs scheduled | Appointment hint from `pc_aid` |
| Doctor paused (Taking OFF) | Out of suggestion pool only |
| Manual override on Take | Succeeds; audit `take_mode`: `accepted_suggestion` or `manual_override` |

## UI

- Queue chip: **Routing suggests: Dr. Y**
- Optional **Appt: Dr. X** when hint differs from suggestion.
- Me filter includes rows suggested for current user.

## Tests

- Post-V1 test **#23** — tagged `@new-clinic-v11`; required before enabling advisory routing in production.

## Documents updated

- PRD §6.5.2, D29, M0-F18 VisitRoutingService
- USER_WORKFLOWS §8.3.2
- PAGE_DESIGNS §7.4.5a roster + toggle

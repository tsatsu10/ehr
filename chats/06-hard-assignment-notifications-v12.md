# Hard Assignment and Doctor-Ready Notifications (V1.2)

## User decision

Treat both features as **optional V1.2** with config **OFF by default** — preserves V1/V1.1 pilot behavior unless clinic explicitly enables.

---

## §6.5.3 Hard assignment (D30)

### Config

- `enable_hard_provider_assignment` = **0** (default)

### When ON

| Actor | Behavior |
|-------|------------|
| Nurse / reception | May set `hard_assigned_provider_id` at triage or Front Desk (Assign doctor) |
| Doctor Desk **Me** | Shows hard-assigned + unassigned (per spec) |
| **Take patient** | Blocked for doctors other than assignee unless `new_take_assigned_override` ACL + documented reason |
| Advisory routing | Still runs for unassigned; hard-assigned visits skip auto-suggestion |
| Queue UI | Chip **Assigned: Dr. X** |

### ACL

- `new_hard_assign_provider` — set hard assignment
- `new_take_assigned_override` — take visit assigned to another doctor

### Conflict with V1/V1.1?

**No** when default OFF. Shared pool + soft hints unchanged for pilots.

---

## §6.5.4 Doctor ready notifications (D31)

### Config

- `enable_doctor_ready_notify` = **0** (default)
- `enable_doctor_ready_web_push` = **0** (V1.2b optional)

### When ON

- In-app toast/badge on Doctor Desk when visit enters `ready_for_doctor`.
- Debounce via `new_visit_notify_log` — one notification per visit per recipient where applicable.
- **No notify** when doctor has Taking patients OFF.
- **Excluded:** SMS/WhatsApp/MedEx in V1.2.

### Push model

Opt-in “your patient is ready” — not mandatory hard routing.

---

## Tests

| # | Topic | Tag |
|---|--------|-----|
| 24 | Hard assignment enforce + override | `@new-clinic-v12` |
| 25 | Doctor ready notify debounce | `@new-clinic-v12` |

Not part of V1 CI gate when flags remain 0.

---

## Documents updated in chat

- PRD §6.5.3–§6.5.4, D30–D31, schema, ACLs
- USER_WORKFLOWS §8.3.3–§8.3.4
- PAGE_DESIGNS §7.4.5b/c
- Pilot worksheet row 4 optional V1.2 flags

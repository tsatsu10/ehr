# Communications Hub Design

## Problem (from codebase study)

Legacy Message Center (`interface/main/messages/messages.php`) combines Messages and Reminders in a tabbed UI with mutual exclusion between list and compose, weak mobile layout, and CSRF gaps on some mutations.

## Decision

**Phase 1 scope:** Unified **Communications Hub (COM)** — staff Messages (`pnotes`) + **Dated Reminders** in one split-pane hub. **Not** recalls (those go to S1 Scheduling), **not** portal mail, **not** SMS product redesign.

## Status

- Spec: `NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md` — **Approved Phase 1** (v1.0.3 in design thread).
- PRD: Module COM with COM-F01–F14.
- PAGE_DESIGNS: §7.12 `messages.php` hub shell.
- USER_WORKFLOWS: §8.1c playbook.

## Design audit gaps addressed (A1–A13 summary)

| Theme | Resolution |
|-------|------------|
| Admin “all messages” vs authorization | Admin read-only supervisory view; mutations still require party check |
| Count semantics | Separate header badge vs lens counts vs `hub_counts` API fields |
| Legacy flows preserved | PHI Direct, fax deep links, multi-recipient send, orphan patient assign |
| Reminders modal refresh | `onClose` callback refreshes list and counts |
| ACL on all AJAX endpoints | Every hub action checks permissions |
| User stories | COM-US-001+ in spec appendices |
| Test scenarios | TS-* blocks for messages, reminders, admin, fax |

## Explicitly out of COM scope

| Surface | Treatment |
|---------|-----------|
| Recalls | S1 Recall Worklist |
| Portal mail (`onsite_mail`) | Separate Angular app / Portal dropdown |
| MedEx SMS | Link-out / overflow when enabled |
| Patient portal messaging | Non-goal |

## Config

- `communications_hub_enable` — when OFF, 100% legacy Message Center UI.

## Training one-liner

Staff inbox for **internal** patient-related notes and **dated reminders** — not the same as texting patients or portal messages.

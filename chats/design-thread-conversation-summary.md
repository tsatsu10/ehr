# Design Thread — Conversation Summary

**Transcript:** `fe6b41d7-7a53-4d3d-beb5-5f9384575912`  
**Period:** June 2026  
**Type:** Product design and documentation (not implementation)

---

## What you asked for across the thread

You built New Clinic **on paper** in a logical sequence:

1. **Environment** — Confirm XAMPP local setup and project docs (CLAUDE.md).
2. **Communications** — Replace legacy Message Center with a modern staff hub including Messages and Reminders together.
3. **Patient discovery** — Decide fate of Patient Finder; split daily search from cohort/registry search.
4. **Front Desk and Registry** — Bring M1a and M10 specs to “100%” with audits, user stories, and tests.
5. **Multi-doctor clinics** — Nurse sends to shared doctor pool; no picker; All/Me filters; appointment hints.
6. **Smarter routing (V1.1)** — Roster, load-based suggestions, exceptions — without blocking manual Take.
7. **Optional controls (V1.2)** — Hard assignment and “patient ready” notifications, both config OFF by default.
8. **Quality pass** — Audit docs vs design; close consistency gaps in PRD and companions.
9. **Coverage check** — What stock OpenEMR is still untouched; export list to TXT; re-scan after M11–M18 added.
10. **Niche features** — Understand EHI, BatchCom, de-ID, DICOM, chart tracker; decide if worth redesigning.

---

## Major outcomes

### Products defined or approved

- **COM** — Communications Hub Phase 1 approved.
- **M1a** — Front Desk search Phase 1 approved.
- **M10** — Patient Registry comprehensive spec + PRD module block.
- **§6.5.1–§6.5.4** — Multi-doctor, advisory routing, hard assign, notify.
- **Companion sync** — PRD v1.16.1+ pass; versions aligned across MDs.

### Principles repeated in conversation

- **Orchestrate, don’t rewrite** OpenEMR clinical/billing engines.
- **Routing suggests; Take decides.**
- **V1.2 features opt-in** so pilots keep shared-pool behavior.
- **Two search tools** — operational vs cohort.
- **Two queue systems** — `new_visit` vs schedule/tracker (no sync; M18 later for exceptions).

### What was explicitly rejected or deferred

- Hiding Finder without replacement (replaced by M1a + M10).
- Per-doctor sub-queues in V1/V1.1.
- Redesigning EHI, de-ID, DICOM, chart tracker for typical OPD.
- Patient portal, telehealth, group therapy in V1 scope.

---

## Relationship to implementation

This thread mostly **predates or parallels** the build documented in `new-clinic-development-session-summary.md` (React islands, E2E, pilot users, July 2026).

Use **this folder’s numbered files** for **why** the specs say what they say.  
Use **new-clinic-development-session-summary.md** for **what was coded** and test accounts.

---

## File map (this folder)

| Read if you need… | File |
|-------------------|------|
| Every user message in order | `00-conversation-timeline.md` |
| COM audit and scope | `02-communications-hub-design.md` |
| Finder vs Registry | `03-front-desk-search-and-registry.md` |
| Multi-doctor V1 | `04-multi-doctor-clinic-model.md` |
| Routing V1.1 | `05-advisory-routing-v11.md` |
| Hard assign + notify V1.2 | `06-hard-assignment-notifications-v12.md` |
| Doc gap closure | `07-documentation-audit-gap-closure.md` |
| OpenEMR coverage | `08-openemr-coverage-analysis.md` |
| Five niche tools explained | `09-niche-features-explained.md` |
| Redesign yes/no | `10-redesign-recommendations.md` |
| D-numbers and config keys | `11-decisions-config-reference.md` |

Canonical specs remain in `Documentation/NewClinic/`.

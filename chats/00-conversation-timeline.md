# Conversation Timeline

Chronological record of user requests and what was produced. Transcript: `fe6b41d7-7a53-4d3d-beb5-5f9384575912`.

---

## June 2026 — Design thread

| # | User request | Outcome |
|---|--------------|---------|
| 1 | UI pro init; confirm CLAUDE.md exists | Confirmed; discussed XAMPP vs Docker |
| 2 | Update CLAUDE.md for XAMPP local dev | CLAUDE.md updated with XAMPP paths, URLs, PHP/MySQL notes |
| 3 | Study Message Center; redesign for New Clinic | Codebase study of `messages.php`, `pnotes`, dated reminders |
| 4 | Phase 1: Messages **and** Reminders in one pass; comprehensive MD | `NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md` created |
| 5 | Audit redesign; user stories and test scenarios (no separate audit doc) | Gap list A1–A13; COM-US-* stories; TS-* test scenarios in spec appendices |
| 6 | Recommend fixes for all gaps | Concrete fixes per gap; spec bumped toward v1.0.x / v0.2.0 |
| 7 | Update the MDs with recommendations | COM spec v1.0.3 path; CLAUDE.md pointer |
| 8 | Do we need Patient Finder? Hide for everyone? | **No** for daily staff — M1a Front Desk search replaces Finder; hide `fin0` menu when registry/search flags on |
| 9 | Redesign Finder as cohort search (e.g. ages 12–19 + malaria) | Agreed: **two tools** — Front Desk = “who walked in”; Registry = “who matches rules” |
| 10 | List of Registry filters | Full filter taxonomy by phase (demographics, clinical, visit, presets) |
| 11 | Draft comprehensive Patient Registry MD | `NEW_CLINIC_V1_PATIENT_REGISTRY_REDESIGN.md`; user-selectable confirmation source; age at diagnosis; record-status dropdown |
| 12 | Get Communications Hub to 100% | Audit closure items; PRD Module COM; PAGE_DESIGNS §7.12; approved Phase 1 |
| 13 | Get Front Desk search to 100% | `NEW_CLINIC_V1_FRONT_DESK_SEARCH_REDESIGN.md` approved Phase 1; M1a-F* in PRD |
| 14 | How does nurse send patient to doctor when clinic has **multiple doctors**? | Explained shared `ready_for_doctor` pool; no nurse doctor-picker in V1 |
| 15 | Update all MDs with multi-doctor ideas | PRD §6.5.1 D28; M0-F16/F17; M3/M4 filters; USER_WORKFLOWS §8.3.1; PAGE_DESIGNS queue chips |
| 16 | Explain round-robin vs per-doctor sub-queues | Advisory routing = suggestions only; sub-queues deferred |
| 17 | Fix routing with roster, load metric, exceptions, override; **never block Take** | PRD §6.5.2 D29; `new_doctor_availability`; Taking patients OFF = excluded from suggestions but manual Take allowed |
| 18 | Update all MDs with advisory routing | v1.15.0 PRD; PAGE_DESIGNS §7.4.5a; USER_WORKFLOWS §8.3.2 |
| 19 | Opinion on hard assignment + push “patient ready” | Approved as **opt-in V1.2**; does not conflict when config OFF |
| 20 | Implement §6.5.3 hard assign + §6.5.4 notify as specified | D30–D31; `hard_assigned_provider_id`; `enable_doctor_ready_notify`; ACLs |
| 21 | Audit everything done so far | Design vs implementation matrix; 7 doc gaps + implementation stub |
| 22 | Close all gaps identified | PRD 1.16.1 pass: M10 module block, M6-F19, tests 22 + 23–25, companion version sync |
| 23 | What parts of OpenEMR failed to address? | First gap analysis (~15–20% surface by feature count) |
| 24 | Put unaddressed areas in tabular TXT | `Documentation/NewClinic/OPENEMR_AREAS_NOT_ADDRESSED.txt` |
| 25 | Re-check codebase properly for remaining gaps | Updated analysis: M11–M18 specs added since first pass; implementation still 0% at that audit |
| 26 | What are EHI, batchcom, de-ID, DICOM, chart tracker? | Plain-language explanations tied to OpenEMR paths |
| 27 | Can we redesign them? Opinion | **Generally no** for V1; BatchCom → possible V2 outreach via Registry; EHI → Admin link only |

---

## Relationship to implementation thread

A **later** conversation (`b0a2e23c-…`, summarized in `new-clinic-development-session-summary.md`) covers React islands, E2E tests, pilot users, and module code. The design thread above largely predates or parallels that build work.

When reading both: **this folder’s 02–11 files = product/design decisions**; **new-clinic-development-session-summary.md = what was built on disk**.

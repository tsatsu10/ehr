---
name: nc-write-spec
description: Write or amend a New Clinic spec (PRD amendment, redesign spec, workflow, or plan doc) following the documentation hierarchy, versioning rules, and product guardrails
---

# New Clinic spec writing

## Before writing

1. **Check the hierarchy.** PRD (`Documentation/NewClinic/NEW_CLINIC_V1_PRD.md`) wins all
   conflicts → `NEW_CLINIC_V1_USER_WORKFLOWS.md` + `NEW_CLINIC_V1_PAGE_DESIGNS.md`
   (normative companions) → per-module `*_REDESIGN.md` specs → scorecard → README index.
   Read the sections your spec touches; never contradict a higher document — amend it
   instead and say so.
2. **Trust code over doc status.** Scorecard/PRD matrices go stale; verify a "Not started"
   cell against the code before planning work around it, then fix the doc.
3. **Check the non-goals.** Patient portal, telehealth, US claims/EDI/eligibility, eRx
   vendor UIs, FHIR/SMART clients, DICOM, fax are deliberate non-goals — a spec touching
   them requires an explicit PRD amendment, not a new spec. Also check
   `OPENEMR_AREAS_NOT_ADDRESSED.txt`.

## Product guardrails to bake into every spec

- **Flags invariant (PRD §5.6):** every post-pilot surface sits behind an `enable_*` flag
  in `new_clinic_config`, default OFF. Flag OFF = 100% legacy behavior. The legacy stock
  screen stays reachable until the replacement passes parity sign-off. Every spec must name
  its flag and its parity sign-off criteria.
- **Lifecycle model:** queue FSM on `new_visit`; encounter created at Start visit;
  complete-consult ≠ signed ≠ paid; cash checkout at `ready_for_payment` only; e-sign is
  compliance, never optional.
- **Two search surfaces:** M1a Front Desk search (fast single-patient) ≠ M10 Registry
  (cohort filters) — don't merge them.
- **Multi-doctor:** shared `ready_for_doctor` pool; advisory routing suggests only (V1.1);
  hard assignment is a V1.2 flag, default OFF.
- **Naming:** the product is "New Clinic" — never "Ghana-this"; neutral regional examples.
  DD/MM/YYYY, clinic-configurable currency.

## Spec structure

Title + version + status → Problem / why now → Scope and explicit non-scope → User
workflows affected (map to M1–M18 desks/roles) → Design (page behavior, states, empty/error
states, a11y notes) → Data & backend (tables with `#IfNotRow2D` guards, ajax.php actions,
services, ACL) → Feature flag + rollout + parity sign-off checklist → Open questions →
Version history table.

Write in plain English for product sections — the user wants simple words, not file-name
soup; keep file paths to the technical sections.

## On every spec change (same batch, non-negotiable)

- Bump the spec's version and add a history row.
- Sync `Documentation/NewClinic/README.md` index and
  `NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md`.
- If scope conflicts with the PRD, amend the PRD (it's canonical) rather than forking truth.

---
name: nc-design-screen
description: Design a new New Clinic screen or desk view — layout, states, interactions, and visual language consistent with the page designs doc and the token system, before any code is written
---

# Design a New Clinic screen

Use BEFORE building: produce a concrete screen design (structure, states, interactions)
that a build session can implement without inventing anything.

## Ground truth first

Read the relevant sections of:

- `Documentation/NewClinic/NEW_CLINIC_V1_PAGE_DESIGNS.md` — normative page behavior
- `Documentation/NewClinic/NEW_CLINIC_V1_USER_WORKFLOWS.md` — the workflow this screen serves
- The module's redesign spec for this desk (`*_REDESIGN.md`) if one exists
- The token definitions (`--oe-nc-*`) and existing shared components before proposing new ones

The design must serve a specific role at a specific desk (M1–M18). Name the role, their
task, and the 2–3 things they do most — the screen is optimized for those, everything
else is secondary.

## Visual language (non-negotiable)

- Colors, spacing, radii, typography from `--oe-nc-*` tokens; never raw hex or arbitrary
  Tailwind palette values. New tokens require justification and a token-file addition, not
  inline values.
- Consistent chrome: screens live inside `.nc-shell-main` (centering owned by the shell);
  full-width layouts are an explicit, argued exception like Visit Board.
- Shared vocabulary: `QueueCard` for queue entries, `WaitTimeSpan` for wait times, Badge
  variant `neutral`, Lucide icons only (no emoji), token callouts
  (`nc-error-callout` etc.) and `showDeskToast()` for feedback, `ConfirmModal` for
  destructive or identity-sensitive actions.
- Density: clinic staff process queues all day — favor scannable rows/cards, strong
  visual hierarchy for patient name + state + wait time, minimal decoration.

## Design every state, not just the happy path

For each data region specify: loading, empty (with what the empty state says and offers),
error (callout + retry), success. For forms: inline validation while typing, values
preserved on error, the form disappears after successful save, accordion pattern for
registration-style long forms.

## Interaction rules

- Primary action per screen is singular and obvious; destructive/identity actions get
  `ConfirmModal`.
- Queue actions follow the FSM — the design must not offer transitions the state doesn't
  allow (e.g. checkout before `ready_for_payment`, consult actions before Start visit).
- Keyboard: tab order, Enter submits, Esc closes modals; 44px minimum touch targets.
- Regional: DD/MM/YYYY, clinic-configurable currency symbol, insurance elements only when
  `enable_insurance` is on.

## Output format

1. One-paragraph purpose statement (role, desk, top tasks)
2. Layout description or ASCII wireframe (regions, hierarchy)
3. Component inventory — reused shared components vs new ones (new ones justified)
4. State table per region (loading/empty/error/success + copy)
5. Interaction list with FSM guards
6. Open design questions
7. Hand-off note: which flag gates it, and pointer to `/nc-build-island` for build

Write product sections in plain English; keep file paths to the hand-off section.

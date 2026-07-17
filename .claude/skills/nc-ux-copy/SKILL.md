---
name: nc-ux-copy
description: Write or review interface copy for New Clinic screens — labels, buttons, empty states, errors, toasts, confirmations — plain English, regionally neutral, consistent across desks
---

# New Clinic UX copy

Use when writing or reviewing the words on screens: button labels, field labels, empty
states, error messages, toasts, confirmation dialogs, onboarding hints.

## Voice

Plain, calm, concrete. Written for busy clinic staff (front desk, nurses, doctors,
cashiers, lab/pharmacy techs) who scan rather than read, many using English as a second
language. Short sentences. No jargon from the codebase (never "encounter FSM", "island",
"envelope"), no exclamation marks, no blame ("Invalid input!" → say what to fix).

## Rules

- **Buttons say what happens:** verbs first — "Start visit", "Take patient",
  "Record payment", "Sign & finish". Never "OK"/"Submit" for consequential actions.
  Match the queue lifecycle vocabulary exactly; the same action must have the same label
  on every desk (a queue claim is "Take patient" everywhere, not "Assign" on one screen).
- **Confirmations (ConfirmModal):** title = the action as a question with the object
  ("Remove Ama Mensah from the queue?"), body = the consequence in one sentence,
  confirm button repeats the verb ("Remove from queue"), never "Yes"/"OK". Identity
  actions repeat the patient name so wrong-patient mistakes get caught.
- **Errors say what to do next:** what happened + what to do, in that order.
  "Couldn't save the visit. Check your connection and try again." Include the retry
  affordance in the callout. Never expose exception text, action names, or table names.
- **Empty states orient:** what this list is + how items appear + the next action.
  "No patients waiting. Patients appear here after check-in." Not just "No data".
- **Toasts (showDeskToast) confirm outcomes:** past tense, object named — "Payment
  recorded", "Visit started for Ama Mensah". One line, no period needed.
- **Field labels are nouns, hints do the explaining:** label "Phone number", hint
  "Digits only, e.g. 0244 123 456". Placeholders are examples, never instructions, never
  the label. Validation messages appear inline while typing and say the fix.
- **Regional neutrality:** DD/MM/YYYY, currency symbol from clinic config (write copy
  that survives any symbol), neutral names in examples across regions, no US-isms
  ("copay", "ZIP code"). Product name is "New Clinic" — never region-branded.
- **Sentence case everywhere** (buttons, titles, labels). Patient names as entered, not
  uppercased.

## Review method

Inventory every string on the screen(s) into a table: current copy → issue → proposed
copy. Check cross-desk consistency for shared verbs (grep other islands for the same
action's label). Fix all strings in one batch (they live in the island TSX), update any
tests asserting text, then `/verify-batch` with one version bump.

---
name: nc-a11y-audit
description: Accessibility audit of a New Clinic island or screen — keyboard, ARIA, contrast, touch targets, motion, and clinic-floor realities — with a fix list ordered by severity and a full fix pass
---

# New Clinic accessibility audit

Audit the requested island(s)/screen(s), then fix — same shape as `/nc-tech-debt`:
inventory ALL issues across ALL render paths first, then fix everything in one batch with
one asset version bump. Don't stop at the first instance; grep for the pattern everywhere.

## Context that changes the audit

Clinic staff work long shifts on shared machines — often older monitors, sometimes
tablets, sometimes gloves. Bright rooms wash out low contrast; mouse precision is low.
That makes contrast, target size, and keyboard operability practical requirements here,
not compliance checkboxes.

## Checklist (severity order)

**Critical — blocks task completion**
- Full keyboard operability: every action reachable by Tab in a logical order; Enter
  submits, Esc closes modals; no focus traps; focus moves INTO opened modals
  (`ConfirmModal`) and returns to the trigger on close.
- Visible focus ring on every interactive element (token-based, not removed by CSS).
- Forms: every input has a programmatic label (not placeholder-as-label); inline errors
  are announced (`aria-describedby` + `aria-invalid`), validation runs while typing, and
  values are never wiped on error.
- Icon-only buttons have `aria-label`. Lucide icons are decorative (`aria-hidden`) when
  accompanied by text.

**High**
- Contrast ≥ 4.5:1 for text, 3:1 for large text and UI boundaries — check actual computed
  token values, including muted/"subtle" text on tinted callout backgrounds and badge
  variants.
- Touch targets ≥ 44px (queue action buttons, accordion headers, table row actions).
- Live regions for async desk updates: toasts (`showDeskToast`) and queue-state changes
  announced via `aria-live="polite"`; loading states have accessible text, not just
  spinners.
- Semantics: headings in order, lists as lists, tables with `th`/scope; queue cards
  navigable as list items, patient name as the accessible name of the card's main action.

**Medium**
- `prefers-reduced-motion` respected for every animation/transition.
- Zoom to 200% without loss of function; no horizontal scroll at 1280px width.
- Color never the only signal (queue states need text/icon, not just a colored dot —
  check `nc-*-callout`, badges, wait-time thresholds).
- DD/MM/YYYY dates rendered as text readable by screen readers (no digit-soup).

**Low**
- Page/document titles per desk; landmark regions (`main`, `nav`) in the island shell;
  skip link if the host chrome is heavy.

## Method

1. Read the island code (components + CSS) and trace each interactive element.
2. Static checks: grep for `onClick` on non-buttons, missing `aria-label` on icon
   buttons, `outline: none`, animations without motion guard, raw hex.
3. Report: numbered findings, severity-ordered, each with file:line, the user-visible
   failure, and the concrete fix.
4. Fix pass across all render paths → tests updated (assert aria attributes in Vitest) →
   `/verify-batch` → one version bump.

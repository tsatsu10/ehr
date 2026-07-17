---
name: nc-component
description: Build or extract a shared New Clinic frontend component the right way — decide island-local vs shared, token-based BEM styling, typed props, tests, and migration of existing call sites
---

# New Clinic shared component

Use when creating a reusable component or promoting an island-local one to shared.

## 1. Decide where it lives

- Used by ONE island → keep it in that island's `components/`. Don't speculatively share.
- Used by 2+ islands, or it standardizes a visual pattern (callouts, badges, wait times,
  queue rows) → shared components directory (follow where `QueueCard`, `WaitTimeSpan`,
  `ConfirmModal`, `deskCalloutStyles` live).
- Before writing anything: grep for an existing component or token pattern that already
  does this. Duplicating `WaitTimeSpan`-style logic inline is a known bug class.

## 2. API design

- Typed props, TS strict, no `any` without a justifying comment. Prefer a small closed
  API (variant unions like `'neutral' | 'success' | 'warning' | 'danger'`) over
  className/style pass-through — pass-through invites off-token styling.
- Composition only: no data fetching, no business logic, no ACL awareness inside shared
  components — hooks in the island own data; components render props.
- Accessibility built into the component, not left to callers: aria-labels on icon
  buttons, focus ring, 44px touch targets, `prefers-reduced-motion` guard for animation,
  Lucide icons only.

## 3. Styling

- `nc-`-prefixed BEM classes, tokens (`--oe-nc-*`) for every color/spacing/radius value.
- Component CSS is unlayered (Tailwind 4 `@layer utilities` loses to the host's unlayered
  Bootstrap 4). Tailwind utilities only where Bootstrap doesn't compete.
- Support the states the design system expects: hover, focus-visible, active, disabled,
  and where relevant loading. No hardcoded hex — if the needed color has no token,
  propose the token addition instead.

## 4. Migrate call sites — the whole codebase, not one file

When extracting/standardizing, grep for EVERY render path that hand-rolls this pattern
(all islands, not just the one you started in) and migrate them in the same batch.
Partial migrations that surface one hard-refresh at a time are the #1 frustration —
finish the sweep before verifying.

## 5. Tests and gates

- Component tests colocated (`*.test.tsx`): each variant, interaction handlers,
  a11y-critical attributes, and the disabled/loading states.
- Update tests of migrated islands if snapshots/queries change.
- Finish with `/verify-batch` (scoped vitest for every touched island → `npm run check` →
  build → ONE `ModuleAssetVersion.php` bump for the whole migration).

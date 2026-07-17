---
name: nc-ui-polish
description: Visual QA and polish pass over a New Clinic island or screen — consistency with the design language, state coverage, spacing/typography rhythm, and cross-island drift — audit then fix all in one batch
---

# New Clinic UI polish pass

A structured visual QA sweep for when something works but looks or feels off, or before a
pilot demo. Same discipline as `/nc-tech-debt`: full inventory first (every screen and
render path in scope), then fix ALL of it, one `ModuleAssetVersion.php` bump, hard-refresh
instruction at the end.

## 1. Consistency with the design language

- Every color/spacing/radius/shadow from `--oe-nc-*` tokens — grep the island's CSS and
  TSX for raw hex, rgb(), and arbitrary Tailwind palette classes.
- Shared vocabulary used everywhere it applies: `QueueCard`, `WaitTimeSpan`, Badge
  (`neutral`, never `secondary`), token callouts + `showDeskToast()` (no Bootstrap
  alerts), `ConfirmModal`, Lucide icons (no emoji).
- Cross-island drift: compare against front-desk/patient-registry/visit-board — same
  paddings for the same patterns, same card anatomy, same button hierarchy. Flag where
  this island invented its own variant of an existing pattern.
- Layout: content centered by `.nc-shell-main`, not re-solved locally; check gutters at
  1280px and 1920px.

## 2. State coverage (where polish bugs hide)

For every data region, actually trigger and eyeball all four states:
- **Loading** — skeleton/spinner sized so the layout doesn't jump when data lands.
- **Empty** — designed empty state with helpful copy and next action, not a blank div.
- **Error** — `nc-error-callout` with retry, not console-only or a dead screen.
- **Success/long data** — overflowing names, 3-digit queue counts, very long wait times,
  many-badge rows: nothing wraps badly, truncation has tooltips/title.

Forms: focus states, inline validation appearance, error summary placement, disabled
submit while pending, form disappears after save.

## 3. Rhythm and detail

- Typography scale consistent (no one-off font sizes); line-height comfortable in dense
  queue rows; numbers that update (wait times) use tabular alignment where columns exist.
- Spacing on a consistent scale — flag pixel-odd one-offs (13px, 22px…).
- Alignment: baselines in card headers, icon-to-text vertical centering, button groups
  gap-consistent.
- Interaction states: hover/focus-visible/active/disabled all present and token-based;
  transitions subtle and guarded by `prefers-reduced-motion`.
- DD/MM/YYYY everywhere, configurable currency (no stray `$`/`GHS`), no insurance chrome
  when `enable_insurance` is off.

## 4. Verify with eyes AND gates

Browser pass at http://localhost/openemr/ after hard-refresh (check the `?v=` matches the
new version), DevTools device toolbar at tablet width, then `/verify-batch` (scoped
vitest → check → build → bump). Report findings fixed vs deferred, with before/after
notes for anything visual the user should re-check.

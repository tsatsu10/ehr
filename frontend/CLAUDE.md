# Frontend conventions (New Clinic islands)

Migrated from repo root `CLAUDE.md` §7 (2026-07-09) — loads automatically whenever you work with
files under `frontend/`. Repo-wide guidance stays in the root `CLAUDE.md`.

- **Design tokens:** all colors/spacing from `--oe-nc-*` (`frontend/src/core/tokens.css` +
  `public/assets/css/tokens.css`). Never hardcode hex or arbitrary Tailwind palette classes.
  Note: CSS *variables* are `--oe-nc-*` but CSS *class names* use the shorter `nc-` prefix
  (`.nc-shell-main`, `.nc-page-heading`, `.nc-callout-*`). Layout: `--oe-nc-content-max` (90rem) +
  `--oe-nc-content-gutter`; centering lives in `shell.css` (`.nc-shell-main`) — don't re-solve
  centering per island (Visit Board has a deliberate full-width exception with horizontal lanes).
- **Feedback:** token callouts, not Bootstrap alerts — React variants in
  `@components/deskCalloutStyles` (`nc-error-callout`, `nc-warn-callout`, `nc-info-callout`,
  `nc-success-callout`), Twig shell equivalents `.nc-callout-*` in `components.css`;
  `showDeskToast()` from `@components/deskToast`; `ConfirmModal` (Radix) for destructive/identity
  confirmation; Badge variant is `neutral` (not `secondary`).
- **Every desk renders wait time via `<WaitTimeSpan />` / `QueueCard`** — never inline the
  formatting (see `.cursor/rules/new-clinic-big-picture-first.mdc` for the full render-path list).
- **Forms UX rules the user insists on:** inline validation while typing (not save-time only),
  form must not wipe on error, form disappears after successful save, registration stays an
  **accordion** (wizard replacements were explicitly rejected).
- **Regional:** DD/MM/YYYY dates, clinic-configurable currency (never hardcode `$` or GHS),
  insurance UI hidden when `enable_insurance=false`.
- **A11y:** WCAG 2.1 AA; aria-labels on icon buttons; 44px touch targets; visible focus ring;
  `prefers-reduced-motion` guard; Lucide icons in React (no emojis as icons).
- Every island has `*.test.tsx`; TS strict, no `any` without a justifying comment; no
  `console.log`; no business logic in components (PHP enforces ACL, services compute).
- **i18n (D1):** migrated islands route every UI string through `t()` from `@core/i18n` —
  literal English as the key (`t('Save')`), `{param}` interpolation (`t('Hi {name}', {name})`,
  NEVER template literals inside `t()`). **No module-scope `t()`** — the dictionary loads after
  import; make label constants render-time functions (see `officeNoteFilters()`). After adding
  strings run `npm run i18n:extract` (the `i18n:check` gate in `npm run check` fails otherwise).
  When migrating an island, add its dir to the `react/jsx-no-literals` block in
  `eslint.config.js`. Migrated so far: office-notes, proc-order, my-profile.
- **De-Bootstrap ratchet (D6):** `npm run bs:check` (in `npm run check`) pins the count of
  Tailwind-name-colliding BS4 classes (`bg-white`, `border`, `rounded*`, `text-*`, …) in
  `frontend/src` via `scripts/bs-collision-baseline.json` and fails if any **increases** — so never
  add one; use a token arbitrary value (`bg-[var(--oe-nc-surface)]`) or an `nc-` BEM rule. When you
  migrate usages away, run `npm run bs:baseline` to lower the pin. **D6's wholesale theme cutover
  (`enable_debootstrap_shell`) is DEFERRED by decision** — the module borrows FontAwesome icons + base
  font from the core theme, so dropping it needs a base-layer rebuild first; the actual bug is already
  fixed + guarded, so it isn't worth it. Don't re-attempt the cutover without the base-layer work.

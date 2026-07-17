---
name: nc-build-island
description: Scaffold a new React island for New Clinic end-to-end — folder layout, mount/registration, smart-vs-legacy routing, oeFetch data layer, BEM CSS, tests, asset version bump
---

# Build a new New Clinic island

Use when adding a whole new desk/screen island under `frontend/src/islands/`. Copy the
patterns from the closest existing island (front-desk, patient-registry, visit-board)
rather than inventing structure — read one before scaffolding.

## 1. Scaffold

```
frontend/src/islands/<island-name>/
  main.tsx          # entry: mounts React root onto the island div
  <Island>App.tsx   # top component; composition only, no business logic
  components/       # island-local components
  hooks/            # data hooks wrapping oeFetch actions
  main.css          # island visual styles — non-layered BEM, nc- prefix
  <Island>.test.tsx # colocated Vitest tests (mandatory)
```

Register the entry in the Vite config's island entry map so it builds into
`public/assets/modern/`. Match how existing islands are registered — same naming, same
chunking.

## 2. Host page and routing

- The PHP host page lives in the module (`interface/modules/custom_modules/oe-module-new-clinic/`);
  it renders the mount div, loads the built asset with `?v=<ModuleAssetVersion>`, and
  enforces ACL server-side before rendering anything.
- If this island replaces a stock OpenEMR screen, wire the smart-vs-legacy routing so the
  `enable_*` flag (default OFF, `new_clinic_config`) decides which renders — flag OFF must
  be byte-for-byte legacy, and the legacy screen stays reachable until parity sign-off.
- Deep links into core screens must set `$_SESSION['pid']` / `$_SESSION['encounter']`
  first (wrong-patient prevention).

## 3. Data layer

- All reads/writes through `oeFetch<T>('<action>', ...)` from `@core/oeFetch` against
  module `ajax.php` actions — never raw `fetch`, never REST/FHIR for desk work.
- Envelope is `{ success, data | error }`; handle the error branch in every hook; never
  check `res.ok`. Guard every param against `undefined`/`null` before it reaches the URL.
- New ajax actions: add the service import (`use ...`) in `AjaxController` — a missing
  import 500s every ajax request in the module.
- No new polling loops without checking the scalability plan (R1–R8); if polling is
  unavoidable, the PHP side needs `session_write_close()` before long work.

## 4. UI composition

- Layout: render inside `.nc-shell-main` and let it own centering; don't re-solve layout
  (Visit Board is the one deliberate full-width exception).
- Reuse shared pieces before building new: `QueueCard`, `WaitTimeSpan`,
  `ConfirmModal`, `showDeskToast()`, callout classes from `@components/deskCalloutStyles`,
  Badge (variant `neutral`), Lucide icons.
- Tokens only (`--oe-nc-*`) for color/spacing; `nc-` prefixed BEM classes in `main.css`,
  NOT inside `@layer` (Tailwind 4 layers lose to unlayered Bootstrap 4 in the host).
- States are part of scaffolding, not polish: loading, empty, error, success for every
  data region; forms validate inline while typing, keep values on error, disappear on save.
- DD/MM/YYYY dates, currency from clinic config, insurance UI behind `enable_insurance`.

## 5. Tests + gates

Colocated Vitest tests covering the four states and key interactions (jsdom setup in
`frontend/src/test-setup.ts` already mocks ResizeObserver/scrollIntoView for cmdk/Radix).
Then run the full frontend gate via `/verify-batch`: scoped vitest → `npm run check` →
`npm run build` → single `ModuleAssetVersion.php` bump → hard-refresh instruction.

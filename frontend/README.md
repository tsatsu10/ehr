# OpenEMR Frontend Workspace (Phase 0)

Vite + React 19 + TypeScript workspace for the OpenEMR modernization roadmap
described in [`Documentation/NewClinic/FRONTEND_2026_MODERNIZATION_PLAN.md`](../Documentation/NewClinic/FRONTEND_2026_MODERNIZATION_PLAN.md).

## Status

**Phase 0 scaffold.** One proof-of-concept "hello" island wires into the New
Clinic Visit Board behind the config flag `enable_react_islands_dev`. Nothing
clinical is rendered by React yet — the existing jQuery desks are untouched.

## Layout

```
frontend/
├── package.json              ← Vite, React, TS, Tailwind, Vitest, ESLint
├── vite.config.ts            ← outputs to oe-module-new-clinic/public/assets/modern/
├── tsconfig.json             ← strict TypeScript
├── eslint.config.js          ← flat config, TS + React + hooks
└── src/
    ├── core/
    │   ├── tokens.css        ← Tailwind 4 + OpenEMR design tokens
    │   ├── types.ts          ← IslandProps, OeNcPageContext
    │   ├── oeFetch.ts        ← CSRF + envelope-aware AJAX wrapper
    │   └── mountIsland.tsx   ← mount React component into data-island nodes
    └── islands/
        └── visit-board-hello/
            ├── index.tsx
            ├── VisitBoardHello.tsx
            ├── VisitBoardHello.test.tsx
            └── main.css
```

## Build pipeline

Vite writes bundles directly into the New Clinic module:

```
frontend/                                  → vite build
interface/modules/custom_modules/
  oe-module-new-clinic/public/assets/
    modern/
      visit-board-hello.js                 ← entry, unhashed name
      chunks/<lazy-chunks>-<hash>.js
      assets/<css>-<hash>.css
      .vite/manifest.json
```

The Twig page references `{{ assets_url }}/modern/visit-board-hello.js`,
which already maps to the module's `public/assets/` folder via the existing
`PageController::render()` context. No `config/config.yaml` change is needed
in Phase 0.

## Commands

Run from the repo root:

```bash
npm run frontend:install      # one-time: install workspace deps
npm run frontend:build        # production bundle into the module folder
npm run frontend:dev          # vite build --watch
npm run frontend:test         # vitest run
npm run frontend:lint         # eslint over src/
npm run frontend:typecheck    # tsc --noEmit
```

Or from `frontend/` directly:

```bash
cd frontend
npm install
npm run build
npm test
```

## Enabling the Phase 0 island in the running app

1. Build the bundle: `npm run frontend:build`.
2. Flip the flag in the New Clinic admin panel (Queue & roles tab) or run:
   ```sql
   UPDATE new_clinic_config SET config_value = '1'
   WHERE facility_id = 0 AND config_key = 'enable_react_islands_dev';
   ```
3. Reload `/interface/modules/custom_modules/oe-module-new-clinic/public/visit-board.php`.
   A small green "React island OK — Visit Board" badge appears above the board.
4. Flip the flag back to `'0'` to hide the island; the page becomes byte-identical
   to the pre-Phase-0 version (no extra HTTP requests).

## Adding a new island (preview of the Phase 1 pattern)

1. Create `src/islands/<name>/{index.tsx, <Component>.tsx, main.css}`.
2. Register the entry in `vite.config.ts` under `build.rollupOptions.input`.
3. In the consuming Twig page, add a mount node behind a config flag:
   ```twig
   {% if enable_my_island %}
   <div data-island="my-island" data-props="{{ props|json_encode|e('html_attr') }}"></div>
   <script src="{{ assets_url }}/modern/my-island.js?v={{ asset_version }}"></script>
   {% endif %}
   ```
4. The mount helper finds every `data-island="my-island"` node and renders the
   component into each one.

Full migration roadmap: [`Documentation/NewClinic/FRONTEND_2026_MODERNIZATION_PLAN.md`](../Documentation/NewClinic/FRONTEND_2026_MODERNIZATION_PLAN.md)
and the module developer guide [`Documentation/FRONTEND_MODULE_GUIDE.md`](../Documentation/FRONTEND_MODULE_GUIDE.md).

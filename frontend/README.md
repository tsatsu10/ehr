# OpenEMR Frontend Workspace

Vite + React 19 + TypeScript workspace for the New Clinic React islands described in
[`Documentation/NewClinic/FRONTEND_2026_MODERNIZATION_PLAN.md`](../Documentation/NewClinic/FRONTEND_2026_MODERNIZATION_PLAN.md).

## Status

**Production.** All New Clinic desks and hub pages render via React islands in
`frontend/src/islands/`. Legacy jQuery desk bundles were removed in the w50react cutover.
Built output lands in `oe-module-new-clinic/public/assets/modern/`.

## Layout

```
frontend/
├── package.json
├── vite.config.ts            ← one Rollup input per island
├── src/
│   ├── core/                 ← oeFetch, mountIsland, shared types/tokens
│   ├── components/           ← shared React components (QueueCard, WaitTimeSpan, …)
│   └── islands/              ← visit-board, triage-desk, front-desk, admin-hub, …
```

## Commands

From the repo root:

```bash
npm run frontend:install
npm run frontend:build        # production bundle → module public/assets/modern/
npm run frontend:dev          # vite build --watch
npm run check                 # lint + typecheck + vitest (run inside frontend/)
```

Or from `frontend/` directly: `npm install`, `npm run build`, `npm test`.

## Developer guide

See [`Documentation/FRONTEND_MODULE_GUIDE.md`](../Documentation/FRONTEND_MODULE_GUIDE.md)
for adding a new island, Twig wiring, config flags, and asset versioning.

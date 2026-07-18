# OpenEMR Frontend Module Guide

> **Status:** React islands shipped (w50react cutover) · **Updated:** 2026-06-28
> **Workspace:** [`frontend/`](../frontend/) · **Plan:** [`Documentation/NewClinic/FRONTEND_2026_MODERNIZATION_PLAN.md`](./NewClinic/FRONTEND_2026_MODERNIZATION_PLAN.md)

This guide explains how OpenEMR modules add React + TypeScript islands to
their existing PHP/Twig pages.

---

## 1. The mental model

OpenEMR's modernization uses the **strangler-fig + islands** pattern:

- PHP and Twig keep rendering the page shell, the auth boundary, ACL gates,
  and the initial HTML.
- A small `<div data-island="<name>">` mount node is dropped into the Twig
  template wherever React should render.
- A Vite-built JavaScript bundle finds those mount nodes at runtime and
  hydrates them with React.
- Optional hubs gate on **product** flags (`enable_bill_ops`, etc.). Desk pages
  mount React by default; legacy jQuery desk JS was removed in w50react.

No island ever:

- Replaces the auth/session boundary (PHP still owns login, CSRF, ACL).
- Calls a non-OpenEMR API directly (use `oeFetch` and the existing
  `ajax.php` actions).
- Bundles its own copy of React, jQuery, or design tokens (use the shared
  `frontend/src/core` utilities).

---

## 2. File layout

```
frontend/
├── package.json
├── vite.config.ts                         ← register each island as a Rollup input
├── src/
│   ├── core/
│   │   ├── tokens.css                     ← shared design tokens (do not duplicate)
│   │   ├── types.ts                       ← IslandProps, OeNcPageContext
│   │   ├── oeFetch.ts                     ← CSRF-aware AJAX wrapper
│   │   └── mountIsland.tsx                ← React mount helper
│   └── islands/
│       ├── visit-board/                   ← example production island
│       │   ├── index.tsx                  ← entry — calls mountIsland(...)
│       │   ├── VisitBoard.tsx             ← React component
│       │   └── ...
│       └── <next-island>/                 ← follow the same shape
```

Each island writes to:

```
interface/modules/custom_modules/<module>/public/assets/modern/<name>.js
```

CSS is co-located with the JS chunk; Twig pages reference matching `<name>.css` via
`asset_version` cache-busting. No `config/config.yaml` change is required — bundles
live under the module's `public/assets/modern/`.

---

## 3. Add a new island in five steps

### Step 1 — Create the source files

```
frontend/src/islands/my-island/
├── index.tsx
├── MyIsland.tsx
├── MyIsland.test.tsx
└── main.css
```

`MyIsland.tsx`:

```tsx
export interface MyIslandProps {
  patientId: number;
  label: string;
}

export function MyIsland({ patientId, label }: MyIslandProps) {
  return <section aria-label={label}>Patient {patientId}</section>;
}
```

`index.tsx`:

```tsx
import './main.css';
import { mountIsland } from '@core/mountIsland';
import { MyIsland } from './MyIsland';

mountIsland('my-island', MyIsland);
```

`main.css`:

```css
@import '../../core/tokens.css';
```

### Step 2 — Register the entry in `vite.config.ts`

Set `base: './'` in the Vite config root (not only under `build`). OpenEMR serves
islands from a deep module path (`…/oe-module-new-clinic/public/assets/modern/`),
so the default `base: '/'` breaks **lazy-loaded** chunks and shared CSS — the browser
requests `/assets/…` at the site root instead of next to the entry bundle. Static
entry imports still work; `React.lazy()` drawers (pharm-ops, pharmacy-desk) do not.

```ts
export default defineConfig({
  base: './',
  plugins: [react(), tailwind()],
  build: {
    rollupOptions: {
      input: {
        'visit-board': resolve(here, 'src/islands/visit-board/index.tsx'),
        'my-island':   resolve(here, 'src/islands/my-island/index.tsx'),
      },
    },
  },
});
```

### Step 3 — Wire the Twig page (product flag if optional hub)

Optional hubs (chart depth, bill ops, comms) use **product** flags such as
`enable_chart_depth` or `enable_report_hub`. Desk pages mount React
unconditionally (defaults ON); legacy jQuery desk JS was removed in w50react.

For a new optional surface, add to `sql/install.sql`:

```sql
#IfNotRow2D new_clinic_config facility_id 0 config_key enable_my_feature
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_my_feature', '0');
#EndIf
```

Register in `ClinicAdminService::EDITABLE_SETTINGS` and the Admin Hub field list.

### Step 4 — Mount in the Twig template

```twig
{% if enable_my_feature|default(false) %}
<div data-island="my-island"
     data-props="{{ {'patientId': pid, 'label': 'Demographics'}|json_encode|e('html_attr') }}"></div>
{% endif %}

{% block scripts %}
  …existing shell scripts…
  {% if enable_my_feature|default(false) %}
  <link rel="stylesheet" href="{{ assets_url }}/modern/my-island.css?v={{ asset_version }}">
  <script type="module" src="{{ assets_url }}/modern/my-island.js?v={{ asset_version }}"></script>
  {% endif %}
{% endblock %}
```

Pass context from the PHP entry point via `PageController::render…()`.

### Step 5 — Build, test, ship

```bash
cd frontend && npm run check && npm run build
```

Bump `ModuleAssetVersion::VERSION` once, hard-refresh the page, verify the island.
There is no legacy jQuery fallback path for New Clinic desks.

---

## 4. Fetching data

Use the shared `oeFetch<T>(action, options)` helper for every backend call.
It reads the page-level `ajax_url` + `csrf_token` from the existing
`#oe-nc-t1` shell, sets the right headers, and unwraps the
`{ success, data | error }` envelope.

```ts
import { oeFetch } from '@core/oeFetch';

interface VisitBoardPayload {
  visits: Array<{ id: number; state: string }>;
}

const board = await oeFetch<VisitBoardPayload>('visit.board');
```

TanStack Query may layer on top of `oeFetch` later for caching, polling, and retry.
Don't add ad hoc fetch wrappers per island.

---

## 5. Design system & token usage

This workspace is aligned with `design-system/openemr-2026/MASTER.md` and
`Documentation/NewClinic/NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md`.

### 5.1 Token vocabulary

All islands source visual values from `frontend/src/core/tokens.css`, which
exposes three parallel naming conventions so React islands and legacy Twig/SCSS
can share one token set without diverging:

| Use case | Variable form | Example |
|----------|--------------|---------|
| Island CSS (preferred) | `--oe-nc-*` (module convention) | `var(--oe-nc-primary)` |
| Spec quotation | `--color-*` (MASTER.md short-form) | `var(--color-cta)` |
| Tailwind CSS class | `--color-oe-*` (@theme alias) | `var(--color-oe-cta)` |

Core palette:

| Token | Value | Use |
|-------|-------|-----|
| `--oe-nc-primary` | `#0891b2` | Accents, selected borders, links |
| `--oe-nc-secondary` | `#22d3ee` | Hover, highlight |
| `--oe-nc-cta` | `#059669` | Confirm, success, active status dot |
| `--oe-nc-bg-tint` | `#ecfeff` | Subtle surface wash (cyan-50) |
| `--oe-nc-text` | `#164e63` | Body copy |
| `--oe-nc-text-muted` | `#475569` | Meta / secondary text |
| `--oe-nc-border` | `#e2e8f0` | Default border |
| `--oe-nc-radius` | `0.25rem` | Bootstrap 4 card radius |
| `--oe-nc-transition` | `150ms ease` | Respects `prefers-reduced-motion` |
| `--oe-nc-focus-ring` | `0 0 0 3px rgba(8,145,178,.35)` | Keyboard focus state |

Role accent colors: `--oe-nc-role-reception`, `--oe-nc-role-nurse`,
`--oe-nc-role-doctor`, `--oe-nc-role-lab`, `--oe-nc-role-pharmacy`,
`--oe-nc-role-cashier`, `--oe-nc-role-admin` — see §6 of the UI/UX plan.

**Anti-patterns:**

- ❌ Hardcoded hex values — always `var(--oe-nc-*)` so a theme change flows everywhere
- ❌ Arbitrary Tailwind color classes (`bg-emerald-50`, `text-teal-800`) — those are unrelated to the design system and lose to Bootstrap anyway
- ❌ Neon gradients, AI-purple styling, color-only status indicators (WCAG)
- ❌ Motion > 200ms or without `prefers-reduced-motion` guard

### 5.2 CSS cascade rule — required pattern for all islands

OpenEMR loads Bootstrap 4 as **unlayered CSS**. Tailwind 4 puts all utility
classes inside `@layer utilities { }`. Per the CSS cascade spec:

> **Unlayered styles always beat layered styles**, regardless of source order.

Tailwind utility classes lose to Bootstrap on every OpenEMR page.

**Required pattern — non-layered BEM CSS for component styles:**

```css
/* main.css — DO THIS */
@import '../../core/tokens.css';

/* Non-layered → beats Bootstrap by source order (our <link> loads last) */
.my-island-widget {
  background-color: var(--oe-nc-bg-tint);        /* #ecfeff */
  border: 1px solid rgba(8, 145, 178, 0.35);     /* --oe-nc-primary / 35% */
  color: var(--oe-nc-text);                       /* #164e63 */
  display: inline-flex;
  border-radius: var(--oe-nc-radius);
  transition: box-shadow var(--oe-nc-transition);
}

.my-island-widget--active .my-island-widget__dot {
  background-color: var(--oe-nc-cta);            /* #059669 */
}
```

**Never use Tailwind utilities for visual properties:**

```css
/* BROKEN — @layer utilities loses to Bootstrap */
.my-island-widget { @apply bg-emerald-50 border-emerald-500; }
```

### 5.3 Other conventions

- **TypeScript strict mode** is mandatory. No `any` without an inline
  comment justifying it.
- **No business logic in components.** Components render; services compute;
  PHP enforces ACL.
- **No `console.log`** in committed code.
- **Accessibility:** WCAG 2.1 AA minimum. `aria-label` on icon-only controls;
  44×44 px touch targets on primary actions; visible 3–4 px focus ring;
  `prefers-reduced-motion` guard on all animations.
- **Tests:** every island has a `*.test.tsx` covering the default render,
  at least one prop-driven branch, and key DOM structure.
- **Bundle size:** target < 200 KB gzip per island.
- **Regional formatting:** DD/MM/YYYY dates; clinic `currency_symbol` via M6;
  never hardcode `$` or US labels when `enable_insurance = false`.
- **No emojis as icons.** Font Awesome 6 in Twig shell chrome; Lucide React
  (`lucide-react`) in React islands when icons are needed.

---

## 6. New Clinic implementation status (June 2026)

| Layer | Stack |
|-------|--------|
| Page shell | PHP 8.2 + Twig 3 (`PageController`, `#oe-nc-t1` shell) |
| Desk / hub UI | **React 19 + TypeScript** — 16 Vite entries under `frontend/src/islands/` |
| Shared runtime | `mountIsland`, `oeFetch`, design tokens — `frontend/src/core/` |
| Module shell JS | `shell.js` + `ui-components.js` only (nav, queue stats, shared POST helpers) |
| Styles | Bootstrap 4.6 page chrome + island BEM CSS (`var(--oe-nc-*)`) + Tailwind 4 (build-time only) |
| Build | Vite 8 → `public/assets/modern/` |
| Tests | Vitest 4 (172 tests), PHPUnit New Clinic (349), Playwright E2E |

**OpenEMR-wide** shell migration (Knockout tabs → React shell) remains future work —
see [`FRONTEND_2026_MODERNIZATION_PLAN.md`](./NewClinic/FRONTEND_2026_MODERNIZATION_PLAN.md).

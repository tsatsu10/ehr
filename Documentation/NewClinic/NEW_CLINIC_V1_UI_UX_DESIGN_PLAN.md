# New Clinic V1 — UI/UX Design Plan

| Field | Value |
|-------|-------|
| **Document version** | 2.0.0 |
| **Status** | Active — full rewrite; trunk-test IA, single component contract, shadcn migration plan (2026-06-29) |
| **Supersedes** | v1.2.3 (additive Track B). v1.x history preserved in [§13](#13-document-history). |
| **Companion to** | [PRD](./NEW_CLINIC_V1_PRD.md) v1.20.50 · [PAGE_DESIGNS](./NEW_CLINIC_V1_PAGE_DESIGNS.md) v0.6.51 · [USER_WORKFLOWS](./NEW_CLINIC_V1_USER_WORKFLOWS.md) v1.9.50 · [FRONTEND_2026](./FRONTEND_2026_MODERNIZATION_PLAN.md) |
| **Audience** | Product · design · frontend · QA · clinical leads |
| **Purpose** | The single entry point for *how* New Clinic looks and behaves. Cross-cutting principles, the visual system, **one canonical shared-component reference**, the shadcn migration plan, and the quality bar new work must meet. Per-page wireframes stay in PAGE_DESIGNS. |

> Design skills applied: [refactoring-ui](https://www.refactoringui.com), Krug's [*Don't Make Me Think*](https://www.amazon.com/Dont-Make-Think-Revisited-Usability/dp/0321965515), Nielsen's [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/), Don Norman's [*Design of Everyday Things*](https://www.amazon.com/Design-Everyday-Things-Revised-Expanded/dp/0465050654), Dan Saffer's [*Microinteractions*](https://www.amazon.com/Microinteractions-Full-Color-Designing-Details/dp/1491945923), Jason Santa Maria's [*On Web Typography*](https://www.amazon.com/Web-Typography-Jason-Santa-Maria/dp/1937557065), Martin Fowler's [*Refactoring*](https://www.amazon.com/Refactoring-Improving-Existing-Addison-Wesley-Signature/dp/0134757599).

---

## 0. TL;DR — 60-second orientation

You're building or reviewing a New Clinic surface. Read this section, then jump to the section you need.

| Question | Answer |
|----------|--------|
| **What is New Clinic?** | A West-Africa-first outpatient clinic layer for OpenEMR. Cash-only V1. Role-based desks + a unified chart. |
| **What's the UI architecture?** | React 19 + TypeScript **islands** rendered into a PHP/Twig shell (`T1`). Stock OpenEMR is unchanged. |
| **What's the conceptual model?** | **Desk** (today's queue) → **Chart** (history) → **Depth** (money, letters, exports) → **Hub** (back-office). The T1 shell wraps all of them. |
| **What does a new shared component need?** | A **contract** ([§4.1](#41-component-contract-template)): props, states, accessibility, file path, shadcn target. |
| **What's the design quality bar?** | All seven skills above must score ≥8/10 ([§10.1](#101-scoring-rubric-per-skill)). |
| **What goes in V2?** | The shadcn migration plan ([§9](#9-shadcnui-migration-plan)) — a phased cutover, not a rewrite. |
| **Where do wireframes live?** | [PAGE_DESIGNS](./NEW_CLINIC_V1_PAGE_DESIGNS.md). This doc is principles + components. |
| **Conflict order** | PRD → PAGE_DESIGNS → feature redesign spec → **this plan**. |

**Krug trunk test pass criteria for this doc:** within 60 seconds a new reader can answer (a) where am I, (b) what's the conceptual model, (c) where do I find a component, (d) where do I find a wireframe, (e) what's the quality bar.

---

## 1. Architectural model

### 1.1 Conceptual model — `desk · chart · depth · hub · shell`

Norman: *the user's model should match the design model.* Five nouns describe every New Clinic surface, and every surface is exactly one of them.

```text
        ┌────────────────────────────────────────────────────────────┐
        │                       T1 SHELL                              │
        │  brand · role pill · ACL nav · queue stats · page heading   │
        └────────────────────────────────────────────────────────────┘
                  │              │              │             │
                  ▼              ▼              ▼             ▼
              ┌──────┐      ┌───────┐      ┌─────┐      ┌──────┐
              │ DESK │ ───▶ │ CHART │ ───▶ │DEPTH│      │ HUB  │
              └──────┘      └───────┘      └─────┘      └──────┘
              today's        history        money         back-office
              queue          (5 tabs)       letters       (list + lens)
              (M1–M9, M2)    (MRD)          exports       (COM, M10–M18)
                                            (slide-over)
```

| Surface | Purpose | Examples | Component cue |
|---------|---------|----------|---------------|
| **Shell** | Identity · navigation · ambient counters | `T1` top bar | server-rendered Twig + `shell.js` |
| **Desk** | Today's queue + role action | Front Desk, Triage, Doctor, Cashier, Lab, Pharmacy, Visit Board | `QueueCard` list |
| **Chart** | Full patient history | MRD `patient-chart` island (5 tabs) | `WidgetCard` + tabs |
| **Depth** | Money, letters, exports beyond the chart | Payment history, referrals, clinical export | `SlideOver` from chart strip |
| **Hub** | Back-office cohort work | COM, Registry, Admin, Bill Ops, Lab Ops | Split-pane `WidgetCard` |

**Rule:** if a feature doesn't fit into one of those five buckets, the IA is wrong — fix the IA before fixing the UI.

### 1.2 Document hierarchy

| Layer | Document | Wins on… |
|-------|----------|----------|
| Requirements | [PRD](./NEW_CLINIC_V1_PRD.md) | Modules, ACL, data model, feature flags, acceptance |
| Workflows | [USER_WORKFLOWS](./NEW_CLINIC_V1_USER_WORKFLOWS.md) | Who does what, in what order |
| **This plan** | UI/UX master | Principles, visual system, **component contracts**, IA, shadcn migration |
| Page build spec | [PAGE_DESIGNS](./NEW_CLINIC_V1_PAGE_DESIGNS.md) | Layout, wireframes, AJAX, per-page state, mobile, a11y |
| Feature depth | `*_REDESIGN.md` specs | Domain pain points, IA, closed decisions |
| Platform | [FRONTEND_2026](./FRONTEND_2026_MODERNIZATION_PLAN.md) | OpenEMR-wide shell migration (Phase 3+) |
| Design tokens | [`design-system/openemr-2026/MASTER.md`](../../design-system/openemr-2026/MASTER.md) | Colors, type, spacing — implemented in `frontend/src/core/tokens.css` |

**Conflict resolution:** PRD → PAGE_DESIGNS → feature redesign spec → this plan.
**Wireframe format:** ASCII boxes + Mermaid. No pixel-perfect Figma mocks in V1 docs.

### 1.3 Implementation snapshot (June 2026)

**Code baseline:** `interface/modules/custom_modules/oe-module-new-clinic/` · build `frontend/` → `public/assets/modern/` · asset version in `ModuleAssetVersion::VERSION`.

#### 1.3.1 Vite island entries (16, all shipped)

| Island key | React entry | PHP route | Twig mount |
|------------|-------------|-----------|------------|
| `front-desk` | `islands/front-desk/` | `public/front-desk.php` | `templates/front-desk.html.twig` |
| `visit-board` | `islands/visit-board/` | `public/visit-board.php` | `templates/visit-board.html.twig` |
| `triage-desk` | `islands/triage-desk/` | `public/triage.php` | `templates/triage.html.twig` |
| `doctor-desk` | `islands/doctor-desk/` | `public/doctor.php` | `templates/doctor.html.twig` |
| `cashier-desk` | `islands/cashier-desk/` | `public/cashier.php` | `templates/cashier.html.twig` |
| `lab-desk` | `islands/lab-desk/` | `public/lab.php` | `templates/lab.html.twig` |
| `pharmacy-desk` | `islands/pharmacy-desk/` | `public/pharmacy.php` | `templates/pharmacy.html.twig` |
| `daily-reports` | `islands/daily-reports/` | `public/reports.php` | `templates/reports.html.twig` |
| `admin-hub` | `islands/admin-hub/` | `public/admin.php` | `templates/admin.html.twig` |
| `communications-hub` | `islands/communications-hub/` | `public/communications.php` | `templates/communications.html.twig` |
| `patient-registry` | `islands/patient-registry/` | `public/patient-registry.php` | `templates/patient-registry.html.twig` |
| `patient-chart` | `islands/patient-chart/` | `public/patient-chart.php` | `templates/patient-chart.html.twig` |
| `chart-depth` | `islands/chart-depth/` | `public/chart-depth/*.php` | `templates/chart-depth/*.html.twig` |
| `lab-ops` | `islands/lab-ops/` | `public/lab-ops/index.php` | `templates/lab-ops/index.html.twig` |
| `bill-ops` | `islands/bill-ops/` | `public/bill-ops/index.php` | `templates/bill-ops/index.html.twig` |
| `bill-ops-correct` | `islands/bill-ops/index-correct.tsx` | `public/bill-ops/correct.php` | `templates/bill-ops/correct.html.twig` |

**Not yet an island:** S1 Scheduling, M13 Pharm Ops Hub (separate from M9 desk), M16 Reporting Hub, M17 Clinical Doc Hub, M18 Queue Bridge.

#### 1.3.2 Stack — what runs where

| Layer | New Clinic module | Core OpenEMR (unchanged) |
|-------|-------------------|--------------------------|
| App shell | T1 PHP/Twig (`PageController`, `#oe-nc-t1`) | Knockout + iframe tabs |
| Desk / hub UI | **React 19 + TypeScript** (Vite islands) | jQuery / Knockout view models |
| CSS | Bootstrap 4.6 page chrome + island BEM (`--oe-nc-*`) + Tailwind 4 tokens | Bootstrap 4.6 + Gulp themes |
| Module JS | `shell.js` + `ui-components.js` (nav, queue stats only) | ~137 interface JS files |
| Data | `oeFetch` → `public/ajax.php` (session + CSRF) | Mixed jQuery POST / iframe |
| Build | `frontend/` → `public/assets/modern/` (16 Vite entries) | Gulp 4 |
| Tests | Vitest + Playwright E2E | Jest (minimal) |

**Rule:** New Clinic pages must not call `dynamic_finder.php` or embed stock Knockout iframe chrome when the module is active (PRD §5.2). React is the **only** UI implementation for module desks — no jQuery fallback.

#### 1.3.3 Status legend (used throughout §6 module map)

| Status | Meaning |
|--------|---------|
| **Shipped** | React island wired; usable when module + role ACL allow |
| **Shipped (flag)** | Island built; requires product flag (e.g. `communications_hub_enable`) |
| **Polish** | Shipped; quality bar gap noted in [§10.2](#102-quality-bar-for-new-components) |
| **Not started** | No module UI — stock OpenEMR or spec only |

---

## 2. Design principles

Seven principles, each backed by a skill and (where applicable) external research. **Every PR is reviewed against these.**

### 2.1 Safety & identity (clinical-first)

> *Skill: design-everyday-things (constraints, feedback) + Nielsen #5 (error prevention) + Nielsen #9 (error recovery).*
> *Evidence:* AHRQ-funded research ([Adelman 2017 patient-photo RCT](https://digital.ahrq.gov/sites/default/files/docs/citation/r01hs024713-adelman-final-report-2023.pdf), [Sopan/Plaisant/Shneiderman 2014 wrong-patient catalog](https://pmc.ncbi.nlm.nih.gov/articles/PMC4420010/)) shows patient photo + row highlighting *significantly reduces* wrong-patient orders. The Epic Storyboard pattern (persistent header) is the production analogue.

| Principle | Application |
|-----------|-------------|
| **Identity anchor** | `PatientContextBanner` (T1-F17) is **mandatory** on every patient-scoped surface; MRD Zone A on full chart |
| **Wrong-patient prevention** | `IdentityConfirmBanner` repeats Patient · MRN · Visit # · Receipt # inside G12 confirm modals; full reload on `pid` change — no silent swap |
| **Shared device** | Active-role pill (T1); T1-F19 session warning; T1-F18 desk return link on legacy pages |
| **Safety above fold** | Allergies visible without scroll ≥360px (MRD-G1); severe allergy chips never color-only |
| **Destructive confirm** | No silent deletes; reason required on overrides (completion, e-sign, billing, queue bridge dismiss) |

### 2.2 Performance & connectivity (West Africa pilot)

> *Skill: design-everyday-things (feedback timing) + Nielsen #1 (visibility of system status).*
> *Evidence:* [Simple.org on offline-first clinical apps](https://www.simple.org/blog/offline-first-apps/), [NextBillion last-mile digital health](https://nextbillion.net/designing-digital-health-tools-for-last-mile-lessons-for-maximizing-connectivity-usability-trust/).

| Principle | Application |
|-----------|-------------|
| **Server shell first byte** | T1 chrome server-rendered — no AJAX flash for page chrome |
| **AJAX in place** | List read / compose / update without full reload; standard JSON envelope (PAGE_DESIGNS §6) |
| **Optimistic where safe** | Triage vitals save optimistically; cashier writes do **not** (cash truth) |
| **Visible offline state** | Offline banner; writes disabled after >60s without server contact |
| **Async export** | Long reports return a download link (no blocked UI); polled every 5s |
| **Print-first where paper wins** | Receipts, referrals, Rx packs, queue slips — A4 / 80mm thermal |

### 2.3 Cognitive load — *Don't Make Me Think*

> *Skill: ux-heuristics (Krug's three laws + Trunk Test).*

| Principle | Application |
|-----------|-------------|
| **Task over tool** | Label by staff intent ("Payment history", "Referral letter") — not stock menu names |
| **One front door per domain** | Hub pattern: COM, M10/M12/M14/M15/M16/M17/M18 — stock menus hidden when flag ON |
| **Progressive disclosure** | Summary strip → depth panel; 6–8 hub cards; Advanced (OpenEMR) behind ⚠ banner |
| **Tabs over infinite scroll** | MRD 5-tab IA; desks for queue work; no scroll-the-whole-chart timeline (D-MRD-8) |
| **Recognition not recall** | Combobox dropdowns over free-text where the option set is bounded (provider, queue state, service profile) |
| **Trunk test everywhere** | Every page must answer: where am I, what's the patient, what can I do next |

### 2.4 Affordances & feedback — bridging Norman's gulfs

> *Skill: design-everyday-things (the two gulfs, the seven stages of action).*

| Gulf | Bridge | Application |
|------|--------|-------------|
| **Execution** ("how do I do this?") | Signifiers, mappings, constraints | Buttons look pressable (raised + color); destructive actions separated from routine; reason textarea on overrides |
| **Evaluation** ("did it work?") | Immediate visible feedback, system state, error messages | Saves show ≤100ms button-state change → ≤1s confirmation toast; errors are inline with the field; queue counters refresh every 30s with `aria-live` |

**Seven stages walkthrough** — apply to every new flow (goal → plan → specify → perform → perceive → interpret → compare). Find the stage where users stall, then add a signifier, constraint, or feedback at that point.

### 2.5 Microinteraction quality bar (Saffer)

> *Skill: microinteractions (trigger / rules / feedback / loops & modes).*

Every shared component must define all four:

| Element | Definition | Example (`ConfirmModal`) |
|---------|------------|---------------------------|
| **Trigger** | Manual or system event that opens it | Manual: cashier presses "Confirm payment" |
| **Rules** | What runs, constraints, edge cases | Reason required on overrides; `confirmDisabled` until valid |
| **Feedback** | Immediate visible response | Button → "Saving…"; success toast; error in body |
| **Loops & Modes** | Long-term behavior + alternate states | None for V1 (single-use); future: remember last cashier discount reason |

**Anti-patterns:** invisible triggers without a visible alternative; fake progress bars; same control with different behavior in different modes (no mode → make modes visible).

### 2.6 Access & inclusion

> *Skill: ux-heuristics (Nielsen #2 real-world language, #7 efficiency).*

| Principle | Application |
|-----------|-------------|
| **WCAG 2.1 AA** | Target for all New Clinic surfaces (PRD T1-F08; PAGE_DESIGNS §9) |
| **Status = shape + label + color** | Never color alone (scheduling, queue, allergies, visit state) |
| **44×44px touch targets** | Primary CTAs; sticky bottom actions on `sm`/`xs` |
| **Keyboard** | ↑/↓/Enter/Esc on search; skip links; visible 3–4px focus rings |
| **Mobile-realistic** | Usable at `sm` (481–767px); focus pages at `xs` (Triage, Cashier, Visit Board) |
| **Owner language** | "Reception desk" not `new_reception`; plain English training copy |
| **Cash truth** | Hide insurance UI when `enable_insurance = false`; no "Insurance pending" labels |

### 2.7 Anti-patterns (all modules)

- Neon gradients · "AI purple" styling · motion-heavy animations
- Color-only status · icon-only actions without `aria-label`
- Decorative dashboards without visit context — every surface must anchor on **patient** or **today's queue** (clinical safety)
- Hover-only information on mobile
- Hidden destructive actions (delete in an overflow menu without confirm)

---

## 3. Visual design system

Tokens align with [design-system/openemr-2026/MASTER.md](../../design-system/openemr-2026/MASTER.md) and [COM §15](./done/NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md#15-visual-design-system). Implemented in `frontend/src/core/tokens.css`.

### 3.1 Color tokens

| Role | Hex | CSS var | Use | WCAG-AA at body size |
|------|-----|---------|-----|----------------------|
| Primary | `#0891B2` | `--oe-primary` | Selected state, links, accent borders | 4.85:1 on white |
| Secondary | `#22D3EE` | `--oe-secondary` | Hover wash, focus halo | — (not for text) |
| Success / CTA | `#059669` | `--oe-cta` | Confirm, send, complete | 4.66:1 on white |
| Background tint | `#ECFEFF` | `--oe-bg` | Subtle page wash, card hover | — (not for text) |
| Text | `#164E63` | `--oe-text` | Body copy | 11.95:1 on white |
| Danger | `var(--danger)` | Bootstrap `--danger` | Delete, overdue, unsigned | 4.5:1+ required |
| Warning | `var(--orange)` | Bootstrap `--orange` | Today reminders, URGENT | 4.5:1+ required |

**Anti-pattern:** wrapping the same value through `var(var(--x))` indirection. Use the token directly.

### 3.2 Typography scale

> *Skill: web-typography — "clear goblet" principle. Type for body must serve sustained reading; type for moments (CTAs, KPIs) serves impact.*

Two faces, **one workhorse pair**: **Figtree** (heads) + **Noto Sans** (body, i18n-safe). System stack as fallback (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).

| Role | Size | Weight | Line height | Tracking | Use |
|------|------|--------|-------------|----------|-----|
| Display | `1.875rem` / 30px | 600 | 1.2 | -0.01em | Page headings, modal titles |
| H1 | `1.5rem` / 24px | 600 | 1.25 | -0.005em | Section titles, hub lens names |
| H2 | `1.25rem` / 20px | 600 | 1.3 | 0 | Card titles, MRD zone titles |
| H3 | `1.125rem` / 18px | 600 | 1.35 | 0 | Sub-section, list group title |
| Body | `1rem` / 16px | 400 | 1.5 | 0 | All prose, table cells |
| Body-strong | `1rem` / 16px | 600 | 1.5 | 0 | KPI labels, table headers when not uppercase-small |
| Small | `0.875rem` / 14px | 400 | 1.45 | 0 | Captions, helper text, meta |
| Micro / uppercase | `0.75rem` / 12px | 600 | 1.4 | 0.05em | Form labels, table-header style, status pill text |
| KPI value | `2rem` / 32px | 700 | 1 | -0.02em | `StatCard` big number |
| Mono | `0.875rem` / 14px | 400 | 1.4 | 0 | MRN, IDs, codes (use `font-feature-settings: "tnum"`) |

**Line length:** prose `max-width: 65ch`; modal body `max-width: 480px`; never full-width text.
**Mobile:** body bumps to 17px on `sm` to compensate for hand-distance.
**Performance:** WOFF2 only, `font-display: swap`, Latin subset (West Africa pilot).

### 3.3 Spacing scale

| Token | Value | When |
|-------|-------|------|
| `--space-xs` | 4px | Icon ↔ label inside a chip |
| `--space-sm` | 8px | Form control inner pad, tight grid gap |
| `--space-md` | 16px | Card body pad, default block margin |
| `--space-lg` | 24px | Card header → body, section padding |
| `--space-xl` | 32px | Adjacent card gap on hub split |
| `--space-2xl` | 48px | Page heading → first section |
| `--space-3xl` | 64px | Empty-state vertical centering |

**Rule:** between groups > within groups. Tight pairing (icon + label) gets `xs`; section separation gets `lg`+. If you're using a number that isn't on this scale, it's a bug.

### 3.4 Elevation & radius

| Token | Value | When |
|-------|-------|------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift on hover (`QueueCard`) |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Default `WidgetCard` |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | `SlideOver`, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Reserved (rarely used in clinical UI) |
| Radius | `0.25rem` (4px) for Bootstrap parity; `0.5rem` (8px) for new cards | Match Bootstrap 4 cards on legacy surfaces; new shared components may opt-in to 8px |

**Anti-pattern:** more than one shadow level on the same screen. Pick `sm` or `md`, not both.

### 3.5 Motion

| Token | Value | When |
|-------|-------|------|
| `--motion-fast` | 100ms ease-out | State changes (`Button:active`, chip selection) |
| `--motion-base` | 150ms ease | Hover transitions, accordion open |
| `--motion-slow` | 200ms ease | `SlideOver` enter, drawer open |
| `--motion-modal` | 250ms cubic-bezier(0.16, 1, 0.3, 1) | `Dialog` overlay fade |

`prefers-reduced-motion` **must** disable all non-essential motion (only keep state-change feedback).

### 3.6 Iconography

| Surface | Choice | Why |
|---------|--------|-----|
| T1 shell + legacy Twig | Font Awesome 6 | Already loaded; consistency with core OpenEMR |
| New React islands | Lucide React (optional) | Consistent 24×24 SVG, modern stroke; opt-in per island |
| Always | **No emoji as icons** | Cross-platform rendering inconsistent; harms `aria-label` |
| Sizing | 16px in chips, 20px in buttons, 24px in headers | Match line-height of adjacent text |

### 3.7 Regional formatting

- Clinic `currency_symbol` via M6 (D-REG-3) — never hardcode `$`
- Dates **DD/MM/YYYY** (West Africa convention)
- Phone local `0XX` format
- Numbers: `Intl.NumberFormat('en-GH')` for thousands separators

---

## 4. Shared component reference — single source of truth

> *Skill: refactoring-patterns — eliminating duplication.* Previous v1.x splits (§2.1 inventory / §5 catalog / §14 premium) are consolidated here. Each row has the same five fields so reviewers can grep them.

### 4.1 Component contract template

Every shared component (`frontend/src/components/<Component>.tsx`) MUST publish:

| Field | What it answers |
|-------|-----------------|
| **Purpose** | One sentence — the user problem it solves |
| **Props** | TypeScript interface with required/optional + variants |
| **States** | All of: `idle`, `hover`, `focus-visible`, `pressed`, `loading`, `success`, `error`, `disabled`, `empty` (omit only with rationale) |
| **A11y** | Roles, `aria-*`, keyboard map, focus management |
| **Microinteraction** | Trigger · rules · feedback · loops/modes ([§2.5](#25-microinteraction-quality-bar-saffer)) |
| **Files** | Component, test, CSS, used-by list |
| **shadcn target** | Which shadcn primitive replaces this in Phase 3 ([§9](#9-shadcnui-migration-plan)) |

A component with no contract section in its file header doesn't pass code review.

### 4.2 Identity & safety

| Component | Files | Purpose | shadcn target |
|-----------|-------|---------|---------------|
| `PatientContextBanner` | `components/PatientContextBanner.tsx` + `CompletionBar.tsx`, `CompletionScorePill.tsx`, `ChipCloud.tsx`, `patientBannerUtils.ts` | Tier-1/2/3 patient identity strip. Mandatory on every patient-scoped surface. | `Card` + `Avatar` + `Badge` |
| `IdentityConfirmBanner` | `components/ConfirmModal.tsx` | Repeats Patient · MRN · Visit # · Receipt # inside confirm modals (AHRQ wrong-patient mitigation) | Inline `Card` inside `Dialog` |
| `DeskInterruptBanner` | `components/DeskInterruptBanner.tsx` | Single high-priority notice above a desk queue | `Alert` (variant=warning) |
| `DeskSharedDeviceBanner` | `components/DeskSharedDeviceBanner.tsx` | T1-F19 shared-device warning | `Alert` (variant=info) |

**Tier definition** (replaces v1.x §5.1):

| Tier | Fields | When |
|------|--------|------|
| **1** | Photo/initials · name · sex · age · MRN | Preview pane, compact hosts |
| **2** | Tier 1 + allergies (max 3) + completion % | Active visit panels |
| **3** | Tier 2 + visit state chip + queue # + primary action | Active visit on desks |

Legacy overlay tiers (L0–L3) for stock chart pages: [LEGACY_CHART_CONTEXT §5.1](./done/NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md#51-strip-tier-definition-normative).

### 4.3 Queue & flow

| Component | Files | Purpose | shadcn target |
|-----------|-------|---------|---------------|
| `QueueCard` | `components/QueueCard.tsx` + `WaitTimeSpan.tsx` | Card-shaped row for a single visit in a desk queue | `Card` (custom composition) |
| `WaitTimeSpan` | `components/WaitTimeSpan.tsx` | Shared wait-time label with `long`/`medium` CSS classes — **see workspace rule** | inline `span` (no shadcn equivalent) |
| `StatusPill` | `components/StatusPill.tsx` | FSM / appointment / allergy state pill | `Badge` (variant per state) |
| `SegmentedControl` | `components/SegmentedControl.tsx` | "All (134) · Urgent (12)" tab filter | `ToggleGroup` |
| `RoutingChips` | `components/RoutingChips.tsx` | Doctor / banner metadata as a row of pills | `Badge` row |

**Wait-time rule (workspace-level):** any change to wait-time rendering must be applied to **all** desks + the shared component in one pass — see `.cursor/rules/new-clinic-big-picture-first.mdc`.

### 4.4 Data display

| Component | Files | Purpose | shadcn target |
|-----------|-------|---------|---------------|
| `WidgetCard` | `components/WidgetCard.tsx` | Card shell with header + actions + padded/flush body | `Card` |
| `DataTable` + `DataTableStatusRow` | `components/DataTable.tsx` | Wrapper around Bootstrap `table-sm` with status-row helper | shadcn `Table` + TanStack Table |
| `RowActionsMenu` | `components/RowActionsMenu.tsx` | ⋮ row dropdown for tables | `DropdownMenu` |
| `PaginationBar` | `components/PaginationBar.tsx` | Prev/next + page numbers + size select | `Pagination` |

### 4.5 Insights (M7 daily reports + KPI surfaces)

| Component | Files | Purpose | shadcn target |
|-----------|-------|---------|---------------|
| `StatCard` | `components/StatCard.tsx` | Label · value · optional trend pill | `Card` + custom value layout (21st.dev `StatsCard` pattern) |
| `TrendPill` | `components/TrendPill.tsx` | ↑12% / ↓3% directional indicator | `Badge` |
| `CompletionBar` | `components/CompletionBar.tsx` | Profile completion progress | `Progress` |
| `CompletionScorePill` | `components/CompletionScorePill.tsx` | Score + threshold label | `Badge` |
| `ChipCloud` | `components/ChipCloud.tsx` | "N more" overflow chip row (allergies, problems) | `Badge` group |

### 4.6 Overlays

| Component | Files | Purpose | shadcn target |
|-----------|-------|---------|---------------|
| `ConfirmModal` + `IdentityConfirmBanner` | `components/ConfirmModal.tsx` | G12 family confirm shell with variant buttons + identity strip | `Dialog` (variants via `cn()`) |
| `SlideOver` | `components/SlideOver.tsx` | Right drawer ≥768px / full-screen ≤767px | `Sheet` |
| `FindPatientDrawer` | `components/FindPatientDrawer.tsx` | Triage / lab / bill ops shared patient picker drawer | `Sheet` + `Command` |
| `EsignOverrideModal` | `components/EsignOverrideModal.tsx` | Doctor unsigned + cashier-override flow | `Dialog` |
| `SkipToPaymentModal` | `components/SkipToPaymentModal.tsx` | Lab / pharmacy skip with reason | `Dialog` |
| `useModalDismiss` | `components/useModalDismiss.tsx` | Shared ESC + backdrop hook | replaced by Radix `onOpenChange` |

### 4.7 Search & input

| Component | Files | Purpose | shadcn target |
|-----------|-------|---------|---------------|
| `PatientSearchDropdown` | `components/PatientSearchDropdown.tsx` | M1a debounced (250ms) search, top 8 displayed / 25 scored | `Command` (cmdk) |
| `PatientSearchWidget` | `islands/front-desk/PatientSearchWidget.tsx` | Front Desk hero search + idle lists | `Command` + island CSS |
| `DeskStatusBar` | `islands/front-desk/DeskStatusBar.tsx` | Front Desk operational strip (waiting · started · scheduled) | `DeskQueueStatusBar` |
| `DeskQueueStatusBar` | `components/DeskQueueStatusBar.tsx` | Shared one-line queue stats + refresh for all queue desks (Triage, Doctor, Lab, Pharmacy, Cashier, Visit Board) | custom BEM |
| `RecentlyViewed` | `islands/front-desk/RecentlyViewed.tsx` | Last 5 patients pill row — synced per user via `front_desk.recently_viewed` (localStorage fallback) | custom BEM |
| `TodaysAppointmentsList` | `islands/front-desk/TodaysAppointmentsList.tsx` | Today's schedule in search idle state (`front_desk.todays_appointments`) | custom BEM |

**M1a Front Desk layout (2026-06-29)** — search-first operational pattern (not dashboard KPI cards):

| State | Layout |
|-------|--------|
| **Idle** | Centered single column (~680px): `DeskStatusBar` + hero `PatientSearchWidget` with `RecentlyViewed` pills and `TodaysAppointmentsList` when scheduling is on. No empty preview pane on desktop. |
| **Patient selected** | Workspace expands (~1080px; ~1180px when sidebar collapsed): equal `1fr 1fr` grid — search (sticky) \| preview. Preview pane scrolls; **Start Visit** footer sticks to bottom. |
| **Shell** | `oe-nc-t1--desk-focus` hides duplicate PHP `h1`; island owns chrome. Width/centering in `shell.css` + `front-desk/main.css`. |
| **Keyboard** | `/` focuses search from anywhere on the page. |

Primary palette shifted to neutral dashboard (`#2563eb` primary, `#f9fafb` bg) per MedTrackr-inspired polish pass.

### 4.8 Status legend (used in §4 tables)

A shipped component above means the React file exists and is wired into ≥1 island. **🔶 Polish** means the BEM CSS still lives in the island; promotion to `frontend/src/components/` is queued for Track B.

### 4.9 Components to build (P2, V1.1)

| Component | Purpose | Blocked surfaces | shadcn target |
|-----------|---------|------------------|---------------|
| `chart-line` | Chart.js wrapper with reference ranges, accessible tooltip table, colorblind-safe palette | MRD vitals · M7 trends · M16 reporting hub | `Chart` (Recharts wrapper) |
| `date-range-picker` | Presets (Today / 7d / 30d / custom) + DD/MM/YYYY | M7 date range · S1 filter bar · M16 reports | `DatePicker` (Calendar) |
| `med-schedule-timeline` | Week strip + dose chips (adherence display only — **not** prescribing in V1) | MRD meds tab · eRx list | custom (no direct shadcn) |
| `FilterBar` | URL-synced filter chip row | S1 · M10 · M16 | composed of `Badge` + `Combobox` |
| `BottomSheet` | Mobile action sheet (`xs`/`sm`) | MRD Zone D mobile actions | `Drawer` (Vaul) |
| `Skeleton` row/card | AJAX loading placeholder | Every AJAX tab | `Skeleton` |

**Deliberately not shared in V1** (intentional decisions, not gaps):

| Reference component | Why skipped |
|---------------------|-------------|
| Left sidebar navigation | T1 horizontal top nav — better for role switching on shared tablets |
| Chatbot / AI assistant | PRD non-goal in V1 |
| Decorative dashboard widgets without visit context | Every surface must anchor on patient or today's queue (clinical safety) |
| Inventory sidebar item | Pharmacy stock is M13 hub, not global nav |

---

## 5. Interaction state taxonomy

> *Skill: microinteractions. Every shared component declares its state set so QA can audit it.*

### 5.1 Universal states (per component)

| State | When | Visual cue | A11y |
|-------|------|------------|------|
| `idle` | Resting | Default token colors | — |
| `hover` | Mouse over | `--shadow-sm` lift or background wash; ≥150ms | — |
| `focus-visible` | Keyboard focus | 3–4px ring `--oe-primary` at 40% alpha | `:focus-visible` only — never on mouse click |
| `pressed` | Mouse/key down | Slight darken + 1px translate; `--motion-fast` | — |
| `loading` | Async work in flight | Inline spinner; button text → "Saving…"; `aria-busy="true"` on container | `aria-live="polite"` for status text |
| `success` | Operation completed | Brief checkmark; toast on bigger ops | `aria-live="polite"` |
| `error` | Operation failed | Inline error message near the source; **never** silent | `aria-live="assertive"` for blocking errors |
| `disabled` | Action not currently available | Reduced opacity + `cursor: not-allowed`; tooltip explaining *why* (Norman: constraint must be visible) | `aria-disabled="true"`; not `disabled` if you want focus + tooltip |
| `empty` | No data | Empty-state shell with action ([§4.7](#47-search--input)) | — |

### 5.2 Pattern-specific micro-rules

| Pattern | Trigger | Rules | Feedback | Loops & Modes |
|---------|---------|-------|----------|---------------|
| **Confirm modal** (G12) | Manual ("Confirm payment") | Reason required on overrides; `confirmDisabled` until valid | Button → "Saving…"; success closes + toast; error shows in body | None (single-use) |
| **Slide-over** | Manual (chart strip "View full") | Focus moves into drawer; backdrop click to close (with confirm if dirty form) | 200ms slide-in; ESC closes; focus returns to trigger | None |
| **AJAX list refresh** | System (30s timer + manual ↻) | Pause while user interacts (no flicker); resume on idle | Spinner in heading; `aria-live` update | Open loop; pause on `tab` blur |
| **Patient search** | Manual (typing) | 250ms debounce; top 8 displayed / 25 scored; arrow keys; **idle state** shows today's appointments + recently viewed (M1a) | Highlight match; "No results" empty state | None |
| **Toast** | System (after action) | Auto-dismiss success 4s; sticky for errors | Top-right of T1; max 1 visible | None |
| **Allergy chip** | Manual (hover/tap) | Severity color border (never color-only); `aria-label` includes severity | Tooltip with note on hover; full detail in `SlideOver` | None |

---

## 6. Information architecture

Wireframes for every page live in [PAGE_DESIGNS](./NEW_CLINIC_V1_PAGE_DESIGNS.md). This section is the **map**.

### 6.1 T1 shell & navigation

Full wireframes: [PAGE_DESIGNS §2](./NEW_CLINIC_V1_PAGE_DESIGNS.md#2-top-bar-and-shell-t1).

| Region | Content |
|--------|---------|
| Brand strip | Clinic logo · name · facility |
| Active-role pill | First name — role label · Switch role · Logout |
| Module nav | ACL-filtered desk tabs; active tab highlighted with pill background + 2px bottom border |
| Queue stats | Live FSM counts; 30s refresh; `aria-live` |
| Page heading | Title · Refresh · contextual CTA |

**Role accent colors:** Reception teal · Nurse blue · Doctor green · Lab amber · Pharmacy purple · Cashier orange · Admin grey.
**Breakpoints:** Full strip ≥992px · hamburger ≤767px · role pill initials only ≤480px.

### 6.2 Desk pattern (today's queue)

```text
T1 SHELL ─────────────────────────────────────────────
DESK HEADING (Triage · Doctor · Cashier · Lab · Pharm)
┌─────────────────────────────────┬──────────────────┐
│ QUEUE LIST                       │ PATIENT PREVIEW │
│   [QueueCard] [QueueCard] …      │ [Banner Tier 2] │
│   SegmentedControl: All / Urgent │ [DeskActions]   │
└─────────────────────────────────┴──────────────────┘
```

### 6.3 Chart pattern (MRD 5-tab)

```text
[PatientContextBanner Tier 1]
[Tabs: Overview · Profile · Visits · Clinical · Messages]
[WidgetCard tab content]
```

### 6.4 Chart depth pattern (slide-over)

```text
MRD tab content
  └─ Summary strip ("Last payment ₵120 · View payment history")
       └─ [ View full history ] → Chart Depth panel
            ├─ Desktop (≥768px): SlideOver 480–720px
            └─ Mobile (<768px):  full-screen sheet + sticky Close
```

Normative: [CHART_DEPTH §5.2](./done/NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md#52-interaction-patterns-normative).

### 6.5 Hub pattern (list + lens)

```text
[Hub heading + filters]
┌────────────────┬──────────────────────────────────┐
│ ITEM LIST      │ LENS DETAIL                       │
│ [WidgetCard]   │ [WidgetCard with full detail]    │
│ [WidgetCard]   │                                   │
└────────────────┴──────────────────────────────────┘
```

### 6.6 Module → UI map

#### 6.6.1 V1 pilot — role desks & core

| Module | Redesign spec | PAGE_DESIGNS | Status | Surface | Pattern |
|--------|---------------|--------------|--------|---------|---------|
| **T1** Shell | — | §2, §4 | **Shipped** · Polish | Shell | Twig + `shell.js`; hamburger drawer polish pending |
| **M1a** Front Desk search | [FRONT_DESK_SEARCH](./done/NEW_CLINIC_V1_FRONT_DESK_SEARCH_REDESIGN.md) v1.0.8 | §4.1, §7.2 | **Shipped** · Polish | Desk | Search-first · idle appointments · split on select |
| **M1b** Registration form | [FRONT_DESK_REGISTRATION](./done/NEW_CLINIC_V1_FRONT_DESK_REGISTRATION_REDESIGN.md) v1.0.0 | §4.1.3, §7.2.7 | **Shipped** | Desk | 4-section accordion |
| **M2** Visit Board | PRD §8 | §7.8 | **Shipped** | Desk | Kanban columns + wall profile |
| **M3** Triage | PRD §8 | §7.3 | **Shipped** | Desk | Vitals steppers on mobile |
| **M4** Doctor Desk | PRD §8 | §7.4 | **Shipped** · Polish | Desk | Consult queue + shortcuts |
| **M5** Cashier | PRD §8 | §7.7 | **Shipped** | Desk | Payment confirm modal (G12) |
| **M6** Clinic Admin | [ADMIN](./done/NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md) v0.1.4 | §7.9 | **Shipped** | Hub | `admin-hub` island embeds M6 cards |
| **M7** Daily Reports | [REPORTING](./done/NEW_CLINIC_V1_REPORTING_OPERATIONS_REDESIGN.md) v0.1.3 | §7.10 | **Shipped** | Hub-lite | Today-first KPI sections |
| **M8** Lab Desk | [LAB_OPS](./done/NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md) v0.1.9 | §7.5 | **Shipped (flag)** | Desk | Visit queue + M12 slide-over link |
| **M9** Pharmacy Desk | [PHARM_OPS](./done/NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md) v0.1.9 | §7.6 | **Shipped (flag)** | Desk | Visit queue + undispensed gate |
| **COM** Communications | [COM](./done/NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md) v1.0.3 | §7.12 | **Shipped (flag)** | Hub | Split-pane Messages / Reminders |
| **MRD** Medical record | [MRD](./MEDICAL_RECORD_DASHBOARD_REDESIGN.md) v0.2.36 | §4.11, MRD spec | **Shipped** · Polish | Chart | `patient-chart` island — 5-tab IA |
| **S1** Scheduling | [SCHEDULING](./done/NEW_CLINIC_V1_SCHEDULING_REDESIGN.md) v0.2.6 | §7.11 | **Not started** | Desk | Legacy calendar / tracker |

#### 6.6.2 Post-pilot hubs & chart depth

| Module | Redesign spec | Slice | Status | Pattern |
|--------|---------------|-------|--------|---------|
| **M10** Patient Registry | [REGISTRY](./done/NEW_CLINIC_V1_PATIENT_REGISTRY_REDESIGN.md) v0.2.1 | V1.1-REG | **Shipped (flag)** | Hub: filter + cohort table |
| **M11** Chart Depth | [CHART_DEPTH](./done/NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md) v0.1.15 | V1.1-CDa/b/c | **Shipped (flag)** | Depth: SlideOver from MRD strips |
| — Payment history | [PAYMENT_HISTORY](./done/NEW_CLINIC_V1_PATIENT_PAYMENT_HISTORY_REDESIGN.md) | V1.1-CDa | **Shipped (flag)** | `chart-depth` payments mode |
| — Referrals & letters | [REFERRALS](./NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md) v0.1.2 | V1.1-CDb | **Shipped (flag)** | Wizard + print confirm |
| — Clinical export | [CLINICAL_EXPORT](./done/NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md) | V1.1-CDc | **Shipped (flag)** | Preset builder + confirm |
| **M12** Lab Ops Hub | [LAB_OPS](./done/NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md) | V1.1-LAB | **Shipped (flag)** | Hub: worklist + result slide-over |
| **M13** Pharm Ops Hub | [PHARM_OPS](./done/NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md) | V1.1-PHARM | **Not started** | Hub: dispense worklist |
| **M14** Billing back office | [BILLING](./done/NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md) v0.1.3 | V1.2-BILL | **Shipped (flag)** | Hub: corrections · payments · close day |
| **M15** Admin hub | [ADMIN](./done/NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md) | V1.1-ADMIN | **Shipped (flag)** | Hub: lens shell embedding M6 |
| **M16** Reporting hub | [REPORTING](./done/NEW_CLINIC_V1_REPORTING_OPERATIONS_REDESIGN.md) | V1.1-REP | **Not started** | Hub (pilot uses M7) |
| **M17** Clinical doc hub | [CLINICAL_DOC](./done/NEW_CLINIC_V1_CLINICAL_DOCUMENTATION_REDESIGN.md) v0.1.2 | V1.1-DOC | **Not started** | Hub (pilot uses M4 shortcuts) |
| **M18** Queue Bridge | [QUEUE_BOUNDARY](./done/NEW_CLINIC_V1_SCHEDULING_QUEUE_BOUNDARY_REDESIGN.md) v0.1.3 | V1.1-BRIDGE | **Not started** | Hub: exception worklist |

#### 6.6.3 Chart & legacy overlays

| Surface | Redesign spec | Status | Notes |
|---------|---------------|--------|-------|
| MRD primary (B7) | [B7_PRIMARY](./NEW_CLINIC_V1_PATIENT_DASHBOARD_B7_PRIMARY_REDESIGN.md) | **Shipped** · Polish | `patient-chart` island — cutover per PRD §5.6.1 |
| Background / History | [MEDICAL_HISTORY](./done/NEW_CLINIC_V1_MEDICAL_HISTORY_BACKGROUND_REDESIGN.md) | **Polish** | T1-F20 read summary in Clinical tab |
| Legacy chart strip | [LEGACY_CHART_CONTEXT](./done/NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md) | **Shipped** | T1-F18/F19 Twig strip on stock `patient_file/*` |

### 6.7 Domain-specific principle index

Full tables live in each redesign spec §3–§5. This is the quick lookup.

| Domain | Spec section | Prefix IDs |
|--------|--------------|------------|
| MRD / chart | MRD §3 | MRD-G1–G7, D-MRD-* |
| Chart depth | CHART_DEPTH §5 | P1–P10 |
| Front Desk search | FRONT_DESK §3 | Goals 1–6 |
| Front Desk registration | FRONT_DESK_REGISTRATION §4 | Four-section form |
| Communications | COM §4 | G1–G8 |
| Scheduling (S1) | SCHEDULING §4 | G1–G9 |
| Queue bridge (M18) | QUEUE_BOUNDARY §5 | Plain-language principles |
| Patient Registry (M10) | REGISTRY §3 | C1–C14 |
| Lab operations | LAB_OPS §5 | L1–L6 |
| Pharmacy operations | PHARM_OPS §5 | P1–P10 |
| Billing back office | BILLING §5 | P1–P10 |
| Admin & config | ADMIN §5 | A1–A12 |
| Reporting | REPORTING §5 | R1–R12 |
| Clinical documentation | CLINICAL_DOC §5 | Tasks-over-catalogs |
| Legacy chart context | LEGACY_CHART_CONTEXT §5 | P1–P12 |
| Referrals & letters | REFERRALS §3 | R1–R10 |

---

## 7. Accessibility, mobile, print

Normative detail: [PAGE_DESIGNS §8](./NEW_CLINIC_V1_PAGE_DESIGNS.md#8-mobile-and-tablet-patterns) and [§9](./NEW_CLINIC_V1_PAGE_DESIGNS.md#9-accessibility).

### 7.1 WCAG 2.1 AA checklist (every surface)

- Contrast 4.5:1+ on text and primary actions
- Focus visible (3–4px ring); logical tab order
- `aria-live` for queue refresh and AJAX errors
- `aria-label` on icon-only buttons
- `prefers-reduced-motion`: disable non-essential animation
- Form labels associated; required fields marked
- Native `<select>` or accessible combobox for critical filters (Registry C12)
- Native dialog focus trap (Radix in shadcn migration; manual in current `ConfirmModal`)

### 7.2 Responsive breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| `xl` | ≥1280px | Full desktop layout |
| `lg` | 992–1279px | Standard desks |
| `md` | 768–991px | Nav scroll; compressed stats |
| `sm` | 481–767px | Hamburger; cards replace wide tables |
| `xs` | ≤480px | Focus pages only; initials-only role pill |

**Focus pages on `xs`**: Triage, Cashier, Visit Board, Patient Chart (read-only view).

### 7.3 Print targets

- Queue slip + receipt → 80mm thermal
- Referrals / letters → A4
- Reports → CSV (browser PDF if needed)

### 7.4 Wall display

Visit Board `?profile=wall` only — not Flow Board (D22).

---

## 8. Feature-flag UI rule

When `oe-module-new-clinic` is disabled **or** a sub-flag is OFF, the UI **must** render **100% legacy** OpenEMR (PRD §5.6, PAGE_DESIGNS §2.5).

| Flag OFF | User sees |
|----------|-----------|
| Module off | Stock Knockout shell + stock menus |
| `communications_hub_enable` | Legacy Message Center |
| `enable_patient_registry` | Legacy Finder (`fin0`) for all roles |
| `enable_*_hub` (M12–M18) | Stock menus + desk deep links |
| `enable_chart_depth_*` | Stock Ledger / Report / Transactions |

**Rollback = set flag `0`; no orphaned half-new chrome.**

---

## 9. shadcn/ui migration plan

> **Strategic positioning:** New Clinic islands ship today on Bootstrap 4.6 + custom BEM (`oe-nc-*`). [FRONTEND_2026 Phase 3](./FRONTEND_2026_MODERNIZATION_PLAN.md#phase-3--shell-modernization-2027-h1-high-risk) names shadcn/ui as the platform target. This section is the *New Clinic-specific* cutover plan that feeds that platform decision.

### 9.1 Why shadcn for New Clinic

| Need | shadcn answer |
|------|---------------|
| Accessibility primitives without bundling Radix ourselves | Components copy-in (Dialog, Sheet, Combobox = Radix under the hood) |
| Token-driven theming (already in MASTER.md) | Tailwind 4 `@theme` + CSS variables — matches our `tokens.css` |
| Data table with sort, filter, pagination | TanStack Table baseline — first-class shadcn pattern |
| Searchable patient picker | `Command` (cmdk) — replaces custom `PatientSearchDropdown` keyboard logic |
| Drawer / Sheet for chart depth | `Sheet` primitive — already mirrors our `SlideOver` API |
| GPL compatibility | MIT — compatible with GPL parent project; copy-in model means no opaque runtime |

### 9.2 Component-by-component map (V2 ground truth)

| Our shared component | shadcn primitive | Replaces / wraps | Effort |
|----------------------|------------------|-------------------|--------|
| `WidgetCard` | `Card` (`Card`, `CardHeader`, `CardContent`, `CardFooter`) | 1:1 wrap; keep BEM class for legacy Twig consumers | S |
| `DataTable` | `Table` + TanStack Table | New `DataTable` HOC; preserve `DataTableStatusRow` API | M |
| `RowActionsMenu` | `DropdownMenu` | 1:1 | S |
| `PaginationBar` | `Pagination` | 1:1 | S |
| `ConfirmModal` | `Dialog` | Keep `IdentityConfirmBanner` slot; map variants to button classes | M |
| `SlideOver` / `FindPatientDrawer` | `Sheet` + `Command` | Drop `useModalDismiss` (Radix handles ESC/focus) | M |
| `PatientSearchDropdown` | `Command` (cmdk) | Big win: keyboard a11y + scoring stay; remove manual `arrowKeys` code | M |
| `StatusPill` / `TrendPill` / `RoutingChips` | `Badge` | Variant via `cn()`; preserve allergy severity color rules | S |
| `SegmentedControl` | `ToggleGroup` | 1:1 | S |
| `CompletionBar` | `Progress` | 1:1 | S |
| `StatCard` | `Card` + custom layout (21st.dev `StatsCard` pattern) | Keep `TrendPill` integration | S |
| `PatientContextBanner` | `Card` composition + `Avatar` + `Badge` | Compose, don't replace; preserve Tier 1/2/3 contract | M |
| `QueueCard` | `Card` (custom composition) | Keep `WaitTimeSpan` rendering rule | S |
| `Toast` (current per-island) | `Sonner` | Promote to shared; one app-wide toaster mount in T1 shell | M |
| `Skeleton` (per-island stub) | `Skeleton` | Promote to shared | S |
| `Empty` (per-island) | `Empty` | Promote to shared | S |
| `chart-line` (P2) | `Chart` (Recharts) wrapper | Greenfield component; build directly on shadcn `Chart` | L |
| `date-range-picker` (P2) | `Calendar` + `Popover` | Greenfield; presets + DD/MM/YYYY | M |

**Effort key:** S = ≤1 day, M = 1–3 days, L = ≥1 week.

### 9.3 Phased rollout

#### Phase A — Tokens & infrastructure (no user-visible change) · ~1 sprint

- Install `tailwindcss@4` (`@tailwindcss/vite`) in `frontend/` if not already present
- Map `tokens.css` to Tailwind `@theme` directive (light + dark)
- Add `cn()` utility (clsx + tailwind-merge)
- `npx shadcn@latest init` against `frontend/src/components/ui/`
- Lint: forbid raw color hex in island TSX (must use token/Tailwind class)
- **Exit:** Lighthouse/visual regression unchanged on all 16 islands

#### Phase B — Drop-in wrappers (small components) · ~1 sprint

Migrate **S-effort** components above. Keep public API identical so islands need zero changes.

- `WidgetCard` · `RowActionsMenu` · `PaginationBar` · `StatusPill` · `TrendPill` · `SegmentedControl` · `CompletionBar` · `StatCard` · `QueueCard`
- Each PR: ship behind no flag (component-internal swap), Vitest + visual smoke must pass

#### Phase C — Behavior-bearing primitives (M-effort) · ~2 sprints

- `Toast` → `Sonner` (one mount in `T1` shell; per-island imports become `import { toast } from 'sonner'`)
- `ConfirmModal` → `Dialog` (preserve `IdentityConfirmBanner` slot, variants, submit/submitting states)
- `SlideOver` → `Sheet` (drop `useModalDismiss`; Radix handles ESC + focus return)
- `PatientSearchDropdown` → `Command` (preserve 250ms debounce + scoring)
- `DataTable` → shadcn `Table` + TanStack Table (M7 + Registry first; ship behind `enable_shadcn_tables` flag)

#### Phase D — Composite & greenfield (L-effort) · post-pilot

- `PatientContextBanner` composed of shadcn primitives (preserve Tier 1/2/3 + AHRQ identity-repeat rules)
- `chart-line` built directly on shadcn `Chart` (Recharts) — replaces Chart.js need in pilot scope for new dashboards
- `date-range-picker` greenfield on `Calendar` + `Popover`

#### Phase E — Retire BEM CSS · 2027

- Remove `oe-nc-widget-card`, `oe-nc-data-table`, etc. from `components.css` when no consumer remains
- Twig partials under `templates/partials/ui/` migrate to use shadcn-equivalent Tailwind classes
- Update `ModuleAssetVersion` and document the cutover in [§13](#13-document-history)

### 9.4 Compatibility decisions

| Layer | Decision | Rationale |
|-------|----------|-----------|
| **Bootstrap 4.6 chrome (T1 shell)** | Keep through Phase D | Replacing the server-rendered shell is a Phase 3 platform decision, not New Clinic's |
| **Page-level Bootstrap utilities** (`mb-3`, `d-flex`, `col-md-6`) | Allowed during Phase B–C; lint-warned in Phase D; removed in Phase E | Avoid premature churn; concentrate on component-internal |
| **Existing `oe-nc-*` BEM classes** | Retained as data attributes for legacy Twig consumers during Phase B–D; removed in Phase E | Twig partials (e.g. `legacy-patient-context-strip.twig`) still consumed by stock chart pages |
| **Font Awesome 6** | Keep in shell + legacy Twig; Lucide adopted alongside in new shadcn components | One icon style per surface |
| **Tailwind utility prefix** | None (default) — `frontend/src/` is isolated from legacy `interface/` Bootstrap | No class-name collision risk |

### 9.5 Risks & exit criteria

| Risk | Mitigation |
|------|------------|
| Bundle size spike from shadcn dependencies | Tree-shake; measure per-island gzip after each Phase B PR; budget ≤200KB gzip per island |
| Visual regression in clinical safety surfaces | Playwright visual diff on banner, allergies, queue cards before merging Phase C |
| New A11y regressions when swapping `ConfirmModal` to `Dialog` | axe-core in Playwright; manual screen-reader pass on cashier confirm + e-sign override |
| Bootstrap + Tailwind class collisions | Limit Tailwind to islands; lint-forbid in legacy Twig |
| Pilot stability disruption | All Phase C changes ship behind a flag (`enable_shadcn_dialogs`, `enable_shadcn_tables`) for ≥2 weeks |

**Exit criteria (Phase done = true):**
- All Vitest + Playwright suites green
- Bundle size delta ≤+15% per island
- Lighthouse Accessibility ≥90 on M5 cashier and MRD chart
- Pilot clinic reports no UI regressions for ≥1 week

### 9.6 Cross-references

- Platform-wide context: [FRONTEND_2026 §3.3 shadcn rationale](./FRONTEND_2026_MODERNIZATION_PLAN.md#33-ui-component-library-shadcnui--tailwind-css-4)
- Chart strategy: [FRONTEND_2026 §4 Chart Modernization](./FRONTEND_2026_MODERNIZATION_PLAN.md#4-chart-modernization-strategy)
- Module guide for new islands: [`FRONTEND_MODULE_GUIDE.md`](../FRONTEND_MODULE_GUIDE.md)

---

## 10. Governance & quality bar

### 10.1 Scoring rubric (per skill)

Every UI/UX PR (new surface, redesign, or polish pass) gets a score out of 10 on each axis. **Merge bar: ≥8/10 average, no axis <6/10.**

| Axis | Skill source | 10/10 means |
|------|--------------|-------------|
| **Visual hierarchy** | refactoring-ui | One primary action; secondary muted; tertiary text-only. Constrained scale. |
| **Spacing & rhythm** | refactoring-ui | Only `--space-*` values used; between-group > within-group |
| **Typography** | web-typography | Body 16px+ · line-height 1.5 · line length ≤75ch · mobile 17px |
| **Don't make me think** | ux-heuristics (Krug) | Trunk test passes; labels are intention-revealing; primary action obvious |
| **Heuristics** | ux-heuristics (Nielsen) | 10/10 on visibility, match, control, consistency, error-prevention |
| **Affordances & gulfs** | design-everyday-things | Discoverable in <10s without training; feedback for every action <100ms |
| **Microinteractions** | microinteractions | All 4 (trigger/rules/feedback/loops) defined; all 9 states ([§5.1](#51-universal-states-per-component)) handled |
| **Refactor smell** | refactoring-patterns | No duplication; no method >40 lines; no magic strings |

### 10.2 Quality bar for new components

A new shared component (`frontend/src/components/<Name>.tsx`) must arrive with:

- [ ] **Contract block** at top of file ([§4.1](#41-component-contract-template))
- [ ] **TypeScript props interface** exported
- [ ] **All 9 states** ([§5.1](#51-universal-states-per-component)) implemented or documented why omitted
- [ ] **Vitest** covering: happy path + each variant + a11y query (e.g. `getByRole`)
- [ ] **CSS class names** following BEM (`oe-nc-<name>__<element>--<modifier>`)
- [ ] **No raw hex colors** — only tokens (`var(--oe-*)` or Tailwind class once Phase A lands)
- [ ] **`aria-label`** on icon-only controls
- [ ] **`prefers-reduced-motion`** respected
- [ ] **Wired into ≥1 island** in the same PR (no orphan components)
- [ ] **Used-by list** in contract block updated when consumers change

### 10.3 Versioning

This doc follows **SemVer**:
- `MAJOR` — IA change that breaks reader cross-references (e.g. v1 → v2)
- `MINOR` — new section, new principle, new component contract; no cross-ref break
- `PATCH` — copy edits, table fixes, anchor renames

Update [§13](#13-document-history) on every change.

### 10.4 Relationship to FRONTEND_2026

This plan is **module-scoped**. FRONTEND_2026 is **platform-scoped**. When they conflict:

- Module decisions (component contracts, IA, principles) win for New Clinic surfaces
- Platform decisions (framework, build, charts, shell) win for cross-OpenEMR work
- New shared components must list a **shadcn target** ([§4.1](#41-component-contract-template)) to keep alignment

| FRONTEND phase | Scope | New Clinic status (June 2026) |
|----------------|-------|-------------------------------|
| Phase 0 (Q2 2026) | Tooling + tokens | **Done** — `frontend/`, Vite 8, `tokens.css` |
| Phase 1 (Q3 2026) | High-value React islands | **Done for module** — 16 Vite entries ([§1.3.1](#131-vite-island-entries-16-all-shipped)) |
| Phase 2 (Q4 2026) | Forms + tables | **Partial** — Registry table, daily reports; shared `data-table` / `pagination-bar` consolidating in Track B |
| Phase 3 (2027 H1) | Modern shell + shadcn | **In progress for module** — see [§9 migration plan](#9-shadcnui-migration-plan); core Knockout tab shell unchanged |
| Phase 4 (2027 H2+) | Legacy retirement | **Pending** — stock Finder, Message Center when flags OFF |

---

## 11. Known gaps (not in V1 UI scope)

From `OPENEMR_AREAS_NOT_ADDRESSED.txt` and PRD non-goals:

- Patient portal UI redesign
- Telehealth UI
- Group therapy
- i18n / localization strategy for New Clinic strings (en-GH only in pilot)
- US insurance / claims UI (NG1)
- DICOM viewer, fax UI (deep links only in COM)
- AI / decision support (PRD non-goal in V1)

---

## 12. Reading order by role

| Role | First time | Returning |
|------|------------|-----------|
| **Designer** | §0 → §1.1 → §2 → §3 → §4 (component scan) → relevant §6.6 row | §3 + §4 |
| **Frontend engineer** | §0 → §1.3 → §4 (contract template + relevant component) → §5 → §9 (if Phase B+ work) | §4 + §10.2 |
| **QA** | §0 → §1.1 → §5 (state taxonomy) → [PAGE_DESIGNS §10 acceptance matrix](./NEW_CLINIC_V1_PAGE_DESIGNS.md#10-acceptance) | §5 + §7 |
| **Product** | §0 → §1.1 → §6.6 (module map) → §10.4 (relation to FRONTEND_2026) | §6.6 + §11 |
| **Clinical lead** | §0 → §2.1 (safety) → §2.6 (access) → [USER_WORKFLOWS](./NEW_CLINIC_V1_USER_WORKFLOWS.md) | §2.1 + relevant redesign §1 |

---

## 13. Document history

| Version | Date | Changes |
|---------|------|---------|
| **2.0.5** | **2026-06-29** | **`DeskQueueStatusBar`** extended to Lab and Pharmacy desks — waiting / in-lab and waiting / in-pharmacy counts; queue panel headers no longer duplicate stats. **`enable_pharm_ops`** now shows **Pharm Ops** in clinic sidebar (placeholder hub page until M13 worklists ship). |
| **2.0.4** | **2026-06-29** | **Shared `DeskQueueStatusBar`** rolled to Triage, Doctor, Cashier, Visit Board — same operational strip pattern as Front Desk; per-desk counts moved out of queue panel headers. |
| **2.0.3** | **2026-06-29** | Revert M1b 3-step intake wizard — registration returns to **4-section accordion** on all viewports (mobile keeps optional step wizard via `wizardMode`). Wide registration layout retained. |
| **2.0.2** | **2026-06-29** | **M1b intake wizard + recently viewed sync** — §4.7: `RecentlyViewed` server sync (`front_desk.recently_viewed`); 3-step desktop registration intake (reverted in 2.0.3). |
| **2.0.1** | **2026-06-29** | **M1a Front Desk search-first pass** — §4.7 documents `DeskStatusBar`, `RecentlyViewed`, `TodaysAppointmentsList`, idle vs selected layout, desk-focus shell, sticky Start Visit footer; §5.2 patient search idle state; §6.6.1 M1a pattern updated. |
| **2.0.0** | **2026-06-29** | **Full rewrite.** New IA: §0 TL;DR (trunk test), §1 architectural model (Norman desk·chart·depth·hub·shell), §2 design principles backed by AHRQ wrong-patient research + offline-first research, §3 full visual system (type scale, spacing scale, motion, elevation), §4 **single canonical component reference** with contract template + shadcn target per component, §5 interaction state taxonomy (Saffer), §6 IA + module map, §7 a11y/mobile/print, §8 feature-flag rule, **§9 phased shadcn migration plan** (Phase A→E), §10 governance + scoring rubric per skill + quality bar checklist, §11 gaps, §12 reading order. Consolidates v1.x §2.1/§5/§14 component lists into §4 (removes duplication smell). Renames or removes some v1.x anchors — README + FRONTEND_2026 updated. |
| 1.2.3 | 2026-06-28 | **Track B (cont.)** — `ConfirmModal` + `IdentityConfirmBanner`; refactored e-sign, skip-to-payment, pay confirm, M7 action modals; `PatientChart` → `WidgetCard`; M7 `ReportsSections` → `DataTable` |
| 1.2.2 | 2026-06-28 | **Track B (cont.)** — `WidgetCard`, `DataTable`, `RowActionsMenu`, `SlideOver`, `TrendPill`; wired into Registry, COM, chart depth, lab ops, bill ops, Front Desk search |
| 1.2.1 | 2026-06-28 | **Track B** — shared React components: `PatientContextBanner`, `StatCard`, `SegmentedControl`, `PaginationBar`, `ChipCloud`, `CompletionBar`; wired into desks, M7, Registry, Visit Board |
| 1.2.0 | 2026-06-28 | **Track A doc sync** — §2.1 implementation inventory; §5/§7 status updated; §12 FRONTEND 2026 reflects shipped islands; §14.8 React component priority with file paths |
| 1.1.0 | 2026-06-24 | **§14 Premium component catalog** — reference EHR screenshot analysis translated to New Clinic components |
| 1.0.0 | 2026-06-24 | Initial consolidated plan — synthesized UI/UX from all 19 redesign specs + PAGE_DESIGNS + FRONTEND_2026 + design-system MASTER |

---

*Normative wireframes: [PAGE_DESIGNS](./NEW_CLINIC_V1_PAGE_DESIGNS.md) · Workflows: [USER_WORKFLOWS](./NEW_CLINIC_V1_USER_WORKFLOWS.md) · Requirements: [PRD](./NEW_CLINIC_V1_PRD.md) · Platform: [FRONTEND_2026](./FRONTEND_2026_MODERNIZATION_PLAN.md)*

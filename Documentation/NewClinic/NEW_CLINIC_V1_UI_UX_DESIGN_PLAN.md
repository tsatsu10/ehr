# New Clinic V1 — UI/UX Design Plan

| Field | Value |
|-------|--------|
| **Document version** | 1.1.0 |
| **Status** | Active — consolidated from all redesign specs (2026-06-24 audit sync) |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md) (v1.20.49), [NEW_CLINIC_V1_PAGE_DESIGNS.md](./NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.49), [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.49), [FRONTEND_2026_MODERNIZATION_PLAN.md](./FRONTEND_2026_MODERNIZATION_PLAN.md) |
| **Audience** | Product, design, frontend engineers, QA, clinical leads |
| **Purpose** | Single entry point for New Clinic UI/UX — cross-cutting principles, component catalog, module map, and constraints. **Normative wireframes and per-page behavior live in PAGE_DESIGNS.** |

---

## 1. Document hierarchy (read this first)

| Layer | Document | Wins on… |
|-------|----------|----------|
| Requirements | [PRD](./NEW_CLINIC_V1_PRD.md) | Modules, ACL, data model, feature flags, acceptance |
| Workflows | [USER_WORKFLOWS](./NEW_CLINIC_V1_USER_WORKFLOWS.md) | Who does what, in what order |
| **This plan** | UI/UX master index | Cross-cutting principles, tokens, patterns, module → wireframe map |
| Page build spec | [PAGE_DESIGNS](./NEW_CLINIC_V1_PAGE_DESIGNS.md) | Layout, wireframes, AJAX, per-page state, §8 mobile, §9 a11y |
| Feature depth | `*_REDESIGN.md` specs | Domain pain points, IA, module-specific principles, closed decisions |
| Post-V1 platform | [FRONTEND_2026](./FRONTEND_2026_MODERNIZATION_PLAN.md) | React/Vite/Tailwind migration after pragmatic V1 |
| Design tokens | [`design-system/openemr-2026/MASTER.md`](../../design-system/openemr-2026/MASTER.md) | Colors, typography, spacing (optional in V1; COM Phase 1 uses scoped CSS) |

**Conflict resolution:** PRD → PAGE_DESIGNS → feature redesign spec → this plan.

**Wireframe format:** ASCII boxes + Mermaid — not Figma. No pixel-perfect mocks in V1 docs.

---

## 2. V1 technology constraints (non-negotiable for pilot)

Per PRD §5.6, COM §3, and [FRONTEND_2026 §1.9](./FRONTEND_2026_MODERNIZATION_PLAN.md):

| Constraint | V1 choice | Post-V1 (FRONTEND_2026) |
|------------|-----------|-------------------------|
| App shell | **T1** server-rendered PHP/Twig (`oe-module-new-clinic`) | React shell (Phase 3) |
| CSS | Bootstrap 4.6 + module SCSS (`oe-` overrides) | Design tokens + Tailwind 4 bridge |
| JS | jQuery 3.7 + vanilla modules | Vite + React 19 islands |
| Charts (clinical) | Stock Dygraphs / Chart.js where used | Unified Chart.js + Recharts dashboards |
| Tables | DataTables (legacy paths only); module queues use custom cards/tables | TanStack Table |
| Icons | Font Awesome 6 | Lucide in new React UI |
| Forms (clinical) | Stock encounter forms + LForms | React Hook Form + Zod for new UI |
| Feature flags OFF | **100% legacy OpenEMR** — no half-new chrome | — |

**Rule:** New Clinic pages must not call `dynamic_finder.php` or embed stock Knockout iframe chrome when the module is active (PRD §5.2).

---

## 3. Visual design system (V1)

Tokens align with [design-system/openemr-2026/MASTER.md](../../design-system/openemr-2026/MASTER.md) and [COM §15](./NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md#15-visual-design-system).

| Token | Value | Use |
|-------|-------|-----|
| Primary | `#0891B2` | Accents, selected border, links |
| Secondary | `#22D3EE` | Hover states |
| Success / CTA | `#059669` | Confirm, send, complete |
| Background tint | `#ECFEFF` or `var(--light)` | Subtle page wash |
| Text | `#164E63` or `var(--body)` | Body copy |
| Danger | `var(--danger)` | Delete, overdue, unsigned |
| Warning | `var(--orange)` | Today reminders, URGENT |
| Typography | Figtree / Noto Sans | **Optional** — use when global theme allows; else system stack |
| Icons | Font Awesome 6 | No emoji as icons |
| Radius | `0.25rem` | Match Bootstrap 4 cards |
| Motion | 150–200ms transitions | Respect `prefers-reduced-motion` |

**Anti-patterns (all modules):** neon gradients, AI purple styling, color-only status, icon-only actions without `aria-label`, motion-heavy animations.

**Regional formatting:** clinic `currency_symbol` via M6 (D-REG-3); dates **DD/MM/YYYY**; phone local `0XX` format — never hardcode `$` or US-only labels when `enable_insurance = false`.

---

## 4. Global UX principles (cross-cutting)

Synthesized from all redesign specs. Module-specific IDs (MRD-G*, COM G*, etc.) remain authoritative in their source docs.

### 4.1 Safety & identity

| Principle | Application |
|-----------|-------------|
| **Identity anchor** | `patient-context-banner` (T1-F17) on every patient-scoped surface; MRD Zone A on full chart |
| **Wrong-patient prevention** | Modals repeat Patient · MRN · Visit # · Receipt # (G12 family); full reload on `pid` change — no silent swap |
| **Shared device** | Active-role pill (T1); T1-F19 session warning; T1-F18 desk return link on legacy pages |
| **Safety above fold** | Allergies visible without scroll ≥360px (MRD-G1); severe allergy chips never color-only |
| **Destructive confirm** | No silent deletes; reason required on overrides (completion, e-sign, billing, queue bridge dismiss) |

### 4.2 Navigation & information architecture

| Principle | Application |
|-----------|-------------|
| **Task over tool** | Label by staff intent (“Payment history”, “Referral letter”) — not stock menu names |
| **One front door per domain** | Hub pattern: COM, M12/M13/M14/M15/M16/M17/M18 — stock menus hidden when flag ON + menu cutover |
| **Progressive disclosure** | Summary strip → depth panel; 6–8 hub cards; Advanced (OpenEMR) behind ⚠ banner |
| **Visit-scoped default** | Financial/correspondence views filter active visit first |
| **Tabs over infinite scroll** | MRD 5-tab IA; desks for queue work; no single scroll-the-whole-chart timeline (D-MRD-8) |
| **Desks vs chart vs depth** | Desk = today's queue; MRD = history; Chart Depth = money, letters, exports (slide-over) |

### 4.3 Interaction & performance

| Principle | Application |
|-----------|-------------|
| **Server shell first byte** | T1 chrome server-rendered — no AJAX flash for page chrome |
| **AJAX in-place** | List read/compose/update without full reload; standard JSON envelope (PAGE_DESIGNS §6) |
| **Explicit apply** | Registry cohort search uses **Apply** — not live-search on every keystroke (M10 C5) |
| **Debounced search** | Front Desk M1a: 250ms debounce; top 8 displayed / 25 scored (M1a) |
| **Ghana connectivity** | Optimistic saves where safe; async export with download link; offline banner + disable writes >60s |
| **Print-first where paper wins** | Receipts, referrals, Rx packs, queue slips — A4 / 80mm thermal |

### 4.4 Access & inclusion

| Principle | Application |
|-----------|-------------|
| **WCAG 2.1 AA** | Target for all New Clinic surfaces (PRD T1-F08; PAGE_DESIGNS §9) |
| **Status = shape + label + color** | Never color alone (scheduling, queue, allergies, visit state) |
| **44×44px touch targets** | Primary CTAs; sticky bottom actions on `sm`/`xs` |
| **Keyboard** | ↑/↓/Enter/Esc on search; skip links; visible focus rings |
| **Mobile-realistic** | Usable at `sm` (481–767px); focus pages at `xs` (Triage, Cashier, Visit Board) |

### 4.5 Cash clinic & West Africa

| Principle | Application |
|-----------|-------------|
| **Cash truth** | Hide insurance UI when `enable_insurance = false`; no “Insurance pending” labels |
| **Owner language** | “Reception desk” not `new_reception`; plain English training copy |
| **Walk-in normal** | Dual-system clinics: walk-in % is expected — not an error state |
| **Shared device clinics** | Role pill + session warnings are first-class, not edge cases |

---

## 5. Shared component catalog

Normative build detail: [PAGE_DESIGNS §4](./NEW_CLINIC_V1_PAGE_DESIGNS.md#4-shared-components).

| Component | ID / partial | Used on |
|-----------|--------------|---------|
| T1 shell | Top bar + module nav + queue stats | All module pages |
| Patient search | `patient-search` (M1a) | Front Desk, Triage, Cashier, Admin |
| Patient context banner | `patient-context-banner` Tier 1–3 | Desks, hubs, chart depth, legacy overlay |
| Queue card | `visit-queue-card` | All role desks, Visit Board |
| Visit state chip | FSM-colored pill | Banner, cards, MRD Zone A |
| Slide-over panel | ≥768px width 480–720px | Chart depth, lab/pharm results, billing correction |
| Full-screen sheet | &lt;768px | Mobile chart depth, confirm modals |
| Split-pane hub | List + detail | COM, M16 lenses (pattern) |
| Filter bar | Shared state in URL | S1 scheduling, M10 registry, M16 reporting |
| Confirm modal | G12 identity repeat | Payment, print, export, override |
| Empty / loading / error | Shell + card | Every page (PAGE_DESIGNS §2.5) |

### 5.1 Patient context banner tiers

| Tier | Fields | When |
|------|--------|------|
| **1** | Photo/initials · name · sex · age · MRN | Preview pane, compact hosts |
| **2** | Tier 1 + allergies (max 3) + completion % | Active visit panels |
| **3** | Tier 2 + visit state chip + queue # + primary action | Active visit on desks |

Legacy overlay tiers (L0–L3): [LEGACY_CHART_CONTEXT §5.1](./NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md#51-strip-tier-definition-normative).

### 5.2 Chart depth interaction pattern

```text
MRD tab content
  └─ Summary strip ("Last payment … · View payment history")
       └─ [ View full history ] → Chart Depth panel
            ├─ Desktop (≥768px): slide-over 480–720px
            └─ Mobile (<768px): full-screen sheet + sticky Close
```

Normative: [CHART_DEPTH §5.2](./NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md#52-interaction-patterns-normative).

---

## 6. Shell & navigation (T1)

Full wireframes: [PAGE_DESIGNS §2](./NEW_CLINIC_V1_PAGE_DESIGNS.md#2-top-bar-and-shell-t1).

| Region | Content |
|--------|---------|
| Brand strip | Clinic logo · name · facility |
| Active-role pill | First name — role label · Switch role · Logout |
| Module nav | ACL-filtered desk tabs; active tab highlighted |
| Queue stats | Live FSM counts; 30s refresh |
| Page heading | Title · Refresh · contextual CTA |

**Role accent colors:** Reception teal · Nurse blue · Doctor green · Lab amber · Pharmacy purple · Cashier orange · Admin grey.

**Breakpoints:** Full strip ≥992px · hamburger ≤767px · role pill initials only ≤480px.

---

## 7. Module → UI map

Each row links the **redesign spec** (why/IA/principles) to **PAGE_DESIGNS** (wireframes/build).

### 7.1 V1 pilot — role desks & core

| Module | Redesign spec | PAGE_DESIGNS | Status | Key UI pattern |
|--------|---------------|--------------|--------|----------------|
| **T1** Shell | — | §2, §4 | Draft | Server-rendered chrome |
| **M1a** Front Desk search | [FRONT_DESK_SEARCH](./NEW_CLINIC_V1_FRONT_DESK_SEARCH_REDESIGN.md) v1.0.8 | §4.1, §7.2 | **Approved P1** | Split search + preview; debounced |
| **M1b** Registration form | [FRONT_DESK_REGISTRATION](./NEW_CLINIC_V1_FRONT_DESK_REGISTRATION_REDESIGN.md) v1.0.0 | §4.1.3, §7.2.7 | **Approved** | 4-section accordion; region→district |
| **M2** Visit Board | PRD §8 | §7.8 | Draft | Kanban cards; wall profile |
| **M3** Triage | PRD §8 | §7.3 | Draft | Vitals steppers on mobile |
| **M4** Doctor Desk | PRD §8 | §7.4 | Draft | Consult queue + shortcuts |
| **M5** Cashier | PRD §8 | §7.7 | Draft | Payment confirm modal (G12) |
| **M6** Clinic Admin | [ADMIN](./NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md) v0.1.4 | §7.9 | Draft | Card tabs; checklist wizard |
| **M7** Daily Reports | [REPORTING](./NEW_CLINIC_V1_REPORTING_OPERATIONS_REDESIGN.md) v0.1.3 | §7.10 | Draft | Today-first KPI cards |
| **M8** Lab Desk | [LAB_OPS](./NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md) v0.1.9 | §7.5 | Draft | Visit queue + M12 slide-over |
| **M9** Pharmacy Desk | [PHARM_OPS](./NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md) v0.1.9 | §7.6 | Draft | Visit queue + undispensed gate |
| **COM** Communications | [COM](./NEW_CLINIC_V1_COMMUNICATIONS_HUB_REDESIGN.md) v1.0.3 | §7.12 | **Approved P1** | Split-pane Messages/Reminders |
| **MRD** Medical record | [MRD](./MEDICAL_RECORD_DASHBOARD_REDESIGN.md) v0.2.36 | §4.11, MRD spec | Draft | 4 zones · 5 tabs · banner-first actions |
| **S1** Scheduling | [SCHEDULING](./NEW_CLINIC_V1_SCHEDULING_REDESIGN.md) v0.2.6 | §7.11 | Draft | 3-lens shell; shared filter bar |

### 7.2 Post-pilot hubs & chart depth

| Module | Redesign spec | PAGE_DESIGNS | Slice | Key UI pattern |
|--------|---------------|--------------|-------|----------------|
| **M10** Patient Registry | [REGISTRY](./NEW_CLINIC_V1_PATIENT_REGISTRY_REDESIGN.md) v0.2.1 | §7.32 | V1.1-REG | Filter panel + Apply; cohort table |
| **M11** Chart Depth | [CHART_DEPTH](./NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md) v0.1.15 | §7.13–§7.16 | V1.1-CDa/b/c | Slide-over panels from MRD strips |
| — Payment history | [PAYMENT_HISTORY](./NEW_CLINIC_V1_PATIENT_PAYMENT_HISTORY_REDESIGN.md) | §7.13 | V1.1-CDa | Read-only ledger timeline |
| — Referrals & letters | [REFERRALS](./NEW_CLINIC_V1_PATIENT_REFERRALS_LETTERS_REDESIGN.md) v0.1.2 | §7.14 | V1.1-CDb | Wizard + print confirm |
| — Clinical export | [CLINICAL_EXPORT](./NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md) | §7.15 | V1.1-CDc | Preset builder + confirm |
| **M12** Lab Ops Hub | [LAB_OPS](./NEW_CLINIC_V1_LAB_OPERATIONS_REDESIGN.md) | §7.17–§7.20 | V1.1-LAB | Worklist + result slide-over |
| **M13** Pharm Ops Hub | [PHARM_OPS](./NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md) | §7.21–§7.24 | V1.1-PHARM | Pending dispense worklist |
| **M14** Billing back office | [BILLING](./NEW_CLINIC_V1_BILLING_AR_BACKOFFICE_REDESIGN.md) v0.1.3 | §7.25–§7.26 | V1.2-BILL | Hub tabs: corrections · payments · close day |
| **M15** Admin hub | [ADMIN](./NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md) | §7.27–§7.28 | V1.1-ADMIN | Lens shell embeds M6 |
| **M16** Reporting hub | [REPORTING](./NEW_CLINIC_V1_REPORTING_OPERATIONS_REDESIGN.md) | §7.29 | V1.1-REP | Curated report cards; M7 embed |
| **M17** Clinical doc hub | [CLINICAL_DOC](./NEW_CLINIC_V1_CLINICAL_DOCUMENTATION_REDESIGN.md) v0.1.2 | §7.30 | V1.1-DOC | 3–7 bundle cards per visit type |
| **M18** Queue Bridge | [QUEUE_BOUNDARY](./NEW_CLINIC_V1_SCHEDULING_QUEUE_BOUNDARY_REDESIGN.md) v0.1.3 | §7.31 | V1.1-BRIDGE | Exception worklist + guided fixes |

### 7.3 Chart & legacy overlays

| Surface | Redesign spec | Notes |
|---------|---------------|-------|
| MRD primary (B7) | [B7_PRIMARY](./NEW_CLINIC_V1_PATIENT_DASHBOARD_B7_PRIMARY_REDESIGN.md) | Build slice integrating MRD + legacy boundary |
| Background / History | [MEDICAL_HISTORY](./NEW_CLINIC_V1_MEDICAL_HISTORY_BACKGROUND_REDESIGN.md) | T1-F20 read summary; stock editor |
| Legacy chart strip | [LEGACY_CHART_CONTEXT](./NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md) | T1-F18/F19 on stock `patient_file/*` |

---

## 8. Domain-specific principle index

Quick reference — full tables live in each redesign spec §3–§5.

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
| Pharmacy operations | PHARM_OPS §5 | P1–P10 table |
| Billing back office | BILLING §5 | P1–P10 |
| Admin & config | ADMIN §5 | A1–A12 |
| Reporting | REPORTING §5 | R1–R12 |
| Clinical documentation | CLINICAL_DOC §5 | Tasks-over-catalogs |
| Legacy chart context | LEGACY_CHART_CONTEXT §5 | P1–P12 |
| Referrals & letters | REFERRALS §3 | R1–R10 |

---

## 9. Mobile, tablet & print

Normative detail: [PAGE_DESIGNS §8](./NEW_CLINIC_V1_PAGE_DESIGNS.md#8-mobile-and-tablet-patterns).

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| `xl` | ≥1280px | Full desktop layout |
| `lg` | 992–1279px | Standard desks |
| `md` | 768–991px | Nav scroll; compressed stats |
| `sm` | 481–767px | Hamburger; cards replace wide tables |
| `xs` | ≤480px | Focus pages only; initials-only role pill |

**Print targets:** queue slip + receipt → 80mm thermal; referrals/letters → A4; reports → CSV (browser PDF if needed).

**Wall display:** Visit Board `?profile=wall` only — not Flow Board (D22).

---

## 10. Accessibility checklist

Normative detail: [PAGE_DESIGNS §9](./NEW_CLINIC_V1_PAGE_DESIGNS.md#9-accessibility).

- WCAG 2.1 AA contrast on text and primary actions
- Focus visible (3–4px ring); logical tab order
- `aria-live` for queue refresh and AJAX errors
- `aria-label` on icon-only buttons
- `prefers-reduced-motion`: disable non-essential animation
- Form labels associated; required fields marked
- Native `<select>` or accessible combobox for critical filters (Registry C12)

---

## 11. Feature-flag UI rule

When `oe-module-new-clinic` is disabled **or** a sub-flag is OFF, the UI **must** render **100% legacy** OpenEMR (PRD §5.6, PAGE_DESIGNS §2.5).

| Flag OFF | User sees |
|----------|-----------|
| Module off | Stock Knockout shell + stock menus |
| `communications_hub_enable` | Legacy Message Center |
| `enable_patient_registry` | Legacy Finder (`fin0`) for all roles |
| `enable_*_hub` (M12–M18) | Stock menus + desk deep links |
| `enable_chart_depth_*` | Stock Ledger / Report / Transactions |

Rollback = set flag `0`; no orphaned half-new chrome.

---

## 12. Relationship to FRONTEND 2026

V1 deliberately **defers** React/Vite/Tailwind for the pilot. [FRONTEND_2026_MODERNIZATION_PLAN.md](./FRONTEND_2026_MODERNIZATION_PLAN.md) picks up after V1:

| FRONTEND phase | When | New Clinic impact |
|----------------|------|-------------------|
| Phase 0 (Q2 2026) | Tooling + tokens | Align `design-system/openemr-2026` with module SCSS |
| Phase 1 (Q3 2026) | High-value React islands | Vitals, labs, patient summary — may wrap MRD blocks |
| Phase 2 (Q4 2026) | Forms + tables | Registry, reporting tables |
| Phase 3 (2027 H1) | Modern shell | Replace Knockout tab shell — highest risk |
| Phase 4 (2027 H2+) | Legacy retirement | Stock Finder, Message Center |

COM Phase 4 explicitly plans T1 shell wrap when `oe-module-new-clinic` lands.

---

## 13. Known gaps (not in V1 UI scope)

From [OPENEMR_AREAS_NOT_ADDRESSED.txt](./OPENEMR_AREAS_NOT_ADDRESSED.txt) and PRD non-goals:

- Patient portal UI redesign
- Telehealth UI
- Group therapy
- i18n / localization strategy for New Clinic strings
- US insurance / claims UI (NG1)
- DICOM viewer, fax UI (deep links only in COM)

---

## 14. Premium component catalog — reference EHR translation

**Source:** Critical analysis of reference EHR UI screenshots (clinic dashboard + patient chart). **Scope:** reusable **components only** — not page layout (New Clinic uses **T1 horizontal top nav**, not a left sidebar; that is intentional).

**Legend:** ✅ Spec'd · 🔶 Spec'd but needs premium polish · ➕ Add to component library · ⛔ Out of V1 scope

### 14.1 Navigation & shell primitives

| Reference component | What it is (component only) | New Clinic equivalent | Status | Premium upgrade |
|---------------------|----------------------------|------------------------|--------|-----------------|
| App brand block | Logo + product name | T1 brand strip (clinic logo + facility name) | ✅ PAGE_DESIGNS §2.1 | Clinic-uploaded logo; consistent `max-height` + fallback initials |
| Sidebar nav item | Icon + label + active fill | **T1 module nav tab** (horizontal, ACL-filtered) | ✅ §2.1 | Active tab: pill background + 2px bottom border; icon + label at `md+`, icon-only at `sm` |
| Sidebar collapse toggle | Chevron expand/collapse | Hamburger menu ≤767px | 🔶 §2.6, §8.3 | Animated drawer; remember collapsed state per user |
| Utility nav link | Help / Settings / Notifications | **⋯ overflow** + Admin hub runbooks; COM badge | 🔶 | `nav-utility-link` partial: icon + label + optional badge |
| User profile widget | Avatar + name + role + chevron | **Active-role pill** + dropdown | ✅ §2.2, §4.10 | Circular avatar/initials; role accent ring; keyboard-accessible menu |
| Notification badge | Red count pill on nav item | Queue stats strip; COM envelope (Phase 2) | 🔶 | `nav-badge` atom: `aria-label` count; cap at `99+` |
| Beta / feature tag | Small label pill ("Beta") | Not spec'd | ➕ | `feature-tag` for V1.1 slices only — never on clinical safety paths |
| Horizontal tab bar | Icon + label + count per tab | **MRD Zone C tabs**; COM lens switcher; hub lenses | ✅ MRD §8; COM §6 | `tab-bar` partial: selected state, badge count, `role="tablist"` |
| Primary CTA button | Large rounded action button | Desk primary actions; **Start visit**; **Create appointment** | ✅ | `btn-primary-lg`: min 44px height, icon-left, loading spinner state |
| Icon button | Search, close, expand | Refresh, filter, **⋯** overflow | ✅ | `btn-icon`: 44×44 hit area, mandatory `aria-label` |

### 14.2 Filters, search & date controls

| Reference component | What it is | New Clinic equivalent | Status | Premium upgrade |
|---------------------|-----------|------------------------|--------|-----------------|
| Global date range picker | Dropdown + calendar icon | M7 date range; S1 filter bar; M16 reports | 🔶 | `date-range-picker`: presets (Today / 7d / 30d / custom); DD/MM/YYYY |
| Inline date display | Date text + calendar icon + chevron | S1 top bar date stepper; Registry "as of" | 🔶 | `date-stepper`: prev/today/next + label |
| Search input | Magnifying glass + placeholder | **`patient-search`** (M1a); hub list search | ✅ §4.1 | Consistent `search-input` partial; clear (×) button; debounce indicator |
| Filter button | Funnel icon button | Registry filter panel; M16 lens filters | 🔶 | `filter-trigger` opens slide-over panel on mobile |
| Segmented control w/ counts | Pills: All (134), Completed (56)… | Visit Board state filters; M18 severity tabs; COM unread counts | 🔶 | **`segmented-control`**: each segment = label + `(count)`; keyboard arrows |
| Section header w/ count | "134 total appointments" | Queue desk headings; Registry match banner | 🔶 | `section-header`: title + muted count + right actions slot |

### 14.3 Data display — cards & KPIs

| Reference component | What it is | New Clinic equivalent | Status | Premium upgrade |
|---------------------|-----------|------------------------|--------|-----------------|
| KPI / stat card | Icon + label + big number + trend pill | **M7 KPI cards**; queue stats strip | 🔶 §7.10 | **`stat-card`**: value + `trend-pill` (↑12% green / ↓3% red) + sparkline optional V1.1 |
| Trend pill | % change + directional arrow | Not spec'd as reusable atom | ➕ | `trend-pill`: `aria-label` "up 12% vs last period" |
| Widget card shell | White card + header + expand chevron | MRD blocks; hub lenses; COM panes | 🔶 | **`widget-card`**: header (title + icon + actions) + body + optional footer |
| Expandable widget | Card header → full view | Chart depth slide-over; M12 result entry | 🔶 | `widget-expand` → opens slide-over ≥768px / full page &lt;768px |
| Empty state | Illustration + guidance | §4.9 empty/loading/error | ✅ | Premium: role-specific CTA in empty state |
| Skeleton loader | Placeholder shimmer | Mentioned for chart depth | 🔶 | `skeleton-row` / `skeleton-card` for AJAX tabs |

### 14.4 Tables & lists

| Reference component | What it is | New Clinic equivalent | Status | Premium upgrade |
|---------------------|-----------|------------------------|--------|-----------------|
| Data table container | Column headers + rows | Registry cohort table; COM list; M7 exports | 🔶 | **`data-table`** partial (not DataTables.net in module UI) |
| Avatar + two-line cell | Photo + name + subtitle | Queue card patient row; table patient column | 🔶 §4.2 | **`cell-identity`**: avatar/initials + primary + secondary line |
| Two-line text cell | Primary + secondary (time+duration, phone+email) | Visit timeline rows; appointment chips | 🔶 | **`cell-stacked`**: ellipsis + `title` tooltip on truncate |
| Status badge pill | Colored pill + dot + label | **`visit-chip`**; FSM state; appt status | ✅ §4.3 | **`status-pill`**: variant map (success/info/warning/danger/neutral) + dot + text |
| Category icon cell | Icon + specialty label | Doctor Desk consult type; lab test category | 🔶 | **`cell-category`**: FA icon in tinted circle |
| Doctor avatar cell | Small avatar + name | Provider combobox; assign doctor | ✅ §4.12 | Reuse in tables and combobox dropdown |
| Document link cell | File icon + filename | Chart depth export; referrals print | 🔶 | **`cell-document`**: icon + truncated name + download |
| Progress bar | Horizontal completion % | Profile completion (MRD); treatment not in V1 | 🔶 | **`progress-bar`**: label + % + `role="progressbar"` — MRD Profile checklist |
| Row kebab menu | ⋯ vertical ellipsis | Queue card actions; MRD overflow | ✅ | **`row-actions-menu`**: dropdown; destructive items separated |
| Pagination bar | "Showing 1–20 of N" + page buttons | Registry; MRD visits; COM lists | 🔶 | **`pagination-bar`**: prev/next + page numbers + page-size select |

**Note:** Role **desks** intentionally use **`queue-card`** (card list), not a data table — better for queue pressure and mobile. Use **`data-table`** for Registry, reports, and admin lists.

### 14.5 Patient & clinical widgets (image 2)

| Reference component | What it is | New Clinic equivalent | Status | Premium upgrade |
|---------------------|-----------|------------------------|--------|-----------------|
| Patient hero card | Large photo + overlay name/age | **MRD Zone A** patient banner | 🔶 MRD §6 | Photo/initials + sticky identity; not decorative hero — clinical first |
| Quick action overlay buttons | Message / Call on photo | MRD Messages tab; phone in Profile | 🔶 | **`quick-action-chip`**: only actions with real handlers (no dead icons) |
| Contact list rows | Icon + label + value | MRD Profile demographics; Preview pane | ✅ §4.11 | **`contact-row`**: icon + label + value + copy button optional |
| Allergy chip cloud | Rounded tags per allergen | **MRD Zone B** safety strip; legacy L2+ chips | ✅ MRD §7 | **`chip-cloud`**: severity color border; max visible + "N more" |
| Medication schedule timeline | Week strip + gantt bars + med chips | MRD **meds strip** §8.10.5; eRx list | 🔶 | ➕ **`med-schedule-timeline`** (V1.1): day strip + dose chips — **adherence display only** in V1, not prescribing |
| AM/PM toggle | Morning / Evening filter | Not spec'd | ➕ | Pair with med timeline; sun/moon icons + text label (not color-only) |
| Line chart + tooltip | Weight trend + hover popover | Vitals trends (stock); MRD clinical labs | 🔶 | **`chart-line`**: Chart.js wrapper + accessible tooltip table |
| Chart summary stats | Latest / target / height below chart | Vitals block in MRD Clinical | 🔶 | **`chart-summary-row`**: 3-up stat line under chart |
| Month dropdown on chart | Period selector | Not as shared component | ➕ | `chart-period-select`: 7d / 30d / 90d / 12mo |
| Appointments sub-tabs | Upcoming / Past within card | MRD **Visits tab** §8.5 | ✅ | **`sub-tabs`**: underline style inside widget-card |
| Heart rate mini-card | Title + date range + sparkline | Vitals chips in Zone A (BP/HR/T) | 🔶 | **`vital-chip-group`**: abnormal state styling (M3-F14) |

### 14.6 Modals & overlays

| Reference component | What it is | New Clinic equivalent | Status | Premium upgrade |
|---------------------|-----------|------------------------|--------|-----------------|
| Confirm modal w/ identity | Patient · MRN repeat | G12 family; payment confirm; print confirm | ✅ §4.4, §4.5 | **`confirm-modal`**: danger variant + reason textarea on overrides |
| Slide-over panel | Right drawer 480–720px | Chart depth; lab results; billing correction | ✅ CHART_DEPTH §5.2 | Backdrop blur; focus trap; ESC to close |
| Bottom sheet | Mobile action sheet | MRD Zone D mobile actions | ✅ MRD §9 | `bottom-sheet`: drag handle optional |
| Toast / banner | Inline alert | `visit-interrupt`; completion banner; offline banner | ✅ §4.6, §4.8 | `toast`: auto-dismiss info; sticky for errors |

### 14.7 Deliberately skipped (V1)

| Reference component | Why skip |
|-------------------|----------|
| Left sidebar navigation | New Clinic **T1 top nav** — better for role switching on shared tablets; not a component gap |
| Chatbot AI + Beta tag | PRD non-goal; no AI assistant in V1 |
| Inventory sidebar item | Pharmacy stock is M13 hub, not global nav |
| Billing as top-level beside clinical | Cashier desk + M5; not parallel to "Patients" in a US SaaS shell |
| Decorative dashboard without visit context | Every surface must anchor **patient** or **today's queue** (clinical safety) |

### 14.8 Implementation priority

Build these **shared Twig partials** once in `templates/partials/ui/` — use everywhere:

| Priority | Partial name | Unblocks |
|----------|--------------|----------|
| P0 | `status-pill`, `cell-identity`, `btn-primary-lg`, `search-input` | All desks + Registry |
| P0 | `patient-context-banner` (existing §4.11) — polish pass | All patient surfaces |
| P1 | `stat-card`, `trend-pill`, `segmented-control`, `widget-card` | M7, MRD Overview, S1 |
| P1 | `data-table`, `pagination-bar`, `row-actions-menu` | M10 Registry, COM, M16 |
| P1 | `chip-cloud`, `vital-chip-group`, `progress-bar` | MRD Clinical + Profile |
| P2 | `chart-line`, `med-schedule-timeline`, `date-range-picker` | MRD depth, M7 trends |
| P2 | `slide-over`, `bottom-sheet`, `confirm-modal` | Chart depth, lab, billing |

**Stack:** Implement as Bootstrap 4.6 + scoped SCSS (`oe-nc-*` BEM) in V1; extract to React + shadcn in [FRONTEND_2026](./FRONTEND_2026_MODERNIZATION_PLAN.md) Phase 1–2 without changing component API names.

---

## 15. Reading order by role

| Role | Read |
|------|------|
| **Designer** | This plan §3–§5 → PAGE_DESIGNS §2, §4, §8–§9 → relevant §7.x |
| **Frontend engineer** | PAGE_DESIGNS §4–§6 → §7.x for assigned page → feature redesign spec |
| **QA** | PAGE_DESIGNS §10 acceptance matrix → PRD §21.1x tests |
| **Product** | This plan §7 module map → PRD §5.6 phasing |
| **Clinical lead** | USER_WORKFLOWS → relevant redesign §1 purpose |

---

## 16. Document history

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2026-06-24 | **§14 Premium component catalog** — reference EHR screenshot analysis translated to New Clinic components; gap/priority matrix for premium partials |
| 1.0.0 | 2026-06-24 | Initial consolidated plan — synthesized UI/UX from all 19 redesign specs + PAGE_DESIGNS + FRONTEND_2026 + design-system MASTER; module map; cross-cutting principles; post-audit version sync |

---

*Normative wireframes: [PAGE_DESIGNS](./NEW_CLINIC_V1_PAGE_DESIGNS.md) · Workflows: [USER_WORKFLOWS](./NEW_CLINIC_V1_USER_WORKFLOWS.md) · Requirements: [PRD](./NEW_CLINIC_V1_PRD.md)*

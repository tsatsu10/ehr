# Admin Hub — Apple-Theme Redesign Plan (ADM-*)

| Field | Value |
|-------|-------|
| **Document version** | 1.5.0 |
| **Date** | 2026-07-19 |
| **Status** | In progress — ADM-7, ADM-2, ADM-3, ADM-1, ADM-4, ADM-6 shipped; ADM-5, 8 remain |
| **Companion to** | `done/NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md` (v0.1.9), `NEW_CLINIC_V1_UI_UX_DESIGN_PLAN.md`, the "New Clinic — Reimagined by Apple" artifact (Console 26 reference) |
| **Scope** | The whole Admin Hub page (`admin.php`, `admin-hub` island): navigation model, information architecture, visual language, settings-page behaviors. Not the individual editors' internals (fee modal, visit-type modal, importer panel keep their logic). |
| **Coordination** | ⚠️ A concurrent session is actively editing `AdminHub.tsx` / admin services. Execute this plan only in a quiet window, after a `git status` check on `frontend/src/islands/admin-hub/` + `src/Services/Admin*`. |

---

## 1. Research summary — what is true today (all verified in code/browser 2026-07-18)

**Structure:** page heading (Twig) → scope bar card (facility picker + Setup/System chips)
→ finish-setup banner → **sticky segmented tab strip with 10 tabs that wraps to two rows**
→ one `AdminStack` of cards per tab. The "Queue & roles" tab is a mega-page: ~17 accordion
groups of flags spanning every module, with its own chip-cloud of jump anchors and the only
settings search box.

**Settings-page best-practice scorecard (from the review that motivated this plan):**

| Practice | Today | Verdict |
|---|---|---|
| Settings search | Exists but **only filters the Queue & roles tab** (`QueueRolesTab.tsx:184`) — 9 tabs invisible to it | ✗ misleading |
| Navigation for 10+ categories | Two-row wrapped tab strip | ✗ (best practice ≥8 categories on desktop: left category sidebar — macOS System Settings, Stripe, GitHub) |
| Category balance | One mega-tab (17 groups) next to single-card tabs | ✗ |
| Explicit save + dirty state | ✓ "Save changes" pill, scope-switch guarded by confirm | ◐ tab switch and browser-close are **not** guarded (`handleTabChange` has no dirty check; no `beforeunload`) |
| Override transparency | Header explains clinic-overrides-global; **no per-setting "overridden here" indicator or reset-to-default** | ✗ |
| Grouping, helper text, toggle types, deep links, scope clarity, state chips | ✓ | genuinely good — preserve |
| One accent color | "Mark setup complete" is **green** (`cta` variant) while the product accent is Console 26 blue | ✗ |
| Progress visuals | Setup progress bar uses a blue→navy **gradient** | ✗ (Console 26 = flat accent fills) |
| Done-state recession | Completed checklist rows render at full strength | ✗ (finished things should recede) |
| Copy integrity | Page title renders "Admin Tsatsu\`s desk" — `PersonalizedDeskLabelService.php:47` passes an apostrophe through `xl()`, which converts it to a backtick. **Product-wide: every personalized desk title is mangled** (sidebar shows "Reception Tsatsu\`s desk" too) | ✗ tiny fix, big visibility |

**The Apple reference (from the artifact + Console 26 tokens):** frosted quiet left rail for
navigation; flat `#0071e3` accent as the *only* action color; white cards on `#f5f5f7` ground
with hairline borders (`rgba(0,0,0,0.08)`), generous radius (1.375rem card family), soft
two-layer shadow; segmented controls in a `bg-muted` track; pill chips for counts/status;
system font stack; done/success communicated by the green *state* palette, never by buttons.

---

## 2. Design direction (one paragraph)

Turn the Admin Hub into a **macOS-System-Settings-style two-pane page**: a quiet, sticky
**category sidebar** on the left (search on top, icon + label rows, accent active state,
grouped with small section headers), and a **single scrolling content pane** of Console 26
cards on the right. The outer Twig shell (desks rail) stays untouched — the inner sidebar is
visually subordinate (no frosted chrome, just a hairline-separated list) so the two levels of
navigation read as app-level vs page-level, exactly like the artifact's rail + in-page
structure. On small screens the sidebar becomes an iOS-Settings-style category list that
drills into the section (back header), replacing the wrapped tab strip entirely.

### Wireframe (desktop ≥1024px)

```
┌────────────────────────────────────────────────────────────────────┐
│ Admin — {clinic}                      [Save changes]  {scope hint} │  Twig heading (title fixed, no backtick)
├────────────────────────────────────────────────────────────────────┤
│ Settings for: [new test ▾]   SETUP 75% · SYSTEM warning            │  scope bar (unchanged)
│ Finish setting up this clinic — 75% done →                         │  banner (unchanged, hidden per rules)
├──────────────┬─────────────────────────────────────────────────────┤
│ 🔍 Search    │  ┌───────────────────────────────────────────────┐  │
│              │  │  {Section title}                    [action]  │  │
│ GET STARTED  │  │  cards …                                      │  │
│ ● Setup      │  └───────────────────────────────────────────────┘  │
│ CLINIC       │                                                     │
│  Clinic      │   content pane scrolls; sidebar + heading sticky    │
│  Queue+desks │                                                     │
│  Features    │                                                     │
│  Completion  │                                                     │
│ PEOPLE&MONEY │                                                     │
│  People      │                                                     │
│  Visit types │                                                     │
│  Fees        │                                                     │
│  Addr. book  │                                                     │
│  Import      │                                                     │
│ OPERATIONS   │                                                     │
│  Forms       │                                                     │
│  System      │                                                     │
└──────────────┴─────────────────────────────────────────────────────┘
```

### Information architecture (rebalanced, 12 destinations in 4 groups)

| Group | Section | Contents (today's home) |
|---|---|---|
| Get started | **Setup** | Setup checklist card gets its own destination (moves out of System); banner/chip jump here |
| Clinic | **Clinic** | details, cash profile, regional/branding (from Queue & roles' tail groups) |
| | **Queue & desks** | desks & queue basics, triage, multi-doctor & routing, safety & chart integration |
| | **Features** | the per-module `enable_*` groups (M11–M18, CBILL, GAP-A, ops polish…) — the mega-tab's flag catalog, now its own destination with the search prioritizing it |
| | **Completion** | unchanged |
| People & money | **People & access** | unchanged |
| | **Visit types** | unchanged |
| | **Fees** | unchanged |
| | **Address Book** | unchanged |
| | **Import patients** | unchanged (visibility rules unchanged) |
| Operations | **Forms** | unchanged |
| | **System** | health, backup, reconciliation, runbooks, config export/import, audit, perf, duplicates (checklist moved out) |

`?tab=` deep links keep working via a redirect map (`queue` → `queue-desks`, old System
checklist links land on Setup). The E2E spec's `?tab=system` + `#nc-admin-setup-checklist`
targets get the same mapping so the golden path survives.

---

## 3. The plan — one ADM task per commit

### ADM-1 · Global settings search (the biggest honesty fix) — ✅ DONE (2026-07-19)
- Build a client-side index at load: every field def (label, help text, group, section) +
  static section metadata for non-flag destinations (Fees, People, System cards…).
- Search moves to the top of the sidebar; results are a flat list ("{setting} — in
  {Section} › {Group}"); choosing one navigates to the section, expands the group, scrolls,
  and flash-highlights the row.
- The old per-tab filter behavior remains inside Features as a bonus, driven by the same query.
- **Implementation**: `adminSearchIndex.ts` builds two indexes — `ADMIN_FIELD_SEARCH_INDEX`
  (~140+ entries from Queue & desks / Features / Clinic / Completion's field defs) and
  `ADMIN_DESTINATION_SEARCH_INDEX` (a static entry per non-field-def tab: Setup, People,
  Visit types, Fees, Address Book, Import, Forms, System — each with a description + extra
  keywords so e.g. "backup" finds System without "backup" appearing in its label). Both
  filter against the caller's visible-tabs set, so a search never surfaces a destination the
  clinic doesn't have enabled.
- Jump-and-highlight needed a stable per-field DOM id (`AdminConfigField` now sets
  `id="nc-admin-field-row-{key}"` on every field's wrapper) and a `highlightKey`/
  `onHighlightHandled` prop pair threaded from `AdminHub` through `AdminHubTabPanels` into
  the four field-def-driven tabs. `SettingsSectionAccordion` additionally opens the owning
  accordion section before scrolling (Radix doesn't mount collapsed content, so the target
  row isn't even in the DOM until its section is open).
- **Audit-caught bug, fixed**: a tab's own local search box (Queue & desks / Features) drives
  `accordionValue` directly whenever it has text — `openSections` is ignored while
  `searching` is true, and the local filter can hide the target section from
  `visibleSections` entirely. A global jump into a tab with a stale local query silently
  failed (state said the section was "open," nothing was actually visible to scroll to).
  Fixed by clearing the tab's local query as part of the jump. Proven with a test that fails
  without the fix and a before/after live-browser repro.

### ADM-2 · Sidebar navigation shell — ✅ DONE (2026-07-18)
- New `AdminSidebar` component (island-local): sticky, grouped, icon + label (Lucide),
  accent active state, count/status dots where meaningful (Setup % ring, System warning dot).
- Desktop ≥1024px: two-pane grid. Below: category list → drill-in with a back header
  (iOS Settings pattern); no wrapped tabs anywhere.
- Keyboard: arrow-key list nav, visible focus, `aria-current`; sections are real URLs
  (`?tab=` preserved, redirect map for renamed ids).
- The sticky segmented tab strip and its two-row wrap are deleted.
- **Groups reflect the target IA (below) but items themselves haven't moved yet** — that's
  still ADM-3. Landed groups: Clinic (Queue & roles, Clinic, Completion), People & money
  (People & access, Visit types, Fees, Address Book, Import patients), Operations (Forms,
  System). No "Get started"/Setup group until ADM-3 promotes the checklist out of System.
- **Gotcha for the next session**: a sticky element inside CSS Grid needs its *own* box to be
  content-sized while its *parent* grid cell stretches full row height — putting `position:
  sticky` directly on a grid item that also stretches (default `align-items: stretch`, or
  `display: flex` filling the row) makes the sticky box itself enormous, so it never visibly
  "sticks." Fixed with a two-level structure: `.nc-admin-sidebar-rail` (the actual grid item,
  stretches) wrapping `.nc-admin-sidebar` (the sticky nav, content height). `align-items:
  start` on the grid container has the opposite failure — the cell collapses to content
  height and the sidebar scrolls away with the page instead of sticking.

### ADM-3 · IA rebalance — ✅ DONE (2026-07-19)
- Split Queue & roles into **Queue & desks**, **Features**, and Clinic-bound tail groups per
  the table above; move the setup checklist to **Setup**; System keeps everything else.
- Field-def `section` metadata gains the new destination ids; no backend changes (settings
  keys unchanged — this is presentation-layer regrouping only).
- The 17-chip jump cloud dies; Features gets a compact in-section index instead (its groups
  are still accordions).
- **Implementation note**: `QUEUE_DESK_SECTIONS`/`FEATURE_SECTIONS`/`CLINIC_REGIONAL_SECTION`
  in `adminFieldDefs.ts` are derived from the original `QUEUE_FIELD_SECTIONS` array by title
  match, not hand-copied — zero risk of a settings key getting dropped or duplicated in the
  split. The accordion+search+jump-chip UI itself was extracted into a shared
  `SettingsSectionAccordion` component used by both `QueueDesksTab` and `FeaturesTab`.
- **Two bugs the move exposed, both fixed**: `SetupChecklistCard`'s "take me there" links
  assumed the card only ever rendered inside System — a `link_tab` of `'system'` was
  deliberately suppressed as "noise" (now a genuine cross-tab jump), and the `link_anchor`
  scroll-to-runbooks link assumed same-tab (`scrollIntoView` alone) — now navigates to System
  first, then scrolls after a short delay once that tab has mounted.
- **Legacy links preserved**: `?tab=queue` → `queue-desks`; `?tab=system#nc-admin-setup-checklist`
  (the old in-page anchor to the checklist) → `setup`; bare `?tab=system` still lands on System
  untouched (runbook cards like RB-01/RB-19 that generically point there are unaffected).
- Landing-redirect simplified from the original open-question wording: default tab is always
  `queue-desks`, and a one-shot effect redirects to `setup` only when setup is incomplete AND
  no explicit `?tab=` was in the URL. Skipped the "after completion, lands on Clinic" half of
  the original open answer — Queue & desks is a perfectly good post-setup default and matches
  pre-ADM-3 behavior (the old mega-tab was always the default); adding a second landing branch
  for uncertain benefit wasn't worth the complexity.

### ADM-4 · Apple-theme visual pass — ✅ DONE (2026-07-19)
- **One accent**: `cta`-green buttons in the admin island become the standard accent primary
  ("Mark setup complete", any others found by a variant audit). Green stays for state
  (done checks, success callouts).
- **Flat progress**: setup bar loses the gradient; flat accent fill on `bg-muted` track.
- **Done rows recede**: completed checklist rows get muted label + softer check so remaining
  work pops.
- **Card family**: admin cards align to the comms-established chrome (1.375rem radius,
  hairline border, two-layer soft shadow, white on `#f5f5f7`); accordion headers, chips, and
  the scope bar restyled to the same family; kill any remaining Bootstrap-ish borders.
- Respect the bs:check ratchet (token arbitrary values / BEM, no new colliding classes).
- **The variant audit found 5 violations, not 2**: beyond "Mark setup complete" and the forms
  catalog's on/off toggle, the People sub-tab nav's active state, the guided-ACL-task cards'
  "primary" tone (icon swatch + hover border — the icon color was hardcoded green for *all
  three* tones, not tone-aware at all), and the add-staff wizard's current-step marker were
  all green for a nav-position/current-step cue, not a done state. Fixed all five the same
  way: green now means "finished," never "here" or "click me."
- **Card family implementation note**: `--oe-nc-shadow-sm`/`--oe-nc-shadow-md` were never
  actually defined anywhere in tokens.css — every `shadow-[var(--oe-nc-shadow-sm,...)]` usage
  was silently running on its literal fallback the whole time. Switched to the real,
  resolvable `--shadow-sm`/`--shadow-md`/`--shadow-lg` tokens instead of guessing at a new
  fallback value.
- bs:check dropped 342 → 338 colliding usages (the dead `border-bottom` removal); baseline
  lowered to lock it in, per the ratchet's own instructions.

### ADM-5 · Override transparency (the best small settings-UX win)
- Backend: `getSettingsPayload` additionally returns, per setting, whether a facility-level
  row exists (`overridden: true`) and the global/default value it shadows. (Read path only —
  bounded, single existing query reshaped.)
- UI: overridden settings show a quiet "Overridden for this clinic" dot + a "Use global
  value" reset affordance (deletes the facility row via the existing save path, confirm on
  destructive reset). Global scope shows nothing new.

### ADM-6 · Unsaved-changes completeness — ✅ DONE (2026-07-19)
- Extend the existing scope-switch confirm to **section switches** (same `pendingConfirm`
  pattern) and add a `beforeunload` guard while `dirty`.
- **Implementation**: `handleTabChange` split into a raw `applyTabChange` (used by the
  one-shot Setup landing redirect, which never needs a confirm — dirty is guaranteed false
  that early) and a dirty-gated `handleTabChange` that every real navigation already funneled
  through (sidebar clicks, ADM-1 search jumps, "go to X" links) — gating it once covers all
  of them, no per-caller changes needed. New `tab_switch` confirm variant mirrors
  `scope_switch` exactly (same discard-on-confirm behavior). `beforeunload` listener is only
  attached while `dirty` is true.

### ADM-7 · Desk-title apostrophe fix (product-wide, 5 minutes) — ✅ DONE (2026-07-18)
- `PersonalizedDeskLabelService`: stop passing an apostrophe through `xl()` — rephrase the
  format (e.g. `xl('%s desk — %s')` → "Admin desk — Tsatsu") or compose the possessive with a
  real right-quote character outside `xl()`. Fixes every desk title and the sidebar labels.
- Grep the module for other `\'` inside `xl()`/`xlt` strings while there (one sweep).
- **Turned out to be two bugs, not one**: even with the apostrophe moved outside the first
  `xl()` call, `base.html.twig` pipes the *already-composed* title through a second `|xlt`
  filter (`page_title|xlt`), which re-mangled it. Fixed with a curly apostrophe (U+2019) —
  outside the backtick regex's reach — instead of trying to change the Twig contract (which
  also serves plain-string titles like "Queue slip" that genuinely need `|xlt`).
- Also swept `AppointmentTodayService`'s recurring-booking tooltip (same `\'`-in-`xl()` bug,
  different string).

### ADM-8 · Verify + docs
- Vitest: new AdminSidebar + search tests; AdminHub tests updated for the nav model;
  SetupChecklistCard untouched.
- E2E: `setup-checklist.spec.js` selectors re-pointed via the redirect map (assert the map
  itself: old `?tab=system` lands correctly).
- Full gates (composer verify for ADM-5's PHP, `npm run check`, build, asset bump,
  hard-refresh note) + browser QA at 1280/1024/390px + screenshots vs the artifact.
- Docs: ADMIN_CONFIGURATION_REDESIGN bumps to **v0.2.0** (nav model change) with history;
  README + scorecard rows synced; this plan marked executed.

**Order:** ADM-7 anytime (independent, ship first); ADM-1..3 are one navigation arc
(2 before 3 lands cleanly, 1 can ride with either); ADM-4..6 follow; ADM-8 closes. Sized as
2–3 working sessions; each ADM-* is one commit per the house convention.

---

## 4. States (per nc-design-screen)

| Region | Loading | Empty | Error | Success |
|---|---|---|---|---|
| Sidebar | renders immediately from static metadata (no fetch) | — | — | active section highlighted |
| Search | — | "No settings match {q}" + clear | — | grouped result list |
| Content pane | existing per-card loading states unchanged | per-card empty states unchanged | existing error callouts | cards |
| Override dot | — | absent when not overridden | reset failure → error callout, value preserved | dot + reset affordance |

## 5. A11y notes
- Sidebar is a `nav` with `aria-current="page"`, full keyboard operation, 44px rows,
  visible focus ring; drill-in mobile keeps a real back button (no gesture-only).
- Search results are a listbox with keyboard selection; the flash-highlight is supplemented
  by `aria-live` announcement of the destination.
- Color-only signals banned: override dot pairs with text, System warning dot pairs with label.

## 6. Open questions (defaults chosen — veto if wrong)
1. **Landing section**: while setup is incomplete, the page opens on **Setup** (banner then
   becomes redundant there but stays on other sections). After completion, lands on Clinic.
2. Section naming above ("Features" for the flag catalog) — better word welcome.
3. Mobile pattern: drill-in chosen over a horizontal scrolling strip (10+ categories don't
   strip well). 
4. ADM-5 reset semantics: "Use global value" deletes the facility row (true reset) rather
   than copying the global value into it. That's the honest model; veto if you prefer copy.

## 7. Explicitly out of scope
- Individual editors' internals (fee modal, importer, ACL matrix screens) beyond card chrome.
- The outer Twig shell/desks sidebar.
- Any `new_clinic_config` schema or key changes.

## 8. Addendum — individual content-page research pass (2026-07-18)

Outside the numbered ADM-* tasks: a researched pass over the individual tab content pages
(data-table CRUD UX, filter/search patterns, bulk-action guidelines) against what each page
actually does today.

**Findings:**
- Fees, Visit types, Address Book, and the Forms catalog are all the same shape (search a
  flat list, edit/archive a row). Address Book and Forms already had search + filter; **Fees
  and Visit types had none** — the clear outlier, and the two tables most likely to grow past
  a comfortable scan length.
- Clinic, Completion, and System are field-list/dashboard pages, not tables — the CRUD-table
  research doesn't apply there; no gap found.
- Staff Directory (People & access) already has server-side search + pagination — mature,
  no gap.
- `FormsCatalog`'s enabled/disabled toggle uses the `cta` (green) button variant for "On" —
  another instance of the one-accent-color violation ADM-4 already tracks; not fixed here,
  folded into ADM-4's variant audit.

**Shipped:** search box + "Show archived" toggle (default checked, so nothing changes for
existing clinics) + row-count line on **Fees** and **Visit types**, matching the exact pattern
already proven in Address Book/Forms catalog. No backend change — client-side filter only.

**Not done / candidates for a future pass:** bulk actions (e.g. archive multiple fee lines at
once) — research supports it for large tables, but no clinic has hit that scale yet, so it's
speculative until a real pain point shows up; sortable columns on these three tables.

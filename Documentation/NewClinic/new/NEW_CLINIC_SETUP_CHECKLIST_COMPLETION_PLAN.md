# Clinic Setup Checklist — Audit & Completion Plan (SETUP-*)

| Field | Value |
|-------|-------|
| **Document version** | 1.0.1 — second audit pass added C6, U5, U6, P7, A5, H1 (30 findings total) and §2.8 verified non-issues |
| **Date** | 2026-07-18 |
| **Status** | **Executed 2026-07-18** — all 30 findings addressed in one batch (asset version `-setupchk66`); live-smoked: truthful auto-detects (score moved 40%→55% on the dev clinic and the ACL row honestly flagged a real 0.2.9-vs-0.2.10 drift), mark/undo round-trip, banner + chip jump. Gotcha recorded: `xl()` converts quote marks to backticks — write xl strings without quotes |
| **Companion to** | `done/NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md` (M15-F11), PRD §24.4, Admin Hub island |
| **Scope** | The first-run "Setup checklist" experience: `SetupChecklistCard`, `AdminSetupProgressService`, its Admin Hub wiring, the header Setup chip, and everything wrong with them — correctness, UX, copy, i18n, a11y, tests |

---

## 1. What exists today (verified in code + live browser)

- Backend: `AdminSetupProgressService` builds 10 weighted items (weights sum to 100).
  5 auto-detect from real data (cash profile, ≥3 fee lines, visit type↔calendar,
  reconciliation run, backup health chip); 5 are manual "Mark done" rows stored in
  `admin_hub_setup_progress` (per facility, audited). "Mark setup complete" is gated at ≥70%
  and sets `new_clinic_config.admin_hub_setup_complete`.
- Frontend: `SetupChecklistCard` renders as the first card of the Admin Hub **System tab**
  (`SystemTab.tsx`), with a progress bar and per-row Mark done buttons. The facility strip
  shows a `Setup NN%` metric chip on every tab.
- ACL: actions alias to `admin.setup.mark_item` / `admin.setup.complete`, gated `new_admin` —
  correctly registered in `AjaxActionPolicy` (no ACL gap).
- Perf: progress reuses the pre-computed health payload to avoid a second scan of the huge
  `log` table — good, keep.

**What's genuinely good and must be preserved:** data-verified checks (not self-reported),
per-facility tracking, audit events on every tick, the ≥70% completion gate, health-payload
reuse.

---

## 2. Audit — every issue, by type

Severity: 🔴 wrong/broken · 🟠 misleading/blocking UX · 🟡 polish.

### 2.1 Correctness

| # | Finding | Severity |
|---|---|---|
| C1 | **"Cron / nightly jobs configured" is a false positive on a fresh install.** It auto-completes when `enable_scheduled_integration` and `reconciliation_enabled` are both on — and both **default to 1**. A brand-new clinic sees this item green with no host crontab in existence. Meanwhile `AdminHealthService` already has a real `cronChip` (freshness-based) that the checklist ignores. | 🔴 |
| C2 | **The card's "Setup complete" success state is dead code.** `SystemTab.tsx:78` hides the card entirely when `setup_complete` — the card's own success branch can never render. Its copy is also self-contradictory: "All checklist items finished (70%)" when you complete at 70%. | 🔴 |
| C3 | **Two manual items should be automatic.** "New Clinic ACL installed" is verifiable in code (`AclVersion` version compare vs the installed marker); "Staff accounts (owner + reception + doctor)" is countable from the `new_*` GACL group memberships (`gacl_aro_groups_map`). Today the honest checks are manual and the fake check (C1) is automatic — exactly backwards. | 🟠 |
| C4 | **No undo.** A mistaken "Mark done" is permanent (no un-mark), and once "Mark setup complete" is clicked there is no reopen — the flag can only be flipped by editing config directly. | 🟠 |
| C5 | **Completing setup erases the loose ends.** Complete at 70% and the ≤3 skipped items (e.g. backup never tested) vanish with the card. Nothing carries them forward. | 🟠 |
| C6 | **A broken/missing progress table fails silently.** `manualCompletions()` swallows every `Throwable` and returns `[]` — if the `admin_hub_setup_progress` table is missing (failed install/upgrade), all manual items just look permanently un-done and "Mark done" appears to do nothing, with no error anywhere. Log once + surface a health signal instead of a blanket catch. | 🟠 |

### 2.2 Discoverability / UX

| # | Finding | Severity |
|---|---|---|
| U1 | **A first-run wizard hidden in the last place a new owner looks**: the System tab. The default landing tab is Queue & roles. Nothing on landing points at setup. | 🔴 |
| U2 | **The `Setup 40%` header chip is a plain `<span>`** — it advertises progress on every tab but isn't clickable (verified in DOM). | 🟠 |
| U3 | **Hints say "go there" instead of taking you there.** Every hint names a tab that is one click away ("Fees tab → add starter schedule") but none is a link. The Admin Hub already has URL-addressable tabs (`?tab=system`), so deep links are cheap. | 🟠 |
| U4 | Manual rows' loading state is a bare "…" button label. | 🟡 |
| U5 | **The 70% rule is invisible until it's met.** "Mark setup complete" only appears once `can_mark_complete` is true — before that, nothing tells the owner a completion threshold exists or how far away it is. Add helper text ("You can mark setup complete at 70% — currently NN%"). | 🟡 |
| U6 | **Item weights are invisible**, so the progress bar jumps by unexplained amounts (staff accounts moves it 15 points, the safety drill 5). Show the per-item worth, or at least keep jumps from feeling arbitrary. | 🟡 |

### 2.3 Copy (breaks the standing plain-English rule)

| # | Current string | Problem |
|---|---|---|
| P1 | "Visit types tab → map **pc_catid**" | Internal DB column name shown to a clinic owner |
| P2 | "Module Manager **§17.4 step 4**" | Internal spec reference; means nothing to the user |
| P3 | "**PRD §24.4** worksheet" / "Pilot worksheet Q4–Q9 recorded" | PRD/pilot-team vocabulary in product UI |
| P4 | "**G12** safety drill signed (week 1)" / "Training log §17.2" | Internal codename + spec reference |
| P5 | "First-run wizard progress — NN% complete" | It isn't a wizard; jargon |
| P6 | "All checklist items finished (NN%)" | False when completed at <100% (see C2) |
| P7 | Server-side error strings are user-facing but untranslated and stiff ("Complete at least 70% of setup checklist before marking done", "This checklist item cannot be marked manually") | Route through `xl()` + rephrase in the copy pass |

All copy to be rewritten in plain English per the `nc-ux-copy` conventions (labels say what to
do, hints say where and how, no internal references — put doc references behind a "guide" link
if needed).

### 2.4 i18n

| # | Finding | Severity |
|---|---|---|
| I1 | Every string in `SetupChecklistCard` is a hardcoded literal; every checklist label/hint comes from the **PHP service** as untranslated English. Frontend strings route through `t()`; backend-supplied labels need `xl()` at the service (or key-based labels translated client-side — decide in build; prefer `xl()` server-side like other services). The admin-hub island is not yet in the D1 i18n fence — string routing lands now, full island migration stays a D1 task. | 🟠 |

### 2.5 Accessibility

| # | Finding | Severity |
|---|---|---|
| A1 | Row state is **icon-only** (green check vs grey circle, both `aria-hidden`) — a screen reader hears no done/not-done state at all. Needs visually-hidden state text or `aria-label` on the row. | 🟠 |
| A2 | The progress bar has `role="progressbar"` + values (good) but no accessible name ("Setup progress"). | 🟡 |
| A3 | The "…" marking state needs `aria-busy` / a real label ("Saving…"). | 🟡 |
| A4 | New hint links (U3) must be real links/buttons with descriptive names, not bare arrows. | 🟡 |
| A5 | **Five identical "Mark done" buttons with no per-item accessible name** — a screen-reader user tabbing the list hears "Mark done" five times with no way to tell which item each belongs to. Needs `aria-label="Mark {item} done"`. | 🟠 |

### 2.6 Semantics / edge cases

| # | Finding | Severity |
|---|---|---|
| S1 | The checklist follows the **scope picker** (global default = facility 0 vs a specific clinic). Correct per-facility design, but the card never says which clinic it is scoring — with the picker set to "All facilities" an owner could complete setup for facility 0 and wonder why the clinic chip still shows incomplete. Add a one-line scope caption to the card. | 🟡 |
| S2 | Backup item depends on the health board's backup chip being "ok" — fine, but if the health payload is stale the checklist lags; acceptable, note only. | 🟡 |

### 2.7 Tests

| # | Finding | Severity |
|---|---|---|
| T1 | No PHPUnit coverage for `AdminSetupProgressService` item logic (the C1 false positive shipped unnoticed). New auto-detect logic (C1/C3) needs unit tests with seeded config/rows. | 🟠 |
| T2 | Vitest: `AdminHub.test.tsx` doesn't exercise the checklist card states (rows, mark-done flow, complete-with-residuals, links). | 🟡 |
| H1 | Code hygiene: `getProgress()` and `buildItems()` each carry **two stacked PHPDoc blocks** (a stale one left above the real one) — confusing for the next reader; delete the stale ones in the same batch. | 🟡 |

### 2.8 Checked and confirmed NOT issues (don't re-chase these)

- **Duplicate manual ticks can't accumulate** — `admin_hub_setup_progress` has
  `PRIMARY KEY (facility_id, checklist_key)` (`install.sql:1368`), so the
  `ON DUPLICATE KEY UPDATE` upsert is sound.
- **Config import cannot fake-complete a clinic** — `AdminConfigImportService`
  explicitly excludes `admin_hub_setup_complete` (`EXCLUDED_SETTING_KEYS`).
- **`--color-oe-cta` is a real token** (#2bb350 in `tokens.css`), not another phantom
  like the old `--color-oe-warning` case — the card's hex fallback is unused.
- **ACL wiring is correct** — `admin_hub.setup_*` aliases map to `admin.setup.*`
  actions gated `new_admin` in `AjaxActionPolicy`.

---

## 3. The plan — one task ID per commit

### SETUP-1 · Truthful checks (backend)
- C1: `cron_configured` auto-check consumes the health `cronChip` status (fresh = done),
  falling back to the manual tick; drop the defaults-on flag heuristic.
- C3: `acl_installed` auto-checks the installed ACL version marker vs `AclVersion::VERSION`;
  `staff_accounts` auto-checks that at least one active user sits in each of the reception
  and doctor lead groups plus an admin (single bounded query over `gacl` tables). Both keep
  the manual tick as an override for unusual installs.
- C6: replace the blanket `catch (\Throwable)` in `manualCompletions()` with a one-time
  logged warning so a missing/broken progress table is visible instead of silently
  un-ticking everything.
- H1: delete the stale duplicated PHPDoc blocks while in the file.
- Unit tests (T1) for all three + the existing items' thresholds.
- Rules: bounded queries only; reuse the passed-in health payload (no second log scan);
  no constructor cycles (lazy getters if any new service references) — run the verifier.

### SETUP-2 · Undo, reopen, and honest completion (backend + card)
- C4: new `admin.setup.unmark_item` (deletes the manual row, audited) and
  `admin.setup.reopen` (flips `admin_hub_setup_complete` back to 0, audited); policy entries
  + aliases + handler cases; ACL `new_admin` like their siblings.
- C2/C5: the card stays rendered after completion in a collapsed success state that
  **lists any residual incomplete items** ("Completed at 80% — 2 items left: …") with a
  "Reopen setup" action; fix the contradictory copy; remove the `SystemTab` outer hide so the
  card owns its states (delete the dead branch mismatch).
- U5: before the threshold is reached, the card explains the rule ("You can mark setup
  complete at 70% — currently NN%").
- U6: each row shows what it's worth (small "+15%" style tag) so the bar's jumps make sense.

### SETUP-3 · Plain-English copy + i18n
- Rewrite every label and hint (P1–P6) in plain English, regionally neutral; internal doc
  references move behind a small "Setup guide" link at the card foot (single place), not
  per-row spec citations. Draft copy to be reviewed against `nc-ux-copy` conventions in the
  build session.
- I1: backend labels/hints through `xl()`; card strings through `t()`; run `i18n:extract`.
- P7: the service's user-facing exception messages rephrased and routed through `xl()`.

### SETUP-4 · Take-me-there hints + a11y
- U3: each incomplete row gets a real action — tab-switch links for Clinic / Fees /
  Visit types / People & access, and in-tab anchors for the System-tab items (reconcile,
  backup). Uses the existing `?tab=` state, no new routing.
- A1–A5: row state announced (visually-hidden "Done"/"To do"), named progress bar,
  proper busy labels, descriptive link names, and per-item accessible names on the five
  "Mark done" buttons (`aria-label="Mark {item} done"`).
- U4: "Saving…" instead of "…".
- S1: scope caption on the card ("Scoring: {clinic name / global default}").

### SETUP-5 · Discoverability
- U2: the header `Setup NN%` chip becomes a button → jumps to the System tab and scrolls
  to the checklist card (it already has an id).
- U1: while setup is incomplete, a slim one-line "Finish setting up this clinic — NN% done →"
  callout shows under the facility strip **on every Admin Hub tab** (accent tone, not an
  alarm), linking to the same place. Disappears at completion. No new flag — it derives from
  the existing payload.

### SETUP-6 · Verify + docs
- `composer verify:new-clinic` (PHP changed), PHPUnit for the service, Vitest suite,
  `npm run check`, build, **asset version bump**, hard-refresh instruction.
- Browser smoke: fresh-clinic simulation (facility with nothing configured → verify C1 shows
  NOT done), mark/unmark, complete-with-residuals, reopen, chip click, hint links.
- Docs: `NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md` version bump + history row
  (M15-F11 amendment: auto-detects, unmark/reopen, discoverability), scorecard + README sync.

**Order:** SETUP-1 → 2 are backend-led and independent of 3 → 5 (frontend-led); 6 closes.
One batch, one version bump at the end, per the house audit→fix-all rule.

---

## 4. Explicitly out of scope (needs a separate decision)
- A true multi-step setup **wizard** (guided form flow) replacing the checklist — the PRD
  calls this surface a checklist (M15-F11); a wizard would be a spec amendment.
- Auto-provisioning actions from the checklist (e.g. "create the 3 staff accounts for me") —
  attractive, but touches user creation policy; propose separately.
- Localizing the referenced install/training guides themselves.

## 5. Open questions (defaults chosen — veto if wrong)
1. `staff_accounts` auto-check definition: ≥1 active member in each of reception-lead,
   doctor-lead, admin groups. (Solo-operator clinics: one login in all three groups passes —
   consistent with D-STAFF-1.)
2. The every-tab "finish setup" callout: shown until completion with no dismiss (it's small).
   Add a dismiss-for-session if it annoys in practice.
3. Completion threshold stays 70%.

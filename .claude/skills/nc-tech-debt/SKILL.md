---
name: nc-tech-debt
description: Run a structured tech-debt or hardening audit of a New Clinic area — inventory issues critical-to-low across every render path, produce a todo list, then fix ALL of it in one pass with one version bump
---

# New Clinic tech-debt audit & burn-down

The user's expected shape is **audit → todo → fix ALL → one version bump**. Partial fixes
that trigger repeated "not fixed" hard-refresh reports are the #1 frustration. Do not stop
at the first instance of a problem — grep for every render path it appears in
(see `.cursor/rules/new-clinic-big-picture-first.mdc`).

## 1. Scope the audit

Agree the target: one island/desk, one service cluster, or one theme (performance, a11y,
token compliance, TS debt). Note that repo-wide `npm run typecheck` is NOT in CI — TS debt
hides there; run it locally when auditing types.

## 2. Inventory (read-only pass, no fixes yet)

Sweep for the known debt classes:

- **Crash risks:** eager ctor trees / service cycles, missing AjaxController `use` imports,
  stray `.broken`/`.bak` files in `src/`.
- **Scalability (SCALE-*):** polling without `session_write_close()`, unbounded desk
  queries, reads that write, new polls violating R1–R8 — map each finding to a SCALE task
  in `Documentation/NewClinic/new/NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md` or propose
  a new one.
- **Convention drift:** hardcoded hex / arbitrary Tailwind palette instead of `--oe-nc-*`
  tokens; inline wait-time formatting instead of `WaitTimeSpan`/`QueueCard`; Bootstrap
  alerts instead of `nc-*-callout`; `res.ok` checks; direct `fetch`; re-solved centering.
- **Type/test debt:** `any` without justification, islands missing `*.test.tsx`,
  `console.log`, skipped tests.
- **Facility scoping:** filters that disagree about `facility_id=0`.
- **Doc rot:** scorecard/spec cells contradicting the code.

Output a numbered todo list ordered critical → low, each item with file(s), render paths
affected, and the fix. Get a "proceed" only if scope grew beyond what was asked; otherwise
keep going — the user prefers continuous execution over option menus.

## 3. Fix pass

Fix every item in order, critical → low, across ALL render paths found. Batch edits per
area; one `ModuleAssetVersion.php` bump for the whole batch, not per file. One SCALE task
ID per commit for hardening commits (Conventional Commits, e.g.
`perf(new-clinic): bounded queue query (SCALE-1.1)`).

## 4. Verify

Run the full gate set via `/verify-batch` (scoped Vitest → `npm run check` → build →
version bump; `composer verify:new-clinic` for PHP; browser smoke). Update the scorecard /
plan docs for anything the audit proved stale — same batch.

## 5. Report honestly

List each todo item as fixed/deferred (with reason), the verification results verbatim,
remaining known debt, and a realistic statement of what this bought (e.g. headroom
estimates with ranges, not "infinitely scalable").

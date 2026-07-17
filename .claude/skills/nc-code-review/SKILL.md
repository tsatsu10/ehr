---
name: nc-code-review
description: Review a diff, branch, or set of files against New Clinic conventions — island rules, PHP crash patterns, token/CSS rules, ACL boundaries — and report findings critical-to-low in one pass
---

# New Clinic code review

Review the requested changes in ONE structured pass, ordered critical → low. Cover every
render path a finding applies to (partial fixes that surface one hard-refresh at a time are
the #1 frustration). If more than 3 files are affected, list them before the findings.

## Critical — crash and correctness patterns

- **Constructor cycles (PHP):** any eager service construction
  (`private readonly Foo $foo = new Foo()`) that can loop back. Known hot cycle:
  `DoctorService` ↔ `ClinicalDocDocumentationStatusService` ↔ `EncounterNoteService`.
  Require lazy getters. These crash Apache child processes on Windows (stack overflow
  0xc00000fd → `ERR_CONNECTION_RESET`).
- **AjaxController imports:** every `new XxxService()` in `AjaxController` needs its
  `use OpenEMR\Modules\NewClinic\Services\XxxService;` — a missing import fatals EVERY
  ajax request with a 500.
- **Envelope handling:** islands must use `oeFetch<T>(action)` from `@core/oeFetch`, never
  raw `fetch`, never REST/FHIR for desk work. Envelope is `{ success, data | error }`;
  legacy `postJson()` returns `{ status, payload }` — flag any `res.ok` check. Flag params
  that can be `undefined`/`null` reaching the URL (literal `"undefined"` bug).
- **Queue FSM / lifecycle:** encounter created at **Start visit** only (Take patient is a
  queue claim); cash checkout only at `ready_for_payment`; e-sign is never optional;
  deep links into core must set `$_SESSION['pid']`/`$_SESSION['encounter']` (wrong-patient
  prevention, G12).
- **Facility scoping:** queue-list filters and duplicate-check filters must align —
  `facility_id=0` visits vanishing from scoped queues while still blocking new visits is a
  known bug class.
- **Feature flags (PRD §5.6):** every post-pilot surface behind an `enable_*` flag in
  `new_clinic_config`, default OFF; flag OFF must be 100% legacy behavior with no half-new
  chrome.

## High — architecture and security boundaries

- ACL enforced in PHP services, never in React; no business logic in components.
- Services extend `BaseService` with `TABLE_NAME` const; module code stays under
  `OpenEMR\Modules\NewClinic\`; no `declare(strict_types=1)`.
- No `.broken`/`.bak` files left in `src/` (verifier fails on them).
- No new polls or unbounded desk queries that violate the scalability plan's R1–R8 rules
  (see `Documentation/NewClinic/new/NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md`).

## Medium — frontend conventions

- All colors/spacing from `--oe-nc-*` tokens; no hardcoded hex, no arbitrary Tailwind
  palette classes. CSS class names use the `nc-` prefix.
- Island visual styles as non-layered BEM CSS in the island's `main.css` (Tailwind 4
  `@layer utilities` loses to unlayered Bootstrap 4). Tailwind utilities only where
  Bootstrap doesn't compete.
- Wait time rendered via `<WaitTimeSpan />` / `QueueCard`, never inline formatting.
- Feedback via token callouts (`nc-error-callout` etc. from `@components/deskCalloutStyles`),
  `showDeskToast()`, `ConfirmModal` for destructive/identity actions; Badge variant
  `neutral`, not `secondary`. No Bootstrap alerts in islands.
- Don't re-solve layout centering per island (`.nc-shell-main` owns it; Visit Board is the
  deliberate full-width exception).
- Forms: inline validation while typing, no wipe on error, form disappears after successful
  save, registration stays an accordion.
- Regional: DD/MM/YYYY, configurable currency (never hardcode `$` or GHS), insurance UI
  hidden when `enable_insurance=false`.

## Low — hygiene

- TS strict, no `any` without a justifying comment; no `console.log`; every island has
  `*.test.tsx`.
- A11y: aria-labels on icon buttons, 44px touch targets, visible focus ring,
  `prefers-reduced-motion` guard, Lucide icons (no emoji icons).
- 4-space indent, LF endings, file-header docblocks preserved.
- Commit message is Conventional Commits with correct scope; one SCALE task ID per commit
  for hardening work.

## Output

Findings grouped by severity, each with file:line, what's wrong, and the concrete fix.
End with the verification gates the author must run (defer to `/verify-batch`).

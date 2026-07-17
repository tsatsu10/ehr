---
name: nc-testing-strategy
description: Plan or extend test coverage for a New Clinic feature — pick the right layers from the test matrix (Vitest, PHPUnit, contract tests, Playwright golden paths, HTTP smokes) and write the plan
---

# New Clinic testing strategy

## The matrix (choose layers, don't default to one)

| Layer | Tool | Where | Run |
|---|---|---|---|
| Island unit/component | Vitest 4 | `frontend/src/islands/**/*.test.tsx` | `cd frontend; npm test -- --run src/islands/<island>` |
| Module PHP unit | PHPUnit 11 | `tests/Tests/Unit/Modules/NewClinic` | `vendor\bin\phpunit -c phpunit.xml tests\Tests\Unit\Modules\NewClinic` |
| Contract (mandatory) | PHPUnit | queue FSM, wrong-patient, audit timeline | `composer test:new-clinic-mandatory` |
| Integration | PHPUnit | `-c phpunit.integration.xml` | host XAMPP |
| E2E golden path | Playwright | `tests/e2e/new-clinic/specs/` | `npx playwright test tests/e2e/new-clinic/specs/<spec> --config tests/e2e/new-clinic/playwright.config.js` |
| HTTP smokes / sign-off | module `scripts/` | e.g. `composer registry-signoff`, `composer people-signoff` | host |
| Static gate | composer | syntax, ctor cycles, imports | `composer verify:new-clinic` |

Playwright golden paths need seeded fixtures (`scripts/e2e-prep-golden-path.php` and
siblings) — include the prep step in any E2E plan.

## What to cover, by change type

- **New/changed ajax action or service:** PHPUnit unit tests for the service; contract
  tests if it touches the queue FSM, encounter lifecycle, payment gating, or e-sign;
  assert the `{ success, data | error }` envelope shape including error cases.
- **New/changed island:** `*.test.tsx` colocated — states (loading/empty/error/success),
  user interactions, inline validation while typing, form-not-wiped-on-error,
  form-disappears-after-save. jsdom quirks: `ResizeObserver` mock and `scrollIntoView`
  stub live in `frontend/src/test-setup.ts` (needed for cmdk/Radix).
- **Lifecycle/FSM changes:** contract tests are mandatory, not optional — every state
  transition, plus wrong-patient prevention (`$_SESSION['pid']`/`['encounter']`) and
  facility-scoping edge cases (`facility_id=0`).
- **Flag-gated surfaces:** test BOTH sides — flag ON behavior and flag OFF being 100%
  legacy (no half-new chrome). Parity sign-off needs the legacy screen still reachable.
- **Cross-desk flows (golden paths):** registration → queue → start visit → consult →
  ready_for_payment → cash checkout → e-sign. Extend the existing golden-path spec rather
  than duplicating it.
- **Regional/a11y:** DD/MM/YYYY rendering, configurable currency (no hardcoded symbol),
  insurance UI hidden when `enable_insurance=false`, aria-labels, focus ring,
  reduced-motion.

## Constraints to plan around

- CI (`new-clinic-verify.yml`) runs static PHP verify + scoped Vitest (front-desk,
  patient-registry, visit-board) + Vite build only. No MySQL in CI ⇒
  `composer verify:new-clinic`, integration tests, and smokes are desktop-only gates.
  If the change's tests aren't in CI's scoped list, say so and require the local run.
- Repo-wide `npm run typecheck` is not in CI (TS debt) — include a local run when types
  change.
- Backend PHP written on mobile (Cursor iOS) is draft until desktop verification — a test
  plan for mobile-authored code must start with the desktop gates.

## Output

A short plan: layers chosen and why, the specific test files to add/extend with named
cases, fixture/seed needs, the exact run commands, and what stays desktop-only vs CI.
Finish by pointing execution at `/verify-batch`.

# Branch status — `new-clinic/scalability-hardening` (2026-07-15)

Two workstreams are live on this branch at once. This note separates what's done and green
from what's still blocking a clean, mergeable state — so the pieces can be coordinated.

## ✅ Workstream A — CBILL cashier-billing roadmap (COMPLETE, verified green)

The whole cashier-billing roadmap is built, audited, committed, and **independently verifies
green** (checked out at `069252aa` in an isolated worktree: module verify PASS — syntax, 0
cycles, imports, artifacts, ajax crosscheck 323 actions).

| Slice | Commit |
|-------|--------|
| CBILL-1 pharmacy charges at the cashier | `643d9cb2` |
| CBILL-2 partial payment | `b8a4d8c1` |
| PRD amendment D-BILL-7/8 (authorises partial pay + scheme-split) | `72b5a23c` |
| CBILL-1/2 audit fixes (owed-list counts medicines) | `36f48317` |
| CBILL-3a scheme-split data + service | `58faa48a` |
| CBILL-3b cashier scheme screen | `72c94a6d` |
| CBILL-3 audit fix (server recomputes split — tamper-proof) | `cdbc1013` |
| CBILL-3c claims register (M14) | `47ce4eca` |
| CBILL-3c CSV export + test | `47ad328e` |
| CBILL-3 spec + scorecard rows | `069252aa` |

Every feature is behind an `enable_*` flag, default OFF; each has PHPUnit/Vitest + a live
CLI smoke. **Not done for CBILL:** a logged-in browser click-through of the scheme screen
(validated via CLI smokes instead); README index-row reconciliation (1 PRD-version bump + 2
doc rows, left because the README is interleaved with Workstream B's doc edits).

## 🔴 Workstream B — blocks the branch verify (owner: the other session)

Current branch HEAD (`3198f27f`) is **RED**. Both causes are Workstream B, not CBILL:

1. **Committed, incomplete — referral editor.** `composer verify` crosscheck fails:
   `chart_depth.referral_editor_get` and `chart_depth.referral_update` have front-end callers
   in committed code, but their `AjaxActionPolicy` entries are **uncommitted** (present in the
   working tree, lines ~139–140). → Commit the policy entries (they already map to
   `new_chart_depth_referral`).
2. **Uncommitted — other-payment/deposits feature.** `cashier.other_payment.context` / `.post`
   (+ `CashierOtherPaymentService`, `OtherPaymentModal`, `can_other_payments` wiring) are in the
   working tree with no committed caller → these trip the crosscheck's "zero callers" rule until
   committed/allowlisted.
3. **`bs:check` RED** — the `border` Tailwind-colliding count went 100→101 in Workstream B's
   uncommitted files (referral/comms panes). → resolve the class or `npm run bs:baseline`.

Plus the large uncommitted pile (~380 dirty + ~321 untracked): native history/immunization,
pharm-ops, comms, report-hub, i18n regen, built assets.

## To make the branch clean + mergeable

1. Workstream B commits its finished features with proper messages (fixes #1, #2 above).
2. Resolve the `bs:check` `border` increase (#3).
3. Reconcile the shared docs (README/scorecard/PAGE_DESIGNS) — both sessions' rows together;
   CBILL's 2 README rows + PRD-version bump fold in here.
4. One clean full pass: `composer verify:new-clinic` + `cd frontend; npm run check` + a browser
   smoke (incl. the CBILL scheme screen click-through that's still outstanding).

**CBILL (Workstream A) needs none of the above — it's green on its own and merges clean.**

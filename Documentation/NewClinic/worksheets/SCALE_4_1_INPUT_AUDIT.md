# SCALE-4.1 — AJAX input-hardening audit checklist

**Date:** 2026-07-13 · **Scope:** all 301 dispatchable actions across the 23 `Controllers/Ajax/Handlers/*` files, plus every service that builds a `LIKE` needle. Method: full grep of every `$_REQUEST[` / `$body[` / `$params[` / `$_POST[` extraction site (the complete input surface), targeted reads of every flagged site, live fuzz drill.

## Boundary-wide verdicts (checked across ALL handlers)

| Class | Verdict | Evidence / fix |
|---|---|---|
| SQL injection | **Safe (no change)** | Zero string-concatenated SQL with user input anywhere in module `src/` (two grep patterns, incl. multi-keyword). All LIKE needles enter via bind arrays. Dynamic SQL fragments are placeholders lists, fixed column maps, or int-cast limits only. |
| Id params cast to int | **Safe (no change)** | Every id-shaped param (`visit_id`, `pid`, `user_id`, `*_id`, `row_version`, `pc_eid`…) at every extraction site is `(int)`-cast or `parseOptionalPositiveInt()`. Negative/huge ids fuzz to clean empty/404 envelopes. |
| Pagination clamps | **Safe (no change)** | Every client `limit`/`offset`/`page_size` is clamped — most in the consuming service (`min(max($limit,1),50)` pattern: BillOps×2, PaymentHistory, ReferralCorrespondence, PatientChart×3, ActivityFeed, Documents×2, OfficeNotes, CommunicationsHub, AuditLog≤200, Cohort, Staff, AppointmentToday≤100, OtcSearch≤50, ReportHubExport≤200), rest at the handler (audit `page_size`≤100, queue_bridge `page`≥1). Fuzz: `page_size=999999` → 200, clamped. |
| Search strings → LIKE | **FIXED** | New `Support\Sanitize::searchToken()` (64-char cap, control-char strip, no metachar escaping — semantics preserved) wired into all 11 services that build LIKE needles from client input: PatientSearch (via `normalizeQuery`), BillOpsPaymentsSearch, AuditLog (`user`+`q`), Doctor (`searchProviders`), FacilityUserAdmin, SchedulingRecalls, StaffAdmin, FeeScheduleAdmin (billing codes), PharmCatalogAdmin, PharmOpsOtcSale, PatientCohortSearch (name/mrn/phone/national_id/nhis/allergy/medication/problem-title/lab-test/icd-prefix). Already safe: PatientChartSearch (pre-existing 80-char cap), ReportHubPublicHealthNative (terms from admin-managed `new_condition_map`, not client), CommunicationsHub `q` (PHP-side filter of stock pnotes, no LIKE), literal-LIKE services (PatientContext, PharmOpsDestroy/Controlled, Reports*, VisitQueue). |
| Date params | **FIXED** | New `Sanitize::dayOrDefault()/dayOrNull()` (strict Y-m-d, round-trip check rejects overflow like `2026-02-31`; malformed → 400 validation envelope; empty → caller default) exposed as `AjaxController::validDay()/validDayOrNull()` and wired into all 28 day-param sites: visit_date (board + 5 desk queues + doctor nullable + triage + reports), scheduling `date`×6 + recall `due_date`, reports start/end/run_date ×9, bill_ops daysheet `date`×2, chart_depth + communications `date_from/to`, admin `run_date`, lab/pharm worklist `date`, visit/queue-bridge `appt_date`. Already safe: AuditLogService (pre-existing regex), BillOpsPaymentsSearch (`normalizeOptionalDate`), PerfCounter (SCALE-4.5 validation). |
| JSON body size | **FIXED** | `AjaxController`: 32 MB hard ceiling checked from `CONTENT_LENGTH` **before** the body is read into memory; 1 MB per-action budget after action resolution, exempting only the vetted `AjaxActionPolicy::LARGE_BODY_ACTIONS` (documents.upload, front_desk.upload_referral, lab_ops.panel_import, admin.fee.import, pharm_ops.formulary_import, admin.config.import, admin.his_pack_import — the two uploads are multipart `$_FILES`, the rest carry CSV/snapshot JSON). 413 `payload_too_large` envelope; allowlist guarded by a real-action crosscheck test. |

## Per-handler notes (beyond the classes above)

| Handler | Actions | Notes |
|---|---|---|
| Visit / Triage / Doctor / Cashier / Lab / Pharmacy | 40 | int ids + row_version everywhere; free-text (reasons, chief_complaint, notes) parameterized, bounded by the 1 MB body cap. visit_date now validated. |
| Admin | 60+ | Settings/lists/fees maps validated in services; `scope` normalized to enum; passwords never logged; audit `q`/`user` capped; `run_date` validated. |
| Scheduling | 20 | `date`/`due_date` validated; `view`/`bucket`/`status` are enum-checked downstream; provider ids via `parseOptionalPositiveInt`. |
| Patients / Cohort / ChartDepth | 35 | search q capped; cohort filter strings capped (10 fields); diagnosis date range validated; export ids int-cast; `include` arrays type-checked. |
| Reports / LabOps / PharmOps / BillOps | 45 | all date ranges validated; CSV imports on the large-body allowlist; worklist filters enum/int; daysheet date validated. |
| Communications / Documents / OfficeNotes / FrontDesk / Profile / QueueBridge / Outreach | 45 | stock-pnotes filters pass through typed keys; upload is multipart (allowlisted); reminder-log date range validated; profile secrets `(string)`-cast, never echoed. |

## Fuzz drill (live, 2026-07-13) — all 12 cases clean

negative visit_id → 400; pid=99999999999 → 200 empty; 10 KB `q` via POST → 200 (capped, 0.31 s); 6 KB GET searches → 200 fast (Apache's own `LimitRequestLine` 414s anything ≥ 8 KB in a URL before PHP runs); `page_size=999999` → 200 clamped; `limit=999999&offset=-5` → 200 clamped; 3 malformed/overflow dates → 400 validation envelopes; valid date → 200; 1.5 MB body on `cashier.pay` → 413. No PHP warnings/HTML in any response.

**Known cost (accepted):** `admin.audit.query` free-text search scans core `log` (~11 s on this box) even with the capped needle — the table is huge because OpenEMR logs every query, and the triple-LIKE can't use an index. Bounded by the SCALE-4.2 10 s per-statement budget (2 statements → ≤ ~20 s worst case), admin-only, rate-limited. An index/limit change on core `log` is out of module scope.

## Follow-up self-audit (2026-07-13, same day) — 1 finding, fixed

Re-reviewed the SCALE-4.1 diff end-to-end line by line (not just the checklist) looking for
ordering bugs in the new body-budget code specifically, since that logic runs earliest in the
request lifecycle and is easiest to get an ordering wrong in.

**Found (Medium):** `AjaxController::resolveRequestAction()`'s fallback path — used when `action`
isn't in `$_REQUEST` and the caller instead embeds it in the JSON body — called `readJsonBody()`
(a `file_get_contents('php://input')` slurp) **before** the new 1 MB per-action budget check ran,
because the budget check needs to know the action first to consult `LARGE_BODY_ACTIONS`, and the
fallback exists precisely to *find* the action. A crafted POST with `action` omitted from the URL
and a large JSON body would bypass the 1 MB budget's "never read more than 1 MB into memory for
an ordinary action" guarantee (still bounded by the outer 32 MB hard `CONTENT_LENGTH` ceiling and
PHP's own `post_max_size`, so not a full memory-exhaustion path — but it defeated the specific
devil-proofing invariant this task exists to establish). Every real caller (`oeFetch`, legacy
`postJson()`) always puts `action` in the query string, so this only affects a caller that
deliberately skips that convention.

**Fix:** gate the fallback body read itself by the same `CONTENT_LENGTH` check — if it exceeds
1 MB, skip the read (action resolves to `''`, which the existing size check then rejects with a
clean `413 payload_too_large` — a better response than the `400 Unknown action` a hypothetical
huge-but-under-the-cap body-only call would have produced anyway). No real caller is affected,
since none rely on this fallback in the first place.

**Verified live:** a small action-only-in-body POST still resolves and dispatches correctly
(200, `queue.counts`); a 1.5 MB action-only-in-body POST returns `413 payload_too_large` in
0.22 s instead of parsing the full body first. `composer verify:new-clinic` PASS; 1044 module
tests green (no regressions — this path had no prior unit coverage, consistent with the rest of
`AjaxController`'s HTTP-only-testable surface).

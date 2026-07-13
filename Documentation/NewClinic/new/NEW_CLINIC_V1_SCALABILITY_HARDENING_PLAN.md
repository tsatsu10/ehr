# New Clinic V1 — Scalability & Hardening Plan

**Version:** 1.1.0
**Date:** 2026-07-06 (last update 2026-07-13)
**Status:** **Phases 0–6 all executed** (SCALE-5.3 stays deliberately deferred — optional, measurement-gated). Phase 6 (§8A, from a 2026-07-13 post-launch online-research review) is complete: SCALE-6.1 cache-stampede, 6.2 connection ceiling, 6.3 history retention, 6.4 alerting — all built + live-verified. The fifth review finding (offline/connectivity) resolved via brainstorm to the **Outage Runbook** (`NEW_CLINIC_OUTAGE_RUNBOOK.md`) since the decided on-prem posture already tolerates internet loss; an offline-capture app stays a V2/PRD-gated item. Trust each task's inline **Status** block over this header; new findings get their own SCALE task or a documented audit fix, not a plan rewrite.
**Audience:** Any developer or AI agent (including small models / Cursor iOS app). Every task is self-contained: it says WHERE to change, WHAT to change, and HOW TO VERIFY. Execute tasks one at a time, in order, unless a task says it is independent.

---

## 0. How to use this document (READ FIRST)

1. Work through phases in order: **Phase 0 → 1 → 2 → 3 → 4 → 5**. Earlier phases unblock later ones and give the biggest wins.
2. Each task has an ID like `SCALE-1.3`. Do ONE task per session/PR. Never mix two tasks in one commit.
3. Every task ends with a **Verify** section. Do not mark a task done until every Verify step passes.
4. After any PHP change, run the module gate: `php interface/modules/custom_modules/oe-module-new-clinic/scripts/verify-module.php`
5. After any frontend change, rebuild islands (`npm run build` inside `frontend/`) and bump the asset version ONCE at the end of the task (per the module big-picture rule).
6. Follow the workspace rule **new-clinic-big-picture-first.mdc**: before editing, grep the whole module for every call site of the thing you are changing, list them, and fix them all in one pass.
7. Commit messages: Conventional Commits, e.g. `perf(new-clinic): add session_write_close to read-only ajax actions (SCALE-1.1)`.

### Key paths

| Thing | Path |
|---|---|
| PHP module root | `interface/modules/custom_modules/oe-module-new-clinic/` |
| AJAX entry | `.../oe-module-new-clinic/public/ajax.php` → `src/Controllers/AjaxController.php` |
| Services | `.../oe-module-new-clinic/src/Services/` |
| SQL install | `.../oe-module-new-clinic/sql/install.sql` |
| React source | `frontend/` (repo root — NOT inside the module folder) |
| Built islands | `.../oe-module-new-clinic/public/assets/modern/` |
| Legacy shell JS | `.../oe-module-new-clinic/public/assets/js/` |
| Unit tests | `tests/Tests/Unit/Modules/NewClinic/` |

---

## 1. Executive summary — what limits scale today

The module works well for one clinic on one XAMPP box. It will degrade under load because of, in severity order:

1. **PHP session lock held for entire request** — no `session_write_close()` anywhere. One user with 3 tabs open serializes ALL their requests. This is the single biggest concurrency killer.
2. **Unbounded queue queries** — every desk poll (`visit.board`, `triage.queue`, `doctor.queue`, `cashier.queue`, `lab.queue`, `pharmacy.queue`, `queue.list`) runs `SELECT v.* FROM new_visit ...` with **no LIMIT**. Payload and DB cost grow linearly with clinic volume.
3. **Writes on every read** — `VisitScopeService::repairOrphanVisits()` runs `UPDATE ... JOIN form_encounter` on virtually every poll from every open tab. Write amplification that will contend under load.
4. **Config loaded key-by-key from DB** — `ClinicConfigService::get()` issues up to 3 SELECTs per key; the admin settings page loops ~125 keys (~125–375 queries per load). Hot toggles are re-queried on every poll.
5. **N+1 in patient search** — `PatientSearchService::mapResultRow()` runs 3 queries per result row (up to 24 extra round-trips per keystroke-search).
6. **Long-running work inline in web requests** — CSV export "async" jobs actually complete inside the status-poll request (`ReportHubExportService::pollExportStatus()` with `set_time_limit(0)`), PDF exports and cohort exports (up to 5000 rows) render inline. These pin PHP workers.
7. **Heavy per-request bootstrapping** — `AjaxController::__construct()` eagerly builds ~90 services on every hit, including trivial polls like `queue.counts`.
8. **Polling storm from the frontend** — legacy shell polls `queue.counts` every 30 s even when the tab is hidden; desk islands poll every 10–30 s with no jitter (thundering herd at shift start); doctor desk re-fetches the roster on every queue poll; no client-side cache/dedup layer (no React Query/SWR).
9. **Single-server assumptions** — file sessions, session-based rate-limit counters, export CSVs written to local disk (`sites/<site>/documents/nc_report_exports/`), static in-process dedup caches. Any of these break the moment a second web server appears.
10. **No real-time transport** — everything is polling; no SSE/WebSocket, so lowering latency means raising poll frequency, which raises load quadratically with users.

What is ALREADY good (do not regress): per-island Vite bundles, revision-based delta polls in scheduling, batch enrichment in `VisitRowEnricher`, pagination in comms/registry/report-hub, tab-hidden poll skipping in `useInterval`, DB-backed user settings, idempotent cashier payments via `new_cashier_payment_request`.

---

## 2. Target architecture (the north star)

Stateless web tier → shared cache → queue for heavy work → single writable DB with read replicas → object storage for files → observability everywhere.

```
Browser (islands, SSE + cached polls)
   │
CDN / static assets (immutable, hashed)
   │
Load balancer (no sticky sessions needed)
   │
N × PHP-FPM app servers  ── stateless: sessions in Redis, no local files
   │            │
   │            ├── Redis: sessions, config cache, rate limits, queue-counts cache, locks
   │            ├── Job queue (DB-backed table first, Redis/worker later): exports, PDFs, imports
   │            └── Object storage / shared volume: export files, uploaded documents
   │
MySQL primary (writes) + read replicas (queue/board/report reads)
```

Guiding rules for ALL future code in this module:

- **R1. No unbounded queries.** Every list query has a `LIMIT`. Every list endpoint is paginated or explicitly capped with a documented cap constant.
- **R2. Reads never write.** Repair/backfill/normalize jobs run out-of-band, never inside a GET/poll handler.
- **R3. Release the session lock early.** Any handler that will not write to `$_SESSION` calls `session_write_close()` before doing DB work.
- **R4. Cache config, not queries-per-key.** Settings load once per request (one query), cached cross-request when a cache layer exists.
- **R5. Heavy work goes to a job.** Anything that can exceed ~2 s (CSV, PDF, import, bulk update) is enqueued and polled, and the poll NEVER does the work.
- **R6. No local state.** No writes to local disk (except tmp), no static cross-request caches assumed shared, no session-only counters for cross-user concerns.
- **R7. Everything has a timeout and a budget.** DB statements, HTTP calls, loops over rows: bounded.
- **R8. Version every payload.** Poll endpoints accept a `revision`/`etag` and return `304`-style "not changed" responses (scheduling already does this — copy that pattern).

---

## 3. Phase 0 — Measurement baseline (do this before optimizing)

> "Measure before optimising." You cannot prove a fix worked without a baseline.

### SCALE-0.1 — Add server-side timing to ajax.php

- **Files:** `src/Controllers/AjaxController.php`
- **Do:** In `handleRequest()`, record `$t0 = microtime(true)` at entry. In a `finally` block around the dispatch switch, compute duration and query count (ADODB exposes a counter via `$GLOBALS['adodb']['db']`; if not reliably available, at minimum log duration). When duration > 500 ms OR the request errored, write ONE structured line via `error_log()`: `NC_PERF action=<action> ms=<int> user=<authUserID> facility=<id>`. Do NOT log per-fast-request (avoid log spam); only slow/error requests.
- **Do NOT:** add any external logging library in this task.
- **Verify:** Hit `ajax.php?action=queue.counts` in a browser while logged in; artificially add `usleep(600000)` locally to confirm a `NC_PERF` line appears in `C:\xampp\apache\logs\error.log`, then remove the sleep. Run `verify-module.php`.

### SCALE-0.2 — Create a load-test script

- **Files (new):** `.../oe-module-new-clinic/scripts/load-test.php` with a usage comment header (purpose, inputs, how to run).
- **Do:** CLI script that, given a session cookie + CSRF token + base URL, fires N concurrent-ish requests (curl_multi) at a chosen action (`queue.counts`, `visit.board`, `patients.search`) and prints p50/p95/p99 latency and error count. Default `--requests=50 --concurrency=10 --dry-run` prints what it WOULD do; `--run` executes.
- **Verify:** Run against local XAMPP with 50 requests to `queue.counts`; record the numbers in a new file `Documentation/NewClinic/worksheets/SCALABILITY_BASELINE.md` (create it, table: date, action, p50, p95, errors). These numbers are the before/after proof for every later task.

### SCALE-0.3 — Record baseline numbers

- **Do:** Using SCALE-0.2, capture baselines for `queue.counts`, `visit.board`, `doctor.queue`, `patients.search` (q= a common surname), and `admin.config` GET. Also record: `SELECT COUNT(*) FROM new_visit;` and rows in `patient_data`. Append all to `SCALABILITY_BASELINE.md`.
- **Verify:** The worksheet has one filled table row per action.

---

## 4. Phase 1 — Concurrency & hot-path fixes (biggest wins, small diffs)

### SCALE-1.1 — Release the session lock on read-only actions

- **Problem:** No `session_write_close()` in the module; concurrent tabs serialize.
- **Files:** `src/Controllers/AjaxController.php`, `src/Services/AjaxActionPolicy.php`
- **Do:**
  1. In `AjaxActionPolicy`, add a boolean per action: `isReadOnly` (true for all `*.queue`, `*.board`, `*.counts`, `*.list`, `*.poll`, `*.status`, search and GET-style actions; false for anything that mutates DB or `$_SESSION`). Go through the full action catalog explicitly — do not guess from the name at runtime; hardcode the flag per action entry.
  2. In `AjaxController::handleRequest()`, AFTER auth + ACL + CSRF checks succeed and BEFORE dispatching, if the resolved policy says `isReadOnly === true`, call `session_write_close();`.
  3. Audit read handlers for `$_SESSION[...] =` writes (grep the module). `RateLimitService` writes to `$_SESSION` — so `patients.search` must either stay NOT-read-only for now, or (better) do the rate-limit check BEFORE `session_write_close()`. Choose the latter: perform rate-limit accounting first, then close the session.
- **Watch out:** `SessionRoleService` and shared-device probe actions read/write session — mark those non-read-only.
- **Verify:** (a) `verify-module.php` passes. (b) Open two tabs on the visit board; in tab 1 add `sleep(3)` temporarily inside the `visit.board` handler after `session_write_close()`; confirm tab 2's `queue.counts` still returns instantly (before this fix it would block ~3 s). Remove the sleep. (c) Unit test: extend `tests/Tests/Unit/Modules/NewClinic/AjaxActionPolicyTest.php` asserting every action has an explicit `isReadOnly` flag and that known mutating actions (e.g. cashier payment) are `false`.

### SCALE-1.2 — Cap every queue/board query

- **Problem:** All desk queues + board fetches are unbounded.
- **Files:** `src/Services/VisitQueueService.php` (~L37–92), `VisitBoardService.php` (~L292–355), `TriageService.php` (~L43–58), `DoctorService.php` (~L69–101), `LabService.php`, `PharmacyService.php`, `CashierService.php`, `AjaxController.php` (`queue.list` ~L559).
- **Do:**
  1. Add to each service (or one shared constants class `src/Services/QueueLimits.php`): `public const QUEUE_HARD_CAP = 200;` and `public const BOARD_LANE_CAP = 100;` (constants, not magic numbers).
  2. Append `LIMIT <cap>` (with existing ORDER BY preserved — queue order must stay stable) to every queue/board/lane SELECT listed above. Grep the module for `FROM new_visit` to make sure you found ALL of them (big-picture rule).
  3. In each response payload add `"truncated": true|false` and `"total": <count>` (one cheap `SELECT COUNT(*)` with the same WHERE — acceptable; it uses the `idx_facility_state_active` index).
  4. Frontend: in each desk island (`frontend/src/islands/*-desk/*.tsx`, `visit-board/VisitBoard.tsx`), if `truncated` is true, render a small non-blocking banner: "Showing first 200 — refine filters". Grep `frontend/src` for each endpoint name to find every consumer.
- **Do NOT:** change sort order, remove `SELECT v.*` yet (that is SCALE-2.4), or paginate desks in this task.
- **Verify:** (a) Seed >200 active visits with the existing fixture scripts in `scripts/` (or a temp SQL insert loop) on a test facility; confirm each desk returns exactly the cap and `truncated: true`. (b) Normal day (<cap) behaves identically to before. (c) `verify-module.php` + frontend build pass. (d) Re-run SCALE-0.2 against `visit.board`; append results to the baseline worksheet.

### SCALE-1.3 — Move `repairOrphanVisits()` off the poll path

- **Problem:** UPDATE…JOIN runs on every poll from every tab.
- **Files:** `src/Services/VisitScopeService.php` (~L205–302) and every caller (grep `repairOrphanVisits` module-wide).
- **Do:**
  1. Create table (append to `sql/install.sql` with `#IfNotTable` guard): `new_clinic_maintenance_lock (lock_key VARCHAR(64) PRIMARY KEY, locked_until DATETIME NOT NULL)`.
  2. In `VisitScopeService`, wrap the repair: before running, attempt `INSERT ... ON DUPLICATE KEY UPDATE locked_until = IF(locked_until < NOW(), VALUES(locked_until), locked_until)` claiming `repair_orphans_<facility>_<date>` for NOW()+5 minutes; only run the UPDATEs if this request won the claim (check affected rows / re-read). Result: at most ONE repair per facility per 5 minutes across ALL servers and tabs, instead of every poll.
  3. Keep the existing static `$repairedKeys` as a request-local fast path.
- **Do NOT:** delete the repair logic — visits genuinely need it; we are only throttling it.
- **Verify:** (a) Unit test the claim logic (new test file `VisitScopeMaintenanceLockTest.php`): first claim wins, second within 5 min loses, claim after expiry wins. (b) Enable MySQL general log locally for 1 minute while a desk polls every 10 s; confirm the UPDATE JOIN appears at most once, not 6 times. (c) `verify-module.php`.

### SCALE-1.4 — Load config once per request

- **Problem:** `ClinicConfigService::get()` = up to 3 SELECTs per key; admin page loops ~125 keys.
- **Files:** `src/Services/ClinicConfigService.php` (~L42–107), `src/Services/ClinicAdminService.php` (~L187–201).
- **Do:**
  1. Add a private per-instance array cache in `ClinicConfigService`: on first `get()` for a facility, run ONE query `SELECT setting_key, setting_value FROM new_clinic_config WHERE facility_id IN (?, 0)` (facility + global fallback), build a merged map (facility overrides global), and serve all subsequent `get()`/`getInt()`/`getMany()` calls from the map.
  2. Add `public function invalidate(): void` clearing the map; call it from every code path that WRITES config (grep for the config write method call sites — admin save, import).
  3. Rewrite `getMany()` and `ClinicAdminService::getSettingsPayload()` to read from the preloaded map (they now cost 1 query total).
- **Watch out:** the "reader facility" third-fallback path — replicate its exact precedence in the merged map; write a unit test proving precedence order (facility > global > reader-facility default) matches current behavior BEFORE refactoring (characterization test).
- **Verify:** (a) New unit test `ClinicConfigServiceCacheTest.php`: precedence identical to old behavior for facility-set, global-only, and unset keys; write-then-read within one request returns the new value. (b) Count queries on `admin.config` GET before/after (temporary counter or general log): from ~125+ to ≤5. (c) `verify-module.php`.

### SCALE-1.5 — Kill the patient-search N+1

- **Problem:** 3 queries per result row in `PatientSearchService::mapResultRow()` (~L192–214).
- **Files:** `src/Services/PatientSearchService.php`, `AppointmentTodayService.php`, `RecallDueService.php`.
- **Do:**
  1. After the candidate query returns up to 50 rows, collect all `pid`s.
  2. Add batch methods: `AppointmentTodayService::chipsForPatients(array $pids): array` (one query with `pid IN (...)`, keyed by pid), same for `RecallDueService::chipsForPatients()`, and one batched active-visit query on `new_visit` with `pid IN (...)`.
  3. `mapResultRow()` receives the three prebuilt maps and does array lookups only.
  4. Keep the old single-pid methods (other callers may use them — grep first; if unused elsewhere, delete them, dead code rule).
- **Verify:** (a) Search results byte-identical before/after for the same query (capture JSON before, diff after). (b) Query count for a search with 8 results drops from ~25+ to ≤5. (c) `verify-module.php` + re-run load test on `patients.search`.

### SCALE-1.6 — Lazy service construction in AjaxController

- **Problem:** ~90 services constructed per request (~L141–234), even for `queue.counts`.
- **Files:** `src/Controllers/AjaxController.php`.
- **Do:** Replace eager `readonly` properties with a tiny lazy container: private array `$serviceCache` + `private function svc(string $class): object { return $this->serviceCache[$class] ??= new $class(); }` for zero-arg services; keep explicit factory closures for services with constructor args. Update the switch arms to call `$this->svc(TriageService::class)` etc. Do it mechanically, one region at a time — the file is >3000 lines, so use targeted string replacements per case block and grep to confirm no `$this->xyzService` property reads remain.
- **Watch out:** some services take other services in constructors — build those inside dedicated private getter methods so wiring stays explicit.
- **Verify:** (a) `verify-module.php`. (b) Smoke every major action (`scripts/` has smoke utilities) or at minimum: queue.counts, visit.board, one mutation per desk. (c) Memory per `queue.counts` request (log `memory_get_peak_usage()` temporarily) drops measurably.

### SCALE-1.7 — Frontend polling hygiene (one pass, all files)

- **Problem:** shell polls hidden tabs; no jitter; doctor roster re-fetched every poll.
- **Files (all in one pass, per big-picture rule):** `public/assets/js/shell.js` (~L7, L25–27, L388–405), `frontend/src/core/useInterval.ts`, `frontend/src/islands/doctor-desk/DoctorDesk.tsx` (~L283–410, L321, L733), `frontend/src/islands/doctor-desk/DoctorRosterBar.tsx` (~L66).
- **Do:**
  1. **shell.js:** skip the `queue.counts` fetch when `document.hidden`; on `visibilitychange` to visible, refresh immediately (mirror `useQueueVisibilityRefresh` semantics).
  2. **useInterval.ts:** add ±10 % random jitter to the delay (compute once per mount: `delay * (0.9 + Math.random()*0.2)`), so thousands of clients don't fire in lockstep. Grep `frontend/src` for any other raw `setInterval` polls (`FlowBoardLens.tsx`, `CalendarLens.tsx`, autosave) and add the same jitter to the network-hitting ones only (NOT the 60 s client-only wait-time tick, NOT autosave).
  3. **Doctor desk:** stop bumping `queueRefreshToken` on every queue poll; refresh the roster only (a) on mount, (b) on visibilitychange→visible, (c) every 5th queue poll (counter), and (d) after any roster-mutating action.
  4. Bump the asset version ONCE at the end.
- **Verify:** (a) `npm run build` in `frontend/` passes; Vitest suite passes. (b) Network tab: hidden tab makes zero `queue.counts` calls; visible again → immediate refresh. (c) Doctor desk: `doctor.roster` no longer fires on every `doctor.queue` poll. (d) Two browser windows: intervals visibly desynchronized.

### SCALE-1.8 — Revision-based "not modified" polls for queues

- **Problem:** Full board/queue payload every poll even when nothing changed. Scheduling already solved this (`SchedulingFlowBoardService` L84–99) — copy that pattern.
- **Files:** `src/Services/VisitQueueService.php`, each desk service, `AjaxController.php` (poll actions), all desk islands + `VisitBoard.tsx`, `frontend/src/core/oeFetch.ts` (optional helper).
- **Do:**
  1. Compute a cheap facility revision: `SELECT MAX(GREATEST(updated_at, created_at)) , COUNT(*) FROM new_visit WHERE facility_id=? AND <active-window>` → hash into a string token. (If `new_visit` lacks `updated_at`, add it via `#IfMissingColumn` in `install.sql` with `ON UPDATE CURRENT_TIMESTAMP` — check first.)
  2. Each queue/board action accepts `known_revision`; if it matches the current token, return `{unchanged: true, revision}` and skip ALL enrichment work.
  3. Islands store the last revision and send it on each poll; on `unchanged`, keep current state (do NOT `setState`, avoiding the full re-render too).
  4. Roll out to visit board + the two busiest desks first (doctor, triage), then remaining desks in the same task.
- **Watch out:** the revision must also change when queue-bridge badges / lab counts change, or stale badges appear. Include those tables' max-updated in the token OR accept a max-staleness of one poll for badges and document it in the payload contract.
- **Verify:** (a) Idle clinic: consecutive polls return `unchanged: true` and the handler runs ≤2 queries (confirm via general log). (b) State change (move a visit) → next poll returns full payload. (c) Vitest + `verify-module.php` + load test delta recorded in the worksheet.

---

## 5. Phase 2 — Heavy work off the request path

### SCALE-2.1 — Real background job runner (DB-backed, no new infra)

- **Problem:** "Async" exports complete inside the status-poll HTTP request (`ReportHubExportService::pollExportStatus()` ~L303–348, `set_time_limit(0)`).
- **Files:** `src/Services/ReportHubExportService.php`, new `src/Services/JobRunnerService.php`, new `scripts/run-jobs.php`, `sql/install.sql`, `AjaxController.php` (`reports.export_status` ~L1695).
- **Do:**
  1. Generalize `report_hub_export_run` into a claim-based job table pattern: add columns (via `#IfMissingColumn`) `claimed_by VARCHAR(64)`, `claimed_at DATETIME`, `attempts INT DEFAULT 0`.
  2. `scripts/run-jobs.php`: CLI worker loop — claim one pending job atomically (`UPDATE ... SET claimed_by=?, claimed_at=NOW() WHERE status='pending' AND claimed_by IS NULL ORDER BY id LIMIT 1`, then re-select by claim token), run it, mark done/failed, loop; exit after N jobs or M seconds (safe under cron / Windows Task Scheduler / `openemr-cmd`). Usage header comment mandatory. Max 3 attempts then `failed` with error message stored.
  3. `pollExportStatus()` becomes a PURE read: return job status/progress; NEVER call `completeRunningJob()`.
  4. **Fallback for hosts with no cron:** keep a degraded inline mode behind config key `enable_inline_export_fallback` (default ON for now so nothing breaks on XAMPP; the deployment runbook — SCALE-5.2 — says to turn it OFF once a worker is scheduled). When ON and a job is stale (>60 s unclaimed), the status poll may run it inline as today.
- **Verify:** (a) With fallback OFF and worker running (`php scripts/run-jobs.php --max-seconds=60`), request an export from Report Hub UI: status transitions pending→running→done, file downloads. (b) With fallback OFF and NO worker: job stays pending, UI shows "queued" (frontend already polls `reportHubExport.ts`; adjust copy if needed). (c) Kill the worker mid-job; restart; job retries (attempts=2) and completes. (d) `verify-module.php`.

### SCALE-2.2 — Route ALL heavy inline operations through the job runner

- **Files:** `PatientCohortSearchService` (5000-row export), `ClinicalExportService::preparePdfExport()`, `AjaxController` `chart_depth.export_generate` (~L443), admin config import (~L2595).
- **Do:** One sub-task per export type, same recipe as SCALE-2.1: enqueue → poll status → download by job id. Keep small results (<~500 rows, measured) synchronous — add a row-count pre-check that decides sync vs job. Frontend: reuse the existing export-polling UX from `reportHubExport.ts` (extract a shared `useExportJob` hook in `frontend/src/core/` and use it in all four surfaces — grep for each action name to find every consumer).
- **Verify:** each export type: small = instant, large = queued + completes via worker; PHP worker never blocked >2 s serving the poll (check NC_PERF log from SCALE-0.1).

- **Status (2026-07-13): DONE for the one surface that actually needs it; the other three re-scoped after reading the code (trust-code-over-plan).**
  - **Cohort CSV export — DONE.** Generic `ExportJobService` + `new_clinic_export_job` table + `run-jobs.php` drains it; `PatientCohortSearchService::requestExport()` does the sync(≤500)/async pre-check; shared `frontend/src/core/exportJobPolling.ts` (`pollExportJobToDownload`) handles the async download. **Security fix during audit:** the session-less worker must apply the requester's facility scope (captured at enqueue), or a scoped user's large export would leak all facilities' patients — fixed + proven; client cannot inject the scope field.
  - **`ClinicalExportService::preparePdfExport()` / `chart_depth.export_generate` — NOT NEEDED.** It does no inline PDF work: it returns a `post_url` + fields and the browser POSTs to **stock** `interface/patient_file/report/custom_report.php`, which renders the PDF. The heavy work is OpenEMR core, not the module request path; offloading it would mean reimplementing stock report generation (a Tier-3 non-goal). Module part is already light.
  - **Admin config import — NOT NEEDED (and a poor fit).** `AdminConfigImportService` writes a clinic's OWN config snapshot (dozens–low-hundreds of fees/visit-types + ~130 settings) — bounded and fast, not a >2 s job. It is also a MUTATION with no downloadable result, so the enqueue→poll→download pattern doesn't apply; moving a config write to the session-less worker would re-introduce the facility/session scoping hazards fixed above for zero benefit.

### SCALE-2.3 — Export files off local disk (multi-server safe)

- **Problem:** CSVs written to `{OE_SITE_DIR}/documents/nc_report_exports/` — 404s behind a load balancer.
- **Files:** `ReportHubExportService.php` (~L351–374), new `src/Services/ExportStorageService.php`.
- **Do:** Introduce `ExportStorageService` with `put(string $jobKey, string $tmpFile)`, `getStream(string $jobKey)`, `delete()`, `purgeOlderThan(days)`. Default driver: current sites-dir path (unchanged behavior on XAMPP). Structure it so an S3/objstore driver can be added later behind config key `export_storage_driver` — but do NOT write the S3 driver now (YAGNI until a second server exists). Add `purgeOlderThan(7)` to the job worker loop (currently exports accumulate forever).
- **Verify:** exports still download; files older than 7 days are purged when the worker runs; unit test the purge with fake timestamps.

- **Status (2026-07-13): DONE.** `ExportStorageService(namespace)` now owns write/read/delete/purge for both export families (`nc_report_exports`, `nc_export_jobs`); `ReportHubExportService` + `ExportJobService` no longer touch paths directly, and download reads are containment-checked (a tampered `file_path` in a job row can't read arbitrary server files). Driver seam behind `export_storage_driver` (default `local`; unknown drivers fail loud rather than silently scattering PHI on local disk). Retention kept at the stricter SEC-6 **24h** (not the plan's 7 days) and now enforced from `run-jobs.php` every pass, so idle systems get cleaned too. Bonus fixes: the site-files backup now EXCLUDES both transient export dirs (they were extending PHI retention into backups), and `run-jobs.php` gained the `--site=` flag it always needed under CLI (the documented cron command previously died on site resolution). Live-proven end-to-end: real cohort job → worker → storage → download (305 rows), expired plants purged in both namespaces, fresh kept. 8 new unit tests.

### SCALE-2.4 — Trim queue payloads (`SELECT v.*` → explicit columns)

- **Files:** `VisitQueueService.php` (L58–59, 79–80, 139), `VisitBoardService.php` (L292–303, 337), all desk services with `SELECT v.*`.
- **Do:** Grep module for `SELECT v.*` / `v.\*`. For each, list the columns the PHP mapper + frontend actually consume (read the mapper and the island's TypeScript types in `frontend/src/`), and select exactly those. One shared column-list constant per service. This shrinks payloads AND lets MySQL use covering indexes later.
- **Watch out:** enrichers (`VisitRowEnricher`) may read extra columns — grep its field access before trimming.
- **Verify:** JSON payloads before/after are identical for a seeded queue (capture and diff); all desks render correctly; Vitest + `verify-module.php`.

- **Status (2026-07-13): DEFERRED after assessment — high risk, now-diminished value, and the stated verification doesn't hold.**
  - **Value diminished by earlier tasks.** SCALE-1.2 caps the row count (≤200) and SCALE-1.8 delta-polls, so the full payload is only shipped on a *changed* poll of an already-bounded list. The marginal bandwidth win from trimming ~32-col `v.*` shrank a lot.
  - **The "byte-identical" verify is impossible as written.** `enrichVisitRow()` mutates and returns the RAW row, so the card payload already CONTAINS every `v.*` column (measured: a doctor-queue card = **53 keys**, incl. `row_version`/`created_by`/`created_at`/`cancel_reason`/`appt_date`/`pc_eid`/`routing_method`/`referred_to_visit_id`). Trimming necessarily CHANGES the payload keys, so a before/after diff can't be identical — the real test is "did any desk feature break," which needs full per-desk QA.
  - **Can't reliably tell which columns are safe to drop.** A name grep across `frontend/src` + module `src` is too noisy (most column names also appear in unrelated contexts). Only `created_by` + `routing_method` are provably unused everywhere — trimming just those from 53 keys is negligible. A safe version needs a per-desk *whitelist* built from each card's TS type + every enricher's field reads, verified by exercising each desk — a sizeable, QA-heavy task.
  - **Recommendation:** do it later as its own focused effort with per-desk column audits + visual QA, or via an output whitelist (send only fields declared in the card types). Not worth a risky hot-path change whose upside 1.2/1.8 already largely captured.

### SCALE-2.5 — Fix remaining per-row subqueries and mini-N+1s

- **Files/targets:** `CashierService.php` L47–49 (billing sum subquery per row → single `GROUP BY pid/encounter` join), `VisitBoardService.php` L349–355 (`enrichVisitRows([$row])` inside `array_map` → one batch call), `CashierService.php` L741–749 (same), `PatientSearchService.php` L120–123 (correlated MAX(fe.date) → `LEFT JOIN (SELECT pid, MAX(date) ...) `), `CommunicationsHubService.php` L69–80 (search loads ALL pnotes then filters in PHP → push `q` into SQL `LIKE` with `LIMIT`).
- **Do:** One fix per file, each with a before/after query-count note in the commit message. Model batching on the existing good pattern in `VisitRowEnricher::batchLabOrderCounts`.
- **Verify:** payload-identical diffs per endpooint; query counts recorded; `verify-module.php`.

---

## 6. Phase 3 — Stateless web tier (horizontal-scale readiness)

### SCALE-3.1 — Rate limiting off the session

- **Problem:** `RateLimitService` counters live in `$_SESSION` — trivially bypassed by clearing cookies, don't aggregate across servers, and block `session_write_close`.
- **Files:** `src/Services/RateLimitService.php`, callers (`AjaxController.php` L273, L488), `sql/install.sql`.
- **Do:** Rewrite `RateLimitService` on a DB table `new_clinic_rate_limit (bucket_key VARCHAR(128) PRIMARY KEY, window_start DATETIME, count INT)` using atomic `INSERT ... ON DUPLICATE KEY UPDATE` fixed-window counting keyed by `userId + action` (NOT session id). Add cleanup of old windows to the job worker. Keep limits/config identical. This also unblocks marking `patients.search` read-only in SCALE-1.1 (revisit that flag now).
- **Verify:** unit test the window math (new/exhausted/expired windows); hammer `patients.search` past the limit → 429-style envelope; two different browsers share the same user bucket.

- **Status (2026-07-13): DONE.** `RateLimitService` now counts in `new_clinic_rate_limit` with the minute window baked into the bucket key (`action:uID:YYYYMMDDHHII`) — one atomic upsert + a read-back by key (`affected_rows`/`LAST_INSERT_ID` are unreliable under OpenEMR's query logging). Counters key on userId + action: cookie-clearing no longer resets them and N web servers share one budget. Limits/config keys unchanged. Worker purges windows older than 1h each pass. **SCALE-1.1 revisit done:** `patients.search` + `patients.dup_check` are now `isReadOnly` (session lock released) since the limiter no longer writes `$_SESSION`. Live-proven: 30 calls ok, 31st → 429 (real config path); 7 DB-window unit tests; policy test updated. **Audit follow-up (2026-07-13):** purge no longer depends solely on the worker — ~1-in-200 `consume()` calls runs the indexed purge, so the table stays bounded on installs where the worker isn't scheduled yet (health.php writes per-IP rows into this table too).

### SCALE-3.2 — Extend rate limiting to poll endpoints (devil-proofing)

- **Do:** Apply the SCALE-3.1 limiter with GENEROUS budgets to poll actions (e.g. 30 polls/min per user per action — 3× the fastest legitimate 10 s interval). Return the standard error envelope with `retry_after_ms`; islands back off to `pollMs * 2` for one cycle when they receive it (add to `useInterval` consumers via a small shared helper in `frontend/src/core/`).
- **Why:** a stuck client, a hostile script with a stolen session, or a devtools loop cannot melt the DB.
- **Verify:** script 100 polls/min → limited; normal desk usage never hits it (soak a desk for 10 min, zero limit errors in the log).

- **Status (2026-07-13): DONE.** 24 recurring-timer actions classified in `AjaxActionPolicy::POLL_ACTIONS` (desk queues, board, shell `queue.counts`, ops worklists, scheduling delta polls, comms refresh, daily-reports auto-refresh, export-status loops); `AjaxController` enforces `RateLimitService::assertPollWithinLimit()` on them centrally (`poll.`-prefixed buckets so an action's own tighter limit stays independent). Budget `rate_limit_poll_per_minute` default **90** (not the plan's 30 — export-status loops legitimately poll 60/min at 1 Hz; desk polls are ~6/min per tab, so 90 still stops any runaway). 429 envelope carries `retry_after_ms` (ms to window rollover). Client: `oeFetch` arms a tab-wide backoff on 429+retry_after_ms (`core/pollBackoff.ts`); `useInterval` skips network-poll ticks while armed (client-only ticks opt out via `respectPollBackoff: false`); shell.js has the same guard for the badge poll. Live-proven: 95 hammer calls → exactly 90 ok + 5 limited. 16 frontend + 5 PHP new tests; asset `20260713pollbudget`.

### SCALE-3.3 — Cache layer abstraction (Redis-ready, APCu/DB first)

- **Files (new):** `src/Services/CacheService.php`.
- **Do:** Tiny interface: `get(key)`, `set(key, val, ttlSec)`, `delete(key)`, `withLock(key, ttl, fn)`. Drivers: (1) `apcu` when the extension is loaded, (2) DB table `new_clinic_cache (cache_key PK, cache_value MEDIUMTEXT, expires_at)` as universal fallback, (3) leave a stub note for a Redis driver (do not write it now). Select driver via config key `cache_driver` (default `auto` = apcu→db).
  Then wire the first two consumers: (a) `ClinicConfigService` map from SCALE-1.4 cached cross-request for 30 s per facility (invalidate on write); (b) `queue.counts` result cached 5 s per facility — this single cache absorbs the shell's fleet-wide 30 s poll almost entirely.
- **Watch out:** cache invalidation on config write must delete the facility key AND global key.
- **Verify:** unit tests for both drivers (TTL expiry, lock exclusivity); with 3 tabs open, general log shows `queue.counts` SQL at most once per 5 s regardless of tab count; config change reflects within 30 s everywhere.

- **Status (2026-07-13): DONE.** `CacheService` (get/set/delete/getOrSet/withLock/purgeExpired) with `apcu` driver (auto-selected when loaded) and `new_clinic_cache` DB fallback; `cache_driver` config key (auto|apcu|db) read DIRECTLY from the table, not via ClinicConfigService (that service consumes this one — a service-level read would recurse). Every operation fails OPEN (BP-8); `withLock` uses the owner-token+read-back claim (affected-rows unreliable under query logging). Wired: (a) `ClinicConfigService::loadFacility()` maps cached 30 s cross-request, invalidated on `set()`/`clearGlobalOverrides()` (facility + global keys, per the watch-out) — read-after-write live-proven immediate; (b) `VisitQueueService::getCounts()` cached 5 s per facility+date AFTER actor-facility resolution (covers the ajax poll AND shell page render; also skips the repair-lock read on hits) — hit-vs-recompute live-proven via a poisoned cache row. Worker purges expired rows each pass. **Note for this XAMPP box:** APCu is not loaded, so the DB driver runs locally (counts hit = 1 PK read vs resolve+repair+GROUP BY; config hit ≈ wash); enabling APCu in deployment is where hits become near-free — the runbook (SCALE-5.2) should list `apcu` alongside opcache. 8 new unit tests; 1018 module tests green.

### SCALE-3.4 — Sessions & deployment statelessness audit (documentation task)

- **Do:** Write `Documentation/NewClinic/NEW_CLINIC_SCALE_OUT_RUNBOOK.md` covering, concretely for this codebase: moving PHP sessions to Redis (`session.save_handler = redis` — an OpenEMR-level php.ini concern, no module code change), which module features assume local disk (export storage → SCALE-2.3 driver), confirming no other module-local file writes exist (grep `file_put_contents|fopen.*w` in `src/` and list findings), and the LB health-check endpoint (SCALE-4.4). This is the checklist an ops person follows to go from 1 → N servers.
- **Verify:** the grep audit table in the doc is complete (every write call site listed with verdict safe/unsafe).

- **Status (2026-07-13): DONE (v0.1.0).** Runbook written with the TL;DR 1→2-server checklist, the full file-write grep audit (verdicts: `ExportStorageService` = the safe seam, `AdminBackupService` = node-pinned by design, everything else `php://temp`/`php://memory`), a static-state sweep (all in-process statics are safe-when-duplicated memos), cache/worker placement, and pending-section stubs for 4.3/4.4/4.6 (merged at SCALE-5.2). Also records that APCu + opcache belong in every server's php.ini.

### SCALE-3.5 — Read/write DB split readiness (documentation + tagging task)

- **Do:** Do NOT build replica routing now. Instead: (1) in `AjaxActionPolicy`, the `isReadOnly` flag from SCALE-1.1 already classifies every action — verify completeness; (2) add a section to the scale-out runbook explaining that read-only actions can later be pointed at a replica via ADODB config, and which actions must NEVER be (anything reading data it just wrote in the same user flow — list cashier payment status, visit state transitions); (3) note replication-lag hazards for the queue board (a just-moved visit may bounce back for 1 poll) and the mitigation (route queue reads to primary OR accept 1-poll staleness — decide when the replica actually exists).
- **Verify:** doc section exists; `AjaxActionPolicyTest` asserts 100 % of actions carry the flag.

- **Status (2026-07-13): DONE.** Runbook §5 documents the replica plan: `READONLY_ACTIONS` = the future replica set, the never-replicate list (cashier payment flows, visit state transitions, `admin.config.save` echo), and the queue replication-lag decision (route queue reads to primary, decided when a replica exists). The "100% of actions carry the flag" verify was re-interpreted for the shipped allowlist design (default-locked means every action trivially carries a value): the REAL hazard is a typo'd allowlist entry silently never matching, so `AjaxActionPolicyTest::testReadOnlyAndPollSetsContainOnlyRealActions` asserts every `READONLY_ACTIONS` + `POLL_ACTIONS` entry is a real dispatchable action (reuses the verify-module action-catalog extractor). **Phase 3 complete (5/5).**

---

## 7. Phase 4 — Devil-proofing (abuse, failure, and Murphy)

> "Even if the devil gets involved, the system can scale up." The devil shows up as: hostile input, stolen sessions, runaway clients, dying dependencies, full disks, clock skew, and 3 a.m. deploys.

### SCALE-4.1 — Input hardening sweep at the AJAX boundary

- **Do:** For every action in `AjaxActionPolicy`, verify (grep + read each handler) that: ids are cast to int before SQL; strings that reach `LIKE` are length-capped (add a shared `Sanitize::searchToken($s, maxLen=64)` helper); pagination params are clamped (`page ≥ 1`, `per_page ≤ documented max`); date params validated (`DateTimeImmutable::createFromFormat` or reject); JSON bodies size-capped (reject `CONTENT_LENGTH` > 1 MB for non-upload actions, 413-style envelope). Produce a checklist table in the PR description: action → params → verdict. Fix violations as you find them. All SQL must remain parameterized (the module already uses placeholders — verify no string-concatenated SQL slipped in: grep for `\" . \$` near `sql`).
- **Verify:** curl fuzz: negative ids, 10 KB search strings, `per_page=999999`, malformed dates → all return clean 400-style envelopes, never a PHP warning or a slow query.

- **Status (2026-07-13): DONE.** Full sweep of all 301 actions via the complete param-extraction surface (every `$_REQUEST`/`$body`/`$params` site in all 23 handlers) + every LIKE-building service; checklist table in `Documentation/NewClinic/worksheets/SCALE_4_1_INPUT_AUDIT.md`. Found already-safe: SQL fully parameterized (no concatenated SQL anywhere), every id int-cast, every pagination param clamped (service-side `min(max(),cap)` pattern). Fixed: (1) `Support\Sanitize::searchToken()` (64-char cap + control strip, metachars deliberately NOT escaped) wired into all 11 services building LIKE needles from client input (~25 fields); (2) strict Y-m-d validation (`Sanitize::dayOrDefault/dayOrNull` via `AjaxController::validDay()`, round-trip check rejects `2026-02-31`, malformed → 400, empty → caller default) on all 28 day-param sites; (3) body budgets — 32 MB hard ceiling checked from `CONTENT_LENGTH` BEFORE the body is read, 1 MB per-action with a 7-entry vetted `LARGE_BODY_ACTIONS` allowlist (uploads/imports), 413 envelope, allowlist typo-guarded by the action-catalog test. 12-case live fuzz all clean (negative/huge ids, 10 KB needles, `page_size=999999`, malformed/overflow dates, 1.5 MB body → 413); Apache's own `LimitRequestLine` bounds GET URLs ≥ 8 KB with 414 before PHP. Known accepted cost: capped audit-log free-text search still scans core `log` ~11 s on this box (unindexable triple-LIKE over the query log; bounded by the 4.2 statement budget, admin-only, rate-limited). 10 new unit tests.

### SCALE-4.2 — Timeouts and query budgets

- **Do:** (1) Set `max_execution_time` guard: at the top of `handleRequest()` for read-only actions, `set_time_limit(15)`; job worker keeps its own longer budget. (2) MySQL side: add `SET SESSION max_execution_time = 10000` (10 s, MySQL 5.7.8+/8.0 optimizer hint alternative `/*+ MAX_EXECUTION_TIME(10000) */` on the heavy SELECTs) for queue/board/search reads so a pathological scan self-kills instead of pinning a worker. Confirm XAMPP's MySQL/MariaDB version first and use the matching mechanism (MariaDB: `max_statement_time`).
- **Verify:** artificially slow query (`SLEEP(20)` in a temp branch) → request dies at ~10 s with the error envelope and an NC_PERF log line, not a 60 s hang.

- **Status (2026-07-13): DONE.** `QueryBudgetService` applies the DB statement kill per read request — this box is MariaDB 10.4 so `SET SESSION max_statement_time = 10` (MySQL ≥5.7.8 gets `max_execution_time = 10000`; flavour read from the connection handshake via ADODB `ServerInfo()`, zero extra queries; pre-5.7.8 → no-op). PHP side: `@set_time_limit(15)` (on Linux the PHP timer excludes DB wait, so the DB kill is the guard that matters; the PHP limit catches compute loops). Scope: `AjaxActionPolicy::hasReadBudget()` = the read-only allowlist minus `cohort.export_status` (its inline export fallback may legitimately run long); **mutations keep the default budget — killing a write mid-flight is worse than a slow write**. The delicate part was the envelope: both death modes bypass `respond()` (PHP fatal; core `HelpfulDie()` echoes an HTML error page). New failsafe shutdown guard buffers all ajax output and replaces those two deaths with a clean `{code: timeout|server_error}` envelope (503/500) — which also stops `HelpfulDie` leaking SQL statement text on this boundary; it's registered before the NC_PERF hook so the log line carries the corrected status. Everything fails open (BP-8). Live drill: `SELECT SLEEP(20)` under `queue.counts` → HTTP 503 `timeout` envelope in 10.3 s + `NC_PERF … ms=10233 status=503`; busy-loop → 503 in 15.2 s + `NC_PERF … ms=15242 status=503`; healthy requests unchanged. 6 new unit tests.

### SCALE-4.3 — Graceful degradation modes

- **Do:** Add config keys (default OFF) that a human flips during an incident, all read via the (now cheap) config service: `panic_readonly_mode` (all mutating actions return a friendly "maintenance" envelope; reads still work), `panic_poll_multiplier` (server multiplies the `pollMs` it hands to Twig by N — instantly quarters fleet-wide poll load without deploying). Wire `pollMs` origin: `ClinicConfigService::resolveQueuePollIntervalMs()` (L85–93) is the single choke point — multiply there. Frontend needs NO change (it already receives `pollMs` from Twig).
- **Verify:** flip each flag in DB → mutation blocked with clean message / polls visibly slow down after page reload; flags OFF → identical behavior to today. Document both flags in the runbook.

- **Status (2026-07-13): DONE.** `panic_readonly_mode` (default 0): `AjaxController` refuses requests failing `AjaxActionPolicy::isBlockedInReadonlyPanic()` with a friendly 503 `maintenance_readonly` envelope. Block rule: allow GET (module mutations are POST-only — CSRF is POST-enforced) + the vetted read-only allowlist (covers POST-shaped reads like `patients.search`); never allows a mutation, at the cost of pausing a few POST-shaped reads outside the allowlist during an incident. `panic_poll_multiplier` (default 1, clamped 1–10) multiplies `resolveQueuePollIntervalMs()` — the single pollMs choke point — so a DB flip slows fleet polling at next page load, no deploy (the shell's own 30 s badge poll is hardcoded but is cached 5 s + rate-limited, so it's not the lever that matters). Reads via the now-cached config service = zero extra queries. Live-proven: DB flip → pollMs 30000→120000→restored; flag read + block/allow decisions correct. 4 new tests; documented in runbook §7.

### SCALE-4.4 — Health & readiness endpoint

- **Files (new):** `public/health.php`.
- **Do:** No-auth endpoint returning JSON `{ok, db_ms, cache_ms, worker_last_seen}`: one `SELECT 1` timed, one cache get/set timed, and last heartbeat timestamp the job worker writes to the cache/DB every loop. Return HTTP 503 when DB fails. No session start (keep it lock-free), no secrets in output, and rate-limit by IP via a simple fixed-window on the cache (devil-proofing: health endpoints get scraped).
- **Verify:** 200 + sane timings normally; stop MySQL → 503; endpoint responds <50 ms and appears in no auth logs as a failure.

- **Status (2026-07-13): DONE.** `public/health.php` deliberately bootstraps NOTHING (no globals.php, no session, no auth): it reads the site's `sqlconf.php` directly and speaks raw mysqli, so it stays honest and lock-free when the app tier is sick. Returns `{ok, db_ms, cache_ms, worker_last_seen}` — worker heartbeat is written by `run-jobs.php` into `new_clinic_cache` every pass (direct SQL, NOT CacheService, so a CLI apcu driver can't hide it) with a 10-min TTL; a dead worker surfaces as `null` within minutes (observed live during the MySQL restart drill). Per-IP fixed window (30/min) on `new_clinic_rate_limit`, non-fatal if the table is missing. Live-proven: 200 with sane timings (~50–100 ms total on XAMPP incl. connect; db_ms ~9–12), MySQL stopped → 503, restarted → 200, hammer → exactly 30 allowed then 429s. No PHI/version/config in output.

### SCALE-4.5 — Audit & anomaly visibility

- **Do:** Extend SCALE-0.1's NC_PERF logging with a daily rollup job (in the worker): insert per-action counts/p95 into `new_clinic_perf_daily (day, action, calls, p95_ms, errors)`. Add an Admin Hub read-only panel (behind existing `enable_admin_hub`) listing yesterday's top-10 slowest actions and error counts — grep Admin Hub island for the panel pattern to copy. This is how a future operator SEES the devil early.
- **Verify:** worker rollup populates the table from logged lines (or from a request-time counters table if log parsing is brittle on Windows — prefer counters table: increment in the `finally` block, one `INSERT ... ON DUPLICATE KEY UPDATE` per request, keyed by day+action); panel renders.

- **Status (2026-07-13): DONE (counters-table variant, as the plan preferred).** `new_clinic_perf_daily` (PK day+action): calls, errors, total_ms, max_ms, and a fixed latency histogram (≤100/250/500/1000/2500/over ms). `PerfCounterService::record()` runs in the SCALE-0.1 perf shutdown hook on EVERY ajax request — one NoLog PK upsert (can't spam the audit trail), fail-open. p95 is estimated from the histogram (bucket upper bound at the cumulative 95th call; overflow bucket → max_ms) — accurate enough to *rank* slow actions, which is all the panel promises; the worker freezes the estimate into `p95_ms` for completed days and purges rows >90 days. `admin.perf.summary` (new_admin, read-only + budgeted) returns day totals + slowest-by-p95 + error actions; `PerfPanelCard` on the Admin Hub System tab (behind `enable_admin_hub`) renders both tables with a Yesterday/Today toggle. Live-proven: drill traffic appeared in the counters exactly (incl. the 4.2 timeout drills as errors, max_ms 15242), worker pass reported `perf_rollup`, panel browser-smoked with real data. 5 PHP + 4 Vitest tests; asset `20260713perfpanel`. **Audit follow-up (2026-07-13):** (1) client-supplied action names the policy can't describe now collapse to one `(unknown)` bucket before hitting the counter or the NC_PERF log line — a hostile session can no longer grow the table one row per garbage name per day or forge log lines (new guardrail test proves all 301 dispatchable actions ARE describable, so no real action loses signal); (2) the panel sends `today`/`yesterday` day tokens resolved on the server clock, so a workstation with a wrong timezone can't ask for a day the counters never wrote. Asset `20260713audit1`.

### SCALE-4.6 — Backup/restore & migration safety notes

- **Do:** In the scale-out runbook add: list of ALL module tables (28 custom tables — copy the table list from the audit section of this plan's appendix) with a one-line "loss impact" per table (e.g. `new_visit` = catastrophic, `new_clinic_perf_daily` = disposable); the statement that ALL schema changes go through `sql/install.sql` `#IfNotTable/#IfMissingColumn` guards (never manual DDL in prod — this repo's existing convention); and a restore-drill checklist (restore dump to scratch DB, run `verify-module.php`, load visit board).
- **Verify:** doc section complete; every custom table listed.

- **Status (2026-07-13): DONE.** Runbook §8: all 32 module tables (28 original + the 4 added by SCALE work) bucketed by loss impact (catastrophic → disposable), the guarded-migration rule restated, and a 4-step quarterly restore drill (scratch DB → verify-module → board smoke → key-custody check).

---

## 8. Phase 5 — Real-time transport & long-term posture (only after Phases 1–4)

### SCALE-5.1 — Server-Sent Events for queue invalidation (design first, then build)

- **Why last:** Phases 1–3 make polling ~10× cheaper; SSE is the next order of magnitude but adds operational surface. Do not start until SCALE-1.8 revisions exist (SSE will push "revision changed, refetch" pings, NOT payloads — reuse everything).
- **Do:** Write a one-page design doc first (`Documentation/NewClinic/NEW_CLINIC_SSE_DESIGN.md`): endpoint `public/events.php` streaming `text/event-stream`; MUST call `session_write_close()` immediately after auth; publishes facility-scoped `queue_revision` events by polling the revision token server-side every 2 s (cheap after SCALE-1.8/3.3); islands subscribe via `EventSource` and fall back to interval polling when SSE is unsupported/disconnected (keep `useInterval` as fallback, raise fallback interval to 60 s when SSE is healthy). Note Apache/XAMPP caveats (`mod_php` worker exhaustion — SSE ties up a worker per client; document that this feature requires php-fpm + event MPM or a small Node/Go relay, and gate it behind `enable_sse` default OFF).
- **Verify (design phase):** doc reviewed; explicitly lists worker-count math (N SSE clients = N held workers under prefork — the go/no-go criterion for enabling).

- **Status (2026-07-13): DONE (design only, per the plan — not implemented).** `Documentation/NewClinic/NEW_CLINIC_SSE_DESIGN.md` v0.1.0: endpoint shape (`public/events.php`, real bootstrap + `session_write_close()` immediately after auth, NOT the `health.php` no-bootstrap pattern since queue data is clinical/PHI), the server-side revision-poll loop (must reuse `CacheService`, must NOT rebuild the full board/queue payload every 2 s just to hash it — flags that `QueueRevision::of()` as-is is the wrong tool for this and proposes a cheap `MAX(new_visit.updated_at)` signal instead), client design (`EventSource` layered above `useInterval`, which stays as the unconditional fallback, never replaced), `enable_sse` flag default OFF. **Worker-count math grounded in this box's actual config:** confirmed via `httpd-mpm.conf` that Windows XAMPP runs WinNT MPM (`ThreadsPerChild=150`, no prefork/event module on Windows) — every open SSE connection holds one thread for its lifetime, not per-request; single-facility pilot (~6–12 tabs) is safe, multi-facility-on-one-box is not (20 facilities × 10 tabs = 200 > 150 ceiling) without moving to php-fpm + an event MPM (Linux scale-out target) or a relay process first. Devil-proofing table covers 6 failure modes (browser unsupported, connection drop, abusive client, panic-lever interaction, deploy/restart, cold-cache revision read) — every one fails open to the existing `useInterval` behavior. §6 sets the actual go/no-go: measure real poll volume via the SCALE-4.5 perf panel first; do not build until both the volume and the deployment-target gates pass.

### SCALE-5.2 — Deployment runbook consolidation

- **Do:** Merge all runbook fragments (SCALE-3.4, 3.5, 4.3, 4.6) into the final `NEW_CLINIC_SCALE_OUT_RUNBOOK.md` with a 1-server → 2-server → N-server progression: what to flip, in what order, with verification per step (health endpoint, load test script, perf panel).
- **Verify:** a person who has never seen the codebase can follow it (test: give it to a fresh agent session and ask what step 3 is).

- **Status (2026-07-13): DONE.** Runbook bumped to v1.0.0, restructured from three loosely-ordered fragments (0.1.0 sessions/cache/worker/replica-readiness, 0.1.1 request-budgets/perf-panel appended) into an explicit **Stage 0 (single box, nothing required) → Stage 1 (1→2 servers, 7 ordered steps, each with a copy-pasteable command AND a concrete verification) → Stage 2 (read replica, explicitly marked reference-only/not-yet-actionable) → §5 incident response (health/levers/budgets/perf-panel tied into one suggested sequence) → §6 backup/restore → §7 pointer to SCALE-5.1's SSE doc and SCALE-5.3**. Added the `load-test.php` step to the checklist (existed as a tool, was never wired into the runbook itself) with the cookie-extraction steps spelled out. **Verified per the plan's own literal bar:** dispatched a fresh subagent with zero prior context to cold-read the doc and answer "what is step 3" plus an incident-sequence question — both answered correctly and unambiguously (4/5 followability, remaining gap is inherent ops-domain knowledge the doc reasonably assumes). The test also surfaced 4 low-cost polish items (health-endpoint description duplicated across two sections, Stage 2 not visually marked non-actionable, load-test cookie step unexplained inline, a dangling "old numbering" note) — all fixed in the same pass. **Phase 5 complete (5.1 + 5.2 done; 5.3 correctly deferred — optional, measurement-gated, not started).**

### SCALE-5.3 — Frontend client-cache layer (optional, measured)

- **Do:** Only if Phase 1 measurements show duplicate concurrent fetches still matter: introduce TanStack Query for desk islands (the frontend guide already anticipates this), scoped to queue endpoints, with `staleTime = pollMs`. One island first (visit board), measure, then roll out. Virtualize board columns/desk lists with the already-present `@tanstack/react-virtual` ONLY if a real clinic exceeds the SCALE-1.2 caps regularly (the caps make this unlikely for V1).
- **Verify:** request dedup visible in the network tab; no behavior change; Vitest passes.

---

## 8A. Phase 6 — Post-audit hardening (from the 2026-07-13 online-research review)

> **Why this phase exists.** After Phases 0–5 were complete, we deliberately went looking for
> blind spots — cross-checking our design against external scaling best-practice (PHP+MySQL
> connection limits, cache-stampede literature, MySQL retention/partitioning, offline-first EMR
> practice for the West Africa segment) and re-verifying the claims against our own code. Five
> gaps surfaced. Four are in-scope hardening tasks (SCALE-6.1–6.4 below). The fifth —
> offline/connectivity resilience — turned out **not to be an open engineering gap at all** once
> grounded in the decided on-prem hosting posture (a brainstorm corrected my initial framing); it
> resolved to a docs deliverable (the Outage Runbook) plus a parked V2, detailed at the end of
> this section. Sources and severity are in
> `Documentation/NewClinic/worksheets/SCALABILITY_BASELINE.md`'s audit rows and the assessment
> that prompted this phase.

### SCALE-6.1 — Cache-stampede protection on hot reads (serve-stale-while-one-rebuilds)

- **Problem (verified in code):** `VisitQueueService::getCounts()` does a bare `get` → miss →
  rebuild → `set(…, 5)` with **no lock**, even though `CacheService::withLock()` already exists.
  All open shell tabs poll `queue.counts` in near-lockstep (shift start; our ±10% `useInterval`
  jitter barely spreads them), so at every 5 s expiry **all** tabs miss and re-run the GROUP BY +
  `repairOrphanVisits` read simultaneously — the exact "5 s cache absorbs fleet load almost
  entirely" claim SCALE-3.3 makes fails precisely at each expiry boundary. Same shape applies to
  `ClinicConfigService::loadFacility()`'s cross-request cache (30 s), though its blast radius is
  smaller.
- **Do:** Add a serve-stale helper to `CacheService` (e.g. `getOrRebuild($key, $freshTtl,
  $hardTtl, $producer)`): store the value with a **hard** `expires_at` (e.g. 30 s) but a shorter
  **soft/fresh** window (5 s) recorded alongside the value (`{v, fresh_until}`). On read: if
  within the fresh window, return it; if past fresh but before hard-expiry, the **first** caller
  to win `withLock()` recomputes and refreshes while **every other concurrent caller instantly
  returns the still-present stale value** — no worker blocks, no stampede. Only a genuinely cold
  cache (no row at all) falls back to a single lock-guarded compute; lock losers on a cold start
  do one bounded direct compute (rare, first-request-of-the-day only). **PHP single-thread
  caveat (from the research): we cannot refresh "in the background after the response" the way
  HTTP `stale-while-revalidate` does — the lock-winner recomputes synchronously in its own
  request, but because only ONE request does and all others serve stale, the stampede is still
  eliminated.** Fail open throughout (BP-8): any cache error → compute directly. Route
  `getCounts()` and `loadFacility()` through the new helper; leave one-shot reads alone.
- **Verify:** unit test that under a simulated concurrent soft-expiry only one `producer` runs
  (the lock winner) and the rest receive the stale value; live: open ~10 tabs against one
  facility, watch the general query log — the `queue.counts` GROUP BY fires at most ~once per 5 s
  **across the expiry boundary**, not once per tab (today it fires N times at each boundary).
  Paste before/after query-count into `SCALABILITY_BASELINE.md` (BP-7).
- **Size:** small — the locking machinery already exists; this is a wrapper + two call-site
  changes + tests. **Recommended first task of the phase.**

- **Status (2026-07-13): DONE.** `CacheService::remember($key, $freshTtl, $hardTtl, $producer)`
  stores `{nc_v, nc_f}` with a hard row TTL and a shorter soft window: fresh → return; stale but
  not hard-expired → the one caller that wins `withLock()` recomputes+refreshes while every other
  concurrent caller returns the still-present stale value; cold+lost-lock → compute directly once.
  Fails open (BP-8): any cache/lock error → compute directly (today's behaviour). Wired:
  `VisitQueueService::getCounts()` (5 s fresh / 30 s hard — hard ≤30 s keeps cross-server staleness
  bounded, BP-5; the ~30 s poll cadence always triggers a rebuild well before the hard ceiling so
  the badge stays ~5 s fresh) and `ClinicConfigService::loadFacility()` (25 s / 30 s). **PHP
  single-thread caveat documented:** the lock winner recomputes synchronously in its own request
  (no true async background refresh), but because only one does and the rest serve stale, the
  stampede is gone. 3 new unit tests deterministically prove the mechanism (fresh hit → no
  recompute; stale + lock-held → serve stale, producer NOT called; stale + lock-free → rebuild +
  refresh); 1047 module tests green; `composer verify:new-clinic` PASS (no ctor cycles). Live:
  real `queue.counts` returns correct counts via the serve-stale wrapper and stays consistent
  under a concurrent burst; a general-log-instrumented 12-request burst measured 2 GROUP-BY
  executions (down from up-to-12), corroborating the reduction — the rigorous guarantee is the
  unit test, since Windows loopback caps a clean simultaneous burst. Backend-only (no UI / asset
  bump). Adds BP-13 to the charter. **Audit follow-up (same day):** a self-review found the
  serve-stale rewrite had dropped the old `is_array($cached)` guard at both call sites, so a
  corrupt/foreign cache wrapper (non-array `nc_v`) could fatal `getCounts` (`array_map` on a
  non-array) and `loadFacility` (`array_key_exists` on a non-array — and it's on nearly every
  request). No user path writes `cache_value` so likelihood is low, but it was a real
  defensiveness regression (BP-8); restored the guard at both sites (degrade to empty, self-heals
  on TTL) + a test pinning that `remember()` returns `nc_v` un-coerced. Live-proven: a poisoned
  counts wrapper now returns 200 `{counts:[]}`, not 500. **Second audit fix (same day):** closed
  the rebuild-outraces-invalidate race (pre-existing since SCALE-3.3, not introduced by 6.1, but
  fixed on request) — a config rebuild that started before a concurrent write could re-cache the
  pre-write value after the write's `invalidate()`, i.e. an admin toggle appearing not to take
  effect for ≤TTL. `remember()` now captures `$startedAt` and the rebuilder skips its store if a
  `markInvalidated($key)` stamp landed after it began producing (leaving the key absent so the
  next read rebuilds fresh); `ClinicConfigService::invalidate()` stamps on every write. The
  fresh-hit hot path is untouched (the stamp read only happens on a rebuild). Counts (TTL-only,
  never invalidated) is unaffected. Deterministic unit test proves the store-skip; config +
  counts read paths live-verified healthy. 1049 tests green. **Next in Phase 6: SCALE-6.2.**

### SCALE-6.2 — DB connection ceiling: size it, surface it, measure it

- **Problem:** nothing in Phases 0–5 addresses MySQL `max_connections`. On this box, Apache
  WinNT MPM `ThreadsPerChild=150` vs MySQL default `max_connections=151` means the connection
  ceiling and the worker ceiling nearly coincide — and exhaustion is an ugly failure (new
  requests, including logins, fail while existing ones hang). Everything we built shortens how
  long a connection is *held*; none of it addresses or documents the ceiling itself.
- **Do:** (1) **Runbook** (§1 Stage 1): add the sizing rule as an explicit step — WinNT
  `ThreadsPerChild` (or Linux php-fpm `pm.max_children`) must be sized against MySQL
  `max_connections` with headroom for the worker + backups + the occasional admin session;
  document ProxySQL as the multiplexer option for when workers must legitimately exceed
  connections (per the research, the standard answer at higher concurrency). (2) **`health.php`:**
  add `db_conns` (`SHOW STATUS LIKE 'Threads_connected'`) and `db_conns_limit` (`SHOW VARIABLES
  LIKE 'max_connections'`) to the JSON so an operator or the alerting monitor can see live
  headroom — two cheap status reads, still no PHI/config/version leak. (3) **Measure:** a
  `load-test.php` ramp that increases concurrency until connections saturate, the real number
  recorded in `SCALABILITY_BASELINE.md` (replaces the current theoretical headroom estimate with
  a measured one).
- **Verify:** `health.php` returns `db_conns`/`db_conns_limit` with sane values; runbook Stage-1
  step reviewed; a saturation load-test row appended to the baseline worksheet.
- **Size:** small-medium — mostly docs + a few lines in `health.php`; no architectural change.

- **Status (2026-07-13): DONE.** `health.php` returns `db_conns_pct` — live connection usage as a
  percentage of `max_connections`, computed server-side. **(Security-review follow-up, same day:**
  the first cut exposed raw `db_conns` + `db_conns_limit`, but this endpoint is unauthenticated and
  scrapeable and its own charter is "give the devil nothing" — leaking the absolute `max_connections`
  ceiling hands an attacker the exact connection-exhaustion target. Reduced to a coarse percent,
  which is all the alerting monitor needs; raw numbers are read directly on the DB during tuning.) Runbook v1.1.0 adds Stage-1 step **§1.8**: the sizing rule (max concurrent
  PHP workers + headroom ≤ `max_connections`), the WinNT `ThreadsPerChild=150` vs MariaDB
  `max_connections=151` near-coincidence (thin headroom out of the box; safe on a single on-prem
  box at ~6–12 real sessions, dangerous if `ThreadsPerChild` is raised without raising the DB
  limit), the php-fpm `pm.max_children` equivalent, ProxySQL as the multiplexer when workers must
  exceed connections, and "watch the ratio via `health.php`, alert at ~80%." §5 + the Stage-1
  "done when" criteria reference the new fields. **Live-measured on this box:** `db_conns_limit=151`,
  `db_conns≈42` idle — confirming the near-collision is real. **Deliberately did NOT run a forced
  saturation ramp** (it intentionally exhausts connections; belongs on staging, not the live dev
  box) — the per-hardware ceiling number gets recorded at the first pilot/staging load-test.
  Docs + health surfacing; no architectural change. `db_conns_pct` live-verified (≈28% on this
  box: 42 of 151). **Next in Phase 6: SCALE-6.3.**

### SCALE-6.3 — Retention for append-only history tables (NOT one-size-fits-all)

- **Problem:** every *infrastructure* table got self-purge (rate-limit, cache, perf-daily, export
  files/jobs), but the append-only **history** tables have none and grow with clinic activity
  forever. **They are not equal, and the plan must treat them differently:**
  - `new_visit_state_log` — **clinical / compliance audit** ("who moved this visit through the
    FSM"). High-ish volume (~5–8 rows/visit) but this is a **medical-record-adjacent audit trail;
    do NOT default-purge it on a short window.** Its retention is a *policy/legal* decision (match
    the clinic's medical-record retention — years — or archive rather than delete). Has
    `created_at` but **no index on it** (only `idx_visit_id`), so any age-based query needs an
    index first (BP-9).
  - `new_config_log` — config-change audit, low volume, indexed `(config_key, applied_at)`. Long
    retention, safe to prune eventually.
  - `new_visit_notify_log` — already **bounded** (UNIQUE `(visit_id, recipient_user_id)` → one
    row per visit+recipient, grows with visits not unboundedly per visit). Lowest priority.
- **Do:** (1) Add the missing `created_at` index to `new_visit_state_log` (guarded migration,
  BP-9). (2) Add a config-gated batched purge to `run-jobs.php` (`DELETE … WHERE created_at <
  cutoff LIMIT <batch>` in a loop, same pattern as the rate-limit/cache purges — bounded, never a
  giant single DELETE). (3) **Per-table retention config keys with SAFE defaults:**
  `retention_config_log_days` (default long, e.g. 730), `retention_notify_log_days` (default long
  or off — it's bounded anyway), and for `new_visit_state_log` a **`retention_state_log_days`
  that defaults to OFF (0 = never auto-purge)** with a prominent comment that turning it on is a
  compliance decision the clinic's records policy must sign off, not a performance default. (4)
  Note MySQL **RANGE-partition-by-date** as the *future* option if a real clinic's volumes ever
  make batched DELETE too slow — but flag the gotcha from the research (the partition column must
  be in the primary key, so it's a PK re-architecture / schema migration, explicitly **not** V1).
- **Verify:** worker prunes rows past each configured cutoff in bounded batches (unit-test the
  cutoff + batch math); `new_visit_state_log` defaults to no auto-purge and the compliance note
  is in both `install.sql` and the runbook §6; the new index exists.
- **Size:** medium — one guarded index migration + a worker purge pass + config keys + tests.

- **Status (2026-07-13): DONE.** `HistoryRetentionService::purgeAll()` prunes the three
  append-only history tables per facility-0 config, wired into `run-jobs.php` (`history_purged` in
  the worker output). **Per-table, NOT one-size-fits-all:** `new_visit_state_log`
  (`retention_state_log_days`, **default 0 = never auto-purge** — it's the visit-FSM transition
  audit, a clinical/compliance record; enabling a cutoff is a records-policy sign-off, never a
  perf default), `new_config_log` (`retention_config_log_days`, 730) on its `applied_at`,
  `new_visit_notify_log` (`retention_notify_log_days`, 730) on `notified_at` (already bounded).
  Deletes are bounded/batched (pre-count with the index, then a capped loop of `DELETE … LIMIT
  2000`; termination is count-driven since affected_rows is unreliable under query logging; a big
  backlog drains over passes) and fail soft. Guarded `#IfNotIndex` migration adds
  `new_idx_vsl_created` on `new_visit_state_log(created_at)` (BP-9); three `#IfNotRow2D` config
  seeds; index + rows applied to the dev DB. RANGE-partitioning noted as the future option (PK
  re-architecture, not V1). Table/column names come only from a fixed allowlist (injection-safe).
  5 new unit tests (disabled/unknown-table/older-than-cutoff/nothing-to-purge/purgeAll-defaults);
  1054 module tests green; `composer verify:new-clinic` PASS. Live: worker prints
  `history_purged: {new_visit_state_log:"disabled", new_config_log:0, new_visit_notify_log:0}`.
  Runbook v1.2.0 §6 documents it. Backend-only, no asset bump. **Next in Phase 6: SCALE-6.4 (last).**

### SCALE-6.4 — Turn monitoring from passive to active (alerting)

- **Problem:** `health.php` and the perf panel exist, but both are **pull** — someone must look.
  The realistic clinic failure mode is silent: the job worker dies, `worker_last_seen` goes
  `null`, and nobody notices until exports stop appearing. No page, no alert.
- **Do:** Primarily a **deployment/runbook** step, not module code: runbook §5 gains a concrete
  "wire an external uptime monitor (e.g. UptimeRobot / BetterStack, or a cron+curl on a *different*
  box) at `health.php` and alert on HTTP 503, on `ok:false`, or on `worker_last_seen` older than N
  minutes." Emphasize the monitor must be **external** so it still fires when the box itself is
  down. **Optional** module code: a tiny `scripts/health-alert.php` a local cron can run to push
  an alert through the clinic's existing SMS/email channel when health is bad — but the external
  monitor is the primary recommendation (a local alerter dies with the box).
- **Verify:** runbook §5 has the alerting step with concrete thresholds; if `health-alert.php`
  ships, a dry-run that detects a stopped worker (or DB) and reports it would alert.
- **Size:** small — mostly runbook; optional tiny script.

- **Status (2026-07-13): DONE.** Runbook §5 (v1.3.0) documents **two alerting layers**: (1)
  PRIMARY — an **external** uptime monitor on `health.php` (the bundled VPS replica, which the
  market plan already designates the remote monitoring point, or a cloud uptime service), alerting
  on not-200 / `ok:false` / `worker_last_seen` null-or-stale / `db_conns_pct ≥ 80` — this is the
  layer that catches a dead box/Apache/DB; (2) SECONDARY — a local cron running the new
  `scripts/health-alert.php`, which exits non-zero with a diagnostic when the worker heartbeat is
  stale or connections are high, so cron-mail / Task-Scheduler-notify-on-failure / a monitoring
  agent raises the alert through the deployment's existing channel (it sends nothing itself —
  channel-agnostic by design; being on the box, it can't report the box being down, hence layer 1).
  `health-alert.php` mirrors `run-jobs.php`'s bootstrap, reads the worker heartbeat + `db_conns_pct`
  via `QueryUtils`, and takes `--site` / `--worker-max-minutes` (15) / `--conns-warn-pct` (80).
  Live-proven: healthy → `OK … nominal` exit 0; heartbeat removed → `ALERT … worker heartbeat
  missing` on stderr, exit 1; restored → exit 0. `php -l` clean; `composer verify:new-clinic` PASS.
  Backend/ops only, no asset bump. **Phase 6 complete (6.1–6.4); the SCALE plan (Phases 0–6) is
  DONE** except the standing-deferred SCALE-5.3 (optional, measurement-gated) and the offline-first
  V2 product item.

### Offline / connectivity resilience — DECIDED (not a SCALE task; deliverable is the Outage Runbook)

- **This is NOT SCALE-6.5, and after a brainstorm grounded in the market plan it is no longer an
  open question.** My initial scaling assessment framed offline as an undecided gap with three
  lanes — that framing was wrong, because it hadn't reconciled against the **already-decided
  hosting posture**. Correcting it here so this plan does not contradict the canonical
  `NEW_CLINIC_MARKET_EXPANSION_MASTER_PLAN.md`.
- **Why the "offline app" gap mostly isn't real:** the decided default deployment (market plan
  §7.2, 2026-07-09) is **on-premise — a mini-PC + UPS in the clinic is the primary and the only
  place writes happen; desks talk to it over the local network.** So an **internet** outage does
  not stop the clinic (LAN keeps working); only SMS, off-site backup, and the owner's remote
  reports pause, and they self-heal on reconnect. The browser-offline machinery (IndexedDB + sync
  queue) I originally scoped as "lane 2" is aimed at a threat this architecture already neutralizes.
- **Why building it would also be wrong on its own terms:** the market plan **explicitly rules
  offline-first sync clients out for V1** — "merge conflicts on clinical + cash data are
  unacceptable… an append-only offline *capture* app is a possible V2, [PRD amendment required]."
  Queuing a check-in (or a payment) offline and merging it against a server that also moved is
  exactly that conflict class. There is also a patient-safety cost to the read-only half: a
  **stale cached clinical chart looks authoritative** — a clinician acting on a cached allergy
  list missing a just-added entry is a real hazard paper doesn't have.
- **What the actual gap was, and the deliverable that closes it:** a **written** degraded-operation
  drill — the thing the market plan §3.0 already flags as the missing W1 pilot-pack item. Now
  written: **`Documentation/NewClinic/NEW_CLINIC_OUTAGE_RUNBOOK.md`** (per-deployment; what
  keeps working vs stops by outage type × on-prem/VPS flavor, UPS sizing, power-loss recovery,
  the server-dead **paper fallback + same-day back-entry**, and the recovery checklist that reuses
  `health.php`). The paper fallback **is** V1's offline mode, and for a clinic that ran on paper
  before us, it's a good one.
- **What stays parked:** an **append-only offline capture app** (register/queue only, no two-way
  merge) is a legitimate **V2** — gated on a PRD amendment, and only moves up in priority if pilot
  sites turn out to be **VPS-primary** (internet-dependent) rather than on-prem. On the on-prem
  default it stays parked. Bring it through `nc-brainstorm` / `nc-write-spec` if/when that changes.

### Phase 6 charter additions

- **BP-13 Hot reads serve stale, never stampede.** A cache read on a hot poll path uses the
  serve-stale-while-one-rebuilds helper (SCALE-6.1), never a bare `get`→miss→`set` — the naive
  pattern re-stampedes at every TTL boundary.
- **BP-14 Every new append-only table declares its retention.** A new history/audit/log table
  ships with a retention decision in the same PR: a config-gated batched purge for prunable data,
  or an explicit "retain indefinitely / compliance record" note (like `new_visit_state_log`).
  Never add an append-only table with no retention answer.

---

## 9. Best-practices charter (apply to ALL new code from now on)

These are the standing rules that keep the system scalable as it grows into "the core of a bigger project". Add this section's ID to PR review checklists.

- **BP-1 Stateless requests.** No new `$_SESSION` writes outside auth/role flows. No new local-disk writes outside `ExportStorageService`.
- **BP-2 Bounded everything.** New list query → `LIMIT` + pagination params clamped at the controller. New loop over DB rows → batch query, never per-row queries. New endpoint → entry in `AjaxActionPolicy` with `isReadOnly` + rate-limit class.
- **BP-3 Reads don't write** (R2 above). Repairs/backfills → job worker.
- **BP-4 One slow thing = one job.** >2 s of work → `JobRunnerService`.
- **BP-5 Cache with invalidation or TTL ≤ 30 s.** Never cache without one of the two.
- **BP-6 Every poll is delta-capable.** New polling endpoint must accept `known_revision` from day one.
- **BP-7 Measure in the PR.** Perf-touching PRs paste before/after numbers from `scripts/load-test.php` into the description; append to `SCALABILITY_BASELINE.md`.
- **BP-8 Fail loud, degrade soft.** Errors return the standard envelope with context; features check their config flag and degrade to read-only rather than fatal.
- **BP-9 Schema via guarded migrations only** (`#IfNotTable` / `#IfMissingColumn` in `sql/install.sql`). Every new FK/WHERE column gets an index in the same change.
- **BP-10 Security at the boundary.** Ints cast, strings capped, dates validated, CSRF on all mutations, ACL via `AjaxActionPolicy` — never inline ad-hoc checks.
- **BP-11 Idempotency for money and state.** Any new payment/state-transition action follows the `new_cashier_payment_request` idempotency-key pattern.
- **BP-12 No premature infra.** Redis/S3/replicas are added when a measurement or the runbook progression demands them — the code is READY (drivers/abstractions) but the infra is not installed speculatively.

---

## 10. Execution order & dependency map

```
Phase 0: 0.1 → 0.2 → 0.3                     (baseline; ~1 day)
Phase 1: 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8   (hot path; 1.4 before 1.8; 1.1 before 3.1 revisit)
Phase 2: 2.1 → 2.2 → 2.3 (needs 2.1) ; 2.4, 2.5 independent — can interleave with Phase 1
Phase 3: 3.1 (needs 1.1) → 3.2 → 3.3 (needs 1.4) → 3.4 → 3.5
Phase 4: 4.1–4.6 independent of each other; 4.3 needs 1.4; 4.5 needs 0.1
Phase 5: 5.1 needs 1.8 + 3.3 ; 5.2 needs 3.4/3.5/4.3/4.6 ; 5.3 needs Phase 1 measurements
Phase 6: 6.1 (uses withLock from 3.3) → 6.2, 6.3, 6.4 independent ; offline decision gates any offline work (PRD, not this plan)
```

Rough sizing: Phase 0 ≈ 1 day · Phase 1 ≈ 1–2 weeks · Phase 2 ≈ 1 week · Phase 3 ≈ 1 week · Phase 4 ≈ 1 week · Phase 5 ≈ as needed · Phase 6 ≈ 6.1 small / 6.2 small-med / 6.3 medium / 6.4 small (~1 week total); offline-first is separately scoped via a PRD amendment.

---

## Appendix A — Bottleneck inventory (evidence)

Backend (from code audit, 2026-07-06):

| # | Bottleneck | Location | Fixed by |
|---|---|---|---|
| B1 | No `session_write_close` anywhere | whole module | SCALE-1.1 |
| B2 | Unbounded queue SQL, `SELECT v.*` | `VisitQueueService` L37–92, `VisitBoardService` L292–355, Triage L43–58, Doctor L69–101, Lab L46–55, Pharmacy L47–55, Cashier L45–55 | SCALE-1.2, 2.4 |
| B3 | `repairOrphanVisits()` UPDATE on every poll | `VisitScopeService` L218–302 | SCALE-1.3 |
| B4 | Config: ≤3 SELECTs/key, ~125 keys on admin | `ClinicConfigService` L42–107, `ClinicAdminService` L187–201 | SCALE-1.4, 3.3 |
| B5 | Patient search N+1 (3 q/row) | `PatientSearchService` L192–214 | SCALE-1.5 |
| B6 | Correlated subqueries per row | `PatientSearchService` L120–123, `CashierService` L47–49/L741–749, `VisitBoardService` L349–355 | SCALE-2.5 |
| B7 | Comms search loads ALL pnotes, filters in PHP | `CommunicationsHubService` L69–80 | SCALE-2.5 |
| B8 | "Async" export completes inside status poll | `ReportHubExportService` L165–172, L303–348 | SCALE-2.1 |
| B9 | Inline PDF/CSV/import (cohort ≤5000 rows) | `ClinicalExportService`, `PatientCohortSearchService`, AjaxController L443/L2595 | SCALE-2.2 |
| B10 | ~90 services constructed per request | `AjaxController` L141–234 | SCALE-1.6 |
| B11 | Session-based rate limiting | `RateLimitService` L30–38 | SCALE-3.1 |
| B12 | Export files on local disk, never purged | `ReportHubExportService` L351–374 | SCALE-2.3 |
| B13 | Referral upload reads whole file to memory | `ReferralDocumentService` L45–60 | SCALE-4.1 (size cap) |

Frontend:

| # | Bottleneck | Location | Fixed by |
|---|---|---|---|
| F1 | Shell polls `queue.counts` even when hidden | `shell.js` L25–27, L388–405 | SCALE-1.7 |
| F2 | Fixed intervals, no jitter → thundering herd | `useInterval.ts` L9–27 + all islands | SCALE-1.7 |
| F3 | Doctor roster refetch every queue poll | `DoctorDesk.tsx` L321/L733, `DoctorRosterBar.tsx` L66 | SCALE-1.7 |
| F4 | Full payload every poll, no revision check (desks) | all desk islands + `VisitBoard.tsx` | SCALE-1.8 |
| F5 | No client cache/dedup layer | `frontend/src/core/oeFetch.ts` | SCALE-5.3 |
| F6 | No virtualization on boards/desks | `VisitBoardColumn.tsx` L53 etc. | SCALE-5.3 (after caps) |
| F7 | No real-time transport (polling only) | — | SCALE-5.1 |

Already good (protect in review): per-island bundles (`vite.config.ts` L37–60), scheduling delta polls (`SchedulingFlowBoardService` L84–99), batch enrichment (`VisitRowEnricher` L27–150), pagination in comms/registry/report-hub, hidden-tab skip in `useInterval`, idempotent cashier payments, DB-backed user settings.

## Appendix B — Custom tables (for runbook/backup work)

`new_clinic_config`, `new_visit_type`, `new_visit`, `new_visit_state_log`, `new_visit_queue_counter`, `new_patient_meta`, `new_patient_completion`, `new_completion_field_weight`, `new_fee_schedule`, `new_receipt`, `new_receipt_counter`, `new_cashier_payment_request`, `queue_bridge_exception_snapshot`, `new_condition_map`, `new_cohort_saved_filter`, `new_doctor_availability`, `new_visit_notify_log`, `new_lab_order_meta`, `new_reconciliation_run`, `new_config_log`, `new_drug_meta`, `report_hub_export_run`, `clinical_doc_form_open`, `admin_hub_backup_run`, `admin_hub_setup_progress`, `new_clinic_flowboard_lane_prefs`, `new_clinic_flowboard_lane_map`, `new_clinic_recall_meta`, `nc_encounter_note` — plus new in this plan: `new_clinic_maintenance_lock` (1.3), `new_clinic_rate_limit` (3.1), `new_clinic_cache` (3.3), `new_clinic_perf_daily` (4.5).

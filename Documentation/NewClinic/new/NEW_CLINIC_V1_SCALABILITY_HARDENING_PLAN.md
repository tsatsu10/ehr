# New Clinic V1 — Scalability & Hardening Plan

**Version:** 1.0.0
**Date:** 2026-07-06
**Status:** Approved plan — not yet implemented
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

- **Status (2026-07-13): DONE.** `RateLimitService` now counts in `new_clinic_rate_limit` with the minute window baked into the bucket key (`action:uID:YYYYMMDDHHII`) — one atomic upsert + a read-back by key (`affected_rows`/`LAST_INSERT_ID` are unreliable under OpenEMR's query logging). Counters key on userId + action: cookie-clearing no longer resets them and N web servers share one budget. Limits/config keys unchanged. Worker purges windows older than 1h each pass. **SCALE-1.1 revisit done:** `patients.search` + `patients.dup_check` are now `isReadOnly` (session lock released) since the limiter no longer writes `$_SESSION`. Live-proven: 30 calls ok, 31st → 429 (real config path); 7 DB-window unit tests; policy test updated.

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

### SCALE-3.4 — Sessions & deployment statelessness audit (documentation task)

- **Do:** Write `Documentation/NewClinic/NEW_CLINIC_SCALE_OUT_RUNBOOK.md` covering, concretely for this codebase: moving PHP sessions to Redis (`session.save_handler = redis` — an OpenEMR-level php.ini concern, no module code change), which module features assume local disk (export storage → SCALE-2.3 driver), confirming no other module-local file writes exist (grep `file_put_contents|fopen.*w` in `src/` and list findings), and the LB health-check endpoint (SCALE-4.4). This is the checklist an ops person follows to go from 1 → N servers.
- **Verify:** the grep audit table in the doc is complete (every write call site listed with verdict safe/unsafe).

### SCALE-3.5 — Read/write DB split readiness (documentation + tagging task)

- **Do:** Do NOT build replica routing now. Instead: (1) in `AjaxActionPolicy`, the `isReadOnly` flag from SCALE-1.1 already classifies every action — verify completeness; (2) add a section to the scale-out runbook explaining that read-only actions can later be pointed at a replica via ADODB config, and which actions must NEVER be (anything reading data it just wrote in the same user flow — list cashier payment status, visit state transitions); (3) note replication-lag hazards for the queue board (a just-moved visit may bounce back for 1 poll) and the mitigation (route queue reads to primary OR accept 1-poll staleness — decide when the replica actually exists).
- **Verify:** doc section exists; `AjaxActionPolicyTest` asserts 100 % of actions carry the flag.

---

## 7. Phase 4 — Devil-proofing (abuse, failure, and Murphy)

> "Even if the devil gets involved, the system can scale up." The devil shows up as: hostile input, stolen sessions, runaway clients, dying dependencies, full disks, clock skew, and 3 a.m. deploys.

### SCALE-4.1 — Input hardening sweep at the AJAX boundary

- **Do:** For every action in `AjaxActionPolicy`, verify (grep + read each handler) that: ids are cast to int before SQL; strings that reach `LIKE` are length-capped (add a shared `Sanitize::searchToken($s, maxLen=64)` helper); pagination params are clamped (`page ≥ 1`, `per_page ≤ documented max`); date params validated (`DateTimeImmutable::createFromFormat` or reject); JSON bodies size-capped (reject `CONTENT_LENGTH` > 1 MB for non-upload actions, 413-style envelope). Produce a checklist table in the PR description: action → params → verdict. Fix violations as you find them. All SQL must remain parameterized (the module already uses placeholders — verify no string-concatenated SQL slipped in: grep for `\" . \$` near `sql`).
- **Verify:** curl fuzz: negative ids, 10 KB search strings, `per_page=999999`, malformed dates → all return clean 400-style envelopes, never a PHP warning or a slow query.

### SCALE-4.2 — Timeouts and query budgets

- **Do:** (1) Set `max_execution_time` guard: at the top of `handleRequest()` for read-only actions, `set_time_limit(15)`; job worker keeps its own longer budget. (2) MySQL side: add `SET SESSION max_execution_time = 10000` (10 s, MySQL 5.7.8+/8.0 optimizer hint alternative `/*+ MAX_EXECUTION_TIME(10000) */` on the heavy SELECTs) for queue/board/search reads so a pathological scan self-kills instead of pinning a worker. Confirm XAMPP's MySQL/MariaDB version first and use the matching mechanism (MariaDB: `max_statement_time`).
- **Verify:** artificially slow query (`SLEEP(20)` in a temp branch) → request dies at ~10 s with the error envelope and an NC_PERF log line, not a 60 s hang.

### SCALE-4.3 — Graceful degradation modes

- **Do:** Add config keys (default OFF) that a human flips during an incident, all read via the (now cheap) config service: `panic_readonly_mode` (all mutating actions return a friendly "maintenance" envelope; reads still work), `panic_poll_multiplier` (server multiplies the `pollMs` it hands to Twig by N — instantly quarters fleet-wide poll load without deploying). Wire `pollMs` origin: `ClinicConfigService::resolveQueuePollIntervalMs()` (L85–93) is the single choke point — multiply there. Frontend needs NO change (it already receives `pollMs` from Twig).
- **Verify:** flip each flag in DB → mutation blocked with clean message / polls visibly slow down after page reload; flags OFF → identical behavior to today. Document both flags in the runbook.

### SCALE-4.4 — Health & readiness endpoint

- **Files (new):** `public/health.php`.
- **Do:** No-auth endpoint returning JSON `{ok, db_ms, cache_ms, worker_last_seen}`: one `SELECT 1` timed, one cache get/set timed, and last heartbeat timestamp the job worker writes to the cache/DB every loop. Return HTTP 503 when DB fails. No session start (keep it lock-free), no secrets in output, and rate-limit by IP via a simple fixed-window on the cache (devil-proofing: health endpoints get scraped).
- **Verify:** 200 + sane timings normally; stop MySQL → 503; endpoint responds <50 ms and appears in no auth logs as a failure.

### SCALE-4.5 — Audit & anomaly visibility

- **Do:** Extend SCALE-0.1's NC_PERF logging with a daily rollup job (in the worker): insert per-action counts/p95 into `new_clinic_perf_daily (day, action, calls, p95_ms, errors)`. Add an Admin Hub read-only panel (behind existing `enable_admin_hub`) listing yesterday's top-10 slowest actions and error counts — grep Admin Hub island for the panel pattern to copy. This is how a future operator SEES the devil early.
- **Verify:** worker rollup populates the table from logged lines (or from a request-time counters table if log parsing is brittle on Windows — prefer counters table: increment in the `finally` block, one `INSERT ... ON DUPLICATE KEY UPDATE` per request, keyed by day+action); panel renders.

### SCALE-4.6 — Backup/restore & migration safety notes

- **Do:** In the scale-out runbook add: list of ALL module tables (28 custom tables — copy the table list from the audit section of this plan's appendix) with a one-line "loss impact" per table (e.g. `new_visit` = catastrophic, `new_clinic_perf_daily` = disposable); the statement that ALL schema changes go through `sql/install.sql` `#IfNotTable/#IfMissingColumn` guards (never manual DDL in prod — this repo's existing convention); and a restore-drill checklist (restore dump to scratch DB, run `verify-module.php`, load visit board).
- **Verify:** doc section complete; every custom table listed.

---

## 8. Phase 5 — Real-time transport & long-term posture (only after Phases 1–4)

### SCALE-5.1 — Server-Sent Events for queue invalidation (design first, then build)

- **Why last:** Phases 1–3 make polling ~10× cheaper; SSE is the next order of magnitude but adds operational surface. Do not start until SCALE-1.8 revisions exist (SSE will push "revision changed, refetch" pings, NOT payloads — reuse everything).
- **Do:** Write a one-page design doc first (`Documentation/NewClinic/NEW_CLINIC_SSE_DESIGN.md`): endpoint `public/events.php` streaming `text/event-stream`; MUST call `session_write_close()` immediately after auth; publishes facility-scoped `queue_revision` events by polling the revision token server-side every 2 s (cheap after SCALE-1.8/3.3); islands subscribe via `EventSource` and fall back to interval polling when SSE is unsupported/disconnected (keep `useInterval` as fallback, raise fallback interval to 60 s when SSE is healthy). Note Apache/XAMPP caveats (`mod_php` worker exhaustion — SSE ties up a worker per client; document that this feature requires php-fpm + event MPM or a small Node/Go relay, and gate it behind `enable_sse` default OFF).
- **Verify (design phase):** doc reviewed; explicitly lists worker-count math (N SSE clients = N held workers under prefork — the go/no-go criterion for enabling).

### SCALE-5.2 — Deployment runbook consolidation

- **Do:** Merge all runbook fragments (SCALE-3.4, 3.5, 4.3, 4.6) into the final `NEW_CLINIC_SCALE_OUT_RUNBOOK.md` with a 1-server → 2-server → N-server progression: what to flip, in what order, with verification per step (health endpoint, load test script, perf panel).
- **Verify:** a person who has never seen the codebase can follow it (test: give it to a fresh agent session and ask what step 3 is).

### SCALE-5.3 — Frontend client-cache layer (optional, measured)

- **Do:** Only if Phase 1 measurements show duplicate concurrent fetches still matter: introduce TanStack Query for desk islands (the frontend guide already anticipates this), scoped to queue endpoints, with `staleTime = pollMs`. One island first (visit board), measure, then roll out. Virtualize board columns/desk lists with the already-present `@tanstack/react-virtual` ONLY if a real clinic exceeds the SCALE-1.2 caps regularly (the caps make this unlikely for V1).
- **Verify:** request dedup visible in the network tab; no behavior change; Vitest passes.

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
```

Rough sizing: Phase 0 ≈ 1 day · Phase 1 ≈ 1–2 weeks · Phase 2 ≈ 1 week · Phase 3 ≈ 1 week · Phase 4 ≈ 1 week · Phase 5 ≈ as needed.

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

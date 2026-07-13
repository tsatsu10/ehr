# New Clinic — Scalability Baseline Worksheet

Before/after latency numbers for the SCALE-* hardening tasks, captured with
`interface/modules/custom_modules/oe-module-new-clinic/scripts/load-test.php`
(SCALE-0.2). Every perf-touching PR appends a row (charter rule BP-7).

**How to capture a row:** log into the dev box, copy your session Cookie header,
then run (PowerShell — one line):

```
php interface/modules/custom_modules/oe-module-new-clinic/scripts/load-test.php --url="http://localhost/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/ajax.php" --action=queue.counts --cookie="<paste Cookie header>" --requests=50 --concurrency=10 --run
```

The script prints a paste-ready worksheet row. All numbers are milliseconds.

---

## Latency percentiles (per action)

| Date | Action | Requests | p50 (ms) | p95 (ms) | p99 (ms) | Errors |
|---|---|---|---|---|---|---|
| 2026-07-12 | queue.counts | 50 | 1527.5 | 2869.2 | 3274.6 | 0 |
| 2026-07-12 | visit.board | 50 | 2060.4 | 3433.6 | 3990.5 | 0 |
| 2026-07-12 | doctor.queue | 50 | 2231.2 | 3725.9 | 4329.3 | 0 |
| 2026-07-12 | admin.config | 50 | 3650.6 | 6534.2 | 6697.9 | 0 |
| 2026-07-12 | patients.search | 20 | 1536.8 | 2611.1 | 2718.0 | 10† |

All runs: concurrency 10, GET (except `patients.search` = POST+CSRF), against the
dev box (298 visits). Captured with `scripts/load-test.php --run`.

> **Baseline read (2026-07-12) — the session lock dominates everything.**
> Even `queue.counts`, the lightest action, sits at p50 **1.5 s** under 10 concurrent
> requests. The smoking gun: `patients.search` reports `server_timing_ms: 3–5` in its
> own payload, yet its total latency is **~1537 ms** — i.e. **~99.7 % of the time is
> spent waiting for the PHP session file lock**, not doing work. Because no handler
> calls `session_write_close()`, the 10 concurrent requests from one session serialize
> one-behind-another. `admin.config` is worst (p50 **3.65 s**) — it adds the ~125-key
> config load (SCALE-1.4) on top of the lock. **Expected order of wins:** SCALE-1.1
> (session lock) collapses the shared ~1.5 s floor across *all* actions; SCALE-1.4
> then takes another big bite out of `admin.config`.
>
> † `patients.search` notes: (a) it is rate-limited to 30/min (SCALE-3.1 will move
> that off the session), so the run used 20 requests; (b) the 10 non-2xx were **400s
> that occur only under 10-way concurrency** on one session (a CSRF/session race in the
> test harness) — sequential requests are 100 % 200; (c) the query `"mensah"` returned
> **0 rows on this box**, so the per-row N+1 (SCALE-1.5) did **not** fire here — re-run
> with a surname that matches real patients to baseline that specific bottleneck.

> Rows marked _pending_ are placeholders — replace with real `--run` output
> against a seeded dev box (SCALE-0.3). Running the load test needs a live
> logged-in session cookie, so it is captured on the desktop XAMPP box, not in CI.

## Data volume at baseline (context for the numbers above)

| Date | `new_visit` rows | `patient_data` rows | Notes |
|---|---|---|---|
| 2026-07-12 | 298 | 305 | dev box; 34 visits created today |

## ⚠️ Environment finding: opcache was OFF (fixed 2026-07-12)

The Phase-0 baseline above was captured with **PHP opcache disabled** on this XAMPP box
(`;zend_extension=opcache` was commented out in `C:\xampp\php\php.ini`). With opcache off,
PHP **recompiles all ~10k+ OpenEMR files on every request** — instrumentation showed core
`globals.php` bootstrap alone taking **~1000 ms per request** (module controller construction
was only **3 ms** — so SCALE-1.6's premise is near-moot here). That ~1 s compile penalty sat
under every number in the first table and does not exist in any correctly-configured
deployment.

**Fixed:** enabled opcache (256 MB, 20k files, `validate_timestamps=1` + `revalidate_freq=2`
so dev edits are still picked up), Apache restarted. Single-request `queue.counts` dropped
**~1000 ms → ~155 ms**. **Always run scalability measurements with opcache ON** — it is the
realistic condition and it is the single biggest latency lever on this box.

## Latency percentiles — opcache ON (the real baseline), concurrency 10

| Date | Action | p50 (ms) | p95 (ms) | Note |
|---|---|---|---|---|
| 2026-07-12 | queue.counts | 961 | 1782 | dispatch-trivial; cost is core boot under the session lock |
| 2026-07-12 | visit.board | 946 | 1603 | |
| 2026-07-12 | doctor.queue | 1282 | 2331 | |
| 2026-07-12 | admin.config | 1445 | 2229 | +125-key config load (SCALE-1.4 target) |

Single-request (concurrency 1) `queue.counts` ≈ **155 ms**, vs **961 ms** at concurrency 10 —
the remaining ~6× gap is the PHP session lock held during **core bootstrap**, before any module
code runs (so the module cannot release it earlier than end-of-boot; a core-level early
`session_write_close()` or a non-blocking session backend — SCALE-3.x — is the only lever there).

## SCALE-1.1 result — session-lock release (A/B, opcache ON, concurrency 10)

`session_write_close()` for vetted read-only actions after auth, before dispatch.

| Action | Without 1.1 (p50) | With 1.1 (p50) | Effect |
|---|---|---|---|
| admin.config (dispatch-heavy) | 2873 | **1316** | **−54%** — releasing the lock lets other requests' boots overlap this one's 125-key load |
| queue.counts (dispatch-trivial) | 866 | 951 | ~noise — no post-close work to overlap |

**Verdict:** SCALE-1.1 delivers a large win on dispatch-heavy read actions (config load, row
enrichment, bill-ops reads) and is neutral on trivial polls (whose whole cost is pre-dispatch
boot). Kept. Trivial-poll serialization is bounded by core boot time and is addressed by opcache
(done) + future core/session-backend work, not by this module task.

## Change log

| Date | SCALE task | Action measured | Before p50 | After p50 | Note |
|---|---|---|---|---|---|
| 2026-07-12 | SCALE-0.2 | — | — | — | Harness + worksheet created; NC_PERF logging live (SCALE-0.1). Harness flags non-JSON bootstrap-bounce 200s as errors; supports POST+CSRF. |
| 2026-07-12 | SCALE-0.3 | all 5 | — | — | Phase-0 baseline captured (opcache OFF — see finding below). |
| 2026-07-12 | (env) opcache | queue.counts | ~1000 | ~155 | Enabled opcache (was off). Single biggest latency lever; re-baselined. |
| 2026-07-12 | SCALE-1.1 | admin.config | 2873 | 1316 | Session-lock release: −54% on dispatch-heavy reads; neutral on trivial polls. |
| 2026-07-12 | SCALE-1.2 | (all queues) | — | — | R1: hard `LIMIT` cap on every desk queue + board lane (QueueLimits: 200 queue / 100 lane, fetch cap+1 to flag truncation). `queue_truncated`/`queue_cap` in every payload; **board + all 5 desks show a "showing first N" banner**. **Live-proven:** seeded 201 active visits → `doctor.queue` returned exactly 200 with `queue_truncated=true`, then cleaned up (298→298). Bounded-query protection, not a latency change. |
| 2026-07-12 | audit fix | claimMaintenanceLock | writes/poll | read/poll | SCALE-1.3 follow-up (found in self-audit): the lock claim wrote to the lock row on every poll even when losing → single-row write contention under the load it targets. Added a read-only fast-path: a live lock short-circuits to a shared read, only the ~1/5min winner writes. |
| 2026-07-12 | SCALE-1.4 | admin.config | ~125 queries | 2–3 queries | R4: per-instance config cache loads all of a facility's keys in ONE query; the ~130-key admin load drops from ~125–375 queries to 2–3 (also removes a per-key `resolveDefaultFacilityId` DB hit). **Equivalence live-proven: 126 (key,facility) pairs, 0 value mismatches** (facility>global>reader precedence preserved exactly). **Latency unchanged within noise** (1568 vs 1445 ms p50) — the tiny indexed config queries were never the bottleneck; core bootstrap under the session lock is. Win is DB-load reduction realized at scale, not single-box latency. |
| 2026-07-12 | SCALE-1.5 | patients.search | ~5×N queries | ~6 total | Killed the search N+1: `mapResultRow` fired active-visit + facility-resolve + appointment (×2) + recall queries per result row. Now batched — `batchActiveVisits` + `chipsForPatients` (appointment/recall) do one query each keyed by pid, so an 8-result search drops from ~40 queries to ~6 (independent of result count). **Byte-identical live-proven: 12 pids, 0 mismatches incl. a seeded populated-appointment path**; end-to-end search returns correctly (server ~19 ms). Single-pid methods kept (used by PatientContextService). |
| 2026-07-12 | SCALE-1.6 | AjaxController ctor | — | — | **Already done** (prior AUDIT-10a): controller uses a lazy memoized `svc()` container, zero eager service props. Constructor measured 3 ms. Plan status was stale. |
| 2026-07-12 | SCALE-1.7 | (all polls) | lockstep | jittered | Frontend polling hygiene: `useInterval` now applies ±10% per-mount jitter (covers all 5 desks, board, flow-board, calendar → no shift-start thundering herd); shell.js `queue.counts` skips while tab hidden + refreshes on becoming visible + jitter; doctor desk stops refetching `doctor.roster` every queue poll (now every 5th + mount + local toggle). Autosave/clock/per-chart ticks deliberately left alone. Build + 490 vitest pass; shell.js syntax OK. Asset `20260712pollhygiene`. |
| 2026-07-12 | SCALE-1.8 | board + 5 desks | full payload/poll | token when static | Delta polling on all 6 queue surfaces. Shared `respondQueue()` hashes the fully-built payload (`QueueRevision`); a client sending a matching `known_revision` gets a tiny `{unchanged:true}` and skips its re-render. **Chose build-then-hash (always correct) over a cheap pre-query token** — the payload draws on 8+ badge tables (lab results, prescriptions, queue-bridge…), so a cheap token would either miss changes (stale queues) or scan large clinical tables. Saves network bandwidth + client re-renders, not server queries (bounded by 1.2/1.4/1.5). Also hardened: `json_encode` failure → unique token (never a false "unchanged"/frozen queue). **Live-proven per surface:** wrong-rev→full board, real change→new revision. Doctor desk ticks the roster counter on unchanged polls too. Asset `20260712deltapoll`. **Phase 1 complete (8/8).** |
| 2026-07-12 | SCALE-2.2 (cohort) | registry export | 5000-row build in req | worker for >500 | Generic job runner: new `new_clinic_export_job` table + `ExportJobService` (enqueue/claim/worker/retry/poll/download, dispatch by `job_type`, same proven claim pattern as 2.1). Cohort export now does a row-count pre-check — ≤500 rows build inline (unchanged UX), >500 enqueue a `cohort_csv` job built off the request path. Shared frontend `pollExportJobToDownload` helper handles the async CSV. `run-jobs.php` drains both report + generic jobs. **Live-proven:** enqueue→worker→ok (305-row CSV file written, download correct). **AUDIT (critical, fixed):** the session-less worker resolved the facility filter to "unfiltered" → a facility-scoped user's large export would have leaked ALL facilities' patients. Fixed: capture the user's facility clause at enqueue and apply it in the worker (proven: captured `pid<=50` scope → 51 rows vs 305 unfiltered). Secondary hole from that fix (client could inject `__facility_filter` to widen scope) closed by stripping the field at the request boundary. Report export (2.1) was already safe — scopes by the explicit stored `facility_id`, no session dependency. **Remaining sub-tasks (same infra):** clinical PDF export + config import — each just needs a `job_type` handler + a sync/async pre-check. |
| 2026-07-13 | SCALE-2.5 (partial) | visit.board | 2×N queries | 2 queries | Fixed the clear per-row N+1: `VisitBoardService::fetchClosedUnpaid` called `enrichVisitRows([$row])` inside `array_map` — re-running the enricher's 2 batch queries once PER row. Now one batch enrich + a zipped per-row `unpaid_reason`. Live-verified identical output (seeded closed-unpaid visit → reason + enrichment intact). **Deliberately left:** the correlated-subquery conversions the plan lists (cashier billing SUM, `last_visit_date` MAX) — swapping an indexed per-row subquery for a derived-table JOIN scans the whole billing/encounter table, not a clear win for a capped ≤200-row queue; would need measurement before changing. Comms search (`load all pnotes, filter in PHP`) left too — the clean fix needs a custom query that risks diverging from stock `getPnotesByUser` scoping. |
| 2026-07-12 | SCALE-2.1 | reports export | work in poll req | background worker | R5: "async" exports used to build the CSV INSIDE the status-poll HTTP request (`set_time_limit(0)`). Now a DB-backed job queue: `report_hub_export_run` gains `claimed_by`/`claimed_at`/`attempts`; `scripts/run-jobs.php` worker atomically claims (unique-token read-back, not affected-rows) + runs jobs, retrying ≤3 then failing; `pollExportStatus()` is a PURE read. No-worker hosts keep working via a short inline fallback (`enable_inline_export_fallback`, default on, runs a job unclaimed >10s). **Caught in build:** client poll budget was exactly 60s == the planned 60s fallback → would time out; shortened fallback to 10s + widened client budget to ~150s. **Live-proven:** worker completes valid jobs (file written), bad jobs retry 3×→failed, fallback gating correct (unclaimed+old→run; claimed/young/exhausted→skip), backlog drains oldest-first. Asset `20260712jobrunner`. **Phase 2 started.** |
| 2026-07-12 | SCALE-1.8 follow-up | board + 5 desks | delta-limited | delta-full | **Client-computed wait time** (audit follow-up). Was: `wait_minutes` kept in the hash → delta only fired within each whole minute (weak for busy queues). Now: enricher emits a stable tz-agnostic `started_at_epoch`; `WaitTimeSpan` computes the live wait from it + a shared `useMinuteTick` (one 30s timer for all cards, `useSyncExternalStore`, pauses when hidden); `wait_minutes`/`wait_label` dropped from the `QueueRevision` hash. Result: **the delta now fires over time even for busy queues** (revision stable across a 6s idle gap — live-proven on all 6) while the on-screen wait still advances every ~30s with NO network. Falls back to the server value for any card lacking the epoch (existing tests unchanged). 492 vitest (2 new epoch tests) + build + backend gate green. Asset `20260712livewait`. |
| 2026-07-13 | SCALE-4.6 | (docs) | — | — | Runbook §8: 32 module tables bucketed by loss impact, guarded-migration rule, quarterly restore drill. |
| 2026-07-13 | SCALE-4.3 | incident levers | deploy needed | DB flag flip | `panic_readonly_mode` (503 maintenance envelope for mutations, reads keep working — GET + read-only allowlist rule, never allows a write) and `panic_poll_multiplier` (1–10× on the single pollMs choke point). Live-proven: DB flip → 30000→120000 ms→restored; block/allow decisions correct. |
| 2026-07-13 | SCALE-4.4 | health endpoint | none | public/health.php | No-bootstrap (no session/auth/globals) mysqli probe: `{ok,db_ms,cache_ms,worker_last_seen}`; worker heartbeat via run-jobs.php (10-min TTL — observed going null during the MySQL-stop drill); per-IP 30/min. Live-proven: 200 (~50–100 ms incl. connect, db_ms ~9), MySQL stopped → 503 → restarted → 200, hammer → exactly 30 ok then 429. |
| 2026-07-13 | SCALE-3.4/3.5 | (docs) | — | — | Scale-out runbook v0.1.0 written (`Documentation/NewClinic/NEW_CLINIC_SCALE_OUT_RUNBOOK.md`): 1→2-server checklist, complete file-write grep audit with verdicts, static-state sweep, worker/backup node placement, read-replica readiness incl. never-replicate list. New guardrail test proves every READONLY/POLL allowlist entry is a real dispatchable action (typo-proof). **Phase 3 complete.** |
| 2026-07-13 | SCALE-3.3 | cache layer | none | apcu→db CacheService | R4/BP-5: `CacheService` (apcu auto-detect, `new_clinic_cache` DB fallback, `cache_driver` key, fail-open, token-claimed `withLock`). Wired: config maps cached 30 s cross-request (write-invalidated, facility+global keys) and `queue.counts` cached 5 s per facility+date — absorbs the fleet-wide shell poll and desk-header counts (also skips repair-lock reads on hits). Worker purges expired rows. Live-proven: poisoned-row cache-hit proof, read-after-write immediate. APCu not loaded on this box (DB driver active); enable `apcu` in deployment for near-free hits. |
| 2026-07-13 | SCALE-3.2 | poll endpoints | unlimited | 90/min/user/action | Devil-proofing: all 24 recurring poll actions now carry a generous DB rate budget enforced centrally in AjaxController (`poll.` buckets). 429 returns `retry_after_ms`; oeFetch arms a tab-wide backoff, useInterval + shell.js skip poll ticks until the window rolls over (client-only ticks opt out). Live-proven: 95 hammer calls → 90 ok, 5 limited. Normal use ~6/min/tab never hits it. Asset `20260713pollbudget`. |
| 2026-07-13 | SCALE-3.1 | rate limiting | $_SESSION counters | DB fixed-window | Counters moved to `new_clinic_rate_limit` (atomic upsert, window in the bucket key, keyed user+action): survive cookie clearing, aggregate across servers, and free `patients.search`/`patients.dup_check` to release the session lock (SCALE-1.1 flag flipped for both). Worker purges dead windows hourly. Live-proven: 31st search in one minute → 429; limits/config identical. |
| 2026-07-13 | SCALE-2.3 | export file storage | ad-hoc paths | ExportStorageService | R6: both export families (`nc_report_exports`, `nc_export_jobs`) now write/read/delete/purge ONLY through `ExportStorageService` — single seam for a future object-storage driver (`export_storage_driver`, default `local`, unknown → fail loud). Downloads are containment-checked (tampered `file_path` can't read outside the namespace). SEC-6 24h retention now also enforced by every `run-jobs.php` pass (idle systems get cleaned; before, purge only ran on new writes). Site-files backup now excludes both transient export dirs. Fixed `run-jobs.php` CLI site resolution (`--site=`, was broken as documented). Live-proven: cohort job → worker → download (305 rows); expired plants purged, fresh kept; 8 new unit tests; 1003 module tests green. |
| 2026-07-13 | SCALE-4.2 | read timeouts | unbounded | 10 s DB / 15 s PHP | Read-budgeted actions (read-only allowlist minus `cohort.export_status`) get `SET SESSION max_statement_time=10` (MariaDB; MySQL variant auto-selected from the handshake) + `set_time_limit(15)`; mutations deliberately unbudgeted. New failsafe shutdown guard converts both death modes (PHP fatal, `HelpfulDie()` HTML) into a clean 503 `timeout` envelope — also keeps SQL text off the ajax wire. Live drill: `SLEEP(20)` → 503 in 10.3 s, busy-loop → 503 in 15.2 s, both with corrected-status NC_PERF lines; healthy requests unchanged. |
| 2026-07-13 | audit (SCALE-4.1 self-review) | resolveRequestAction body fallback | read body before size check | size-checked before read | Found on a line-by-line re-review of the 4.1 diff: the action-in-body fallback path (unused by any real caller, but reachable) called `readJsonBody()` before the new 1 MB budget check could run, defeating the budget's "never read >1 MB for an ordinary action" guarantee for a crafted request. Fixed by gating the fallback read itself by `CONTENT_LENGTH`; a huge action-only-in-body POST now gets a clean 413 in 0.22 s instead of a full body parse. Live-verified both the fix and the small-body-still-works case. |
| 2026-07-13 | SCALE-4.1 | ajax input boundary | uncapped needles/dates/bodies | capped + validated + 413 | Sweep of all 301 actions (see `SCALE_4_1_INPUT_AUDIT.md` for the full checklist): ids/pagination/SQL found already safe; fixed LIKE length caps (`Sanitize::searchToken`, 11 services, ~25 fields), strict day validation (28 sites, malformed → 400 incl. overflow dates), and body budgets (32 MB pre-read ceiling, 1 MB/action, 7-action upload allowlist, 413). 12-case live fuzz clean. Accepted: audit-log LIKE over core `log` stays ~11 s (bounded by 4.2 statement budget). |
| 2026-07-13 | SCALE-6.4 | monitoring: passive → active | pull-only (nobody paged) | two-layer alerting | Runbook §5 documents an external `health.php` monitor (primary; catches box/Apache/DB down) + a local `scripts/health-alert.php` cron (secondary; catches "worker died / conns high while box up", exits non-zero for cron-mail/Task-Scheduler to raise). Channel-agnostic (script sends nothing). Live: healthy→exit 0; heartbeat removed→`ALERT` exit 1; restored→exit 0. **Completes Phase 6 / the SCALE plan (Phases 0–6).** |
| 2026-07-13 | SCALE-6.3 | history-table retention | grow forever | worker-purged (state_log OFF) | `HistoryRetentionService` prunes append-only history in the worker: `new_config_log`/`new_visit_notify_log` at 730 d, **`new_visit_state_log` default 0 = never** (clinical/compliance audit — enabling is a records-policy decision). Bounded/batched deletes (pre-count + capped `DELETE … LIMIT 2000` loop), guarded `#IfNotIndex` on `state_log(created_at)`, 3 config seeds. Live: worker prints `history_purged`. 5 tests; 1054 green. Partitioning noted as future (PK re-arch, not V1). |
| 2026-07-13 | SCALE-6.2 | DB connection ceiling | unmeasured/undocumented | surfaced + sized | `health.php` returns `db_conns_pct` (coarse % — a security-review follow-up reduced it from raw `db_conns`/`db_conns_limit` since the endpoint is unauthenticated/scrapeable and leaking `max_connections` aids a connection-exhaustion DoS). **Measured on this box:** `db_conns_limit=151` (MariaDB default `max_connections`) vs Apache WinNT `ThreadsPerChild=150` — they nearly coincide, confirming the documented near-collision (150 busy threads ≈ the 151 ceiling, ~no headroom for worker/backups/admin). Idle-ish dev box already sits at ~42 connections (XAMPP + phpMyAdmin + drill residue). Runbook Stage-1 §1.8 documents the sizing rule (workers+headroom ≤ max_connections; ProxySQL when workers must exceed it) + monitor-the-ratio guidance. **No forced saturation ramp run** — that intentionally hits the ceiling and belongs on a staging box, not the live dev box; the real per-hardware number gets recorded when a pilot/staging load-test runs. Docs + health surfacing only; no architectural change. |
| 2026-07-13 | SCALE-6.1 | queue.counts cache | stampede at each expiry | 1 rebuild (serve-stale) | `CacheService::remember()` serve-stale-while-one-rebuilds via existing `withLock`, wired into `getCounts` (5/30) + `loadFacility` (25/30). Was: bare get/miss/set → all tabs re-run the GROUP BY at every 5 s expiry. Now: one caller rebuilds, rest serve ≤5 s-stale. Unit tests prove the mechanism (lock-held → serve stale, producer not called); live general-log burst measured 2 GROUP-BYs across 12 requests (down from up-to-12); real endpoint correct + consistent under burst. 1047 tests green; backend-only. |
| 2026-07-13 | online-research review | (planning) | — | — | Deliberate blind-spot hunt after Phases 0–5: cross-checked our design against external best-practice (PHP+MySQL connection limits, cache-stampede literature, MySQL retention/partitioning, offline-first EMR practice) and re-verified against code. 5 gaps → **Phase 6 added to the plan** (§8A). Real + verified: (1) cache stampede — `getCounts()` does bare get/set, no `withLock`, so N tabs re-run the GROUP BY at every 5 s expiry (SCALE-6.1, small fix, machinery already exists); (2) DB connection ceiling never addressed — WinNT ThreadsPerChild=150 ≈ MySQL max_connections=151 (SCALE-6.2, docs + health surfacing); (3) append-only history tables grow forever, no retention — but `new_visit_state_log` is a clinical/compliance audit needing a *policy* decision not a purge default (SCALE-6.3); (4) monitoring is pull-only, no alerting (SCALE-6.4, runbook). Fifth gap — offline/connectivity resilience — **resolved by a brainstorm, not an open decision**: grounded in the decided on-prem hosting posture (market plan §7.2 — mini-PC+UPS in the clinic, LAN keeps working through internet loss), the "offline app" gap mostly isn't real, and offline-first sync is already a decided V1 non-goal (merge conflicts on cash/clinical data). Real deliverable = the written **Outage Runbook** (`NEW_CLINIC_OUTAGE_RUNBOOK.md`, now written — the market plan's own missing W1 pilot-pack item); an append-only capture app stays V2/PRD-gated. SCALE-6.1–6.4 not built yet — this row records the plan. |
| 2026-07-13 | audit (2.3–4.5 range) | — | — | — | Full audit of the 10 SCALE commits since 325e12e6. Fixed: (1) HIGH — perf counter recorded raw client action strings (unbounded `new_clinic_perf_daily` cardinality + NC_PERF log forgery); unknown-described actions now collapse to `(unknown)`, guardrail test proves all 301 real actions describable. (2) MED — `new_clinic_rate_limit` purge was worker-only; consume() now self-purges ~1-in-200 (worker-less installs stay bounded). (3) LOW — perf panel day now server-clock tokens (`today`/`yesterday`), immune to workstation tz. (4) LOW — getCounts cache-instance hoist. Accepted risks (documented, no fix): failsafe guard's strict `<h2>` starts-with match (widening risks prod false-positives; miss is dev-only), `getOrSet`/`withLock` unused-but-tested seams, perf rollup worker-only (growth bounded to catalog size). Everything else in range checked clean: health.php input/IP handling, cache invalidation key coverage, export containment, poll backoff, panic flags, install.sql index coverage. Asset `20260713audit1`. |
| 2026-07-13 | SCALE-4.5 | perf visibility | error-log grep only | counters + Admin Hub panel | `new_clinic_perf_daily` histogram counters (one NoLog PK upsert per request in the perf shutdown hook, fail-open); p95 estimated from buckets, frozen by the worker for completed days, purged >90 d. `admin.perf.summary` + `PerfPanelCard` (System tab, Yesterday/Today) list slowest-by-p95 + error actions. Live-proven: drill traffic (incl. the 4.2 timeouts as errors) ranked correctly in the browser panel; worker `perf_rollup` runs each pass. Asset `20260713perfpanel`. |
| 2026-07-12 | SCALE-1.3 | repairOrphanVisits | (every poll) | ≤1/5min | R2: the orphan-repair `UPDATE…JOIN`s ran on EVERY poll from EVERY tab (static cache only dedupes within one request). New `new_clinic_maintenance_lock` (owner-token claim — `affected_rows` is unreliable here because sqlStatement logs each query) throttles the writes to at most once per facility+date per 5 min across all tabs/servers. Live-verified: claim first-wins/second-loses/after-expiry-wins, and the board created the throttle lock. |

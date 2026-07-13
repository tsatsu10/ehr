# New Clinic — Scale-Out Runbook (1 → N servers)

**Version:** 1.1.0 (SCALE-5.2 consolidated + SCALE-6.2 connection-ceiling step)
**Date:** 2026-07-13
**Audience:** the ops person taking a single-box New Clinic install to multiple web servers,
or an operator responding to a live incident on any box. Each stage below says what breaks at
that stage, what the module already handles for you, and what YOU must flip — in order.

---

## 0. Where you are right now (Stage 0 — single box, e.g. this XAMPP dev install)

If you have not touched anything yet: **you need to do nothing to stay correct.** Everything in
this runbook is either already live (health endpoint, rate limits, request budgets, panic
levers, perf visibility) or is a Stage-1-and-later step that only matters once you add a second
web server. What the module already gives you on a single box:

- Bounded, cached, rate-limited, budgeted queries (SCALE-1–4) — see the hardening plan for the
  full list; this runbook only covers what changes with more servers.
- Hardened AJAX input boundary (SCALE-4.1): search terms length-capped, dates strictly
  validated, request bodies size-budgeted — nothing here needs ops action, it's dev-owned.
- A health endpoint, incident levers, and a perf panel (§5) you should bookmark now, before you
  need them under pressure.

**Two things you should do even on Stage 0**, because they cost nothing and pay off immediately:

| # | Step | Where | Why |
|---|---|---|---|
| 1 | Enable **opcache** | `php.ini` | measured: single biggest latency lever on this dev box (~1000 ms → ~155 ms per request) |
| 2 | Enable **APCu** | `php.ini` | `CacheService` auto-uses it (`cache_driver=auto`); without it the DB cache driver still works, just with smaller savings |

---

## 1. Stage 1 — Going from 1 server to 2

This is the stage with real work. Do these **in order** — each one is a prerequisite for the
next actually being safe.

### 1.1 Move PHP sessions off local disk

The module holds no session-file assumptions of its own beyond stock OpenEMR: read-only ajax
actions already release the session lock early (SCALE-1.1), and rate limiting no longer lives in
`$_SESSION` (SCALE-3.1) — the module is *ready* for a shared session backend, but moving off
local files is an **OpenEMR/php.ini-level change, not a module one**:

```ini
session.save_handler = redis
session.save_path = "tcp://<redis-host>:6379"
```

(or a DB session handler — either works). **Until you do this, your load balancer MUST use
sticky sessions**, or users will randomly lose their session mid-click as requests land on
different servers.

**Verify:** log in, force your LB to route your next 3 requests to a different server than your
login request, confirm you're still authenticated (no re-login prompt).

### 1.2 Point export storage at shared or per-node-aware storage

Today only the `local` driver exists — files land under `sites/<site>/documents/nc_report_exports/`
and `nc_export_jobs/` on whichever node built them. Two options:

- **Simplest:** put `sites/<site>/documents/` on shared storage (NFS/SMB/EFS) between all nodes —
  this is a **stock OpenEMR requirement anyway** (uploaded patient documents), not a module-
  specific one, so you're likely doing this already.
- **Later, if needed:** build an object-storage driver behind `ExportStorageService` (the seam
  already exists — `export_storage_driver` config key, `assertKnownDriver()` fails loud on
  anything unrecognized rather than silently writing PHI to the wrong place).

**Verify:** run a cohort export or report export from Node A, download it via a request that
lands on Node B — the download must succeed.

### 1.3 Schedule the background worker on exactly ONE node

```
php scripts/run-jobs.php --site=default --max-seconds=55
```

Every 1 minute, on **one** node only (cron / Windows Task Scheduler). Claims are atomic
(owner-token, not `affected_rows`), so accidentally running it on two nodes is *safe* — just
wasteful, not harmful. Once it's running reliably, set `enable_inline_export_fallback = 0` so a
status-poll request never does the CSV-building work itself.

**Verify:** watch `public/health.php`'s `worker_last_seen` field — it should update every ~1 min
and never go stale by more than the 10-minute heartbeat TTL (see §5).

### 1.4 Run backups on exactly ONE node

Backup archives, the per-file mirror, and the encryption-key export are **node-pinned by
design** (`AdminBackupService` — full local-write audit in §2). Pick one node, run the backup
schedule there, and back up that node's key directory (`logs_and_misc/methods`) out-of-band —
losing that node without a separate key backup makes every other backup undecryptable.

**Verify:** run the restore drill (§6) against a backup taken from the designated backup node.

### 1.5 Point your LB health check at the module's health endpoint

```
GET .../oe-module-new-clinic/public/health.php?site=<site>
```

200 = healthy, 503 = pull the node — full response shape, rate limit, and design rationale are
in §5 (read that now if you haven't; this step just says "point your LB at it").

**Verify:** stop MySQL on one node → its health check flips to 503 within one poll interval →
your LB stops routing to it. Restart MySQL → flips back to 200.

### 1.6 Confirm the cache layer's staleness bound is acceptable

`CacheService` picks `apcu` (per-server memory, near-free) when the extension is loaded, else
falls back to the shared `new_clinic_cache` DB table (§3). With APCu on 2+ servers, cached data
is **per-server** — every module TTL is ≤ 30 s (BP-5: config 30 s, queue counts 5 s), so
cross-server staleness after a write is bounded by that TTL, not unbounded. Config **writes**
invalidate the writing server immediately; other servers converge within the TTL. If this bound
is too loose for your clinic's tolerance, set `cache_driver = db` to force the shared table
everywhere (slower, but zero cross-server staleness beyond normal DB read consistency).

**Verify:** change a setting in Admin Hub on Node A, read it back from Node B within 30 s —
confirm it eventually shows the new value (immediately if `cache_driver=db`, within the TTL
if `apcu`).

### 1.7 Run the load test before and after

`scripts/load-test.php` fires a burst of requests at one read action and reports p50/p95/p99 +
error count — use it to get a real before/after number for your hardware, not just this dev
box's measurements:

```
php scripts/load-test.php \
  --url="https://<your-lb>/interface/modules/custom_modules/oe-module-new-clinic/public/ajax.php" \
  --action=queue.counts \
  --cookie="<session cookie from a logged-in browser>" \
  --requests=50 --concurrency=10 --run
```

To get the `--cookie` value: log into the OpenEMR app in a browser, open DevTools →
Application (Chrome) / Storage (Firefox) → Cookies for your site, and copy the entire `Cookie`
request header value (not just one cookie) from a request in the Network tab — the module's read
actions need a valid session but not a CSRF token (CSRF only applies to POST mutations, which
this tool never sends).

Defaults to `--dry-run` (prints the plan, sends nothing) — pass `--run` to actually fire.
Point it only at a test/staging box, never production. Paste the result row into
`Documentation/NewClinic/worksheets/SCALABILITY_BASELINE.md`.

### 1.8 Size the DB connection ceiling (the classic PHP+MySQL wall)

This is the bottleneck the whole hardening plan reduces the *pressure* on but never removes:
**every Apache worker/thread holds its own MySQL connection**, so if your web tier can run more
concurrent PHP processes than MySQL will accept, you hit `max_connections` and MySQL starts
**refusing new connections** — which means new requests, *including logins*, fail while existing
ones hang. It's an ugly, confusing outage, and it's avoidable with arithmetic.

The rule: **max concurrent PHP workers + headroom ≤ MySQL `max_connections`.**

- **Windows / XAMPP (`mod_php`, WinNT MPM):** the ceiling is `ThreadsPerChild`
  (`apache/conf/extra/httpd-mpm.conf`, default **150**). MySQL/MariaDB default `max_connections`
  is **151**. So out of the box they nearly coincide — 150 busy threads = 150 connections ≈ the
  limit, with almost no headroom for the job worker, backups, or an admin session. **On a single
  on-prem box** (the default deployment) real concurrency is far below 150 (a clinic has ~6–12
  active sessions), so this is not a live risk — but if you ever raise `ThreadsPerChild`, raise
  `max_connections` to match, plus ~20 headroom.
- **Linux / php-fpm (the scale-out target):** the ceiling is `pm.max_children`. Size it so that
  `pm.max_children` (per web node × node count) + the worker + backups + headroom ≤
  `max_connections`. Setting `pm.max_children` higher than the DB will accept just moves the
  failure from "slow" to "refused."
- **When workers must legitimately exceed connections** (many nodes, spiky load): put **ProxySQL**
  in front — it multiplexes many app connections onto a small pool of real MySQL connections, so
  `pm.max_children` can exceed `max_connections` safely. Standard answer at higher concurrency;
  not needed for a single clinic.

**Watch it, don't guess it:** `health.php` now returns `db_conns` (live `Threads_connected`) and
`db_conns_limit` (`max_connections`). Point the alerting monitor (§5) at the ratio — alert when
`db_conns` exceeds, say, 80% of `db_conns_limit`, so you widen the limit *before* it refuses.

**Measure the real number** on staging with the `load-test.php` ramp (§1.7): increase
`--concurrency` until `db_conns` (via `health.php`) approaches the limit, and record where p95
degrades. Do this on a **test/staging box, never the live clinic** — the point is to find the
ceiling, which means briefly hitting it.

**Stage 1 is done when:** all 8 steps above are verified, `health.php` returns 200 from every
node, `db_conns` sits comfortably below `db_conns_limit`, and a `load-test.php` run against the
LB shows p95 latency you're comfortable with.

---

## 2. Local-state audit (why Stage 1's steps are exactly these and no more)

Full sweep of every module write to local disk (`file_put_contents|fopen(|mkdir(|tempnam` over
`src/`), 2026-07-13. This is *why* §1.2 and §1.4 are the only storage-locality concerns — every
other write site is either shared-storage-safe or memory-only:

| Call site | What it writes | Multi-server verdict |
|---|---|---|
| `ExportStorageService` (put/purge) | export CSVs under `nc_report_exports/`, `nc_export_jobs/` | **Safe seam** (§1.2) — all export I/O goes through this one class; files are transient (24 h purge) |
| `AdminBackupService` (archive write, mirror dir, key zip, tmp cnf) | encrypted DB + site-file backups, per-file mirror, key-export zip; temp files in the OS tmp dir | **Node-pinned by design** (§1.4); temp usage is tmp-only (SEC-6-compliant) |
| `AuditLogService`, `PatientCohortSearchService`, `ReportHub*`, `Reports*`, `LabOpsPanelImportService`, `PharmOpsFormularyImportService` | `fopen('php://temp' / 'php://memory')` CSV builders | **Safe** — in-memory streams, never touch disk |

Static in-process state sweep (`static $` over `src/Services/`): all occurrences are per-process
memos that are correct when duplicated across processes/servers — `$schemaEnsured` flags
(idempotent DDL ensure), `CacheService::$resolvedDriver` (re-resolved per process, TTL-bounded
data), `VisitScopeService::$repairedKeys` (request-local fast path; the DB maintenance lock from
SCALE-1.3 is the authoritative cross-server throttle), require-once memos. **No cross-request
correctness depends on in-process state.**

## 3. Cache layer detail (SCALE-3.3)

- Drivers: `apcu` (per-server memory) → `db` (`new_clinic_cache`, shared). Config key
  `cache_driver = auto|apcu|db`, default `auto`.
- A Redis driver can be added inside `CacheService::driver()` + the op methods without touching
  any consumer (BP-12: the seam exists, the infra doesn't until measured). Add it when a
  measurement shows the DB cache table hot.

## 4. Stage 2 — Read/write DB split

> **This section is reference material for a future stage, not a checklist to execute now.**
> Nothing below is actionable until a read replica actually exists — do not provision one on
> the strength of this section alone; it exists so that when you DO add a replica, the routing
> decision is already made.

`AjaxActionPolicy` already classifies every action so this stage requires zero module code
changes when you get here, only ADODB config:

- `READONLY_ACTIONS` (the SCALE-1.1 allowlist) is exactly the set that could be served by a
  **read replica**. Guardrail tests assert it contains no mutating actions and that every entry
  is a real, dispatchable action (a typo can't silently mark the wrong thing, or silently miss
  routing the right thing).
- Actions that must **NEVER** go to a replica (read-your-own-write flows):
  - `cashier.pay` → `cashier.queue`/`cashier.select` in the same user flow (payment status must
    reflect the write just made)
  - every visit state transition (`triage.*`, `doctor.take/complete`, `lab.take`,
    `pharmacy.take`, `visit.start/cancel`) followed by the same desk's queue re-fetch
  - `admin.config.save` → `admin.config` (admin expects the saved value echoed back)
- **Replication-lag hazard for queues:** a just-moved visit can bounce back for one poll if
  queue reads hit a lagging replica. Decide when a replica actually exists: route queue/board
  reads to the primary (recommended — cheap after SCALE-1.2/1.8/3.3) OR accept 1-poll staleness
  and document it for the desks.
- Delta polling (SCALE-1.8) makes this *less* urgent regardless: unchanged polls are already
  nearly free on the primary, so the pressure to move reads off it is lower than it would be
  without SCALE-1.8.

## 5. Incident response — levers, health, budgets, and visibility

Bookmark this section now, not during an incident.

**Health endpoint** (`public/health.php?site=<site>`): no auth, no session, no OpenEMR
bootstrap — raw mysqli against the site's sqlconf, so it answers honestly even when the app
tier is sick. Returns `200 {ok, db_ms, cache_ms, worker_last_seen, db_conns, db_conns_limit}`
when healthy, `503 {ok: false}` when the DB is unreachable, `429 {ok: false, error:
"rate_limited"}` past the per-IP budget (30/min). `worker_last_seen` goes `null` within ~10 min
of the job worker dying (heartbeat TTL); `db_conns`/`db_conns_limit` (SCALE-6.2) are the live
connection headroom — see §1.8. Point the LB / uptime monitor at 200-vs-not; 503 = pull the node.

**Incident levers** (SCALE-4.3) — two flags an operator flips **in the DB**
(`new_clinic_config`, facility 0), no deploy, effective within one config-cache TTL (≤30 s) or
next page load:

- `panic_readonly_mode = 1` — every mutating ajax request gets a clean 503 "maintenance mode —
  changes are paused" envelope; reads keep working (GET requests + the vetted read-only
  allowlist; a few POST-shaped reads outside the allowlist also pause — acceptable during an
  incident, never a lost write). Flip back to `0` to restore.
- `panic_poll_multiplier = N` (1–10) — multiplies the poll interval every island receives at
  page load. `panic_poll_multiplier=4` turns the fleet's 30 s polls into 2-minute polls. Flip
  back to `1` (or delete the row) to restore.

**Request budgets** (SCALE-4.2), nothing to configure — this is why a slow query doesn't take
your node down: budgeted read actions carry a 10 s DB statement kill (`max_statement_time` on
MariaDB, `max_execution_time` on MySQL — auto-selected per connection) and a 15 s PHP execution
ceiling; either death returns a clean 503 `timeout` envelope and logs `NC_PERF … status=503`.
Mutations are never budget-killed (killing a write mid-flight is worse than a slow write). **A
node whose error log fills with those lines has a slow-query problem, not a crash** — check the
perf panel below before restarting anything.

**Perf visibility** (SCALE-4.5) — this is your first stop during any "something feels slow"
report, before touching config or restarting anything: every ajax request lands in
`new_clinic_perf_daily` (per day+action: calls, errors, latency histogram; 90-day retention,
rollup/purge by the job worker). Read it in **Admin Hub → System → Performance**
(yesterday/today, slowest actions by p95, error counts). SQL access works too:

```sql
SELECT * FROM new_clinic_perf_daily WHERE day = CURDATE() ORDER BY errors DESC;
```

**Rate limiting** (SCALE-3.1/3.2), also nothing to flip at scale-out — it's DB-backed
(`new_clinic_rate_limit`), keyed user+action, so N servers automatically share one budget. Knobs
if you need to retune: `rate_limit_patients_search` (30/min), `rate_limit_dup_check` (60/min),
`rate_limit_poll_per_minute` (90/min).

**A suggested incident sequence**, tying the above together: perf panel shows what's slow/erroring
→ if it's a runaway read, the SCALE-4.2 budget already killed it at 10–15 s, so you're looking at
a symptom, not an ongoing outage → if writes are the risk (e.g., mid-migration), flip
`panic_readonly_mode=1` → if load itself is the problem, flip `panic_poll_multiplier` up → once
stable, flip both back and confirm via the perf panel that error/latency numbers recovered.

## 6. Backup, restore & migration safety (SCALE-4.6)

**Schema rule:** ALL module DDL goes through `sql/install.sql` `#IfNotTable` / `#IfMissingColumn`
guards — never manual DDL in prod. Every new FK/WHERE column gets an index in the same change
(BP-9).

**Module tables by loss impact** (37 custom tables — count verified against `install.sql`'s
37 `#IfNotTable` guards and cross-checked live via `SHOW TABLES`, 2026-07-13; a prior version of
this table undercounted at "33" and was missing 4 real tables — fixed here):

| Impact | Tables | Why |
|---|---|---|
| **Catastrophic** (clinical/financial record) | `new_visit`, `new_visit_state_log`, `new_receipt`, `new_receipt_counter`, `new_cashier_payment_request`, `nc_encounter_note`, `new_patient_meta`, `new_lab_order_meta`, `new_drug_meta` | visits, audit trail, money, clinical notes — restore is mandatory |
| **Severe** (operational config / security state, rebuildable only by hand) | `new_clinic_config`, `new_visit_type`, `new_fee_schedule`, `new_condition_map`, `new_doctor_availability`, `new_completion_field_weight`, `new_config_log`, `new_clinic_recall_meta`, `new_password_reset_required` | the clinic's setup; hours of manual re-entry. `new_password_reset_required` (SEC-5) is the forced-password-change flag for staff on temporary passwords — losing it silently drops that security requirement rather than just costing re-entry time |
| **Moderate** (history/derived, annoying to lose) | `new_patient_completion`, `new_visit_queue_counter`, `new_visit_notify_log`, `new_reconciliation_run`, `queue_bridge_exception_snapshot`, `report_hub_export_run`, `new_clinic_export_job`, `clinical_doc_form_open`, `admin_hub_backup_run`, `admin_hub_setup_progress`, `new_cohort_saved_filter`, `new_clinic_flowboard_lane_prefs`, `new_clinic_flowboard_lane_map`, `new_office_note_meta`, `new_referral_meta`, `new_outreach_campaign` | audit/history/prefs; system keeps working without them. `new_referral_meta` tracks a referral's status/destination on top of the underlying core `transactions` record, which is untouched by this table's loss; `new_office_note_meta` is pin-state only (the notes themselves are core `pnotes`); `new_outreach_campaign` is SMS/comms campaign history |
| **Disposable** (infrastructure, self-rebuilding) | `new_clinic_maintenance_lock`, `new_clinic_rate_limit`, `new_clinic_cache`, `new_clinic_perf_daily` | locks/counters/cache/perf stats — exclude from restores freely |

**Restore drill** (do this quarterly, and before any risky migration):

1. Restore the encrypted dump to a **scratch** DB (never over prod): Admin Hub → Backups →
   verify decrypts; or decrypt + `mysql scratch < dump.sql`.
2. Point a scratch site config at it and run `php .../scripts/verify-module.php --bootstrap` —
   must PASS.
3. Load the visit board and one desk against the scratch DB; confirm today's-ish visits render.
4. Confirm the backup **excludes** the transient export dirs and includes the encryption-key
   custody step (see the SEC-6 runbook — a backup you can't decrypt is not a backup).

A backup you've never test-restored is a hope, not a guarantee.

## 7. Beyond N servers — what's next, and what's explicitly NOT ready

- **Server-Sent Events** (SCALE-5.1, design-only): could cut poll *frequency* the same way
  SCALE-1.8 cut poll *payload size*. **Do not enable on a multi-facility Windows/XAMPP/`mod_php`
  deployment** — see `Documentation/NewClinic/NEW_CLINIC_SSE_DESIGN.md` §3 for the worker-count
  math (this MPM holds one thread per open connection for its lifetime). Gate: `enable_sse`,
  default OFF, not built yet — read the design doc's §6 go/no-go before building it.
- **Frontend client-cache layer** (SCALE-5.3, optional): only worth building if Stage-1
  measurements show duplicate concurrent fetches still matter after everything above. Not
  started; not needed for any deployment size seen so far.
- **Linux + php-fpm + an event-driven Apache/nginx MPM**: the natural next infrastructure step
  if you outgrow Windows/XAMPP — see the SSE design doc §3 for why this specifically unlocks
  SSE at multi-facility scale (a long-idle connection costs a socket, not a worker slot).

---

## History

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-07-13 | Initial runbook: sessions, local-state audit, cache, worker, replica-readiness (SCALE-3.4 + SCALE-3.5) |
| 0.1.1 | 2026-07-13 | §7 (old numbering): request budgets (SCALE-4.2) + perf visibility panel (SCALE-4.5) |
| 1.0.0 | 2026-07-13 | SCALE-5.2 consolidation: restructured into an explicit Stage 0 → Stage 1 (1→2 servers, 7 ordered steps with a verification per step) → Stage 2 (read replica) → incident-response section → backup/restore → "beyond N servers" pointer to SCALE-5.1's SSE design doc and SCALE-5.3. Added the `load-test.php` step (was documented as a tool but never wired into the runbook's own checklist) and a suggested incident-response sequence tying the health/levers/budgets/perf-panel pieces together. No technical content changed from 0.1.1 — this is the "merge all fragments" pass the plan called for. **Cold-read test (fresh subagent, no prior context):** correctly identified step 3 and the incident sequence unassisted; flagged 4 minor polish items (health-endpoint description duplicated between §1.5/§5, Stage 2 not visually distinguished as non-actionable, `load-test.php`'s cookie step unexplained inline, a dangling "old numbering" note) — all four fixed in this same version. Rated 4/5 followability before the fixes; the remaining gap is inherent ops-domain knowledge (session backends, LB config) this doc reasonably assumes rather than teaches. |
| 1.1.0 | 2026-07-13 | SCALE-6.2: new Stage-1 step §1.8 (DB connection ceiling — `ThreadsPerChild`/`pm.max_children` vs `max_connections`, ProxySQL option, the WinNT 150-vs-151 near-coincidence); `health.php` now returns `db_conns`/`db_conns_limit` and §5 + the "done when" criteria reference them. Stage 1 is now 8 steps. |
| 1.0.1 | 2026-07-13 | Audit fixes: §6's module-table-loss-impact table undercounted at "33" and was missing 4 real tables entirely (`new_office_note_meta`, `new_referral_meta`, `new_outreach_campaign`, `new_password_reset_required`) — found by cross-checking `install.sql`'s 37 `#IfNotTable` guards and a live `SHOW TABLES` against the table; corrected to 37, all four classified (three Moderate, `new_password_reset_required` Severe since losing it silently drops a forced-password-change security requirement rather than just costing re-entry time). §1.5's promise that the health endpoint's "full response shape... are in §5" was false — §5 never actually stated the JSON shape; added it (`{ok, db_ms, cache_ms, worker_last_seen}` / `503 {ok:false}` / `429 {ok:false, error:"rate_limited"}`, matching `public/health.php`'s docblock exactly). |

# New Clinic — Scale-Out Runbook (1 → N servers)

**Version:** 0.1.0 (SCALE-3.4 + SCALE-3.5; SCALE-5.2 will merge the 4.3/4.6 sections and finalize)
**Date:** 2026-07-13
**Audience:** the ops person taking a single-box New Clinic install to multiple web servers. Each section says what breaks with 2+ servers, what the module already handles, and what YOU must flip.

---

## 0. TL;DR checklist (1 → 2 servers)

| # | Step | Where | Status |
|---|---|---|---|
| 1 | Enable **opcache** on every web server | `php.ini` | measured: single biggest latency lever (~1000 ms → ~155 ms per request on the dev box) |
| 2 | Enable **APCu** on every web server | `php.ini` | `CacheService` auto-uses it (`cache_driver=auto`); without it the DB cache driver still works, just with fewer savings |
| 3 | Move **PHP sessions** to Redis/DB | `php.ini` (`session.save_handler`) | REQUIRED for 2+ servers unless the LB uses sticky sessions — see §1 |
| 4 | Schedule the **job worker on exactly ONE node** | cron / Task Scheduler | `php scripts/run-jobs.php --site=default --max-seconds=55` every minute; then set `enable_inline_export_fallback=0` |
| 5 | Point export storage at a **shared location** | `export_storage_driver` | today only `local` exists; on 2+ servers use a shared volume for `sites/<site>/documents/`, or build the objstore driver (the seam is `ExportStorageService`) |
| 6 | Run **backups on exactly ONE node** | module backup schedule | backup outputs + encryption keys are node-local by design — see §2 |
| 7 | Keep **`sites/<site>/documents/` shared** (NFS/SMB/EFS) between nodes | infra | stock OpenEMR requirement (uploaded documents), not just a module one |
| 8 | LB health checks | `public/health.php` | live (SCALE-4.4): `GET .../oe-module-new-clinic/public/health.php?site=<site>` → 200 `{ok,db_ms,cache_ms,worker_last_seen}`, 503 on DB failure; per-IP limited 30/min |

---

## 1. PHP sessions

The module holds no session-file assumptions of its own beyond what stock OpenEMR does:

- Read-only ajax actions release the session lock early (SCALE-1.1), and rate limiting
  no longer lives in `$_SESSION` (SCALE-3.1) — so the module is *ready* for a shared
  session backend.
- Moving sessions off local files is an **OpenEMR-level php.ini concern**, no module
  code change: `session.save_handler = redis` + `session.save_path = "tcp://…"`
  (phpredis), or a DB session handler. Until then, the load balancer MUST use sticky
  sessions.
- Bonus of a Redis session handler: the remaining concurrency cost measured in the
  baseline (core bootstrap holding the file lock ~150 ms/request) drops further.

## 2. Local-state audit (grep: `file_put_contents|fopen(|mkdir(|tempnam` over module `src/`)

Full sweep 2026-07-13. Verdicts:

| Call site | What it writes | Multi-server verdict |
|---|---|---|
| `ExportStorageService` (put/purge) | export CSVs under `sites/<site>/documents/nc_report_exports/`, `nc_export_jobs/` | **SAFE seam** (SCALE-2.3): all export I/O goes through this one class; share the documents volume, or add an objstore driver behind `export_storage_driver`. Files are transient (24 h purge) |
| `AdminBackupService` (archive write, mirror dir, key zip, tmp cnf) | encrypted DB + site-file backups, per-file mirror, key-export zip; temp files in the OS tmp dir | **NODE-PINNED by design**: run the backup schedule on exactly one node; back up that node's key dir (`logs_and_misc/methods`) out-of-band. Temp usage is tmp-only (R6-compliant) |
| `AuditLogService`, `PatientCohortSearchService`, `ReportHub*`, `Reports*`, `LabOpsPanelImportService`, `PharmOpsFormularyImportService` | `fopen('php://temp' / 'php://memory')` CSV builders | **SAFE** — in-memory streams, never touch disk |

Static in-process state sweep (`static $` over `src/Services/`): all occurrences are
per-process memos that are correct when duplicated across processes/servers —
`$schemaEnsured` flags (idempotent DDL ensure), `CacheService::$resolvedDriver`
(re-resolved per process, TTL-bounded data), `VisitScopeService::$repairedKeys`
(request-local fast path; the DB maintenance lock from SCALE-1.3 is the authoritative
cross-server throttle), require-once memos. **No cross-request correctness depends on
in-process state.**

## 3. Cache layer (SCALE-3.3)

- `CacheService` drivers: `apcu` (per-server memory) → `db` (`new_clinic_cache`, shared).
  Config key `cache_driver` = `auto|apcu|db`, default auto.
- With APCu on multiple servers, cached data is **per server**; every TTL in the module
  is ≤ 30 s (BP-5), so cross-server staleness is bounded and acceptable (config 30 s,
  queue counts 5 s). Config **writes** invalidate the writing server immediately; other
  servers converge within the TTL.
- A Redis driver can be added inside `CacheService::driver()` + the op methods without
  touching any consumer (BP-12). Add it when a measurement shows the DB cache table hot.

## 4. Background worker (SCALE-2.1/2.2)

- `scripts/run-jobs.php` drains report exports + generic export jobs, purges expired
  export files, dead rate-limit windows, and expired cache rows.
- Run it on **one node** per site (`--site=NAME`). Claims are atomic (owner-token), so
  accidentally running two workers is safe — just unnecessary.
- Once scheduled, set `enable_inline_export_fallback = 0` so status polls never do work.

## 5. Read/write DB split readiness (SCALE-3.5 — documentation only, do NOT build yet)

`AjaxActionPolicy` already classifies every action:

- `READONLY_ACTIONS` (the SCALE-1.1 allowlist) is exactly the set that could later be
  served by a **read replica** via ADODB config. Guardrail tests assert the allowlist
  contains no mutating actions and (since SCALE-3.5) that every entry is a real,
  dispatchable action — a typo can't silently mark the wrong thing.
- Actions that must **NEVER** go to a replica (read-your-own-write flows):
  - `cashier.pay` → `cashier.queue`/`cashier.select` in the same user flow (payment
    status must reflect the write just made — idempotency reads `new_cashier_payment_request`)
  - every visit state transition (`triage.*`, `doctor.take/complete`, `lab.take`,
    `pharmacy.take`, `visit.start/cancel`) followed by the same desk's queue re-fetch
  - `admin.config.save` → `admin.config` (admin expects the saved value echoed back)
- **Replication-lag hazard for queues:** a just-moved visit can bounce back for one
  poll if queue reads hit a lagging replica. Mitigation options, decided when a replica
  actually exists: route queue/board reads to the primary (recommended — they are cheap
  after SCALE-1.2/1.8/3.3) OR accept 1-poll staleness and document it for the desks.
- Delta polling (SCALE-1.8) makes replica routing *less* urgent: unchanged polls are
  already nearly free on the primary.

## 6. Rate limiting (SCALE-3.1/3.2)

DB-backed (`new_clinic_rate_limit`), keyed user+action — N servers share one budget
automatically. Knobs: `rate_limit_patients_search` (30/min), `rate_limit_dup_check`
(60/min), `rate_limit_poll_per_minute` (90/min). Nothing to flip at scale-out.

## 7. Incident levers (SCALE-4.3) & health endpoint (SCALE-4.4)

Two flags an operator flips **in the DB** (`new_clinic_config`, facility 0) during an
incident — no deploy, effective within one config-cache TTL (≤30 s) / next page load:

- `panic_readonly_mode = 1` — every mutating ajax request gets a clean 503
  "maintenance mode — changes are paused" envelope; reads keep working (GET requests
  + the vetted read-only allowlist; a few POST-shaped reads outside the allowlist
  also pause — acceptable during an incident, never a lost write).
- `panic_poll_multiplier = N` (1–10) — multiplies the poll interval every island
  receives at page load. `panic_poll_multiplier=4` turns the fleet's 30 s polls into
  2-minute polls. Flip back to 1 (or delete the row) to restore.

Health endpoint (`public/health.php?site=<site>`): no auth, no session, no OpenEMR
bootstrap — raw mysqli against the site's sqlconf. `worker_last_seen` goes `null`
within ~10 min of the job worker dying (heartbeat TTL). Point the LB / uptime
monitor at it; 503 = pull the node. Per-IP limited to 30/min.

Still pending for SCALE-5.2 consolidation: backup/restore drill + table loss-impact
list (SCALE-4.6).

---

## History

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-07-13 | Initial runbook: sessions, local-state audit, cache, worker, replica-readiness (SCALE-3.4 + SCALE-3.5) |

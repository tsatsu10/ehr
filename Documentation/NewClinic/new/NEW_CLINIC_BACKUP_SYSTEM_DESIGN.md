# New Clinic — Backup System Design

**Version:** v0.8.0 · **Date:** 2026-07-18 · **Status:** Engine + job-worker/cron scheduling (heartbeat alone is NOT enough for desk-only clinics — BACKUP-H1) + verify (kind-filtered, full-stream — BACKUP-H2/M1) + honest self-reported labeling (BACKUP-H3) + facility-0 backup scope (BACKUP-M4/M4b) + concurrency lock (BACKUP-M3) + cloud sync-folder off-site + recovery-key custody (bundles the database key material too — BACKUP-C1) + separate incremental site-files backup (§3b) + a proven decrypt/restore procedure (BACKUP-C2) + configurable capacity cap with a proven large-DB round-trip (BACKUP-CAP) + retry backoff (BACKUP-H1b) + last-known-good mirror guarantee (BACKUP-M7) — built and live-smoked (GAP-C C6 follow-up; backup-system audit, wave 3)

Governs the module's **in-app backup engine** and how it tracks real backups. Subordinate to
`NEW_CLINIC_SEC6_DATA_AT_REST_RUNBOOK.md` §3 (the security policy) — where they disagree, SEC6 wins.

---

## 1. Why this exists

Before this: the Admin Hub "Run now" only **logged** a run to `admin_hub_backup_run` and pointed the
admin at stock `interface/main/backup.php`. Stock backup builds a tarball in the temp dir, streams it
to the browser, and **`unlink`s it** — nothing persists server-side, so there was nothing real to
track, and the history's `file_path` column was never populated. The panel implied "your data is
backed up" while doing none of it.

This design adds a real, encrypted, tracked backup the clinic can actually rely on for the
**local/removable-drive** tier, while the **off-site** tier stays the SEC6 VPS read-replica.

## 2. Non-negotiable security rules (from SEC6 §3)

1. **Encrypt before it persists.** The archive is encrypted (OpenEMR `CryptoGen`, drive key) *before*
   it is written to the target directory. A **plaintext** dump exists only transiently in the temp
   dir and is deleted (best-effort overwrite) the moment encryption succeeds — never on removable
   media or a sync folder.
2. **Credentials never on the command line.** `mysqldump` reads DB credentials from a
   `--defaults-extra-file` written 0600 to the temp dir and deleted immediately after — never passed
   as `-p<password>` (which leaks in the process list).
3. **Key custody is the clinic's, per MSA §7.2.** The drive key that decrypts these archives is the
   same escrowed key SEC6 documents. Losing it = unrecoverable. Restore therefore stays a deliberate,
   documented manual operation (§6), not a one-click button.
4. **Super-admin only.** Gated on `AclMain::aclCheckCore('admin', 'super')` (the existing
   `canRunBackup()` check) **and** a feature flag `enable_native_backup` (default OFF).

## 3. What gets backed up — two separate entities (by design)

The database and the uploaded files behave completely differently, so they are backed up as **two
independent backups**, never one bundle:

- **The database (records):** small, changes constantly (every patient, visit, payment). Backed up
  **in full, frequently** → one encrypted `nc-backup-<site>-<UTC timestamp>.sql.gz.enc` archive per run.
- **The site files (scans, PDFs, letters):** large, but effectively **append-only** — a document,
  once uploaded, never changes; the clinic only ever *adds* more. Backed up **incrementally** into a
  mirror folder, so each run only copies the *new* files instead of re-copying gigabytes every time.

**Why separate, not combined** (the design decision behind this split):

- Different cadence: re-copying every scan on the database's schedule is wasteful; backing up the
  fast-changing records on the files' slower schedule loses data. Separating lets each run at its
  right pace.
- Different size behaviour: the DB archive fits the in-app in-memory encryption budget
  (`MAX_ENCRYPT_BYTES`, 100 MB compressed); the documents tree as a whole does not — but each
  *individual* document does, which is exactly why the files backup encrypts **per file** (§3b).
- Fault isolation: a failure or corruption in one never touches the other, and each is independently
  restorable.
- Different retention: DB snapshots are pruned (§8); file backups are **never auto-pruned** — a
  scanned ID or lab PDF is a permanent record, not a rolling snapshot.

### 3b. Site-files backup — how the incremental mirror works

Only runs when `backup_include_site_files` = 1 (default OFF). Walks `sites/<site>/documents` and, for
each file, writes an **individually-encrypted** copy to a mirror tree in the target:
`<target>/nc-files-<site>/<same relative path>.enc`.

- **Incremental:** if the mirror `.enc` already exists **and is newer than the source file**, it is
  skipped. So the first run copies everything; every run after copies only what changed since — fast
  and small. The mirror itself is the manifest (no separate index to corrupt).
- **Per-file encryption (SEC6 §3 preserved):** every file is encrypted with `CryptoGen` **before** it
  lands in the target, same as the DB archive. Because documents are individually small, each stays
  within the in-memory encryption budget; a rare oversized single file is **skipped and reported**,
  never silently dropped.
- **Hard exclusions** (walked but never copied): the module's own backup outputs
  (`nc_backups/`, `nc-files-*/`), the OpenEMR `temp/` scratch dir, and — critically — the encryption
  **key** dir `logs_and_misc/methods/`. The key must never be co-located with the data it decrypts
  (SEC6 / §5d); a files backup that swept the key into the same folder as the archives would hand
  whoever steals the drive both halves.
- **Never overwrites its last-known-good copy (BACKUP-M7).** Documents in this system are meant to be
  **append-only** — once uploaded, a document never changes (§3 above). So a source file that DOES
  change in place after its first mirror is inherently anomalous (accidental overwrite, corruption,
  tampering/ransomware), and mirroring purely by "source is newer than mirror" would happily
  re-encrypt that changed state OVER the one good encrypted copy on record, destroying it. The mirror
  now **never overwrites an existing `.enc` file**: when the source looks newer, the old encrypted
  copy is left completely untouched and the new state is written to a separate sibling file
  (`<name>.enc.<UTC timestamp>`) instead, and the run is flagged (`preserved: N`) in its message so
  this is never a silent event. This guarantees a single bad run can never destroy the last-known-good
  backup of a file — the simplest option that gives that guarantee, chosen over a full size/hash
  manifest (which the incremental design deliberately avoids — "the mirror itself is the manifest").
- **Tracking:** each files run records its own row in `admin_hub_backup_run` with `kind = 'files'`
  (the DB runs are `kind = 'db'`), a `file_path` of the mirror dir, `size_bytes` = bytes copied this
  run, and a human message (e.g. "Site files: 12 new/changed, 40 unchanged, 88.2 MB").

## 4. Where the data goes

- **Facility scope (BACKUP-M4 correction):** `mysqldump` backs up the WHOLE database — it was never
  meaningfully "per facility". Pre-M4 code resolved backup config/run rows against whatever facility
  a given request happened to land on (`VisitScopeService::resolveDeskFacilityId()`), which could
  differ request to request in a multi-facility clinic and has **no session at all** to resolve in a
  CLI worker — exactly the context BACKUP-H1's job-worker path runs in. Backup config
  (`backup_frequency_days`, `backup_target_dir`, `admin_hub_backup_retention_days`,
  `backup_include_site_files`, `enable_native_backup`) and every `admin_hub_backup_run` row now live
  at a fixed sentinel (`facility_id = 0`), independent of session/request state. Reads fall back to
  whatever facility a pre-M4 install's rows/config happened to be under, so existing history isn't
  orphaned by the change.
  **BACKUP-M4b correction:** M4 only fixed the READ side. The Admin Hub settings save path
  (`ClinicAdminService::saveSettings()`) still wrote these same 5 keys (plus the new
  `backup_max_encrypt_mb`, §5e) at whatever facility the save REQUEST resolved to, then — for a
  facility-scoped save — called `clearGlobalOverrides()` on every changed key, which **deletes** the
  facility-0 row. A single-facility pilot never noticed (the reader-facility fallback in
  `ClinicConfigService::get()` papers over it), but a multi-facility clinic saving Admin Hub settings
  from a non-first facility would silently blow away its own backup schedule/target/retention/cap —
  the worker has no per-facility context to fall back to. These 6 keys
  (`GLOBAL_ONLY_SETTINGS` in `ClinicAdminService`) are now forced to facility 0 on both read
  (change-detection) and write, and are never passed to `clearGlobalOverrides()`, regardless of which
  facility the save request resolved to.
- **Target directory:** `backup_target_dir` config (facility-0 sentinel — see above). Default: a module-owned
  `sites/<site>/documents/nc_backups/` created 0700. The admin **should** point this at a
  **removable/external drive** (e.g. `E:\clinic-backups` on Windows) so a machine failure doesn't take
  the backups with it — the UI says so.
- **Path safety:** the target must be an absolute path that already exists and is writable; no path
  traversal, no writing outside it. Validated before every run.
- **Encrypted only.** Only the `.enc` file lands in the target. Size + full path are recorded.
- **Cloud (off-site) without OAuth — the recommended off-site tier for self-hosted boxes.** Point
  `backup_target_dir` at a **cloud desktop-sync folder** (Google Drive for Desktop, OneDrive,
  Dropbox). The provider's own app handles login + upload; we never touch the user's cloud
  credentials or tokens, and the archive is already encrypted before it lands there.
  `BackupCloudTargetService` **detects** those folders on the box (so the admin can pick one) and
  **classifies** whether the chosen target actually syncs to a cloud — the System board then shows a
  green "syncs to OneDrive — off-site ✓" instead of the local-only warning. This deliberately avoids
  an in-app OAuth "Connect" flow (developer app registration per provider + a reachable HTTPS
  redirect — impractical on a LAN box, and unverifiable without real credentials). Live-detected the
  real OneDrive folders on the pilot box 2026-07-11.

## 5. Tracking (the "track actual backup" fix)

`admin_hub_backup_run` gains a `size_bytes` column. A real run records:
`status` (`ok`/`failed`), `started_at`/`finished_at`, `file_path` (the encrypted archive),
`size_bytes`, and a human `message` (e.g. "DB + documents, 42.1 MB, encrypted"). The System-health
"Recent backups" table shows path + size, so the history reflects what actually happened — not a
self-reported "complete" click.

**BACKUP-M1 — disk-full / partial writes must never record as `ok` (2026-07-18).** A short or failed
write (classically: the target disk fills up mid-write) previously went silent at three points:
`gzwrite()`'s return was never checked, the final archive `file_put_contents()` result was compared
only against `false` (not the actual byte count written), and `verifyBackup()` (§5b) only ever read
the first ~8 KB of the decompressed stream. All three are fixed: every `gzwrite()` call is checked
against the chunk length it was given; the archive write compares bytes-actually-written to
`strlen($ciphertext)` and deletes a partial file rather than leaving it behind; and verify now streams
the WHOLE archive (§5b). A truncated/short archive can no longer complete a run as `ok`, nor pass verify.

`initiateBackup()` now **performs** the backup synchronously (it was a stub) and returns the real
result. The old two-step "start → mark complete" is collapsed for native runs; the "Mark complete"
button remains only for the legacy stock-backup path — **and BACKUP-H3 made that path visibly
honest**: it is now labeled "Self-reported (no verified artifact)" in the health chip, the run's
own `message` says the same in plain English, and the setup checklist's "Backup tested" item does
**not** accept it — that item only completes off a native run that both produced a real file AND
passed `verifyBackup()` at least once (`admin_hub_backup_run.verified_at`, set the moment a verify
succeeds). A hand-ticked "complete" with nothing on disk to check can no longer look identical to a
real, checkable backup anywhere in the UI.

## 5b. Verify (a backup you can't restore is a hope, not a guarantee)

`verifyBackup(runId)` (super-admin; "Verify latest backup" button in the System-health board)
decrypts the archive and reads it back through gzip to confirm it's a real, COMPLETE SQL dump. It
answers "can this actually be decrypted and restored?" without a full restore. It does **not** replace
a periodic real restore drill, but catches the common silent failures (wrong key, corrupt/empty/truncated
archive). **Live-smoked 2026-07-11:** a real 96 MB `.enc` decrypted and read as a DB dump. **Live-smoked
again 2026-07-18 (BACKUP-CAP):** a real 197 MB `.enc` (from a 1.7 GB dev database) decrypted and
verified successfully. **BACKUP-H2 fix:** both the explicit-`run_id` and "latest" lookup branches now
filter `kind = 'db'` — without it, when the latest **ok** run for a facility happened to be a `files`
run, `file_path` pointed at the `nc-files-<site>/` **mirror directory**, and the verify falsely
reported "the backup file is missing from disk" even though the most recent DB archive was perfectly
fine.

**BACKUP-M1 fix (2026-07-18) — verify now streams the WHOLE archive, not just its head.** The original
verify only read the first ~8 KB of the decompressed stream — enough to see `CREATE TABLE`/`INSERT INTO`
markers, but gzip decompresses sequentially from the start, so a backup truncated mid-dump (disk full,
killed process) still verified GREEN as long as its readable head happened to be intact, which it
almost always is. Verify now streams the archive to EOF in constant-size chunks (still memory-safe —
a 1 MB buffer regardless of archive size) and checks the archive's own gzip trailer: RFC 1952's last 4
bytes of a gzip stream are the ORIGINAL uncompressed size, mod 2^32. Confirmed empirically during this
fix that a truncated gzip stream does **not** reliably raise a PHP error or fail `feof()` — cutting a
real archive off mid-stream just makes decompression stop early and report end-of-file immediately,
with no exception to catch. Comparing what was actually decompressed against the archive's own trailer
is the only reliable signal; a truncated file's trailer is just leftover compressed bytes and will not
match.

## 5c. Honesty: local target is not disaster-safe

When native backup is on and `backup_target_dir` is blank or a path inside the app, the board shows
a **warning** (`backup_target_local`): a backup on the same machine dies with the machine. The UI
tells the admin to point it at a removable/external drive and keeps the VPS replica as the real
off-site tier — the module never claims "you're protected" from a same-box copy alone.

## 5d. Recovery key custody (the last honest hole)

Encryption protects the cloud/USB copy — but it introduces a new single point of failure: the
**drive key** that decrypts every `.enc` archive. That key is a handful of small files in
`sites/<site>/documents/logs_and_misc/methods/` (`sevena`/`sevenb` on the pilot box) — and it lives
on the **same disk** as the database. So the events backups exist for (disk death, theft, ransomware,
rebuild-on-new-machine) also destroy the key, leaving the off-site backups mathematically
unrecoverable. **A backup you can't decrypt is worse than no backup — it's false confidence.**

- **`recoveryKeyStatus()`** (in the health payload, non-secret — no key material) reports whether the
  key files exist and whether the admin has ever exported a copy off-box (`backup_key_exported_at`).
  If keys exist but were never exported, `export_warning` is true and the System board shows a
  **loud warning**: "Save your recovery key off this machine."
- **`exportRecoveryKey()`** — super-admin only, audited (`admin_hub.recovery_key_exported`), POST+CSRF
  (`admin.backup.export_recovery_key`). Bundles the methods/ key files + a plain-language
  `READ_ME_FIRST.txt` (what it is, keep it SEPARATE from the backups, how to restore) into a ZIP the
  admin downloads. The secret never persists server-side (zip built in the temp dir, wiped, streamed
  as base64 to the browser); only the fact + timestamp of export are recorded.
- **BACKUP-C1 fix (2026-07-18) — the bundle was incomplete.** The methods/ files alone turned out NOT
  to be enough to decrypt anything on a replacement machine. `CryptoGen::collectDriveKey()` shows that
  for key version >= 5 (this install is "seven"), the drive-key file on disk is ITSELF encrypted, using
  the database key set of the identical label — and that database key set lives only in the `keys` SQL
  table, inside the very encrypted backup the bundle exists to open. `exportRecoveryKey()` now also
  bundles a `db-keys.json` containing the `keys`-table rows the drive files depend on
  (`requiredDatabaseKeyNames()`/`fetchDatabaseKeyRows()`), read via the same *NoLog query path CryptoGen
  itself uses so the raw key material is never written to the audit `log` table. A bundle exported
  before this date cannot decrypt a backup on a machine that doesn't already have the original
  database and should be treated as obsolete — export a fresh one.
- **The rule we surface in the UI:** store the key copy **separately from the backups** — never the
  same folder or same cloud account (whoever gets both gets all PHI). This is exactly SEC6's key
  escrow (MSA §7.2): one copy is enough to restore, both copies lost = unrecoverable.

## 5e. Capacity — the in-memory encryption cap (BACKUP-CAP)

The DB archive is encrypted **in memory**, not streamed (§3's "the DB archive fits the in-app
in-memory encryption budget"). That budget is a real ceiling, not a formality: `CryptoGen::coreEncrypt()`
holds the compressed dump, its binary AES ciphertext, and the final base64-encoded string all
transiently resident at once — roughly **4x** the compressed archive size at peak (documented
assumption, not measured to the byte). `verifyBackup()` has the same shape.

- **The cap is now config-overridable**, not a hardcoded constant: `backup_max_encrypt_mb`
  (`AdminBackupService::maxEncryptBytes()`), admin-facing in Admin Hub → System, default **250 MB**,
  floor 50 MB, ceiling 2000 MB. Before this fix a fixed 100 MB `MAX_ENCRYPT_BYTES` constant rejected
  every real backup on a clinic whose compressed dump had simply grown past it — a real, silent,
  eventually-fatal failure mode for a clinic that had been backing up successfully for months.
- **The default's stated assumption:** a 2 GB RAM box (this product's documented floor — an on-prem
  mini-PC or small VPS, CLAUDE.md) can safely lend the backup job about 1 GB of memory without
  starving Apache/MySQL running alongside it, PROVIDED the backup runs off-peak via the
  scheduled/cron path (§7). 1024 MB ÷ 4x ≈ 250 MB compressed, which is the default. A bigger box can
  raise `backup_max_encrypt_mb`; `AdminBackupService` derives the `memory_limit` it requests for the
  encrypt/verify step from the configured cap (same 4x multiplier + headroom), so a raised cap doesn't
  silently OOM.
- **Cheap pre-check before the expensive dump (BACKUP-H1b).** `performBackup()` now checks the
  database's raw table storage (`information_schema.tables`, a fast metadata query) against the cap
  BEFORE running `mysqldump`/gzip — a persistently over-cap database used to re-run the full
  dump-and-compress on every scheduled attempt (every 1-2 minutes via the job worker) just to fail the
  size check at the very end. **Calibration note, found live during this fix:** raw table storage is a
  much WORSE (larger) proxy for compressed size than it first looks — it includes secondary-index
  bytes that never appear in the SQL dump text at all. Measured against this project's own dev
  database: 1693.9 MB table storage → a 1184.0 MB `mysqldump` text → **140.5 MB** gzip (a 12.06x
  storage-to-gz ratio). An early build of this pre-check used a 3x margin and **false-skipped that
  exact, perfectly fittable backup** before ever attempting the real dump — fixed by raising the
  margin to 8x (still real headroom below the measured 12x, for less-compressible data) and pinned
  with a regression test. The pre-check is a heuristic early-out only; the authoritative check
  (unchanged) is still the real compressed size, right before encryption.
- **Actionable failure, not a bare throw.** An over-cap failure — from either the pre-check or the
  real post-gzip check — writes a plain-English `message` onto the failed run row (surfaced verbatim
  by the System-health "Backup" chip's detail text): current size, the configured limit, "raise
  `backup_max_encrypt_mb` in Admin Hub → System → Backup if this server has enough RAM," and a pointer
  to **BACKUP-STREAM** (below) for a database too large for any in-memory approach.
- **BACKUP-STREAM (tracked, not built).** True streaming encryption — encrypt the dump in bounded
  chunks as it's produced, no in-memory cap at all — is the real long-term fix for arbitrarily large
  databases, and is the RECOMMENDED next step once a clinic's DB genuinely outgrows what a 2 GB-class
  box can hold in memory even with the cap raised. It is deliberately **not** built here: it would
  change the on-disk `.enc` format (today's format is "one CryptoGen-encrypted blob"; a streamed
  format needs a chunked/self-describing envelope), which would break wave-1's proven
  `backup-decrypt.php` tool and its documented restore drill. That format change is a dedicated,
  separately-reviewed piece of work, not a fold-in.
- **Proven on a real, large database (2026-07-18).** With the cap at its 250 MB default, a REAL backup
  of this project's dev database (1.7 GB raw storage) was run through `AdminBackupService` end to end:
  produced a 197 MB `.enc` archive (`admin_hub_backup_run` id **266**), `verifyBackup()` passed
  (full-stream, §5b), and the archive was independently decrypted with wave-1's `backup-decrypt.php`
  against a freshly-exported recovery-key bundle — no shortcuts, no shared state with the live
  `CryptoGen` instance — recovering the exact 147,820,717-byte compressed dump, which gunzipped to a
  valid ~1.19 GB SQL file (336 `CREATE TABLE`, 1343 `INSERT INTO` statements). Confirms the raised cap,
  the pre-check calibration, the M1 full-stream verify, and the L5 dump flags all together on a
  realistically-sized database, not just the small fixtures the unit tests use.

## 6. Restore (deliberately manual)

Restore is **destructive** and needs the escrowed key, so it stays a documented ops procedure, not a
UI action. **BACKUP-C2 (2026-07-18)** replaced the previous 2-line placeholder here with a real,
proven procedure:

1. Decrypt the `.enc` file using ONLY the recovery-key bundle (§5d) — no live database or live
   `methods/` folder required — via
   `interface/modules/custom_modules/oe-module-new-clinic/scripts/backup-decrypt.php` (a thin subclass
   of the real `CryptoGen` fed the bundle's key material explicitly; does not reimplement any crypto).
2. Restore the resulting SQL dump into a **scratch** database with `mysql`, verify it (row counts,
   `verify-module.php --bootstrap`, a visit-board load), and only then cut a real site over to it.
   Mirrored documents decrypt the same way, one `.enc` file at a time.

The full, numbered, plain-English procedure — including troubleshooting and a genuinely executed
restore drill with real byte counts — lives in
`Documentation/NewClinic/NEW_CLINIC_BACKUP_RESTORE_RUNBOOK.md`. No "Restore" button ships in the UI —
matching the stock stance and SEC6 key custody; Admin Hub's RB-19 runbook card points here.

## 7. Frequency / scheduling

- **`backup_frequency_days`** (0 = off). A backup is "due" once this many days pass since the last
  **successful** run. `dueForBackup()` computes this; the System-health board shows
  "every N days · due now / last backup X days ago", and it feeds a soon-to-warn chip.
- **A scheduled task or cron entry is REQUIRED — this is not optional (BACKUP-H1 correction).**
  The v0.2.0 claim below ("no cron, no Task Scheduler, nothing to configure") was **wrong for New
  Clinic's own desks**: the logged-in-UI heartbeat this relied on
  (`execute_background_services.php`, driven by `background_services` → `nc_scheduled_backup` →
  `scripts/backup-service.php`) only fires from inside OpenEMR's **legacy tab shell** — every New
  Clinic desk deliberately **escapes that shell** via `top-redirect.php` (PRD §strangler-fig). On a
  clinic that only ever opens New Clinic desks (the normal case for a pilot), that heartbeat may
  fire rarely or never, so a backup schedule configured here can silently never run. Set up ONE of:
  - **Preferred — the job worker (`scripts/run-jobs.php`).** Already needs scheduling for export
    jobs (SCALE-2.1); BACKUP-H1(a) added the SAME due-check/run call here
    (`AdminBackupService::runScheduledBackup()`/`runScheduledFilesBackup()` — identical method the
    heartbeat and `backup-scheduled.php` call, no duplicated logic), so one scheduled task now
    covers both. Windows Task Scheduler (every 1–2 min): Program `C:\xampp\php\php.exe`, Arguments
    `C:\xampp\htdocs\openemr\interface\modules\custom_modules\oe-module-new-clinic\scripts\run-jobs.php --max-seconds=55`.
    Linux cron: `* * * * * php /path/to/oe-module-new-clinic/scripts/run-jobs.php --max-seconds=55`.
  - **Backup-only alternative — `scripts/backup-scheduled.php`** (CLI, `$ignoreAuth`), daily via cron
    / Windows Task Scheduler (command examples in its header), if you don't want the export-job
    worker running too.
  - The tab-shell heartbeat still runs due backups **in addition**, as a free bonus whenever
    someone does have a legacy tab open — it is just never sufficient on its own for a desk-only
    clinic. Admin Hub's RB-22 runbook card ("Schedule automatic backups") has the exact commands;
    the setup checklist's "Nightly background jobs running" item points here too.
  - **How to tell it's actually working:** System health → Backup & logs shows "Last scheduled
    attempt" (ok OR failed) sourced from `actor_id IS NULL` runs — distinct from the ordinary
    backup chip, which a recent MANUAL "Run now" click can make look healthy even when the
    unattended schedule has never fired once. If that line never appears, the task isn't running.
- **Concurrency (M3):** all three entry points funnel into the same `performBackup()`/
  `performFilesBackup()`, which now take a short-lived lock (`new_clinic_maintenance_lock`,
  `backup:db` / `backup:files` keys) so the heartbeat and a scheduled worker landing in the same
  minute never dump/encrypt onto the same target directory concurrently — the loser fails fast with
  a clear "already running" error instead of corrupting the target.
- **ACL split:** the UI `runBackup()` requires super-admin; the cron/worker `runScheduledBackup()`
  does not (its trust boundary is server-side execution) — both funnel into the same ACL-free
  `performBackup()`.
- **Retry backoff on repeated failure (BACKUP-H1b, 2026-07-18).** `dueForBackup()` used to only look
  at the last **successful** run's age — a persistently-failing schedule (an over-cap database on the
  old fixed 100 MB cap, a full disk, a bad target directory) had NO successful run to compare against,
  so it read as "due" on every single due-check. With the job worker polling every 1-2 minutes, that
  meant a full `mysqldump`+gzip re-run, and a fresh `failed` row, roughly every minute forever — up to
  ~1440 wasted failed rows a day on a box that could never succeed until an admin intervened.
  `dueForBackup()` now also looks at the most recent attempt of EITHER status: if it failed and is
  younger than a backoff window (`min(frequency_days × 24h, 4h)`, floored at 1h), the schedule reports
  **not due** even though "due by age since last success" would otherwise say yes. A manual "Run now"
  click is unaffected — backoff only governs the unattended scheduled path.

## 8. Retention

On each successful **database** run, prune encrypted DB archives in the target dir older than
`admin_hub_backup_retention_days`. Only files matching the `nc-backup-*.enc` naming are ever deleted —
never arbitrary files in the target dir.

**`admin_hub_backup_retention_days` = 0 means NEVER delete (BACKUP-M6, 2026-07-18).** The setting's
admin-facing minimum used to be 1, which made "never prune" unreachable from the UI even though
`pruneOldArchives()` already treated `<= 0` as "skip pruning entirely" — the backend honestly
supported it, the UI just didn't let an admin choose it. The field's hint used to say "How long the
System lens keeps backup run history," which was misleading in a more serious way: this setting
**deletes real files from disk**, not just a history display — the hint now says exactly that
("Delete backup files older than N days. 0 = never delete."). **Boundary rule, verified with a test:**
"older than N days" means strictly older — a backup exactly N days old (to the second) survives; only
one that has crossed the boundary is pruned. That boundary was already correct in the pruning code;
this wave added the regression test.

**Run-row pruning (BACKUP-M6b, 2026-07-18) — the retention setting now also bounds
`admin_hub_backup_run` itself**, not just the archive files. Left alone, run rows accumulated forever
(a persistently-failing schedule, even after the H1b backoff above slows its RATE, still adds rows
indefinitely over months/years), and "retention" only ever describing the files was half the truth.
Reuses the SAME `admin_hub_backup_retention_days` window. Two things are NEVER pruned regardless of
age: any row with `verified_at` set — the permanent "this clinic has proven it can restore" milestone
(§5, H3(i)) that the setup checklist depends on, which a blind age-based prune could otherwise
silently erase — and the single most-recent row of each kind (`db`/`files`), so "last status" always
has something current to show.

**The site-files mirror is never auto-pruned.** Documents are permanent records, not rolling
snapshots — deleting a scanned ID's backup because it is 30 days old would be data loss, not
retention. Old mirror files only leave when the admin removes them by hand. (If a document is deleted
in OpenEMR, its already-made encrypted mirror copy simply stays — that is a *feature* for a records
system, not a leak: the mirror is as protected as any backup.)

## 8. XAMPP (dev) vs VPS (prod)

- **XAMPP/Windows (pilot box):** this engine is the primary local backup. `mysqldump.exe` at
  `C:\xampp\mysql\bin\mysqldump.exe`; target a USB/external drive. This is the "local + removable" tier.
- **VPS (production):** the **read-replica snapshot pipeline is the off-site backup** (SEC6 §3). This
  engine is complementary (a local encrypted snapshot), not a replacement for the replica.

## 9. Flags / config

| Key | Default | Meaning |
|---|---|---|
| `enable_native_backup` | `0` | Turns the in-app engine on (else Run-now stays the legacy stub). |
| `backup_target_dir` | `''` (→ `documents/nc_backups`) | Where encrypted archives are written. |
| `backup_include_site_files` | `0` | Run the **separate** incremental site-files mirror backup (§3b) alongside the DB backup. |
| `backup_frequency_days` | `0` | Automatic-backup cadence (0 = off); drives the due-check + cron script. |
| `admin_hub_backup_retention_days` | `30` | Delete `.enc` archives AND run-history rows older than this. **`0` = never delete** (§8). |
| `backup_max_encrypt_mb` | `250` | In-memory encryption cap, MB, compressed (§5e). Min 50, max 2000. |

All 6 of the keys above are **global-only** (`ClinicAdminService::GLOBAL_ONLY_SETTINGS`) — always read
and written at the facility-0 sentinel regardless of which facility an Admin Hub settings save
resolves to (§4, BACKUP-M4b).

## 10. Verification

Unit-testable: the disabled/ACL/frequency guards, `dueForBackup` off-state and retry-backoff state,
the size pre-check's threshold decision (pinned against the real measured false-skip below), the
retention 0=never and boundary behavior, the mirror last-known-good guarantee, and the full-stream
verify's pass/fail on a good vs. a truncated fixture.

The `mysqldump` exec is covered by desktop live smokes:

- **2026-07-11** via `scripts/backup-scheduled.php`: 497 MB DB → 68 MB gz → **91.5 MB `.enc`** written
  to `documents/nc_backups/`, run row `ok` with real path + `size_bytes`, archive confirmed
  **encrypted** (CryptoGen `007…` header, not gzip/SQL), **plaintext temp wiped**, and an immediate
  re-run correctly **skipped (not due)**.
- **2026-07-18 (BACKUP-CAP, wave 3) — the capacity fix, proven end to end on this project's own dev
  database (1.7 GB raw storage, well past the OLD 100 MB cap):**
  1. Enabled `enable_native_backup` via `ClinicConfigService::set()` (never raw SQL, so the SCALE-3.3
     config cache invalidates correctly).
  2. Ran `AdminBackupService::runBackup(0, 1)` — the real "Run backup now" path. Result: run id **266**,
     status `ok`, a **197,094,383-byte** `.enc` archive written to `documents/nc_backups/`, confirmed
     present on disk at that exact size.
  3. `verifyBackup(266)` — **passed** ("Decrypted and readable as a database dump"), exercising the new
     full-stream check (§5b) against a real, non-trivial archive, not a small fixture.
  4. `exportRecoveryKey()` — produced a fresh 2-file, 0-warning bundle.
  5. **Independent round-trip**, mimicking a real disaster restore: unzipped the fresh bundle to a
     scratch folder, then ran wave-1's `scripts/backup-decrypt.php --in <archive> --bundle <bundle>
     --out <file>` from a cold process — no shared state with the live app. Recovered exactly
     147,820,717 bytes; `gzip -t` confirmed integrity; gunzipped to a valid ~1.19 GB SQL file
     containing 336 `CREATE TABLE` and 1343 `INSERT INTO` statements.
  6. Flag turned back OFF (`enable_native_backup=0`, `backup_frequency_days=0`) afterward; run id 266
     and its archive were left in place as the historical record of a real, successfully-verified
     backup (this is also what permanently satisfies the setup checklist's "Backup tested" milestone,
     §5, H3(i), on this install going forward).
  - **A calibration bug was CAUGHT, not just avoided, by insisting on a real run**: the size
    pre-check (BACKUP-H1b, §5e) originally used a 3x raw-storage-to-cap margin and **false-skipped**
    this exact backup before the fix — it never even attempted the dump. The real measured ratio
    (1693.9 MB storage → 140.5 MB gz, 12.06x) is what set the corrected 8x margin. This is exactly the
    kind of bug a synthetic/small fixture would never surface.

**Site-files mirror (§3b) — live-smoked 2026-07-12** against a synthetic documents tree on the pilot
box (real `CryptoGen`): the two documents were mirrored as individually-encrypted `.enc` files (real
ciphertext, not plaintext; each **decrypted back to its exact source**); the encryption **key dir**,
the module's own `nc_backups/`, and the `temp/` dir were **excluded** (nothing leaked into the
mirror); and an immediate second run copied **0** (incremental — all skipped). A unit test also pins
the exclusion anchoring so a legitimate document merely containing "temp" in its name/path
(`temperature-chart.pdf`) is never dropped. The exclusion is anchored to the documents root (the
first smoke caught a real bug: an unanchored match excluded the whole tree when the root sat under a
system `Temp` path — fixed).

## 11. Version history

| Version | Date | Change |
|---|---|---|
| v0.8.0 | 2026-07-18 | **BACKUP-CAP/M1/M6/M6b/M7/L2/L3/L5 fixes + BACKUP-H1b/M4b (backup-system audit, wave 3).** CAP: the fixed 100 MB in-memory encryption cap is now a config-overridable `backup_max_encrypt_mb` (default 250 MB, derived from a stated 2 GB RAM / ~4x-peak-memory assumption — §5e), with an actionable over-cap error and a cheap raw-storage pre-check (BACKUP-H1b) before the expensive dump — proven end-to-end against this project's own 1.7 GB dev database (197 MB `.enc`, verified, independently round-tripped through wave-1's `backup-decrypt.php`; run id 266). A real run caught and fixed a genuine calibration bug in the pre-check itself (3x margin false-skipped a fittable backup; corrected to 8x off measured data). M1: disk-full/partial writes (short `gzwrite()`, short archive `file_put_contents()`) are now caught instead of silently recorded `ok`, and `verifyBackup()` streams the WHOLE archive against its own gzip trailer instead of only the first ~8 KB (§5b) — a truncated archive can no longer verify green. M6: `admin_hub_backup_retention_days` now honestly means "delete backup files (and history rows)," its UI minimum allows the already-supported `0` = never, and the boundary behavior is pinned by a test (§8). M6b: run-history rows are now pruned on the same window, protecting the permanent "verified" milestone and each kind's latest row (§8). M7: the site-files mirror never overwrites an existing `.enc` copy — a source file changed in place lands in a timestamped sibling file instead, guaranteeing the last-known-good backup survives a single bad run (§3b). L2: the "stale backup" chip threshold now derives from `backup_frequency_days` (+ a small grace) instead of a fixed 7 days, so a daily-backup clinic isn't shown a false-green chip on a 6-day-old backup; the chip also now confirms the artifact is still on disk before showing green. L3: the "Verify latest backup" button is gated on `can_run_backup`, matching the other super-only controls on this board. L5: `mysqldump` gained `--hex-blob`, `--events`, `--quote-names`, `--no-tablespaces`, and `--default-character-set=utf8mb4` for restore fidelity across blob-heavy tables and MariaDB↔MySQL moves. H1b: `dueForBackup()` now backs off from a recent failed attempt so a persistently-failing schedule retries on a sane cadence (hours) instead of every 1-2 minute worker poll (§7). M4b: the M4 facility-0 fix only covered reads — `ClinicAdminService::saveSettings()` still wrote (and could `clearGlobalOverrides()`-delete) backup config at whatever facility a save request resolved to; the 6 backup keys are now forced to facility 0 on both read and write, exempted from `clearGlobalOverrides()` (§4). BACKUP-STREAM (true streaming encryption, no size cap) is recorded as a tracked future fix, not built — it would change the `.enc` format (§5e). |
| v0.7.0 | 2026-07-18 | **BACKUP-H1/H2/H3 + M2-M5 fixes (backup-system audit, wave 2).** H1: the v0.2.0 "no cron needed" claim was wrong for New Clinic's own desks (they escape the tab shell the heartbeat depends on) — `scripts/run-jobs.php` now ALSO runs the due-check (§7), and System health surfaces "Last scheduled attempt" (ok or failed, not just last success) so a silently-broken schedule is visible. H2: `verifyBackup()` now filters `kind = 'db'` in both lookup branches — a files run's directory could masquerade as a "missing" db archive (§5b). H3: the legacy "Mark backup complete" path is now labeled "Self-reported (no verified artifact)" everywhere, and the setup checklist's "Backup tested" item requires a real artifact AND a passed verify, not just any 'ok' chip (§5). M2: `set_time_limit(0)` inside the actual backup work (not just callers), `supersedeRunningBackups()` now covers both `db` and `files` kinds. M3: a `new_clinic_maintenance_lock`-based lock prevents two backup runs of the same kind overlapping (§7). M4: backup config and run rows moved off the per-request "resolved facility" onto a fixed facility-0 sentinel — a database backup was never meaningfully per-facility (§4). M5: the Admin Hub no longer force-navigates away from the page on a native backup that already finished synchronously. |
| v0.6.0 | 2026-07-18 | **BACKUP-C1/C2 fixes (backup-system audit).** C1: the recovery-key bundle was missing the database key material the drive-key files depend on (versions 5+) — `exportRecoveryKey()` now bundles `db-keys.json` alongside `methods/`, and the README rewritten with a real numbered restore procedure (§5d). C2: shipped `scripts/backup-decrypt.php` (standalone, bundle-only, no live DB/methods dependency) and `Documentation/NewClinic/NEW_CLINIC_BACKUP_RESTORE_RUNBOOK.md` with a genuinely executed restore drill (§6) — replacing the previous 2-line restore placeholder and the stock-`backup.php` RB-19 pointer. |
| v0.5.0 | 2026-07-12 | **Site files backed up as a SEPARATE entity (§3, §3b).** Rejected the original "combine DB + documents into one archive" plan: the two have different cadence, size, fault, and retention characteristics. The DB stays a full frequent encrypted archive; the documents tree becomes a **separate incremental per-file-encrypted mirror** (`nc-files-<site>/`), copying only new/changed files, encrypting each file individually (so the whole-tree size never has to fit the in-memory budget), excluding the module's own backups + `temp/` + the encryption **key** dir, and **never auto-pruned** (documents are permanent records). Own `kind='files'` run rows; own "Recent file backups" history. `backup_include_site_files` now switches this on (was declared but unbuilt). |
| v0.1.0 | 2026-07-11 | Initial design. Reconciled an in-app encrypted backup engine with SEC6 §3 (encrypt-before-persist, no plaintext on removable media, credentials via 0600 defaults-file, super-admin + `enable_native_backup` gate, restore stays manual, VPS replica remains the off-site tier). Engine slice 1 (DB dump + encrypt + track real path/size + retention) built alongside. |
| v0.1.1 | 2026-07-11 | Added **frequency/scheduling**: `backup_frequency_days` + `dueForBackup()` + a CLI cron entrypoint (`scripts/backup-scheduled.php`) an OS scheduler calls; `runScheduledBackup()` (no interactive ACL) and UI `runBackup()` (super-admin) share an ACL-free `performBackup()`. Schedule status surfaced in the System-health board. **Live end-to-end smoke passed** (see §11). |
| v0.4.0 | 2026-07-11 | **Recovery-key custody (§5d).** The drive key that decrypts every backup lives on the same disk as the data, so a disk loss makes the off-site backups unrecoverable. Added `recoveryKeyStatus()` (nag when keys exist but were never exported off-box) + a super-admin, audited **"Save recovery key"** download (`exportRecoveryKey` → ZIP of methods/ + a plain-English READ_ME; secret never persists server-side) surfaced in the System board. Closes the false-confidence hole. |
| v0.3.0 | 2026-07-11 | **Cloud off-site without OAuth.** `BackupCloudTargetService` detects Google Drive / OneDrive / Dropbox desktop-sync folders and classifies whether the backup target syncs to one; the System board shows a green "off-site ✓" for cloud targets and, for local targets, suggests detected cloud folders. Chosen over an in-app OAuth "Connect" flow (per-provider app registration + reachable HTTPS redirect — impractical on LAN, unverifiable here). Detection **live-smoked** against the real OneDrive folders on the pilot box. |
| v0.2.0 | 2026-07-11 | **No OS scheduler needed** — registered an OpenEMR `background_services` row (`nc_scheduled_backup`, `scripts/backup-service.php`) so the logged-in UI heartbeat runs due backups automatically; OS cron is now optional (lights-out only). Added **verify** (`verifyBackup` decrypt+SQL-head check + "Verify latest backup" button) and an honest **local-target warning** (`backup_target_local`). All three live-smoked: heartbeat function loads + no-ops when off; a real 96 MB backup decrypts and reads as a DB dump. |

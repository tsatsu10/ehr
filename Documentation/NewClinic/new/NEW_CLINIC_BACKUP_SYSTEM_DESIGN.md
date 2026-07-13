# New Clinic — Backup System Design

**Version:** v0.5.0 · **Date:** 2026-07-12 · **Status:** Engine + no-cron heartbeat scheduling + verify + honesty warnings + cloud sync-folder off-site + recovery-key custody + **separate incremental site-files backup (§3b)** — built and live-smoked (GAP-C C6 follow-up)

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
- **Tracking:** each files run records its own row in `admin_hub_backup_run` with `kind = 'files'`
  (the DB runs are `kind = 'db'`), a `file_path` of the mirror dir, `size_bytes` = bytes copied this
  run, and a human message (e.g. "Site files: 12 new/changed, 40 unchanged, 88.2 MB").

## 4. Where the data goes

- **Target directory:** `backup_target_dir` config (per facility). Default: a module-owned
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

`initiateBackup()` now **performs** the backup synchronously (it was a stub) and returns the real
result. The old two-step "start → mark complete" is collapsed for native runs; the "Mark complete"
button remains only for the legacy stock-backup path.

## 5b. Verify (a backup you can't restore is a hope, not a guarantee)

`verifyBackup(runId)` (super-admin; "Verify latest backup" button in the System-health board)
decrypts the archive and reads the first bytes back through gzip to confirm it's a real SQL dump
(memory-safe — head only). It answers "can this actually be decrypted and restored?" without a full
restore. It does **not** replace a periodic real restore drill, but catches the common silent
failures (wrong key, corrupt/empty archive). **Live-smoked 2026-07-11:** a real 96 MB `.enc`
decrypted and read as a DB dump.

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
- **The rule we surface in the UI:** store the key copy **separately from the backups** — never the
  same folder or same cloud account (whoever gets both gets all PHI). This is exactly SEC6's key
  escrow (MSA §7.2): one copy is enough to restore, both copies lost = unrecoverable.

## 6. Restore (deliberately manual)

Restore is **destructive** and needs the escrowed key, so it stays a documented ops procedure, not a
UI action:
1. Decrypt the `.enc` with the drive key (CryptoGen / the documented CLI).
2. Restore the SQL dump with `mysql` and unpack documents.
No "Restore" button ships — matching the stock stance and SEC6 key custody.

## 7. Frequency / scheduling

- **`backup_frequency_days`** (0 = off). A backup is "due" once this many days pass since the last
  **successful** run. `dueForBackup()` computes this; the System-health board shows
  "every N days · due now / last backup X days ago", and it feeds a soon-to-warn chip.
- **How it actually runs — no OS scheduler required (default).** A row in OpenEMR's
  `background_services` table (`nc_scheduled_backup`, interval 60 min) points at
  `nc_scheduled_backup_service()` (`scripts/backup-service.php`). OpenEMR's UI **heartbeat**
  (`execute_background_services.php`, pinged while staff are logged in) runs it on its interval, with
  the framework's `running` lock + crash-safe reset. So scheduled backups happen **as long as someone
  has OpenEMR open** — no cron, no Task Scheduler, nothing to configure. The function no-ops unless
  native backup is on AND a backup is due.
- **Optional OS scheduler** (for lights-out boxes where nobody's logged in overnight):
  `scripts/backup-scheduled.php` (CLI, `$ignoreAuth`) does the same via cron / Windows Task Scheduler
  (command examples in its header). Both paths call the identical `runScheduledBackup()`; both are
  idempotent (run when due, else no-op).
- **ACL split:** the UI `runBackup()` requires super-admin; the cron `runScheduledBackup()` does not
  (its trust boundary is server-side execution) — both funnel into the same ACL-free `performBackup()`.

## 8. Retention

On each successful **database** run, prune encrypted DB archives in the target dir older than
`admin_hub_backup_retention_days` (existing config, default 30). Only files matching the
`nc-backup-*.enc` naming are ever deleted — never arbitrary files in the target dir.

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
| `admin_hub_backup_retention_days` | `30` | Prune `.enc` archives older than this (existing). |

## 10. Verification

Unit-testable: the disabled/ACL/frequency guards, `dueForBackup` off-state. The `mysqldump` exec is
covered by a desktop live smoke — **run and passed 2026-07-11** via `scripts/backup-scheduled.php`
on the pilot box: 497 MB DB → 68 MB gz → **91.5 MB `.enc`** written to `documents/nc_backups/`, run
row `ok` with real path + `size_bytes`, archive confirmed **encrypted** (CryptoGen `007…` header, not
gzip/SQL), **plaintext temp wiped**, and an immediate re-run correctly **skipped (not due)**.

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
| v0.5.0 | 2026-07-12 | **Site files backed up as a SEPARATE entity (§3, §3b).** Rejected the original "combine DB + documents into one archive" plan: the two have different cadence, size, fault, and retention characteristics. The DB stays a full frequent encrypted archive; the documents tree becomes a **separate incremental per-file-encrypted mirror** (`nc-files-<site>/`), copying only new/changed files, encrypting each file individually (so the whole-tree size never has to fit the in-memory budget), excluding the module's own backups + `temp/` + the encryption **key** dir, and **never auto-pruned** (documents are permanent records). Own `kind='files'` run rows; own "Recent file backups" history. `backup_include_site_files` now switches this on (was declared but unbuilt). |
| v0.1.0 | 2026-07-11 | Initial design. Reconciled an in-app encrypted backup engine with SEC6 §3 (encrypt-before-persist, no plaintext on removable media, credentials via 0600 defaults-file, super-admin + `enable_native_backup` gate, restore stays manual, VPS replica remains the off-site tier). Engine slice 1 (DB dump + encrypt + track real path/size + retention) built alongside. |
| v0.1.1 | 2026-07-11 | Added **frequency/scheduling**: `backup_frequency_days` + `dueForBackup()` + a CLI cron entrypoint (`scripts/backup-scheduled.php`) an OS scheduler calls; `runScheduledBackup()` (no interactive ACL) and UI `runBackup()` (super-admin) share an ACL-free `performBackup()`. Schedule status surfaced in the System-health board. **Live end-to-end smoke passed** (see §11). |
| v0.4.0 | 2026-07-11 | **Recovery-key custody (§5d).** The drive key that decrypts every backup lives on the same disk as the data, so a disk loss makes the off-site backups unrecoverable. Added `recoveryKeyStatus()` (nag when keys exist but were never exported off-box) + a super-admin, audited **"Save recovery key"** download (`exportRecoveryKey` → ZIP of methods/ + a plain-English READ_ME; secret never persists server-side) surfaced in the System board. Closes the false-confidence hole. |
| v0.3.0 | 2026-07-11 | **Cloud off-site without OAuth.** `BackupCloudTargetService` detects Google Drive / OneDrive / Dropbox desktop-sync folders and classifies whether the backup target syncs to one; the System board shows a green "off-site ✓" for cloud targets and, for local targets, suggests detected cloud folders. Chosen over an in-app OAuth "Connect" flow (per-provider app registration + reachable HTTPS redirect — impractical on LAN, unverifiable here). Detection **live-smoked** against the real OneDrive folders on the pilot box. |
| v0.2.0 | 2026-07-11 | **No OS scheduler needed** — registered an OpenEMR `background_services` row (`nc_scheduled_backup`, `scripts/backup-service.php`) so the logged-in UI heartbeat runs due backups automatically; OS cron is now optional (lights-out only). Added **verify** (`verifyBackup` decrypt+SQL-head check + "Verify latest backup" button) and an honest **local-target warning** (`backup_target_local`). All three live-smoked: heartbeat function loads + no-ops when off; a real 96 MB backup decrypts and reads as a DB dump. |

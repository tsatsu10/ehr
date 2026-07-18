# New Clinic — Backup Restore Runbook

**Version:** 1.0.0 · **Date:** 2026-07-18 · **Status:** Real, numbered restore procedure — proven end-to-end
on this machine (see §6). Written to close **BACKUP-C2** from the backup-system audit: before this
document, "restore from backup" pointed at stock `interface/main/backup.php`, no decrypt tool existed,
and a restore had never actually been performed.

Governs restoring a New Clinic native encrypted backup (`AdminBackupService`, see
`Documentation/NewClinic/new/NEW_CLINIC_BACKUP_SYSTEM_DESIGN.md`). Subordinate to
`NEW_CLINIC_SEC6_DATA_AT_REST_RUNBOOK.md` §3 — where they disagree, SEC6 wins.

---

## 1. Why this exists

A backup you have never restored is a hope, not a guarantee. Before this runbook: the Admin Hub's
"Restore from backup" pointer (RB-19) sent an admin to the stock, non-New-Clinic backup screen — which
knows nothing about this module's encrypted archives — and no tool existed anywhere in the repo that
could turn an `.enc` file back into a `.sql` file. If a real disaster had happened, the honest answer to
"can we get the clinic's data back?" was **untested**. This document, plus
`interface/modules/custom_modules/oe-module-new-clinic/scripts/backup-decrypt.php`, replaces that with a
procedure that has actually been run, on a real backup, start to finish (§6).

## 2. What you need before you start

1. **A backup file.** A DB archive (`nc-backup-<site>-<timestamp>.sql.gz.enc`) from the backup target
   directory, or a mirrored document (`<relative-path>.enc`) from a `nc-files-<site>` folder.
2. **A recovery-key bundle.** Exported from Admin Hub → System → "Save recovery key"
   (`admin.backup.export_recovery_key`, super-admin only). This is a ZIP containing:
   - `methods/` — the drive-key files (e.g. `sevena`, `sevenb`).
   - `db-keys.json` — the matching `keys`-table rows (name + value). **Added in BACKUP-C1** — without
     this file, a bundle exported before 2026-07-18 cannot decrypt anything on a machine that doesn't
     already have the original database (see §7's "what changed" note).
   - `READ_ME_FIRST.txt` — a plain-English copy of the restore steps below, written for whoever finds
     the bundle in an emergency and has not read this file.
3. **A machine with PHP 8.2+ and this repository checked out** (or at least the
   `oe-module-new-clinic` folder + `vendor/`). It does **not** need a working database connection, a
   configured site, or the original methods/ folder — that is the entire point of the bundle.

If you only have the backup file and NOT the recovery-key bundle, stop — you cannot decrypt it. Go find
the bundle (a password manager, a USB stick in a locked drawer, wherever the admin was told to keep it
— see the bundle's own README, first line). There is no recovery path around a missing bundle; that is
by design (§2 of the design doc — key custody is the clinic's).

## 3. Restore a database backup

1. **Never restore over the live database first.** Always land the decrypted dump in a **scratch**
   database and verify it before touching production.
2. Decrypt:
   ```
   php interface/modules/custom_modules/oe-module-new-clinic/scripts/backup-decrypt.php \
     --in  /path/to/nc-backup-<site>-<timestamp>.sql.gz.enc \
     --bundle /path/to/recovery-key.zip \
     --out /path/to/restored.sql.gz
   ```
   `--bundle` accepts either the ZIP as downloaded, or a folder you have already unzipped it into —
   whichever is easier. On success this prints `Decrypted OK: <n> bytes written to ...` and exits 0. On
   failure it prints a plain-English reason and a non-zero exit code (1 = bad input/usage, 2 = the
   bundle itself is unreadable or incomplete, 3 = decryption failed — wrong bundle for this file, or the
   file is corrupted). It never writes a partial/corrupt `--out` file on failure.
3. Un-gzip the result:
   ```
   gunzip -k restored.sql.gz     # -k keeps restored.sql.gz around too
   ```
   You now have a plain-text `restored.sql` — a full SQL dump of the database at backup time. **Treat
   this file with the same care as the patient records it contains**; delete it securely once the
   restore is verified (step 6).
4. Create a scratch database and load the dump:
   ```
   mysql -u root -p -e "CREATE DATABASE nc_restore_drill CHARACTER SET utf8mb4;"
   mysql -u root -p nc_restore_drill < restored.sql
   ```
   (Use whatever DB user actually has `CREATE DATABASE` — the module's normal app user often does not;
   see §6's real run for the exact gotcha hit on this box.)
5. Sanity-check row counts against what you expect (or, if you still have it, against the live DB):
   ```
   mysql -u <user> -p nc_restore_drill -e "SELECT COUNT(*) FROM patient_data;"
   mysql -u <user> -p nc_restore_drill -e "SELECT COUNT(*) FROM new_visit;"
   ```
6. Point a **scratch** site config at `nc_restore_drill` and run
   `php interface/modules/custom_modules/oe-module-new-clinic/scripts/verify-module.php --bootstrap` —
   must PASS. Load the visit board and one desk against it; confirm real-looking visits render.
7. Only after steps 4–6 look right do you consider promoting this to the real database — and that is a
   separate, deliberately manual, "point the site config at it" operation, never an automatic overwrite.
   Take a fresh backup of whatever is currently live first, in case you need to undo.
8. Copy the recovery bundle's `methods/` files into the restored site's
   `sites/<site>/documents/logs_and_misc/methods/` folder (overwrite the freshly-generated ones) so
   future backups/restores on the new machine keep working with the SAME keys as the old backups.

## 4. Restore a single mirrored document

The site-files backup (`backup_include_site_files`) mirrors each document as its own `.enc` file under
`nc-files-<site>/<same relative path>.enc`. To recover one file (not the whole tree), run the same tool
against that one file:

```
php backup-decrypt.php --in /path/to/nc-files-<site>/patient/scan123.pdf.enc \
  --bundle /path/to/recovery-key.zip --out /path/to/scan123.pdf
```

No gunzip step — documents are encrypted as-is, so `--out` is the original file, ready to use.

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Bundle not found` | Wrong `--bundle` path | Check the path; both a `.zip` and an unzipped folder work |
| `has no db-keys.json` | Bundle was exported **before** the BACKUP-C1 fix (pre-2026-07-18) | Re-export a fresh recovery key from a system that still has the original database, or — if that's gone too — this old bundle cannot decrypt anything; see §7 |
| `no database key material for '...'` / `no drive key file for '...'` | The `--bundle` you pointed at doesn't match this backup's site, or you mixed files from two different exports | Use the bundle that was exported from the SAME site as this backup, and don't hand-assemble a bundle from parts of different downloads |
| `could not be decrypted with the database key material in this bundle` | Bundle's `methods/` files and `db-keys.json` don't agree — almost always a mixed-up bundle | Re-download a fresh, complete bundle; don't edit or merge bundle files by hand |
| `Decryption failed. Either this bundle does not match this backup file ... or the input file is corrupted` | Wrong bundle for this backup (different site/date), or the `.enc` file is truncated/corrupted | Confirm you're using the bundle that was current when THIS backup was made; try a different backup file to isolate whether the bundle or the file is the problem |
| mysql `CREATE DATABASE` fails with "Access denied" | The app DB user (e.g. `openemr`) typically lacks `CREATE DATABASE` | Use an admin DB user (root) to create the scratch database, then `GRANT ALL ... TO` the app user if you want it to load the dump |

## 6. The proven drill — 2026-07-18, this machine → scratch DB

This is not a theoretical procedure — it was executed for real while writing this document, on the
XAMPP dev box, using the module's actual code (no shortcuts, no mocked crypto):

1. Enabled `enable_native_backup` via `ClinicConfigService::set()` (both the facility-0 default and the
   dev box's facility-specific override — see the "facility-scoped flag reads" gotcha: a facility can
   carry its own row that beats the global default).
2. Ran a real database backup through `AdminBackupService::runBackup()` → `admin_hub_backup_run` id
   **5**, `184,402,947` bytes, encrypted, written to `nc_backups/`.
3. Exported the recovery-key bundle through `AdminBackupService::exportRecoveryKey()` (real
   super-admin session, real ZIP, `db-keys.json` present with the real `sevena`/`sevenb` rows).
4. Flipped `enable_native_backup` back OFF and verified it read back as off.
5. Copied **only** the `.enc` backup file and the bundle ZIP into a brand-new temp folder — no other
   file from the live site.
6. Ran `backup-decrypt.php` (loads only `vendor/autoload.php` — no DB connection, no site bootstrap) —
   `Decrypted OK: 138,302,129 bytes`.
7. `gunzip`'d the result into a `1,147,341,288`-byte plain SQL file; head/tail both read as a normal
   `mysqldump` output.
8. Created a scratch database `nc_restore_drill` and loaded the SQL dump into it (took ~2m17s for the
   full DB).
9. Compared row counts, scratch vs. live:
   - `patient_data`: **463 = 463**
   - `new_visit`: **445 = 445**
10. Also ran the site-files backup (`admin_hub_backup_run` id **6**, 60 files, 1,530,720 bytes) and
    decrypted one real mirrored file (`certificates/README.md.enc`) back to its exact original —
    **SHA-256 matched byte-for-byte**. Ran both the ZIP-bundle and the already-unzipped-folder forms of
    `--bundle`; both worked identically.
11. Cleaned up: dropped `nc_restore_drill`, deleted the temp working folder, confirmed
    `enable_native_backup` and `backup_include_site_files` were both back at their original values.
    Left run rows 5 and 6 in `admin_hub_backup_run` as honest history (they are real, successful runs —
    not test noise to hide).

**Last proven: 2026-07-18, this machine → scratch DB.** Full command-by-command transcript in
`.superpowers/sdd/backup-wave1-report.md`.

## 7. What this drill does NOT prove — and what changed

- This was a **same-machine** drill (the decrypt tool ran on the same box the backup came from, just
  pointed only at copied files, never the live DB/methods dir). It proves the bundle + tool are
  mechanically correct and self-sufficient. It does **not** prove a bundle survives being carried to a
  **different physical machine** with a totally clean OpenEMR checkout and no shared filesystem state.
  **A true cross-machine drill is still recommended** before relying on this for a real disaster —
  ideally on a second computer, using only a USB copy of the bundle and the backup file.
- **Before 2026-07-18 (BACKUP-C1)**, exported recovery-key bundles contained only the `methods/` drive
  key files, not `db-keys.json`. For key version 5+ (this site is on "seven"), those files are
  themselves encrypted with the database key set, which lived only in the `keys` SQL table — inside the
  encrypted backup the bundle exists to open. **Any bundle exported before this date cannot decrypt
  anything on a machine that doesn't already have the original database** and should be treated as
  obsolete. Export a fresh one.
- The drill above restored the **database**. It did not exercise restoring the **full** site-files tree
  (only one representative file) — a full-tree restore is "decrypt every `.enc` under `nc-files-<site>/`
  the same way," which is mechanically identical, just repeated.

## 8. Version history

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-07-18 | Initial version. Written for BACKUP-C2 (backup-system audit): replaces the stock-`backup.php` pointer in RB-19 with this real, numbered procedure; documents `scripts/backup-decrypt.php`; records the first real restore drill (patient_data 463=463, new_visit 445=445; one mirrored document byte-identical by SHA-256). |

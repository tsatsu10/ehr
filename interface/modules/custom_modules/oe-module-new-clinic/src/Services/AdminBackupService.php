<?php

/**
 * In-app encrypted backup engine (GAP-C C6 follow-up).
 *
 * Produces a REAL, ENCRYPTED database backup and records its true path + size —
 * replacing the log-only stub. Governed by NEW_CLINIC_BACKUP_SYSTEM_DESIGN.md and
 * subordinate to SEC6 §3: the archive is encrypted (CryptoGen, drive key) BEFORE
 * it is written to the target directory; the plaintext dump lives only briefly in
 * the temp dir and is wiped; DB credentials go through a 0600 defaults-extra-file,
 * never the command line. Super-admin only + `enable_native_backup` (default OFF).
 *
 * Restore stays a manual, key-custody operation (design §6) — no restore here.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Crypto\CryptoGen;
use OpenEMR\Common\Crypto\KeyVersion;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class AdminBackupService
{
    public const ARCHIVE_PREFIX = 'nc-backup-';
    public const ARCHIVE_SUFFIX = '.enc';

    /** In-memory encryption cap (slice 1). Larger DBs use the VPS replica / stock backup. */
    private const MAX_ENCRYPT_BYTES = 100 * 1024 * 1024;

    /**
     * BACKUP-H1/M4: a database backup is whole-DB, not scoped to any one clinic
     * facility — the old per-request "resolved desk facility" was a meaningless,
     * unstable key for backup config/run rows (a multi-facility clinic or a
     * worker with no session context could resolve differently call to call,
     * making "last successful backup" and "is one due" answers wobble). Backup
     * config and run rows now live at this fixed sentinel facility.
     */
    private const BACKUP_FACILITY_ID = 0;

    /** Concurrency guard (M3) lock keys in `new_clinic_maintenance_lock`. */
    private const LOCK_KEY_DB = 'backup:db';
    private const LOCK_KEY_FILES = 'backup:files';

    /** Generous ceilings — a slow disk/USB target must not starve the other kind's lock. */
    private const LOCK_TTL_DB_SECONDS = 3600;
    private const LOCK_TTL_FILES_SECONDS = 14400;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function isNativeEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_native_backup', 0, self::BACKUP_FACILITY_ID) === 1;
    }

    /**
     * M4 back-compat: installs that ran before backups were pinned to facility 0
     * may have run rows (and config overrides) filed under whatever facility a
     * given request happened to resolve to at the time. Recompute that same old
     * value so reads can still find them, without making NEW writes depend on
     * request/session state (worker runs have none — repo gotcha).
     */
    private function legacyBackupFacilityId(): int
    {
        try {
            return $this->visitScope->resolveDeskFacilityId();
        } catch (\Throwable) {
            return self::BACKUP_FACILITY_ID;
        }
    }

    /** The fixed sentinel facility backup config/run rows are written to (M4). */
    public function facilityId(): int
    {
        return self::BACKUP_FACILITY_ID;
    }

    /**
     * Facility ids to search when reading `admin_hub_backup_run` history/schedule
     * state: the current global sentinel plus (for back-compat) whatever facility
     * pre-M4 code would have resolved to on this install.
     *
     * @return array{0: int, 1: int}
     */
    public function backupFacilityIdsForRead(): array
    {
        return [self::BACKUP_FACILITY_ID, $this->legacyBackupFacilityId()];
    }

    /**
     * Try to claim a short-lived exclusive lock so two backup runs (e.g. the
     * logged-in heartbeat and the OS-scheduled worker firing at the same minute)
     * never dump/encrypt concurrently onto the same target directory (M3).
     *
     * Same compare-and-swap pattern as VisitScopeService::claimMaintenanceLock()
     * (SCALE-1.3): take over an expired lock or insert a fresh one, both stamped
     * with a random owner token, then read back the owner — we won iff it is
     * still ours. Fails OPEN (returns a synthetic token) if the lock table isn't
     * installed yet, so a backup on an un-upgraded install still runs.
     *
     * @return string|null the owner token to release with, or null if another run holds it
     */
    private function claimBackupLock(string $lockKey, int $ttlSeconds): ?string
    {
        try {
            $live = QueryUtils::querySingleRow(
                'SELECT (locked_until > NOW()) AS live FROM new_clinic_maintenance_lock WHERE lock_key = ?',
                [$lockKey]
            );
            if (is_array($live) && (int) ($live['live'] ?? 0) === 1) {
                return null;
            }

            $token = bin2hex(random_bytes(16));
            sqlStatement(
                'UPDATE new_clinic_maintenance_lock
                 SET locked_until = DATE_ADD(NOW(), INTERVAL ? SECOND), owner_token = ?
                 WHERE lock_key = ? AND locked_until < NOW()',
                [$ttlSeconds, $token, $lockKey]
            );
            sqlStatement(
                'INSERT IGNORE INTO new_clinic_maintenance_lock (lock_key, locked_until, owner_token)
                 VALUES (?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?)',
                [$lockKey, $ttlSeconds, $token]
            );
            $row = QueryUtils::querySingleRow(
                'SELECT owner_token FROM new_clinic_maintenance_lock WHERE lock_key = ?',
                [$lockKey]
            );

            return (is_array($row) && (string) ($row['owner_token'] ?? '') === $token) ? $token : null;
        } catch (\Throwable) {
            // Lock table missing (pre-upgrade install) — degrade to always-run
            // rather than silently never-run. releaseBackupLock() no-ops for this.
            return 'unavailable';
        }
    }

    /**
     * Release a lock claimed by claimBackupLock(), only if we still hold it.
     *
     * Backdates `locked_until` by a second rather than setting it to exactly
     * NOW(): `DATETIME`/`NOW()` are 1-second resolution, and the re-claim CAS
     * (`WHERE locked_until < NOW()`) needs a STRICTLY earlier timestamp — a
     * release-then-immediate-reclaim landing in the same wall-clock second
     * would otherwise tie (`locked_until = NOW()`, neither `<` nor free) and
     * the reclaim would wrongly lose to a lock nothing still holds.
     */
    private function releaseBackupLock(string $lockKey, ?string $token): void
    {
        if ($token === null || $token === 'unavailable') {
            return;
        }
        try {
            sqlStatement(
                "UPDATE new_clinic_maintenance_lock
                 SET locked_until = DATE_SUB(NOW(), INTERVAL 1 SECOND)
                 WHERE lock_key = ? AND owner_token = ?",
                [$lockKey, $token]
            );
        } catch (\Throwable) {
            // best-effort
        }
    }

    /**
     * Perform a real encrypted backup, recording its own run row through the
     * running → ok/failed lifecycle.
     *
     * @return array<string, mixed>
     */
    public function runBackup(int $facilityId, int $actorUserId): array
    {
        if (!AclMain::aclCheckCore('admin', 'super')) {
            throw new \RuntimeException('Backup requires OpenEMR administrator (super) access', 403);
        }
        if (!$this->isNativeEnabled($facilityId)) {
            throw new \RuntimeException('Native backup is not enabled for this clinic', 403);
        }

        return $this->performBackup(self::BACKUP_FACILITY_ID, $actorUserId);
    }

    /**
     * Cron/worker entry point (scripts/backup-scheduled.php, scripts/run-jobs.php,
     * and the tab-shell heartbeat via scripts/backup-service.php — BACKUP-H1: all
     * three call this SAME method, no copy-pasted due-check/run logic). No
     * interactive ACL — the trust boundary is server-side execution. Runs only
     * when native backup is on AND a backup is due per `backup_frequency_days`.
     * Facility is ignored on purpose (M4) — a database backup is whole-DB, and a
     * worker has no session to resolve one from anyway (repo gotcha).
     *
     * @return array<string, mixed>
     */
    public function runScheduledBackup(int $facilityId): array
    {
        if (!$this->isNativeEnabled($facilityId)) {
            return ['status' => 'skipped', 'reason' => 'native_backup_disabled'];
        }
        $due = $this->dueForBackup($facilityId);
        if (empty($due['due'])) {
            return ['status' => 'skipped', 'reason' => 'not_due', 'schedule' => $due];
        }

        return $this->performBackup(self::BACKUP_FACILITY_ID, 0);
    }

    /** Is the separate site-files backup switched on (design §3b)? */
    public function isFilesBackupEnabled(int $facilityId): bool
    {
        return $this->config->getInt('backup_include_site_files', 0, self::BACKUP_FACILITY_ID) === 1;
    }

    /**
     * Run the SEPARATE site-files backup (design §3b): an incremental, per-file
     * encrypted mirror of the documents tree. Interactive path — super-admin only.
     *
     * @return array<string, mixed>
     */
    public function runFilesBackup(int $facilityId, int $actorUserId): array
    {
        if (!AclMain::aclCheckCore('admin', 'super')) {
            throw new \RuntimeException('Backup requires OpenEMR administrator (super) access', 403);
        }
        if (!$this->isNativeEnabled($facilityId)) {
            throw new \RuntimeException('Native backup is not enabled for this clinic', 403);
        }
        if (!$this->isFilesBackupEnabled($facilityId)) {
            throw new \RuntimeException('Site-files backup is not enabled for this clinic', 403);
        }

        return $this->performFilesBackup(self::BACKUP_FACILITY_ID, $actorUserId);
    }

    /**
     * Cron/worker/heartbeat entry for the site-files backup (same three-caller,
     * one-method shape as runScheduledBackup() — BACKUP-H1). Independent
     * "separate entity" cadence: due-checked against the last successful *files*
     * run (kind='files'), so the DB and the files each run on their own schedule.
     *
     * @return array<string, mixed>
     */
    public function runScheduledFilesBackup(int $facilityId): array
    {
        if (!$this->isNativeEnabled($facilityId) || !$this->isFilesBackupEnabled($facilityId)) {
            return ['status' => 'skipped', 'reason' => 'files_backup_disabled'];
        }
        $due = $this->dueForBackup($facilityId, 'files');
        if (empty($due['due'])) {
            return ['status' => 'skipped', 'reason' => 'not_due', 'schedule' => $due];
        }

        return $this->performFilesBackup(self::BACKUP_FACILITY_ID, 0);
    }

    /**
     * Is a scheduled backup due? Compares the last successful run to
     * `backup_frequency_days` (0 = automatic backups off).
     *
     * @return array<string, mixed>
     */
    public function dueForBackup(int $facilityId, string $kind = 'db'): array
    {
        $kind = $kind === 'files' ? 'files' : 'db';
        // M4: config lives at facility 0; ClinicConfigService::get() already falls
        // back facility→global(0)→reader-facility, so a pre-M4 install that saved
        // this under the old resolved facility is still found without extra code.
        $freq = $this->config->getInt('backup_frequency_days', 0, self::BACKUP_FACILITY_ID);
        if ($freq <= 0) {
            return ['scheduled' => false, 'due' => false, 'frequency_days' => 0];
        }
        $facilityIds = $this->backupFacilityIdsForRead();
        $row = QueryUtils::querySingleRow(
            "SELECT finished_at FROM admin_hub_backup_run
             WHERE facility_id IN (?, ?) AND kind = ? AND status = 'ok' AND finished_at IS NOT NULL
             ORDER BY id DESC LIMIT 1",
            [$facilityIds[0], $facilityIds[1], $kind]
        );
        $last = is_array($row) ? (string) ($row['finished_at'] ?? '') : '';
        if ($last === '') {
            return ['scheduled' => true, 'due' => true, 'frequency_days' => $freq, 'last_ok' => null, 'age_days' => null];
        }
        $ageDays = (int) floor((time() - (int) strtotime($last)) / 86400);

        return [
            'scheduled' => true,
            'due' => $ageDays >= $freq,
            'frequency_days' => $freq,
            'last_ok' => $last,
            'age_days' => $ageDays,
        ];
    }

    /**
     * The actual backup work — no ACL/enable gate (callers gate). Manages its own
     * run row through running → ok/failed.
     *
     * @return array<string, mixed>
     */
    private function performBackup(int $facilityId, int $actorUserId): array
    {
        if (!function_exists('exec')) {
            throw new \RuntimeException('Server backup is unavailable (shell execution disabled)', 500);
        }

        // M2 — a real clinic DB dump/gzip/encrypt can run well past a web
        // request's default execution limit; never let PHP kill it mid-archive
        // (a partial .enc file is worse than no file — it looks like a backup).
        @set_time_limit(0);

        $startedAt = date('Y-m-d H:i:s');
        $runId = (int) QueryUtils::sqlInsert(
            "INSERT INTO admin_hub_backup_run (facility_id, kind, started_at, status, actor_id, message)
             VALUES (?, 'db', ?, 'running', ?, ?)",
            [$facilityId, $startedAt, $actorUserId > 0 ? $actorUserId : null, 'Native encrypted backup started']
        );

        // M3 — a manual "Run now" click and the OS-scheduled worker (or the
        // heartbeat) can land in the same minute; without a lock both would
        // mysqldump/encrypt onto the same target directory at once.
        $lockToken = $this->claimBackupLock(self::LOCK_KEY_DB, self::LOCK_TTL_DB_SECONDS);
        if ($lockToken === null) {
            $message = 'Backup failed: another database backup is already running';
            QueryUtils::sqlStatementThrowException(
                "UPDATE admin_hub_backup_run SET status = 'failed', finished_at = ?, message = ? WHERE id = ?",
                [date('Y-m-d H:i:s'), $message, $runId]
            );
            throw new \RuntimeException($message, 409);
        }

        $tmpDir = null;
        try {
            $targetDir = $this->resolveTargetDir($facilityId);
            [$dumpPath, $tmpDir] = $this->dumpDatabase();

            if ((int) @filesize($dumpPath) <= 0) {
                throw new \RuntimeException('Backup produced an empty database dump');
            }

            // Compress first (SQL text gzips ~10x) so encryption stays in memory
            // for realistically-sized clinic DBs; wipe the plaintext dump.
            $gzPath = $dumpPath . '.gz';
            $this->gzipStream($dumpPath, $gzPath);
            $this->secureDelete($dumpPath);

            $gzSize = (int) @filesize($gzPath);
            if ($gzSize <= 0) {
                throw new \RuntimeException('Backup compression failed');
            }
            if ($gzSize > self::MAX_ENCRYPT_BYTES) {
                $this->secureDelete($gzPath);
                throw new \RuntimeException(
                    'Compressed backup is too large for in-app encryption ('
                    . $this->humanSize($gzSize) . '). Use the VPS replica or stock backup.'
                );
            }

            // SEC6 §3 — encrypt BEFORE anything persists, then wipe the plaintext .gz.
            $ciphertext = (new CryptoGen())->encryptStandard((string) file_get_contents($gzPath));
            $this->secureDelete($gzPath);
            if ($ciphertext === '') {
                throw new \RuntimeException('Backup encryption failed');
            }

            $archiveName = self::ARCHIVE_PREFIX . $this->siteTag() . '-' . gmdate('Ymd-His') . '.sql.gz' . self::ARCHIVE_SUFFIX;
            $archivePath = rtrim($targetDir, '/\\') . DIRECTORY_SEPARATOR . $archiveName;
            if (file_put_contents($archivePath, $ciphertext) === false) {
                throw new \RuntimeException('Could not write the backup archive to the target directory');
            }
            @chmod($archivePath, 0600);
            $size = strlen($ciphertext);

            QueryUtils::sqlStatementThrowException(
                "UPDATE admin_hub_backup_run
                 SET status = 'ok', finished_at = ?, file_path = ?, size_bytes = ?, message = ?
                 WHERE id = ?",
                [
                    date('Y-m-d H:i:s'),
                    $archivePath,
                    $size,
                    'Encrypted database backup (' . $this->humanSize($size) . ')',
                    $runId,
                ]
            );

            $pruned = $this->pruneOldArchives($targetDir, $facilityId);
            $this->cleanupTempDir($tmpDir);

            EventAuditLogger::getInstance()->newEvent(
                'admin_hub.backup_run',
                $_SESSION['authUser'] ?? 'system',
                $_SESSION['authProvider'] ?? 'default',
                1,
                'native_backup ok run_id=' . $runId . ' size=' . $size . ' pruned=' . $pruned . ' uid=' . $actorUserId
            );

            return [
                'run_id' => $runId,
                'status' => 'ok',
                'size_bytes' => $size,
                'file_path' => $archivePath,
                'pruned' => $pruned,
            ];
        } catch (\Throwable $e) {
            if ($tmpDir !== null) {
                $this->cleanupTempDir($tmpDir);
            }
            $message = 'Backup failed: ' . $e->getMessage();
            QueryUtils::sqlStatementThrowException(
                "UPDATE admin_hub_backup_run SET status = 'failed', finished_at = ?, message = ? WHERE id = ?",
                [date('Y-m-d H:i:s'), mb_substr($message, 0, 480), $runId]
            );
            throw new \RuntimeException($message, $e->getCode() >= 400 && $e->getCode() < 600 ? (int) $e->getCode() : 500);
        } finally {
            $this->releaseBackupLock(self::LOCK_KEY_DB, $lockToken);
        }
    }

    /**
     * The site-files backup work (design §3b) — no ACL/enable gate (callers gate).
     * Incrementally mirrors the documents tree into `<target>/nc-files-<site>/`,
     * encrypting each file individually before it persists (SEC6 §3). Manages its
     * own `kind='files'` run row through running → ok/failed.
     *
     * @return array<string, mixed>
     */
    private function performFilesBackup(int $facilityId, int $actorUserId): array
    {
        // M2 — a first-run mirror of a large documents tree can take a long
        // time; never let PHP's execution limit cut it off mid-copy.
        @set_time_limit(0);

        $startedAt = date('Y-m-d H:i:s');
        $runId = (int) QueryUtils::sqlInsert(
            "INSERT INTO admin_hub_backup_run (facility_id, kind, started_at, status, actor_id, message)
             VALUES (?, 'files', ?, 'running', ?, ?)",
            [$facilityId, $startedAt, $actorUserId > 0 ? $actorUserId : null, 'Site-files backup started']
        );

        // M3 — same concurrency guard as the DB backup, its own lock key so a
        // DB run and a files run (different kinds) never block each other.
        $lockToken = $this->claimBackupLock(self::LOCK_KEY_FILES, self::LOCK_TTL_FILES_SECONDS);
        if ($lockToken === null) {
            $message = 'Site-files backup failed: another site-files backup is already running';
            QueryUtils::sqlStatementThrowException(
                "UPDATE admin_hub_backup_run SET status = 'failed', finished_at = ?, message = ? WHERE id = ?",
                [date('Y-m-d H:i:s'), $message, $runId]
            );
            throw new \RuntimeException($message, 409);
        }

        try {
            $targetDir = $this->resolveTargetDir($facilityId);
            $mirrorDir = rtrim($targetDir, '/\\') . DIRECTORY_SEPARATOR . 'nc-files-' . $this->siteTag();
            if (!is_dir($mirrorDir) && !@mkdir($mirrorDir, 0700, true) && !is_dir($mirrorDir)) {
                throw new \RuntimeException('Could not create the site-files backup directory');
            }
            $docsRoot = $this->documentsRoot();
            if (!is_dir($docsRoot)) {
                throw new \RuntimeException('Site documents directory not found: ' . $docsRoot);
            }

            $stats = $this->mirrorDocuments($docsRoot, $mirrorDir);

            $message = 'Site files: ' . $stats['copied'] . ' new/changed, ' . $stats['skipped']
                . ' unchanged, ' . $this->humanSize($stats['bytes']) . ' this run'
                . ($stats['too_large'] > 0 ? ' (' . $stats['too_large'] . ' too large — skipped)' : '');

            QueryUtils::sqlStatementThrowException(
                "UPDATE admin_hub_backup_run
                 SET status = 'ok', finished_at = ?, file_path = ?, size_bytes = ?, message = ?
                 WHERE id = ?",
                [date('Y-m-d H:i:s'), $mirrorDir, $stats['bytes'], $message, $runId]
            );

            EventAuditLogger::getInstance()->newEvent(
                'admin_hub.backup_run',
                $_SESSION['authUser'] ?? 'system',
                $_SESSION['authProvider'] ?? 'default',
                1,
                'native_files_backup ok run_id=' . $runId . ' copied=' . $stats['copied']
                . ' bytes=' . $stats['bytes'] . ' uid=' . $actorUserId
            );

            return [
                'run_id' => $runId,
                'status' => 'ok',
                'kind' => 'files',
                'copied' => $stats['copied'],
                'skipped' => $stats['skipped'],
                'too_large' => $stats['too_large'],
                'size_bytes' => $stats['bytes'],
                'file_path' => $mirrorDir,
            ];
        } catch (\Throwable $e) {
            $message = 'Site-files backup failed: ' . $e->getMessage();
            QueryUtils::sqlStatementThrowException(
                "UPDATE admin_hub_backup_run SET status = 'failed', finished_at = ?, message = ? WHERE id = ?",
                [date('Y-m-d H:i:s'), mb_substr($message, 0, 480), $runId]
            );
            throw new \RuntimeException($message, $e->getCode() >= 400 && $e->getCode() < 600 ? (int) $e->getCode() : 500);
        } finally {
            $this->releaseBackupLock(self::LOCK_KEY_FILES, $lockToken);
        }
    }

    /**
     * Walk the documents tree and mirror each file as an individually-encrypted
     * `<rel-path>.enc` under $mirrorDir, skipping files whose mirror copy is already
     * newer than the source (incremental). Excludes the module's own backup outputs,
     * the temp scratch dir, and — critically — the encryption key dir (never
     * co-locate the key with the data it decrypts). A single oversized file is
     * reported (`too_large`), never silently dropped.
     *
     * @return array{copied: int, skipped: int, too_large: int, bytes: int}
     */
    private function mirrorDocuments(string $docsRoot, string $mirrorDir): array
    {
        $copied = 0;
        $skipped = 0;
        $tooLarge = 0;
        $bytes = 0;
        $crypto = new CryptoGen();
        $rootNorm = rtrim(str_replace('\\', '/', $docsRoot), '/');

        $relOf = static function (string $absPath) use ($rootNorm): string {
            return ltrim(substr(str_replace('\\', '/', $absPath), strlen($rootNorm)), '/');
        };
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveCallbackFilterIterator(
                new \RecursiveDirectoryIterator($docsRoot, \FilesystemIterator::SKIP_DOTS),
                fn (\SplFileInfo $current): bool => !$this->isExcludedRelPath($relOf($current->getPathname()))
            ),
            \RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($iterator as $fileInfo) {
            if (!$fileInfo->isFile()) {
                continue;
            }
            $src = $fileInfo->getPathname();
            $rel = $relOf($src);
            if ($rel === '') {
                continue;
            }
            $destPath = rtrim($mirrorDir, '/\\') . DIRECTORY_SEPARATOR
                . str_replace('/', DIRECTORY_SEPARATOR, $rel) . self::ARCHIVE_SUFFIX;

            // Incremental: mirror already at/newer than source → nothing to do.
            if (is_file($destPath) && (int) @filemtime($destPath) >= (int) @filemtime($src)) {
                $skipped++;
                continue;
            }
            $size = (int) @filesize($src);
            if ($size > self::MAX_ENCRYPT_BYTES) {
                $tooLarge++;
                continue;
            }
            $plain = @file_get_contents($src);
            if ($plain === false) {
                $skipped++;
                continue;
            }
            // SEC6 §3 — encrypt before it persists to the (possibly removable/cloud) target.
            $cipher = $crypto->encryptStandard($plain);
            unset($plain);
            if ($cipher === '') {
                $skipped++;
                continue;
            }
            $destDir = \dirname($destPath);
            if (!is_dir($destDir) && !@mkdir($destDir, 0700, true) && !is_dir($destDir)) {
                $skipped++;
                continue;
            }
            if (@file_put_contents($destPath, $cipher) === false) {
                $skipped++;
                continue;
            }
            @chmod($destPath, 0600);
            $copied++;
            $bytes += \strlen($cipher);
        }

        return ['copied' => $copied, 'skipped' => $skipped, 'too_large' => $tooLarge, 'bytes' => $bytes];
    }

    /**
     * Paths (relative to the documents root) the files backup must never copy:
     * our own backup outputs (avoid backing up backups), the temp scratch dir,
     * transient export files (SCALE-2.3 — disposable, regenerable, and SEC-6 says
     * they expire in 24h; backing them up would extend PHI retention), and
     * — critically — the encryption key dir. Anchored to the documents root so an
     * unrelated ancestor segment (e.g. an install under a "temp" path) can't
     * accidentally exclude the whole tree.
     */
    private function isExcludedRelPath(string $rel): bool
    {
        $rel = ltrim(str_replace('\\', '/', $rel), '/');

        return (bool) preg_match('~^(nc_backups|temp|nc_report_exports|nc_export_jobs)(/|$)~i', $rel)
            || (bool) preg_match('~^nc-files-[^/]*(/|$)~i', $rel)
            || (bool) preg_match('~^logs_and_misc/methods(/|$)~i', $rel);
    }

    private function documentsRoot(): string
    {
        return rtrim((string) ($GLOBALS['OE_SITE_DIR'] ?? ''), '/\\')
            . DIRECTORY_SEPARATOR . 'documents';
    }

    /**
     * Verify a backup is actually restorable: decrypt it and confirm the first
     * bytes read as a real SQL dump. A backup you've never test-restored is a
     * hope, not a guarantee — this is the cheap, honest version of that check.
     * Reads only the head (memory-safe), super-admin only.
     *
     * @return array{verified: bool, note: string, run_id: int}
     */
    public function verifyBackup(int $runId): array
    {
        if (!AclMain::aclCheckCore('admin', 'super')) {
            throw new \RuntimeException('Backup verification requires OpenEMR administrator (super) access', 403);
        }
        [$facilityId, $legacyFacilityId] = $this->backupFacilityIdsForRead();

        // H2: BOTH branches must filter kind='db' — without it, when the latest
        // OK run for this facility happens to be a FILES run, file_path points at
        // the nc-files-<site>/ MIRROR DIRECTORY (not a single archive), and the
        // is_file() check below correctly (but confusingly) reports "missing".
        $row = $runId > 0
            ? QueryUtils::querySingleRow(
                "SELECT id, file_path FROM admin_hub_backup_run
                 WHERE id = ? AND facility_id IN (?, ?) AND kind = 'db'",
                [$runId, $facilityId, $legacyFacilityId]
            )
            : QueryUtils::querySingleRow(
                "SELECT id, file_path FROM admin_hub_backup_run
                 WHERE facility_id IN (?, ?) AND kind = 'db' AND status = 'ok' AND file_path IS NOT NULL
                 ORDER BY id DESC LIMIT 1",
                [$facilityId, $legacyFacilityId]
            );
        if (!is_array($row)) {
            return ['verified' => false, 'note' => 'No completed backup to verify yet.', 'run_id' => 0];
        }
        $resolvedRunId = (int) ($row['id'] ?? 0);
        $path = (string) ($row['file_path'] ?? '');
        if ($path === '' || !is_file($path)) {
            return ['verified' => false, 'note' => 'The backup file is missing from disk.', 'run_id' => $resolvedRunId];
        }
        if ((int) @filesize($path) > self::MAX_ENCRYPT_BYTES) {
            return [
                'verified' => false,
                'note' => 'Too large to verify in-app — verify manually by decrypting.',
                'run_id' => $resolvedRunId,
            ];
        }

        @ini_set('memory_limit', '512M');
        $plaintextGz = (new CryptoGen())->decryptStandard((string) file_get_contents($path));
        if ($plaintextGz === false || $plaintextGz === '') {
            return [
                'verified' => false,
                'note' => 'Could not decrypt — the encryption key may have changed since this backup.',
                'run_id' => $resolvedRunId,
            ];
        }

        // Read only the decompressed head (memory-safe) and check for SQL markers.
        $tmp = tempnam(sys_get_temp_dir(), 'ncvg');
        file_put_contents($tmp, $plaintextGz);
        unset($plaintextGz);
        $head = '';
        $gh = gzopen($tmp, 'rb');
        if ($gh !== false) {
            $head = (string) gzread($gh, 8192);
            gzclose($gh);
        }
        @unlink($tmp);

        $looksLikeSql = str_contains($head, 'CREATE TABLE')
            || str_contains($head, 'INSERT INTO')
            || str_contains($head, 'MySQL dump')
            || str_contains($head, '-- Server version');

        if ($looksLikeSql) {
            // H3(i) — the setup checklist's "Backup tested" item and the honest
            // "self-reported" chip labeling both key off THIS timestamp: a run is
            // only ever shown as a trustworthy green backup once it has actually
            // been decrypted and read back as a real SQL dump, not merely marked ok.
            try {
                QueryUtils::sqlStatementThrowException(
                    "UPDATE admin_hub_backup_run SET verified_at = ? WHERE id = ?",
                    [date('Y-m-d H:i:s'), $resolvedRunId]
                );
            } catch (\Throwable) {
                // Column may not exist yet on an un-upgraded install — verify
                // result itself is still accurate, just won't be remembered.
            }

            return ['verified' => true, 'note' => 'Decrypted and readable as a database dump.', 'run_id' => $resolvedRunId];
        }

        return ['verified' => false, 'note' => 'Decrypted, but the contents do not look like a database dump.', 'run_id' => $resolvedRunId];
    }

    /**
     * Recovery-key status (design §12). The drive key that decrypts every `.enc`
     * backup lives as a handful of small files in the site's methods/ dir — on the
     * SAME disk as the data. If that disk dies (the very disaster backups exist
     * for), the key dies with it and the cloud/USB `.enc` files become unrecoverable
     * noise. This reports whether those key files exist and whether the admin has
     * ever exported a copy off-box. Non-secret (no key material) — safe in the
     * health payload.
     *
     * @return array<string, mixed>
     */
    public function recoveryKeyStatus(): array
    {
        $dir = $this->methodsDir();
        $files = $this->keyFiles($dir);
        $exportedAt = trim((string) ($this->config->get('backup_key_exported_at', '') ?? ''));

        return [
            'present' => $files !== [],
            'key_files' => array_values(array_map('basename', $files)),
            'methods_dir' => $dir,
            'exported_at' => $exportedAt !== '' ? $exportedAt : null,
            // The risk we want to nag about: keys exist but were never saved off-box.
            'export_warning' => $files !== [] && $exportedAt === '',
        ];
    }

    /**
     * Export the recovery key off-box as a downloadable ZIP (design §12).
     *
     * This IS the crown jewels — anyone with this bundle AND a backup can read all
     * PHI — so it is super-admin only, audited, and the UI warns to store it
     * SEPARATELY from the backups. The secret never lands on disk server-side (zip
     * is built in the temp dir and wiped); it streams to the admin's browser and we
     * record only the fact + timestamp of the export.
     *
     * BACKUP-C1: the drive-key files alone are NOT enough to decrypt a backup on a
     * replacement machine. CryptoGen.php collectDriveKey() (~:523-537) shows that for
     * KeyVersion >= 5 (KeyVersion.php usesLegacyStorage(), ~:71-74 — this site is on
     * "seven") the file on disk is ITSELF encrypted with the DATABASE key set, which
     * only lives in the `keys` SQL table — inside the encrypted dump this very bundle
     * exists to open. So the bundle must also carry the `keys` rows the drive files
     * depend on, or it is undecryptable noise on a fresh install. See
     * requiredDatabaseKeyNames()/fetchDatabaseKeyRows() below.
     *
     * @return array{filename: string, content_base64: string, file_count: int, warnings: list<string>}
     */
    public function exportRecoveryKey(int $actorUserId): array
    {
        if (!AclMain::aclCheckCore('admin', 'super')) {
            throw new \RuntimeException('Exporting the recovery key requires OpenEMR administrator (super) access', 403);
        }
        if (!class_exists(\ZipArchive::class)) {
            throw new \RuntimeException('ZIP support is unavailable on this server; copy the methods/ folder manually', 500);
        }
        $dir = $this->methodsDir();
        $files = $this->keyFiles($dir);
        if ($files === []) {
            throw new \RuntimeException('No encryption key files were found to export', 404);
        }

        // BACKUP-C1 — collect the `keys`-table rows the drive files above depend on
        // to ever be decrypted again. BACKUP-C2: an install can have MULTIPLE key
        // versions on disk at once (e.g. after an upgrade rotated keys but old drive
        // files are still referenced by old backups), and any one version's row(s)
        // can legitimately be missing (rotated out, manually cleaned up, etc.) without
        // the OTHER versions' key material being any less real or useful. So this only
        // fails loudly when the bundle would carry literally NO usable database key
        // material for ANY version that needs one — that bundle really would be inert
        // noise. A partial gap just downgrades to a warning: export whatever crown
        // jewels ARE present rather than letting one missing row sink the whole export.
        $dbKeyNames = $this->requiredDatabaseKeyNames($files);
        $dbKeyRows = $this->fetchDatabaseKeyRows($dbKeyNames);
        $gaps = $this->summarizeKeyMaterialGaps($dbKeyNames, $dbKeyRows);
        if ($gaps['fatal']) {
            throw new \RuntimeException(
                'The recovery-key bundle would carry NO usable database key material for any drive key file '
                . 'that needs it (checked the `keys` table for: ' . implode(', ', $dbKeyNames) . ') — the bundle '
                . 'would be completely useless for restoring on a machine without the original database. '
                . 'Check the `keys` table / database connection.'
            );
        }
        $keyWarnings = $gaps['warnings'];

        $tmpZip = tempnam(sys_get_temp_dir(), 'nckey');
        if ($tmpZip === false) {
            throw new \RuntimeException('Could not allocate a temporary file for the key bundle');
        }
        $zip = new \ZipArchive();
        // OVERWRITE truncates the file tempnam() just created (no orphaned temp file).
        if ($zip->open($tmpZip, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            @unlink($tmpZip);
            throw new \RuntimeException('Could not build the recovery-key bundle');
        }
        $zip->addFromString('READ_ME_FIRST.txt', $this->keyReadme());
        // BACKUP-C1 — the database-key rows the drive files need to be readable again.
        // JSON, not a raw SQL dump: small, dependency-free to parse in the decrypt CLI.
        $zip->addFromString('db-keys.json', (string) json_encode($dbKeyRows, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        // BACKUP-C2 — a partial-material bundle still gets exported (see above), but
        // whoever eventually unzips this in an emergency needs to know up front, not
        // discover it only when a decrypt fails. Only written when there's something
        // to say.
        if ($keyWarnings !== []) {
            $zip->addFromString('WARNINGS.txt', "This recovery-key bundle is INCOMPLETE:\n\n"
                . implode("\n\n", $keyWarnings) . "\n\nEverything else in this bundle is still valid — the "
                . "gap above only affects the specific drive key file(s) named. Re-export a fresh bundle once "
                . "the underlying `keys` table issue is fixed.\n");
        }
        // Crown jewels: a silently-dropped key file yields a bundle that looks fine
        // but cannot restore. addFile defers the read to close(), so verify BOTH the
        // add and the final write succeeded for every key file.
        $added = 0;
        foreach ($files as $path) {
            if ($zip->addFile($path, 'methods/' . basename($path))) {
                $added++;
            }
        }
        $closed = $zip->close();
        if (!$closed || $added !== count($files)) {
            $this->secureDelete($tmpZip);
            throw new \RuntimeException(
                'The recovery-key bundle is incomplete — a key file could not be read. '
                . 'Check permissions on the methods/ folder and try again.'
            );
        }

        $content = (string) file_get_contents($tmpZip);
        $this->secureDelete($tmpZip);
        if ($content === '') {
            throw new \RuntimeException('The recovery-key bundle came out empty');
        }

        $this->config->set('backup_key_exported_at', date('Y-m-d H:i:s'), 0);
        EventAuditLogger::getInstance()->newEvent(
            'admin_hub.recovery_key_exported',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            1,
            'recovery_key_exported files=' . count($files) . ' db_keys=' . count($dbKeyRows)
                . ' warnings=' . count($keyWarnings) . ' uid=' . $actorUserId
        );

        return [
            'filename' => 'openemr-recovery-key-' . $this->siteTag() . '-' . date('Ymd-His') . '.zip',
            'content_base64' => base64_encode($content),
            'file_count' => count($files),
            'warnings' => $keyWarnings,
        ];
    }

    /**
     * Work out which `keys`-table rows the drive-key files depend on to ever be
     * decrypted again (BACKUP-C1; docblock corrected under BACKUP-C2).
     *
     * KeyVersion.php usesLegacyStorage() (~:71-74): versions 1-4 store the drive key
     * as plain base64 on disk — self-sufficient, no database dependency. Versions 5+
     * store it ENCRYPTED, using encryptStandard()/decryptStandard() with
     * KeySource::DATABASE (CryptoGen.php createDriveKey() ~:548-572, collectDriveKey()
     * ~:523-537). Those, in turn, ALWAYS need a PAIR of database keys for a given
     * version, not just one: coreEncrypt()/coreDecrypt() (~:167-168, ~:239-240) each
     * call collectCryptoKey($keyVersion, "a", ...) for the AES key AND
     * collectCryptoKey($keyVersion, "b", ...) for the HMAC key — see collectCryptoKey()
     * ~:448-466, which derives the row name as `$keyVersion->toString() . $sub`. So
     * decrypting the drive-key file "sevena" needs BOTH the "sevena" AND "sevenb"
     * `keys` rows together — not just the row matching its own filename. (The reason
     * the original code here "just worked" is that a normal methods/ folder always
     * has BOTH the "a" and "b" drive files for a version side by side, so looping over
     * files and echoing each one's own basename happened to recover the full pair by
     * accident — that coincidence is what "the union works" meant before this fix. It
     * silently breaks the moment only one half of a pair is present on disk, which is
     * exactly the kind of partial state BACKUP-C2 makes this method resilient to.)
     *
     * @param list<string> $files absolute paths of the drive-key files
     * @return list<string> `keys.name` values the bundle must carry (both halves of
     *                      the pair for every non-legacy version referenced)
     */
    private function requiredDatabaseKeyNames(array $files): array
    {
        $names = [];
        foreach ($this->presentNonLegacyKeyVersions($files) as $keyVersion) {
            $names[] = $keyVersion->toString() . 'a';
            $names[] = $keyVersion->toString() . 'b';
        }

        return array_values(array_unique($names));
    }

    /**
     * Non-legacy (>=5) KeyVersions referenced by any of the given drive-key file
     * basenames, de-duplicated. Pulled out of requiredDatabaseKeyNames() so
     * exportRecoveryKey() can reason about "which versions are in play" without
     * caring about the 'a'/'b' pairing detail.
     *
     * @param list<string> $files absolute paths of the drive-key files
     * @return list<KeyVersion>
     */
    private function presentNonLegacyKeyVersions(array $files): array
    {
        $versions = [];
        foreach ($files as $path) {
            $base = basename($path);
            foreach (KeyVersion::cases() as $keyVersion) {
                if (!$keyVersion->usesLegacyStorage() && str_starts_with($base, $keyVersion->toString())) {
                    $versions[$keyVersion->value] = $keyVersion;
                    break;
                }
            }
        }

        return array_values($versions);
    }

    /**
     * BACKUP-C2: decide whether a gap between the required `keys` row names and the
     * rows actually found is fatal (the bundle would be completely useless) or just
     * a warning (the bundle is still worth exporting, minus the specific version(s)
     * affected). Pure/DB-free on purpose so this decision is unit-testable without a
     * `keys` table fixture — the caller does the actual SELECT.
     *
     * @param list<string> $requiredNames every `keys.name` the drive files need
     * @param list<array{name: string, value: string}> $foundRows rows actually read back from the `keys` table
     * @return array{fatal: bool, warnings: list<string>}
     */
    private function summarizeKeyMaterialGaps(array $requiredNames, array $foundRows): array
    {
        $missing = array_values(array_diff($requiredNames, array_column($foundRows, 'name')));
        // Nothing required at all (all drive files are legacy/self-sufficient) is not
        // a gap. Requiring something but finding literally none of it IS fatal — that
        // bundle can never decrypt a single one of its own drive-key files. Anything
        // in between (found some, missing some) is a warning, not a failure — see
        // exportRecoveryKey()'s BACKUP-C2 comment for why.
        $fatal = $requiredNames !== [] && $foundRows === [];
        $warnings = [];
        if (!$fatal && $missing !== []) {
            $warnings[] = 'The `keys` table is missing row(s) for: ' . implode(', ', $missing)
                . '. The drive key file(s) that depend on those rows will NOT be decryptable from this bundle '
                . 'on a machine without the original database — everything else in this bundle is still good.';
        }

        return ['fatal' => $fatal, 'warnings' => $warnings];
    }

    /**
     * Read the `keys`-table rows required by requiredDatabaseKeyNames(). Uses the
     * *NoLog query path — same as CryptoGen.php's own collectDatabaseKey() — so raw
     * key material is never written into the audit `log` table.
     *
     * @param list<string> $names
     * @return list<array{name: string, value: string}>
     */
    private function fetchDatabaseKeyRows(array $names): array
    {
        if ($names === []) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($names), '?'));
        $rows = QueryUtils::fetchRecordsNoLog(
            "SELECT `name`, `value` FROM `keys` WHERE `name` IN ($placeholders)",
            $names
        );

        return array_map(
            static fn (array $r): array => ['name' => (string) $r['name'], 'value' => (string) $r['value']],
            $rows
        );
    }

    /** Site drive-key directory (CryptoGen reads keys from here). */
    private function methodsDir(): string
    {
        return rtrim((string) ($GLOBALS['OE_SITE_DIR'] ?? ''), '/\\')
            . DIRECTORY_SEPARATOR . 'documents'
            . DIRECTORY_SEPARATOR . 'logs_and_misc'
            . DIRECTORY_SEPARATOR . 'methods';
    }

    /**
     * Actual key files in methods/ (excludes README + dotfiles).
     *
     * @return list<string> absolute paths
     */
    private function keyFiles(string $dir): array
    {
        if (!is_dir($dir)) {
            return [];
        }
        $files = [];
        foreach (glob(rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . '*') ?: [] as $f) {
            $base = basename($f);
            if (is_file($f) && strcasecmp($base, 'README.md') !== 0 && $base[0] !== '.') {
                $files[] = $f;
            }
        }

        return $files;
    }

    private function keyReadme(): string
    {
        return "STORE THIS BUNDLE OFFLINE, SEPARATE FROM YOUR BACKUP FILES.\n"
            . "============================================================\n\n"
            . "OpenEMR — New Clinic BACKUP RECOVERY KEY\n"
            . "========================================\n\n"
            . "This bundle is the ONLY thing on earth that can turn your encrypted backup\n"
            . "files (the '.sql.gz.enc' / '.enc' files) back into readable patient data.\n"
            . "Without it, your backups are permanently unreadable — there is no password\n"
            . "reset, no support ticket, no \"forgot key\" option. Losing this bundle AND\n"
            . "your original machine at the same time means your backups are gone for good.\n\n"
            . "This bundle contains TWO different kinds of key material — you need BOTH:\n"
            . "  - 'methods/' folder: the drive keys (also on your original machine's disk).\n"
            . "  - 'db-keys.json': matching database key values. On versions 5 and up (this\n"
            . "    site is on version seven), the drive-key files are themselves LOCKED with\n"
            . "    a second key that lives only in the database — inside the very backup you\n"
            . "    are trying to open. This file breaks that chicken-and-egg problem so you\n"
            . "    do not need your original database to restore.\n\n"
            . "KEEP THIS BUNDLE SAFE, AND KEEP IT SEPARATE FROM YOUR BACKUPS.\n"
            . "Anyone who has BOTH this key bundle AND a backup file can read every\n"
            . "patient's data. Do NOT store this in the same folder (or same cloud\n"
            . "account) as your backups. Good places: a password manager, or a printed/\n"
            . "USB copy in a locked drawer off the clinic premises.\n\n"
            . "============================================================\n"
            . "HOW TO RESTORE ON A NEW / REPLACEMENT MACHINE\n"
            . "============================================================\n"
            . "Read this calmly, step by step. You do not need your old computer, your\n"
            . "old database, or any password you may have forgotten — this bundle plus\n"
            . "one encrypted backup file is everything you need.\n\n"
            . "What you need before you start:\n"
            . "  - This recovery-key bundle (the ZIP this file came from, or its unzipped folder).\n"
            . "  - One encrypted backup file (looks like 'nc-backup-...sql.gz.enc', or for a\n"
            . "    single restored document, a file ending in '.enc' from a 'nc-files-...' folder).\n"
            . "  - A computer with PHP 8.2+ and a FULL copy of this OpenEMR + New Clinic source tree\n"
            . "    (not just the module folder — the decrypt tool loads code from other parts of the\n"
            . "    repo too), laid out the same way as a normal checkout. It does NOT need to be set\n"
            . "    up or connected to any database yet.\n\n"
            . "Steps:\n"
            . "  1. Unzip this recovery-key bundle somewhere on the new machine, e.g.\n"
            . "     C:\\recovery-key\\ (or /home/you/recovery-key/ on Linux/Mac). You should see\n"
            . "     a 'methods' folder, a 'db-keys.json' file, and this README.\n"
            . "  2. Copy your encrypted backup file to the same machine, e.g.\n"
            . "     C:\\my-backup\\nc-backup-clinic-20260718-120000.sql.gz.enc\n"
            . "  3. Open a terminal (Command Prompt / PowerShell on Windows, Terminal on Mac/Linux)\n"
            . "     and go to the OpenEMR module's 'scripts' folder, e.g.:\n"
            . "       cd C:\\xampp\\htdocs\\openemr\\interface\\modules\\custom_modules\\oe-module-new-clinic\\scripts\n"
            . "  4. Run the decrypt tool, pointing it at your backup file, the unzipped\n"
            . "     recovery-key folder, and where you want the readable file to go:\n"
            . "       php backup-decrypt.php --in \"C:\\my-backup\\nc-backup-clinic-...sql.gz.enc\" ^\n"
            . "         --bundle \"C:\\recovery-key\" --out \"C:\\my-backup\\restored.sql.gz\"\n"
            . "     (On Mac/Linux use php backup-decrypt.php --in ... --bundle ... --out ..., same flags.)\n"
            . "     You do not need to add any memory-limit flag, even for a very large backup — the\n"
            . "     tool removes its own memory limit before it starts.\n"
            . "  5. If it says \"Decrypted OK\", you now have a plain '.sql.gz' file. Unzip it\n"
            . "     (gunzip / 7-Zip / \"Extract\") to get a plain '.sql' file — this is your\n"
            . "     full database, in plain readable text. Treat this file as carefully as\n"
            . "     the patient records themselves — delete it securely once you are done.\n"
            . "  6. Create a fresh, empty database on the new machine and load the .sql file\n"
            . "     into it with your database tool, e.g.:\n"
            . "       mysql -u root -p your_new_database_name < restored.sql\n"
            . "  7. Point a fresh OpenEMR installation's site config at that database, and copy\n"
            . "     the 'methods' folder from THIS bundle into the new site's\n"
            . "     sites/<your-site>/documents/logs_and_misc/methods/ folder (overwrite the\n"
            . "     freshly-generated ones) so future backups/restores keep working.\n"
            . "  8. Log in and spot-check: open a recent patient, a recent visit, and a recent\n"
            . "     payment. If those look right, the restore worked.\n\n"
            . "To restore ONE mirrored document (not the whole database), run the same command with\n"
            . "--in pointing at that one '.enc' file instead. The tool always just writes the raw\n"
            . "decrypted bytes to --out, whatever they are — for a database backup that is a\n"
            . "'.sql.gz' you gunzip yourself (step 5); for a mirrored document it is that document's\n"
            . "original bytes, ready to use as-is (rename it back to its real filename/extension).\n\n"
            . "If the tool prints an error, read it — it is written in plain English and says\n"
            . "what went wrong (wrong bundle, wrong backup file, missing key row, etc.). It\n"
            . "never guesses; it fails loudly rather than producing a corrupted restore.\n\n"
            . "The full, versioned procedure (with troubleshooting) lives in\n"
            . "Documentation/NewClinic/NEW_CLINIC_BACKUP_RESTORE_RUNBOOK.md in the OpenEMR\n"
            . "source — if you have that repository, read it too.\n\n"
            . "Exported " . date('Y-m-d H:i:s') . " from site '" . $this->siteTag() . "'.\n";
    }

    /**
     * mysqldump → temp plaintext file, credentials via a 0600 defaults-extra-file
     * that is deleted immediately after the dump. Returns [dumpPath, tmpDir].
     *
     * @return array{0: string, 1: string}
     */
    private function dumpDatabase(): array
    {
        $sqlconf = is_array($GLOBALS['sqlconf'] ?? null) ? $GLOBALS['sqlconf'] : [];
        $dbase = (string) ($sqlconf['dbase'] ?? '');
        if ($dbase === '') {
            throw new \RuntimeException('Database configuration is unavailable');
        }

        $tmpBase = rtrim((string) ($GLOBALS['temporary_files_dir'] ?? sys_get_temp_dir()), '/\\')
            . DIRECTORY_SEPARATOR . 'nc_backup_' . bin2hex(random_bytes(6));
        if (!@mkdir($tmpBase, 0700, true) && !is_dir($tmpBase)) {
            throw new \RuntimeException('Could not create a temporary backup directory');
        }

        $cnfPath = $tmpBase . DIRECTORY_SEPARATOR . 'my.cnf';
        $cnf = "[client]\n"
            . 'host=' . ($sqlconf['host'] ?? 'localhost') . "\n"
            . 'port=' . ($sqlconf['port'] ?? '3306') . "\n"
            . 'user=' . ($sqlconf['login'] ?? '') . "\n"
            . 'password=' . ($sqlconf['pass'] ?? '') . "\n";
        file_put_contents($cnfPath, $cnf);
        @chmod($cnfPath, 0600);

        $dumpPath = $tmpBase . DIRECTORY_SEPARATOR . 'db.sql';
        $errPath = $tmpBase . DIRECTORY_SEPARATOR . 'err.log';
        $bin = $this->resolveMysqldump();

        $cmd = escapeshellarg($bin)
            . ' --defaults-extra-file=' . escapeshellarg($cnfPath)
            . ' --single-transaction --routines --triggers --skip-comments '
            . escapeshellarg($dbase)
            . ' > ' . escapeshellarg($dumpPath)
            . ' 2> ' . escapeshellarg($errPath);

        $output = [];
        $rc = 0;
        exec($cmd, $output, $rc);
        $this->secureDelete($cnfPath); // credentials gone immediately

        if ($rc !== 0 || !is_file($dumpPath) || (int) @filesize($dumpPath) === 0) {
            $err = is_file($errPath) ? trim((string) file_get_contents($errPath)) : '';
            // Do not leak the full command; surface only mysqldump's own message tail.
            $errTail = $err !== '' ? mb_substr($err, -200) : ('exit code ' . $rc);
            throw new \RuntimeException('mysqldump failed (' . $errTail . ')');
        }

        return [$dumpPath, $tmpBase];
    }

    private function resolveMysqldump(): string
    {
        $configured = trim((string) ($this->config->get('backup_mysqldump_path', '') ?? ''));
        if ($configured !== '' && is_file($configured)) {
            return $configured;
        }
        // XAMPP Windows default, then fall back to PATH lookup.
        $xampp = 'C:/xampp/mysql/bin/mysqldump.exe';
        if (is_file($xampp)) {
            return $xampp;
        }

        return 'mysqldump';
    }

    /**
     * Validate/create the encrypted-archive target directory (design §4).
     */
    private function resolveTargetDir(int $facilityId): string
    {
        $configured = trim((string) ($this->config->get('backup_target_dir', '', $facilityId) ?? ''));
        if ($configured === '') {
            $configured = rtrim((string) ($GLOBALS['OE_SITE_DIR'] ?? ''), '/\\')
                . DIRECTORY_SEPARATOR . 'documents' . DIRECTORY_SEPARATOR . 'nc_backups';
        }
        // Absolute path only; no traversal.
        if (str_contains($configured, '..')) {
            throw new \RuntimeException('Backup target directory is invalid');
        }
        if (!is_dir($configured) && !@mkdir($configured, 0700, true) && !is_dir($configured)) {
            throw new \RuntimeException('Backup target directory could not be created');
        }
        if (!is_writable($configured)) {
            throw new \RuntimeException('Backup target directory is not writable: ' . $configured);
        }

        return $configured;
    }

    /**
     * Prune only our own encrypted archives older than the retention window.
     */
    private function pruneOldArchives(string $targetDir, int $facilityId): int
    {
        $days = $this->config->getInt('admin_hub_backup_retention_days', 30, $facilityId);
        if ($days <= 0) {
            return 0;
        }
        $cutoff = time() - ($days * 86400);
        $pattern = rtrim($targetDir, '/\\') . DIRECTORY_SEPARATOR . self::ARCHIVE_PREFIX . '*' . self::ARCHIVE_SUFFIX;
        $pruned = 0;
        foreach (glob($pattern) ?: [] as $file) {
            if (is_file($file) && (int) @filemtime($file) < $cutoff) {
                if (@unlink($file)) {
                    $pruned++;
                }
            }
        }

        return $pruned;
    }

    private function siteTag(): string
    {
        $tag = preg_replace('/[^a-z0-9]+/i', '', (string) ($GLOBALS['OE_SITE'] ?? 'default'));

        return $tag !== '' ? $tag : 'default';
    }

    /**
     * Stream-gzip a file in chunks so a large SQL dump never loads into memory.
     */
    private function gzipStream(string $source, string $dest): void
    {
        $in = fopen($source, 'rb');
        if ($in === false) {
            throw new \RuntimeException('Could not read the database dump for compression');
        }
        $out = gzopen($dest, 'wb6');
        if ($out === false) {
            fclose($in);
            throw new \RuntimeException('Could not open the compressed backup for writing');
        }
        while (!feof($in)) {
            $chunk = fread($in, 1 << 20); // 1 MB
            if ($chunk === false) {
                break;
            }
            gzwrite($out, $chunk);
        }
        fclose($in);
        gzclose($out);
    }

    private function secureDelete(string $path): void
    {
        if (!is_file($path)) {
            return;
        }
        // Best-effort overwrite before unlink so plaintext isn't trivially recoverable.
        $size = (int) @filesize($path);
        if ($size > 0 && $size < self::MAX_ENCRYPT_BYTES) {
            @file_put_contents($path, str_repeat("\0", $size));
        }
        @unlink($path);
    }

    private function cleanupTempDir(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        foreach (glob(rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . '*') ?: [] as $file) {
            if (is_file($file)) {
                $this->secureDelete($file);
            }
        }
        @rmdir($dir);
    }

    private function humanSize(int $bytes): string
    {
        if ($bytes >= 1073741824) {
            return round($bytes / 1073741824, 1) . ' GB';
        }
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1) . ' MB';
        }
        if ($bytes >= 1024) {
            return round($bytes / 1024, 1) . ' KB';
        }

        return $bytes . ' B';
    }
}

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

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function isNativeEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_native_backup', 0, $facilityId) === 1;
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
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        if (!$this->isNativeEnabled($facilityId)) {
            throw new \RuntimeException('Native backup is not enabled for this clinic', 403);
        }

        return $this->performBackup($facilityId, $actorUserId);
    }

    /**
     * Cron entry point (scripts/backup-scheduled.php). No interactive ACL — the
     * trust boundary is server-side execution. Runs only when native backup is on
     * AND a backup is due per `backup_frequency_days`.
     *
     * @return array<string, mixed>
     */
    public function runScheduledBackup(int $facilityId): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        if (!$this->isNativeEnabled($facilityId)) {
            return ['status' => 'skipped', 'reason' => 'native_backup_disabled'];
        }
        $due = $this->dueForBackup($facilityId);
        if (empty($due['due'])) {
            return ['status' => 'skipped', 'reason' => 'not_due', 'schedule' => $due];
        }

        return $this->performBackup($facilityId, 0);
    }

    /** Is the separate site-files backup switched on (design §3b)? */
    public function isFilesBackupEnabled(int $facilityId): bool
    {
        return $this->config->getInt('backup_include_site_files', 0, $facilityId) === 1;
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
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        if (!$this->isNativeEnabled($facilityId)) {
            throw new \RuntimeException('Native backup is not enabled for this clinic', 403);
        }
        if (!$this->isFilesBackupEnabled($facilityId)) {
            throw new \RuntimeException('Site-files backup is not enabled for this clinic', 403);
        }

        return $this->performFilesBackup($facilityId, $actorUserId);
    }

    /**
     * Cron/heartbeat entry for the site-files backup. Independent "separate entity"
     * cadence: due-checked against the last successful *files* run (kind='files'),
     * so the DB and the files each run on their own schedule.
     *
     * @return array<string, mixed>
     */
    public function runScheduledFilesBackup(int $facilityId): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        if (!$this->isNativeEnabled($facilityId) || !$this->isFilesBackupEnabled($facilityId)) {
            return ['status' => 'skipped', 'reason' => 'files_backup_disabled'];
        }
        $due = $this->dueForBackup($facilityId, 'files');
        if (empty($due['due'])) {
            return ['status' => 'skipped', 'reason' => 'not_due', 'schedule' => $due];
        }

        return $this->performFilesBackup($facilityId, 0);
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
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $freq = $this->config->getInt('backup_frequency_days', 0, $facilityId);
        if ($freq <= 0) {
            return ['scheduled' => false, 'due' => false, 'frequency_days' => 0];
        }
        $row = QueryUtils::querySingleRow(
            "SELECT finished_at FROM admin_hub_backup_run
             WHERE facility_id = ? AND kind = ? AND status = 'ok' AND finished_at IS NOT NULL
             ORDER BY id DESC LIMIT 1",
            [$facilityId, $kind]
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

        $startedAt = date('Y-m-d H:i:s');
        $runId = (int) QueryUtils::sqlInsert(
            "INSERT INTO admin_hub_backup_run (facility_id, kind, started_at, status, actor_id, message)
             VALUES (?, 'db', ?, 'running', ?, ?)",
            [$facilityId, $startedAt, $actorUserId > 0 ? $actorUserId : null, 'Native encrypted backup started']
        );

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
        $startedAt = date('Y-m-d H:i:s');
        $runId = (int) QueryUtils::sqlInsert(
            "INSERT INTO admin_hub_backup_run (facility_id, kind, started_at, status, actor_id, message)
             VALUES (?, 'files', ?, 'running', ?, ?)",
            [$facilityId, $startedAt, $actorUserId > 0 ? $actorUserId : null, 'Site-files backup started']
        );

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
        $facilityId = $this->visitScope->resolveDeskFacilityId();

        $row = $runId > 0
            ? QueryUtils::querySingleRow(
                'SELECT id, file_path FROM admin_hub_backup_run WHERE id = ? AND facility_id = ?',
                [$runId, $facilityId]
            )
            : QueryUtils::querySingleRow(
                "SELECT id, file_path FROM admin_hub_backup_run
                 WHERE facility_id = ? AND status = 'ok' AND file_path IS NOT NULL
                 ORDER BY id DESC LIMIT 1",
                [$facilityId]
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

        return $looksLikeSql
            ? ['verified' => true, 'note' => 'Decrypted and readable as a database dump.', 'run_id' => $resolvedRunId]
            : ['verified' => false, 'note' => 'Decrypted, but the contents do not look like a database dump.', 'run_id' => $resolvedRunId];
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
     * @return array{filename: string, content_base64: string, file_count: int}
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
        // to ever be decrypted again. Missing one makes the whole bundle useless, so
        // this fails loudly (before anything is written) rather than shipping a
        // bundle that looks complete but silently can't restore.
        $dbKeyNames = $this->requiredDatabaseKeyNames($files);
        $dbKeyRows = $this->fetchDatabaseKeyRows($dbKeyNames);
        if (count($dbKeyRows) !== count($dbKeyNames)) {
            $missing = implode(', ', array_diff($dbKeyNames, array_column($dbKeyRows, 'name')));
            throw new \RuntimeException(
                'The recovery-key bundle is incomplete — the `keys` table is missing row(s) required '
                . 'to decrypt the drive key file(s): ' . $missing . '. This should not happen; check the database.'
            );
        }

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
            'recovery_key_exported files=' . count($files) . ' db_keys=' . count($dbKeyRows) . ' uid=' . $actorUserId
        );

        return [
            'filename' => 'openemr-recovery-key-' . $this->siteTag() . '-' . date('Ymd-His') . '.zip',
            'content_base64' => base64_encode($content),
            'file_count' => count($files),
        ];
    }

    /**
     * Work out which `keys`-table rows the drive-key files depend on to ever be
     * decrypted again (BACKUP-C1).
     *
     * KeyVersion.php usesLegacyStorage() (~:71-74): versions 1-4 store the drive key
     * as plain base64 on disk — self-sufficient, no database dependency. Versions 5+
     * store it ENCRYPTED, using the database key of the exact same label (CryptoGen.php
     * createDriveKey() ~:548-572 calls encryptStandard() with KeySource::DATABASE and
     * the current KeyVersion, which — see collectCryptoKey() ~:448-466 — derives the
     * label as `$keyVersion->toString() . $sub`; that is identical to how the drive
     * filename itself was built, which is why the drive filename ("sevena") and the
     * `keys` row name it depends on ("sevena") are always the same string).
     *
     * @param list<string> $files absolute paths of the drive-key files
     * @return list<string> `keys.name` values the bundle must carry
     */
    private function requiredDatabaseKeyNames(array $files): array
    {
        $names = [];
        foreach ($files as $path) {
            $base = basename($path);
            foreach (KeyVersion::cases() as $keyVersion) {
                if (str_starts_with($base, $keyVersion->toString()) && !$keyVersion->usesLegacyStorage()) {
                    $names[] = $base;
                    break;
                }
            }
        }

        return array_values(array_unique($names));
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
            . "  - A computer with PHP 8.2+ and this OpenEMR + New Clinic module code checked out\n"
            . "    (it does NOT need to be set up or connected to any database yet).\n\n"
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
            . "To restore ONE mirrored document (not the whole database), run the same\n"
            . "command with --in pointing at that one '.enc' file — the tool detects it is a\n"
            . "single file (not a database dump) and writes the decrypted document instead of\n"
            . "a '.sql.gz'.\n\n"
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

<?php

/**
 * AdminBackupService guard tests (GAP-C C6 follow-up).
 *
 * The mysqldump/exec path itself needs a desktop live smoke; these cover the
 * safe, deterministic guards.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Crypto\CryptoGen;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\AdminBackupService;
use PHPUnit\Framework\TestCase;

class AdminBackupServiceTest extends TestCase
{
    /** @var array<string, mixed> */
    private array $priorSession = [];

    /** @var list<int> */
    private array $insertedRunIds = [];

    /** @var list<string> */
    private array $tempFiles = [];

    protected function tearDown(): void
    {
        // Restore whatever session identity was there before an ACL-bypass test.
        foreach (['authUser', 'authUserID'] as $key) {
            if (array_key_exists($key, $this->priorSession)) {
                if ($this->priorSession[$key] === null) {
                    unset($_SESSION[$key]);
                } else {
                    $_SESSION[$key] = $this->priorSession[$key];
                }
            }
        }
        $this->priorSession = [];

        foreach ($this->insertedRunIds as $id) {
            try {
                QueryUtils::sqlStatementThrowException('DELETE FROM admin_hub_backup_run WHERE id = ?', [$id]);
            } catch (\Throwable) {
                // best-effort cleanup
            }
        }
        $this->insertedRunIds = [];

        foreach ($this->tempFiles as $path) {
            @unlink($path);
        }
        $this->tempFiles = [];

        try {
            QueryUtils::sqlStatementThrowException(
                "DELETE FROM new_clinic_maintenance_lock WHERE lock_key LIKE 'test:%'"
            );
        } catch (\Throwable) {
            // table may not exist pre-upgrade — fine
        }
    }

    /** Log in as the dev DB's built-in super-admin (id 1, 'Adminstrator') so ACL-gated code runs for real. */
    private function asSuperAdmin(): void
    {
        $this->priorSession['authUser'] = $_SESSION['authUser'] ?? null;
        $this->priorSession['authUserID'] = $_SESSION['authUserID'] ?? null;
        $_SESSION['authUser'] = 'Adminstrator';
        $_SESSION['authUserID'] = 1;
    }

    /**
     * Insert a run row directly (bypassing the service's own ACL/backup logic —
     * these tests are about the READ side: verify()/health/setup gating).
     */
    private function insertRun(
        string $kind,
        string $status,
        ?string $filePath,
        ?int $sizeBytes = null,
        ?int $actorId = null,
        ?string $verifiedAt = null,
        int $facilityId = 0
    ): int {
        $id = (int) QueryUtils::sqlInsert(
            "INSERT INTO admin_hub_backup_run
             (facility_id, kind, started_at, finished_at, status, file_path, size_bytes, actor_id, message, verified_at)
             VALUES (?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?)",
            [$facilityId, $kind, $status, $filePath, $sizeBytes, $actorId, 'test fixture row', $verifiedAt]
        );
        $this->insertedRunIds[] = $id;

        return $id;
    }

    /** A real CryptoGen-encrypted, gzip-compressed fixture verifyBackup() can actually decrypt+read. */
    private function writeFakeEncryptedArchive(): string
    {
        $plainSql = "-- MySQL dump\nCREATE TABLE foo (id INT);\nINSERT INTO foo VALUES (1);\n";
        $gz = (string) gzencode($plainSql, 6);
        $cipher = (new CryptoGen())->encryptStandard($gz);
        $path = tempnam(sys_get_temp_dir(), 'ncbktest') . '.sql.gz.enc';
        file_put_contents($path, $cipher);
        $this->tempFiles[] = $path;

        return $path;
    }

    public function testRunBackupRequiresSuperAdmin(): void
    {
        // No authenticated super-admin in the harness → refuse before any exec.
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('super');
        (new AdminBackupService())->runBackup(0, 1);
    }

    public function testNativeBackupDisabledByDefault(): void
    {
        $this->assertFalse((new AdminBackupService())->isNativeEnabled(0));
    }

    public function testDueForBackupOffWhenFrequencyZero(): void
    {
        // Default backup_frequency_days = 0 → automatic backups off, never "due".
        $due = (new AdminBackupService())->dueForBackup(0);
        $this->assertFalse($due['scheduled']);
        $this->assertFalse($due['due']);
        $this->assertSame(0, $due['frequency_days']);
    }

    public function testScheduledBackupSkipsWhenNativeDisabled(): void
    {
        // No ACL needed for the scheduled path; it no-ops when native is off.
        $result = (new AdminBackupService())->runScheduledBackup(0);
        $this->assertSame('skipped', $result['status']);
        $this->assertSame('native_backup_disabled', $result['reason']);
    }

    public function testFilesBackupDisabledByDefault(): void
    {
        $this->assertFalse((new AdminBackupService())->isFilesBackupEnabled(0));
    }

    public function testRunFilesBackupRequiresSuperAdmin(): void
    {
        // Site-files backup is super-admin only, refused before touching the disk.
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('super');
        (new AdminBackupService())->runFilesBackup(0, 1);
    }

    public function testScheduledFilesBackupSkipsWhenDisabled(): void
    {
        $result = (new AdminBackupService())->runScheduledFilesBackup(0);
        $this->assertSame('skipped', $result['status']);
        $this->assertSame('files_backup_disabled', $result['reason']);
    }

    public function testDueForFilesBackupOffWhenFrequencyZero(): void
    {
        $due = (new AdminBackupService())->dueForBackup(0, 'files');
        $this->assertFalse($due['scheduled']);
        $this->assertFalse($due['due']);
    }

    /**
     * Security-critical: the files backup must NEVER copy the encryption key dir
     * (co-locating the key with the data it decrypts hands a thief both halves),
     * nor recurse into its own backup outputs or the temp scratch dir.
     */
    public function testMirrorExcludesKeyDirAndOwnOutputs(): void
    {
        $method = new \ReflectionMethod(AdminBackupService::class, 'isExcludedRelPath');
        $method->setAccessible(true);
        $svc = new AdminBackupService();

        // Paths are relative to the documents root and anchored at its top level.
        $excluded = [
            'logs_and_misc/methods/sevena',
            'logs_and_misc/methods',
            'nc_backups/nc-backup-x.enc',
            'nc-files-default/foo.pdf.enc',
            'temp/scratch',
        ];
        foreach ($excluded as $path) {
            $this->assertTrue($method->invoke($svc, $path), "should exclude: $path");
        }

        $kept = [
            'patient/scan.pdf',
            'letter_templates/welcome.txt',
            // A legitimate document that merely CONTAINS "temp" deeper in the path
            // must NOT be excluded — only the top-level temp/ dir is.
            'patient/temperature-chart.pdf',
            'contemp/report.pdf',
        ];
        foreach ($kept as $path) {
            $this->assertFalse($method->invoke($svc, $path), "should keep: $path");
        }
    }

    public function testVerifyRequiresSuperAdmin(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('super');
        (new AdminBackupService())->verifyBackup(0);
    }

    public function testExportRecoveryKeyRequiresSuperAdmin(): void
    {
        // Exporting the master key is the crown jewels — refuse before touching files.
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('super');
        (new AdminBackupService())->exportRecoveryKey(1);
    }

    public function testRecoveryKeyStatusReportsShape(): void
    {
        // Non-secret status (no key material) — always returns the documented shape.
        $status = (new AdminBackupService())->recoveryKeyStatus();
        $this->assertArrayHasKey('present', $status);
        $this->assertArrayHasKey('exported_at', $status);
        $this->assertArrayHasKey('export_warning', $status);
        $this->assertIsArray($status['key_files']);
        // If keys are present but never exported, we must be nagging.
        if ($status['present'] && $status['exported_at'] === null) {
            $this->assertTrue($status['export_warning']);
        }
    }

    /**
     * BACKUP-C1/C2: modern-version (>=5) drive-key files are themselves encrypted
     * with a PAIR of database keys of the SAME label — an "a" (AES) row and a "b"
     * (HMAC) row (coreEncrypt()/coreDecrypt() always fetch both). Decrypting the
     * drive file "sevena" therefore needs BOTH the "sevena" AND "sevenb" `keys`
     * rows, not just the row matching its own filename — so a bundle must carry
     * both halves of the pair for every modern version referenced, even if only
     * one half's drive file happens to be present on disk (synthetic "fivea"
     * below, with no "fiveb" file, still requires BOTH db rows). Legacy (<=4)
     * files are plain base64 on disk and need no database dependency at all.
     * Pure logic — synthetic filenames, no real methods/ dir touched.
     */
    public function testRequiredDatabaseKeyNamesIdentifiesBothHalvesOfEachModernPair(): void
    {
        $method = new \ReflectionMethod(AdminBackupService::class, 'requiredDatabaseKeyNames');
        $method->setAccessible(true);
        $svc = new AdminBackupService();

        $files = [
            '/fake/methods/sevena',
            '/fake/methods/sevenb',
            '/fake/methods/fivea', // still modern (>=5) — needs BOTH fivea and fiveb db rows
            '/fake/methods/four',  // legacy (<=4) — self-sufficient, no db row
            '/fake/methods/one',   // legacy — self-sufficient
        ];

        $result = $method->invoke($svc, $files);

        $this->assertEqualsCanonicalizing(['sevena', 'sevenb', 'fivea', 'fiveb'], $result);
    }

    public function testRequiredDatabaseKeyNamesEmptyForNoFiles(): void
    {
        $method = new \ReflectionMethod(AdminBackupService::class, 'requiredDatabaseKeyNames');
        $method->setAccessible(true);
        $this->assertSame([], $method->invoke(new AdminBackupService(), []));
    }

    public function testFetchDatabaseKeyRowsEmptyForNoNames(): void
    {
        // Empty input short-circuits before any query — safe to call without a DB fixture.
        $method = new \ReflectionMethod(AdminBackupService::class, 'fetchDatabaseKeyRows');
        $method->setAccessible(true);
        $this->assertSame([], $method->invoke(new AdminBackupService(), []));
    }

    /**
     * BACKUP-C2: the fatal-vs-warning decision for missing `keys` rows, in isolation
     * from any real database. No required names at all (e.g. every drive file is
     * legacy) is fine — nothing to warn about, nothing fatal.
     */
    public function testSummarizeKeyMaterialGapsNoneRequiredIsClean(): void
    {
        $method = new \ReflectionMethod(AdminBackupService::class, 'summarizeKeyMaterialGaps');
        $method->setAccessible(true);

        $result = $method->invoke(new AdminBackupService(), [], []);

        $this->assertFalse($result['fatal']);
        $this->assertSame([], $result['warnings']);
    }

    /**
     * BACKUP-C2 resilience: SOME required rows are missing, but at least one was
     * found — this must NOT be fatal (an upgraded install can still export the
     * crown jewels it does have), just a warning naming exactly what's missing.
     */
    public function testSummarizeKeyMaterialGapsPartialIsWarningNotFatal(): void
    {
        $method = new \ReflectionMethod(AdminBackupService::class, 'summarizeKeyMaterialGaps');
        $method->setAccessible(true);

        $result = $method->invoke(
            new AdminBackupService(),
            ['sevena', 'sevenb', 'fivea', 'fiveb'],
            [['name' => 'sevena', 'value' => 'x'], ['name' => 'sevenb', 'value' => 'y']]
        );

        $this->assertFalse($result['fatal']);
        $this->assertCount(1, $result['warnings']);
        $this->assertStringContainsString('fivea', $result['warnings'][0]);
        $this->assertStringContainsString('fiveb', $result['warnings'][0]);
    }

    /**
     * BACKUP-C2: rows were required but NONE were found at all — this bundle would
     * be completely useless, so it must be fatal (fail loud), not a silent warning.
     */
    public function testSummarizeKeyMaterialGapsNoneFoundIsFatal(): void
    {
        $method = new \ReflectionMethod(AdminBackupService::class, 'summarizeKeyMaterialGaps');
        $method->setAccessible(true);

        $result = $method->invoke(new AdminBackupService(), ['sevena', 'sevenb'], []);

        $this->assertTrue($result['fatal']);
    }

    public function testPresentNonLegacyKeyVersionsDedupesAndSkipsLegacy(): void
    {
        $method = new \ReflectionMethod(AdminBackupService::class, 'presentNonLegacyKeyVersions');
        $method->setAccessible(true);

        $files = ['/fake/methods/sevena', '/fake/methods/sevenb', '/fake/methods/four'];
        $result = $method->invoke(new AdminBackupService(), $files);

        $this->assertCount(1, $result);
        $this->assertSame('seven', $result[0]->toString());
    }

    /**
     * BACKUP-M4: a database backup is whole-DB, not facility-scoped — config and
     * run rows must be pinned to a fixed sentinel facility, not whatever a given
     * request happens to resolve (unstable across a multi-facility clinic, and
     * undefined in a session-less CLI worker — the exact context BACKUP-H1's
     * job-worker path runs in).
     */
    public function testFacilityIdIsZero(): void
    {
        $this->assertSame(0, (new AdminBackupService())->facilityId());
    }

    public function testBackupFacilityIdsForReadIncludesTheSentinel(): void
    {
        $ids = (new AdminBackupService())->backupFacilityIdsForRead();
        $this->assertCount(2, $ids);
        $this->assertContains(0, $ids);
    }

    /**
     * BACKUP-H2: verifyBackup() must filter kind='db' in BOTH the "latest ok run"
     * branch and the explicit-run-id branch — otherwise, when the most recent OK
     * run for a facility happens to be a FILES run, file_path points at the
     * nc-files-<site>/ MIRROR DIRECTORY, and verify falsely reports "the backup
     * file is missing from disk" even though a perfectly good DB archive exists.
     *
     * Proof: insert a newer 'files' row (id N+1, file_path = a directory) AFTER
     * a real, decryptable 'db' row (id N). run_id=0 ("verify latest") must still
     * resolve to and successfully verify the DB row, not the newer files row.
     */
    public function testVerifyLatestSkipsNewerFilesRunAndVerifiesTheDbArchive(): void
    {
        $this->asSuperAdmin();

        $dbArchive = $this->writeFakeEncryptedArchive();
        $this->insertRun('db', 'ok', $dbArchive, strlen((string) file_get_contents($dbArchive)));

        // A directory, exactly like performFilesBackup()'s mirrorDir — is_file()
        // on this is false, which is what would trip the pre-fix "missing" bug.
        $filesDir = sys_get_temp_dir();
        $this->insertRun('files', 'ok', $filesDir, 1024);

        $result = (new AdminBackupService())->verifyBackup(0);

        $this->assertTrue($result['verified'], $result['note']);
        $this->assertStringContainsString('database dump', $result['note']);
    }

    /** H3(i): a successful verify persists verified_at on that run row. */
    public function testVerifyBackupPersistsVerifiedAtOnSuccess(): void
    {
        $this->asSuperAdmin();

        $dbArchive = $this->writeFakeEncryptedArchive();
        $runId = $this->insertRun('db', 'ok', $dbArchive, strlen((string) file_get_contents($dbArchive)));

        $result = (new AdminBackupService())->verifyBackup($runId);
        $this->assertTrue($result['verified']);

        $row = QueryUtils::querySingleRow('SELECT verified_at FROM admin_hub_backup_run WHERE id = ?', [$runId]);
        $this->assertNotNull($row['verified_at'] ?? null);
    }

    /**
     * BACKUP-M3: two attempts to run the same kind concurrently must not both
     * proceed — the second must fail fast with a clear "already running" error,
     * not silently double-dump/encrypt onto the same target directory.
     */
    public function testClaimBackupLockRefusesADoubleClaim(): void
    {
        $svc = new AdminBackupService();
        $claim = new \ReflectionMethod(AdminBackupService::class, 'claimBackupLock');
        $claim->setAccessible(true);
        $release = new \ReflectionMethod(AdminBackupService::class, 'releaseBackupLock');
        $release->setAccessible(true);

        $lockKey = 'test:backup:m3:' . bin2hex(random_bytes(4));

        $first = $claim->invoke($svc, $lockKey, 60);
        $this->assertIsString($first);
        $this->assertNotSame('unavailable', $first);

        // Same lock, still held — a concurrent second claim must lose.
        $second = $claim->invoke($svc, $lockKey, 60);
        $this->assertNull($second);

        // Release, then a fresh claim must succeed again.
        $release->invoke($svc, $lockKey, $first);
        $third = $claim->invoke($svc, $lockKey, 60);
        $this->assertIsString($third);
        $this->assertNotSame('unavailable', $third);
        $release->invoke($svc, $lockKey, $third);
    }
}

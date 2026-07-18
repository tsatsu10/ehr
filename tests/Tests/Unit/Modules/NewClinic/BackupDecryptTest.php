<?php

/**
 * backup-decrypt.php core (BACKUP-C2) — BundleCryptoGen key reconstruction and bundle
 * loading, exercised with fully synthetic key material. No live DB row and no real
 * sites/*\/documents/logs_and_misc/methods/ file is ever touched by these tests: every
 * fixture below is built the same way CryptoGen itself would build one (real
 * coreEncrypt/coreDecrypt, real AES-256-CBC + HMAC-SHA384), just fed random bytes
 * instead of the live install's keys.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';
// __DIR__ = tests/Tests/Unit/Modules/NewClinic -> 5 levels up is the repo root.
require_once dirname(__DIR__, 5) . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/backup-decrypt-lib.php';

use PHPUnit\Framework\TestCase;

class BackupDecryptTest extends TestCase
{
    private ?string $tmpDir = null;

    protected function tearDown(): void
    {
        if ($this->tmpDir !== null && is_dir($this->tmpDir)) {
            foreach (glob($this->tmpDir . '/*') ?: [] as $f) {
                @unlink($f);
            }
            foreach (glob($this->tmpDir . '/methods/*') ?: [] as $f) {
                @unlink($f);
            }
            @rmdir($this->tmpDir . '/methods');
            @rmdir($this->tmpDir);
        }
    }

    /**
     * Builds a synthetic "recovery bundle" worth of key material without touching any
     * real file or database row: a fake database key pair + a fake drive key pair,
     * with the drive key files encrypted using the REAL CryptoGen algorithm (via
     * BundleCryptoGen fed the fake database keys), exactly as createDriveKey() would
     * produce them on a real install.
     *
     * @return array{db: array<string,string>, drive: array<string,string>, rawDriveKeys: array<string,string>}
     */
    private function buildSyntheticKeyMaterial(): array
    {
        $dbKeyA = random_bytes(32);
        $dbKeyB = random_bytes(32);
        $db = ['sevena' => base64_encode($dbKeyA), 'sevenb' => base64_encode($dbKeyB)];

        $rawDriveKeyA = random_bytes(32);
        $rawDriveKeyB = random_bytes(32);

        // Same trick backup-decrypt.php uses for decryption, run in reverse for
        // encryption: feed BundleCryptoGen only the database keys and ask it to
        // encryptStandard() with keySource='database' — that's exactly how
        // CryptoGen::createDriveKey() wraps a raw drive key for disk storage.
        $builder = new \BundleCryptoGen();
        $builder->databaseKeyValues = $db;
        $driveFileContentA = $builder->encryptStandard($rawDriveKeyA, null, 'database');
        $driveFileContentB = $builder->encryptStandard($rawDriveKeyB, null, 'database');

        return [
            'db' => $db,
            'drive' => ['sevena' => $driveFileContentA, 'sevenb' => $driveFileContentB],
            'rawDriveKeys' => ['sevena' => $rawDriveKeyA, 'sevenb' => $rawDriveKeyB],
        ];
    }

    public function testBundleCryptoGenDecryptsUsingOnlySyntheticBundleMaterial(): void
    {
        $material = $this->buildSyntheticKeyMaterial();

        // Encrypt a fake "backup" the same way AdminBackupService::performBackup()
        // does: encryptStandard() with the default keySource='drive'.
        $encryptor = new \BundleCryptoGen();
        $encryptor->driveFileContents = $material['drive'];
        $encryptor->databaseKeyValues = $material['db'];
        $plaintext = 'CREATE TABLE fake_dump (id INT); -- BACKUP-C2 fixture ' . bin2hex(random_bytes(4));
        $ciphertext = $encryptor->encryptStandard($plaintext);

        // Now decrypt with a FRESH instance, proving the round trip works purely off
        // the bundle arrays (no shared object state, no DB, no disk).
        $decryptor = new \BundleCryptoGen();
        $decryptor->driveFileContents = $material['drive'];
        $decryptor->databaseKeyValues = $material['db'];

        $this->assertSame($plaintext, $decryptor->decryptStandard($ciphertext));
    }

    public function testBundleCryptoGenFailsClearlyWhenDatabaseKeyMissing(): void
    {
        $material = $this->buildSyntheticKeyMaterial();
        $encryptor = new \BundleCryptoGen();
        $encryptor->driveFileContents = $material['drive'];
        $encryptor->databaseKeyValues = $material['db'];
        $ciphertext = $encryptor->encryptStandard('hello');

        $decryptor = new \BundleCryptoGen();
        $decryptor->driveFileContents = $material['drive'];
        $decryptor->databaseKeyValues = []; // simulate a bundle missing db-keys.json rows

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage("no database key material for 'sevena'");
        $decryptor->decryptStandard($ciphertext);
    }

    public function testBundleCryptoGenFailsClearlyWhenDriveFileMissing(): void
    {
        $material = $this->buildSyntheticKeyMaterial();
        $decryptor = new \BundleCryptoGen();
        $decryptor->driveFileContents = []; // simulate a bundle with an empty methods/ folder
        $decryptor->databaseKeyValues = $material['db'];

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage("no drive key file for 'sevena'");
        $decryptor->decryptStandard('007' . base64_encode(str_repeat('x', 60)));
    }

    public function testBundleCryptoGenFailsClearlyWhenDatabaseKeyWrong(): void
    {
        // A bundle whose db-keys.json doesn't match its methods/ files (mixed export)
        // must fail loudly, not silently return garbage.
        $materialA = $this->buildSyntheticKeyMaterial();
        $materialB = $this->buildSyntheticKeyMaterial();

        $encryptor = new \BundleCryptoGen();
        $encryptor->driveFileContents = $materialA['drive'];
        $encryptor->databaseKeyValues = $materialA['db'];
        $ciphertext = $encryptor->encryptStandard('hello');

        $mismatched = new \BundleCryptoGen();
        $mismatched->driveFileContents = $materialA['drive']; // right drive files...
        $mismatched->databaseKeyValues = $materialB['db'];    // ...wrong db keys

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage("could not be decrypted with the database key material");
        $mismatched->decryptStandard($ciphertext);
    }

    public function testFinishBundleRejectsEmptyDriveFiles(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('no key files in its methods/ folder');
        \backupDecryptFinishBundle([], '[]', 'some/path');
    }

    public function testFinishBundleRejectsMissingDbJson(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('has no db-keys.json');
        \backupDecryptFinishBundle(['sevena' => 'x'], null, 'some/path');
    }

    public function testFinishBundleRejectsInvalidJson(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('not valid JSON');
        \backupDecryptFinishBundle(['sevena' => 'x'], 'not-json{{{', 'some/path');
    }

    public function testFinishBundleParsesValidRows(): void
    {
        $result = \backupDecryptFinishBundle(
            ['sevena' => 'filecontent'],
            json_encode([['name' => 'sevena', 'value' => 'YWJj']]),
            'some/path'
        );
        $this->assertSame(['sevena' => 'filecontent'], $result['drive']);
        $this->assertSame(['sevena' => 'YWJj'], $result['db']);
    }

    public function testLoadBundleFromDirReadsMethodsAndJson(): void
    {
        // Isolated temp-dir fixture — never the real site methods/ dir.
        $this->tmpDir = sys_get_temp_dir() . '/nc_backup_decrypt_test_' . bin2hex(random_bytes(6));
        mkdir($this->tmpDir . '/methods', 0700, true);
        file_put_contents($this->tmpDir . '/methods/sevena', 'fake-drive-file-a');
        file_put_contents($this->tmpDir . '/methods/sevenb', 'fake-drive-file-b');
        file_put_contents(
            $this->tmpDir . '/db-keys.json',
            json_encode([
                ['name' => 'sevena', 'value' => 'AAAA'],
                ['name' => 'sevenb', 'value' => 'BBBB'],
            ])
        );

        $result = \backupDecryptLoadBundleFromDir($this->tmpDir);

        $this->assertSame(
            ['sevena' => 'fake-drive-file-a', 'sevenb' => 'fake-drive-file-b'],
            $result['drive']
        );
        $this->assertSame(['sevena' => 'AAAA', 'sevenb' => 'BBBB'], $result['db']);
    }

    public function testLoadBundleThrowsWhenPathMissing(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Bundle not found');
        \backupDecryptLoadBundle(sys_get_temp_dir() . '/does_not_exist_' . bin2hex(random_bytes(6)));
    }

    /**
     * BACKUP-C2 zip-guard fix: backupDecryptLoadBundleFromZip() now checks
     * getFromIndex() for `false` (which ZipArchive can legitimately return on a
     * read error) instead of ever storing a bool where file content is expected.
     * This is the success-path round trip through a REAL zip (not just
     * backupDecryptFinishBundle() with hand-built arrays, which the tests above
     * already cover) — it proves the added guard didn't break normal loading.
     */
    public function testLoadBundleFromZipReadsMethodsAndJson(): void
    {
        if (!class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('php-zip not available');
        }
        $this->tmpDir = sys_get_temp_dir() . '/nc_backup_decrypt_zip_test_' . bin2hex(random_bytes(6));
        mkdir($this->tmpDir, 0700, true);
        $zipPath = $this->tmpDir . '/bundle.zip';

        $zip = new \ZipArchive();
        $zip->open($zipPath, \ZipArchive::CREATE);
        $zip->addFromString('methods/sevena', 'fake-drive-file-a');
        $zip->addFromString('methods/sevenb', 'fake-drive-file-b');
        $zip->addFromString('db-keys.json', json_encode([
            ['name' => 'sevena', 'value' => 'AAAA'],
            ['name' => 'sevenb', 'value' => 'BBBB'],
        ]));
        $zip->close();

        $result = \backupDecryptLoadBundleFromZip($zipPath);

        $this->assertSame(
            ['sevena' => 'fake-drive-file-a', 'sevenb' => 'fake-drive-file-b'],
            $result['drive']
        );
        $this->assertSame(['sevena' => 'AAAA', 'sevenb' => 'BBBB'], $result['db']);

        @unlink($zipPath);
    }
}

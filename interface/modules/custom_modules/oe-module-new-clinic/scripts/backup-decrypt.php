<?php

/**
 * Standalone recovery-bundle decrypt CLI (BACKUP-C2).
 *
 * Decrypts an encrypted New Clinic backup archive (`nc-backup-<site>-<ts>.sql.gz.enc`)
 * OR a single mirrored document (from a `nc-files-<site>` folder, `<name>.enc`) using ONLY the materials
 * in a recovery-key bundle exported via Admin Hub → System → "Save recovery key"
 * (`AdminBackupService::exportRecoveryKey()`). This tool deliberately never opens a
 * database connection and never reads a live site's `logs_and_misc/methods/` folder —
 * it loads only `vendor/autoload.php` and the bundle you point it at. That is the
 * whole point: it must work on a brand-new machine that has no working OpenEMR
 * install yet, using nothing but the recovery bundle and one encrypted file.
 *
 * How the decryption is reconstructed (see AdminBackupService::exportRecoveryKey()
 * and src/Common/Crypto/CryptoGen.php for the real, live version of this logic):
 *
 *   - Backups are encrypted with the DRIVE key set (CryptoGen::encryptStandard(),
 *     default keySource='drive').
 *   - For key version >= 5 (this install is version "seven" — KeyVersion.php
 *     usesLegacyStorage() ~:71-74), the drive-key file on disk is ITSELF encrypted,
 *     using the DATABASE key set of the identical label (CryptoGen::collectDriveKey()
 *     ~:523-537). The database key set lives only in the `keys` SQL table.
 *   - A recovery bundle therefore carries both: the drive-key files (`methods/*`) AND
 *     the `keys`-table rows they depend on (`db-keys.json`).
 *
 * scripts/lib/backup-decrypt-lib.php defines BundleCryptoGen — a thin subclass of the
 * REAL CryptoGen class that overrides only the two lowest-level key-lookup methods
 * (collectDatabaseKey/collectDriveKey) to pull from the bundle's in-memory arrays
 * instead of the database/disk. Every other line of decryption logic (AES-256-CBC,
 * HMAC-SHA384 authentication, key derivation) is the UNMODIFIED, real CryptoGen code —
 * this tool does not reimplement any crypto. That file is split out (rather than
 * inlined here) so PHPUnit can exercise it directly without going through argv/exit().
 *
 * Usage:
 *   php backup-decrypt.php --in <file.sql.gz.enc> --bundle <recovery.zip|folder> --out <file.sql.gz>
 *
 *   --in      Path to the encrypted file: a DB backup archive
 *             ("nc-backup-<site>-<timestamp>.sql.gz.enc") or a single mirrored
 *             document ("<relative-path>.enc" from a site-files backup).
 *   --bundle  Path to the recovery-key ZIP (as downloaded from "Save recovery key")
 *             OR a folder it has already been unzipped into. Either works.
 *   --out     Where to write the decrypted plaintext bytes. For a DB backup this is
 *             a .sql.gz you then gunzip yourself; for a mirrored document it is the
 *             document's original bytes (rename/extension is up to you).
 *
 * Exit codes: 0 = decrypted successfully. 1 = bad usage / bad input. 2 = bundle is
 * incomplete or unreadable. 3 = decryption failed (wrong bundle for this file, or the
 * file is corrupted).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

// Deliberately NOT interface/globals.php — no DB connection, no site bootstrap, no
// session. Only the class autoloader, so this genuinely runs on a bare machine.
// scripts/ -> oe-module-new-clinic -> custom_modules -> modules -> interface -> repo root.
require_once dirname(__DIR__, 5) . '/vendor/autoload.php';
require_once __DIR__ . '/lib/backup-decrypt-lib.php';

/**
 * @return never
 */
function backupDecryptFail(string $message, int $code): void
{
    fwrite(STDERR, "ERROR: $message\n");
    exit($code);
}

function backupDecryptUsage(): void
{
    fwrite(STDERR, <<<TXT
        Usage: php backup-decrypt.php --in <file.enc> --bundle <recovery.zip|folder> --out <output-file>

          --in      Encrypted backup archive or mirrored document (.enc)
          --bundle  Recovery-key ZIP (as downloaded) or an already-unzipped folder
          --out     Where to write the decrypted plaintext bytes

        Example (Windows):
          php backup-decrypt.php --in C:\\backups\\nc-backup-clinic-20260718-120000.sql.gz.enc ^
            --bundle C:\\recovery-key --out C:\\restore\\restored.sql.gz

        TXT);
    exit(1);
}

// --- Argument parsing -------------------------------------------------------------

$options = getopt('', ['in:', 'bundle:', 'out:']);
$inPath = $options['in'] ?? null;
$bundlePath = $options['bundle'] ?? null;
$outPath = $options['out'] ?? null;

if (!is_string($inPath) || !is_string($bundlePath) || !is_string($outPath) || $inPath === '' || $bundlePath === '' || $outPath === '') {
    backupDecryptUsage();
}

if (!is_file($inPath)) {
    backupDecryptFail("Input file not found: $inPath", 1);
}
$inSize = (int) @filesize($inPath);
if ($inSize <= 0) {
    backupDecryptFail("Input file is empty or unreadable: $inPath", 1);
}

// --- Load the bundle and reconstruct the key material ------------------------------

try {
    $bundle = backupDecryptLoadBundle($bundlePath);
} catch (\Throwable $e) {
    backupDecryptFail($e->getMessage(), 2);
}

$crypto = new BundleCryptoGen();
$crypto->driveFileContents = $bundle['drive'];
$crypto->databaseKeyValues = $bundle['db'];

// --- Decrypt -------------------------------------------------------------------

$ciphertext = file_get_contents($inPath);
if ($ciphertext === false) {
    backupDecryptFail("Could not read input file: $inPath", 1);
}

try {
    $plaintext = $crypto->decryptStandard($ciphertext);
} catch (\Throwable $e) {
    backupDecryptFail($e->getMessage(), 3);
}

if ($plaintext === false || $plaintext === '') {
    backupDecryptFail(
        'Decryption failed. Either this bundle does not match this backup file (wrong site, or the key '
        . 'was rotated since this backup was made), or the input file is corrupted. Nothing was written to --out.',
        3
    );
}

$outDir = dirname($outPath);
if (!is_dir($outDir) && !@mkdir($outDir, 0700, true) && !is_dir($outDir)) {
    backupDecryptFail("Could not create the output folder: $outDir", 1);
}
if (@file_put_contents($outPath, $plaintext) === false) {
    backupDecryptFail("Could not write the decrypted output to: $outPath", 1);
}

fwrite(STDOUT, 'Decrypted OK: ' . strlen($plaintext) . " bytes written to $outPath\n");
exit(0);

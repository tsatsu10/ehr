<?php

/**
 * Pure, testable core of backup-decrypt.php (BACKUP-C2) — bundle loading and the
 * bundle-only CryptoGen subclass. Split out of the CLI entrypoint so PHPUnit can
 * exercise the key-reconstruction logic without going through argv/exit(). See
 * backup-decrypt.php's header for the full design rationale.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Common\Crypto\CryptoGen;
use OpenEMR\Common\Crypto\KeySource;
use OpenEMR\Common\Crypto\KeyVersion;

// A handful of OpenEMR core files call the unqualified global errorLogEscape() on a
// rare error path (HMAC-authentication failure) inside CryptoGen. It normally comes
// from library/htmlspecialchars.inc.php, which the standalone CLI does not load by
// design (no live-DB/site bootstrap). Define a safe local fallback so a failed
// decrypt still reaches OUR clear error message instead of a raw PHP fatal on an
// unrelated helper. (No-op under PHPUnit — tests bootstrap the full framework, which
// already defines the real one.)
if (!function_exists('errorLogEscape')) {
    function errorLogEscape($text)
    {
        return is_string($text) ? $text : print_r($text, true);
    }
}

/**
 * CryptoGen subclass fed key material explicitly from a recovery bundle instead of
 * the live database / live methods/ folder. Overrides ONLY the two key-source
 * methods — every byte of actual cryptography below this stays the real,
 * unmodified CryptoGen implementation (see src/Common/Crypto/CryptoGen.php).
 */
final class BundleCryptoGen extends CryptoGen
{
    /** @var array<string,string> drive-key label (e.g. "sevena") => raw file contents, as read from the bundle's methods/ folder */
    public array $driveFileContents = [];
    /** @var array<string,string> `keys`-table label => base64 value, as read from the bundle's db-keys.json */
    public array $databaseKeyValues = [];

    protected function collectDatabaseKey(string $label, KeyVersion $keyVersion): string
    {
        if (!array_key_exists($label, $this->databaseKeyValues)) {
            throw new \RuntimeException(
                "The recovery bundle has no database key material for '$label'. "
                . "This usually means the bundle does not match this backup file "
                . "(different site, or an old bundle exported before this fix)."
            );
        }
        $key = base64_decode($this->databaseKeyValues[$label], true);
        if ($key === false || $key === '') {
            throw new \RuntimeException("The database key material for '$label' in db-keys.json is not valid — the bundle may be corrupted.");
        }

        return $key;
    }

    protected function collectDriveKey(string $label, KeyVersion $keyVersion): string
    {
        if (!array_key_exists($label, $this->driveFileContents)) {
            throw new \RuntimeException(
                "The recovery bundle has no drive key file for '$label' (expected in its methods/ folder)."
            );
        }
        $fileContents = $this->driveFileContents[$label];
        $key = $keyVersion->usesLegacyStorage()
            ? base64_decode(rtrim($fileContents))
            : $this->decryptStandard($fileContents, null, KeySource::DATABASE->value);
        if (empty($key)) {
            throw new \RuntimeException(
                "Drive key file '$label' could not be decrypted with the database key material in this "
                . "bundle. The bundle's methods/ folder and db-keys.json must come from the SAME export — "
                . "don't mix files from two different recovery-key downloads."
            );
        }

        return $key;
    }
}

function backupDecryptLooksLikeZip(string $path): bool
{
    $fh = @fopen($path, 'rb');
    if ($fh === false) {
        return false;
    }
    $magic = fread($fh, 4);
    fclose($fh);

    return $magic === "PK\x03\x04" || $magic === "PK\x05\x06";
}

/**
 * Load a recovery-key bundle (ZIP or already-extracted folder) into the two arrays
 * BundleCryptoGen needs.
 *
 * @return array{drive: array<string,string>, db: array<string,string>}
 * @throws \RuntimeException on any bundle problem (bad path, wrong shape, corrupt JSON)
 */
function backupDecryptLoadBundle(string $bundlePath): array
{
    if (!file_exists($bundlePath)) {
        throw new \RuntimeException("Bundle not found: $bundlePath");
    }

    $isZip = is_file($bundlePath)
        && (str_ends_with(strtolower($bundlePath), '.zip') || backupDecryptLooksLikeZip($bundlePath));

    if ($isZip) {
        return backupDecryptLoadBundleFromZip($bundlePath);
    }
    if (is_dir($bundlePath)) {
        return backupDecryptLoadBundleFromDir($bundlePath);
    }

    throw new \RuntimeException("Bundle path is neither a .zip file nor a folder: $bundlePath");
}

/** @return array{drive: array<string,string>, db: array<string,string>} */
function backupDecryptLoadBundleFromZip(string $zipPath): array
{
    if (!class_exists(\ZipArchive::class)) {
        throw new \RuntimeException('ZIP support (php-zip) is not available on this machine — unzip the bundle by hand and pass the folder to --bundle instead.');
    }
    $zip = new \ZipArchive();
    if ($zip->open($zipPath) !== true) {
        throw new \RuntimeException("Could not open the bundle as a ZIP file: $zipPath");
    }

    $drive = [];
    $dbJson = null;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = $zip->getNameIndex($i);
        if ($name === false) {
            continue;
        }
        if ($name === 'db-keys.json') {
            $content = $zip->getFromIndex($i);
            if ($content === false) {
                $zip->close();
                throw new \RuntimeException("Could not read 'db-keys.json' from the bundle zip: $zipPath (the zip may be corrupted)");
            }
            $dbJson = $content;
        } elseif (str_starts_with($name, 'methods/') && $name !== 'methods/') {
            $content = $zip->getFromIndex($i);
            if ($content === false) {
                $zip->close();
                throw new \RuntimeException("Could not read '$name' from the bundle zip: $zipPath (the zip may be corrupted)");
            }
            $drive[basename($name)] = $content;
        }
    }
    $zip->close();

    return backupDecryptFinishBundle($drive, $dbJson, $zipPath);
}

/** @return array{drive: array<string,string>, db: array<string,string>} */
function backupDecryptLoadBundleFromDir(string $dir): array
{
    $dir = rtrim($dir, '/\\');
    $drive = [];
    $methodsDir = $dir . DIRECTORY_SEPARATOR . 'methods';
    if (is_dir($methodsDir)) {
        foreach (glob($methodsDir . DIRECTORY_SEPARATOR . '*') ?: [] as $f) {
            if (is_file($f)) {
                $drive[basename($f)] = (string) file_get_contents($f);
            }
        }
    }
    $dbJsonPath = $dir . DIRECTORY_SEPARATOR . 'db-keys.json';
    $dbJson = is_file($dbJsonPath) ? (string) file_get_contents($dbJsonPath) : null;

    return backupDecryptFinishBundle($drive, $dbJson, $dir);
}

/**
 * @return array{drive: array<string,string>, db: array<string,string>}
 * @throws \RuntimeException
 */
function backupDecryptFinishBundle(array $drive, ?string $dbJson, string $sourceDescription): array
{
    if ($drive === []) {
        throw new \RuntimeException("The bundle at $sourceDescription has no key files in its methods/ folder. Are you pointing at the right recovery-key export?");
    }
    if ($dbJson === null) {
        throw new \RuntimeException(
            "The bundle at $sourceDescription has no db-keys.json. Either this bundle was exported before "
            . "the BACKUP-C1 fix (re-export a fresh recovery key from Admin Hub → System), or this isn't "
            . "a recovery-key bundle at all."
        );
    }
    $rows = json_decode($dbJson, true);
    if (!is_array($rows)) {
        throw new \RuntimeException("The bundle's db-keys.json is not valid JSON — the bundle may be corrupted.");
    }
    $db = [];
    foreach ($rows as $row) {
        if (is_array($row) && isset($row['name'], $row['value'])) {
            $db[(string) $row['name']] = (string) $row['value'];
        }
    }
    if ($db === []) {
        throw new \RuntimeException("The bundle's db-keys.json did not contain any usable key rows.");
    }

    return ['drive' => $drive, 'db' => $db];
}

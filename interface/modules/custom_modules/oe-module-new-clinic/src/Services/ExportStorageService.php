<?php

/**
 * Export file storage abstraction (SCALE-2.3).
 *
 * Single owner of where export result files live, so the web tier stays ready for
 * horizontal scale: export services write/read/delete their PHI-bearing result files
 * ONLY through this class and treat the returned storage path as opaque. The default
 * (and only implemented) driver is local site-dir storage — behavior on a one-box
 * XAMPP install is unchanged. When a second web server appears, an object-storage
 * driver plugs in behind the `export_storage_driver` config key (extend driverName()
 * and add the driver's put/read/delete beside the local ones) with no caller changes
 * (BP-12: the seam exists, the infra doesn't until needed).
 *
 * Retention (SEC-6): export files carry patient data and must not accumulate at
 * rest. Files older than RETENTION_SECONDS are purged on every put() AND on every
 * scripts/run-jobs.php pass — so an idle system still gets cleaned.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class ExportStorageService
{
    /** SEC-6: PHI-bearing export files expire after one day. */
    public const RETENTION_SECONDS = 86400;

    private ?string $driverName = null;

    /**
     * @param string $namespace storage bucket for one export family, e.g. 'nc_report_exports'
     * @param string|null $driverOverride tests only — bypass the config lookup
     * @param string|null $rootOverride tests only — bypass the site documents dir
     */
    public function __construct(
        private readonly string $namespace,
        private readonly ?string $driverOverride = null,
        private readonly ?string $rootOverride = null,
    ) {
        if (!preg_match('/^[a-z0-9_]{1,64}$/', $namespace)) {
            throw new \InvalidArgumentException('Invalid export storage namespace');
        }
    }

    /**
     * Store an export result file. Returns the opaque storage path the caller
     * persists (e.g. on the job row) and later passes to read()/delete().
     */
    public function put(string $fileKey, string $content): string
    {
        $this->assertKnownDriver();
        $dir = $this->rootDir();
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new \RuntimeException('Unable to create export directory');
        }
        // SEC-6: owner-only dir + files — these exports contain patient data.
        @chmod($dir, 0700);
        $this->purgeOlderThan(self::RETENTION_SECONDS);

        $safe = preg_replace('/[^A-Za-z0-9._-]+/', '-', basename($fileKey));
        if (!is_string($safe) || $safe === '' || $safe === '.' || $safe === '..') {
            $safe = 'export.dat';
        }
        $path = $dir . '/' . $safe;
        if (file_put_contents($path, $content) === false) {
            throw new \RuntimeException('Unable to write export file');
        }
        @chmod($path, 0600);

        return $path;
    }

    /** Is this storage path a readable file that actually lives inside this namespace? */
    public function isStored(string $storagePath): bool
    {
        if ($storagePath === '' || !is_file($storagePath) || !is_readable($storagePath)) {
            return false;
        }

        return $this->isInsideRoot($storagePath);
    }

    /**
     * Read a stored export back. Refuses paths outside this namespace's root, so a
     * tampered path persisted in a job row can never read arbitrary server files.
     */
    public function read(string $storagePath): string
    {
        if (!$this->isStored($storagePath)) {
            throw new \RuntimeException('Export file is missing', 404);
        }
        $content = file_get_contents($storagePath);
        if ($content === false) {
            throw new \RuntimeException('Unable to read export file', 500);
        }

        return $content;
    }

    public function delete(string $storagePath): void
    {
        if ($this->isStored($storagePath)) {
            @unlink($storagePath);
        }
    }

    /**
     * Delete stored files older than the given age. Best-effort; returns how many
     * files were removed. Called from put() and from the job worker loop.
     */
    public function purgeOlderThan(int $seconds = self::RETENTION_SECONDS): int
    {
        $this->assertKnownDriver();
        $dir = $this->rootDir();
        if (!is_dir($dir)) {
            return 0;
        }
        $cutoff = time() - max(0, $seconds);
        $purged = 0;
        foreach (glob($dir . '/*') ?: [] as $file) {
            if (is_file($file) && (int) @filemtime($file) < $cutoff && @unlink($file)) {
                $purged++;
            }
        }

        return $purged;
    }

    private function rootDir(): string
    {
        if ($this->rootOverride !== null) {
            return rtrim($this->rootOverride, '/\\') . '/' . $this->namespace;
        }
        $siteDir = $GLOBALS['OE_SITE_DIR'] ?? null;
        if (!is_string($siteDir) || $siteDir === '') {
            throw new \RuntimeException('Site directory is not configured');
        }

        return $siteDir . '/documents/' . $this->namespace;
    }

    private function isInsideRoot(string $path): bool
    {
        $realRoot = realpath($this->rootDir());
        $realPath = realpath($path);
        if ($realRoot === false || $realPath === false) {
            return false;
        }

        return str_starts_with($realPath, $realRoot . DIRECTORY_SEPARATOR);
    }

    /**
     * Only 'local' exists today. Fail loud on anything else: silently writing PHI
     * to local disk when an operator configured object storage would scatter
     * patient data across web servers (and 404 behind a load balancer).
     */
    private function assertKnownDriver(): void
    {
        if ($this->resolveDriverName() !== 'local') {
            throw new \RuntimeException(
                'Unsupported export_storage_driver "' . $this->resolveDriverName()
                . '" — only "local" is implemented'
            );
        }
    }

    private function resolveDriverName(): string
    {
        if ($this->driverName === null) {
            if ($this->driverOverride !== null) {
                $this->driverName = $this->driverOverride;
            } else {
                try {
                    $configured = (new ClinicConfigService())->get('export_storage_driver', 'local');
                    $this->driverName = is_string($configured) && $configured !== '' ? $configured : 'local';
                } catch (\Throwable) {
                    // No DB (e.g. isolated unit test) — the safe default.
                    $this->driverName = 'local';
                }
            }
        }

        return $this->driverName;
    }
}

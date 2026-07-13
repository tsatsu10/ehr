<?php

/**
 * Cloud sync-folder detection for backups (GAP-C C6 follow-up).
 *
 * The secure, no-OAuth way to get backups off-site: point `backup_target_dir` at
 * a folder that a cloud desktop app (Google Drive for Desktop, OneDrive, Dropbox)
 * already syncs. We never touch the user's cloud login or tokens — the provider's
 * own app handles auth + upload, and our archive is already encrypted before it
 * lands there. This service just detects those folders (so the admin can pick one)
 * and classifies whether a chosen target actually syncs to the cloud.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class BackupCloudTargetService
{
    /**
     * Cloud sync folders that exist on this machine.
     *
     * @return array<int, array{provider: string, path: string}>
     */
    public function detectFolders(): array
    {
        $home = $this->homeDir();
        $found = [];
        $seen = [];

        foreach ($this->candidatePatterns($home) as $provider => $patterns) {
            foreach ($patterns as $pattern) {
                foreach (glob($pattern, GLOB_ONLYDIR | GLOB_NOSORT) ?: [] as $dir) {
                    $norm = rtrim(str_replace('\\', '/', $dir), '/');
                    if ($norm === '' || isset($seen[$norm]) || !is_dir($dir)) {
                        continue;
                    }
                    $seen[$norm] = true;
                    $found[] = ['provider' => $provider, 'path' => $dir];
                }
            }
        }

        return $found;
    }

    /**
     * Which cloud (if any) a target directory syncs to. Null = not a cloud folder.
     */
    public function classify(string $dir): ?string
    {
        $n = strtolower(str_replace('\\', '/', trim($dir)));
        if ($n === '') {
            return null;
        }
        if (str_contains($n, '/onedrive')) {
            return 'OneDrive';
        }
        if (str_contains($n, '/dropbox')) {
            return 'Dropbox';
        }
        if (str_contains($n, 'google drive') || str_contains($n, '/googledrive') || str_contains($n, '/my drive')) {
            return 'Google Drive';
        }

        return null;
    }

    private function homeDir(): string
    {
        $home = $this->env('USERPROFILE');
        if ($home === '') {
            $hd = $this->env('HOMEDRIVE');
            $hp = $this->env('HOMEPATH');
            if ($hd !== '' && $hp !== '') {
                $home = $hd . $hp;
            }
        }
        if ($home === '') {
            $home = $this->env('HOME'); // Linux/macOS
        }

        return rtrim(str_replace('\\', '/', $home), '/');
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function candidatePatterns(string $home): array
    {
        $oneDrive = [];
        $odEnv = $this->env('OneDrive');
        if ($odEnv !== '') {
            $oneDrive[] = str_replace('\\', '/', $odEnv);
        }
        if ($home !== '') {
            // Match "OneDrive" and business variants like "OneDrive - Contoso".
            $oneDrive[] = $home . '/OneDrive';
            $oneDrive[] = $home . '/OneDrive*';
        }

        $patterns = ['OneDrive' => $oneDrive];
        if ($home !== '') {
            $patterns['Google Drive'] = [$home . '/Google Drive', $home . '/GoogleDrive', $home . '/My Drive'];
            $patterns['Dropbox'] = [$home . '/Dropbox'];
        }

        return $patterns;
    }

    private function env(string $key): string
    {
        $val = getenv($key);
        if ($val === false || $val === '') {
            $val = (string) ($_SERVER[$key] ?? ($_ENV[$key] ?? ''));
        }

        return trim((string) $val);
    }
}

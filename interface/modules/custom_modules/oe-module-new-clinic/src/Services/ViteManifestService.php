<?php

/**
 * Resolves the full set of CSS assets a Vite island entry needs.
 *
 * Vite/Rollup hoists code shared by more than one entry into a separate
 * chunk, and that chunk's CSS is emitted as its own hashed file (e.g.
 * assets/main-<hash>.css). The New Clinic Twig pages historically linked a
 * single predictable "<entry>.css", which silently drops any shared-chunk
 * CSS. This service reads the build manifest and returns the entry's own CSS
 * plus every imported chunk's CSS, in dependency-first order, so pages can
 * link all of them.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class ViteManifestService
{
    private const MANIFEST_RELATIVE_PATH = '/public/assets/modern/.vite/manifest.json';

    /** @var array<string, mixed>|null */
    private ?array $manifest = null;

    private string $manifestPath;

    public function __construct(?string $manifestPath = null)
    {
        $this->manifestPath = $manifestPath
            ?? dirname(__DIR__, 2) . self::MANIFEST_RELATIVE_PATH;
    }

    /**
     * Ordered, de-duplicated CSS file paths (relative to public/assets/modern/)
     * needed to fully style the given island entry.
     *
     * @return array<int, string>
     */
    public function cssFilesForIsland(string $islandName): array
    {
        $manifest = $this->load();
        if ($manifest === []) {
            return [];
        }

        $entryKey = $this->resolveEntryKey($manifest, $islandName);
        if ($entryKey === null) {
            return [];
        }

        $files = [];
        $visited = [];
        $this->collectCss($manifest, $entryKey, $files, $visited);

        return array_values(array_unique($files));
    }

    /**
     * @param array<string, mixed> $manifest
     * @param array<int, string> $files Dependency-first accumulator (by reference)
     * @param array<string, bool> $visited
     */
    private function collectCss(array $manifest, string $key, array &$files, array &$visited): void
    {
        if (isset($visited[$key])) {
            return;
        }
        $visited[$key] = true;

        $node = $manifest[$key] ?? null;
        if (!is_array($node)) {
            return;
        }

        // Imported chunks (dependencies) contribute their CSS first so the
        // entry's own CSS wins on equal specificity.
        foreach ((array) ($node['imports'] ?? []) as $importKey) {
            if (is_string($importKey)) {
                $this->collectCss($manifest, $importKey, $files, $visited);
            }
        }

        foreach ((array) ($node['css'] ?? []) as $cssFile) {
            if (is_string($cssFile) && $cssFile !== '') {
                $files[] = $cssFile;
            }
        }
    }

    /**
     * @param array<string, mixed> $manifest
     */
    private function resolveEntryKey(array $manifest, string $islandName): ?string
    {
        $srcKey = 'src/islands/' . $islandName . '/index.tsx';
        if (isset($manifest[$srcKey])) {
            return $srcKey;
        }

        foreach ($manifest as $key => $node) {
            if (is_array($node) && ($node['isEntry'] ?? false) && ($node['name'] ?? null) === $islandName) {
                return $key;
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function load(): array
    {
        if ($this->manifest !== null) {
            return $this->manifest;
        }

        if (!is_file($this->manifestPath)) {
            return $this->manifest = [];
        }

        $raw = file_get_contents($this->manifestPath);
        if ($raw === false) {
            return $this->manifest = [];
        }

        $decoded = json_decode($raw, true);

        return $this->manifest = is_array($decoded) ? $decoded : [];
    }
}

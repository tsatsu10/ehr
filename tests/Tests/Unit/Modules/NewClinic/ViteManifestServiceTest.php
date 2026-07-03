<?php

/**
 * Unit tests for Vite manifest CSS resolution (shared chunk + entry order)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ViteManifestService;
use PHPUnit\Framework\TestCase;

class ViteManifestServiceTest extends TestCase
{
    private string $tempManifest;

    protected function setUp(): void
    {
        $this->tempManifest = sys_get_temp_dir() . '/oe-nc-vite-manifest-' . uniqid('', true) . '.json';
    }

    protected function tearDown(): void
    {
        if (is_file($this->tempManifest)) {
            unlink($this->tempManifest);
        }
    }

    public function testCssFilesForIslandReturnsDependencyCssBeforeEntryCss(): void
    {
        $manifest = [
            '_shared-main.js' => [
                'file' => 'chunks/shared-main.js',
                'css' => ['assets/main-shared.css'],
            ],
            'src/islands/report-hub/index.tsx' => [
                'file' => 'report-hub.js',
                'name' => 'report-hub',
                'src' => 'src/islands/report-hub/index.tsx',
                'isEntry' => true,
                'imports' => ['_shared-main.js'],
                'css' => ['report-hub.css'],
            ],
        ];

        file_put_contents($this->tempManifest, json_encode($manifest, JSON_THROW_ON_ERROR));

        $service = new ViteManifestService($this->tempManifest);
        $files = $service->cssFilesForIsland('report-hub');

        $this->assertSame(['assets/main-shared.css', 'report-hub.css'], $files);
    }

    public function testCssFilesForIslandReturnsEmptyWhenManifestMissing(): void
    {
        $service = new ViteManifestService($this->tempManifest . '-missing');

        $this->assertSame([], $service->cssFilesForIsland('report-hub'));
    }

    public function testCssFilesForIslandDedupesRepeatedChunkCss(): void
    {
        $manifest = [
            '_chunk-a.js' => [
                'file' => 'chunks/chunk-a.js',
                'css' => ['assets/shared.css'],
            ],
            '_chunk-b.js' => [
                'file' => 'chunks/chunk-b.js',
                'imports' => ['_chunk-a.js'],
                'css' => ['assets/shared.css'],
            ],
            'src/islands/daily-reports/index.tsx' => [
                'file' => 'daily-reports.js',
                'name' => 'daily-reports',
                'src' => 'src/islands/daily-reports/index.tsx',
                'isEntry' => true,
                'imports' => ['_chunk-a.js', '_chunk-b.js'],
                'css' => ['daily-reports.css'],
            ],
        ];

        file_put_contents($this->tempManifest, json_encode($manifest, JSON_THROW_ON_ERROR));

        $service = new ViteManifestService($this->tempManifest);
        $files = $service->cssFilesForIsland('daily-reports');

        $this->assertSame(['assets/shared.css', 'daily-reports.css'], $files);
    }
}

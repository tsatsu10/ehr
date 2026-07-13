<?php

/**
 * Ensures all New Clinic public PHP entry points bootstrap OpenEMR consistently.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

class PublicBootstrapIncludeTest extends TestCase
{
    public function testAllPublicPhpEntryPointsIncludeBootstrap(): void
    {
        $publicDir = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/public';
        $this->assertDirectoryExists($publicDir);

        $missing = [];
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($publicDir, \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $fileInfo) {
            if (!$fileInfo->isFile() || $fileInfo->getExtension() !== 'php') {
                continue;
            }

            $basename = $fileInfo->getBasename('.php');
            if ($basename === 'bootstrap') {
                continue;
            }
            // SCALE-4.4 — health.php deliberately bootstraps NOTHING: no session
            // (lock-free), no auth, raw mysqli. It must stay honest when the app
            // tier is sick, and it exposes no PHI, so the bootstrap rule does not
            // apply. Every OTHER public entry point still must bootstrap.
            if ($basename === 'health') {
                continue;
            }

            $contents = (string) file_get_contents($fileInfo->getPathname());
            if (!str_contains($contents, 'bootstrap.php')) {
                $missing[] = str_replace('\\', '/', substr($fileInfo->getPathname(), strlen($publicDir) + 1));
            }
        }

        $this->assertSame([], $missing, 'Public PHP files must require bootstrap.php');
    }

    public function testBootstrapSeedsCsrfKeyWhenSessionAuthenticated(): void
    {
        $bootstrap = (string) file_get_contents(
            dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/bootstrap.php'
        );

        $this->assertStringContainsString('CsrfUtils::setupCsrfKey', $bootstrap);
        $this->assertStringContainsString('csrf_private_key', $bootstrap);
        $this->assertStringContainsString('authUserID', $bootstrap);
    }
}

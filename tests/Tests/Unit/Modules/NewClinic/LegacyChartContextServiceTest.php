<?php

/**
 * Unit tests for legacy chart context overlay (V1.2-CTX)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\LegacyChartContextService;
use PHPUnit\Framework\TestCase;

class LegacyChartContextServiceTest extends TestCase
{
    public function testAllowlistIncludesCorePatientFileScreens(): void
    {
        $reflection = new \ReflectionClass(LegacyChartContextService::class);
        $property = $reflection->getConstant('ALLOWLIST_SUFFIXES');

        $this->assertIsArray($property);
        $this->assertContains('/patient_file/summary/demographics.php', $property);
        $this->assertContains('/reports/pat_ledger.php', $property);
    }

    public function testOverlayGateUsesFeatureFlag(): void
    {
        $method = new \ReflectionMethod(LegacyChartContextService::class, 'isOverlayEnabled');
        $source = file_get_contents($method->getFileName());
        $lines = explode("\n", $source);
        $body = implode("\n", array_slice(
            $lines,
            $method->getStartLine() - 1,
            $method->getEndLine() - $method->getStartLine() + 1
        ));

        $this->assertStringContainsString('enable_legacy_patient_context_overlay', $body);
    }

    public function testResolveActivePidFromSetPidQueryParam(): void
    {
        unset($_SESSION['pid']);
        $_GET['set_pid'] = '42';

        $service = new LegacyChartContextService();
        $method = new \ReflectionMethod(LegacyChartContextService::class, 'resolveActivePid');
        $pid = $method->invoke($service);

        $this->assertSame(42, $pid);
        $this->assertSame(42, (int) ($_SESSION['pid'] ?? 0));

        unset($_GET['set_pid'], $_SESSION['pid']);
    }

    public function testEmbeddedChartFragmentSkipsBuffering(): void
    {
        $_SERVER['SCRIPT_NAME'] = '/openemr/interface/patient_file/summary/stats.php';
        $_POST['embeddedScreen'] = true;
        $_SESSION['pid'] = 4;

        $service = new LegacyChartContextService();
        $this->assertFalse($service->shouldBufferCurrentRequest());

        unset($_SERVER['SCRIPT_NAME'], $_POST['embeddedScreen'], $_SESSION['pid']);
    }
}

<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\ProcedureOrderDeepLinkService;
use OpenEMR\Modules\NewClinic\Services\ProcedureOrderEnginePolicy;
use PHPUnit\Framework\TestCase;

class ProcedureOrderDeepLinkServiceTest extends TestCase
{
    private ProcedureOrderDeepLinkService $service;

    protected function setUp(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $this->service = new ProcedureOrderDeepLinkService();
    }

    /** A policy stub with the native proc-order engine forced off. */
    private function nativeDisabledPolicy(): ProcedureOrderEnginePolicy
    {
        return new class extends ProcedureOrderEnginePolicy {
            public function isNativeProcOrderEnabled(?int $facilityId = null): bool
            {
                return false;
            }
        };
    }

    public function testBuildNewOrderUrlUsesEncounterTopShell(): void
    {
        $url = $this->service->buildNewOrderUrl(42, 99);

        $this->assertStringContainsString('/interface/patient_file/encounter/encounter_top.php', $url);
        $this->assertStringContainsString('formname=procedure_order', $url);
        $this->assertStringContainsString('set_pid=42', $url);
        $this->assertStringContainsString('set_encounter=99', $url);
    }

    public function testBuildNewOrderUrlWithReturnUsesBridge(): void
    {
        $return = '/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/doctor.php';
        $url = $this->service->buildNewOrderUrl(42, 99, $return);

        $this->assertStringContainsString('/clinical-form-bridge.php', $url);
        $this->assertStringContainsString('formname=procedure_order', $url);
        $this->assertStringContainsString('pid=42', $url);
        $this->assertStringContainsString('encounter=99', $url);
        $this->assertStringContainsString('return=', $url);
        $this->assertStringNotContainsString('form_id=', $url);
    }

    public function testBuildEditOrderUrlUsesBridgeWithFormId(): void
    {
        $return = '/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/lab-ops/index.php';
        $url = $this->service->buildEditOrderUrl(42, 99, 4, $return);

        $this->assertStringContainsString('/clinical-form-bridge.php', $url);
        $this->assertStringContainsString('form_id=4', $url);
        $this->assertStringContainsString('pid=42', $url);
        $this->assertStringContainsString('encounter=99', $url);
    }

    public function testSanitizeReturnUrlRejectsExternalTargets(): void
    {
        $safe = $this->service->sanitizeReturnUrl('https://evil.example/phish');

        $this->assertStringEndsWith('/doctor.php', $safe);
    }

    public function testBuildNewOrderUrlRejectsMissingEncounter(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('no encounter');

        $this->service->buildNewOrderUrl(42, 0);
    }

    public function testPreferNativeNewOrderFallsBackToStockWhenNativeDisabled(): void
    {
        $service = new ProcedureOrderDeepLinkService($this->nativeDisabledPolicy());
        $return = '/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/patient-chart.php?pid=42&tab=clinical';

        $url = $service->buildNewOrderUrlPreferNative(42, 99, 'chart', $return);

        // Native OFF (governing invariant default) → stock bridge, never proc-order.php.
        $this->assertStringContainsString('/clinical-form-bridge.php', $url);
        $this->assertStringNotContainsString('proc-order.php', $url);
        $this->assertStringContainsString('return=', $url);
    }

    public function testPreferNativeEditOrderFallsBackToStockWhenNativeDisabled(): void
    {
        $service = new ProcedureOrderDeepLinkService($this->nativeDisabledPolicy());
        $return = '/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/lab-ops/index.php';

        $url = $service->buildEditOrderUrlPreferNative(42, 99, 4, 'labops', $return);

        $this->assertStringContainsString('/clinical-form-bridge.php', $url);
        $this->assertStringContainsString('form_id=4', $url);
        $this->assertStringNotContainsString('proc-order.php', $url);
    }

    public function testBuildPendingOrdersUrl(): void
    {
        $url = $this->service->buildPendingOrdersUrl(42);

        $this->assertStringContainsString('/interface/orders/pending_orders.php', $url);
        $this->assertStringContainsString('patient_id=42', $url);
    }
}

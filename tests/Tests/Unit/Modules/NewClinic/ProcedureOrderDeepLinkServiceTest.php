<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\ProcedureOrderDeepLinkService;
use PHPUnit\Framework\TestCase;

class ProcedureOrderDeepLinkServiceTest extends TestCase
{
    private ProcedureOrderDeepLinkService $service;

    protected function setUp(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $this->service = new ProcedureOrderDeepLinkService();
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

    public function testBuildPendingOrdersUrl(): void
    {
        $url = $this->service->buildPendingOrdersUrl(42);

        $this->assertStringContainsString('/interface/orders/pending_orders.php', $url);
        $this->assertStringContainsString('patient_id=42', $url);
    }
}

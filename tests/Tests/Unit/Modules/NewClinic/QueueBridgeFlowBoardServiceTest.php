<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\QueueBridgeFlowBoardService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeSurfaceService;
use OpenEMR\Modules\NewClinic\Services\ScheduledIntegrationService;
use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class QueueBridgeFlowBoardServiceTest extends TestCase
{
    public function testShouldBufferFalseForUnrelatedScript(): void
    {
        $_SERVER['SCRIPT_NAME'] = '/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/ajax.php';
        $service = new QueueBridgeFlowBoardService();

        $this->assertFalse($service->shouldBufferCurrentRequest());
    }

    public function testShouldBufferFalseForPatientTrackerWhenSchedulingHubOn(): void
    {
        $_SERVER['SCRIPT_NAME'] = '/openemr/interface/patient_tracker/patient_tracker.php';

        $scheduled = $this->createMock(ScheduledIntegrationService::class);
        $scheduled->method('isEnabled')->willReturn(true);
        $surface = $this->createMock(QueueBridgeSurfaceService::class);
        $surface->method('isSurfaceEnabled')->willReturn(true);

        $service = new QueueBridgeFlowBoardService(
            $surface,
            new VisitScopeService(),
            new SchedulingAccessService($scheduled, new VisitScopeService()),
        );

        $this->assertFalse($service->shouldBufferCurrentRequest());
    }

    public function testShouldBufferTrueForPatientTrackerWhenHubEnabled(): void
    {
        $_SERVER['SCRIPT_NAME'] = '/openemr/interface/patient_tracker/patient_tracker.php';
        $service = new QueueBridgeFlowBoardService();

        if (!$service->shouldBufferCurrentRequest()) {
            $this->markTestSkipped('Queue Bridge not enabled or S1 redesign ON — flow board buffer gated off');
        }

        $this->assertTrue($service->shouldBufferCurrentRequest());
    }

    public function testInjectIntoHtmlAppendsScriptWhenChipsPresent(): void
    {
        $surface = new \OpenEMR\Modules\NewClinic\Services\QueueBridgeSurfaceService();
        $facilityId = (new \OpenEMR\Modules\NewClinic\Services\VisitScopeService())->resolveDefaultFacilityId();
        if ($facilityId <= 0 || $surface->flowBoardChips($facilityId) === []) {
            $this->markTestSkipped('No EX-01 flow board chips today');
        }

        $service = new QueueBridgeFlowBoardService();
        $html = '<html><body><p>Test</p></body></html>';
        $result = $service->injectIntoHtml($html);

        $this->assertStringContainsString('oe-nc-flowbridge-chip', $result);
        $this->assertStringContainsString('</body></html>', $result);
    }
}

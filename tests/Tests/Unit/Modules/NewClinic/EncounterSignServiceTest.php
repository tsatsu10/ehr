<?php

/**
 * Unit tests for encounter signature helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\EncounterSignService;
use PHPUnit\Framework\TestCase;

class EncounterSignServiceTest extends TestCase
{
    public function testBuildEncounterUrl(): void
    {
        $url = EncounterSignService::buildEncounterUrl('/openemr', 12, 99);

        $this->assertStringContainsString('/interface/patient_file/encounter/encounter_top.php', $url);
        $this->assertStringContainsString('set_pid=12', $url);
        $this->assertStringContainsString('set_encounter=99', $url);
    }

    public function testUnsignedReportStatesIncludeHandoffStates(): void
    {
        $states = EncounterSignService::UNSIGNED_REPORT_STATES;

        $this->assertContains('with_doctor', $states);
        $this->assertContains('ready_for_payment', $states);
    }

    public function testBatchEncounterDocumentationSignedEmpty(): void
    {
        $service = new EncounterSignService();
        $this->assertSame([], $service->batchEncounterDocumentationSigned([]));
    }

    public function testGetProfileUnsignedReasonForOpd(): void
    {
        $service = new EncounterSignService();
        $this->assertSame('Visit not found', $service->getProfileUnsignedReason(0));
    }

    public function testIsConsultSignedDelegatesToEncounterCheck(): void
    {
        $service = new EncounterSignService();
        $this->assertFalse($service->isConsultSigned(0));
    }
}

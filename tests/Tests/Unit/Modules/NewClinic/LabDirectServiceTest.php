<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocDocumentationStatusService;
use OpenEMR\Modules\NewClinic\Services\LabDirectService;
use PHPUnit\Framework\TestCase;

class LabDirectServiceTest extends TestCase
{
    public function testIntakePayloadNullForFullOpdVisit(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(1);

        $service = new LabDirectService($config);
        $payload = $service->intakePayload(
            ['service_profile' => 'full_opd', 'facility_id' => 1],
            1,
            10,
        );

        $this->assertNull($payload);
    }

    public function testIntakePayloadForLabDirectVisit(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(1);
        $config->method('get')->willReturn('lab_intake');

        $docStatus = $this->createMock(ClinicalDocDocumentationStatusService::class);
        $docStatus->method('getStatusForVisit')->willReturn([
            'hub_enabled' => true,
            'encounter_signed' => false,
            'unsigned_required' => [
                [
                    'formdir' => 'lab_intake',
                    'title' => 'Lab intake',
                    'started' => true,
                ],
            ],
            'documentation_hub_url' => '/clinical-doc/',
        ]);

        $service = new LabDirectService($config, $docStatus);
        $payload = $service->intakePayload(
            [
                'service_profile' => 'lab_direct',
                'facility_id' => 1,
                'visit_type_id' => 3,
                'referral_document_id' => null,
            ],
            1,
            10,
            2,
        );

        $this->assertNotNull($payload);
        $this->assertTrue($payload['enabled']);
        $this->assertFalse($payload['lab_intake_signed']);
        $this->assertTrue($payload['lab_intake_started']);
        $this->assertSame(2, $payload['order_count']);
    }

    public function testReturnsNoPayloadWhenAncillaryDisabled(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(0);

        $service = new LabDirectService($config);
        $payload = $service->intakePayload(
            ['service_profile' => 'lab_direct', 'facility_id' => 1],
            1,
            10,
        );

        $this->assertNull($payload);
    }
}

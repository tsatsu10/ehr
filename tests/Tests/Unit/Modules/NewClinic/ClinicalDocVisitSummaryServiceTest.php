<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicalDocAccessService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocVisitSummaryService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\EncounterSignService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use PHPUnit\Framework\TestCase;

class ClinicalDocVisitSummaryServiceTest extends TestCase
{
    private function hubEnabledDoctorAccess(): ClinicalDocAccessService
    {
        $config = new ClinicConfigService();
        $config->set('enable_clinical_doc_hub', '1', 0);

        return new ClinicalDocAccessService(
            config: $config,
            aclChecker: static fn (string $section, string $aco): bool =>
                $section === 'new_clinic' && $aco === 'new_doctor',
        );
    }

    public function testGetSignStatusRequiresEncounter(): void
    {
        $queue = new class extends VisitQueueService {
            public function getVisitForActor(int $visitId): array
            {
                return [
                    'state' => 'in_triage',
                    'pid' => 1,
                    'encounter' => 0,
                ];
            }
        };

        $service = new ClinicalDocVisitSummaryService(
            access: $this->hubEnabledDoctorAccess(),
            queueService: $queue,
        );

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('No encounter on visit');

        $service->getSignStatus(7);
    }

    public function testGetSignStatusReturnsEncounterSignedFlag(): void
    {
        $queue = new class extends VisitQueueService {
            public function getVisitForActor(int $visitId): array
            {
                return [
                    'state' => 'with_doctor',
                    'pid' => 1,
                    'encounter' => 55,
                ];
            }
        };

        $sign = new class extends EncounterSignService {
            public function isEncounterDocumentationSigned(int $encounterId): bool
            {
                return $encounterId === 55;
            }
        };

        $service = new ClinicalDocVisitSummaryService(
            access: $this->hubEnabledDoctorAccess(),
            queueService: $queue,
            signService: $sign,
        );

        $status = $service->getSignStatus(7);

        $this->assertTrue($status['encounter_signed']);
        $this->assertSame(55, $status['encounter']);
        $this->assertSame(7, $status['visit_id']);
    }
}

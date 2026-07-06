<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AdminFormBundleService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocAccessService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocCatalogService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocDocumentationStatusService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocVisitSummaryService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\EncounterSignService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use PHPUnit\Framework\TestCase;

class ClinicalDocVisitSummaryServiceTest extends TestCase
{
    private ?string $previousClinicalDocHub = null;
    private ?ClinicConfigService $liveConfig = null;

    protected function tearDown(): void
    {
        if ($this->liveConfig !== null && $this->previousClinicalDocHub !== null) {
            $this->liveConfig->set('enable_clinical_doc_hub', $this->previousClinicalDocHub, 0);
        }
    }

    private function hubEnabledDoctorAccess(): ClinicalDocAccessService
    {
        $this->liveConfig = new ClinicConfigService();
        $this->previousClinicalDocHub = $this->liveConfig->get('enable_clinical_doc_hub', '0', 0);
        $this->liveConfig->set('enable_clinical_doc_hub', '1', 0);

        return new ClinicalDocAccessService(
            config: $this->liveConfig,
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
            public function isVisitDocumentationSigned(array $visit, ?int $facilityId = null): bool
            {
                return (int) ($visit['encounter'] ?? 0) === 55;
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

    public function testVisitLensIncludesSignOverviewAndAddableForms(): void
    {
        $queue = new class extends VisitQueueService {
            public function getVisitForActor(int $visitId): array
            {
                return [
                    'id' => $visitId,
                    'state' => 'with_doctor',
                    'pid' => 1,
                    'encounter' => 55,
                    'queue_number' => 12,
                    'service_profile' => 'full_opd',
                    'facility_id' => 0,
                ];
            }
        };

        $sign = new class extends EncounterSignService {
            public function isVisitDocumentationSigned(array $visit, ?int $facilityId = null): bool
            {
                return false;
            }
        };

        $access = $this->hubEnabledDoctorAccess();
        $catalog = new ClinicalDocCatalogService(access: $access);

        $service = new ClinicalDocVisitSummaryService(
            access: $access,
            catalog: $catalog,
            docStatus: new ClinicalDocDocumentationStatusService(catalog: $catalog),
            formBundle: new AdminFormBundleService(catalog: $catalog),
            queueService: $queue,
            signService: $sign,
        );

        $summary = $service->getVisitSummary(7, 1, 'visit');

        $this->assertArrayHasKey('sign_overview', $summary);
        $this->assertArrayHasKey('addable_forms', $summary);
        $this->assertIsArray($summary['sign_overview']['required_forms']);
        $this->assertIsArray($summary['addable_forms']);
        $this->assertArrayHasKey('lab_panel_order_enabled', $summary);
        $this->assertSame('full_opd', $summary['visit']['service_profile']);
    }
}

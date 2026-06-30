<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Dto\EncounterSessionDto;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocAccessService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocCatalogService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocFormOpenService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\EncounterSessionService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use PHPUnit\Framework\TestCase;

class ClinicalDocFormOpenServiceTest extends TestCase
{
    private function hubEnabledDoctorAccess(): ClinicalDocAccessService
    {
        return new ClinicalDocAccessService(
            config: $this->hubEnabledConfig(),
            aclChecker: static fn (string $section, string $aco): bool =>
                $section === 'new_clinic' && $aco === 'new_doctor',
        );
    }

    private function hubEnabledConfig(): ClinicConfigService
    {
        $config = new ClinicConfigService();
        $config->set('enable_clinical_doc_hub', '1', 0);

        return $config;
    }

    /**
     * @return array<string, mixed>
     */
    private function triageVisit(int $visitId = 42): array
    {
        return [
            'id' => $visitId,
            'state' => 'in_triage',
            'pid' => 1,
            'encounter' => 99999,
            'facility_id' => 0,
            'assigned_provider_id' => 0,
        ];
    }

    public function testRejectsWriteWhenOnlyHubReadAcl(): void
    {
        $access = new ClinicalDocAccessService(
            config: $this->hubEnabledConfig(),
            aclChecker: static fn (string $section, string $aco): bool =>
                $section === 'new_clinic' && $aco === 'new_clinical_doc_hub',
        );
        $service = new ClinicalDocFormOpenService(access: $access);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Forbidden');

        $service->openForm(['visit_id' => 1, 'formdir' => 'vitals'], 1);
    }

    public function testRejectsEditWhenFormNotOnEncounter(): void
    {
        $visit = $this->triageVisit();
        $queueStub = new class ($visit) extends VisitQueueService {
            /** @param array<string, mixed> $visit */
            public function __construct(private readonly array $visit)
            {
            }

            public function getVisitForActor(int $visitId): array
            {
                return $this->visit;
            }
        };

        $session = new class extends EncounterSessionService {
            public function bindForVisit(int $visitId, int $actorUserId): EncounterSessionDto
            {
                return new EncounterSessionDto($visitId, 1, 99999, 'in_triage');
            }

            public function assertBound(int $visitId): void
            {
            }
        };

        $access = $this->hubEnabledDoctorAccess();
        $catalog = new class ($access, $this->hubEnabledConfig()) extends ClinicalDocCatalogService {
            public function __construct(ClinicalDocAccessService $access, ClinicConfigService $config)
            {
                parent::__construct(access: $access, config: $config);
            }

            public function resolveSourceLensForFormdir(string $formdir, ?int $facilityId = null): ?string
            {
                return 'consult';
            }

            public function isAllowedFormdir(string $formdir, ?int $facilityId = null): bool
            {
                return true;
            }

            public function resolveRegistryDirectory(string $formdir): string
            {
                return 'soap';
            }
        };

        $service = new ClinicalDocFormOpenService(
            access: $access,
            catalog: $catalog,
            queueService: $queueStub,
            encounterSession: $session,
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('not on this visit');

        $service->openForm([
            'visit_id' => 42,
            'formdir' => 'soap',
            'lens' => 'consult',
            'action' => 'edit',
            'form_id' => 123456,
        ], 1);
    }

    public function testNurseCannotOpenConsultFormWithoutConsultAcl(): void
    {
        $access = new ClinicalDocAccessService(
            config: $this->hubEnabledConfig(),
            aclChecker: static fn (string $section, string $aco): bool =>
                $section === 'new_clinic'
                && in_array($aco, ['new_nurse', 'new_clinical_doc_nursing'], true),
        );

        $visit = $this->triageVisit();
        $queueStub = new class ($visit) extends VisitQueueService {
            /** @param array<string, mixed> $visit */
            public function __construct(private readonly array $visit)
            {
            }

            public function getVisitForActor(int $visitId): array
            {
                return $this->visit;
            }
        };

        $service = new ClinicalDocFormOpenService(
            access: $access,
            catalog: new ClinicalDocCatalogService(access: $access, config: $this->hubEnabledConfig()),
            queueService: $queueStub,
        );

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Forbidden');

        $service->openForm([
            'visit_id' => 42,
            'formdir' => 'soap',
            'lens' => 'visit',
            'action' => 'new',
        ], 2);
    }
}

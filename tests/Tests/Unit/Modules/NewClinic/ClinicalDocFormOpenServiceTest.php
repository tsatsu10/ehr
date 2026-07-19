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
use OpenEMR\Modules\NewClinic\Services\EncounterNoteService;
use OpenEMR\Modules\NewClinic\Services\EncounterSessionService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Common\Database\QueryUtils;
use PHPUnit\Framework\TestCase;

class ClinicalDocFormOpenServiceTest extends TestCase
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
        return new ClinicalDocAccessService(
            config: $this->hubEnabledConfig(),
            aclChecker: static fn (string $section, string $aco): bool =>
                $section === 'new_clinic' && $aco === 'new_doctor',
        );
    }

    private function hubEnabledConfig(): ClinicConfigService
    {
        $this->liveConfig = new ClinicConfigService();
        $this->previousClinicalDocHub = $this->liveConfig->get('enable_clinical_doc_hub', '0', 0);
        $this->liveConfig->set('enable_clinical_doc_hub', '1', 0);

        return $this->liveConfig;
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

    public function testAcceptsEditWhenFormInstanceIsOnEncounter(): void
    {
        // The card payload (and every edit URL) carries forms.form_id — the
        // per-formdir data-table id — NOT forms.id. Rows where the two differ
        // must still pass the encounter-binding guard.
        $formsRowId = (int) QueryUtils::sqlInsert(
            'INSERT INTO forms (date, encounter, form_name, form_id, pid, user, groupname, authorized, deleted, formdir)
             VALUES (NOW(), ?, ?, ?, ?, ?, ?, 1, 0, ?)',
            [99999, 'Test SOAP', 987654321, 1, 'phpunit', 'Default', 'soap']
        );

        try {
            $service = new ClinicalDocFormOpenService(access: $this->hubEnabledDoctorAccess());
            $assert = new \ReflectionMethod($service, 'assertFormInstanceOnEncounter');

            $assert->invoke($service, 987654321, 99999, 1, 'soap');
            $this->addToAssertionCount(1);

            // Same form_id on the wrong encounter must still be rejected.
            $this->expectException(\InvalidArgumentException::class);
            $this->expectExceptionMessage('not on this visit');
            $assert->invoke($service, 987654321, 88888, 1, 'soap');
        } finally {
            QueryUtils::sqlStatementThrowException('DELETE FROM forms WHERE id = ?', [$formsRowId]);
        }
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

    public function testClosedVisitRoutesOpenThroughBridgeOnlyEncounterPath(): void
    {
        // Post-visit corrections: a completed/paid/cancelled visit is off the queue
        // FSM, so opening a form on it must take the same bridge-only route as a
        // visit-less encounter instead of refusing with the clinical-state error.
        $encounterId = 987600123;
        $encRowId = (int) QueryUtils::sqlInsert(
            'INSERT INTO form_encounter (date, reason, facility_id, pid, encounter) VALUES (NOW(), ?, 0, 1, ?)',
            ['NC closed-visit open test', $encounterId]
        );

        try {
            $visit = [
                'id' => 77,
                'state' => 'completed',
                'pid' => 1,
                'encounter' => $encounterId,
                'facility_id' => 0,
                'assigned_provider_id' => 0,
            ];
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
                public function bindForEncounter(int $encounterId, int $actorUserId): EncounterSessionDto
                {
                    return new EncounterSessionDto(0, 1, $encounterId, 'completed');
                }
            };

            $access = $this->hubEnabledDoctorAccess();
            $catalog = new class ($access, $this->hubEnabledConfig()) extends ClinicalDocCatalogService {
                public function __construct(ClinicalDocAccessService $access, ClinicConfigService $config)
                {
                    parent::__construct(access: $access, config: $config);
                }

                public function resolveRegistryDirectory(string $formdir): string
                {
                    return 'soap';
                }

                public function isQueueOnlyFormdir(string $formdir, ?int $facilityId = null): bool
                {
                    return false;
                }

                public function isBridgeableFormdir(string $formdir): bool
                {
                    return true;
                }
            };

            $service = new ClinicalDocFormOpenService(
                access: $access,
                catalog: $catalog,
                queueService: $queueStub,
                encounterSession: $session,
            );

            $result = $service->openForm([
                'visit_id' => 77,
                'formdir' => 'soap',
                'action' => 'new',
            ], 1);

            $this->assertStringContainsString('clinical-form-bridge.php', $result['redirect_url']);
            $this->assertStringContainsString('encounter=' . $encounterId, $result['redirect_url']);
            $this->assertSame('soap', $result['formdir']);
        } finally {
            QueryUtils::sqlStatementThrowException('DELETE FROM form_encounter WHERE id = ?', [$encRowId]);
        }
    }

    public function testNativeEngineRoutesConsultOpenToEncounterConsultPage(): void
    {
        $visit = $this->triageVisit(55);
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
        $config = $this->hubEnabledConfig();
        $encounterNote = new class ($config) extends EncounterNoteService {
            public function __construct(ClinicConfigService $config)
            {
                parent::__construct(config: $config);
            }

            public function shouldOpenNativeForm(string $formdir, ?int $facilityId = null): bool
            {
                return true;
            }

            public function buildPageUrl(int $visitId, array $query = []): string
            {
                return '/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/encounter-consult.php?visit_id='
                    . $visitId;
            }
        };

        $catalog = new class ($access, $config) extends ClinicalDocCatalogService {
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
                return EncounterNoteService::NATIVE_FORMDIR;
            }
        };

        $service = new ClinicalDocFormOpenService(
            access: $access,
            catalog: $catalog,
            queueService: $queueStub,
            encounterSession: $session,
            encounterNote: $encounterNote,
        );

        $result = $service->openForm([
            'visit_id' => 55,
            'formdir' => EncounterNoteService::NATIVE_FORMDIR,
            'lens' => 'consult',
            'action' => 'new',
        ], 1);

        $this->assertSame(EncounterNoteService::NATIVE_FORMDIR, $result['formdir']);
        $this->assertStringContainsString('encounter-consult.php', $result['redirect_url']);
        $this->assertSame('new', $result['action']);
    }
}

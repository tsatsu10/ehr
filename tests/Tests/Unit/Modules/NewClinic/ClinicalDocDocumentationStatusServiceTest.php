<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicalDocCatalogService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocDocumentationStatusService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocHubLinkService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\EncounterNoteEnginePolicy;
use OpenEMR\Modules\NewClinic\Services\EncounterNoteService;
use OpenEMR\Modules\NewClinic\Services\EncounterSignService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class ClinicalDocDocumentationStatusServiceTest extends TestCase
{
    /**
     * Pin engine-policy facility resolution to the test's facility 0 rows.
     */
    private function facilityZeroScope(): VisitScopeService
    {
        return new class extends VisitScopeService {
            public function resolveDeskFacilityId(?int $requestedFacilityId = null): int
            {
                return 0;
            }
        };
    }

    public function testFullOpdListsUnsignedConsultNote(): void
    {
        $config = new ClinicConfigService();
        $prevHub = $config->get('enable_clinical_doc_hub', '0', 0);
        $prevFormdir = $config->get('consult_note_formdir', 'soap', 0);
        $prevEngine = $config->get('encounter_note_engine', EncounterNoteService::ENGINE_LEGACY, 0);
        try {
            $config->set('enable_clinical_doc_hub', '1', 0);
            $config->set('consult_note_formdir', 'soap', 0);
            $config->set('encounter_note_engine', EncounterNoteService::ENGINE_LEGACY, 0);

            $hubLinks = new ClinicalDocHubLinkService(config: $config);
            $catalog = new ClinicalDocCatalogService(
                config: $config,
                visitScope: $this->facilityZeroScope(),
                enginePolicy: new EncounterNoteEnginePolicy(
                    config: $config,
                    visitScope: $this->facilityZeroScope(),
                ),
            );
            $sign = new class ($config, $catalog) extends EncounterSignService {
                public function __construct(
                    private readonly ClinicConfigService $testConfig,
                    ClinicalDocCatalogService $catalog,
                ) {
                    parent::__construct(catalog: $catalog, config: $this->testConfig);
                }

                public function getSignedFormdirsOnEncounter(int $encounterId, int $pid, array $formdirs): array
                {
                    return [];
                }
            };

            $service = new ClinicalDocDocumentationStatusService(
                hubLinks: $hubLinks,
                catalog: $catalog,
                signService: $sign,
            );

            $status = $service->getStatusForVisit([
                'id' => 9,
                'pid' => 1,
                'encounter' => 100,
                'facility_id' => 0,
                'service_profile' => 'full_opd',
            ], 0);

            $this->assertTrue($status['hub_enabled']);
            $this->assertFalse($status['encounter_signed']);
            $this->assertNotEmpty($status['unsigned_required']);
            $this->assertSame('soap', strtolower((string) $status['unsigned_required'][0]['formdir']));
            $this->assertStringContainsString('clinical-doc/index.php', (string) $status['documentation_hub_url']);
        } finally {
            $config->set('enable_clinical_doc_hub', (string) $prevHub, 0);
            $config->set('consult_note_formdir', (string) $prevFormdir, 0);
            $config->set('encounter_note_engine', (string) $prevEngine, 0);
        }
    }

    public function testNativeEngineListsUnsignedNativeConsultNote(): void
    {
        $config = new ClinicConfigService();
        $prevHub = $config->get('enable_clinical_doc_hub', '0', 0);
        $prevEngine = $config->get('encounter_note_engine', EncounterNoteService::ENGINE_LEGACY, 0);
        try {
            $config->set('enable_clinical_doc_hub', '1', 0);
            $config->set('encounter_note_engine', EncounterNoteService::ENGINE_NATIVE, 0);

            $hubLinks = new ClinicalDocHubLinkService(config: $config);
            $catalog = new ClinicalDocCatalogService(
                config: $config,
                visitScope: $this->facilityZeroScope(),
                enginePolicy: new EncounterNoteEnginePolicy(
                    config: $config,
                    visitScope: $this->facilityZeroScope(),
                ),
            );
            $sign = new class ($config, $catalog) extends EncounterSignService {
                public function __construct(
                    private readonly ClinicConfigService $testConfig,
                    ClinicalDocCatalogService $catalog,
                ) {
                    parent::__construct(catalog: $catalog, config: $this->testConfig);
                }

                public function getSignedFormdirsOnEncounter(int $encounterId, int $pid, array $formdirs): array
                {
                    return [];
                }
            };

            $service = new ClinicalDocDocumentationStatusService(
                hubLinks: $hubLinks,
                catalog: $catalog,
                signService: $sign,
            );

            $status = $service->getStatusForVisit([
                'id' => 10,
                'pid' => 2,
                'encounter' => 101,
                'facility_id' => 0,
                'service_profile' => 'full_opd',
            ], 0);

            $this->assertFalse($status['encounter_signed']);
            $this->assertNotEmpty($status['unsigned_required']);
            $this->assertSame(
                EncounterNoteService::NATIVE_FORMDIR,
                strtolower((string) $status['unsigned_required'][0]['formdir'])
            );
        } finally {
            $config->set('enable_clinical_doc_hub', (string) $prevHub, 0);
            $config->set('encounter_note_engine', (string) $prevEngine, 0);
        }
    }

    public function testEncounterSignedAlignsWithUnsignedRequired(): void
    {
        $config = new ClinicConfigService();
        $sign = new class extends EncounterSignService {
            public function getSignedFormdirsOnEncounter(int $encounterId, int $pid, array $formdirs): array
            {
                $signed = [];
                foreach ($formdirs as $formdir) {
                    $signed[strtolower((string) $formdir)] = true;
                }

                return $signed;
            }
        };

        $service = new ClinicalDocDocumentationStatusService(signService: $sign);

        $status = $service->getStatusForVisit([
            'id' => 11,
            'pid' => 3,
            'encounter' => 102,
            'facility_id' => 0,
            'service_profile' => 'full_opd',
        ], 0);

        $this->assertTrue($status['encounter_signed']);
        $this->assertSame([], $status['unsigned_required']);
    }
}

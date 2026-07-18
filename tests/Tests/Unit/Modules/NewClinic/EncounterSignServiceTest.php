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

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocCatalogService;
use OpenEMR\Modules\NewClinic\Services\EncounterNoteEnginePolicy;
use OpenEMR\Modules\NewClinic\Services\EncounterNoteService;
use OpenEMR\Modules\NewClinic\Services\EncounterSignService;
use PHPUnit\Framework\TestCase;

class EncounterSignServiceTest extends TestCase
{
    public function testOpenUrlForVisitlessEncounterTargetsHubNotStock(): void
    {
        // 2026-07-18 flip: the stock encounter_top screen is no longer a destination —
        // encounters without a queue visit open in the hub's encounter-only mode.
        $GLOBALS['webroot'] = '/openemr';
        $url = (new EncounterSignService())->buildOpenUrlForVisit([
            'id' => 0,
            'pid' => 12,
            'encounter' => 99,
        ]);

        $this->assertStringContainsString('clinical-doc/index.php', $url);
        $this->assertStringContainsString('encounter_id=99', $url);
        $this->assertStringNotContainsString('encounter_top.php', $url);
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

    public function testBatchVisitDocumentationSignedEmpty(): void
    {
        $service = new EncounterSignService();
        $this->assertSame([], $service->batchVisitDocumentationSigned([]));
    }

    public function testGetProfileUnsignedReasonForOpd(): void
    {
        $service = new EncounterSignService();
        $this->assertSame('Visit not found', $service->getProfileUnsignedReason(0));
    }

    public function testIsConsultSignedDelegatesToEncounterCheckWhenNoVisit(): void
    {
        $service = new EncounterSignService();
        $this->assertFalse($service->isConsultSigned(0));
    }

    public function testIsVisitDocumentationSignedRequiresEncounterAndPid(): void
    {
        $service = new EncounterSignService();

        $this->assertFalse($service->isVisitDocumentationSigned(['encounter' => 0, 'pid' => 1]));
        $this->assertFalse($service->isVisitDocumentationSigned(['encounter' => 5, 'pid' => 0]));
    }

    public function testVisitDocumentationSignedWhenRequiredFormdirSigned(): void
    {
        $config = new ClinicConfigService();
        $prevEngine = $config->get('encounter_note_engine', EncounterNoteService::ENGINE_LEGACY, 0);
        try {
            $config->set('encounter_note_engine', EncounterNoteService::ENGINE_NATIVE, 0);

            $catalog = new ClinicalDocCatalogService(
                config: $config,
                enginePolicy: new EncounterNoteEnginePolicy(config: $config),
            );

            $service = new class ($config, $catalog) extends EncounterSignService {
                public function __construct(
                    private readonly ClinicConfigService $testConfig,
                    ClinicalDocCatalogService $catalog,
                ) {
                    parent::__construct(catalog: $catalog, config: $this->testConfig);
                }

                public function isFormdirSignedOnEncounter(int $encounterId, int $pid, string $formdir): bool
                {
                    return strcasecmp($formdir, EncounterNoteService::NATIVE_FORMDIR) === 0;
                }
            };

            $visit = [
                'encounter' => 50,
                'pid' => 7,
                'facility_id' => 0,
                'service_profile' => 'full_opd',
            ];

            $this->assertTrue($service->isVisitDocumentationSigned($visit));
            $this->assertTrue($service->isConsultSigned(50, $visit));
        } finally {
            $config->set('encounter_note_engine', (string) $prevEngine, 0);
        }
    }

    public function testVisitDocumentationUnsignedWhenNativeNoteMissingSignature(): void
    {
        $config = new ClinicConfigService();
        $prevEngine = $config->get('encounter_note_engine', EncounterNoteService::ENGINE_LEGACY, 0);
        try {
            $config->set('encounter_note_engine', EncounterNoteService::ENGINE_NATIVE, 0);

            $catalog = new ClinicalDocCatalogService(
                config: $config,
                enginePolicy: new EncounterNoteEnginePolicy(config: $config),
            );

            $service = new class ($config, $catalog) extends EncounterSignService {
                public function __construct(
                    private readonly ClinicConfigService $testConfig,
                    ClinicalDocCatalogService $catalog,
                ) {
                    parent::__construct(catalog: $catalog, config: $this->testConfig);
                }

                public function isFormdirSignedOnEncounter(int $encounterId, int $pid, string $formdir): bool
                {
                    return false;
                }
            };

            $visit = [
                'encounter' => 51,
                'pid' => 8,
                'facility_id' => 0,
                'service_profile' => 'full_opd',
            ];

            $this->assertFalse($service->isVisitDocumentationSigned($visit));
            $this->assertFalse($service->isConsultSigned(51, $visit));
        } finally {
            $config->set('encounter_note_engine', (string) $prevEngine, 0);
        }
    }
}

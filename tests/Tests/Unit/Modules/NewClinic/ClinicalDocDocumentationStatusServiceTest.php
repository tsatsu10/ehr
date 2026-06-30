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
use OpenEMR\Modules\NewClinic\Services\EncounterSignService;
use PHPUnit\Framework\TestCase;

class ClinicalDocDocumentationStatusServiceTest extends TestCase
{
    public function testFullOpdListsUnsignedConsultNote(): void
    {
        $config = new ClinicConfigService();
        $config->set('enable_clinical_doc_hub', '1', 0);
        $config->set('consult_note_formdir', 'soap', 0);

        $hubLinks = new ClinicalDocHubLinkService(config: $config);
        $sign = new class extends EncounterSignService {
            public function isEncounterDocumentationSigned(int $encounterId): bool
            {
                return false;
            }
        };

        $service = new ClinicalDocDocumentationStatusService(
            hubLinks: $hubLinks,
            catalog: new ClinicalDocCatalogService(),
            signService: $sign,
            config: $config,
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
    }
}

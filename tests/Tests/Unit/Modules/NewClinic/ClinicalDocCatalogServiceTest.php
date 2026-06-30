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
use OpenEMR\Modules\NewClinic\Services\ClinicalDocCatalogService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use PHPUnit\Framework\TestCase;

class ClinicalDocCatalogServiceTest extends TestCase
{
    public function testResolveSourceLensForSoapIsConsult(): void
    {
        $access = new ClinicalDocAccessService(
            aclChecker: static fn (string $section, string $aco): bool =>
                $section === 'new_clinic' && $aco === 'new_doctor',
        );
        $catalog = new ClinicalDocCatalogService(access: $access);

        $this->assertSame('consult', $catalog->resolveSourceLensForFormdir('soap', 0));
    }

    public function testVisitLensOmitsConsultPrimaryForNurseWithoutConsultAcl(): void
    {
        $access = new ClinicalDocAccessService(
            aclChecker: static fn (string $section, string $aco): bool =>
                $section === 'new_clinic'
                && in_array($aco, ['new_nurse', 'new_clinical_doc_nursing'], true),
        );
        $catalog = new ClinicalDocCatalogService(access: $access);
        $cards = $catalog->getCatalog('visit', 0)['cards'];

        $formdirs = array_map(
            static fn (array $card): string => strtolower((string) ($card['formdir'] ?? '')),
            $cards
        );

        $this->assertNotContains('soap', $formdirs);
        foreach ($cards as $card) {
            $this->assertNotSame('consult', $card['source_lens'] ?? null);
        }
    }

    public function testUnknownBundleFallsBackToGhanaOpdDefs(): void
    {
        $config = new ClinicConfigService();
        $config->set('clinical_doc_bundle', 'unknown_bundle', 0);

        $access = new ClinicalDocAccessService(
            aclChecker: static fn (string $section, string $aco): bool =>
                $section === 'new_clinic' && $aco === 'new_doctor',
        );
        $catalog = new ClinicalDocCatalogService(access: $access, config: $config);

        $this->assertSame('consult', $catalog->resolveSourceLensForFormdir('soap', 0));
    }
}

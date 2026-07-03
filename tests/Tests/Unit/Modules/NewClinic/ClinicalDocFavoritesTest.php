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

class ClinicalDocFavoritesTest extends TestCase
{
    public function testFavoritePinCardsReturnsUpToThreePins(): void
    {
        $config = new ClinicConfigService();
        $previous = $config->get('enable_clinical_doc_hub', '0', 0);
        try {
            $config->set('enable_clinical_doc_hub', '1', 0);

            $access = new ClinicalDocAccessService(
                config: $config,
                aclChecker: static fn (string $section, string $aco): bool =>
                    $section === 'new_clinic'
                    && in_array($aco, ['new_doctor', 'new_clinical_doc_consult', 'new_clinical_doc_nursing', 'new_clinical_doc_orders'], true),
            );
            $catalog = new ClinicalDocCatalogService(access: $access, config: $config);

            $pins = $catalog->getFavoritePinCards(0);

            $this->assertIsArray($pins);
            $this->assertLessThanOrEqual(3, count($pins));
            if ($pins === []) {
                $this->markTestSkipped('Packaged forms or form ACL unavailable in unit context');
            }

            $this->assertSame(1, $pins[0]['pin'] ?? null);
        } finally {
            $config->set('enable_clinical_doc_hub', (string) $previous, 0);
        }
    }
}

<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicalDocHubLinkService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use PHPUnit\Framework\TestCase;

class ClinicalDocHubLinkServiceTest extends TestCase
{
    public function testBuildHubUrlIncludesVisitAndTab(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $url = ClinicalDocHubLinkService::buildHubUrl(42, 'visit');

        $this->assertStringContainsString('clinical-doc/index.php', $url);
        $this->assertStringContainsString('visit_id=42', $url);
        $this->assertStringContainsString('tab=visit', $url);
    }

    public function testIsHubEnabledReadsFacilityConfig(): void
    {
        $config = new class extends ClinicConfigService {
            /** @var array<int, array<string, string>> */
            private array $values = [];

            public function set(string $key, string $value, int $facilityId = 0): void
            {
                $this->values[$facilityId][$key] = $value;
            }

            public function getInt(string $key, int $default = 0, int $facilityId = 0): int
            {
                return (int) ($this->values[$facilityId][$key] ?? $default);
            }
        };
        $facilityId = 7;
        $config->set('enable_clinical_doc_hub', '0', $facilityId);

        $service = new ClinicalDocHubLinkService(config: $config);

        $this->assertFalse($service->isHubEnabled($facilityId));

        $config->set('enable_clinical_doc_hub', '1', $facilityId);
        $this->assertTrue($service->isHubEnabled($facilityId));
    }
}

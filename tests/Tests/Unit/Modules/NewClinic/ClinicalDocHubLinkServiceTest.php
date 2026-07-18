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

    public function testIsHubEnabledIsPermanentlyOn(): void
    {
        // 2026-07-18 flip (PRD §5.6 amendment): the hub flag was retired — always on.
        $service = new ClinicalDocHubLinkService();

        $this->assertTrue($service->isHubEnabled(7));
        $this->assertTrue($service->isHubEnabled(null));
    }

    public function testBuildHubEncounterUrlIncludesEncounterAndTab(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $url = ClinicalDocHubLinkService::buildHubEncounterUrl(1458);

        $this->assertStringContainsString('clinical-doc/index.php', $url);
        $this->assertStringContainsString('encounter_id=1458', $url);
        $this->assertStringContainsString('tab=visit', $url);
    }
}

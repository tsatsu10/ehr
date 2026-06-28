<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\LabOrderChargeService;
use PHPUnit\Framework\TestCase;

class LabOrderChargeServiceTest extends TestCase
{
    public function testStarterPanelCodesIncludeOpdBasics(): void
    {
        $codes = LabOrderChargeService::STARTER_PANEL_CODES;

        $this->assertContains('MAL_RDT', $codes);
        $this->assertContains('CBC', $codes);
        $this->assertCount(6, $codes);
    }
}

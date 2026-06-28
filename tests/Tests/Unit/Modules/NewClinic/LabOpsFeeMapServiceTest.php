<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\LabOpsFeeMapService;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class LabOpsFeeMapServiceTest extends TestCase
{
    public function testStarterDefaultsCoverOpdPanelCodes(): void
    {
        $reflection = new ReflectionClass(LabOpsFeeMapService::class);
        $defaults = $reflection->getConstant('STARTER_DEFAULTS');
        $this->assertIsArray($defaults);
        $this->assertArrayHasKey('MAL_RDT', $defaults);
        $this->assertArrayHasKey('CBC', $defaults);
        $this->assertCount(6, $defaults);
    }
}

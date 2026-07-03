<?php

/**
 * S1 Flow Board lane map service unit tests.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\SchedulingFlowBoardLaneMapService;
use PHPUnit\Framework\TestCase;

class SchedulingFlowBoardLaneMapServiceTest extends TestCase
{
    public function testDefaultLaneKeysAreDefined(): void
    {
        $this->assertContains('booked', SchedulingFlowBoardLaneMapService::DEFAULT_LANE_KEYS);
        $this->assertContains('checked_out', SchedulingFlowBoardLaneMapService::DEFAULT_LANE_KEYS);
    }
}

<?php

/**
 * Unit tests for clinic config helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use PHPUnit\Framework\TestCase;

class ClinicConfigServiceTest extends TestCase
{
    public function testResolveQueuePollDefaultIsThirtySecondsWhenFasterInterruptsOff(): void
    {
        $service = new ClinicConfigService();

        $this->assertSame(30000, $service->resolveQueuePollIntervalMs(0));
    }
}

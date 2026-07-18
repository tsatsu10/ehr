<?php

/**
 * Recall due chip service unit tests.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ScheduledIntegrationService;
use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\RecallDueService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class RecallDueServiceTest extends TestCase
{
    public function testChipHiddenWhenSchedulingHubDisabled(): void
    {
        $scheduled = $this->createMock(ScheduledIntegrationService::class);
        $scheduled->method('isEnabled')->willReturn(false);
        $access = new SchedulingAccessService($scheduled, new VisitScopeService());

        $service = new RecallDueService($scheduled, $access);

        $this->assertNull($service->chipForPatient(1, 3));
    }
}

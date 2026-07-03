<?php

/**
 * S1 Flow Board lane prefs service unit tests.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\SchedulingFlowBoardPrefsService;
use PHPUnit\Framework\TestCase;

class SchedulingFlowBoardPrefsServiceTest extends TestCase
{
    public function testSavePrefsRequiresUserId(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');

        $service = new SchedulingFlowBoardPrefsService($access);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('User is required');
        $service->savePrefs(0, [], []);
    }
}

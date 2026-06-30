<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\PharmOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsControlledRegisterService;
use PHPUnit\Framework\TestCase;

class PharmOpsControlledRegisterServiceTest extends TestCase
{
    public function testFetchRegisterRejectsInvertedDateRange(): void
    {
        $access = $this->createMock(PharmOpsAccessService::class);
        $access->method('assertHubAccess');

        $service = new PharmOpsControlledRegisterService($access);

        $this->expectException(\InvalidArgumentException::class);
        $service->fetchRegister('2026-06-30', '2026-06-01');
    }
}

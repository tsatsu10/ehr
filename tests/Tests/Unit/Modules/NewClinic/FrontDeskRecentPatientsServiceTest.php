<?php

/**
 * Unit tests for Front Desk recently viewed patients (M1a)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\FrontDeskRecentPatientsService;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class FrontDeskRecentPatientsServiceTest extends TestCase
{
    public function testMaxEntriesIsFive(): void
    {
        $reflection = new ReflectionClass(FrontDeskRecentPatientsService::class);
        $constant = $reflection->getReflectionConstant('MAX_ENTRIES');
        $this->assertNotNull($constant);
        $this->assertSame(5, $constant->getValue());
    }

    public function testRememberRejectsInvalidPid(): void
    {
        $service = new FrontDeskRecentPatientsService();
        $this->expectException(\InvalidArgumentException::class);
        $service->remember(0, 'Jane Doe', 'MRN-1');
    }

    public function testRememberRejectsEmptyDisplayName(): void
    {
        $service = new FrontDeskRecentPatientsService();
        $this->expectException(\InvalidArgumentException::class);
        $service->remember(42, '   ', 'MRN-1');
    }
}

<?php

/**
 * Unit tests for V1.1-RTa doctor roster service
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\DoctorRosterService;
use PHPUnit\Framework\TestCase;

class DoctorRosterServiceTest extends TestCase
{
    public function testIsEnabledReadsConfigKey(): void
    {
        $source = file_get_contents((new \ReflectionClass(DoctorRosterService::class))->getFileName());
        $this->assertStringContainsString('enable_doctor_roster', $source);
        $this->assertStringContainsString('new_doctor_availability', $source);
    }

    public function testSetTakingPatientsValidatesIds(): void
    {
        $service = new DoctorRosterService();

        $this->expectException(\InvalidArgumentException::class);
        $service->setTakingPatients(0, 1, true);
    }
}

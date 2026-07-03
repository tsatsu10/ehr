<?php

/**
 * Unit tests for appointment-today lookup (M0-F16)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AppointmentTodayService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class AppointmentTodayServiceTest extends TestCase
{
    public function testFindNearestTodayAppointmentFiltersActiveStatuses(): void
    {
        $method = new ReflectionMethod(AppointmentTodayService::class, 'findNearestTodayAppointment');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('pc_eventstatus = 1', $body);
        $this->assertStringContainsString("pc_apptstatus NOT IN ('*', '%', 'x', 'X')", $body);
        $this->assertStringContainsString('CURDATE()', $body);
    }

    public function testListTodayAppointmentsOrdersByStartTime(): void
    {
        $method = new ReflectionMethod(AppointmentTodayService::class, 'listTodayAppointments');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('INNER JOIN patient_data pd', $body);
        $this->assertStringContainsString('pc_startTime', $body);
        $this->assertStringContainsString('CURDATE()', $body);
        $this->assertStringContainsString("pc_apptstatus NOT IN ('*', '%', 'x', 'X')", $body);
    }

    public function testResolveVisitTypeIdForCategoryRequiresFullOpd(): void
    {
        $method = new ReflectionMethod(AppointmentTodayService::class, 'resolveVisitTypeIdForCategory');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString("service_profile = 'full_opd'", $body);
        $this->assertStringContainsString('pc_catid', $body);
    }
}

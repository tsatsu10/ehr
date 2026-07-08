<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\SchedulingCalendarNotifyService;
use PHPUnit\Framework\TestCase;

class SchedulingCalendarNotifyServiceTest extends TestCase
{
    private mixed $savedMedexEnable = null;

    protected function setUp(): void
    {
        $this->savedMedexEnable = $GLOBALS['medex_enable'] ?? null;
    }

    protected function tearDown(): void
    {
        if ($this->savedMedexEnable === null) {
            unset($GLOBALS['medex_enable']);
        } else {
            $GLOBALS['medex_enable'] = $this->savedMedexEnable;
        }
    }

    public function testNotifyDisabledWhenMedExOff(): void
    {
        $GLOBALS['medex_enable'] = '0';
        $service = new SchedulingCalendarNotifyService();

        $this->assertFalse($service->isMedExEnabled());
        $this->assertSame(
            ['medex_enabled' => false, 'can_notify' => false, 'channels' => []],
            $service->patientNotifyContext(10)
        );
    }

    public function testNotifyContextDisabledForInvalidPidEvenWhenMedExOn(): void
    {
        $GLOBALS['medex_enable'] = '1';
        $service = new SchedulingCalendarNotifyService();

        $this->assertTrue($service->isMedExEnabled());
        $this->assertFalse($service->patientNotifyContext(0)['can_notify']);
    }

    public function testQueueRescheduleNoticeRefusesWithoutMedExOrValidIds(): void
    {
        $GLOBALS['medex_enable'] = '0';
        $service = new SchedulingCalendarNotifyService();
        $this->assertFalse($service->queueRescheduleNotice(1, 10, 'move', 7));

        $GLOBALS['medex_enable'] = '1';
        $this->assertFalse($service->queueRescheduleNotice(0, 10, 'move', 7));
        $this->assertFalse($service->queueRescheduleNotice(1, 0, 'move', 7));
    }
}

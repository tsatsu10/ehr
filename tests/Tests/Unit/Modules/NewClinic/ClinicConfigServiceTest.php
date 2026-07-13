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
        $service = $this->getMockBuilder(ClinicConfigService::class)
            ->onlyMethods(['getInt'])
            ->getMock();
        $service->method('getInt')->willReturnCallback(static function (string $key, int $default): int {
            if ($key === 'enable_faster_queue_interrupts') {
                return 0;
            }

            return $default;
        });

        $this->assertSame(30000, $service->resolveQueuePollIntervalMs(0));
    }

    /**
     * SCALE-4.3 — panic_poll_multiplier scales every pollMs handed to Twig.
     */
    public function testPanicPollMultiplierScalesTheInterval(): void
    {
        $service = $this->getMockBuilder(ClinicConfigService::class)
            ->onlyMethods(['getInt'])
            ->getMock();
        $service->method('getInt')->willReturnCallback(static function (string $key, int $default): int {
            return match ($key) {
                'panic_poll_multiplier' => 4,
                'enable_faster_queue_interrupts' => 0,
                default => $default,
            };
        });

        $this->assertSame(120000, $service->resolveQueuePollIntervalMs(0));
    }

    public function testPanicPollMultiplierIsClampedToTen(): void
    {
        $service = $this->getMockBuilder(ClinicConfigService::class)
            ->onlyMethods(['getInt'])
            ->getMock();
        $service->method('getInt')->willReturnCallback(static function (string $key, int $default): int {
            return match ($key) {
                'panic_poll_multiplier' => 999,
                'enable_faster_queue_interrupts' => 1,
                'faster_queue_interrupt_poll_seconds' => 10,
                default => $default,
            };
        });

        $this->assertSame(10 * 1000 * 10, $service->resolveQueuePollIntervalMs(0));
    }

    public function testPanicPollMultiplierDefaultChangesNothing(): void
    {
        $service = $this->getMockBuilder(ClinicConfigService::class)
            ->onlyMethods(['getInt'])
            ->getMock();
        $service->method('getInt')->willReturnCallback(
            static fn (string $key, int $default): int => $default
        );

        $this->assertSame(30000, $service->resolveQueuePollIntervalMs(0));
    }

    public function testIsEnabledAcceptsExplicitFacilityId(): void
    {
        $service = $this->getMockBuilder(ClinicConfigService::class)
            ->onlyMethods(['getInt'])
            ->getMock();
        $service->method('getInt')->willReturnMap([
            ['enable_scheduling_redesign', 0, 3, 1],
            ['enable_scheduling_redesign', 0, 0, 0],
        ]);

        $this->assertTrue($service->isEnabled('enable_scheduling_redesign', 0, 3));
        $this->assertFalse($service->isEnabled('enable_scheduling_redesign', 0, 0));
    }
}

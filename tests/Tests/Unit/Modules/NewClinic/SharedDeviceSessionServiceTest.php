<?php

/**
 * Unit tests for shared-device session probe (T1-F19)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\SharedDeviceSessionService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class SharedDeviceSessionServiceTest extends TestCase
{
    public function testClinicalMismatchWhenPidDiffers(): void
    {
        $method = new ReflectionMethod(SharedDeviceSessionService::class, 'hasMismatch');
        $service = new SharedDeviceSessionService();

        $this->assertTrue($method->invoke(
            $service,
            SharedDeviceSessionService::COMPARE_CLINICAL,
            5,
            10,
            8,
            10
        ));
    }

    public function testClinicalMismatchWhenEncounterDiffers(): void
    {
        $method = new ReflectionMethod(SharedDeviceSessionService::class, 'hasMismatch');
        $service = new SharedDeviceSessionService();

        $this->assertTrue($method->invoke(
            $service,
            SharedDeviceSessionService::COMPARE_CLINICAL,
            5,
            10,
            5,
            12
        ));
    }

    public function testPidOnlyMismatchIgnoresEncounter(): void
    {
        $method = new ReflectionMethod(SharedDeviceSessionService::class, 'hasMismatch');
        $service = new SharedDeviceSessionService();

        $this->assertFalse($method->invoke(
            $service,
            SharedDeviceSessionService::COMPARE_PID_ONLY,
            5,
            10,
            5,
            99
        ));
    }

    public function testPidOnlyMismatchWhenPidDiffers(): void
    {
        $method = new ReflectionMethod(SharedDeviceSessionService::class, 'hasMismatch');
        $service = new SharedDeviceSessionService();

        $this->assertTrue($method->invoke(
            $service,
            SharedDeviceSessionService::COMPARE_PID_ONLY,
            5,
            0,
            8,
            0
        ));
    }
}

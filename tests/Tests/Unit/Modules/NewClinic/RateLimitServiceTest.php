<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\RateLimitService;
use PHPUnit\Framework\TestCase;

class RateLimitServiceTest extends TestCase
{
    protected function setUp(): void
    {
        foreach (array_keys($_SESSION ?? []) as $key) {
            if (str_starts_with((string) $key, 'new_clinic_rate_')) {
                unset($_SESSION[$key]);
            }
        }
    }

    private function makeService(int $limit): RateLimitService
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn($limit);

        return new RateLimitService($config);
    }

    public function testAllowsCallsUpToConfiguredLimit(): void
    {
        $service = $this->makeService(3);

        $service->assertWithinLimit('patients.search', 1);
        $service->assertWithinLimit('patients.search', 1);
        $service->assertWithinLimit('patients.search', 1);

        $this->assertSame(3, (int) $_SESSION['new_clinic_rate_patients.search']['count']);
    }

    public function testThrows429WhenLimitExceeded(): void
    {
        $service = $this->makeService(2);
        $service->assertWithinLimit('patients.search', 1);
        $service->assertWithinLimit('patients.search', 1);

        try {
            $service->assertWithinLimit('patients.search', 1);
            $this->fail('Expected RuntimeException');
        } catch (\RuntimeException $e) {
            $this->assertSame(429, $e->getCode());
            $this->assertSame('Rate limit exceeded', $e->getMessage());
        }
    }

    public function testCounterResetsOnNewMinute(): void
    {
        $service = $this->makeService(2);
        $_SESSION['new_clinic_rate_patients.search'] = [
            'minute' => '2000-01-01 00:00',
            'count' => 999,
        ];

        $service->assertWithinLimit('patients.search', 1);

        $this->assertSame(1, (int) $_SESSION['new_clinic_rate_patients.search']['count']);
        $this->assertSame(date('Y-m-d H:i'), $_SESSION['new_clinic_rate_patients.search']['minute']);
    }

    public function testActionsAreRateLimitedIndependently(): void
    {
        $service = $this->makeService(1);
        $service->assertWithinLimit('patients.search', 1);

        // Exhausting one bucket must not consume the other action's bucket.
        $service->assertWithinLimit('patients.dup_check', 1);

        $this->assertSame(1, (int) $_SESSION['new_clinic_rate_patients.search']['count']);
        $this->assertSame(1, (int) $_SESSION['new_clinic_rate_patients.dup_check']['count']);
    }
}

<?php

/**
 * Tests for the DB-backed fixed-window rate limiter (SEC06, SCALE-3.1)
 *
 * Runs against the live dev DB (like the other *IntegrationTest files): the
 * limiter's correctness IS its atomic SQL upsert, so mocking the DB would test
 * nothing. Uses a dedicated test action name + far-future windows and cleans up.
 *
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
    private const ACTION = 'nc_test.rate_limit';
    private const OTHER_ACTION = 'nc_test.rate_limit_other';
    private const USER_A = 990001;
    private const USER_B = 990002;

    protected function tearDown(): void
    {
        sqlStatement(
            'DELETE FROM new_clinic_rate_limit WHERE bucket_key LIKE ?',
            ['nc_test.rate_limit%']
        );
        sqlStatement(
            'DELETE FROM new_clinic_rate_limit WHERE bucket_key LIKE ?',
            ['patients.search:u9900%']
        );
    }

    private function makeService(int $limit): RateLimitService
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn($limit);

        return new RateLimitService($config);
    }

    public function testNewWindowStartsAtOneAndIncrements(): void
    {
        $service = new RateLimitService();

        $this->assertSame(1, $service->consume(self::ACTION, self::USER_A, '209901010000'));
        $this->assertSame(2, $service->consume(self::ACTION, self::USER_A, '209901010000'));
        $this->assertSame(3, $service->consume(self::ACTION, self::USER_A, '209901010000'));
    }

    public function testNextWindowResetsTheCount(): void
    {
        $service = new RateLimitService();
        $service->consume(self::ACTION, self::USER_A, '209901010000');
        $service->consume(self::ACTION, self::USER_A, '209901010000');

        $this->assertSame(1, $service->consume(self::ACTION, self::USER_A, '209901010001'));
    }

    public function testUsersHaveIndependentBuckets(): void
    {
        $service = new RateLimitService();
        $service->consume(self::ACTION, self::USER_A, '209901010000');
        $service->consume(self::ACTION, self::USER_A, '209901010000');

        $this->assertSame(1, $service->consume(self::ACTION, self::USER_B, '209901010000'));
    }

    public function testActionsAreRateLimitedIndependently(): void
    {
        $service = new RateLimitService();
        $service->consume(self::ACTION, self::USER_A, '209901010000');

        $this->assertSame(1, $service->consume(self::OTHER_ACTION, self::USER_A, '209901010000'));
    }

    public function testThrows429WhenLimitExceeded(): void
    {
        // The limiter is keyed by user+action, NOT session: no $_SESSION involved.
        // 'patients.search' so the mocked per-action config limit applies.
        $service = $this->makeService(2);
        $service->assertWithinLimit('patients.search', self::USER_A);
        $service->assertWithinLimit('patients.search', self::USER_A);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionCode(429);
        $this->expectExceptionMessage('Rate limit exceeded');
        $service->assertWithinLimit('patients.search', self::USER_A);
    }

    public function testPurgeOldWindowsDropsOnlyStaleRows(): void
    {
        $service = new RateLimitService();
        $service->consume(self::ACTION, self::USER_A, '209901010000');
        // Backdate one bucket past the purge horizon; keep the other fresh.
        sqlStatement(
            'UPDATE new_clinic_rate_limit SET window_start = DATE_SUB(NOW(), INTERVAL 2 HOUR)
             WHERE bucket_key = ?',
            [self::ACTION . ':u' . self::USER_A . ':209901010000']
        );
        $service->consume(self::ACTION, self::USER_B, '209901010000');

        $service->purgeOldWindows();

        $stale = sqlQuery(
            'SELECT COUNT(*) AS n FROM new_clinic_rate_limit WHERE bucket_key = ?',
            [self::ACTION . ':u' . self::USER_A . ':209901010000']
        );
        $fresh = sqlQuery(
            'SELECT COUNT(*) AS n FROM new_clinic_rate_limit WHERE bucket_key = ?',
            [self::ACTION . ':u' . self::USER_B . ':209901010000']
        );
        $this->assertSame(0, (int) ($stale['n'] ?? -1));
        $this->assertSame(1, (int) ($fresh['n'] ?? -1));
    }
}

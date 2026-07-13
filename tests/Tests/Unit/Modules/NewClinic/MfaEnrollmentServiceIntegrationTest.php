<?php

/**
 * Integration test for TOTP MFA enrollment status (requires local DB).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\MfaEnrollmentService;
use PHPUnit\Framework\TestCase;

class MfaEnrollmentServiceIntegrationTest extends TestCase
{
    public function testGetStatusReturnsBooleanShapeForARealUser(): void
    {
        $row = QueryUtils::querySingleRow(
            "SELECT id FROM users WHERE username IS NOT NULL AND username != '' ORDER BY id ASC LIMIT 1",
            []
        );
        $userId = is_array($row) ? (int) ($row['id'] ?? 0) : 0;
        if ($userId <= 0) {
            $this->markTestSkipped('No user in database');
        }

        $status = (new MfaEnrollmentService())->getStatus($userId);

        $this->assertArrayHasKey('totp_enabled', $status);
        $this->assertArrayHasKey('ad_managed', $status);
        $this->assertIsBool($status['totp_enabled']);
        $this->assertIsBool($status['ad_managed']);
    }

    public function testVerifyAndSaveRejectsWhenNoPendingSecret(): void
    {
        // No enrollment in progress → the session has no pending secret.
        unset($_SESSION['nc_totp_pending_secret']);

        $row = QueryUtils::querySingleRow(
            "SELECT id FROM users WHERE username IS NOT NULL AND username != '' ORDER BY id ASC LIMIT 1",
            []
        );
        $userId = is_array($row) ? (int) ($row['id'] ?? 0) : 0;
        if ($userId <= 0) {
            $this->markTestSkipped('No user in database');
        }

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Setup has expired');
        (new MfaEnrollmentService())->verifyAndSave($userId, '123456');
    }
}

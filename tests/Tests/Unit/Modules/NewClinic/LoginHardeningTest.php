<?php

/**
 * Login brute-force hardening: NC-FORK-PATCH guard, delay formula, hardened
 * globals, and the People & Access locked-accounts surface
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Auth\AuthUtils;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\StaffAdminService;
use PHPUnit\Framework\TestCase;

class LoginHardeningTest extends TestCase
{
    public function testFailureDelayIsFlatAndCapped(): void
    {
        // SEC-5: flat 2s speed bump, NOT progressive — a login flood of long
        // in-PHP sleeps is a self-DoS on a public VPS. Network layer (tunnel +
        // fail2ban) is the real defense.
        $this->assertSame(0, AuthUtils::newClinicFailureDelaySeconds(0));
        $this->assertSame(0, AuthUtils::newClinicFailureDelaySeconds(-3));
        $this->assertSame(2, AuthUtils::newClinicFailureDelaySeconds(1));
        $this->assertSame(2, AuthUtils::newClinicFailureDelaySeconds(4));
        $this->assertSame(2, AuthUtils::newClinicFailureDelaySeconds(50));
        $this->assertLessThanOrEqual(2, AuthUtils::newClinicFailureDelaySeconds(1000));
        $this->assertSame(2, AuthUtils::NC_MAX_FAILURE_DELAY_SECONDS);
    }

    public function testForkPatchSurvivesUpstreamRebase(): void
    {
        // Deliberate source-marker assert: an upstream rebase of AuthUtils.php
        // that drops the NC-FORK-PATCH block must fail loudly here.
        $source = (string) file_get_contents(
            dirname(__DIR__, 5) . '/src/Common/Auth/AuthUtils.php'
        );
        $this->assertStringContainsString('NC-FORK-PATCH', $source);
        $this->assertTrue(method_exists(AuthUtils::class, 'newClinicFailureDelaySeconds'));
        // The delay must actually be wired into the failure counter, not just defined.
        $this->assertStringContainsString('newClinicProgressiveFailureDelay', $source);
        $this->assertMatchesRegularExpression(
            '/incrementLoginFailedCounter[\s\S]{0,2000}newClinicProgressiveFailureDelay/',
            $source
        );
    }

    public function testHardenedGlobalsApplied(): void
    {
        // pilot-enable-login-hardening.php values on this install.
        $expected = [
            'password_max_failed_logins' => 10,
            'time_reset_password_max_failed_logins' => 300,
            'ip_max_failed_logins' => 10,
            'ip_time_reset_password_max_failed_logins' => 60,
            'password_expiration_days' => 0,
            'password_history' => 0,
        ];
        foreach ($expected as $name => $value) {
            $row = QueryUtils::querySingleRow(
                'SELECT gl_value FROM globals WHERE gl_name = ? AND gl_index = 0',
                [$name]
            );
            $this->assertSame(
                $value,
                (int) ($row['gl_value'] ?? -1),
                "Global {$name} — run scripts/pilot-enable-login-hardening.php"
            );
        }
    }

    public function testTemporaryPasswordRequirementFlagLifecycle(): void
    {
        // SEC-5: set-temp-password flags the user; a self-service change clears it.
        $userId = 990000001;
        \OpenEMR\Modules\NewClinic\Services\StaffAdminService::clearPasswordChangeRequirement($userId);
        $this->assertFalse(
            \OpenEMR\Modules\NewClinic\Services\StaffAdminService::passwordChangeRequired($userId)
        );

        try {
            \OpenEMR\Modules\NewClinic\Services\StaffAdminService::requirePasswordChange($userId, 1);
            $this->assertTrue(
                \OpenEMR\Modules\NewClinic\Services\StaffAdminService::passwordChangeRequired($userId)
            );

            \OpenEMR\Modules\NewClinic\Services\StaffAdminService::clearPasswordChangeRequirement($userId);
            $this->assertFalse(
                \OpenEMR\Modules\NewClinic\Services\StaffAdminService::passwordChangeRequired($userId)
            );
        } finally {
            \OpenEMR\Modules\NewClinic\Services\StaffAdminService::clearPasswordChangeRequirement($userId);
        }
    }

    public function testLockedAccountsListAndUnlock(): void
    {
        $service = new class extends StaffAdminService {
            public function assertCanManageStaff(): void
            {
                // ACL gate bypassed — behavioral test of the lockout read/reset.
            }
        };

        $username = 'lock_test_' . substr(uniqid(), -6);
        QueryUtils::sqlStatementThrowException(
            "INSERT INTO users (username, fname, lname, active) VALUES (?, 'Lock', 'Test', 1)",
            [$username]
        );
        $userId = (int) (QueryUtils::querySingleRow(
            'SELECT id FROM users WHERE username = ?',
            [$username]
        )['id'] ?? 0);
        QueryUtils::sqlStatementThrowException(
            "INSERT INTO users_secure (id, username, password, last_update_password, login_fail_counter, last_login_fail)
             VALUES (?, ?, 'x', NOW(), 99, NOW())",
            [$userId, $username]
        );

        try {
            $payload = $service->listLockedAccounts();
            $this->assertTrue($payload['enabled']);
            $usernames = array_column($payload['items'], 'username');
            $this->assertContains($username, $usernames);

            $after = $service->unlockAccount($userId, 1);
            $this->assertNotContains($username, array_column($after['items'], 'username'));

            $counter = QueryUtils::querySingleRow(
                'SELECT login_fail_counter FROM users_secure WHERE BINARY username = ?',
                [$username]
            );
            $this->assertSame(0, (int) ($counter['login_fail_counter'] ?? -1));
        } finally {
            QueryUtils::sqlStatementThrowException('DELETE FROM users_secure WHERE BINARY username = ?', [$username]);
            QueryUtils::sqlStatementThrowException('DELETE FROM users WHERE username = ?', [$username]);
        }
    }
}

<?php

/**
 * TOTP MFA self-enrollment (GAP-A A6, closes G11).
 *
 * Self-service TOTP registration for the signed-in user, over the stock
 * `login_mfa_registrations` table and the core `Totp` engine — no second MFA
 * store, no CDR/U2F. Every method operates only on the authenticated user id
 * the handler passes in (never a body-supplied target), so it is inherently
 * self-scoped. Two guards are stricter than the legacy screen: enrollment is
 * only persisted after the user proves a working code, and removal requires the
 * account password.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Auth\AuthUtils;
use OpenEMR\Common\Crypto\CryptoGen;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class MfaEnrollmentService
{
    /** Stock keeps one TOTP row per user; this is the label it uses. */
    private const TOTP_NAME = 'App Based 2FA';

    /** Session key holding the not-yet-confirmed secret between start and verify. */
    private const PENDING_SESSION_KEY = 'nc_totp_pending_secret';

    /**
     * @return array{totp_enabled: bool, ad_managed: bool}
     */
    public function getStatus(int $userId): array
    {
        $username = $this->resolveUsername($userId);

        return [
            'totp_enabled' => $this->hasTotp($userId),
            // Directory-managed accounts can't self-enroll app TOTP here.
            'ad_managed' => $username !== '' && AuthUtils::useActiveDirectory($username),
        ];
    }

    /**
     * Step 1 — confirm the account password, generate a fresh secret, and return
     * a QR + the base32 secret for the authenticator app. The secret is stashed
     * in the session (not persisted) until the user proves a code in step 2.
     *
     * @return array{qr: string, secret: string}
     */
    public function startEnrollment(int $userId, string $password): array
    {
        $username = $this->assertCanSelfManage($userId);
        $this->assertPassword($username, $password);

        if ($this->hasTotp($userId)) {
            throw new \RuntimeException('An authenticator app is already set up.', 409);
        }

        $this->requireTotpClass();
        $totp = new \Totp(false, $username);
        $secret = (string) $totp->getSecret();
        $qr = (string) $totp->generateQrCode();
        if ($secret === '' || $qr === '') {
            throw new \RuntimeException('Could not start authenticator setup. Please try again.', 500);
        }

        $_SESSION[self::PENDING_SESSION_KEY] = $secret;

        return ['qr' => $qr, 'secret' => $secret];
    }

    /**
     * Step 2 — verify a code against the pending secret, then persist it
     * encrypted. Only here does a row land in login_mfa_registrations.
     *
     * @return array{totp_enabled: bool}
     */
    public function verifyAndSave(int $userId, string $code): array
    {
        $this->assertCanSelfManage($userId);

        $secret = (string) ($_SESSION[self::PENDING_SESSION_KEY] ?? '');
        if ($secret === '') {
            throw new \RuntimeException('Setup has expired. Start again.', 409);
        }

        $code = preg_replace('/\D/', '', $code) ?? '';
        if (strlen($code) !== 6) {
            throw new \InvalidArgumentException('Enter the 6-digit code from your authenticator app.');
        }

        $this->requireTotpClass();
        if (!(new \Totp($secret))->validateCode($code)) {
            throw new \InvalidArgumentException('That code did not match. Check your app and try again.');
        }

        // Guard the one-TOTP-per-user rule at the last moment (parity with stock).
        if ($this->hasTotp($userId)) {
            unset($_SESSION[self::PENDING_SESSION_KEY]);
            throw new \RuntimeException('An authenticator app is already set up.', 409);
        }

        $encrypted = (new CryptoGen())->encryptStandard($secret);
        QueryUtils::sqlStatementThrowException(
            "INSERT INTO login_mfa_registrations (`user_id`, `method`, `name`, `var1`, `var2`)
             VALUES (?, 'TOTP', ?, ?, '')",
            [$userId, self::TOTP_NAME, $encrypted]
        );
        unset($_SESSION[self::PENDING_SESSION_KEY]);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'my_profile',
            $userId,
            1,
            'profile.mfa.enrolled method=TOTP user_id=' . $userId
        );

        return ['totp_enabled' => true];
    }

    /**
     * Remove the user's TOTP registration — password required.
     *
     * @return array{totp_enabled: bool}
     */
    public function remove(int $userId, string $password): array
    {
        $username = $this->assertCanSelfManage($userId);
        $this->assertPassword($username, $password);

        QueryUtils::sqlStatementThrowException(
            "DELETE FROM login_mfa_registrations WHERE user_id = ? AND method = 'TOTP'",
            [$userId]
        );
        unset($_SESSION[self::PENDING_SESSION_KEY]);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'my_profile',
            $userId,
            1,
            'profile.mfa.removed method=TOTP user_id=' . $userId
        );

        return ['totp_enabled' => false];
    }

    private function hasTotp(int $userId): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS c FROM login_mfa_registrations WHERE user_id = ? AND method = 'TOTP'",
            [$userId]
        );

        return is_array($row) && (int) ($row['c'] ?? 0) > 0;
    }

    private function resolveUsername(int $userId): string
    {
        $row = QueryUtils::querySingleRow('SELECT username FROM users WHERE id = ?', [$userId]);

        return is_array($row) ? trim((string) ($row['username'] ?? '')) : '';
    }

    private function assertCanSelfManage(int $userId): string
    {
        if ($userId <= 0) {
            throw new \RuntimeException('Not signed in.', 403);
        }
        $username = $this->resolveUsername($userId);
        if ($username === '') {
            throw new \RuntimeException('Account not found.', 404);
        }
        if (AuthUtils::useActiveDirectory($username)) {
            throw new \RuntimeException('Sign-in security is managed by your organization directory.', 403);
        }

        return $username;
    }

    private function assertPassword(string $username, string $password): void
    {
        if ($password === '' || !(new AuthUtils())->confirmPassword($username, $password)) {
            throw new \InvalidArgumentException('Your password was not correct.');
        }
    }

    private function requireTotpClass(): void
    {
        if (class_exists(\Totp::class)) {
            return;
        }
        // Legacy (non-PSR-4) class; load it explicitly. Fail cleanly rather than
        // fataling if the path/global is somehow unavailable.
        $path = ((string) ($GLOBALS['srcdir'] ?? '')) . '/classes/Totp.class.php';
        if (!is_file($path)) {
            throw new \RuntimeException('Authenticator support is unavailable.', 500);
        }
        require_once $path;
    }
}

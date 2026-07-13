<?php

/**
 * profile.* and switch_role ajax actions (AUDIT-10i).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\MfaEnrollmentService;
use OpenEMR\Modules\NewClinic\Services\MyProfileService;
use OpenEMR\Modules\NewClinic\Services\SessionRoleService;

final class ProfileActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'profile.get',
        'profile.update',
        'profile.change_password',
        'profile.mfa.status',
        'profile.mfa.enroll_start',
        'profile.mfa.enroll_verify',
        'profile.mfa.remove',
        'switch_role',
    ];

    public function __construct(
        private readonly AjaxController $host,
    ) {
    }

    public function supports(string $action): bool
    {
        return in_array($action, self::ACTIONS, true);
    }

    public function handle(string $action, string $method, int $userId): void
    {
        switch ($action) {
            case 'profile.get':
                $this->host->respond(true, 'ok', $this->host->svc(MyProfileService::class)->getProfile($userId));
                break;
            case 'profile.update':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $this->host->respond(true, 'Profile updated', $this->host->svc(MyProfileService::class)->updateProfile($userId, $body));
                break;
            case 'profile.change_password':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $this->host->svc(MyProfileService::class)->changePassword(
                    $userId,
                    (string) ($body['current_password'] ?? ''),
                    (string) ($body['new_password'] ?? '')
                );
                $this->host->respond(true, 'Password updated');
                break;
            case 'profile.mfa.status':
                $this->host->respond(true, 'ok', $this->host->svc(MfaEnrollmentService::class)->getStatus($userId));
                break;
            case 'profile.mfa.enroll_start':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $result = $this->host->svc(MfaEnrollmentService::class)
                        ->startEnrollment($userId, (string) ($body['password'] ?? ''));
                    $this->host->respond(true, 'ok', $result);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                }
                break;
            case 'profile.mfa.enroll_verify':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $result = $this->host->svc(MfaEnrollmentService::class)
                        ->verifyAndSave($userId, (string) ($body['code'] ?? ''));
                    $this->host->respond(true, 'ok', $result);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                }
                break;
            case 'profile.mfa.remove':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $result = $this->host->svc(MfaEnrollmentService::class)
                        ->remove($userId, (string) ($body['password'] ?? ''));
                    $this->host->respond(true, 'ok', $result);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                }
                break;
            case 'switch_role':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $role = (string) ($body['role'] ?? '');
                $result = $this->host->svc(SessionRoleService::class)->switchRole($role, $userId);
                $this->host->respond(true, 'ok', $result);
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}

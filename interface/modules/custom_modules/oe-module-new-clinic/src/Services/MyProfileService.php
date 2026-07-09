<?php

/**
 * Signed-in user's own profile (read + limited self-service edit).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclExtended;
use OpenEMR\Common\Auth\AuthUtils;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class MyProfileService
{
    public function __construct(
        private readonly SessionRoleService $sessionRole = new SessionRoleService(),
        private readonly PersonalizedDeskLabelService $deskLabels = new PersonalizedDeskLabelService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getProfile(int $userId, ?string $pageAco = null): array
    {
        $this->assertSelf($userId);

        $user = QueryUtils::querySingleRow(
            'SELECT id, username, fname, lname, mname, email, active, facility_id, authorized
             FROM users WHERE id = ?',
            [$userId]
        );
        if (empty($user)) {
            throw new \InvalidArgumentException('User not found');
        }

        $username = (string) ($user['username'] ?? '');
        $groups = $username !== '' ? (AclExtended::aclGetGroupTitles($username) ?: []) : [];
        $template = ClinicRolesService::inferTemplateFromGroups($groups);
        $activeRole = $this->sessionRole->getActiveRole($pageAco);
        $roleMeta = SessionRoleService::ROLE_META[$activeRole] ?? SessionRoleService::ROLE_META['new_reception'];

        $facilityId = (int) ($user['facility_id'] ?? 0);
        $facilityName = '';
        if ($facilityId > 0) {
            $facility = QueryUtils::querySingleRow('SELECT name FROM facility WHERE id = ?', [$facilityId]);
            $facilityName = is_array($facility) ? (string) ($facility['name'] ?? '') : '';
        }

        $fname = (string) ($user['fname'] ?? '');
        $lname = (string) ($user['lname'] ?? '');

        return [
            'id' => (int) ($user['id'] ?? 0),
            'username' => $username,
            'fname' => $fname,
            'lname' => $lname,
            'mname' => (string) ($user['mname'] ?? ''),
            'email' => (string) ($user['email'] ?? ''),
            'display_name' => trim($fname . ' ' . $lname),
            'initials' => $this->initials($fname, $lname),
            'active' => (int) ($user['active'] ?? 0) === 1,
            'authorized' => (int) ($user['authorized'] ?? 0) === 1,
            'facility_id' => $facilityId,
            'facility_name' => $facilityName,
            'groups' => array_map(static fn (string $g): array => [
                'value' => $g,
                'label' => xl_gacl_group($g),
            ], $groups),
            'role_template' => $template['id'] ?? null,
            'role_template_label' => $template['label'] ?? null,
            'desks' => $template['desks'] ?? [],
            'active_role' => [
                'aco' => $activeRole,
                'label' => xlt($roleMeta['label']),
                'desk_label' => $this->deskLabels->ownedDeskLabelForAco($activeRole, $fname, $username),
                'accent' => $roleMeta['accent'],
            ],
            'available_roles' => $this->buildAvailableRoles($activeRole, $fname, $username),
            'can_change_password' => !AuthUtils::useActiveDirectory($username),
            'secure_password' => !empty($GLOBALS['secure_password']),
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function updateProfile(int $userId, array $input): array
    {
        $this->assertSelf($userId);

        $user = QueryUtils::querySingleRow(
            'SELECT id, username, fname, lname, mname, email FROM users WHERE id = ?',
            [$userId]
        );
        if (empty($user)) {
            throw new \InvalidArgumentException('User not found');
        }

        $username = (string) ($user['username'] ?? '');
        $v = new InputValidator();
        $fname = $v->name('fname', $input['fname'] ?? $user['fname'] ?? '', true);
        $lname = $v->name('lname', $input['lname'] ?? $user['lname'] ?? '', true);
        $mname = $v->name('mname', $input['mname'] ?? $user['mname'] ?? '');
        $email = $v->email('email', $input['email'] ?? $user['email'] ?? '');
        $v->throwIfInvalid();

        sqlStatement(
            'UPDATE users SET fname = ?, lname = ?, mname = ?, email = ? WHERE id = ?',
            [$fname, $lname, $mname, $email, $userId]
        );

        if ($username !== '') {
            $groups = AclExtended::aclGetGroupTitles($username) ?: [];
            AclExtended::setUserAro($groups, $username, $fname, $mname, $lname);
        }

        EventAuditLogger::instance()->newEvent(
            'admin',
            'my_profile',
            $userId,
            'update',
            'Profile updated via New Clinic my-profile'
        );

        return $this->getProfile($userId);
    }

    public function changePassword(int $userId, string $currentPassword, string $newPassword): void
    {
        $this->assertSelf($userId);

        $user = QueryUtils::querySingleRow('SELECT username FROM users WHERE id = ?', [$userId]);
        if (empty($user)) {
            throw new \InvalidArgumentException('User not found');
        }

        $username = (string) ($user['username'] ?? '');
        if (AuthUtils::useActiveDirectory($username)) {
            throw new \RuntimeException('Password is managed by your organization directory', 403);
        }

        if ($currentPassword === '') {
            throw new \InvalidArgumentException('Current password is required');
        }
        if (strlen($newPassword) < 8) {
            throw new \InvalidArgumentException('New password must be at least 8 characters');
        }

        $authUtils = new AuthUtils();
        $success = $authUtils->updatePassword($userId, $userId, $currentPassword, $newPassword);
        if (!$success) {
            // Generic on purpose — do not reveal which check failed (auth-adjacent).
            throw new \InvalidArgumentException(
                'Password change failed. Check your current password and the new password requirements.'
            );
        }

        // SEC-5: a self-service change satisfies any admin-set temporary-password
        // requirement, so the module shell stops forcing the change screen.
        StaffAdminService::clearPasswordChangeRequirement($userId);

        EventAuditLogger::instance()->newEvent(
            'admin',
            'my_profile',
            $userId,
            'password',
            'Password changed via New Clinic my-profile'
        );
    }

    private function assertSelf(int $userId): void
    {
        $sessionUserId = (int) ($_SESSION['authUserID'] ?? 0);
        if ($sessionUserId <= 0 || $sessionUserId !== $userId) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildAvailableRoles(string $activeRole, string $fname, string $username): array
    {
        $roles = [];
        foreach ($this->sessionRole->listAvailableRoles() as $role) {
            $aco = (string) ($role['aco'] ?? '');
            if ($aco === '') {
                continue;
            }

            $roles[] = [
                'aco' => $aco,
                'label' => xlt((string) ($role['label'] ?? $aco)),
                'desk_label' => $this->deskLabels->ownedDeskLabelForAco($aco, $fname, $username),
                'accent' => (string) ($role['accent'] ?? 'admin'),
                'is_active' => $aco === $activeRole,
            ];
        }

        return $roles;
    }

    private function initials(string $first, string $last): string
    {
        $a = mb_substr(trim($first), 0, 1);
        $b = mb_substr(trim($last), 0, 1);
        $out = strtoupper($a . $b);

        return $out !== '' ? $out : '?';
    }
}

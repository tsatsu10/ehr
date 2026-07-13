<?php

/**
 * Staff directory and onboarding for People & access (M15-F02–F03).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Modules\NewClinic\Support\Sanitize;

use OpenEMR\Common\Acl\AclExtended;
use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Auth\AuthUtils;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class StaffAdminService
{
    public function __construct(
        private readonly ClinicRolesService $rolesService = new ClinicRolesService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function assertCanManageStaff(): void
    {
        if (
            !AclMain::aclCheckCore('new_clinic', 'new_admin')
            && !AclMain::aclCheckCore('new_clinic', 'new_admin_hub_people')
        ) {
            throw new \RuntimeException('Forbidden', 403);
        }
        if (!AclMain::aclCheckCore('admin', 'users')) {
            throw new \RuntimeException('Core user admin permission required', 403);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function listStaff(int $page, int $pageSize, string $search, string $status): array
    {
        $this->assertCanManageStaff();

        $page = max(1, $page);
        $pageSize = max(1, min(100, $pageSize));
        $search = trim($search);
        $status = in_array($status, ['active', 'inactive', 'all'], true) ? $status : 'active';

        $where = ["u.username != ''", 'u.username IS NOT NULL'];
        $binds = [];

        if ($status === 'active') {
            $where[] = 'u.active = 1';
        } elseif ($status === 'inactive') {
            $where[] = 'u.active = 0';
        }

        $search = Sanitize::searchToken($search);
        if ($search !== '') {
            $where[] = '(u.username LIKE ? OR u.fname LIKE ? OR u.lname LIKE ?)';
            $like = '%' . $search . '%';
            $binds[] = $like;
            $binds[] = $like;
            $binds[] = $like;
        }

        $whereSql = implode(' AND ', $where);
        $totalRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS total FROM users u WHERE {$whereSql}",
            $binds
        );
        $total = (int) ($totalRow['total'] ?? 0);
        $offset = ($page - 1) * $pageSize;

        $rows = QueryUtils::fetchRecords(
            "SELECT u.id, u.username, u.fname, u.lname, u.active, u.facility_id
             FROM users u
             WHERE {$whereSql}
             ORDER BY u.lname ASC, u.fname ASC, u.username ASC
             LIMIT " . (int) $pageSize . ' OFFSET ' . (int) $offset,
            $binds
        ) ?: [];

        $staffRows = [];
        foreach ($rows as $row) {
            $username = (string) ($row['username'] ?? '');
            $groups = $username !== '' ? (AclExtended::aclGetGroupTitles($username) ?: []) : [];
            $template = ClinicRolesService::inferTemplateFromGroups($groups);
            $staffRows[] = [
                'id' => (int) ($row['id'] ?? 0),
                'username' => $username,
                'display_name' => trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? '')),
                'active' => (int) ($row['active'] ?? 0) === 1,
                'facility_id' => (int) ($row['facility_id'] ?? 0),
                'role_template' => $template['id'] ?? null,
                'role_template_label' => $template['label'] ?? null,
                'desks' => $template['desks'] ?? [],
                'groups' => $groups,
            ];
        }

        return [
            'rows' => $staffRows,
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function createFromTemplate(array $input, int $actorUserId): array
    {
        $this->assertCanManageStaff();

        $v = new InputValidator();
        $username = $v->username('username', $input['username'] ?? '');
        $password = (string) ($input['password'] ?? '');
        $fname = $v->name('fname', $input['fname'] ?? '', true);
        $lname = $v->name('lname', $input['lname'] ?? '', true);
        $templateId = trim((string) ($input['template_id'] ?? ''));
        $isLead = !empty($input['is_lead']);
        $promoteReason = trim((string) ($input['promote_reason'] ?? ''));

        if (strlen($password) < 8 || strlen($password) > 72) {
            $v->addError('password', 'Password must be 8–72 characters');
        }
        $v->throwIfInvalid();

        $template = ClinicRolesService::getTemplate($templateId);
        if ($template === null) {
            throw new \InvalidArgumentException('Unknown role template');
        }

        $facilityId = (int) ($input['facility_id'] ?? $this->visitScope->resolveDefaultFacilityId());
        $warnings = $this->buildTemplateWarnings($templateId, $facilityId);

        $existing = QueryUtils::querySingleRow(
            'SELECT id FROM users WHERE username = ?',
            [$username]
        );
        if (!empty($existing)) {
            throw new \InvalidArgumentException('Username already exists');
        }

        $groups = ClinicRolesService::groupsForTemplate($templateId, $isLead);
        $this->assertGroupsAllowed($groups, $templateId, $promoteReason, $actorUserId);

        $userId = $this->insertStaffUser($username, $fname, $lname, $facilityId, $password);
        foreach ($groups as $group) {
            AclExtended::addUserAros($username, $group);
        }
        $this->ensureDefaultAuthGroup($username);

        $this->auditStaffEvent('admin_hub.staff_created', $actorUserId, $username, $templateId);
        $this->auditStaffEvent('admin_hub.role_template_applied', $actorUserId, $username, $templateId);

        return [
            'user_id' => $userId,
            'username' => $username,
            'groups' => AclExtended::aclGetGroupTitles($username) ?: [],
            'warnings' => $warnings,
            'review' => ClinicRolesService::buildTemplateReview($templateId, $isLead),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getUserDetail(int $userId): array
    {
        $this->assertCanManageStaff();

        $user = QueryUtils::querySingleRow(
            'SELECT id, username, fname, lname, mname, active, facility_id, email, authorized
             FROM users WHERE id = ?',
            [$userId]
        );
        if (empty($user)) {
            throw new \InvalidArgumentException('User not found');
        }

        $username = (string) ($user['username'] ?? '');
        if ($username !== '' && !AclExtended::iHavePermissionsOf($username)) {
            throw new \RuntimeException('Not authorized to view this user', 403);
        }

        $groups = $username !== '' ? (AclExtended::aclGetGroupTitles($username) ?: []) : [];
        $allGroups = AclExtended::aclGetGroupTitleList();
        $inactiveGroups = array_values(array_diff($allGroups, $groups));

        $facilities = QueryUtils::fetchRecords('SELECT id, name FROM facility ORDER BY name ASC') ?: [];

        return [
            'id' => (int) ($user['id'] ?? 0),
            'username' => $username,
            'fname' => (string) ($user['fname'] ?? ''),
            'lname' => (string) ($user['lname'] ?? ''),
            'mname' => (string) ($user['mname'] ?? ''),
            'active' => (int) ($user['active'] ?? 0) === 1,
            'facility_id' => (int) ($user['facility_id'] ?? 0),
            'email' => (string) ($user['email'] ?? ''),
            'authorized' => (int) ($user['authorized'] ?? 0) === 1,
            'groups' => $groups,
            'inactive_groups' => array_map(static fn (string $g): array => [
                'value' => $g,
                'label' => xl_gacl_group($g),
            ], $inactiveGroups),
            'active_groups' => array_map(static fn (string $g): array => [
                'value' => $g,
                'label' => xl_gacl_group($g),
            ], $groups),
            'facilities' => array_map(static fn (array $row): array => [
                'id' => (int) ($row['id'] ?? 0),
                'name' => (string) ($row['name'] ?? ''),
            ], $facilities),
        ];
    }

    /**
     * @param array<string, mixed> $input
     */
    public function updateUser(int $userId, array $input, int $actorUserId): array
    {
        $this->assertCanManageStaff();

        $user = QueryUtils::querySingleRow(
            'SELECT id, username, fname, lname, mname, active FROM users WHERE id = ?',
            [$userId]
        );
        if (empty($user)) {
            throw new \InvalidArgumentException('User not found');
        }

        $username = (string) ($user['username'] ?? '');
        if ($username === '' || !AclExtended::iHavePermissionsOf($username)) {
            throw new \RuntimeException('Not authorized to modify this user', 403);
        }

        $v = new InputValidator();
        $fname = $v->name('fname', $input['fname'] ?? $user['fname'] ?? '', true);
        $lname = $v->name('lname', $input['lname'] ?? $user['lname'] ?? '', true);
        $mname = $v->name('mname', $input['mname'] ?? $user['mname'] ?? '');
        $active = array_key_exists('active', $input) ? !empty($input['active']) : ((int) ($user['active'] ?? 0) === 1);
        $facilityId = (int) ($input['facility_id'] ?? 0);
        $email = $v->email('email', $input['email'] ?? '');
        $v->throwIfInvalid();
        $groups = is_array($input['groups'] ?? null)
            ? array_values(array_filter(array_map('strval', $input['groups'])))
            : (AclExtended::aclGetGroupTitles($username) ?: []);

        if (!$active && $this->isLastClinicAdmin($username)) {
            throw new \InvalidArgumentException('Cannot deactivate the last clinic admin');
        }

        $this->assertGroupsAllowed($groups, '', '', $actorUserId);

        sqlStatement(
            'UPDATE users SET fname = ?, lname = ?, mname = ?, active = ?, facility_id = ?, email = ? WHERE id = ?',
            [$fname, $lname, $mname, $active ? 1 : 0, $facilityId, $email, $userId]
        );

        AclExtended::setUserAro(
            $groups,
            $username,
            $fname,
            $mname,
            $lname
        );

        $this->auditStaffEvent('admin_hub.staff_updated', $actorUserId, $username, '');

        return $this->getUserDetail($userId);
    }

    public function resetPassword(
        int $targetUserId,
        string $adminPassword,
        string $newPassword,
        int $actorUserId,
        bool $requireChangeAtNextLogin = false
    ): void
    {
        $this->assertCanManageStaff();

        if ($adminPassword === '') {
            throw new \InvalidArgumentException('Your password is required to reset another user\'s password');
        }
        if (strlen($newPassword) < 8) {
            throw new \InvalidArgumentException('New password must be at least 8 characters');
        }

        $user = QueryUtils::querySingleRow(
            'SELECT id, username FROM users WHERE id = ?',
            [$targetUserId]
        );
        if (empty($user)) {
            throw new \InvalidArgumentException('User not found');
        }

        $username = (string) ($user['username'] ?? '');
        if ($username === '' || !AclExtended::iHavePermissionsOf($username)) {
            throw new \RuntimeException('Not authorized to modify this user', 403);
        }

        $authUtils = new AuthUtils();
        $adminPass = $adminPassword;
        $newPass = $newPassword;
        $success = $authUtils->updatePassword($actorUserId, $targetUserId, $adminPass, $newPass);
        if (!$success) {
            // Generic on purpose — do not reveal which check failed (auth-adjacent).
            throw new \InvalidArgumentException(
                'Password reset failed. Check your password and the new password requirements.'
            );
        }

        if ($requireChangeAtNextLogin) {
            self::requirePasswordChange($targetUserId, $actorUserId);
            $this->auditStaffEvent('admin_hub.staff_temp_password', $actorUserId, $username, '');
        } else {
            self::clearPasswordChangeRequirement($targetUserId);
        }

        $this->auditStaffEvent('admin_hub.staff_password_reset', $actorUserId, $username, '');
    }

    /**
     * SEC-5: flag a staff account to change its (temporary) password before it
     * can use the New Clinic desks again. Enforced at the module shell.
     */
    public static function requirePasswordChange(int $userId, ?int $actorUserId = null): void
    {
        QueryUtils::sqlStatementThrowException(
            'INSERT INTO new_password_reset_required (user_id, created_by) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE created_by = VALUES(created_by), created_at = NOW()',
            [$userId, $actorUserId]
        );
    }

    public static function clearPasswordChangeRequirement(int $userId): void
    {
        QueryUtils::sqlStatementThrowException(
            'DELETE FROM new_password_reset_required WHERE user_id = ?',
            [$userId]
        );
    }

    public static function passwordChangeRequired(int $userId): bool
    {
        if ($userId <= 0) {
            return false;
        }
        $row = QueryUtils::querySingleRow(
            'SELECT user_id FROM new_password_reset_required WHERE user_id = ?',
            [$userId]
        );

        return !empty($row);
    }

    /**
     * Accounts currently blocked by core's failed-login counter
     * (users_secure.login_fail_counter vs password_max_failed_logins, within
     * the time_reset window). Locked staff cannot log in until the window
     * elapses or an admin unlocks them here.
     *
     * @return array<string, mixed>
     */
    public function listLockedAccounts(): array
    {
        $this->assertCanManageStaff();

        $maxFails = (int) ($GLOBALS['password_max_failed_logins'] ?? 0);
        $windowSeconds = (int) ($GLOBALS['time_reset_password_max_failed_logins'] ?? 0);
        if ($maxFails <= 0) {
            return ['enabled' => false, 'items' => [], 'max_failed_logins' => 0, 'window_seconds' => $windowSeconds];
        }

        $sql = "SELECT u.id, u.username, u.fname, u.lname, us.login_fail_counter,
                       TIMESTAMPDIFF(SECOND, us.last_login_fail, NOW()) AS seconds_since_fail
                FROM users_secure us
                INNER JOIN users u ON BINARY u.username = us.username
                WHERE us.login_fail_counter >= ?";
        $bind = [$maxFails];
        if ($windowSeconds > 0) {
            $sql .= ' AND TIMESTAMPDIFF(SECOND, us.last_login_fail, NOW()) <= ?';
            $bind[] = $windowSeconds;
        }
        $sql .= ' ORDER BY us.last_login_fail DESC';

        $items = [];
        foreach (QueryUtils::fetchRecords($sql, $bind) ?: [] as $row) {
            $secondsSince = (int) ($row['seconds_since_fail'] ?? 0);
            $items[] = [
                'user_id' => (int) $row['id'],
                'username' => (string) $row['username'],
                'display_name' => trim((string) ($row['fname'] ?? '') . ' ' . (string) ($row['lname'] ?? '')),
                'fail_counter' => (int) ($row['login_fail_counter'] ?? 0),
                'seconds_since_fail' => $secondsSince,
                'auto_unlock_in_seconds' => $windowSeconds > 0 ? max(0, $windowSeconds - $secondsSince) : null,
            ];
        }

        return [
            'enabled' => true,
            'items' => $items,
            'max_failed_logins' => $maxFails,
            'window_seconds' => $windowSeconds,
        ];
    }

    /**
     * Admin unlock: clear core's per-user failed-login counter. Audited; no
     * email to the user (staff accounts are admin-managed).
     */
    public function unlockAccount(int $targetUserId, int $actorUserId): array
    {
        $this->assertCanManageStaff();

        $user = QueryUtils::querySingleRow(
            'SELECT id, username FROM users WHERE id = ?',
            [$targetUserId]
        );
        if (empty($user) || (string) ($user['username'] ?? '') === '') {
            throw new \InvalidArgumentException('User not found');
        }

        $username = (string) $user['username'];
        AuthUtils::resetLoginFailedCounter($username);
        $this->auditStaffEvent('admin_hub.staff_unlocked', $actorUserId, $username, '');

        return $this->listLockedAccounts();
    }

    public function deactivateUser(int $userId, int $actorUserId): void
    {
        $this->assertCanManageStaff();

        $user = QueryUtils::querySingleRow(
            'SELECT id, username, active FROM users WHERE id = ?',
            [$userId]
        );
        if (empty($user)) {
            throw new \InvalidArgumentException('User not found');
        }

        $username = (string) ($user['username'] ?? '');
        if ($this->isLastClinicAdmin($username)) {
            throw new \InvalidArgumentException('Cannot deactivate the last clinic admin');
        }

        sqlStatement('UPDATE users SET active = 0 WHERE id = ?', [$userId]);
        $this->auditStaffEvent('admin_hub.staff_deactivated', $actorUserId, $username, '');
    }

    /**
     * @return array<string, mixed>
     */
    public function getTemplatesPayload(int $facilityId): array
    {
        $this->assertCanManageStaff();

        $templates = [];
        foreach (ClinicRolesService::roleTemplates() as $template) {
            $templates[] = array_merge($template, [
                'warnings' => $this->buildTemplateWarnings((string) $template['id'], $facilityId),
            ]);
        }

        return ['templates' => $templates];
    }

    /**
     * @param list<string> $groups
     */
    private function assertGroupsAllowed(array $groups, string $templateId, string $promoteReason, int $actorUserId): void
    {
        if (!AclMain::aclCheckCore('admin', 'super')) {
            foreach ($groups as $group) {
                if (AclExtended::isGroupIncludeSuperuser($group)) {
                    throw new \RuntimeException('Saving denied — superuser groups require administrator', 403);
                }
            }
        }

        if ($templateId === 'admin' && $promoteReason === '') {
            throw new \InvalidArgumentException('Reason required when assigning clinic admin template');
        }

        if ($templateId === 'admin' && $promoteReason !== '') {
            EventAuditLogger::getInstance()->newEvent(
                'admin_hub',
                $_SESSION['authUser'] ?? '',
                $_SESSION['authProvider'] ?? '',
                1,
                'user_promoted user_id=' . $actorUserId . ' template=admin reason=' . $promoteReason
            );
        }
    }

    private function insertStaffUser(
        string $username,
        string $fname,
        string $lname,
        int $facilityId,
        string $password
    ): int {
        sqlInsert(
            'INSERT INTO users (username, password, authorized, active, fname, lname, facility_id) '
            . "VALUES (?, 'NoLongerUsed', 1, 1, ?, ?, ?)",
            [$username, $fname, $lname, $facilityId]
        );
        $row = QueryUtils::querySingleRow(
            'SELECT id FROM users WHERE username = ?',
            [$username]
        );
        $userId = (int) ($row['id'] ?? 0);
        if ($userId <= 0) {
            throw new \RuntimeException('Failed to create user');
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        if ($hash === false || $hash === '') {
            throw new \RuntimeException('Unable to hash password');
        }

        $secure = QueryUtils::querySingleRow(
            'SELECT id FROM users_secure WHERE id = ? OR username = ?',
            [$userId, $username]
        );
        if (!empty($secure)) {
            sqlStatement(
                'UPDATE users_secure SET username = ?, password = ? WHERE id = ?',
                [$username, $hash, $userId]
            );
        } else {
            sqlInsert(
                'INSERT INTO users_secure (id, username, password) VALUES (?, ?, ?)',
                [$userId, $username, $hash]
            );
        }

        return $userId;
    }

    private function ensureDefaultAuthGroup(string $username, string $groupName = 'Default'): void
    {
        $existing = QueryUtils::querySingleRow(
            'SELECT id FROM `groups` WHERE BINARY `user` = ?',
            [$username]
        );
        if (!empty($existing)) {
            return;
        }

        sqlStatement(
            'INSERT INTO `groups` SET name = ?, user = ?',
            [$groupName, $username]
        );
    }

    private function isLastClinicAdmin(string $username): bool
    {
        $groups = AclExtended::aclGetGroupTitles($username) ?: [];
        if (!in_array('New Clinic Admin', $groups, true)) {
            return false;
        }

        $countRow = QueryUtils::querySingleRow(
            "SELECT COUNT(DISTINCT u.id) AS total
             FROM users u
             INNER JOIN gacl_aro a ON a.value = u.username AND a.section_value = 'users'
             INNER JOIN gacl_groups_aro_map m ON m.aro_id = a.id
             INNER JOIN gacl_aro_groups g ON g.id = m.group_id AND g.value = 'new_admin'
             WHERE u.active = 1 AND u.username != ''"
        );

        return (int) ($countRow['total'] ?? 0) <= 1;
    }

    /**
     * @return list<string>
     */
    private function buildTemplateWarnings(string $templateId, int $facilityId): array
    {
        $warnings = [];
        if ($templateId === 'lab' && !$this->config->isEnabled('enable_lab_role', 0, $facilityId)) {
            $warnings[] = 'Lab desk is OFF in Queue & roles — enable before this user can use the lab queue.';
        }
        if ($templateId === 'pharmacy' && !$this->config->isEnabled('enable_pharmacy_role', 0, $facilityId)) {
            $warnings[] = 'Pharmacy desk is OFF in Queue & roles — enable before this user can use pharmacy.';
        }

        return $warnings;
    }

    private function auditStaffEvent(string $event, int $actorUserId, string $username, string $templateId): void
    {
        EventAuditLogger::getInstance()->newEvent(
            $event,
            $_SESSION['authUser'] ?? '',
            $_SESSION['authProvider'] ?? '',
            1,
            'actor_user_id=' . $actorUserId . ' username=' . $username . ' template=' . $templateId
        );
    }
}

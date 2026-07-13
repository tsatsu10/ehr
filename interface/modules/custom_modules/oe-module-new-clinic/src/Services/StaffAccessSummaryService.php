<?php

/**
 * Per-user effective New Clinic access summary (M15-F04).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclExtended;
use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class StaffAccessSummaryService
{
    public function __construct(
        private readonly StaffAdminService $staffAdmin = new StaffAdminService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getSummary(int $userId): array
    {
        $this->staffAdmin->assertCanManageStaff();

        $user = QueryUtils::querySingleRow(
            'SELECT id, username, fname, lname, active FROM users WHERE id = ?',
            [$userId]
        );
        if (empty($user)) {
            throw new \InvalidArgumentException('User not found');
        }

        $username = (string) ($user['username'] ?? '');
        $groups = $username !== '' ? (AclExtended::aclGetGroupTitles($username) ?: []) : [];
        $template = ClinicRolesService::inferTemplateFromGroups($groups);

        $deskAcos = [
            'new_reception' => 'Front Desk',
            'new_nurse' => 'Triage',
            'new_doctor' => 'Doctor',
            'new_lab' => 'Lab',
            'new_pharmacy' => 'Pharmacy',
            'new_cashier' => 'Cashier',
            'new_admin' => 'Clinic Setup',
        ];

        $desks = [];
        foreach ($deskAcos as $aco => $label) {
            if (AclMain::aclCheckCore('new_clinic', $aco, $username)) {
                $desks[] = $label;
            }
        }

        $sensitive = [];
        foreach (array_keys(ClinicRolesService::buildGrantMatrix()) as $aco) {
            if (!AclMain::aclCheckCore('new_clinic', $aco, $username)) {
                continue;
            }
            if (!in_array($aco, array_keys($deskAcos), true)) {
                $sensitive[] = $aco;
            }
        }

        $hasClinicDesk = $desks !== [];

        return [
            'user_id' => $userId,
            'username' => $username,
            'display_name' => trim(($user['fname'] ?? '') . ' ' . ($user['lname'] ?? '')),
            'active' => (int) ($user['active'] ?? 0) === 1,
            'groups' => $groups,
            'role_template' => $template,
            'desk_apps' => $desks,
            'sensitive_acos' => $sensitive,
            // A6b (G11) — read-only MFA-enrolled status so leads can chase stragglers.
            // Any registered method counts (TOTP or U2F); read-only here, enrollment
            // is self-service only (my-profile).
            'mfa_enabled' => $this->hasMfa($userId),
            'warnings' => $hasClinicDesk ? [] : ['No clinic desk access — assign a role template or group.'],
            'legacy_acl_url' => 'acl',
        ];
    }

    private function hasMfa(int $userId): bool
    {
        $row = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS c FROM login_mfa_registrations WHERE user_id = ?',
            [$userId]
        );

        return is_array($row) && (int) ($row['c'] ?? 0) > 0;
    }
}

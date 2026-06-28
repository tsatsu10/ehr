<?php

/**
 * Read-only New Clinic role and ACL summary for Clinic Setup (M6 §7.9.5)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclExtended;
use OpenEMR\Common\Database\QueryUtils;

class ClinicRolesService
{
    /** @var array<string, string> group value => display title */
    private const GROUPS = [
        'new_reception' => 'New Clinic Reception',
        'new_reception_lead' => 'New Clinic Reception Lead',
        'new_nurse' => 'New Clinic Nurse',
        'new_nurse_lead' => 'New Clinic Nurse Lead',
        'new_doctor' => 'New Clinic Doctor',
        'new_lab' => 'New Clinic Lab',
        'new_lab_lead' => 'New Clinic Lab Lead',
        'new_pharmacy' => 'New Clinic Pharmacy',
        'new_pharmacy_lead' => 'New Clinic Pharmacy Lead',
        'new_cashier' => 'New Clinic Cashier',
        'new_cashier_lead' => 'New Clinic Cashier Lead',
        'new_admin' => 'New Clinic Admin',
    ];

    /** @var array<string, string> */
    private const ACOS = [
        'new_reception' => 'Reception Desk',
        'new_nurse' => 'Nurse Desk',
        'new_doctor' => 'Doctor Desk',
        'new_lab' => 'Lab Desk',
        'new_pharmacy' => 'Pharmacy Desk',
        'new_cashier' => 'Cashier Desk',
        'new_admin' => 'Clinic Admin',
        'new_create_despite_dup' => 'Create Despite Duplicate',
        'new_billing_skip_completion' => 'Skip Billing Completion',
        'new_revisit_skip_completion' => 'Skip Revisit Completion',
        'new_skip_triage' => 'Skip Triage',
        'new_visit_reopen' => 'Reopen Consult',
        'new_visit_cancel' => 'Cancel Visit',
        'new_discount' => 'Apply Discount',
        'new_receipt_reprint' => 'Reprint Receipt',
        'new_fee_schedule_admin' => 'Fee Schedule Admin',
        'new_clinic_config_admin' => 'Clinic Config Admin',
        'new_visit_skip_queue' => 'Skip Lab/Pharmacy Queue',
        'new_visit_mark_outstanding' => 'Mark Left Unpaid',
        'new_close_without_charge' => 'Close Without Charge',
        'new_esign_skip_complete' => 'Skip E-Sign Gate',
        'new_chart_depth' => 'Chart Depth Read',
        'new_chart_depth_finance' => 'Chart Depth Payment History',
        'new_chart_depth_referral' => 'Chart Depth Referrals',
        'new_chart_depth_export' => 'Chart Depth Export',
        'new_chart_depth_export_full' => 'Chart Depth Full Export',
        'reports' => 'Daily Reports',
    ];

    /** @var array<string, string> */
    private const SENSITIVE_ACO_NOTES = [
        'new_skip_triage' => 'Allows sending patients to the doctor without triage vitals.',
        'new_visit_cancel' => 'Allows cancelling an in-progress visit from desks or reports.',
        'new_visit_skip_queue' => 'Allows skipping lab or pharmacy queue to payment.',
        'new_visit_mark_outstanding' => 'Allows marking a visit as left without paying.',
        'new_close_without_charge' => 'Allows closing a visit with zero payment recorded.',
        'new_create_despite_dup' => 'Allows creating a patient despite a likely duplicate match.',
        'new_esign_skip_complete' => 'Allows completing consult or payment without E-Sign when a reason is recorded.',
    ];

    /**
     * @return array<string, mixed>
     */
    public function getRolesPayload(): array
    {
        $grantMatrix = self::buildGrantMatrix();

        return [
            'role_groups' => $this->fetchRoleGroups(),
            'acl_inventory' => self::buildAclInventory($grantMatrix),
            'sensitive_permissions' => self::buildSensitivePermissions($grantMatrix),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchRoleGroups(): array
    {
        $membersByGroup = $this->fetchAllGroupMembers();
        $groups = [];
        foreach (self::GROUPS as $value => $title) {
            $members = $membersByGroup[$value] ?? [];
            $groups[] = [
                'group_key' => $value,
                'group_title' => $title,
                'member_count' => count($members),
                'members' => $members,
            ];
        }

        return $groups;
    }

    /**
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function fetchAllGroupMembers(): array
    {
        $groupKeys = array_keys(self::GROUPS);
        if (empty($groupKeys)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($groupKeys), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT g.value AS group_key, u.id, u.username, u.fname, u.lname, u.active
             FROM gacl_aro_groups g
             INNER JOIN gacl_groups_aro_map m ON m.group_id = g.id
             INNER JOIN gacl_aro a ON a.id = m.aro_id AND a.section_value = 'users'
             INNER JOIN users u ON u.username = a.value
             WHERE g.value IN ($placeholders)
             ORDER BY g.value ASC, u.lname ASC, u.fname ASC, u.username ASC",
            $groupKeys
        ) ?: [];

        $grouped = [];
        foreach ($rows as $row) {
            $groupKey = (string) ($row['group_key'] ?? '');
            if ($groupKey === '') {
                continue;
            }
            $grouped[$groupKey][] = [
                'id' => (int) ($row['id'] ?? 0),
                'username' => (string) ($row['username'] ?? ''),
                'display_name' => trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? '')),
                'active' => (int) ($row['active'] ?? 0) === 1,
            ];
        }

        return $grouped;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchGroupMembers(string $groupValue): array
    {
        return $this->fetchAllGroupMembers()[$groupValue] ?? [];
    }

    /**
     * @return array<string, array<int, string>>
     */
    public static function buildGrantMatrix(): array
    {
        $deskMap = [
            'new_reception' => 'new_reception',
            'new_nurse' => 'new_nurse',
            'new_doctor' => 'new_doctor',
            'new_lab' => 'new_lab',
            'new_pharmacy' => 'new_pharmacy',
            'new_cashier' => 'new_cashier',
            'new_admin' => 'new_admin',
        ];

        $extraGrants = [
            'new_reception_lead' => ['new_reception', 'new_create_despite_dup', 'new_skip_triage', 'new_visit_cancel', 'new_visit_skip_queue'],
            'new_nurse_lead' => ['new_nurse', 'new_skip_triage'],
            'new_lab_lead' => ['new_lab'],
            'new_pharmacy_lead' => ['new_pharmacy'],
            'new_cashier_lead' => ['new_cashier', 'new_billing_skip_completion', 'new_discount', 'new_visit_mark_outstanding', 'new_close_without_charge', 'new_receipt_reprint', 'new_esign_skip_complete', 'new_chart_depth', 'new_chart_depth_finance', 'new_chart_depth_referral'],
            'new_admin' => array_keys(self::ACOS),
            'new_doctor' => ['new_doctor', 'new_visit_reopen', 'new_visit_skip_queue', 'new_chart_depth', 'new_chart_depth_referral', 'new_chart_depth_export'],
            'new_cashier' => ['new_cashier', 'new_receipt_reprint', 'new_chart_depth', 'new_chart_depth_finance'],
            'new_reception' => ['new_chart_depth_export'],
        ];

        $matrix = [];
        foreach ($deskMap as $group => $aco) {
            $matrix[$aco][] = self::GROUPS[$group];
        }
        foreach ($extraGrants as $group => $acos) {
            if (!isset(self::GROUPS[$group])) {
                continue;
            }
            foreach ($acos as $aco) {
                $matrix[$aco][] = self::GROUPS[$group];
            }
        }

        foreach ($matrix as $aco => $groupTitles) {
            $matrix[$aco] = array_values(array_unique($groupTitles));
            sort($matrix[$aco]);
        }

        return $matrix;
    }

    /**
     * @param array<string, array<int, string>> $grantMatrix
     * @return array<int, array<string, mixed>>
     */
    private static function buildAclInventory(array $grantMatrix): array
    {
        $inventory = [];
        foreach (self::ACOS as $acoKey => $acoTitle) {
            $inventory[] = [
                'aco_key' => $acoKey,
                'aco_title' => $acoTitle,
                'granted_groups' => $grantMatrix[$acoKey] ?? [],
            ];
        }

        return $inventory;
    }

    /**
     * @param array<string, array<int, string>> $grantMatrix
     * @return array<int, array<string, mixed>>
     */
    private static function buildSensitivePermissions(array $grantMatrix): array
    {
        $items = [];
        foreach (self::SENSITIVE_ACO_NOTES as $acoKey => $note) {
            $items[] = [
                'aco_key' => $acoKey,
                'aco_title' => self::ACOS[$acoKey] ?? $acoKey,
                'note' => $note,
                'granted_groups' => $grantMatrix[$acoKey] ?? [],
            ];
        }

        return $items;
    }

    /** @return array<int, string> */
    public static function defaultDeskGroupNames(): array
    {
        return [
            'Clinicians',
            'New Clinic Nurse',
            'New Clinic Reception',
            'New Clinic Doctor',
            'New Clinic Lab',
            'New Clinic Pharmacy',
            'New Clinic Cashier',
            'New Clinic Admin',
        ];
    }

    /**
     * Grant standard New Clinic desk groups to an active user (setup helper).
     *
     * @return array<int, string>
     */
    public function grantDefaultDeskGroupsToUsername(string $username): array
    {
        $username = trim($username);
        if ($username === '') {
            throw new \InvalidArgumentException('Username is required');
        }

        $user = QueryUtils::querySingleRow(
            "SELECT username FROM users WHERE username = ? AND active = 1",
            [$username]
        );
        if (empty($user)) {
            throw new \InvalidArgumentException('Active user not found');
        }

        require_once dirname(__DIR__, 4) . '/library/classes/AclExtended.class.php';

        foreach (self::defaultDeskGroupNames() as $group) {
            AclExtended::addUserAros($username, $group);
        }

        return AclExtended::aclGetGroupTitles($username) ?: [];
    }
}

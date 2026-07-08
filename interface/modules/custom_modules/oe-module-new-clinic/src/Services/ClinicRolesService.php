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
        'new_pharmacy_lead' => 'Pharmacy Lead',
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
        'new_registry' => 'Patient Registry',
        'new_registry_export' => 'Patient Registry Export',
        'new_cohort_share_filter' => 'Patient Registry Share Filter',
        'new_lab_ops' => 'Lab Operations Hub',
        'new_pharm_ops' => 'Pharmacy Operations Hub',
        'new_bill_ops' => 'Billing Back Office Hub',
        'reports' => 'Daily Reports',
        'new_reports_hub' => 'Reporting Operations Hub',
        'new_admin_hub_system' => 'Admin Hub System Health',
        'new_admin_hub_forms' => 'Admin Hub Forms Bundle',
        'new_admin_hub_people' => 'Admin Hub People & Access',
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

    /**
     * @return list<array<string, mixed>>
     */
    public static function roleTemplates(): array
    {
        return [
            [
                'id' => 'reception',
                'label' => 'Reception',
                'desk_app' => 'front_desk',
                'desks' => ['Front Desk'],
                'supports_lead' => true,
            ],
            [
                'id' => 'nurse',
                'label' => 'Nurse',
                'desk_app' => 'triage',
                'desks' => ['Triage'],
                'supports_lead' => true,
            ],
            [
                'id' => 'doctor',
                'label' => 'Doctor',
                'desk_app' => 'doctor',
                'desks' => ['Doctor'],
                'supports_lead' => false,
            ],
            [
                'id' => 'lab',
                'label' => 'Lab technician',
                'desk_app' => 'lab',
                'desks' => ['Lab'],
                'supports_lead' => true,
            ],
            [
                'id' => 'pharmacy',
                'label' => 'Pharmacist',
                'desk_app' => 'pharmacy',
                'desks' => ['Pharmacy'],
                'supports_lead' => true,
            ],
            [
                'id' => 'cashier',
                'label' => 'Cashier',
                'desk_app' => 'cashier',
                'desks' => ['Cashier'],
                'supports_lead' => true,
            ],
            [
                'id' => 'admin',
                'label' => 'Clinic owner / admin',
                'desk_app' => 'clinic_admin',
                'desks' => ['Clinic Setup'],
                'supports_lead' => false,
            ],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function getTemplate(string $templateId): ?array
    {
        foreach (self::roleTemplates() as $template) {
            if (($template['id'] ?? '') === $templateId) {
                return $template;
            }
        }

        return null;
    }

    /**
     * @return list<string>
     */
    public static function groupsForTemplate(string $templateId, bool $isLead = false): array
    {
        $map = [
            'reception' => ['Clinicians', 'New Clinic Reception'],
            'nurse' => ['Clinicians', 'New Clinic Nurse'],
            'doctor' => ['Clinicians', 'New Clinic Doctor'],
            'lab' => ['Clinicians', 'New Clinic Lab'],
            'pharmacy' => ['Clinicians', 'New Clinic Pharmacy'],
            'cashier' => ['Clinicians', 'New Clinic Cashier'],
            'admin' => ['Clinicians', 'New Clinic Admin'],
        ];
        $leadMap = [
            'reception' => 'New Clinic Reception Lead',
            'nurse' => 'New Clinic Nurse Lead',
            'lab' => 'New Clinic Lab Lead',
            'pharmacy' => 'New Clinic Pharmacy Lead',
            'cashier' => 'New Clinic Cashier Lead',
        ];

        $groups = $map[$templateId] ?? [];
        if ($isLead && isset($leadMap[$templateId])) {
            $groups[] = $leadMap[$templateId];
        }

        return $groups;
    }

    /**
     * @param list<string> $groups
     * @return array<string, mixed>
     */
    public static function inferTemplateFromGroups(array $groups): array
    {
        $checks = [
            'admin' => 'New Clinic Admin',
            'doctor' => 'New Clinic Doctor',
            'nurse' => 'New Clinic Nurse',
            'reception' => 'New Clinic Reception',
            'lab' => 'New Clinic Lab',
            'pharmacy' => 'New Clinic Pharmacy',
            'cashier' => 'New Clinic Cashier',
        ];
        foreach ($checks as $id => $groupTitle) {
            if (in_array($groupTitle, $groups, true)) {
                $template = self::getTemplate($id);

                return [
                    'id' => $id,
                    'label' => (string) ($template['label'] ?? $id),
                    'desks' => $template['desks'] ?? [],
                ];
            }
        }

        return ['id' => null, 'label' => null, 'desks' => []];
    }

    /**
     * @return list<array{kind: string, text: string, allowed: bool}>
     */
    public static function buildTemplateReview(string $templateId, bool $isLead = false): array
    {
        $template = self::getTemplate($templateId);
        if ($template === null) {
            return [];
        }

        $desk = (string) (($template['desks'][0] ?? 'Clinic desk'));
        $items = [
            ['kind' => 'desk', 'text' => 'Land on ' . $desk . ' after login', 'allowed' => true],
        ];

        $canMap = [
            'reception' => [
                ['text' => 'Create patients and start visits', 'allowed' => true],
                ['text' => 'Post payments at Cashier', 'allowed' => false],
                ['text' => 'Change fee schedule', 'allowed' => false],
            ],
            'cashier' => [
                ['text' => 'Post payments and print receipts', 'allowed' => true],
                ['text' => 'Change fee schedule', 'allowed' => false],
            ],
            'admin' => [
                ['text' => 'Configure clinic setup and fees', 'allowed' => true],
                ['text' => 'Manage all desk queues', 'allowed' => true],
            ],
        ];

        foreach ($canMap[$templateId] ?? [] as $row) {
            $items[] = array_merge(['kind' => 'capability'], $row);
        }

        if ($isLead) {
            $items[] = [
                'kind' => 'lead',
                'text' => 'Lead permissions for this desk are included',
                'allowed' => true,
            ];
        }

        $items[] = [
            'kind' => 'groups',
            'text' => 'Groups: ' . implode(', ', self::groupsForTemplate($templateId, $isLead)),
            'allowed' => true,
        ];

        return $items;
    }
}

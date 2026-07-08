<?php

/**
 * Facility-specific user fields (FACUSR layout).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class FacilityUserAdminService
{
    public function __construct(
        private readonly StaffAdminService $staffAdmin = new StaffAdminService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function listMatrix(): array
    {
        $this->staffAdmin->assertCanManageStaff();

        $users = QueryUtils::fetchRecords(
            "SELECT id, username, fname, lname, active
             FROM users
             WHERE username != '' AND username IS NOT NULL AND active = 1
             ORDER BY lname ASC, fname ASC, username ASC"
        ) ?: [];

        $facilities = QueryUtils::fetchRecords(
            'SELECT id, name FROM facility ORDER BY name ASC'
        ) ?: [];

        $layout = $this->fetchLayoutFields();
        $hasFields = $layout !== [];

        return [
            'users' => array_map(static fn (array $row): array => [
                'id' => (int) ($row['id'] ?? 0),
                'username' => (string) ($row['username'] ?? ''),
                'display_name' => trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? '')),
            ], $users),
            'facilities' => array_map(static fn (array $row): array => [
                'id' => (int) ($row['id'] ?? 0),
                'name' => (string) ($row['name'] ?? ''),
            ], $facilities),
            'has_facusr_fields' => $hasFields,
            'field_count' => count($layout),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getForUserFacility(int $userId, int $facilityId): array
    {
        $this->staffAdmin->assertCanManageStaff();

        $layout = $this->fetchLayoutFields();
        $values = [];
        foreach ($layout as $field) {
            $fieldId = (string) ($field['field_id'] ?? '');
            if ($fieldId === '') {
                continue;
            }
            $row = QueryUtils::querySingleRow(
                'SELECT field_value FROM facility_user_ids WHERE uid = ? AND facility_id = ? AND field_id = ?',
                [$userId, $facilityId, $fieldId]
            );
            $values[$fieldId] = (string) ($row['field_value'] ?? '');
        }

        return [
            'user_id' => $userId,
            'facility_id' => $facilityId,
            'fields' => $layout,
            'values' => $values,
        ];
    }

    /**
     * @param array<string, scalar|null> $values
     */
    public function saveForUserFacility(int $userId, int $facilityId, array $values): void
    {
        $this->staffAdmin->assertCanManageStaff();

        $layout = $this->fetchLayoutFields();
        foreach ($layout as $field) {
            $fieldId = (string) ($field['field_id'] ?? '');
            if ($fieldId === '' || !array_key_exists($fieldId, $values)) {
                continue;
            }
            $value = (string) ($values[$fieldId] ?? '');
            $entry = QueryUtils::querySingleRow(
                'SELECT id FROM facility_user_ids WHERE uid = ? AND facility_id = ? AND field_id = ?',
                [$userId, $facilityId, $fieldId]
            );
            if (empty($entry)) {
                sqlStatement(
                    'INSERT INTO facility_user_ids (uid, facility_id, field_id, field_value) VALUES (?, ?, ?, ?)',
                    [$userId, $facilityId, $fieldId, $value]
                );
            } else {
                sqlStatement(
                    'UPDATE facility_user_ids SET field_value = ? WHERE id = ?',
                    [$value, (int) $entry['id']]
                );
            }
        }
    }

    /**
     * Full user × facility matrix for FACUSR fields (stock facility_user.php parity).
     *
     * @return array<string, mixed>
     */
    public function getMatrixGrid(?int $facilityFilter = null, string $search = ''): array
    {
        $this->staffAdmin->assertCanManageStaff();

        $layout = $this->fetchLayoutFields();
        $facilities = QueryUtils::fetchRecords(
            $facilityFilter !== null && $facilityFilter > 0
                ? 'SELECT id, name FROM facility WHERE id = ? ORDER BY name ASC'
                : 'SELECT id, name FROM facility ORDER BY name ASC',
            $facilityFilter !== null && $facilityFilter > 0 ? [$facilityFilter] : []
        ) ?: [];

        $facilityList = array_map(static fn (array $row): array => [
            'id' => (int) ($row['id'] ?? 0),
            'name' => (string) ($row['name'] ?? ''),
        ], $facilities);

        $where = ["username != ''", 'username IS NOT NULL', 'active = 1'];
        $binds = [];
        $search = trim($search);
        if ($search !== '') {
            $where[] = '(username LIKE ? OR fname LIKE ? OR lname LIKE ?)';
            $like = '%' . $search . '%';
            $binds[] = $like;
            $binds[] = $like;
            $binds[] = $like;
        }
        $whereSql = implode(' AND ', $where);
        $users = QueryUtils::fetchRecords(
            "SELECT id, username, fname, lname FROM users WHERE {$whereSql} ORDER BY lname ASC, fname ASC",
            $binds
        ) ?: [];

        $rows = [];
        foreach ($users as $user) {
            $userId = (int) ($user['id'] ?? 0);
            foreach ($facilities as $facility) {
                $facilityId = (int) ($facility['id'] ?? 0);
                $cells = [];
                foreach ($layout as $field) {
                    $fieldId = (string) ($field['field_id'] ?? '');
                    if ($fieldId === '') {
                        continue;
                    }
                    $entry = QueryUtils::querySingleRow(
                        'SELECT field_value FROM facility_user_ids WHERE uid = ? AND facility_id = ? AND field_id = ?',
                        [$userId, $facilityId, $fieldId]
                    );
                    $cells[$fieldId] = (string) ($entry['field_value'] ?? '');
                }
                $rows[] = [
                    'user_id' => $userId,
                    'username' => (string) ($user['username'] ?? ''),
                    'display_name' => trim(($user['fname'] ?? '') . ' ' . ($user['lname'] ?? '')),
                    'facility_id' => $facilityId,
                    'facility_name' => (string) ($facility['name'] ?? ''),
                    'cells' => $cells,
                ];
            }
        }

        return [
            'fields' => array_map(static fn (array $field): array => [
                'field_id' => (string) ($field['field_id'] ?? ''),
                'title' => (string) ($field['title'] ?? ''),
            ], $layout),
            'facilities' => $facilityList,
            'rows' => $rows,
            'has_facusr_fields' => $layout !== [],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fetchLayoutFields(): array
    {
        return QueryUtils::fetchRecords(
            "SELECT field_id, title, data_type, uor, seq, list_id, edit_options
             FROM layout_options
             WHERE form_id = 'FACUSR' AND uor > 0 AND field_id != ''
             ORDER BY group_id, seq"
        ) ?: [];
    }
}

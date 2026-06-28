<?php

/**
 * Patient Registry saved cohort filters (M10 PR-3)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class CohortSavedFilterService
{
    public function assertRegistryAccess(): void
    {
        (new PatientCohortSearchService())->assertRegistryAccess();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listForUser(int $userId): array
    {
        if ($userId <= 0) {
            return [];
        }

        try {
            $rows = QueryUtils::fetchRecords(
                "SELECT id, user_id, name, filter_json, is_shared, updated_at
                 FROM new_cohort_saved_filter
                 WHERE user_id = ? OR is_shared = 1
                 ORDER BY is_shared DESC, name ASC",
                [$userId]
            ) ?: [];
        } catch (\Throwable) {
            return [];
        }

        return array_map(function (array $row) use ($userId): array {
            $savedId = (int) ($row['id'] ?? 0);
            $isShared = !empty($row['is_shared']);
            $owned = (int) ($row['user_id'] ?? 0) === $userId;
            $name = (string) ($row['name'] ?? 'Saved filter');
            $filters = json_decode((string) ($row['filter_json'] ?? '{}'), true);

            return [
                'id' => 'saved:' . $savedId,
                'label' => ($isShared ? '[Shared] ' : '') . $name,
                'filters' => is_array($filters) ? $filters : [],
                'saved_id' => $savedId,
                'is_shared' => $isShared,
                'owned_by_user' => $owned,
                'can_delete' => $owned || AclMain::aclCheckCore('new_clinic', 'new_admin'),
            ];
        }, $rows);
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function save(int $userId, array $body): array
    {
        $this->assertRegistryAccess();

        if ($userId <= 0) {
            throw new \RuntimeException('Forbidden', 403);
        }

        $savedId = (int) ($body['id'] ?? 0);
        $name = mb_substr(trim((string) ($body['name'] ?? '')), 0, 80);
        $filters = $body['filters'] ?? null;
        $isShared = !empty($body['is_shared']);

        if ($name === '') {
            throw new \InvalidArgumentException('Filter name is required');
        }

        if (!is_array($filters)) {
            throw new \InvalidArgumentException('Invalid filters payload');
        }

        if (
            $isShared
            && !AclMain::aclCheckCore('new_clinic', 'new_cohort_share_filter')
            && !AclMain::aclCheckCore('new_clinic', 'new_admin')
        ) {
            throw new \RuntimeException('Forbidden', 403);
        }

        $encoded = json_encode($filters, JSON_THROW_ON_ERROR);

        if ($savedId > 0) {
            $existing = $this->getOwnedRow($savedId, $userId);
            if ($existing === null && !AclMain::aclCheckCore('new_clinic', 'new_admin')) {
                throw new \RuntimeException('Forbidden', 403);
            }

            QueryUtils::sqlStatementThrowException(
                "UPDATE new_cohort_saved_filter
                 SET name = ?, filter_json = ?, is_shared = ?, updated_at = NOW()
                 WHERE id = ?",
                [$name, $encoded, $isShared ? 1 : 0, $savedId]
            );
        } else {
            $savedId = (int) QueryUtils::sqlInsert(
                "INSERT INTO new_cohort_saved_filter (user_id, name, filter_json, is_shared)
                 VALUES (?, ?, ?, ?)",
                [$userId, $name, $encoded, $isShared ? 1 : 0]
            );
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_registry',
            $_SESSION['authUser'] ?? '',
            $_SESSION['authProvider'] ?? '',
            1,
            'saved_filter user_id=' . $userId . ' id=' . $savedId . ' shared=' . ($isShared ? '1' : '0')
        );

        return [
            'id' => $savedId,
            'name' => $name,
            'is_shared' => $isShared,
        ];
    }

    public function delete(int $userId, int $savedId): void
    {
        $this->assertRegistryAccess();

        if ($userId <= 0 || $savedId <= 0) {
            throw new \InvalidArgumentException('Invalid saved filter id');
        }

        $existing = $this->getOwnedRow($savedId, $userId);
        if ($existing === null && !AclMain::aclCheckCore('new_clinic', 'new_admin')) {
            throw new \RuntimeException('Forbidden', 403);
        }

        QueryUtils::sqlStatementThrowException(
            'DELETE FROM new_cohort_saved_filter WHERE id = ?',
            [$savedId]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_registry',
            $_SESSION['authUser'] ?? '',
            $_SESSION['authProvider'] ?? '',
            1,
            'saved_filter_delete user_id=' . $userId . ' id=' . $savedId
        );
    }

    /**
     * @return array<string, mixed>|null
     */
    private function getOwnedRow(int $savedId, int $userId): ?array
    {
        try {
            $row = QueryUtils::querySingleRow(
                'SELECT id, user_id FROM new_cohort_saved_filter WHERE id = ? AND user_id = ?',
                [$savedId, $userId]
            );
        } catch (\Throwable) {
            return null;
        }

        return is_array($row) ? $row : null;
    }
}

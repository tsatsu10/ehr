<?php

/**
 * S1 Flow Board per-user lane prefs (PRD §10.3 — server-side persistence)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class SchedulingFlowBoardPrefsService
{
    public function __construct(
        private readonly SchedulingAccessService $access = new SchedulingAccessService(),
    ) {
    }

    /**
     * @return array{collapsed: list<string>, order: list<string>}
     */
    public function getPrefs(int $userId): array
    {
        $this->access->assertHubAccess();
        if ($userId <= 0) {
            return $this->emptyPrefs();
        }

        $row = QueryUtils::querySingleRow(
            'SELECT collapsed_json, order_json FROM new_clinic_flowboard_lane_prefs WHERE user_id = ?',
            [$userId],
        );

        if (empty($row)) {
            return $this->emptyPrefs();
        }

        return [
            'collapsed' => $this->decodeStringList((string) ($row['collapsed_json'] ?? '[]')),
            'order' => $this->decodeStringList((string) ($row['order_json'] ?? '[]')),
        ];
    }

    /**
     * @param list<string> $collapsed
     * @param list<string> $order
     * @return array{collapsed: list<string>, order: list<string>}
     */
    public function savePrefs(int $userId, array $collapsed, array $order): array
    {
        $this->access->assertHubAccess();
        if ($userId <= 0) {
            throw new \InvalidArgumentException('User is required');
        }

        $collapsed = $this->sanitizeStatusList($collapsed);
        $order = $this->sanitizeStatusList($order);

        QueryUtils::sqlStatementThrowException(
            'INSERT INTO new_clinic_flowboard_lane_prefs (user_id, collapsed_json, order_json)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE collapsed_json = VALUES(collapsed_json),
                 order_json = VALUES(order_json)',
            [
                $userId,
                json_encode($collapsed, JSON_THROW_ON_ERROR),
                json_encode($order, JSON_THROW_ON_ERROR),
            ],
        );

        return ['collapsed' => $collapsed, 'order' => $order];
    }

    /**
     * @return array{collapsed: list<string>, order: list<string>}
     */
    private function emptyPrefs(): array
    {
        return ['collapsed' => [], 'order' => []];
    }

    /**
     * @return list<string>
     */
    private function decodeStringList(string $json): array
    {
        if ($json === '') {
            return [];
        }

        try {
            $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return [];
        }

        if (!is_array($decoded)) {
            return [];
        }

        return $this->sanitizeStatusList($decoded);
    }

    /**
     * @param list<mixed> $values
     * @return list<string>
     */
    private function sanitizeStatusList(array $values): array
    {
        $out = [];
        foreach ($values as $value) {
            $status = trim((string) $value);
            if ($status !== '' && !in_array($status, $out, true)) {
                $out[] = $status;
            }
        }

        return $out;
    }
}

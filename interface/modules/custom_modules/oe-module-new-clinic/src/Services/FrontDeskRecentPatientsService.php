<?php

/**
 * Per-user recently viewed patients for Front Desk (M1a)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Services\Globals\UserSettingsService;

class FrontDeskRecentPatientsService
{
    public const SETTING_KEY = 'interface/modules/custom_modules/oe-module-new-clinic/public/front-desk.php.recent_patients';

    private const MAX_ENTRIES = 5;

    /**
     * @return array<int, array{pid: int, display_name: string, pubpid: string}>
     */
    public function listRecent(): array
    {
        $raw = UserSettingsService::getUserSetting(self::SETTING_KEY);
        if ($raw === null || $raw === '') {
            return [];
        }

        try {
            $decoded = json_decode((string) $raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return [];
        }

        if (!is_array($decoded)) {
            return [];
        }

        $entries = [];
        foreach ($decoded as $row) {
            if (!is_array($row)) {
                continue;
            }
            $pid = (int) ($row['pid'] ?? 0);
            $displayName = trim((string) ($row['display_name'] ?? ''));
            $pubpid = trim((string) ($row['pubpid'] ?? ''));
            if ($pid <= 0 || $displayName === '') {
                continue;
            }
            $entries[] = [
                'pid' => $pid,
                'display_name' => $displayName,
                'pubpid' => $pubpid,
            ];
            if (count($entries) >= self::MAX_ENTRIES) {
                break;
            }
        }

        return $entries;
    }

    /**
     * @return array<int, array{pid: int, display_name: string, pubpid: string}>
     */
    public function remember(int $pid, string $displayName, string $pubpid): array
    {
        if ($pid <= 0) {
            throw new \InvalidArgumentException('pid required');
        }

        $displayName = trim($displayName);
        if ($displayName === '') {
            throw new \InvalidArgumentException('display_name required');
        }

        $pubpid = trim($pubpid);
        $entry = [
            'pid' => $pid,
            'display_name' => $displayName,
            'pubpid' => $pubpid,
        ];

        $current = $this->listRecent();
        $next = [$entry];
        foreach ($current as $row) {
            if ($row['pid'] === $pid) {
                continue;
            }
            $next[] = $row;
            if (count($next) >= self::MAX_ENTRIES) {
                break;
            }
        }

        UserSettingsService::setUserSetting(
            self::SETTING_KEY,
            json_encode($next, JSON_THROW_ON_ERROR)
        );

        return $next;
    }

    public function clear(): void
    {
        UserSettingsService::setUserSetting(self::SETTING_KEY, '[]');
    }
}

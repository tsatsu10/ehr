<?php

/**
 * Communications Hub user preferences (COM-F12 / prevSetting parity)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Services\Globals\UserSettingsService;

class CommHubUserSettingsService
{
    public const SETTING_PREFIX = 'interface/modules/custom_modules/oe-module-new-clinic/public/communications.php.';

    /** @var array<string, string> */
    private const ALLOWED_SORTBY = [
        'pnotes.date' => true,
        'users.lname' => true,
        'patient_data.lname' => true,
        'pnotes.title' => true,
        'pnotes.message_status' => true,
    ];

    /**
     * @return array{lens: string, activity: string, scope: string, sort: array{sortby: string, sortorder: string}}
     */
    public function getPreferences(?string $lensOverride = null, bool $canViewAllUsers = false): array
    {
        $lens = self::normalizeLens($lensOverride ?? $this->readSetting('comm_hub_lens', 'messages'));
        $activity = self::normalizeActivity($this->readSetting('comm_hub_activity', '1'));
        $scope = self::normalizeScope($this->readSetting('comm_hub_scope', 'my'));
        if (!$canViewAllUsers) {
            $scope = 'my';
        }

        return [
            'lens' => $lens,
            'activity' => $activity,
            'scope' => $scope,
            'sort' => self::normalizeSort($this->readSetting('comm_hub_sort', '')),
        ];
    }

    /**
     * @param array<string, mixed> $payload
     *
     * @return array{lens: string, activity: string, scope: string, sort: array{sortby: string, sortorder: string}}
     */
    public function savePreferences(array $payload, bool $canViewAllUsers): array
    {
        $prefs = [
            'lens' => self::normalizeLens((string) ($payload['lens'] ?? 'messages')),
            'activity' => self::normalizeActivity((string) ($payload['activity'] ?? '1')),
            'scope' => self::normalizeScope((string) ($payload['scope'] ?? 'my')),
            'sort' => self::normalizeSort($payload['sort'] ?? null),
        ];

        if (!$canViewAllUsers) {
            $prefs['scope'] = 'my';
        }

        $this->writeSetting('comm_hub_lens', $prefs['lens']);
        $this->writeSetting('comm_hub_activity', $prefs['activity']);
        $this->writeSetting('comm_hub_scope', $prefs['scope']);
        $this->writeSetting('comm_hub_sort', json_encode($prefs['sort'], JSON_THROW_ON_ERROR));

        return $prefs;
    }

    public static function normalizeLens(string $lens): string
    {
        return in_array($lens, ['messages', 'reminders'], true) ? $lens : 'messages';
    }

    public static function normalizeActivity(string $activity): string
    {
        return in_array($activity, ['1', '0', 'all'], true) ? $activity : '1';
    }

    public static function normalizeScope(string $scope): string
    {
        return $scope === 'all_users' ? 'all_users' : 'my';
    }

    /**
     * @param mixed $sort
     *
     * @return array{sortby: string, sortorder: string}
     */
    public static function normalizeSort(mixed $sort): array
    {
        $defaults = ['sortby' => 'pnotes.date', 'sortorder' => 'desc'];

        if (is_string($sort) && $sort !== '') {
            $decoded = json_decode($sort, true);
            if (is_array($decoded)) {
                $sort = $decoded;
            }
        }

        if (!is_array($sort)) {
            return $defaults;
        }

        $sortby = (string) ($sort['sortby'] ?? $defaults['sortby']);
        if (!isset(self::ALLOWED_SORTBY[$sortby])) {
            return $defaults;
        }

        $sortorder = strtolower((string) ($sort['sortorder'] ?? $defaults['sortorder']));
        if ($sortorder !== 'asc') {
            $sortorder = 'desc';
        }

        return ['sortby' => $sortby, 'sortorder' => $sortorder];
    }

    private function readSetting(string $label, string $default): string
    {
        $value = UserSettingsService::getUserSetting(self::SETTING_PREFIX . $label);
        if ($value === null || $value === '') {
            return $default;
        }

        return (string) $value;
    }

    private function writeSetting(string $label, string $value): void
    {
        UserSettingsService::setUserSetting(self::SETTING_PREFIX . $label, $value);
    }
}

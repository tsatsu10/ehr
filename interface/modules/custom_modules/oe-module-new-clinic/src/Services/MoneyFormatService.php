<?php

/**
 * Clinic currency formatting and OpenEMR global sync (M6-F27, D-REG-3)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class MoneyFormatService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly ConfigLogService $configLog = new ConfigLogService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getFormatPayload(int $facilityId = 0): array
    {
        $decimals = $this->config->getInt('currency_decimals', 2, $facilityId);
        $position = (string) ($this->config->get('currency_symbol_position', 'before', $facilityId) ?? 'before');
        if ($position !== 'after') {
            $position = 'before';
        }

        return [
            'currency_code' => (string) ($this->config->get('currency_code', 'GHS', $facilityId) ?? 'GHS'),
            'currency_symbol' => (string) ($this->config->get('currency_symbol', 'GH₵', $facilityId) ?? 'GH₵'),
            'currency_decimals' => max(0, min(4, $decimals)),
            'currency_symbol_position' => $position,
        ];
    }

    public function formatMoney(float|string $amount, int $facilityId = 0): string
    {
        $payload = $this->getFormatPayload($facilityId);
        $decimals = (int) $payload['currency_decimals'];
        $formatted = number_format((float) $amount, $decimals, '.', '');
        $symbol = (string) $payload['currency_symbol'];

        if ($symbol === '') {
            return $formatted;
        }

        if ($payload['currency_symbol_position'] === 'after') {
            return $formatted . ' ' . $symbol;
        }

        return $symbol . ' ' . $formatted;
    }

    /**
     * @return array<int, array<string, string>>
     */
    public function syncOpenEmrGlobals(int $facilityId, int $actorUserId): array
    {
        $payload = $this->getFormatPayload($facilityId);
        $targets = [
            'gbl_currency_symbol' => (string) $payload['currency_symbol'],
            'currency_decimals' => (string) $payload['currency_decimals'],
        ];

        $changes = [];
        foreach ($targets as $key => $newValue) {
            $prev = $this->readGlobal($key);
            if ($prev === $newValue) {
                continue;
            }

            $this->writeGlobal($key, $newValue);
            $this->logChange($key, $prev, $newValue, $actorUserId);
            $changes[] = [
                'key' => $key,
                'prev' => $prev,
                'new' => $newValue,
            ];
        }

        return $changes;
    }

    private function readGlobal(string $key): string
    {
        $row = QueryUtils::querySingleRow(
            "SELECT gl_value FROM globals WHERE gl_name = ? AND gl_index = 0",
            [$key]
        );

        if (!is_array($row) || !array_key_exists('gl_value', $row)) {
            return '';
        }

        return (string) $row['gl_value'];
    }

    private function writeGlobal(string $key, string $value): void
    {
        sqlStatement(
            "INSERT INTO globals (gl_name, gl_index, gl_value) VALUES (?, 0, ?)
             ON DUPLICATE KEY UPDATE gl_value = VALUES(gl_value)",
            [$key, $value]
        );

        global $GLOBALS;
        $GLOBALS[$key] = $value;
    }

    private function logChange(string $key, string $prevValue, string $newValue, int $actorUserId): void
    {
        $this->configLog->log('openemr_global', $key, $prevValue, $newValue, $actorUserId);
    }
}

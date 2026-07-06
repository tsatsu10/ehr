<?php

/**
 * Read per-facility module configuration
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ClinicConfigService
{
    private ?VisitScopeService $visitScope = null;

    private function getVisitScope(): VisitScopeService
    {
        if ($this->visitScope === null) {
            $this->visitScope = new VisitScopeService();
        }
        return $this->visitScope;
    }

    public function resolveReaderFacilityId(): int
    {
        return $this->getVisitScope()->resolveDefaultFacilityId();
    }

    public function isEnabled(string $key, int $default = 0, ?int $facilityId = null): bool
    {
        if ($facilityId === null) {
            $facilityId = $this->resolveReaderFacilityId();
        }

        return $this->getInt($key, $default, $facilityId) === 1;
    }

    public function get(string $key, ?string $default = null, int $facilityId = 0): ?string
    {
        $row = QueryUtils::querySingleRow(
            "SELECT config_value FROM new_clinic_config WHERE facility_id = ? AND config_key = ?",
            [$facilityId, $key]
        );

        if (is_array($row) && array_key_exists('config_value', $row) && $row['config_value'] !== null) {
            return (string) $row['config_value'];
        }

        if ($facilityId !== 0) {
            return $this->get($key, $default, 0);
        }

        // Per-facility saves clear global overrides; single-clinic desks often read facility_id=0.
        $readerFacilityId = $this->resolveReaderFacilityId();
        if ($readerFacilityId > 0) {
            $facilityRow = QueryUtils::querySingleRow(
                "SELECT config_value FROM new_clinic_config WHERE facility_id = ? AND config_key = ?",
                [$readerFacilityId, $key]
            );
            if (is_array($facilityRow) && array_key_exists('config_value', $facilityRow) && $facilityRow['config_value'] !== null) {
                return (string) $facilityRow['config_value'];
            }
        }

        return $default;
    }

    public function getInt(string $key, int $default = 0, int $facilityId = 0): int
    {
        return (int) ($this->get($key, (string) $default, $facilityId) ?? $default);
    }

    public function getBool(string $key, bool $default = false, int $facilityId = 0): bool
    {
        return $this->getInt($key, $default ? 1 : 0, $facilityId) === 1;
    }

    /**
     * Desk queue poll interval — 30s default; 10–30s when faster interrupts enabled (M0-F34).
     */
    public function resolveQueuePollIntervalMs(int $facilityId = 0): int
    {
        if ($this->getInt('enable_faster_queue_interrupts', 0, $facilityId) !== 1) {
            return 30000;
        }

        $seconds = $this->getInt('faster_queue_interrupt_poll_seconds', 10, $facilityId);

        return max(10, min(30, $seconds)) * 1000;
    }

    /**
     * @param array<int, string> $keys
     * @return array<string, string>
     */
    public function getMany(array $keys, int $facilityId = 0): array
    {
        $out = [];
        foreach ($keys as $key) {
            $out[$key] = (string) ($this->get($key, null, $facilityId) ?? '');
        }

        return $out;
    }

    public function set(string $key, string $value, int $facilityId = 0): void
    {
        $existing = QueryUtils::querySingleRow(
            "SELECT config_value FROM new_clinic_config WHERE facility_id = ? AND config_key = ?",
            [$facilityId, $key]
        );

        if (is_array($existing) && array_key_exists('config_value', $existing)) {
            sqlStatement(
                "UPDATE new_clinic_config SET config_value = ?, updated_at = NOW()
                 WHERE facility_id = ? AND config_key = ?",
                [$value, $facilityId, $key]
            );

            return;
        }

        sqlStatement(
            "INSERT INTO new_clinic_config (facility_id, config_key, config_value) VALUES (?, ?, ?)",
            [$facilityId, $key, $value]
        );
    }

    /**
     * Remove facility-global overrides so per-facility saves are authoritative.
     *
     * @param array<int, string> $keys
     */
    public function clearGlobalOverrides(array $keys): void
    {
        if (empty($keys)) {
            return;
        }

        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        sqlStatement(
            "DELETE FROM new_clinic_config WHERE facility_id = 0 AND config_key IN ($placeholders)",
            $keys
        );
    }
}

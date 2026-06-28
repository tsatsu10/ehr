<?php

/**
 * Insurance type helpers for registration (M1b §8)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class PatientInsuranceUtil
{
    /**
     * NHIS expired → treat as cash for display and completion (spec §8).
     *
     * @param array<string, mixed> $meta
     */
    public static function effectiveType(array $meta): string
    {
        $type = strtolower(trim((string) ($meta['insurance_type'] ?? 'cash')));
        if (!in_array($type, ['cash', 'nhis', 'private'], true)) {
            $type = 'cash';
        }

        if ($type === 'nhis') {
            $expiry = trim((string) ($meta['nhis_expiry'] ?? ''));
            if ($expiry !== '' && $expiry !== '0000-00-00' && $expiry < date('Y-m-d')) {
                return 'cash';
            }
        }

        return $type;
    }

    /**
     * @param array<string, mixed> $meta
     */
    public static function displayLabel(array $meta): string
    {
        $stored = strtolower(trim((string) ($meta['insurance_type'] ?? 'cash')));
        $effective = self::effectiveType($meta);

        if ($stored === 'nhis' && $effective === 'cash') {
            return 'Cash (NHIS expired)';
        }

        return match ($effective) {
            'nhis' => 'NHIS',
            'private' => 'Private',
            default => 'Cash',
        };
    }
}

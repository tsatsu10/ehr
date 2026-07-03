<?php

/**
 * M13 Pharmacy Operations — allergy cross-check helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class PharmOpsSafetyService
{
    private const NKDA_LABELS = ['nkda', 'no known drug allergies'];

    /**
     * @return list<string>
     */
    public static function normalizeTokens(string $text): array
    {
        $text = strtolower(trim($text));
        if ($text === '') {
            return [];
        }

        $parts = preg_split('/[^a-z0-9]+/', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $tokens = [];
        foreach ($parts as $part) {
            if (strlen($part) >= 3) {
                $tokens[] = $part;
            }
        }

        return array_values(array_unique($tokens));
    }

    /**
     * @param array<int, string> $allergies
     */
    public static function hasDrugAllergyWarning(string $drugName, array $allergies): bool
    {
        $drugTokens = self::normalizeTokens($drugName);
        if ($drugTokens === []) {
            return false;
        }

        $drugHaystack = implode(' ', $drugTokens);

        foreach ($allergies as $allergy) {
            $allergy = trim($allergy);
            if ($allergy === '' || in_array(strtolower($allergy), self::NKDA_LABELS, true)) {
                continue;
            }

            $allergyTokens = self::normalizeTokens($allergy);
            foreach ($allergyTokens as $allergyToken) {
                foreach ($drugTokens as $drugToken) {
                    if ($allergyToken === $drugToken) {
                        return true;
                    }
                }
            }

            $allergyLower = strtolower($allergy);
            if (strlen($allergyLower) >= 4 && str_contains($drugHaystack, $allergyLower)) {
                return true;
            }
        }

        return false;
    }
}

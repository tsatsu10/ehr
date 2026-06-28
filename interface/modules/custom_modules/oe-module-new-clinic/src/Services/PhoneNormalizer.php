<?php

/**
 * Regional phone normalization (M1a-F04 / PRD §12.3)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class PhoneNormalizer
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService()
    ) {
    }

    public function normalize(?string $raw, ?string $countryCode = null): string
    {
        if ($raw === null || trim($raw) === '') {
            return '';
        }

        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        if ($digits === '') {
            return '';
        }

        $countryCode = $countryCode ?? $this->config->get('country_code', '233');
        $countryCode = ltrim((string) $countryCode, '+');

        if ($countryCode !== '' && str_starts_with($digits, $countryCode)) {
            $digits = substr($digits, strlen($countryCode));
        }

        if ($digits !== '' && !str_starts_with($digits, '0') && strlen($digits) >= 9) {
            $digits = '0' . $digits;
        }

        return $digits;
    }

    public function mask(?string $normalized): string
    {
        if (empty($normalized)) {
            return '';
        }

        $len = strlen($normalized);
        if ($len <= 4) {
            return $normalized;
        }

        $prefix = substr($normalized, 0, 4);
        $suffix = substr($normalized, -4);

        return $prefix . ' *** ' . $suffix;
    }

    public function isMostlyDigits(string $query): bool
    {
        $stripped = preg_replace('/\s+/', '', $query) ?? '';
        if ($stripped === '') {
            return false;
        }

        $digitCount = strlen(preg_replace('/\D/', '', $stripped) ?? '');

        return ($digitCount / max(strlen($stripped), 1)) >= 0.7;
    }
}

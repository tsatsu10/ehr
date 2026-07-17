<?php

/**
 * Display normalizer for stock apptstat titles
 *
 * Stock OpenEMR seeds the apptstat list with the status code embedded in the
 * title ("- None", "@ Arrived", "~ Arrived late") because the legacy calendar
 * renders the raw title as its one-character glyph legend. The New Clinic UI
 * shows the label in a Badge, where the leading symbol reads as a typo.
 *
 * clean() strips the code prefix ONLY when the code is pure symbols — alpha
 * codes must keep their prefix ("AVM Confirmed" / "SMS Confirmed" / "EMAIL
 * Confimed" would otherwise collapse into three indistinguishable labels).
 * Clinics that already renamed their titles are untouched (no prefix match,
 * no strip).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Support;

final class ApptStatusLabel
{
    public static function clean(string $code, string $title): string
    {
        $title = trim($title);
        if (
            $code !== ''
            && str_starts_with($title, $code . ' ')
            && preg_match('/^[^\p{L}\p{N}]+$/u', $code) === 1
        ) {
            $stripped = trim(substr($title, strlen($code)));
            if ($stripped !== '') {
                return $stripped;
            }
        }

        return $title !== '' ? $title : $code;
    }
}

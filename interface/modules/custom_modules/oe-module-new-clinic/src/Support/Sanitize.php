<?php

/**
 * Shared input sanitizers for the AJAX boundary (SCALE-4.1)
 *
 * Small, dependency-free helpers the handlers and search services use so the
 * same devil-proofing rules apply on every path:
 *
 *  - searchToken(): free-text search input that will feed a LIKE scan. All
 *    module LIKEs are parameterized (no injection), so the risk is COST — a
 *    10 KB needle makes every row comparison expensive. Length-capped and
 *    control-characters stripped; deliberately does NOT escape %/_ metachars
 *    (that would change matching semantics; PharmCatalogAdminService escapes
 *    locally where literal matching is required).
 *
 *  - dayOrDefault()/dayOrNull(): calendar-day params (visit_date, date_from…).
 *    Empty/missing → the caller's default; malformed non-empty input → throws
 *    InvalidArgumentException, which AjaxController maps to a clean 400
 *    validation envelope. Rejecting beats silently substituting "today": a
 *    report for a mistyped day must not quietly show a different day's data.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Support;

final class Sanitize
{
    /** Longest useful search needle — names, phones, MRNs, codes all fit. */
    public const SEARCH_TOKEN_MAX = 64;

    public static function searchToken(?string $s, int $maxLen = self::SEARCH_TOKEN_MAX): string
    {
        $s = trim((string) $s);
        if ($s === '') {
            return '';
        }
        $s = (string) preg_replace('/[\x00-\x1F\x7F]/', '', $s);

        return trim(mb_substr($s, 0, max(1, $maxLen)));
    }

    /**
     * Validate a Y-m-d day param. Empty/missing → $default; malformed → 400
     * (via InvalidArgumentException). The format check is strict — createFrom-
     * Format alone accepts overflow like 2026-02-31 (rolls to March), so the
     * round-trip comparison rejects those too.
     */
    public static function dayOrDefault(mixed $s, string $default): string
    {
        $s = trim((string) ($s ?? ''));
        if ($s === '') {
            return $default;
        }

        $parsed = \DateTimeImmutable::createFromFormat('Y-m-d', $s);
        if ($parsed === false || $parsed->format('Y-m-d') !== $s) {
            throw new \InvalidArgumentException('Invalid date (expected YYYY-MM-DD)');
        }

        return $s;
    }

    /** Like dayOrDefault(), for nullable day params (range filters). */
    public static function dayOrNull(mixed $s): ?string
    {
        $s = trim((string) ($s ?? ''));

        return $s === '' ? null : self::dayOrDefault($s, '');
    }
}

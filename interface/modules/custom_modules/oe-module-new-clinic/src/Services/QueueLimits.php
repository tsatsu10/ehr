<?php

/**
 * Shared row caps for desk queues and the visit board (SCALE-1.2).
 *
 * Rule R1 (no unbounded queries): every queue/board list SELECT is capped. These
 * are safety ceilings, not pagination — a single cash-clinic facility never has
 * this many *active* visits at once, so a normal day is unaffected. When a cap is
 * hit the payload flags `..._truncated = true` and the desk shows a "refine filters"
 * banner instead of silently dropping rows.
 *
 * Implementation note: callers fetch `cap + 1` rows and slice to `cap` (see
 * applyCap). That detects truncation without a second COUNT(*) query — cheaper than
 * the plan's COUNT approach and needs no WHERE-clause duplication.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class QueueLimits
{
    /** Flat desk queues (triage/doctor/cashier/lab/pharmacy) + the board's combined active fetch. */
    public const QUEUE_HARD_CAP = 200;

    /** Single-state board lanes (cancelled, left-unpaid). */
    public const BOARD_LANE_CAP = 100;

    /** SQL fragment to append AFTER the ORDER BY: fetch one more than the cap to detect truncation. */
    public static function limitClause(int $cap): string
    {
        return ' LIMIT ' . ($cap + 1);
    }

    /**
     * Given rows fetched with limitClause($cap), return the capped slice and whether
     * it was truncated (i.e. more rows existed than the cap).
     *
     * @param array<int, array<string, mixed>> $rows
     * @return array{0: array<int, array<string, mixed>>, 1: bool} [rows, truncated]
     */
    public static function applyCap(array $rows, int $cap): array
    {
        if (count($rows) > $cap) {
            return [array_slice($rows, 0, $cap), true];
        }

        return [$rows, false];
    }
}

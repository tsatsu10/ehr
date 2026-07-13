<?php

/**
 * Delta-poll revision token for queue/board payloads (SCALE-1.8).
 *
 * A short hash of the payload's *stable* content — volatile fields (timestamps)
 * are excluded so an unchanged clinic hashes identically across polls, while any
 * real change (a visit moving, a badge appearing, a count changing) changes the
 * hash. The hash is taken over the FULLY-BUILT payload, so it is always correct by
 * construction (unlike a cheap pre-query token, which would miss changes in the
 * many badge tables the payload draws from — lab results, prescriptions,
 * queue-bridge, etc.).
 *
 * Trade-off (documented in the payload contract): this saves network bandwidth
 * (an unchanged poll returns ~a token instead of the whole board) and the client
 * re-render (islands skip setState), NOT the server-side query work — that is
 * bounded separately by SCALE-1.2 (caps), 1.4 (config cache) and 1.5 (batching).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class QueueRevision
{
    /** Top-level fields excluded from the hash — they change every poll regardless of data. */
    private const VOLATILE_KEYS = ['last_updated', 'checked_at', 'revision', 'unchanged'];

    /**
     * Per-card fields DERIVED from the current time (server-computed elapsed wait).
     * They tick up every minute with no real change, so they must NOT affect the
     * revision or the delta poll would barely fire for a non-empty queue. Safe to
     * drop because the client now computes the live wait itself from the STABLE
     * `started_at_epoch` (which stays in the hash) — see WaitTimeSpan / useMinuteTick.
     * They live per-card, so they are stripped recursively.
     */
    private const DERIVED_TIME_FIELDS = ['wait_minutes', 'wait_label'];

    /**
     * Stable-content hash of a queue/board payload.
     *
     * @param array<string, mixed> $payload
     */
    public static function of(array $payload): string
    {
        foreach (self::VOLATILE_KEYS as $key) {
            unset($payload[$key]);
        }

        $json = json_encode(self::stripDerived($payload), JSON_INVALID_UTF8_SUBSTITUTE);
        if ($json === false) {
            // Un-encodable payload → never risk a false "unchanged" (a frozen queue).
            // Return a unique token so the client always gets the full payload.
            return 'x' . bin2hex(random_bytes(7));
        }

        return substr(md5($json), 0, 16);
    }

    /**
     * Recursively drop DERIVED_TIME_FIELDS wherever they appear (they live per-card).
     */
    private static function stripDerived(mixed $node): mixed
    {
        if (!is_array($node)) {
            return $node;
        }
        $out = [];
        foreach ($node as $key => $value) {
            if (in_array($key, self::DERIVED_TIME_FIELDS, true)) {
                continue;
            }
            $out[$key] = is_array($value) ? self::stripDerived($value) : $value;
        }

        return $out;
    }
}

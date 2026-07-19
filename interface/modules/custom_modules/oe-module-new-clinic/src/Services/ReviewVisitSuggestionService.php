<?php

/**
 * REV-2 — "book as Review?" suggestion for returning patients.
 *
 * A clinic-configurable policy: patients returning about the same complaint
 * within the review window pay the clinic's chosen review price. Software
 * cannot judge "same complaint", so this service only ANSWERS "was this
 * patient seen recently, and is there an active Review visit type here?" —
 * the front desk confirms or ignores. Consumed by the front-desk preview
 * payload; no ajax action of its own, nothing on a poll timer.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ReviewVisitSuggestionService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    /**
     * @return array{days_ago: int, last_visit_date: string, review_visit_type_id: int}|null
     */
    public function suggestFor(int $pid, int $facilityId): ?array
    {
        if ($pid <= 0) {
            return null;
        }
        if ((string) ($this->config->get('enable_review_visits', '0', $facilityId) ?? '0') !== '1') {
            return null;
        }
        $windowDays = $this->config->getInt('review_window_days', 14, $facilityId);
        if ($windowDays <= 0) {
            return null;
        }

        // One indexed lookup (new_idx_fe_pid_date) — same shape the search
        // service already uses for its last_visit_date column. Facility-scoped
        // per spec (REV-6 / A3): the pid equality still drives the (pid, date)
        // index seek, facility_id is filtered on the (few) matching rows.
        //
        // Deliberately NOT reusing PatientContextService's own last_visit MAX
        // (same query shape, computed a few lines earlier in the same request)
        // because that one is cross-facility — passing it through here would
        // silently reintroduce the cross-facility bug this fix closes.
        $row = QueryUtils::querySingleRow(
            "SELECT MAX(fe.date) AS last_visit_date FROM form_encounter fe WHERE fe.pid = ? AND fe.facility_id = ?",
            [$pid, $facilityId]
        );
        $lastVisitDate = is_array($row) ? (string) ($row['last_visit_date'] ?? '') : '';

        $daysAgo = self::daysSince($lastVisitDate, new \DateTimeImmutable('today'));
        if (!self::withinWindow($daysAgo, $windowDays)) {
            return null;
        }

        $reviewType = QueryUtils::querySingleRow(
            "SELECT id FROM new_visit_type
             WHERE is_review = 1 AND is_active = 1 AND (facility_id = 0 OR facility_id = ?)
             ORDER BY facility_id DESC
             LIMIT 1",
            [$facilityId]
        );
        $reviewTypeId = is_array($reviewType) ? (int) ($reviewType['id'] ?? 0) : 0;
        if ($reviewTypeId <= 0) {
            return null;
        }

        return [
            'days_ago' => (int) $daysAgo,
            'last_visit_date' => substr($lastVisitDate, 0, 10),
            'review_visit_type_id' => $reviewTypeId,
        ];
    }

    /** Whole days between the last visit and today; null for missing/garbage/future dates. */
    public static function daysSince(?string $lastVisitDate, \DateTimeImmutable $today): ?int
    {
        $raw = trim((string) $lastVisitDate);
        if ($raw === '' || str_starts_with($raw, '0000-00-00')) {
            return null;
        }
        try {
            $then = new \DateTimeImmutable(substr($raw, 0, 10));
        } catch (\Exception) {
            return null;
        }
        if ($then > $today) {
            return null;
        }

        return (int) $today->diff($then)->format('%a');
    }

    public static function withinWindow(?int $daysAgo, int $windowDays): bool
    {
        return $daysAgo !== null && $windowDays > 0 && $daysAgo <= $windowDays;
    }
}

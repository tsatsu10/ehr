<?php

/**
 * V1.1-RTb — Advisory routing (routing_suggested_provider_id)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class VisitRoutingService
{
    private const TIE_BREAK_BONUS = 0.25;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
        private readonly DoctorRosterService $rosterService = new DoctorRosterService(),
    ) {
    }

    public function isEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_advisory_routing', 0, $facilityId) === 1
            && $this->rosterService->isEnabled($facilityId);
    }

    /**
     * Recompute suggestions for every visit in ready_for_doctor at a facility.
     */
    public function recomputeFacility(int $facilityId, string $visitDate, string $reason): void
    {
        if ($facilityId <= 0 || !$this->isEnabled($facilityId)) {
            return;
        }

        $candidates = $this->listTakingDoctorIds($facilityId);
        if ($candidates === []) {
            $this->clearSuggestionsForFacility($facilityId, $visitDate);

            return;
        }

        $visits = $this->fetchReadyVisits($facilityId, $visitDate);
        if ($visits === []) {
            return;
        }

        $baseLoads = $this->computeBaseLoadScores($facilityId, $visitDate, $candidates);
        $mutableLoads = $baseLoads;

        foreach ($visits as $visit) {
            $visitId = (int) ($visit['id'] ?? 0);
            if ($visitId <= 0) {
                continue;
            }

            if ((int) ($visit['hard_assigned_provider_id'] ?? 0) > 0) {
                $this->applySuggestion($visitId, null, $reason, null, (int) ($visit['routing_suggested_provider_id'] ?? 0));
                continue;
            }

            $providerId = $this->pickDoctorForVisit(
                $visit,
                $candidates,
                $mutableLoads,
                $facilityId,
                $visitDate
            );

            $this->applySuggestion(
                $visitId,
                $providerId,
                $reason,
                $mutableLoads,
                (int) ($visit['routing_suggested_provider_id'] ?? 0)
            );

            if ($providerId !== null) {
                $mutableLoads[$providerId] = ($mutableLoads[$providerId] ?? 0.0)
                    + $this->waitingAssignedWeight($facilityId);
            }
        }
    }

    /**
     * Manual suggestion change while visit is ready_for_doctor (reception lead / admin).
     *
     * @return array<string, mixed>
     */
    public function reassignSuggestion(
        int $visitId,
        ?int $providerId,
        int $actorUserId,
        ?string $note = null
    ): array {
        if (!AclMain::aclCheckCore('new_clinic', 'new_admin')
            && !AclMain::aclCheckCore('new_clinic', 'new_reception')) {
            throw new \RuntimeException('Not authorized to reassign routing suggestion', 403);
        }

        $visit = QueryUtils::querySingleRow('SELECT * FROM new_visit WHERE id = ?', [$visitId]);
        if (!is_array($visit) || empty($visit['id'])) {
            throw new \InvalidArgumentException('Visit not found');
        }

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        if (!$this->isEnabled($facilityId)) {
            throw new \RuntimeException('Advisory routing is not enabled', 403);
        }

        if ((string) ($visit['state'] ?? '') !== 'ready_for_doctor') {
            throw new \InvalidArgumentException('Visit must be ready for doctor');
        }

        if ($providerId !== null && $providerId > 0 && !in_array($providerId, $this->listTakingDoctorIds($facilityId), true)) {
            throw new \InvalidArgumentException('Provider is not on duty or not taking patients');
        }

        $fromProviderId = (int) ($visit['routing_suggested_provider_id'] ?? 0);
        $targetProviderId = $providerId !== null && $providerId > 0 ? $providerId : null;

        QueryUtils::sqlStatementThrowException(
            'UPDATE new_visit SET routing_suggested_provider_id = ?, updated_at = NOW() WHERE id = ?',
            [$targetProviderId, $visitId]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_visit',
            $_SESSION['authUser'] ?? '',
            $_SESSION['authProvider'] ?? '',
            1,
            'routing_suggested visit_id=' . $visitId
            . ' from=' . ($fromProviderId > 0 ? $fromProviderId : 'null')
            . ' to=' . ($targetProviderId ?? 'null')
            . ' reason=manual_reassign'
            . ($note !== null && trim($note) !== '' ? ' note=' . mb_substr(trim($note), 0, 120) : '')
        );

        return QueryUtils::querySingleRow('SELECT * FROM new_visit WHERE id = ?', [$visitId]) ?? [];
    }

    /**
     * @param array<int, int> $candidateIds
     * @param array<int, float> $loadScores
     * @param array<int, float> $tieBreakBonuses user_id => bonus (subtracted from score)
     */
    public static function selectLowestLoadDoctor(
        array $candidateIds,
        array $loadScores,
        array $tieBreakBonuses = []
    ): ?int {
        $bestId = null;
        $bestScore = null;

        foreach ($candidateIds as $doctorId) {
            if ($doctorId <= 0) {
                continue;
            }

            $score = (float) ($loadScores[$doctorId] ?? 0.0) - (float) ($tieBreakBonuses[$doctorId] ?? 0.0);

            if ($bestScore === null || $score < $bestScore || ($score === $bestScore && $doctorId < (int) $bestId)) {
                $bestScore = $score;
                $bestId = $doctorId;
            }
        }

        return $bestId;
    }

    /**
     * @param array<string, mixed> $visit
     * @param array<int, int> $candidates
     * @param array<int, float> $loadScores
     */
    private function pickDoctorForVisit(
        array $visit,
        array $candidates,
        array $loadScores,
        int $facilityId,
        string $visitDate
    ): ?int {
        $pid = (int) ($visit['pid'] ?? 0);
        $assignedHint = (int) ($visit['assigned_provider_id'] ?? 0);
        $continuityId = $this->continuityProviderId($pid, $facilityId, $visitDate);
        $bonuses = [];

        foreach ($candidates as $doctorId) {
            $bonus = 0.0;
            if ($continuityId > 0 && $continuityId === $doctorId) {
                $bonus += self::TIE_BREAK_BONUS;
            }
            if ($assignedHint > 0 && $assignedHint === $doctorId) {
                $bonus += self::TIE_BREAK_BONUS;
            }
            if ($bonus > 0) {
                $bonuses[$doctorId] = $bonus;
            }
        }

        return self::selectLowestLoadDoctor($candidates, $loadScores, $bonuses);
    }

    /**
     * @param array<int, int> $candidates
     * @return array<int, float>
     */
    private function computeBaseLoadScores(int $facilityId, string $visitDate, array $candidates): array
    {
        $activeCounts = $this->countVisitsByProvider($facilityId, $visitDate, 'with_doctor');
        $waitingAssigned = $this->countVisitsByProvider($facilityId, $visitDate, 'ready_for_doctor', true);
        $unassignedPool = $this->countUnassignedReady($facilityId, $visitDate);

        $wActive = $this->activeWeight($facilityId);
        $wAssigned = $this->waitingAssignedWeight($facilityId);
        $wUnassigned = $this->unassignedPoolWeight($facilityId);

        $scores = [];
        foreach ($candidates as $doctorId) {
            $active = (int) ($activeCounts[$doctorId] ?? 0);
            $waiting = (int) ($waitingAssigned[$doctorId] ?? 0);
            $score = ($wActive * $active) + ($wAssigned * $waiting) + ($wUnassigned * $unassignedPool);
            $score -= $this->fairnessBonus($doctorId, $facilityId, $visitDate);
            $scores[$doctorId] = round($score, 4);
        }

        return $scores;
    }

    private function fairnessBonus(int $doctorId, int $facilityId, string $visitDate): float
    {
        $minutesPerPoint = max(1, $this->config->getInt('routing_fairness_minutes_per_point', 15, $facilityId));
        $minutes = $this->minutesSinceLastTake($doctorId, $facilityId, $visitDate);

        return $minutes / $minutesPerPoint;
    }

    private function minutesSinceLastTake(int $doctorId, int $facilityId, string $visitDate): int
    {
        try {
            $row = QueryUtils::querySingleRow(
                "SELECT TIMESTAMPDIFF(MINUTE, MAX(vsl.created_at), NOW()) AS mins
                 FROM new_visit_state_log vsl
                 INNER JOIN new_visit v ON v.id = vsl.visit_id
                 WHERE v.facility_id = ?
                   AND v.visit_date = ?
                   AND vsl.to_state = 'with_doctor'
                   AND vsl.actor_user_id = ?",
                [$facilityId, $visitDate, $doctorId]
            );
        } catch (\Throwable) {
            return 0;
        }

        return is_array($row) ? max(0, (int) ($row['mins'] ?? 0)) : 0;
    }

    private function continuityProviderId(int $pid, int $facilityId, string $visitDate): int
    {
        if ($pid <= 0) {
            return 0;
        }

        $lookbackDays = max(1, $this->config->getInt('routing_continuity_days', 90, $facilityId));
        $cutoff = date('Y-m-d', strtotime($visitDate . ' -' . $lookbackDays . ' days'));

        try {
            $row = QueryUtils::querySingleRow(
                "SELECT assigned_provider_id
                 FROM new_visit
                 WHERE pid = ?
                   AND facility_id = ?
                   AND state = 'completed'
                   AND visit_date >= ?
                   AND assigned_provider_id IS NOT NULL
                   AND assigned_provider_id > 0
                 ORDER BY visit_date DESC, id DESC
                 LIMIT 1",
                [$pid, $facilityId, $cutoff]
            );
        } catch (\Throwable) {
            return 0;
        }

        return is_array($row) ? (int) ($row['assigned_provider_id'] ?? 0) : 0;
    }

    /**
     * @return array<int, int>
     */
    private function listTakingDoctorIds(int $facilityId): array
    {
        $visitDate = $this->clinicDate->today();
        $rows = $this->rosterService->listDoctors($facilityId, $visitDate);
        $ids = [];
        foreach ($rows as $row) {
            if (!empty($row['taking_patients']) && (int) ($row['user_id'] ?? 0) > 0) {
                $ids[] = (int) $row['user_id'];
            }
        }

        sort($ids);

        return $ids;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchReadyVisits(int $facilityId, string $visitDate): array
    {
        try {
            $rows = QueryUtils::fetchRecords(
                "SELECT id, pid, assigned_provider_id, hard_assigned_provider_id,
                        routing_suggested_provider_id, is_urgent, queue_number
                 FROM new_visit
                 WHERE facility_id = ?
                   AND visit_date = ?
                   AND state = 'ready_for_doctor'
                 ORDER BY is_urgent DESC, queue_number ASC, started_at ASC",
                [$facilityId, $visitDate]
            ) ?: [];
        } catch (\Throwable) {
            return [];
        }

        return $rows;
    }

    /**
     * @return array<int, int>
     */
    private function countVisitsByProvider(
        int $facilityId,
        string $visitDate,
        string $state,
        bool $assignedOnly = false
    ): array {
        $sql = "SELECT assigned_provider_id AS provider_id, COUNT(*) AS cnt
                FROM new_visit
                WHERE facility_id = ?
                  AND visit_date = ?
                  AND state = ?";
        $bind = [$facilityId, $visitDate, $state];

        if ($assignedOnly) {
            $sql .= ' AND assigned_provider_id IS NOT NULL AND assigned_provider_id > 0';
        }

        $sql .= ' GROUP BY assigned_provider_id';

        try {
            $rows = QueryUtils::fetchRecords($sql, $bind) ?: [];
        } catch (\Throwable) {
            return [];
        }

        $map = [];
        foreach ($rows as $row) {
            $providerId = (int) ($row['provider_id'] ?? 0);
            if ($providerId > 0) {
                $map[$providerId] = (int) ($row['cnt'] ?? 0);
            }
        }

        return $map;
    }

    private function countUnassignedReady(int $facilityId, string $visitDate): int
    {
        try {
            $row = QueryUtils::querySingleRow(
                "SELECT COUNT(*) AS cnt
                 FROM new_visit
                 WHERE facility_id = ?
                   AND visit_date = ?
                   AND state = 'ready_for_doctor'
                   AND (assigned_provider_id IS NULL OR assigned_provider_id = 0)",
                [$facilityId, $visitDate]
            );
        } catch (\Throwable) {
            return 0;
        }

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    private function clearSuggestionsForFacility(int $facilityId, string $visitDate): void
    {
        try {
            QueryUtils::sqlStatementThrowException(
                "UPDATE new_visit
                 SET routing_suggested_provider_id = NULL, updated_at = NOW()
                 WHERE facility_id = ?
                   AND visit_date = ?
                   AND state = 'ready_for_doctor'
                   AND routing_suggested_provider_id IS NOT NULL",
                [$facilityId, $visitDate]
            );
        } catch (\Throwable) {
            // non-fatal
        }
    }

    /**
     * @param array<int, float>|null $loadSnapshot
     */
    private function applySuggestion(
        int $visitId,
        ?int $providerId,
        string $reason,
        ?array $loadSnapshot,
        int $previousProviderId
    ): void {
        $next = $providerId !== null && $providerId > 0 ? $providerId : null;
        if ($previousProviderId === (int) ($next ?? 0)) {
            return;
        }

        QueryUtils::sqlStatementThrowException(
            'UPDATE new_visit SET routing_suggested_provider_id = ?, updated_at = NOW() WHERE id = ?',
            [$next, $visitId]
        );

        $payload = 'routing_suggested visit_id=' . $visitId
            . ' from=' . ($previousProviderId > 0 ? $previousProviderId : 'null')
            . ' to=' . ($next ?? 'null')
            . ' reason=' . $reason;

        if ($loadSnapshot !== null) {
            $payload .= ' load_snapshot=' . json_encode($loadSnapshot);
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_visit',
            $_SESSION['authUser'] ?? '',
            $_SESSION['authProvider'] ?? '',
            1,
            $payload
        );
    }

    private function activeWeight(int $facilityId): float
    {
        return (float) $this->config->get('routing_weight_active', '2.0', $facilityId);
    }

    private function waitingAssignedWeight(int $facilityId): float
    {
        return (float) $this->config->get('routing_weight_waiting_assigned', '1.0', $facilityId);
    }

    private function unassignedPoolWeight(int $facilityId): float
    {
        return (float) $this->config->get('routing_weight_waiting_unassigned', '0.5', $facilityId);
    }
}

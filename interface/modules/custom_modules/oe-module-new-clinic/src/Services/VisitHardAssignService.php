<?php

/**
 * V1.2 optional hard provider assignment (PRD §6.5.3)
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
use OpenEMR\Modules\NewClinic\Exceptions\VisitNotTakeableException;

class VisitHardAssignService
{
    /** @var list<string> */
    public const ASSIGNABLE_STATES = ['waiting', 'in_triage', 'ready_for_doctor'];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly DoctorRosterService $roster = new DoctorRosterService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
    ) {
    }

    public function isEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_hard_provider_assignment', 0, $facilityId) === 1;
    }

    public function canAssign(int $actorUserId): bool
    {
        return AclMain::aclCheckCore('new_clinic', 'new_hard_assign_provider')
            || AclMain::aclCheckCore('new_clinic', 'new_admin');
    }

    public function canOverrideTake(int $actorUserId): bool
    {
        return AclMain::aclCheckCore('new_clinic', 'new_take_assigned_override')
            || AclMain::aclCheckCore('new_clinic', 'new_admin');
    }

    /**
     * @return list<array{user_id: int, display_name: string, taking_patients: bool}>
     */
    public function listAssignableDoctors(int $facilityId, ?string $visitDate = null): array
    {
        if (!$this->isEnabled($facilityId)) {
            return [];
        }

        $visitDate = $visitDate ?? $this->clinicDate->today();
        $doctors = [];
        foreach ($this->roster->listDoctors($facilityId, $visitDate) as $row) {
            $userId = (int) ($row['user_id'] ?? 0);
            if ($userId <= 0) {
                continue;
            }
            $doctors[] = [
                'user_id' => $userId,
                'display_name' => (string) ($row['display_name'] ?? ''),
                'taking_patients' => !empty($row['taking_patients']),
            ];
        }

        return $doctors;
    }

    /**
     * @param array<string, mixed> $visit
     */
    public function assertCanTake(array $visit, int $actorUserId, ?string $overrideReason = null): void
    {
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        if (!$this->isEnabled($facilityId)) {
            return;
        }

        $hardAssigned = (int) ($visit['hard_assigned_provider_id'] ?? 0);
        if ($hardAssigned <= 0 || $hardAssigned === $actorUserId) {
            return;
        }

        if ($this->canOverrideTake($actorUserId)) {
            $reason = trim((string) $overrideReason);
            if ($reason === '') {
                throw new VisitNotTakeableException(
                    'Visit is hard-assigned to another doctor',
                    [
                        'code' => 'assigned_provider_mismatch',
                        'hard_assigned_provider_id' => $hardAssigned,
                        'requires_override_reason' => true,
                    ]
                );
            }

            return;
        }

        throw new VisitNotTakeableException(
            'Visit is hard-assigned to another doctor',
            [
                'code' => 'assigned_provider_mismatch',
                'hard_assigned_provider_id' => $hardAssigned,
            ]
        );
    }

    public function applyHardAssignOnReady(
        int $visitId,
        int $facilityId,
        ?int $providerId,
        int $actorUserId
    ): void {
        if (!$this->isEnabled($facilityId)) {
            return;
        }

        if ($providerId !== null && $providerId > 0 && !$this->canAssign($actorUserId)) {
            throw new \InvalidArgumentException('Hard assign provider not permitted');
        }

        if ($providerId === null || $providerId <= 0) {
            return;
        }

        if (!$this->isValidDoctor($facilityId, $providerId)) {
            throw new \InvalidArgumentException('Invalid doctor for hard assignment');
        }

        sqlStatement(
            "UPDATE new_visit
             SET hard_assigned_provider_id = ?, routing_suggested_provider_id = NULL,
                 row_version = row_version + 1, updated_at = NOW()
             WHERE id = ? AND facility_id = ?",
            [$providerId, $visitId, $facilityId]
        );

        $pid = (int) (QueryUtils::querySingleRow(
            'SELECT pid FROM new_visit WHERE id = ?',
            [$visitId]
        )['pid'] ?? 0);

        EventAuditLogger::getInstance()->newEvent(
            'new_visit',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            'hard_assigned',
            'pid=' . $pid . ';visit_id=' . $visitId . ';' . json_encode([
                'hard_assigned_provider_id' => $providerId,
                'actor' => $actorUserId,
            ]),
            $pid
        );
    }

    public function isAssignableState(string $state): bool
    {
        return in_array($state, self::ASSIGNABLE_STATES, true);
    }

    /**
     * M0-F19 — set/clear hard_assigned_provider_id on an active visit (§6.5.3).
     *
     * @return array<string, mixed>
     */
    public function hardAssignProvider(
        int $visitId,
        int $facilityId,
        ?int $providerId,
        int $actorUserId,
        int $expectedVersion
    ): array {
        if (!$this->isEnabled($facilityId)) {
            throw new \RuntimeException('Hard provider assignment is not enabled', 403);
        }

        if (!$this->canAssign($actorUserId)) {
            throw new \RuntimeException('Hard assign provider not permitted', 403);
        }

        $visit = QueryUtils::querySingleRow(
            'SELECT * FROM new_visit WHERE id = ? AND facility_id = ?',
            [$visitId, $facilityId]
        );
        if (!is_array($visit) || empty($visit['id'])) {
            throw new \InvalidArgumentException('Visit not found');
        }

        $state = (string) ($visit['state'] ?? '');
        if (!$this->isAssignableState($state)) {
            throw new \InvalidArgumentException('Visit cannot be hard-assigned in its current state');
        }

        if ((int) ($visit['row_version'] ?? 0) !== $expectedVersion) {
            throw new \InvalidArgumentException('Visit was updated by another user');
        }

        $providerValue = ($providerId !== null && $providerId > 0) ? $providerId : null;
        if ($providerValue !== null && !$this->isValidDoctor($facilityId, $providerValue)) {
            throw new \InvalidArgumentException('Invalid doctor for hard assignment');
        }

        sqlStatement(
            "UPDATE new_visit
             SET hard_assigned_provider_id = ?, routing_suggested_provider_id = NULL,
                 row_version = row_version + 1, updated_at = NOW()
             WHERE id = ? AND row_version = ?",
            [$providerValue, $visitId, $expectedVersion]
        );

        if (generic_sql_affected_rows() < 1) {
            throw new \InvalidArgumentException('Visit was updated by another user');
        }

        $pid = (int) ($visit['pid'] ?? 0);
        EventAuditLogger::getInstance()->newEvent(
            'new_visit',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            'hard_assigned',
            'pid=' . $pid . ';visit_id=' . $visitId . ';' . json_encode([
                'hard_assigned_provider_id' => $providerValue,
                'actor' => $actorUserId,
                'reassign' => $state === 'ready_for_doctor',
            ]),
            $pid
        );

        $fresh = QueryUtils::querySingleRow('SELECT * FROM new_visit WHERE id = ?', [$visitId]) ?? [];
        if ($state === 'ready_for_doctor' && !empty($fresh)) {
            (new DoctorReadyNotifyService())->recordForReadyVisit($fresh);
        }

        return $fresh;
    }

    public function reassignWhileReady(
        int $visitId,
        int $facilityId,
        ?int $providerId,
        int $actorUserId,
        int $expectedVersion
    ): array {
        return $this->hardAssignProvider($visitId, $facilityId, $providerId, $actorUserId, $expectedVersion);
    }

    private function isValidDoctor(int $facilityId, int $providerId): bool
    {
        foreach ($this->listAssignableDoctors($facilityId) as $doctor) {
            if ((int) ($doctor['user_id'] ?? 0) === $providerId) {
                return true;
            }
        }

        return false;
    }
}

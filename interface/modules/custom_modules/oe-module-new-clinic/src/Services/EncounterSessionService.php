<?php

/**
 * OpenEMR session bind for visit-scoped clinical screens (M0-F22)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Dto\EncounterSessionDto;
use OpenEMR\Modules\NewClinic\Exceptions\EncounterSessionMismatchException;

class EncounterSessionService
{
    /** @var array<string, string> */
    private const STATE_DESK_ACL = [
        'waiting' => 'new_nurse',
        'in_triage' => 'new_nurse',
        'ready_for_doctor' => 'new_doctor',
        'with_doctor' => 'new_doctor',
        'ready_for_lab' => 'new_lab',
        'in_lab' => 'new_lab',
        'ready_for_pharmacy' => 'new_pharmacy',
        'in_pharmacy' => 'new_pharmacy',
        'ready_for_payment' => 'new_cashier',
    ];

    public function __construct(
        private readonly ?VisitQueueService $visitQueueService = null
    ) {
    }

    private function queue(): VisitQueueService
    {
        return $this->visitQueueService ?? new VisitQueueService();
    }

    public function bindForVisit(int $visitId, int $actorUserId): EncounterSessionDto
    {
        $visit = $this->queue()->getVisitForActor($visitId);

        $_SESSION['pid'] = (int) $visit['pid'];
        $_SESSION['encounter'] = (int) $visit['encounter'];
        $_SESSION['new_clinic_visit_id'] = $visitId;

        return new EncounterSessionDto(
            visitId: $visitId,
            pid: (int) $visit['pid'],
            encounter: (int) $visit['encounter'],
            state: (string) $visit['state'],
        );
    }

    /**
     * G12 session bind for encounters with no queue visit (historical / stock-created).
     * Off the queue FSM, so no per-state desk ACL applies — restricted to consult-capable
     * roles (doctor) and admins; facility scope is asserted on the patient.
     */
    public function bindForEncounter(int $encounterId, int $actorUserId): EncounterSessionDto
    {
        $enc = \OpenEMR\Common\Database\QueryUtils::querySingleRow(
            'SELECT encounter, pid FROM form_encounter WHERE encounter = ? LIMIT 1',
            [$encounterId]
        );
        $pid = (int) ($enc['pid'] ?? 0);
        if (!is_array($enc) || $pid <= 0) {
            throw new \RuntimeException('Encounter not found', 404);
        }

        (new FacilityScopeService())->assertPatientAccessible($pid);

        if (
            !AclMain::aclCheckCore('new_clinic', 'new_admin')
            && !AclMain::aclCheckCore('admin', 'super')
            && !AclMain::aclCheckCore('new_clinic', 'new_doctor')
        ) {
            throw new \RuntimeException('Forbidden', 403);
        }

        $_SESSION['pid'] = $pid;
        $_SESSION['encounter'] = $encounterId;
        $_SESSION['new_clinic_visit_id'] = 0;

        return new EncounterSessionDto(
            visitId: 0,
            pid: $pid,
            encounter: $encounterId,
            state: '',
        );
    }

    public function bindForVisitWithDeskAcl(int $visitId, int $actorUserId): EncounterSessionDto
    {
        $visit = $this->queue()->getVisitForActor($visitId);
        $this->assertActorMayBindSession($visit, $actorUserId);

        return $this->bindForVisit($visitId, $actorUserId);
    }

    public function assertBound(int $visitId): void
    {
        $boundVisitId = (int) ($_SESSION['new_clinic_visit_id'] ?? 0);
        if ($boundVisitId !== $visitId) {
            throw new EncounterSessionMismatchException('Session is not bound to visit ' . $visitId);
        }
    }

    public function restore(int $visitId, int $actorUserId): EncounterSessionDto
    {
        return $this->bindForVisitWithDeskAcl($visitId, $actorUserId);
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function assertActorMayBindSession(array $visit, int $actorUserId): void
    {
        if (AclMain::aclCheckCore('new_clinic', 'new_admin')
            || AclMain::aclCheckCore('admin', 'super')) {
            return;
        }

        $state = (string) ($visit['state'] ?? '');
        $requiredAcl = self::STATE_DESK_ACL[$state] ?? null;
        if ($requiredAcl === null) {
            throw new \RuntimeException('Session bind not allowed for visit state', 403);
        }

        if (!AclMain::aclCheckCore('new_clinic', $requiredAcl)) {
            throw new \RuntimeException('Forbidden', 403);
        }

        if (in_array($state, ['with_doctor', 'in_lab', 'in_pharmacy'], true)) {
            $assigned = (int) ($visit['assigned_provider_id'] ?? 0);
            if ($assigned > 0 && $assigned !== $actorUserId) {
                throw new \RuntimeException('Visit is assigned to another provider', 403);
            }
        }
    }
}

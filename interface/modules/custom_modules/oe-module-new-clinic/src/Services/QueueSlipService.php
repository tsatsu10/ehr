<?php

/**
 * Reception queue slip print payload (M5.4, M1d-F03)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class QueueSlipService
{
    public function __construct(
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function isPrintEnabled(int $facilityId): bool
    {
        return $this->config->getInt('print_queue_slip_on_start_visit', 1, $facilityId) === 1;
    }

    /**
     * @return array<string, mixed>
     */
    public function buildPrintPayload(int $visitId, int $actorUserId): array
    {
        $visit = $this->queueService->getVisitForActor($visitId);
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $pid = (int) ($visit['pid'] ?? 0);

        $patient = QueryUtils::querySingleRow(
            "SELECT fname, lname, pubpid FROM patient_data WHERE pid = ?",
            [$pid]
        ) ?: [];

        $visitType = QueryUtils::querySingleRow(
            "SELECT label FROM new_visit_type WHERE id = ?",
            [(int) ($visit['visit_type_id'] ?? 0)]
        ) ?: [];

        $facility = $facilityId > 0
            ? (QueryUtils::querySingleRow('SELECT name FROM facility WHERE id = ?', [$facilityId]) ?: [])
            : [];

        global $GLOBALS;
        $clinicName = (string) ($facility['name'] ?? $GLOBALS['openemr_name'] ?? 'Clinic');
        $instruction = trim((string) ($this->config->get(
            'queue_slip_instruction_text',
            'Please wait to be called',
            $facilityId
        ) ?? 'Please wait to be called'));

        if ($instruction === '') {
            $instruction = 'Please wait to be called';
        }

        $fname = trim((string) ($patient['fname'] ?? ''));
        $lname = trim((string) ($patient['lname'] ?? ''));
        $lastInitial = $lname !== '' ? mb_strtoupper(mb_substr($lname, 0, 1)) . '.' : '';
        $patientDisplay = trim($fname . ' ' . $lastInitial);

        $startedAt = (string) ($visit['started_at'] ?? date('Y-m-d H:i:s'));

        return [
            'visit_id' => $visitId,
            'clinic_name' => $clinicName,
            'queue_number' => (int) ($visit['queue_number'] ?? 0),
            'patient_display' => $patientDisplay,
            'patient_name' => $patientDisplay,
            'pubpid' => (string) ($patient['pubpid'] ?? ''),
            'visit_date' => (string) ($visit['visit_date'] ?? date('Y-m-d')),
            'started_at' => $startedAt,
            'started_time_display' => date('g:i A', strtotime($startedAt) ?: time()),
            'visit_type_label' => (string) ($visitType['label'] ?? ''),
            'instruction_text' => $instruction,
            'facility_id' => $facilityId,
            'actor_user_id' => $actorUserId,
        ];
    }

    public function resolveFacilityIdForActor(?int $requestedFacilityId = null): int
    {
        return $this->visitScope->resolveDeskFacilityId($requestedFacilityId);
    }
}

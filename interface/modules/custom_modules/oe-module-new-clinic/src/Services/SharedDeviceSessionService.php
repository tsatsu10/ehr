<?php

/**
 * Shared-device session mismatch probe for module desks (T1-F19)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class SharedDeviceSessionService
{
    public const COMPARE_CLINICAL = 'clinical';
    public const COMPARE_PID_ONLY = 'pid_only';

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function isEnabled(?int $facilityId = null): bool
    {
        $facilityId ??= $this->visitScope->resolveDeskFacilityId();

        return $this->config->getInt('enable_shared_device_session_warning', 0, $facilityId) === 1;
    }

    /**
     * @return array<string, mixed>
     */
    public function probe(int $visitId, string $compareMode, int $actorUserId): array
    {
        $compareMode = $this->normalizeCompareMode($compareMode);
        $facilityId = $this->visitScope->resolveDeskFacilityId();

        if (!$this->isEnabled($facilityId) || $visitId <= 0) {
            return [
                'enabled' => $this->isEnabled($facilityId),
                'mismatch' => false,
            ];
        }

        try {
            $visit = $this->queueService->getVisitForActor($visitId);
        } catch (\InvalidArgumentException) {
            return [
                'enabled' => true,
                'mismatch' => false,
                'visit_missing' => true,
            ];
        }

        $sessionPid = (int) ($_SESSION['pid'] ?? 0);
        $sessionEncounter = (int) ($_SESSION['encounter'] ?? 0);
        $visitPid = (int) ($visit['pid'] ?? 0);
        $visitEncounter = (int) ($visit['encounter'] ?? 0);

        $mismatch = $this->hasMismatch(
            $compareMode,
            $sessionPid,
            $sessionEncounter,
            $visitPid,
            $visitEncounter
        );

        $visitPatient = $this->loadPatientIdentity($visitPid);
        $sessionPatient = $sessionPid > 0 ? $this->loadPatientIdentity($sessionPid) : [
            'display_name' => '',
            'pubpid' => '',
        ];

        $visitDisplay = trim(($visit['fname'] ?? '') . ' ' . ($visit['lname'] ?? ''));
        if ($visitDisplay === '') {
            $visitDisplay = (string) ($visitPatient['display_name'] ?? '');
        }

        return [
            'enabled' => true,
            'mismatch' => $mismatch,
            'compare_mode' => $compareMode,
            'can_restore' => $compareMode === self::COMPARE_CLINICAL,
            'session' => [
                'pid' => $sessionPid,
                'encounter' => $sessionEncounter,
                'display_name' => (string) ($sessionPatient['display_name'] ?? ''),
                'pubpid' => (string) ($sessionPatient['pubpid'] ?? ''),
            ],
            'visit' => [
                'visit_id' => $visitId,
                'pid' => $visitPid,
                'encounter' => $visitEncounter,
                'queue_number' => (int) ($visit['queue_number'] ?? 0),
                'display_name' => $visitDisplay,
                'pubpid' => (string) ($visitPatient['pubpid'] ?? $visitPid),
            ],
        ];
    }

    private function normalizeCompareMode(string $compareMode): string
    {
        return $compareMode === self::COMPARE_PID_ONLY
            ? self::COMPARE_PID_ONLY
            : self::COMPARE_CLINICAL;
    }

    private function hasMismatch(
        string $compareMode,
        int $sessionPid,
        int $sessionEncounter,
        int $visitPid,
        int $visitEncounter
    ): bool {
        if ($visitPid <= 0) {
            return false;
        }

        if ($compareMode === self::COMPARE_PID_ONLY) {
            return $sessionPid > 0 && $sessionPid !== $visitPid;
        }

        if ($sessionPid !== $visitPid) {
            return true;
        }

        return $visitEncounter > 0 && $sessionEncounter !== $visitEncounter;
    }

    /**
     * @return array{display_name: string, pubpid: string}
     */
    private function loadPatientIdentity(int $pid): array
    {
        if ($pid <= 0) {
            return ['display_name' => '', 'pubpid' => ''];
        }

        $row = QueryUtils::querySingleRow(
            'SELECT fname, lname, pubpid FROM patient_data WHERE pid = ?',
            [$pid]
        );

        if (empty($row)) {
            return ['display_name' => '', 'pubpid' => (string) $pid];
        }

        $displayName = trim((string) ($row['fname'] ?? '') . ' ' . (string) ($row['lname'] ?? ''));

        return [
            'display_name' => $displayName,
            'pubpid' => (string) ($row['pubpid'] ?? $pid),
        ];
    }
}

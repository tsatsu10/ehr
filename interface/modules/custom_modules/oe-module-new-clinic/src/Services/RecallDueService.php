<?php

/**
 * Recall due chip for Front Desk search/preview (PRD §6.7.3 / S-P5)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class RecallDueService
{
    /** @var list<string> */
    private const TERMINAL_STATUSES = ['completed', 'declined', 'unreachable'];

    public function __construct(
        private readonly ScheduledIntegrationService $scheduledIntegration = new ScheduledIntegrationService(),
        private readonly SchedulingAccessService $schedulingAccess = new SchedulingAccessService(),
        private readonly SchedulingShellService $shell = new SchedulingShellService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
    ) {
    }

    /**
     * @return array<string, mixed>|null
     */
    public function chipForPatient(int $pid, ?int $facilityId = null): ?array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId);
        if (!$this->scheduledIntegration->isEnabled($facilityId)) {
            return null;
        }
        if (!$this->schedulingAccess->isHubEnabled($facilityId)) {
            return null;
        }

        $row = $this->findDueRecall($pid, $facilityId);
        if ($row === null) {
            return null;
        }

        $today = $this->clinicDate->today();
        $dueDate = (string) ($row['r_eventDate'] ?? '');
        $daysDelta = $this->daysFromToday($dueDate, $today);
        $urls = $this->shell->resolveIntegrationUrls($facilityId);
        $worklistUrl = $urls['recalls_url'] . '&pid=' . urlencode((string) $pid);

        return [
            'recall_id' => (int) ($row['r_ID'] ?? 0),
            'due_date' => $dueDate,
            'days_delta' => $daysDelta,
            'reason' => (string) ($row['r_reason'] ?? ''),
            'status' => (string) ($row['recall_status'] ?? 'open'),
            'worklist_url' => $worklistUrl,
            'label' => $daysDelta < 0
                ? sprintf('%dd overdue', abs($daysDelta))
                : ($daysDelta === 0 ? 'Due today' : 'Recall due'),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findDueRecall(int $pid, int $facilityId): ?array
    {
        $bind = [$pid, $this->clinicDate->today()];
        $sql = "SELECT mr.r_ID, mr.r_eventDate, mr.r_reason, mr.r_facility,
                       COALESCE(meta.status, 'open') AS recall_status
                FROM medex_recalls AS mr
                INNER JOIN patient_data AS pat ON pat.pid = mr.r_pid
                LEFT JOIN new_clinic_recall_meta AS meta ON meta.recall_id = mr.r_ID
                WHERE mr.r_pid = ?
                  AND IFNULL(pat.deceased_date, 0) = 0
                  AND mr.r_eventDate <= ?
                  AND COALESCE(meta.status, 'open') NOT IN ('completed', 'declined', 'unreachable')";

        if ($facilityId > 0) {
            $sql .= ' AND (mr.r_facility = ? OR mr.r_facility = 0)';
            $bind[] = $facilityId;
        }

        $sql .= ' ORDER BY mr.r_eventDate ASC LIMIT 1';

        $row = QueryUtils::querySingleRow($sql, $bind);

        return empty($row['r_ID']) ? null : $row;
    }

    private function daysFromToday(string $dueDate, string $today): int
    {
        $dueTs = strtotime($dueDate);
        $todayTs = strtotime($today);
        if ($dueTs === false || $todayTs === false) {
            return 0;
        }

        return (int) round(($dueTs - $todayTs) / 86400);
    }
}

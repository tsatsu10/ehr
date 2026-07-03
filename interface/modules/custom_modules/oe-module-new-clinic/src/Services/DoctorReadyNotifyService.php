<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class DoctorReadyNotifyService
{
    public const CHANNEL_IN_APP = 'in_app';

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly DoctorRosterService $roster = new DoctorRosterService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
    ) {
    }

    public function isEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_doctor_ready_notify', 0, $facilityId) === 1;
    }

    /**
     * @param array<string, mixed> $visit
     */
    public function recordForReadyVisit(array $visit): void
    {
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        if (!$this->isEnabled($facilityId)) {
            return;
        }

        $visitId = (int) ($visit['id'] ?? 0);
        if ($visitId <= 0 || (string) ($visit['state'] ?? '') !== 'ready_for_doctor') {
            return;
        }

        $pid = (int) ($visit['pid'] ?? 0);
        $visitDate = (string) ($visit['visit_date'] ?? $this->clinicDate->today());
        foreach ($this->resolveRecipients($visit, $facilityId, $visitDate) as $recipientId) {
            $this->insertNotifyRow($visitId, $recipientId, $pid);
        }
    }

    /**
     * @return list<array{visit_id: int, queue_number: string|int, display_name: string}>
     */
    public function listPendingForDoctor(int $doctorUserId, int $facilityId): array
    {
        if (!$this->isEnabled($facilityId) || $doctorUserId <= 0) {
            return [];
        }

        $visitDate = $this->clinicDate->today();
        $rows = QueryUtils::fetchRecords(
            "SELECT v.id AS visit_id, v.queue_number, pd.fname, pd.lname
             FROM new_visit_notify_log n
             INNER JOIN new_visit v ON v.id = n.visit_id
             INNER JOIN patient_data pd ON pd.pid = v.pid
             WHERE n.recipient_user_id = ?
             AND n.channel = ?
             AND v.facility_id = ?
             AND v.visit_date = ?
             AND v.state = 'ready_for_doctor'
             ORDER BY n.notified_at ASC",
            [$doctorUserId, self::CHANNEL_IN_APP, $facilityId, $visitDate]
        ) ?: [];

        $pending = [];
        foreach ($rows as $row) {
            $name = trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? ''));
            $pending[] = [
                'visit_id' => (int) ($row['visit_id'] ?? 0),
                'queue_number' => $row['queue_number'] ?? '',
                'display_name' => $name !== '' ? $name : 'Patient',
            ];
        }

        return $pending;
    }

    /**
     * @param array<string, mixed> $visit
     * @return list<int>
     */
    private function resolveRecipients(array $visit, int $facilityId, string $visitDate): array
    {
        $hardAssigned = (int) ($visit['hard_assigned_provider_id'] ?? 0);
        if ($hardAssigned > 0) {
            return $this->doctorTakingPatients($facilityId, $visitDate, $hardAssigned)
                ? [$hardAssigned]
                : [];
        }

        $suggested = (int) ($visit['routing_suggested_provider_id'] ?? 0);
        if ($suggested > 0) {
            return $this->doctorTakingPatients($facilityId, $visitDate, $suggested)
                ? [$suggested]
                : [];
        }

        if ($this->config->getInt('notify_unassigned_to_all_on_duty', 0, $facilityId) !== 1) {
            return [];
        }

        $recipients = [];
        foreach ($this->roster->listDoctors($facilityId, $visitDate) as $doctor) {
            if (empty($doctor['taking_patients'])) {
                continue;
            }
            $userId = (int) ($doctor['user_id'] ?? 0);
            if ($userId > 0) {
                $recipients[] = $userId;
            }
        }

        return $recipients;
    }

    private function doctorTakingPatients(int $facilityId, string $visitDate, int $doctorUserId): bool
    {
        foreach ($this->roster->listDoctors($facilityId, $visitDate) as $doctor) {
            if ((int) ($doctor['user_id'] ?? 0) === $doctorUserId) {
                return !empty($doctor['taking_patients']);
            }
        }

        return false;
    }

    private function insertNotifyRow(int $visitId, int $recipientUserId, int $pid): void
    {
        sqlStatement(
            "INSERT IGNORE INTO new_visit_notify_log (visit_id, recipient_user_id, channel, notified_at)
             VALUES (?, ?, ?, NOW())",
            [$visitId, $recipientUserId, self::CHANNEL_IN_APP]
        );

        if (generic_sql_affected_rows() < 1) {
            return;
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_visit',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            'doctor_ready_notified',
            'pid=' . $pid . ';visit_id=' . $visitId . ';' . json_encode([
                'recipient_user_id' => $recipientUserId,
                'channel' => self::CHANNEL_IN_APP,
            ]),
            $pid > 0 ? $pid : null
        );
    }
}

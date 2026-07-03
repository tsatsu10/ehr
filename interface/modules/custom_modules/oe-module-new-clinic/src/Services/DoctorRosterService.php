<?php

/**
 * V1.1-RTa — Doctor on-duty roster (taking patients + workload)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class DoctorRosterService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
    ) {
    }

    public function isEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_doctor_roster', 0, $facilityId) === 1;
    }

    /**
     * @return array<string, mixed>
     */
    public function getRosterPayload(int $facilityId, int $actorUserId, ?string $visitDate = null): array
    {
        $visitDate = $visitDate ?? $this->clinicDate->today();

        return [
            'enabled' => true,
            'visit_date' => $visitDate,
            'doctors' => $this->listDoctors($facilityId, $visitDate),
            'my_user_id' => $actorUserId,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listDoctors(int $facilityId, string $visitDate): array
    {
        if ($facilityId <= 0) {
            return [];
        }

        try {
            $rows = QueryUtils::fetchRecords(
                "SELECT u.id, u.fname, u.lname,
                        COALESCE(nda.taking_patients, 1) AS taking_patients,
                        (
                            SELECT COUNT(*)
                            FROM new_visit v
                            WHERE v.facility_id = ?
                              AND v.visit_date = ?
                              AND v.state IN ('ready_for_doctor', 'with_doctor')
                              AND v.assigned_provider_id = u.id
                        ) AS queue_load
                 FROM users u
                 INNER JOIN users_facility uf
                    ON uf.table_id = u.id AND uf.tablename = 'users' AND uf.facility_id = ?
                 LEFT JOIN new_doctor_availability nda
                    ON nda.user_id = u.id AND nda.facility_id = uf.facility_id
                 WHERE u.active = 1
                   AND u.authorized = 1
                 ORDER BY u.lname, u.fname",
                [$facilityId, $visitDate, $facilityId]
            ) ?: [];
        } catch (\Throwable $e) {
            error_log('DoctorRosterService::listDoctors failed: ' . $e->getMessage());
            return [];
        }

        return array_map(static function (array $row): array {
            $fname = (string) ($row['fname'] ?? '');
            $lname = (string) ($row['lname'] ?? '');

            return [
                'user_id' => (int) ($row['id'] ?? 0),
                'display_name' => trim($fname . ' ' . $lname),
                'taking_patients' => (int) ($row['taking_patients'] ?? 1) === 1,
                'queue_load' => (int) ($row['queue_load'] ?? 0),
            ];
        }, $rows);
    }

    public function setTakingPatients(int $userId, int $facilityId, bool $taking): void
    {
        if ($userId <= 0 || $facilityId <= 0) {
            throw new \InvalidArgumentException('Invalid roster user or facility');
        }

        if (!$this->isEnabled($facilityId)) {
            throw new \RuntimeException('Doctor roster is not enabled', 403);
        }

        $flag = $taking ? 1 : 0;

        try {
            $existing = QueryUtils::querySingleRow(
                'SELECT id FROM new_doctor_availability WHERE user_id = ? AND facility_id = ?',
                [$userId, $facilityId]
            );
        } catch (\Throwable) {
            $existing = null;
        }

        if (is_array($existing) && !empty($existing['id'])) {
            QueryUtils::sqlStatementThrowException(
                'UPDATE new_doctor_availability SET taking_patients = ?, updated_at = NOW() WHERE id = ?',
                [$flag, (int) $existing['id']]
            );
        } else {
            QueryUtils::sqlInsert(
                'INSERT INTO new_doctor_availability (user_id, facility_id, taking_patients, updated_at)
                 VALUES (?, ?, ?, NOW())',
                [$userId, $facilityId, $flag]
            );
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_doctor_roster',
            $_SESSION['authUser'] ?? '',
            $_SESSION['authProvider'] ?? '',
            1,
            'taking_patients user_id=' . $userId . ' facility_id=' . $facilityId . ' value=' . $flag
        );

        if ((new VisitRoutingService())->isEnabled($facilityId)) {
            (new VisitRoutingService())->recomputeFacility(
                $facilityId,
                $this->clinicDate->today(),
                'roster_change'
            );
        }
    }
}

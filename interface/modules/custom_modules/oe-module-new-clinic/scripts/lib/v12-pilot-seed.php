<?php

/**
 * Shared V1.2 pilot roster seed helpers (§6.5.3–4).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Common\Database\QueryUtils;

/**
 * @param list<string> $usernames
 */
function v12EnsurePilotDoctorRoster(int $facilityId, array $usernames = ['doctor_user']): void
{
    foreach ($usernames as $username) {
        $row = QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ?', [$username]);
        $userId = (int) ($row['id'] ?? 0);
        if ($userId <= 0) {
            echo "Skip roster seed — user not found: {$username}\n";
            continue;
        }

        sqlStatement('UPDATE users SET authorized = 1, active = 1 WHERE id = ?', [$userId]);

        $link = QueryUtils::querySingleRow(
            "SELECT facility_id FROM users_facility WHERE tablename = 'users' AND table_id = ? AND facility_id = ?",
            [$userId, $facilityId]
        );
        if (empty($link)) {
            sqlStatement(
                "INSERT INTO users_facility (tablename, table_id, facility_id, warehouse_id) VALUES ('users', ?, ?, 0)",
                [$userId, $facilityId]
            );
            echo "Linked {$username} to facility {$facilityId}.\n";
        }

        $avail = QueryUtils::querySingleRow(
            'SELECT user_id FROM new_doctor_availability WHERE user_id = ? AND facility_id = ?',
            [$userId, $facilityId]
        );
        if (empty($avail)) {
            sqlStatement(
                'INSERT INTO new_doctor_availability (user_id, facility_id, taking_patients) VALUES (?, ?, 1)',
                [$userId, $facilityId]
            );
            echo "Seeded taking_patients for {$username}.\n";
        } else {
            sqlStatement(
                'UPDATE new_doctor_availability SET taking_patients = 1 WHERE user_id = ? AND facility_id = ?',
                [$userId, $facilityId]
            );
        }
    }
}

/**
 * @param array<string, string> $keys
 */
function v12ApplyPilotConfigFlags(int $facilityId, array $keys): void
{
    $config = new OpenEMR\Modules\NewClinic\Services\ClinicConfigService();
    foreach ($keys as $key => $value) {
        $config->set($key, $value, 0);
        $config->set($key, $value, $facilityId);
    }
}

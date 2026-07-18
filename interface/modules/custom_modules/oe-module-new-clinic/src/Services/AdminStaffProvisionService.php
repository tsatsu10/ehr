<?php

/**
 * Starter staff sign-ins from the setup checklist (M15-F11 follow-on).
 *
 * Creates the missing core-role accounts (reception, doctor) with one-time
 * temporary passwords, using the same recipe as acl/seed_pilot_users.php:
 * users row + users_secure hash + OpenEMR auth group + phpGACL groups.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclExtended;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class AdminStaffProvisionService
{
    /** Password charset without look-alikes (0/O, 1/l/I) — these get read out loud. */
    private const PASSWORD_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    private const PASSWORD_LENGTH = 12;

    /** @var array<string, array{label: string, username_base: string, fname: string, lname: string, authorized: int, acl_groups: list<string>}> */
    private const ROLE_DEFS = [
        'new_reception' => [
            'label' => 'Reception',
            'username_base' => 'reception',
            'fname' => 'Clinic',
            'lname' => 'Reception',
            'authorized' => 0,
            'acl_groups' => ['Clinicians', 'New Clinic Reception'],
        ],
        'new_doctor' => [
            'label' => 'Doctor',
            'username_base' => 'doctor',
            'fname' => 'Clinic',
            'lname' => 'Doctor',
            'authorized' => 1,
            'acl_groups' => ['Clinicians', 'New Clinic Doctor'],
        ],
    ];

    /**
     * Create sign-ins for whichever core roles have no active member yet.
     * The caller is necessarily a member of new_admin (ACL-gated), so the
     * admin role never needs provisioning here.
     *
     * @return array{created: list<array{role: string, role_label: string, username: string, temp_password?: string}>, already_present: list<string>}
     */
    public function provisionMissing(int $facilityId, int $actorUserId, bool $dryRun = false): array
    {
        $facilityId = $this->resolveFacilityId($facilityId);
        $present = $this->rolesWithActiveMembers();

        $created = [];
        $alreadyPresent = [];
        foreach (self::ROLE_DEFS as $groupValue => $def) {
            if (isset($present[$groupValue])) {
                $alreadyPresent[] = xl($def['label']);
                continue;
            }

            $username = $this->availableUsername($def['username_base']);
            if ($dryRun) {
                $created[] = [
                    'role' => $groupValue,
                    'role_label' => xl($def['label']),
                    'username' => $username,
                ];
                continue;
            }

            $tempPassword = $this->generatePassword();
            $this->createUser($username, $def, $facilityId, $tempPassword);

            EventAuditLogger::getInstance()->newEvent(
                'new_clinic_config',
                'admin_hub.staff_provision',
                $_SESSION['authUser'] ?? 'system',
                $_SESSION['authProvider'] ?? 'default',
                json_encode([
                    'facility_id' => $facilityId,
                    'role' => $groupValue,
                    'username' => $username,
                    'actor_user_id' => $actorUserId,
                ]),
                0
            );

            $created[] = [
                'role' => $groupValue,
                'role_label' => xl($def['label']),
                'username' => $username,
                'temp_password' => $tempPassword,
            ];
        }

        return [
            'created' => $created,
            'already_present' => $alreadyPresent,
        ];
    }

    /** @return array<string, true> group_value => present */
    private function rolesWithActiveMembers(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT g.value AS group_key, COUNT(DISTINCT u.id) AS n
             FROM gacl_aro_groups g
             INNER JOIN gacl_groups_aro_map m ON m.group_id = g.id
             INNER JOIN gacl_aro a ON a.id = m.aro_id AND a.section_value = 'users'
             INNER JOIN users u ON u.username = a.value AND u.active = 1
             WHERE g.value IN ('new_reception', 'new_doctor')
             GROUP BY g.value",
            []
        ) ?: [];

        $present = [];
        foreach ($rows as $row) {
            if ((int) ($row['n'] ?? 0) > 0) {
                $present[(string) $row['group_key']] = true;
            }
        }

        return $present;
    }

    /** Never create users on facility 0 — they vanish from facility-scoped queues. */
    private function resolveFacilityId(int $facilityId): int
    {
        if ($facilityId > 0) {
            return $facilityId;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT id FROM facility WHERE service_location = 1 ORDER BY id LIMIT 1',
            []
        );
        $resolved = is_array($row) ? (int) ($row['id'] ?? 0) : 0;
        if ($resolved <= 0) {
            throw new \InvalidArgumentException(xl('No service facility found — add the clinic under Facilities first.'));
        }

        return $resolved;
    }

    private function availableUsername(string $base): string
    {
        for ($i = 0; $i < 50; $i++) {
            $candidate = $i === 0 ? $base : $base . ($i + 1);
            $existing = QueryUtils::querySingleRow(
                'SELECT id FROM users WHERE username = ?',
                [$candidate]
            );
            if (empty($existing)) {
                return $candidate;
            }
        }

        throw new \RuntimeException('Could not find a free username for ' . $base);
    }

    private function generatePassword(): string
    {
        $chars = self::PASSWORD_CHARS;
        $max = strlen($chars) - 1;
        $out = '';
        for ($i = 0; $i < self::PASSWORD_LENGTH; $i++) {
            $out .= $chars[random_int(0, $max)];
        }

        return $out;
    }

    /** @param array{label: string, username_base: string, fname: string, lname: string, authorized: int, acl_groups: list<string>} $def */
    private function createUser(string $username, array $def, int $facilityId, string $tempPassword): void
    {
        QueryUtils::sqlStatementThrowException(
            "INSERT INTO users (username, password, authorized, active, fname, lname, facility_id)
             VALUES (?, 'NoLongerUsed', ?, 1, ?, ?, ?)",
            [$username, $def['authorized'], $def['fname'], $def['lname'], $facilityId]
        );
        $row = QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ?', [$username]);
        $userId = (int) ($row['id'] ?? 0);
        if ($userId <= 0) {
            throw new \RuntimeException('Failed to create user ' . $username);
        }

        $hash = password_hash($tempPassword, PASSWORD_DEFAULT);
        if ($hash === false || $hash === '') {
            throw new \RuntimeException('Unable to hash password');
        }
        QueryUtils::sqlStatementThrowException(
            'INSERT INTO users_secure (id, username, password, last_update_password) VALUES (?, ?, ?, NOW())',
            [$userId, $username, $hash]
        );

        // OpenEMR login requires a row in `groups` (auth group), separate from phpGACL.
        $authGroup = QueryUtils::querySingleRow(
            'SELECT id FROM `groups` WHERE BINARY `user` = ?',
            [$username]
        );
        if (empty($authGroup)) {
            QueryUtils::sqlStatementThrowException(
                'INSERT INTO `groups` SET name = ?, user = ?',
                ['Default', $username]
            );
        }

        foreach ($def['acl_groups'] as $group) {
            AclExtended::addUserAros($username, $group);
        }
    }
}

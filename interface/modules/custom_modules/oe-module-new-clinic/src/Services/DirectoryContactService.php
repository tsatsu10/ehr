<?php

/**
 * External contacts directory for Clinic Setup — Admin Hub "Directory" tab
 * (GAP-A / A3, closes G3).
 *
 * Storage is 100% stock: address-book contacts live in the core `users`
 * table, distinguished from real staff login/ACL accounts only by
 * `username = '' OR username IS NULL` (a contact never has a username).
 * Every query and mutation in this service carries that guard — mirroring
 * (and, on writes, exceeding) the guard stock's own addrbook_edit.php uses
 * on delete — so a bug here can never touch or corrupt a real staff account.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class DirectoryContactService
{
    /** Contact-not-a-login guard, reused on every read/write/delete. */
    private const CONTACT_GUARD = "(username = '' OR username IS NULL)";

    /**
     * @return array<int, array{option_id: string, title: string, is_company: bool}>
     */
    public function listTypes(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT option_id, title, option_value
             FROM list_options
             WHERE list_id = 'abook_type' AND activity = 1
             ORDER BY seq, title"
        ) ?: [];

        return array_map(static fn (array $row): array => [
            'option_id' => (string) ($row['option_id'] ?? ''),
            'title' => (string) ($row['title'] ?? ''),
            'is_company' => (int) ($row['option_value'] ?? 0) === 3,
        ], $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listForAdmin(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT u.id, u.abook_type, u.title, u.fname, u.lname, u.organization,
                    u.phone, u.fax, u.email, u.notes,
                    COALESCE(lo.title, '') AS type_label,
                    COALESCE(lo.option_value, 0) AS type_is_company
             FROM users u
             LEFT JOIN list_options lo
                 ON lo.list_id = 'abook_type' AND lo.option_id = u.abook_type AND lo.activity = 1
             WHERE u.active = 1 AND " . self::CONTACT_GUARD . "
             ORDER BY COALESCE(NULLIF(u.organization, ''), CONCAT(u.lname, u.fname))"
        ) ?: [];

        return array_map([$this, 'shape'], $rows);
    }

    /**
     * Create (id <= 0) or update (id > 0) a contact.
     *
     * @param array<string, mixed> $input
     * @return array<int, array<string, mixed>>
     */
    public function save(array $input, int $actorUserId): array
    {
        $contactId = (int) ($input['id'] ?? 0);
        $abookType = trim((string) ($input['abook_type'] ?? ''));
        $isCompany = $this->typeIsCompany($abookType);

        $organization = mb_substr(trim((string) ($input['organization'] ?? '')), 0, 255);
        $title = mb_substr(trim((string) ($input['title'] ?? '')), 0, 30);
        $fname = mb_substr(trim((string) ($input['fname'] ?? '')), 0, 255);
        $lname = mb_substr(trim((string) ($input['lname'] ?? '')), 0, 255);
        $phone = mb_substr(trim((string) ($input['phone'] ?? '')), 0, 30);
        $fax = mb_substr(trim((string) ($input['fax'] ?? '')), 0, 30);
        $email = mb_substr(trim((string) ($input['email'] ?? '')), 0, 255);
        $notes = mb_substr(trim((string) ($input['notes'] ?? '')), 0, 2000);

        if ($abookType === '') {
            throw new \InvalidArgumentException('Contact type is required');
        }
        if ($isCompany && $organization === '') {
            throw new \InvalidArgumentException('Organization name is required for this contact type');
        }
        if (!$isCompany && $lname === '') {
            throw new \InvalidArgumentException('Last name is required for this contact type');
        }

        if ($contactId > 0) {
            $this->assertIsContact($contactId);
            sqlStatement(
                "UPDATE users SET
                    abook_type = ?, organization = ?, title = ?, fname = ?, lname = ?,
                    phone = ?, fax = ?, email = ?, notes = ?
                 WHERE id = ? AND " . self::CONTACT_GUARD,
                [$abookType, $organization, $title, $fname, $lname, $phone, $fax, $email, $notes, $contactId]
            );
            $action = 'updated';
            $savedId = $contactId;
        } else {
            $savedId = (int) sqlInsert(
                "INSERT INTO users
                    (username, password, authorized, active, abook_type, organization, title,
                     fname, lname, phone, fax, email, notes)
                 VALUES ('', '', 0, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [$abookType, $organization, $title, $fname, $lname, $phone, $fax, $email, $notes]
            );
            $action = 'created';
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'directory_contact',
            $actorUserId,
            1,
            $action . ' id=' . $savedId
        );

        return $this->listForAdmin();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function delete(int $contactId, int $actorUserId): array
    {
        $this->assertIsContact($contactId);

        sqlStatement(
            "DELETE FROM users WHERE id = ? AND " . self::CONTACT_GUARD,
            [$contactId]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'directory_contact',
            $actorUserId,
            1,
            'deleted id=' . $contactId
        );

        return $this->listForAdmin();
    }

    private function typeIsCompany(string $abookType): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT option_value FROM list_options
             WHERE list_id = 'abook_type' AND option_id = ? AND activity = 1",
            [$abookType]
        );
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Invalid contact type');
        }

        return (int) ($row['option_value'] ?? 0) === 3;
    }

    private function assertIsContact(int $contactId): void
    {
        if ($contactId <= 0) {
            throw new \InvalidArgumentException('Contact is required');
        }
        $row = QueryUtils::querySingleRow(
            "SELECT id FROM users WHERE id = ? AND " . self::CONTACT_GUARD,
            [$contactId]
        );
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Contact not found');
        }
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function shape(array $row): array
    {
        $isCompany = (int) ($row['type_is_company'] ?? 0) === 3;
        $organization = (string) ($row['organization'] ?? '');
        $fname = (string) ($row['fname'] ?? '');
        $lname = (string) ($row['lname'] ?? '');
        $title = (string) ($row['title'] ?? '');
        $personName = trim(implode(' ', array_filter([$title, $fname, $lname])));

        return [
            'id' => (int) ($row['id'] ?? 0),
            'abook_type' => (string) ($row['abook_type'] ?? ''),
            'type_label' => (string) ($row['type_label'] ?? ''),
            'is_company' => $isCompany,
            'organization' => $organization,
            'title' => $title,
            'fname' => $fname,
            'lname' => $lname,
            'display_name' => $isCompany ? ($organization ?: $personName) : ($personName ?: $organization),
            'phone' => (string) ($row['phone'] ?? ''),
            'fax' => (string) ($row['fax'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
            'notes' => (string) ($row['notes'] ?? ''),
        ];
    }
}

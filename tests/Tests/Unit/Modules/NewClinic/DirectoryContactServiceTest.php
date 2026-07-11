<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\DirectoryContactService;
use PHPUnit\Framework\TestCase;

class DirectoryContactServiceTest extends TestCase
{
    /** @var array<int, int> ids of contacts this test created, for teardown */
    private array $createdIds = [];

    protected function tearDown(): void
    {
        foreach ($this->createdIds as $id) {
            sqlStatement("DELETE FROM users WHERE id = ? AND (username = '' OR username IS NULL)", [$id]);
        }
        $this->createdIds = [];
    }

    public function testListTypesReturnsRealAbookTypeCategories(): void
    {
        $service = new DirectoryContactService();

        $types = $service->listTypes();

        $this->assertNotEmpty($types);
        $ids = array_column($types, 'option_id');
        $this->assertContains('spe', $ids, 'Specialist type must be present');
        $this->assertNotContains('hospital', $ids, 'No "Hospital" abook_type exists in stock');
    }

    public function testListForAdminNeverReturnsARealStaffLogin(): void
    {
        // A real, active staff login account (username + authorized=1) must never
        // appear in the directory list, no matter how the query is constructed.
        // Seed one contact so this assertion always has at least one row to check,
        // regardless of what else happens to be in the dev DB.
        $service = new DirectoryContactService();
        $seeded = $service->save(['abook_type' => 'spe', 'lname' => 'PHPUnitGuardCheck'], 1);
        $created = $this->findByLastName($seeded, 'PHPUnitGuardCheck');
        $this->assertNotNull($created);
        $this->createdIds[] = $created['id'];

        $rows = $service->listForAdmin();

        $this->assertNotEmpty($rows);
        foreach ($rows as $row) {
            $this->assertArrayNotHasKey('username', $row, 'Directory rows must never expose username');
            $raw = sqlQuery('SELECT username FROM users WHERE id = ?', [$row['id']]);
            $this->assertTrue(
                $raw['username'] === '' || $raw['username'] === null,
                'listForAdmin() returned a row with a non-empty username (id=' . $row['id'] . ')'
            );
        }
    }

    public function testSaveRejectsMissingType(): void
    {
        $service = new DirectoryContactService();

        $this->expectException(\InvalidArgumentException::class);

        $service->save(['lname' => 'Owusu'], 1);
    }

    public function testSaveRejectsInvalidType(): void
    {
        $service = new DirectoryContactService();

        $this->expectException(\InvalidArgumentException::class);

        $service->save(['abook_type' => 'not_a_real_type', 'lname' => 'Owusu'], 1);
    }

    public function testSaveRequiresLastNameForPersonCentricType(): void
    {
        $service = new DirectoryContactService();

        $this->expectException(\InvalidArgumentException::class);

        $service->save(['abook_type' => 'spe'], 1);
    }

    public function testSaveRequiresOrganizationForCompanyCentricType(): void
    {
        $service = new DirectoryContactService();

        $this->expectException(\InvalidArgumentException::class);

        $service->save(['abook_type' => 'external_org'], 1);
    }

    public function testCreateUpdateAndDeleteRoundTrip(): void
    {
        $service = new DirectoryContactService();

        $rows = $service->save([
            'abook_type' => 'spe',
            'title' => 'Dr.',
            'fname' => 'Ama',
            'lname' => 'PHPUnitOwusu',
            'phone' => '0244000000',
        ], 1);

        $created = $this->findByLastName($rows, 'PHPUnitOwusu');
        $this->assertNotNull($created);
        $this->createdIds[] = $created['id'];
        $this->assertSame('Dr. Ama PHPUnitOwusu', $created['display_name']);
        $this->assertFalse($created['is_company']);

        $updated = $service->save([
            'id' => $created['id'],
            'abook_type' => 'spe',
            'title' => 'Dr.',
            'fname' => 'Ama',
            'lname' => 'PHPUnitOwusu',
            'phone' => '0244111111',
        ], 1);
        $updatedRow = $this->findByLastName($updated, 'PHPUnitOwusu');
        $this->assertSame('0244111111', $updatedRow['phone']);

        $afterDelete = $service->delete($created['id'], 1);
        $this->assertNull($this->findByLastName($afterDelete, 'PHPUnitOwusu'));
    }

    public function testDeleteRejectsIdThatIsNotAContact(): void
    {
        $service = new DirectoryContactService();

        $this->expectException(\InvalidArgumentException::class);

        // id 0 can never be a valid contact row.
        $service->delete(0, 1);
    }

    public function testGuardBlocksTouchingARealStaffLoginRow(): void
    {
        // The critical property this whole service exists to protect: a directory
        // action must never be able to read, overwrite, or delete a row that has a
        // real username -- i.e. a real staff login/ACL principal, not a contact.
        $fakeStaffId = (int) sqlInsert(
            "INSERT INTO users (username, password, authorized, active, fname, lname)
             VALUES (?, 'x', 1, 1, 'PHPUnit', 'FakeStaffAccount')",
            ['phpunit_fake_staff_' . uniqid()]
        );
        $this->assertGreaterThan(0, $fakeStaffId);

        try {
            $service = new DirectoryContactService();

            $rows = $service->listForAdmin();
            foreach ($rows as $row) {
                $this->assertNotSame($fakeStaffId, $row['id'], 'listForAdmin() must never expose a real staff row');
            }

            // A save() targeting the staff row's id must not silently succeed by
            // overwriting it -- assertIsContact() must reject it.
            $this->expectException(\InvalidArgumentException::class);
            $service->save(['id' => $fakeStaffId, 'abook_type' => 'spe', 'lname' => 'ShouldNotWrite'], 1);
        } finally {
            sqlStatement("DELETE FROM users WHERE id = ? AND username LIKE 'phpunit_fake_staff_%'", [$fakeStaffId]);
        }
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<string, mixed>|null
     */
    private function findByLastName(array $rows, string $lname): ?array
    {
        foreach ($rows as $row) {
            if (($row['lname'] ?? '') === $lname) {
                return $row;
            }
        }

        return null;
    }
}

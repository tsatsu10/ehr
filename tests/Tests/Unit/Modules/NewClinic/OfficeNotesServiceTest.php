<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\OfficeNotesService;
use PHPUnit\Framework\TestCase;

class OfficeNotesServiceTest extends TestCase
{
    public function testSaveRejectsEmptyBody(): void
    {
        $service = new OfficeNotesService();

        $this->expectException(\RuntimeException::class);

        $service->save(0, '   ');
    }

    public function testSetActiveRejectsInvalidId(): void
    {
        $service = new OfficeNotesService();

        $this->expectException(\RuntimeException::class);

        $service->setActive(0, true);
    }

    public function testSetPinnedRejectsInvalidId(): void
    {
        $service = new OfficeNotesService();

        $this->expectException(\RuntimeException::class);

        $service->setPinned(-1, true);
    }

    public function testDeleteRejectsInvalidId(): void
    {
        $service = new OfficeNotesService();

        $this->expectException(\RuntimeException::class);

        $service->delete(0);
    }

    public function testCreateListArchiveAndPinRoundTrip(): void
    {
        $service = new OfficeNotesService();
        $_SESSION['authUser'] = 'phpunit';
        $_SESSION['authProvider'] = 'Default';

        $id = $service->save(0, 'PHPUnit smoke note ' . uniqid());
        $this->assertGreaterThan(0, $id);

        $service->setPinned($id, true);
        $activeList = $service->list('active', 0);
        $note = $this->findNote($activeList['notes'], $id);
        $this->assertNotNull($note);
        $this->assertTrue($note['pinned']);
        $this->assertTrue($note['active']);

        $service->setActive($id, false);
        $archivedList = $service->list('archived', 0);
        $archivedNote = $this->findNote($archivedList['notes'], $id);
        $this->assertNotNull($archivedNote);
        $this->assertFalse($archivedNote['active']);

        $service->delete($id);
        $allList = $service->list('all', 0);
        $this->assertNull($this->findNote($allList['notes'], $id));
    }

    /**
     * @param array<int, array<string, mixed>> $notes
     */
    private function findNote(array $notes, int $id): ?array
    {
        foreach ($notes as $note) {
            if ((int) $note['id'] === $id) {
                return $note;
            }
        }

        return null;
    }
}

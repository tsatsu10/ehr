<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\DocumentsService;
use PHPUnit\Framework\TestCase;

class DocumentsServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        sqlStatement("DELETE FROM documents WHERE name = 'phpunit-unfiled-doc.pdf'");
    }

    public function testCategoriesQueriesTheRealStockSchemaWithoutError(): void
    {
        // Regression guard: an earlier revision filtered `WHERE active = 1`, a
        // column the stock `categories` table has never had (confirmed against
        // sql/database.sql and core CategoryTree.class.php, which never filters
        // on it either). That threw a SqlQueryException -> 500 on every
        // documents.categories/upload/recategorize call. This just needs to not
        // throw against the real table.
        $service = new DocumentsService();

        $categories = $service->categories();

        $this->assertIsArray($categories);
        foreach ($categories as $category) {
            $this->assertArrayHasKey('id', $category);
            $this->assertArrayHasKey('name', $category);
        }
    }

    public function testListRejectsInvalidPid(): void
    {
        $service = new DocumentsService();

        $this->expectException(\InvalidArgumentException::class);

        $service->list(0);
    }

    public function testDeleteRejectsDocumentNotBelongingToPatient(): void
    {
        $service = new DocumentsService();

        $this->expectException(\InvalidArgumentException::class);

        // pid 1 essentially never owns document id 999999999 in a dev DB.
        $service->delete(1, 999999999);
    }

    public function testRecategorizeRejectsInvalidPid(): void
    {
        $service = new DocumentsService();

        $this->expectException(\InvalidArgumentException::class);

        $service->recategorize(0, 1, 1);
    }

    public function testUnfiledListQueriesTheRealSchemaWithoutError(): void
    {
        $service = new DocumentsService();

        $result = $service->unfiledList();

        $this->assertArrayHasKey('documents', $result);
        $this->assertArrayHasKey('total', $result);
        $this->assertIsArray($result['documents']);
        foreach ($result['documents'] as $document) {
            $this->assertArrayHasKey('id', $document);
            $this->assertArrayHasKey('view_url', $document);
        }
    }

    public function testAssignPatientRejectsInvalidDocumentId(): void
    {
        $service = new DocumentsService();

        $this->expectException(\InvalidArgumentException::class);

        $service->assignPatient(0, 1);
    }

    public function testAssignPatientRejectsInvalidPid(): void
    {
        $service = new DocumentsService();

        $this->expectException(\InvalidArgumentException::class);

        $service->assignPatient(1, 0);
    }

    public function testAssignPatientRejectsDocumentNotAwaitingAssignment(): void
    {
        $service = new DocumentsService();

        $this->expectException(\InvalidArgumentException::class);

        // A document id that either doesn't exist or already belongs to a
        // real patient (foreign_id != 0) must not be assignable.
        $service->assignPatient(999999999, 1);
    }

    public function testAssignPatientMovesAnUnfiledDocumentToTheTargetPatient(): void
    {
        // The documents table's id column has no AUTO_INCREMENT (core assigns
        // ids explicitly via ORDataObject::persist()) -- sqlInsert()'s
        // LAST_INSERT_ID() return value is meaningless here, so pick an id
        // directly instead of trusting it.
        $documentId = 999999998;
        sqlStatement(
            "INSERT INTO documents (id, name, mimetype, size, date, docdate, foreign_id, deleted)
             VALUES (?, ?, 'application/pdf', 10, NOW(), NOW(), 0, 0)",
            [$documentId, 'phpunit-unfiled-doc.pdf']
        );

        $service = new DocumentsService();
        $service->assignPatient($documentId, 1);

        $row = sqlQuery('SELECT foreign_id FROM documents WHERE id = ?', [$documentId]);
        $this->assertSame(1, (int) $row['foreign_id']);

        // Re-assigning an already-filed document must fail (no longer foreign_id = 0).
        $this->expectException(\InvalidArgumentException::class);
        $service->assignPatient($documentId, 2);
    }
}

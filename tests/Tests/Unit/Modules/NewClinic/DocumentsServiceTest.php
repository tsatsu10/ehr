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
}

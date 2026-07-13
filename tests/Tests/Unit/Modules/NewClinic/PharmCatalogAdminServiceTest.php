<?php

/**
 * PharmCatalogAdminService validation tests (GAP-C C4).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PharmCatalogAdminService;
use PHPUnit\Framework\TestCase;

class PharmCatalogAdminServiceTest extends TestCase
{
    public function testSaveDrugRejectsBlankName(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Drug name is required');
        (new PharmCatalogAdminService())->saveDrug(['name' => '  '], 1);
    }

    public function testSaveDrugRejectsNegativeReorder(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Reorder point cannot be negative');
        (new PharmCatalogAdminService())->saveDrug(['name' => 'Paracetamol', 'reorder_point' => -5], 1);
    }

    public function testGetCatalogReturnsOptionLists(): void
    {
        // Shape check — reads real list_options; the keys must always be present.
        $catalog = (new PharmCatalogAdminService())->getCatalog('');
        $this->assertArrayHasKey('drugs', $catalog);
        $this->assertArrayHasKey('form_options', $catalog);
        $this->assertArrayHasKey('route_options', $catalog);
        $this->assertArrayHasKey('unit_options', $catalog);
        $this->assertIsArray($catalog['drugs']);
    }
}

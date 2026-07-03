<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AdminRunbookService;
use PHPUnit\Framework\TestCase;

class AdminRunbookServiceTest extends TestCase
{
    public function testCatalogHasTwentyRunbooks(): void
    {
        $service = new AdminRunbookService();
        $catalog = $service->getCatalog();

        $this->assertArrayHasKey('cards', $catalog);
        $this->assertCount(20, $catalog['cards']);
        $ids = array_column($catalog['cards'], 'id');
        $this->assertSame('RB-01', $ids[0]);
        $this->assertSame('RB-20', $ids[19]);
    }

    public function testRunbookCardShape(): void
    {
        $service = new AdminRunbookService();
        $card = $service->getCatalog()['cards'][0];

        $this->assertArrayHasKey('task', $card);
        $this->assertArrayHasKey('lens', $card);
        $this->assertArrayHasKey('summary', $card);
        $this->assertArrayHasKey('search_text', $card);
        $this->assertNotSame('', $card['search_text']);
    }
}

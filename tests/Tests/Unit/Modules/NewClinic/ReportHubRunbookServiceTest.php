<?php

/**
 * Unit tests for M16 reporting runbooks catalog
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ReportHubRunbookService;
use PHPUnit\Framework\TestCase;

class ReportHubRunbookServiceTest extends TestCase
{
    public function testCatalogContainsTwelveRunbooks(): void
    {
        $catalog = (new ReportHubRunbookService())->getCatalog();
        $cards = $catalog['cards'] ?? [];

        $this->assertCount(12, $cards);
        $this->assertSame('RR-01', $cards[0]['id'] ?? null);
        $this->assertSame('RR-12', $cards[11]['id'] ?? null);
    }

    public function testDailyRunbooksLinkToDailyReports(): void
    {
        $cards = (new ReportHubRunbookService())->getCatalog()['cards'];
        $rr01 = $cards[0];
        $rr02 = $cards[1];

        $this->assertStringContainsString('reports.php', (string) ($rr01['url'] ?? ''));
        $this->assertStringContainsString('tab=unsigned', (string) ($rr02['url'] ?? ''));
    }
}

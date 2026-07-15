<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\PharmOpsReportsService;
use PHPUnit\Framework\TestCase;

class PharmOpsReportsServiceTest extends TestCase
{
    public function testAjaxPolicyRegistersReportsEmbed(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('pharm_ops_read_acl', $policy->describe('pharm_ops.reports_embed')['type']);
    }

    public function testEmbedCatalogHasNoCoreLinksAndKeepsModuleControlledRegister(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $reflection = new \ReflectionMethod(PharmOpsReportsService::class, 'buildCatalog');
        $reflection->setAccessible(true);

        /** @var array{default_report_id: string, reports: list<array{id: string, embed_url: string}>} $catalog */
        $catalog = $reflection->invoke(new PharmOpsReportsService());

        $this->assertSame(PharmOpsReportsService::REPORT_REORDER, $catalog['default_report_id']);

        // Zero-core: no catalog entry links to a stock interface/reports or
        // interface/drugs page — the report views are native panes now.
        foreach ($catalog['reports'] as $report) {
            $this->assertStringNotContainsString('/interface/reports/', (string) $report['embed_url']);
            $this->assertStringNotContainsString('/interface/drugs/', (string) $report['embed_url']);
        }

        // The controlled-substances register stays as the module's OWN page.
        $urls = array_column($catalog['reports'], 'embed_url');
        $this->assertContains(
            '/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/controlled-register.php',
            $urls
        );
    }

    public function testEmbedCatalogIncludesControlledRegisterReport(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $reflection = new \ReflectionMethod(PharmOpsReportsService::class, 'buildCatalog');
        $reflection->setAccessible(true);

        /** @var array{reports: list<array{id: string}>} $catalog */
        $catalog = $reflection->invoke(new PharmOpsReportsService());
        $ids = array_column($catalog['reports'], 'id');

        $this->assertContains(PharmOpsReportsService::REPORT_CONTROLLED, $ids);
    }

    public function testEmbedCatalogMarksTheReportViewsNative(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $reflection = new \ReflectionMethod(PharmOpsReportsService::class, 'buildCatalog');
        $reflection->setAccessible(true);

        /** @var array{reports: list<array{id: string, native?: bool}>} $catalog */
        $catalog = $reflection->invoke(new PharmOpsReportsService());
        $native = [];
        foreach ($catalog['reports'] as $report) {
            if (!empty($report['native'])) {
                $native[] = $report['id'];
            }
        }

        // All five stock reports are native panes now; controlled register stays
        // the module's own page (not native, not core).
        sort($native);
        $this->assertSame(['activity', 'destroyed', 'prescriptions', 'reorder', 'transactions'], $native);
    }

    /**
     * The transaction-type derivation is the accounting-sensitive part of the
     * activity + transactions reports; it must match the stock report's
     * if/elseif priority exactly.
     */
    public function testClassifyTransactionTypeFollowsStockPriority(): void
    {
        // pid wins even when other fields are also set (sale takes priority).
        $this->assertSame('sale', PharmOpsReportsService::classifyTransactionType([
            'pid' => 42, 'distributor_id' => 5, 'xfer_inventory_id' => 9, 'fee' => 10.0,
        ]));

        // distributor_id -> distribution (no pid).
        $this->assertSame('distribution', PharmOpsReportsService::classifyTransactionType([
            'pid' => 0, 'distributor_id' => 5, 'xfer_inventory_id' => 9, 'fee' => 10.0,
        ]));

        // xfer_inventory_id -> transfer (no pid, no distributor).
        $this->assertSame('transfer', PharmOpsReportsService::classifyTransactionType([
            'pid' => 0, 'distributor_id' => 0, 'xfer_inventory_id' => 9, 'fee' => 10.0,
        ]));

        // fee != 0 -> purchase.
        $this->assertSame('purchase', PharmOpsReportsService::classifyTransactionType([
            'pid' => 0, 'distributor_id' => 0, 'xfer_inventory_id' => 0, 'fee' => 12.5,
        ]));

        // Everything zero -> adjustment.
        $this->assertSame('adjustment', PharmOpsReportsService::classifyTransactionType([
            'pid' => 0, 'distributor_id' => 0, 'xfer_inventory_id' => 0, 'fee' => 0.0,
        ]));

        // A sparse/empty row defaults to adjustment (no crash on missing keys).
        $this->assertSame('adjustment', PharmOpsReportsService::classifyTransactionType([]));
    }
}

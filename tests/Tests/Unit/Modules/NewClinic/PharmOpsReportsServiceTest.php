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

    public function testEmbedCatalogIncludesCoreInventoryReports(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $reflection = new \ReflectionMethod(PharmOpsReportsService::class, 'buildCatalog');
        $reflection->setAccessible(true);

        /** @var array{default_report_id: string, reports: list<array{id: string, embed_url: string}>} $catalog */
        $catalog = $reflection->invoke(new PharmOpsReportsService());

        $this->assertSame(PharmOpsReportsService::REPORT_REORDER, $catalog['default_report_id']);
        $urls = array_column($catalog['reports'], 'embed_url');
        $this->assertContains('/openemr/interface/reports/inventory_list.php', $urls);
        $this->assertContains('/openemr/interface/reports/inventory_transactions.php', $urls);
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
}

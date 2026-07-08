<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AdminPeopleLegacyWrapService;
use PHPUnit\Framework\TestCase;

class AdminPeopleLegacyWrapServiceTest extends TestCase
{
    public function testUnknownViewIsRejectedBeforeAclCheck(): void
    {
        $service = new AdminPeopleLegacyWrapService();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Unknown people legacy view');

        $service->assertViewAllowed('not-a-view');
    }

    public function testActionCatalogListsAllViewsWithAdvancedFlagOnGaclOnly(): void
    {
        $catalog = AdminPeopleLegacyWrapService::actionCatalog();

        $this->assertSame(
            ['users', 'user_add', 'user_edit', 'acl', 'acl_admin', 'facility_user', 'help_acl'],
            array_keys($catalog)
        );
        $this->assertTrue($catalog['acl_admin']['advanced']);
        foreach (['users', 'user_add', 'user_edit', 'acl', 'facility_user', 'help_acl'] as $view) {
            $this->assertFalse($catalog[$view]['advanced'], "view {$view} must not be advanced");
        }
    }

    public function testAdminReturnUrlTargetsPeopleTabWithEncodedSub(): void
    {
        $url = AdminPeopleLegacyWrapService::adminReturnUrl('access & more');

        $this->assertStringContainsString('admin.php?tab=people&sub=access%20%26%20more', $url);
    }
}

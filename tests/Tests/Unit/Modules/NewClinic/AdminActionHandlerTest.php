<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\AdminActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class AdminActionHandlerTest extends TestCase
{
    public function testSupportsAdminActionsOnly(): void
    {
        $handler = new AdminActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('admin.config'));
        $this->assertTrue($handler->supports('admin.staff.list'));
        $this->assertTrue($handler->supports('admin.acl.group_permissions_add'));
        $this->assertTrue($handler->supports('admin.health_status'));
        $this->assertTrue($handler->supports('admin.config.import'));
        $this->assertFalse($handler->supports('profile.get'));
        $this->assertFalse($handler->supports('reports.daily'));
        $this->assertFalse($handler->supports('patients.chart.visits'));
    }
}

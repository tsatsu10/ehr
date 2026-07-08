<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\ReportsActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class ReportsActionHandlerTest extends TestCase
{
    public function testSupportsReportsActionsOnly(): void
    {
        $handler = new ReportsActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('reports.daily'));
        $this->assertTrue($handler->supports('reports.catalog'));
        $this->assertTrue($handler->supports('reports.export_run'));
        $this->assertTrue($handler->supports('reports.documentation_integrity_export'));
        $this->assertFalse($handler->supports('queue_bridge.list'));
        $this->assertFalse($handler->supports('admin.config'));
    }
}

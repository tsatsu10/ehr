<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\SchedulingActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class SchedulingActionHandlerTest extends TestCase
{
    public function testSupportsSchedulingActionsOnly(): void
    {
        $handler = new SchedulingActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('scheduling.flow_board.list'));
        $this->assertTrue($handler->supports('scheduling.calendar.book'));
        $this->assertTrue($handler->supports('scheduling.recalls.send_reminder'));
        $this->assertFalse($handler->supports('queue_bridge.list'));
        $this->assertFalse($handler->supports('reports.daily'));
    }
}

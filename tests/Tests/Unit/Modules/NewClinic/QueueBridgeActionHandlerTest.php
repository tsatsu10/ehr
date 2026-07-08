<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\QueueBridgeActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class QueueBridgeActionHandlerTest extends TestCase
{
    public function testSupportsQueueBridgeAndCountsActionsOnly(): void
    {
        $handler = new QueueBridgeActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('queue_bridge.list'));
        $this->assertTrue($handler->supports('queue_bridge.link_appointment'));
        $this->assertTrue($handler->supports('queue.counts'));
        $this->assertFalse($handler->supports('scheduling.flow_board.list'));
        $this->assertFalse($handler->supports('communications.hub_counts'));
    }
}

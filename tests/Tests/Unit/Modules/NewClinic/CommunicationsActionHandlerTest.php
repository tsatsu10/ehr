<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\CommunicationsActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class CommunicationsActionHandlerTest extends TestCase
{
    public function testSupportsCommunicationsActionsOnly(): void
    {
        $handler = new CommunicationsActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('communications.hub_counts'));
        $this->assertTrue($handler->supports('communications.messages_list'));
        $this->assertTrue($handler->supports('communications.message_send'));
        $this->assertTrue($handler->supports('communications.reminder_create'));
        $this->assertTrue($handler->supports('communications.save_preferences'));
        $this->assertFalse($handler->supports('cohort.presets'));
        $this->assertFalse($handler->supports('visit.start'));
    }
}

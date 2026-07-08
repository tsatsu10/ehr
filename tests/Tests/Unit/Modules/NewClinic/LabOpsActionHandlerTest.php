<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\LabOpsActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class LabOpsActionHandlerTest extends TestCase
{
    public function testSupportsLabOpsActionsOnly(): void
    {
        $handler = new LabOpsActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('lab_ops.worklist'));
        $this->assertTrue($handler->supports('lab_ops.result_save'));
        $this->assertTrue($handler->supports('lab_ops.result_release'));
        $this->assertTrue($handler->supports('lab_ops.specimen_collect'));
        $this->assertTrue($handler->supports('lab_ops.mark_send_out'));
        $this->assertFalse($handler->supports('pharm_ops.worklist'));
        $this->assertFalse($handler->supports('lab.queue'));
    }
}

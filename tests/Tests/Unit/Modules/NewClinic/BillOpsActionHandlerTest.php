<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\BillOpsActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class BillOpsActionHandlerTest extends TestCase
{
    public function testSupportsBillOpsActionsOnly(): void
    {
        $handler = new BillOpsActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('bill_ops.visit_charges'));
        $this->assertTrue($handler->supports('bill_ops.charge_correct'));
        $this->assertTrue($handler->supports('bill_ops.payment_reverse'));
        $this->assertTrue($handler->supports('bill_ops.daysheet_export'));
        $this->assertTrue($handler->supports('bill_ops.outstanding_list'));
        $this->assertFalse($handler->supports('cashier.checkout'));
        $this->assertFalse($handler->supports('pharm_ops.worklist'));
    }
}

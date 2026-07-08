<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\PharmOpsActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class PharmOpsActionHandlerTest extends TestCase
{
    public function testSupportsPharmOpsActionsOnly(): void
    {
        $handler = new PharmOpsActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('pharm_ops.worklist'));
        $this->assertTrue($handler->supports('pharm_ops.dispense_confirm'));
        $this->assertTrue($handler->supports('pharm_ops.otc_sale_confirm'));
        $this->assertTrue($handler->supports('pharm_ops.controlled_catalog_save'));
        $this->assertTrue($handler->supports('pharm_ops.formulary_import'));
        $this->assertFalse($handler->supports('pharmacy.queue'));
        $this->assertFalse($handler->supports('lab_ops.worklist'));
    }
}

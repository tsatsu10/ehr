<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\DoctorActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class DoctorActionHandlerTest extends TestCase
{
    public function testSupportsDoctorDomainActionsOnly(): void
    {
        $handler = new DoctorActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('doctor.queue'));
        $this->assertTrue($handler->supports('doctor.formulary_rx_place'));
        $this->assertTrue($handler->supports('doctor.routing.reassign'));
        $this->assertFalse($handler->supports('doctor.unknown'));
        $this->assertFalse($handler->supports('triage.queue'));
        $this->assertFalse($handler->supports('cashier.pay'));
    }
}

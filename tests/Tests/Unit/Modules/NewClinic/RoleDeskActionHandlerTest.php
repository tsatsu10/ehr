<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\CashierActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\FrontDeskActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\LabActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\PatientActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\PharmacyActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class RoleDeskActionHandlerTest extends TestCase
{
    public function testCashierHandlerSupportsCashierDomainOnly(): void
    {
        $handler = new CashierActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('cashier.pay'));
        $this->assertTrue($handler->supports('cashier.close_zero'));
        $this->assertFalse($handler->supports('lab.queue'));
    }

    public function testLabHandlerSupportsLabDomainOnly(): void
    {
        $handler = new LabActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('lab.skip_to_payment'));
        $this->assertTrue($handler->supports('lab.restore_session'));
        $this->assertFalse($handler->supports('pharmacy.take'));
    }

    public function testPharmacyHandlerSupportsPharmacyDomainOnly(): void
    {
        $handler = new PharmacyActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('pharmacy.walkin_close'));
        $this->assertTrue($handler->supports('pharmacy.skip_to_payment'));
        $this->assertFalse($handler->supports('cashier.queue'));
    }

    public function testFrontDeskHandlerSupportsFrontDeskDomainOnly(): void
    {
        $handler = new FrontDeskActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('front_desk.desk_stats'));
        $this->assertTrue($handler->supports('desk.shared_session_probe'));
        $this->assertFalse($handler->supports('patients.search'));
    }

    public function testPatientHandlerSupportsPatientDomainOnly(): void
    {
        $handler = new PatientActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('patients.preview'));
        $this->assertTrue($handler->supports('patients.chart.visits'));
        $this->assertFalse($handler->supports('front_desk.flow_charts'));
    }
}

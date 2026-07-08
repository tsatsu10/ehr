<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\ChartDepthActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class ChartDepthActionHandlerTest extends TestCase
{
    public function testSupportsChartDepthAndMrdActionsOnly(): void
    {
        $handler = new ChartDepthActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('chart_depth.payments_list'));
        $this->assertTrue($handler->supports('mrd.clinical_labs_summary'));
        $this->assertTrue($handler->supports('chart_depth.export_generate'));
        $this->assertFalse($handler->supports('patients.chart.visits'));
        $this->assertFalse($handler->supports('admin.config'));
    }
}

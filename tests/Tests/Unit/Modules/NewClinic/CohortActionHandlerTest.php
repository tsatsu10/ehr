<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\CohortActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class CohortActionHandlerTest extends TestCase
{
    public function testSupportsCohortActionsOnly(): void
    {
        $handler = new CohortActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('cohort.presets'));
        $this->assertTrue($handler->supports('cohort.search'));
        $this->assertTrue($handler->supports('cohort.export'));
        $this->assertTrue($handler->supports('cohort.saved_filter'));
        $this->assertFalse($handler->supports('lab_ops.worklist'));
        $this->assertFalse($handler->supports('visit.start'));
    }
}

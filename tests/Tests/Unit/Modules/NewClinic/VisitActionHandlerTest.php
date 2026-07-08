<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\VisitActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class VisitActionHandlerTest extends TestCase
{
    public function testSupportsVisitDomainActionsOnly(): void
    {
        $handler = new VisitActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('visit.board'));
        $this->assertTrue($handler->supports('visit.start_from_appointment'));
        $this->assertFalse($handler->supports('visit.transition'));
        $this->assertFalse($handler->supports('triage.queue'));
        $this->assertFalse($handler->supports('health'));
    }
}

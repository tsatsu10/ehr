<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\TriageActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class TriageActionHandlerTest extends TestCase
{
    public function testSupportsTriageDomainActionsOnly(): void
    {
        $handler = new TriageActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('triage.queue'));
        $this->assertTrue($handler->supports('triage.restore_session'));
        $this->assertFalse($handler->supports('triage.unknown'));
        $this->assertFalse($handler->supports('visit.start'));
        $this->assertFalse($handler->supports('doctor.queue'));
    }
}

<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\ClinicalDocActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class ClinicalDocActionHandlerTest extends TestCase
{
    public function testSupportsClinicalDocAndEncounterNoteActionsOnly(): void
    {
        $handler = new ClinicalDocActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('clinical_doc.visit_summary'));
        $this->assertTrue($handler->supports('clinical_doc.catalog'));
        $this->assertTrue($handler->supports('clinical_doc.open_form'));
        $this->assertTrue($handler->supports('clinical_doc.import_ancillary_pack'));
        $this->assertTrue($handler->supports('encounter_note.get'));
        $this->assertTrue($handler->supports('encounter_note.sign'));
        $this->assertTrue($handler->supports('encounter_note.unlock'));
        $this->assertFalse($handler->supports('communications.hub_counts'));
        $this->assertFalse($handler->supports('visit.start'));
    }
}

<?php

/**
 * Native New Clinic consult note — custom_report / visit summary export
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Modules\NewClinic\Services\EncounterNoteExportRenderer;

require_once __DIR__ . '/../../globals.php';
require_once $GLOBALS['srcdir'] . '/api.inc.php';

function nc_encounter_consult_report($pid, $encounter, $cols, $id): void
{
    (new EncounterNoteExportRenderer())->renderReport((int) $pid, (int) $encounter, (int) $id);
}

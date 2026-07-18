<?php

/**
 * Office Notes — clinic-wide staff sticky notes (React island, GAP-A / A1).
 *
 * Permanent surface: replaced the stock office_comments_full.php screen after
 * parity sign-off — there is no legacy fallback.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;

(new PageController())->renderForEncounterNotesAcl('office-notes.html.twig', 'Office Notes', [
    'island_entry' => 'office-notes',
    'shell_nav_id' => 'clinicnotes',
]);

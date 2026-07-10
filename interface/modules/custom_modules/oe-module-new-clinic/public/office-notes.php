<?php

/**
 * Office Notes — clinic-wide staff sticky notes (React island, GAP-A / A1).
 *
 * Smart-vs-legacy: when `enable_office_notes` is OFF (default), redirect to the stock
 * office_comments_full.php screen (100% legacy). The legacy screen stays reachable
 * until this replacement passes parity sign-off.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

if (!$config->isEnabled('enable_office_notes', 0, $facilityId)) {
    $webroot = $GLOBALS['webroot'] ?? '';
    header('Location: ' . $webroot . '/interface/main/onotes/office_comments_full.php', true, 302);
    exit;
}

$webroot = $GLOBALS['webroot'] ?? '';

(new PageController())->renderForEncounterNotesAcl('office-notes.html.twig', 'Office Notes', [
    'island_entry' => 'office-notes',
    'shell_nav_id' => 'clinicnotes',
    'legacy_url' => $webroot . '/interface/main/onotes/office_comments_full.php',
]);

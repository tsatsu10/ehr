<?php

/**
 * V1.2-DOC-HLF-2 — native encounter consultation note
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocAccessService;
use OpenEMR\Modules\NewClinic\Services\EncounterNoteService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

$encounterNote = new EncounterNoteService();
if (!$encounterNote->isNativeEngineEnabled($facilityId)) {
    $webroot = $GLOBALS['webroot'] ?? '';
    header('Location: ' . $webroot . '/interface/patient_file/encounter/encounter_top.php', true, 302);
    exit;
}

$access = new ClinicalDocAccessService();
try {
    $access->assertConsultNoteAccess();
} catch (\Throwable) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$visitId = (int) ($_GET['visit_id'] ?? 0);
$formId = (int) ($_GET['form_id'] ?? 0);
if ($visitId <= 0 && $formId > 0) {
    $visitId = $encounterNote->resolveVisitIdFromFormsRow($formId);
}
if ($visitId <= 0) {
    http_response_code(400);
    echo xlt('visit_id is required');
    exit;
}

$webroot = $GLOBALS['webroot'] ?? '';
$moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$returnTo = strtolower(trim((string) ($_GET['return_to'] ?? 'hub')));
$returnTab = trim((string) ($_GET['tab'] ?? 'consult'));
$initialFocus = strtolower(trim((string) ($_GET['focus'] ?? '')));
$returnUrl = $returnTo === 'doctor'
    ? $moduleUrl . '/doctor.php'
    : $moduleUrl . '/clinical-doc/index.php?visit_id=' . urlencode((string) $visitId)
        . '&tab=' . urlencode($returnTab !== '' ? $returnTab : 'consult');

(new PageController())->renderForAnyAcl(
    'encounter-consult/index.html.twig',
    'Consultation note',
    ClinicalDocAccessService::CONSULT_ACLS,
    [
        'island_entry' => 'encounter-consult',
        'shell_nav_id' => 'clinicdochub',
        'shell_minimal' => true,
        'module_url' => $moduleUrl,
        'visit_id' => $visitId,
        'facility_id' => $facilityId,
        'return_url' => $returnUrl,
        'return_to' => $returnTo,
        'return_tab' => $returnTab,
        'initial_focus' => $initialFocus === 'sign' ? 'sign' : '',
        'webroot' => $webroot,
    ]
);

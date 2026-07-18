<?php

/**
 * Clinical Documentation Hub (M17)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once dirname(__DIR__) . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocAccessService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

$access = new ClinicalDocAccessService();
try {
    $access->assertHubAccess();
} catch (\Throwable) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$webroot = $GLOBALS['webroot'] ?? '';
$moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$reactHub = $config->get('enable_react_clinical_doc_hub', '1') === '1';
$tabParam = (string) ($_GET['tab'] ?? 'visit');
$visitId = (int) ($_GET['visit_id'] ?? 0);
$encounterIdParam = (int) ($_GET['encounter_id'] ?? 0);
$allowedTabs = $access->allowedLenses($facilityId);
if (!in_array($tabParam, $allowedTabs, true)) {
    $tabParam = $allowedTabs[0] ?? 'visit';
}

(new PageController())->renderForAnyAcl(
    'clinical-doc/index.html.twig',
    'Clinical Documentation',
    ClinicalDocAccessService::HUB_READ_ACLS,
    [
        'island_entry' => 'clinical-doc',
        'shell_nav_id' => 'clinicdochub',
        'doctor_desk_url' => $moduleUrl . '/doctor.php',
        'initial_tab' => $tabParam,
        'initial_visit_id' => $visitId > 0 ? $visitId : null,
        'initial_encounter_id' => $encounterIdParam > 0 ? $encounterIdParam : null,
        'can_visit' => $access->canViewVisit(),
        'can_consult' => $access->canViewConsult(),
        'can_screening' => $access->canViewScreening() && $access->showScreeningLens($facilityId),
        'can_nursing' => $access->canViewNursing(),
        'can_orders' => $access->canViewOrders(),
        'can_specialty' => $access->canViewSpecialty() && $access->showSpecialtyLens($facilityId),
        'enable_react_clinical_doc_hub' => $reactHub,
    ]
);

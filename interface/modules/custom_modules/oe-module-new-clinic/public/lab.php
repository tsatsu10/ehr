<?php

/**
 * Lab Desk — lab queue and core order shortcuts (M8)
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\LabOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

if (!$config->isEnabled('enable_lab_role', 0)) {
    http_response_code(403);
    echo xlt('Lab Desk is disabled. Enable Lab role in Clinic Setup.');
    exit;
}

$labOpsEnabled = $config->isEnabled('enable_lab_ops', 0, $facilityId);
$labOpsAccess = new LabOpsAccessService();

(new PageController())->render('lab.html.twig', 'Lab Desk', 'new_lab', [
    'desk_id' => 'lab',
    'module_url' => $moduleUrl,
    'visit_board_url' => $moduleUrl . '/visit-board.php',
    'webroot' => $GLOBALS['webroot'],
    'can_skip_to_payment' => AclMain::aclCheckCore('new_clinic', 'new_visit_skip_queue'),
    'lab_ops_url' => $labOpsEnabled ? $moduleUrl . '/lab-ops/index.php' : null,
    'lab_ops_enabled' => $labOpsEnabled,
    'can_enter_results' => $labOpsEnabled && $labOpsAccess->canEnterResults(),
    'can_release_results' => $labOpsEnabled && $labOpsAccess->canReleaseResults(),
]);

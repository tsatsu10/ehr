<?php

/**
 * Doctor Desk — consult queue and shortcuts (M4)
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\LabPanelOrderService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$config = new ClinicConfigService();
$multiDoctor = $config->isEnabled('enable_multi_doctor_filters', 0);
$deskFacilityId = (new VisitScopeService())->resolveDeskFacilityId();

(new PageController())->render('doctor.html.twig', 'Doctor Desk', 'new_doctor', [
    'desk_id' => 'doctor',
    'module_url' => $moduleUrl,
    'visit_board_url' => $moduleUrl . '/visit-board.php',
    'enable_multi_doctor_filters' => $multiDoctor,
    'lab_panel_order_enabled' => (new LabPanelOrderService())->isFeatureEnabled($deskFacilityId),
    'webroot' => $GLOBALS['webroot'],
]);

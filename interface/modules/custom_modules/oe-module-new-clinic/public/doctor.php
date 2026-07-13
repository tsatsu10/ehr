<?php

/**
 * Doctor Desk — consult queue and shortcuts (M4)
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\LabPanelOrderService;
use OpenEMR\Modules\NewClinic\Services\PatientEducationService;
use OpenEMR\Modules\NewClinic\Services\PharmFormularyRxService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$config = new ClinicConfigService();
// Feature flags are per-facility (Admin Hub saves them at the clinic facility);
// read them at the resolved facility, not the global default, or a facility-0
// row shadows the admin's enable. Same facility the desk already uses below.
$deskFacilityId = (new VisitScopeService())->resolveDeskFacilityId();
$multiDoctor = $config->isEnabled('enable_multi_doctor_filters', 0, $deskFacilityId);
$doctorRoster = $config->isEnabled('enable_doctor_roster', 0, $deskFacilityId);
$advisoryRouting = $config->isEnabled('enable_advisory_routing', 0, $deskFacilityId);

$reactDoctorDesk = $config->get('enable_react_doctor_desk', '1') === '1';
$labResultsToast = $config->isEnabled('enable_lab_results_toast', 0, $deskFacilityId);

(new PageController())->renderDesk('doctor.html.twig', 'new_doctor', [
    'desk_id' => 'doctor',
    'module_url' => $moduleUrl,
    'visit_board_url' => $moduleUrl . '/visit-board.php',
    'enable_multi_doctor_filters' => $multiDoctor,
    'enable_doctor_roster' => $doctorRoster,
    'enable_advisory_routing' => $advisoryRouting,
    'lab_panel_order_enabled' => (new LabPanelOrderService())->isFeatureEnabled($deskFacilityId),
    'formulary_rx_enabled' => (new PharmFormularyRxService())->isFeatureEnabled($deskFacilityId),
    'lab_results_toast_enabled' => $labResultsToast,
    'can_rx_allergy_override' => AclMain::aclCheckCore('new_clinic', 'new_rx_undocumented_allergy_override'),
    'webroot' => $GLOBALS['webroot'],
    'enable_react_doctor_desk' => $reactDoctorDesk,
    'patient_education_resources' => (new PatientEducationService())->getResources(),
    'island_entry' => 'doctor-desk',
]);

<?php

/**
 * Patient Registry — cohort search (M10 PR-1)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$reactPatientRegistry = $config->get('enable_react_patient_registry', '1') === '1';
$schedulingEnabled = (new SchedulingAccessService())->isHubEnabled($facilityId);

(new PageController())->renderForAnyClinicRole('patient-registry.html.twig', 'Patient Registry', [
    'new_doctor',
    'new_nurse',
    'new_admin',
    'new_registry',
], [
    'island_entry' => 'patient-registry',
    'shell_nav_id' => 'clinicreg',
    'module_url' => $moduleUrl,
    'visit_board_url' => $moduleUrl . '/visit-board.php',
    'front_desk_url' => $moduleUrl . '/front-desk.php',
    'facility_id' => $facilityId,
    'scheduled_integration_enabled' => $schedulingEnabled,
    'can_start_visit' => AclMain::aclCheckCore('new_clinic', 'new_reception'),
    'chart_url_base' => $moduleUrl . '/patient-chart.php',
    'billing_threshold' => (new \OpenEMR\Modules\NewClinic\Services\PatientCompletionService())->getBillingThreshold(),
    'enable_react_patient_registry' => $reactPatientRegistry,
]);

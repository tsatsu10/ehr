<?php

/**
 * Daily Reports — visits, cash, open queue (M7)
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ScheduledIntegrationService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$facilityId = $visitScope->resolveDeskFacilityId(
    !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null
);
$scheduledIntegration = new ScheduledIntegrationService();
$reactDailyReports = $config->get('enable_react_daily_reports', '1') === '1';
$embed = isset($_GET['embed']) && (string) $_GET['embed'] === '1';
$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';

(new PageController())->render('reports.html.twig', 'Daily Reports', 'reports', [
    'island_entry' => 'daily-reports',
    'module_url' => $moduleUrl,
    'visit_board_url' => $moduleUrl . '/visit-board.php',
    'can_cancel_visit' => AclMain::aclCheckCore('new_clinic', 'new_visit_cancel'),
    'can_mark_unpaid' => AclMain::aclCheckCore('new_clinic', 'new_visit_mark_outstanding'),
    'can_run_reconciliation' => AclMain::aclCheckCore('new_clinic', 'new_admin'),
    'scheduled_integration_enabled' => $scheduledIntegration->isEnabled($facilityId),
    'ancillary_services_enabled' => $config->getInt('enable_ancillary_services', 0, $facilityId) === 1,
    'enable_react_daily_reports' => $reactDailyReports,
    'shell_minimal' => $embed,
    'shell_embed' => $embed,
]);

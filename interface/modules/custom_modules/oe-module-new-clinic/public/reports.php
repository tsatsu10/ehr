<?php

/**
 * Daily Reports — visits, cash, open queue (M7)
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;

$config = new ClinicConfigService();
$reactDailyReports = $config->get('enable_react_daily_reports', '1') === '1';
$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';

(new PageController())->render('reports.html.twig', 'Daily Reports', 'reports', [
    'module_url' => $moduleUrl,
    'visit_board_url' => $moduleUrl . '/visit-board.php',
    'can_cancel_visit' => AclMain::aclCheckCore('new_clinic', 'new_visit_cancel'),
    'can_mark_unpaid' => AclMain::aclCheckCore('new_clinic', 'new_visit_mark_outstanding'),
    'enable_react_daily_reports' => $reactDailyReports,
]);

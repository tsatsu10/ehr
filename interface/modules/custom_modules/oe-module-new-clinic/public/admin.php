<?php

/**
 * Clinic Setup — queue, roles, completion settings (M6)
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;

$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$config = new ClinicConfigService();
$reactAdminHub = $config->get('enable_react_admin_hub', '1') === '1';

(new PageController())->render('admin.html.twig', 'Clinic Setup', 'new_admin', [
    'module_url' => $moduleUrl,
    'visit_board_url' => $moduleUrl . '/visit-board.php',
    'enable_react_admin_hub' => $reactAdminHub,
]);

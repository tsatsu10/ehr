<?php

/**
 * Cashier desk — payment queue and cash checkout (M5)
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;

$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$config = new ClinicConfigService();

$reactCashierDesk = $config->get('enable_react_cashier_desk', '1') === '1';

(new PageController())->renderDesk('cashier.html.twig', 'new_cashier', [
    'island_entry' => 'cashier-desk',
    'desk_id' => 'cashier',
    'module_url' => $moduleUrl,
    'visit_board_url' => $moduleUrl . '/visit-board.php',
    'can_mark_unpaid' => AclMain::aclCheckCore('new_clinic', 'new_visit_mark_outstanding'),
    'can_skip_completion' => AclMain::aclCheckCore('new_clinic', 'new_billing_skip_completion'),
    'can_apply_discount' => AclMain::aclCheckCore('new_clinic', 'new_discount'),
    'can_esign_override' => AclMain::aclCheckCore('new_clinic', 'new_esign_skip_complete'),
    'enable_react_cashier_desk' => $reactCashierDesk,
]);

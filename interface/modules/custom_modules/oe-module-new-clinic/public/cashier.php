<?php

/**
 * Cashier desk — payment queue and cash checkout (M5)
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;

$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';

(new PageController())->render('cashier.html.twig', 'Cashier', 'new_cashier', [
    'desk_id' => 'cashier',
    'module_url' => $moduleUrl,
    'visit_board_url' => $moduleUrl . '/visit-board.php',
    'can_mark_unpaid' => AclMain::aclCheckCore('new_clinic', 'new_visit_mark_outstanding'),
    'can_skip_completion' => AclMain::aclCheckCore('new_clinic', 'new_billing_skip_completion'),
    'can_apply_discount' => AclMain::aclCheckCore('new_clinic', 'new_discount'),
    'can_esign_override' => AclMain::aclCheckCore('new_clinic', 'new_esign_skip_complete'),
]);

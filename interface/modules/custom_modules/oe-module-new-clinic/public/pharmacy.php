<?php

/**
 * Pharmacy Desk — pharmacy queue and core Rx shortcuts (M9)
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;

$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$config = new ClinicConfigService();

if (!$config->isEnabled('enable_pharmacy_role', 0)) {
    http_response_code(403);
    echo xlt('Pharmacy Desk is disabled. Enable Pharmacy role in Clinic Setup.');
    exit;
}

$reactPharmacyDesk = $config->get('enable_react_pharmacy_desk', '1') === '1';

(new PageController())->render('pharmacy.html.twig', 'Pharmacy Desk', 'new_pharmacy', [
    'desk_id' => 'pharmacy',
    'module_url' => $moduleUrl,
    'visit_board_url' => $moduleUrl . '/visit-board.php',
    'webroot' => $GLOBALS['webroot'],
    '  can_skip_to_payment' => AclMain::aclCheckCore('new_clinic', 'new_visit_skip_queue'),
    'enable_react_pharmacy_desk' => $reactPharmacyDesk,
    'can_esign_override' => AclMain::aclCheckCore('new_clinic', 'new_esign_skip_complete'),
]);

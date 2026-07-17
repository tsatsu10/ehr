<?php

/**
 * Cashier desk — payment queue and cash checkout (M5)
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$config = new ClinicConfigService();

$reactCashierDesk = $config->get('enable_react_cashier_desk', '1') === '1';
// CBILL-2 — partial payment flag is facility-scoped; read it at the resolved desk facility.
$deskFacilityId = (new VisitScopeService())->resolveDeskFacilityId(
    !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null
);
$canMarkUnpaid = AclMain::aclCheckCore('new_clinic', 'new_visit_mark_outstanding');

(new PageController())->renderDesk('cashier.html.twig', 'new_cashier', [
    'island_entry' => 'cashier-desk',
    'desk_id' => 'cashier',
    'module_url' => $moduleUrl,
    'visit_board_url' => $moduleUrl . '/visit-board.php',
    'can_mark_unpaid' => $canMarkUnpaid,
    'can_skip_completion' => AclMain::aclCheckCore('new_clinic', 'new_billing_skip_completion'),
    'can_apply_discount' => AclMain::aclCheckCore('new_clinic', 'new_discount'),
    'can_esign_override' => AclMain::aclCheckCore('new_clinic', 'new_esign_skip_complete'),
    'enable_partial_payment' => $config->getInt('enable_partial_payment', 0, $deskFacilityId) === 1,
    'can_partial_pay' => $canMarkUnpaid,
    'enable_insurance_scheme' => $config->getInt('enable_insurance_scheme', 0, $deskFacilityId) === 1,
    // CBILL-4b — manual eligibility-check log (requires the scheme-split flag above).
    'enable_payer_billing' => $config->getInt('enable_payer_billing', 0, $deskFacilityId) === 1,
    // CP-2 — deposits/other payments: flag AND permission, computed server-side.
    'can_other_payments' => $config->getInt('enable_cashier_other_payments', 0, $deskFacilityId) === 1
        && (AclMain::aclCheckCore('new_clinic', 'new_cashier_other_payment')
            || AclMain::aclCheckCore('new_clinic', 'new_admin')),
    'enable_react_cashier_desk' => $reactCashierDesk,
]);

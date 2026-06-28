<?php

/**
 * Billing Back Office Hub (M14)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once dirname(__DIR__) . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\BillOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

if (!$config->isEnabled('enable_bill_ops', 0, $facilityId)) {
    http_response_code(403);
    echo xlt('Billing back office is disabled. Enable it in Clinic Setup.');
    exit;
}

$access = new BillOpsAccessService();
try {
    $access->assertHubEnabled($facilityId);
} catch (\Throwable) {
    http_response_code(403);
    echo xlt('Billing back office is not enabled for this clinic');
    exit;
}

$hasHubAccess = $access->canReadHub()
    || $access->canCorrectCharges()
    || $access->canManagePayments()
    || $access->canCloseDay()
    || $access->canViewOutstanding()
    || $access->canViewInsuranceVault();

if (!$hasHubAccess) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$webroot = $GLOBALS['webroot'] ?? '';
$moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$reactBillOps = $config->get('enable_react_bill_ops', '1') === '1';

$initialTab = (string) ($_GET['tab'] ?? 'corrections');
$allowedTabs = ['corrections', 'payments', 'close'];
if ($access->isOutstandingEnabled($facilityId)) {
    $allowedTabs[] = 'outstanding';
}
if ($access->isInsuranceVaultEnabled($facilityId)) {
    $allowedTabs[] = 'insurance';
}
if (!in_array($initialTab, $allowedTabs, true)) {
    $initialTab = 'corrections';
}

(new PageController())->renderForAnyAcl(
    'bill-ops/index.html.twig',
    'Billing back office',
    [
        'new_bill_ops',
        'new_bill_ops_correct',
        'new_bill_ops_payment',
        'new_bill_ops_close',
        'new_bill_ops_outstanding',
        'new_bill_ops_insurance',
        'new_admin',
    ],
    [
        'shell_nav_id' => 'clinicbillops',
        'module_url' => $moduleUrl,
        'cashier_url' => $moduleUrl . '/cashier.php',
        'reports_url' => $moduleUrl . '/reports.php',
        'visit_board_url' => $moduleUrl . '/visit-board.php',
        'initial_tab' => $initialTab,
        'can_correct' => $access->canCorrectCharges(),
        'can_payment' => $access->canManagePayments(),
        'can_close' => $access->canCloseDay(),
        'can_outstanding' => $access->isOutstandingEnabled($facilityId) && $access->canViewOutstanding(),
        'can_insurance' => $access->isInsuranceVaultEnabled($facilityId) && $access->canViewInsuranceVault(),
        'can_show_advanced' => AclMain::aclCheckCore('new_clinic', 'new_admin')
            || AclMain::aclCheckCore('admin', 'super'),
        'enable_react_bill_ops' => $reactBillOps,
        'reopen_on_correction' => $config->getInt('bill_ops_reopen_on_correction', 0, $facilityId) === 1,
    ]
);

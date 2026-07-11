<?php

/**
 * Reporting Operations Hub (M16)
 *
 * Module lenses (M7 Daily Reports, Bill Ops, etc.) embed as native React islands
 * via ReportHubEmbedView. Legacy stock OpenEMR reports still load in an iframe
 * using reports.php?embed=1 (shell_minimal) when a catalog card points off-module.
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
use OpenEMR\Modules\NewClinic\Services\ReportHubAccessService;
use OpenEMR\Modules\NewClinic\Services\ReportHubRunbookService;
use OpenEMR\Modules\NewClinic\Services\ScheduledIntegrationService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

if (!$config->isEnabled('enable_report_hub', 0, $facilityId)) {
    $webroot = $GLOBALS['webroot'] ?? '';
    header('Location: ' . $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/reports.php', true, 302);
    exit;
}

$access = new ReportHubAccessService();
try {
    $access->assertHubAccess();
} catch (\Throwable) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$scheduledIntegration = new ScheduledIntegrationService();
$billOpsAccess = new BillOpsAccessService();
$billOpsLinked = $access->isBillOpsLinked($facilityId);

$webroot = $GLOBALS['webroot'] ?? '';
$moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$reactReportHub = $config->get('enable_react_report_hub', '1') === '1';
$tabParam = (string) ($_GET['tab'] ?? 'today');
$allowedTabs = $access->allowedLenses();
if (!in_array($tabParam, $allowedTabs, true)) {
    $tabParam = $allowedTabs[0] ?? 'today';
}

(new PageController())->renderForAnyAcl(
    'report-hub/index.html.twig',
    'Reporting Hub',
    ReportHubAccessService::HUB_READ_ACLS,
    [
        'island_entry' => 'report-hub',
        'shell_nav_id' => 'clinicrephub',
        'module_url' => $moduleUrl,
        'reports_url' => $moduleUrl . '/reports.php',
        'visit_board_url' => $moduleUrl . '/visit-board.php',
        'front_desk_url' => $moduleUrl . '/front-desk.php',
        'cashier_url' => $moduleUrl . '/cashier.php',
        'chart_url_base' => $moduleUrl . '/patient-chart.php',
        'billing_threshold' => (new \OpenEMR\Modules\NewClinic\Services\PatientCompletionService())->getBillingThreshold(),
        'bill_ops_url' => $moduleUrl . '/bill-ops/index.php',
        'pharm_ops_url' => $moduleUrl . '/pharm-ops/index.php',
        'initial_tab' => $tabParam,
        'can_today' => $access->canViewToday(),
        'can_clinical' => $access->canViewClinical(),
        'can_pharmacy' => $access->canViewPharmacy(),
        'can_financial' => $access->canViewFinancial(),
        'can_public_health' => $access->canViewPublicHealth(),
        'can_audit' => $access->canViewAudit(),
        'can_unfiled_documents' => $access->canViewUnfiledDocuments($facilityId),
        'can_show_advanced' => AclMain::aclCheckCore('new_clinic', 'new_admin')
            || AclMain::aclCheckCore('admin', 'super'),
        'can_cancel_visit' => AclMain::aclCheckCore('new_clinic', 'new_visit_cancel'),
        'can_mark_unpaid' => AclMain::aclCheckCore('new_clinic', 'new_visit_mark_outstanding'),
        'can_run_reconciliation' => AclMain::aclCheckCore('new_clinic', 'new_admin'),
        'scheduled_integration_enabled' => $scheduledIntegration->isEnabled($facilityId),
        'can_start_visit' => AclMain::aclCheckCore('new_clinic', 'new_reception'),
        'can_bill_ops_correct' => $billOpsLinked && $billOpsAccess->canCorrectCharges(),
        'can_bill_ops_payment' => $billOpsLinked && $billOpsAccess->canManagePayments(),
        'can_bill_ops_close' => $billOpsLinked && $billOpsAccess->canCloseDay(),
        'can_bill_ops_outstanding' => $billOpsLinked && $access->isBillOpsOutstandingEnabled($facilityId) && $billOpsAccess->canViewOutstanding(),
        'can_bill_ops_insurance' => $billOpsLinked && $billOpsAccess->isInsuranceVaultEnabled($facilityId) && $billOpsAccess->canViewInsuranceVault(),
        'reopen_on_correction' => $config->getInt('bill_ops_reopen_on_correction', 0, $facilityId) === 1,
        'enable_react_report_hub' => $reactReportHub,
        'report_runbooks' => (new ReportHubRunbookService())->getCatalog()['cards'],
        'webroot' => $webroot,
    ]
);

<?php

/**
 * Reporting Operations Hub (M16)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once dirname(__DIR__) . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ReportHubAccessService;
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
        'shell_nav_id' => 'clinicrephub',
        'module_url' => $moduleUrl,
        'reports_url' => $moduleUrl . '/reports.php?embed=1',
        'visit_board_url' => $moduleUrl . '/visit-board.php',
        'bill_ops_url' => $moduleUrl . '/bill-ops/index.php',
        'pharm_ops_url' => $moduleUrl . '/pharm-ops/index.php',
        'initial_tab' => $tabParam,
        'can_today' => $access->canViewToday(),
        'can_clinical' => $access->canViewClinical(),
        'can_pharmacy' => $access->canViewPharmacy(),
        'can_financial' => $access->canViewFinancial(),
        'can_public_health' => $access->canViewPublicHealth(),
        'can_audit' => $access->canViewAudit(),
        'can_show_advanced' => AclMain::aclCheckCore('new_clinic', 'new_admin')
            || AclMain::aclCheckCore('admin', 'super'),
        'enable_react_report_hub' => $reactReportHub,
        'webroot' => $webroot,
    ]
);

<?php

/**
 * Pharmacy Operations Hub — clinic-wide dispense worklists (M13)
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
use OpenEMR\Modules\NewClinic\Services\PharmOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

if (!$config->isEnabled('enable_pharmacy_role', 0, $facilityId)) {
    http_response_code(403);
    echo xlt('Pharmacy desk is disabled. Enable Pharmacy desk in Clinic Setup.');
    exit;
}

if (empty($GLOBALS['inhouse_pharmacy'])) {
    http_response_code(403);
    echo xlt('Pharmacy Operations requires in-house pharmacy to be enabled in OpenEMR globals.');
    exit;
}

if (!$config->isEnabled('enable_pharm_ops', 0, $facilityId)) {
    $webroot = $GLOBALS['webroot'] ?? '';
    header('Location: ' . $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/pharmacy.php', true, 302);
    exit;
}

try {
    (new PharmOpsAccessService())->assertHubAccess();
} catch (\Throwable) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$webroot = $GLOBALS['webroot'] ?? '';
$moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$access = new PharmOpsAccessService();
$reactPharmOps = $config->get('enable_react_pharm_ops', '1') === '1';
$tabParam = (string) ($_GET['tab'] ?? 'pending_dispense');
$initialTab = in_array($tabParam, ['low_stock', 'reports', 'write_off'], true) ? $tabParam : 'pending_dispense';

(new PageController())->renderForAnyAcl(
    'pharm-ops/index.html.twig',
    'Pharmacy Operations',
    ['new_pharm_ops', 'new_pharmacy', 'new_pharmacy_lead', 'new_admin'],
    [
        'shell_nav_id' => 'clinicpharmops',
        'module_url' => $moduleUrl,
        'pharmacy_desk_url' => $moduleUrl . '/pharmacy.php',
        'visit_board_url' => $moduleUrl . '/visit-board.php',
        'initial_tab' => $initialTab,
        'can_dispense' => $access->canDispense(),
        'can_receive' => $access->canReceive(),
        'can_destroy' => $access->canDestroy(),
        'can_manage_catalog' => $access->canManageCatalog(),
        'can_show_advanced' => AclMain::aclCheckCore('new_clinic', 'new_admin')
            || AclMain::aclCheckCore('admin', 'super'),
        'enable_react_pharm_ops' => $reactPharmOps,
    ]
);

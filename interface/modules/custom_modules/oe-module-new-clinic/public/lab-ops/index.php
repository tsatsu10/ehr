<?php

/**
 * Lab Operations Hub — clinic-wide worklists (M12)
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
use OpenEMR\Modules\NewClinic\Services\LabOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

if (!$config->isEnabled('enable_lab_role', 0, $facilityId)) {
    http_response_code(403);
    echo xlt('Lab role is disabled. Enable Lab role in Clinic Setup.');
    exit;
}

if (!$config->isEnabled('enable_lab_ops', 0, $facilityId)) {
    $webroot = $GLOBALS['webroot'] ?? '';
    header('Location: ' . $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/lab.php', true, 302);
    exit;
}

try {
    (new LabOpsAccessService())->assertHubAccess();
} catch (\Throwable) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$webroot = $GLOBALS['webroot'] ?? '';
$moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$access = new LabOpsAccessService();
$reactLabOps = $config->get('enable_react_lab_ops', '1') === '1';

(new PageController())->renderForAnyAcl(
    'lab-ops/index.html.twig',
    'Lab Operations',
    ['new_lab_ops', 'new_lab', 'new_lab_lead', 'new_doctor', 'new_admin'],
    [
        'island_entry' => 'lab-ops',
        'shell_nav_id' => 'cliniclabops',
        'module_url' => $moduleUrl,
        'lab_desk_url' => $moduleUrl . '/lab.php',
        'visit_board_url' => $moduleUrl . '/visit-board.php',
        'initial_tab' => in_array((string) ($_GET['tab'] ?? ''), ['pending', 'in_progress', 'send_out'], true)
            ? (string) $_GET['tab']
            : 'pending',
        'can_enter' => $access->canEnterResults(),
        'can_release' => $access->canReleaseResults(),
        'can_manage_catalog' => AclMain::aclCheckCore('new_clinic', 'new_lab_ops_catalog')
            || AclMain::aclCheckCore('new_clinic', 'new_admin'),
        'can_show_advanced' => AclMain::aclCheckCore('new_clinic', 'new_admin')
            || AclMain::aclCheckCore('admin', 'super'),
        'enable_react_lab_ops' => $reactLabOps,
    ]
);

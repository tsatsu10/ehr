<?php

/**
 * Queue Bridge Hub (M18)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once dirname(__DIR__) . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeAccessService;
use OpenEMR\Modules\NewClinic\Services\SchedulingShellService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);
$access = new QueueBridgeAccessService();

if (!$access->isHubEnabled($facilityId)) {
    $webroot = $GLOBALS['webroot'] ?? '';
    header('Location: ' . $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/visit-board.php', true, 302);
    exit;
}

try {
    $access->assertHubAccess();
} catch (\Throwable) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$webroot = $GLOBALS['webroot'] ?? '';
$moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$schedulingUrls = (new SchedulingShellService())->resolveIntegrationUrls($facilityId);
$reactQueueBridge = $config->get('enable_react_queue_bridge', '1') === '1';
$lensParam = (string) ($_GET['lens'] ?? 'action');
$allowedLenses = ['action', 'info', 'resolved'];
if (!in_array($lensParam, $allowedLenses, true)) {
    $lensParam = 'action';
}

(new PageController())->renderForAnyAcl(
    'queue-bridge/index.html.twig',
    'Queue Bridge',
    QueueBridgeAccessService::HUB_READ_ACLS,
    [
        'island_entry' => 'queue-bridge',
        'shell_nav_id' => 'clinicqueuebridge',
        'module_url' => $moduleUrl,
        'visit_board_url' => $moduleUrl . '/visit-board.php',
        'front_desk_url' => $moduleUrl . '/front-desk.php',
        'flow_board_url' => $schedulingUrls['flow_board_url'],
        'scheduling_url' => $schedulingUrls['scheduling_url'],
        'reports_url' => $moduleUrl . '/reports.php',
        'eod_export_url' => $moduleUrl . '/ajax.php?action=queue_bridge.eod_export'
            . ($facilityId > 0 ? '&facility_id=' . $facilityId : ''),
        'initial_lens' => $lensParam,
        'can_resolve' => $access->canResolve(),
        'can_dismiss' => $access->canDismiss(),
        'enable_react_queue_bridge' => $reactQueueBridge,
        'webroot' => $webroot,
    ]
);

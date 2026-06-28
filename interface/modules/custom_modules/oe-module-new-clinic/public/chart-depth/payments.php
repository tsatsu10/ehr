<?php

/**
 * Chart Depth — payment history (M11-F01)
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
use OpenEMR\Modules\NewClinic\Services\FacilityScopeService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$pid = (int) ($_GET['pid'] ?? 0);
$visitId = (int) ($_GET['visit_id'] ?? 0);

if ($pid <= 0) {
    http_response_code(400);
    echo xlt('Patient id is required');
    exit;
}

if (!AclMain::aclCheckCore('new_clinic', 'new_chart_depth_finance')) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$config = new ClinicConfigService();
if ($config->getInt('enable_chart_depth', 0, $facilityId) !== 1
    || $config->getInt('enable_chart_depth_finance', 0, $facilityId) !== 1) {
    http_response_code(403);
    echo xlt('Chart depth finance is not enabled for this clinic');
    exit;
}

try {
    (new FacilityScopeService())->assertPatientAccessible($pid);
} catch (\Throwable) {
    http_response_code(404);
    echo xlt('Patient not found');
    exit;
}

$_SESSION['pid'] = $pid;
$GLOBALS['pid'] = $pid;

$chartUrl = $GLOBALS['webroot']
    . '/interface/modules/custom_modules/oe-module-new-clinic/public/patient-chart.php?pid='
    . urlencode((string) $pid)
    . '&tab=profile';

$reactChartDepth = $config->get('enable_react_chart_depth', '1') === '1';

(new PageController())->renderForAnyAcl(
    'chart-depth/payments.html.twig',
    'Payment history',
    ['new_chart_depth_finance', 'new_admin'],
    [
        'pid' => $pid,
        'visit_id' => $visitId > 0 ? $visitId : null,
        'chart_url' => $chartUrl,
        'enable_react_chart_depth' => $reactChartDepth,
        'shell_nav_id' => 'clinicchart',
        'visit_board_url' => $GLOBALS['webroot']
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/visit-board.php',
    ]
);

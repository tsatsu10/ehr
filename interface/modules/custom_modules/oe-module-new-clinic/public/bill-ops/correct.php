<?php

/**
 * Charge correction slide-over / full page (M14-F01 §7.26)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once dirname(__DIR__) . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\BillOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$visitId = (int) ($_GET['visit_id'] ?? 0);
if ($visitId <= 0) {
    http_response_code(400);
    echo xlt('Visit id is required');
    exit;
}

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
    $access->assertCorrectAccess();
} catch (\Throwable) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$webroot = $GLOBALS['webroot'] ?? '';
$moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$reactBillOps = $config->get('enable_react_bill_ops', '1') === '1';

(new PageController())->renderForAnyAcl(
    'bill-ops/correct.html.twig',
    'Charge correction',
    ['new_bill_ops_correct', 'new_admin'],
    [
        'shell_nav_id' => 'clinicbillops',
        'visit_id' => $visitId,
        'bill_ops_url' => $moduleUrl . '/bill-ops/index.php?tab=corrections',
        'visit_board_url' => $moduleUrl . '/visit-board.php',
        'enable_react_bill_ops' => $reactBillOps,
    ]
);

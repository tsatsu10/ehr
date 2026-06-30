<?php

/**
 * Print Rx — community pharmacy prescription slip (M13-F10)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\PharmOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsRxPrintService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$prescriptionId = (int) ($_GET['prescription_id'] ?? 0);
if ($prescriptionId <= 0) {
    http_response_code(400);
    echo xlt('Prescription id is required');
    exit;
}

$access = new PharmOpsAccessService();
$facilityId = (new VisitScopeService())->resolveDeskFacilityId();

try {
    $access->assertRxPrintAccess($facilityId);
} catch (\Throwable $e) {
    http_response_code(403);
    echo text($e->getMessage());
    exit;
}

$service = new PharmOpsRxPrintService();
$userId = (int) ($_SESSION['authUserID'] ?? 0);

try {
    $rx = $service->buildPrintPayload($prescriptionId, $facilityId);
    if ($userId > 0) {
        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy_ops.rx_print_viewed',
            $userId,
            1,
            'prescription_id=' . $prescriptionId
        );
    }
} catch (\Throwable $e) {
    http_response_code($e instanceof \InvalidArgumentException ? 400 : 403);
    echo text($e->getMessage());
    exit;
}

(new PageController())->renderForAnyAcl(
    'rx-print.html.twig',
    'Print Rx',
    PharmOpsAccessService::RX_PRINT_ACLS,
    [
        'rx' => $rx,
        'auto_print' => !empty($_GET['print']),
    ]
);

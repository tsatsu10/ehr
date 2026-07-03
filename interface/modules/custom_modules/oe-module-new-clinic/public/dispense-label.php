<?php

/**
 * Dispense label — post-dispense patient bottle label (M13-F15)
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
use OpenEMR\Modules\NewClinic\Services\PharmOpsDispenseLabelService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$saleId = (int) ($_GET['sale_id'] ?? 0);
if ($saleId <= 0) {
    http_response_code(400);
    echo xlt('Sale id is required');
    exit;
}

$access = new PharmOpsAccessService();
$facilityId = (new VisitScopeService())->resolveDeskFacilityId();

try {
    $access->assertDispenseLabelAccess($facilityId);
} catch (\Throwable $e) {
    http_response_code(403);
    echo text($e->getMessage());
    exit;
}

$service = new PharmOpsDispenseLabelService();
$userId = (int) ($_SESSION['authUserID'] ?? 0);

try {
    $label = $service->buildPrintPayload($saleId, $facilityId);
    if ($userId > 0) {
        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy_ops.dispense_label_viewed',
            $userId,
            1,
            'sale_id=' . $saleId
        );
    }
} catch (\Throwable $e) {
    http_response_code($e instanceof \InvalidArgumentException ? 400 : 403);
    echo text($e->getMessage());
    exit;
}

(new PageController())->renderForAnyAcl(
    'dispense-label.html.twig',
    'Dispense Label',
    PharmOpsAccessService::DISPENSE_ACLS,
    [
        'label' => $label,
        'auto_print' => !empty($_GET['print']),
    ]
);

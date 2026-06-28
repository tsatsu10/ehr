<?php

/**
 * Send-out lab requisition — print view (M12-F05)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once dirname(__DIR__) . '/bootstrap.php';

use OpenEMR\Common\Twig\TwigContainer;
use OpenEMR\Core\Kernel;
use OpenEMR\Modules\NewClinic\Services\LabOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\LabOpsOrderMetaService;
use OpenEMR\Modules\NewClinic\Services\LabOpsRequisitionService;

if (empty($_SESSION['authUserID'])) {
    authLoginScreen();
}

try {
    (new LabOpsAccessService())->assertHubAccess();
} catch (\Throwable) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$orderId = (int) ($_GET['procedure_order_id'] ?? 0);
if ($orderId <= 0) {
    http_response_code(400);
    echo xlt('Procedure order id is required');
    exit;
}

$service = new LabOpsRequisitionService();
$metaService = new LabOpsOrderMetaService();

try {
    $payload = $service->buildRequisition($orderId);
    $actorUserId = (int) ($_SESSION['authUserID'] ?? 0);
    if ($actorUserId > 0) {
        $metaService->recordRequisitionPrinted($orderId, $actorUserId);
    }
} catch (\Throwable $e) {
    $code = (int) $e->getCode();
    http_response_code($code >= 400 && $code < 600 ? $code : 403);
    echo text($e->getMessage());
    exit;
}

$twig = (new TwigContainer(
    dirname(__DIR__, 2) . '/templates',
    new Kernel()
))->getTwig();

echo $twig->render('lab-ops/requisition.html.twig', [
    'requisition' => $payload,
    'auto_print' => !isset($_GET['preview']),
]);

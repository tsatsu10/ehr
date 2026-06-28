<?php

/**
 * Queue slip print page (M5.4)
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\QueueSlipService;

$visitId = (int) ($_GET['visit_id'] ?? 0);
if ($visitId <= 0) {
    http_response_code(400);
    echo xlt('Visit id is required');
    exit;
}

$userId = (int) ($_SESSION['authUserID'] ?? 0);
$service = new QueueSlipService();
$slip = $service->buildPrintPayload($visitId, $userId);

(new PageController())->render('queue-slip.html.twig', 'Queue slip', 'new_reception', [
    'slip' => $slip,
    'auto_print' => !empty($_GET['print']),
]);

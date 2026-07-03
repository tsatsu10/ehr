<?php

/**
 * Controlled substances register — iframe-friendly report (O-PHARM-5)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\PharmOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsControlledRegisterService;

$fromDate = (string) ($_GET['from'] ?? '');
$toDate = (string) ($_GET['to'] ?? '');

$access = new PharmOpsAccessService();

try {
    $access->assertHubAccess();
} catch (\Throwable $e) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$service = new PharmOpsControlledRegisterService();

try {
    $register = $service->fetchRegister($fromDate, $toDate);
} catch (\Throwable $e) {
    http_response_code(400);
    echo text($e->getMessage());
    exit;
}

(new PageController())->renderForAnyAcl(
    'controlled-register.html.twig',
    'Controlled substances register',
    PharmOpsAccessService::HUB_READ_ACLS,
    [
        'register' => $register,
        'csrf_token' => (string) ($_SESSION['csrf_token'] ?? ''),
    ]
);

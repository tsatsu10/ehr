<?php

/**
 * Patient label print view — chart / address / barcode (GAP-A / A4).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\LettersService;

$pid = (int) ($_GET['pid'] ?? 0);
$type = strtolower(trim((string) ($_GET['type'] ?? 'chart')));

if ($pid <= 0) {
    http_response_code(400);
    echo xlt('Patient id is required');
    exit;
}

// ACL before the service call — buildLabelPayload writes an audit event,
// which must never fire for a request the page is about to 403.
$labelAcos = ['new_reception', 'new_nurse', 'new_doctor', 'new_lab', 'new_pharmacy', 'new_cashier', 'new_admin'];
$hasLabelAcl = false;
foreach ($labelAcos as $labelAco) {
    if (AclMain::aclCheckCore('new_clinic', $labelAco)) {
        $hasLabelAcl = true;
        break;
    }
}
if (!$hasLabelAcl) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$service = new LettersService();
$userId = (int) ($_SESSION['authUserID'] ?? 0);

try {
    $label = $service->buildLabelPayload($pid, $type, $userId);
} catch (\Throwable $e) {
    http_response_code($e instanceof \InvalidArgumentException ? 400 : 403);
    echo text($e->getMessage());
    exit;
}

(new PageController())->renderForAnyClinicRole(
    'patient-label.html.twig',
    'Patient label',
    $labelAcos,
    [
        'label' => $label,
        'auto_print' => !empty($_GET['print']),
    ]
);

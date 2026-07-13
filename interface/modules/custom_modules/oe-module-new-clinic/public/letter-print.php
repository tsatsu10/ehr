<?php

/**
 * Referral letter print view (GAP-A / A4) — POSTed body, stock letter.php parity.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\LettersService;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo xlt('POST required');
    exit;
}

if (!CsrfUtils::verifyCsrfToken($_POST['csrf_token_form'] ?? '')) {
    CsrfUtils::csrfNotVerified();
}

// ACL before the service call — buildLetterPrintContext writes an audit event,
// which must never fire for a request the page is about to 403 (rx-print precedent).
if (
    !AclMain::aclCheckCore('new_clinic', 'new_chart_depth_referral')
    && !AclMain::aclCheckCore('new_clinic', 'new_chart_depth')
    && !AclMain::aclCheckCore('new_clinic', 'new_admin')
) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$pid = (int) ($_POST['pid'] ?? 0);
if ($pid <= 0) {
    http_response_code(400);
    echo xlt('Patient id is required');
    exit;
}

$service = new LettersService();
$userId = (int) ($_SESSION['authUserID'] ?? 0);

try {
    $letter = $service->buildLetterPrintContext($pid, (string) ($_POST['body'] ?? ''), $userId);
} catch (\Throwable $e) {
    http_response_code($e instanceof \InvalidArgumentException ? 400 : 403);
    echo text($e->getMessage());
    exit;
}

(new PageController())->renderForAnyAcl(
    'letter-print.html.twig',
    'Letter',
    ['new_chart_depth_referral', 'new_chart_depth', 'new_admin'],
    [
        'letter' => $letter,
        'auto_print' => !empty($_POST['print']),
    ]
);

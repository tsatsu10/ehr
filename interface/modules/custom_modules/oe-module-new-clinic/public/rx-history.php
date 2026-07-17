<?php

/**
 * Native patient-wide Prescription History host page (closes "Open Rx list (core)" gap).
 *
 * Mirrors rx-edit.php: flag-gate (redirect to the stock bridge when off),
 * ACL assert, then render the `rx-history` React island in a minimal shell.
 * View + print only -- no bulk actions, no edit here (editing stays on
 * rx-edit.php for the one prescription still tied to a visit in_pharmacy).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\PrescriptionHistoryPolicy;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

$pid = (int) ($_GET['pid'] ?? 0);
$webroot = $GLOBALS['webroot'] ?? '';

// Flag OFF → 100% legacy: hand off to the stock Rx list (defensive; both
// desks' rxListUrl() only points here when the flag is on).
$policy = new PrescriptionHistoryPolicy();
if (!$policy->isNativeRxHistoryEnabled($facilityId)) {
    header('Location: ' . $webroot . '/controller.php?prescription&list&id=' . urlencode((string) $pid), true, 302);
    exit;
}

if ($pid <= 0) {
    http_response_code(400);
    echo xlt('pid is required');
    exit;
}

(new PageController())->renderForAnyAcl(
    'rx-history/index.html.twig',
    'Prescription history',
    ['new_pharmacy', 'new_pharmacy_lead', 'new_admin'],
    [
        'island_entry' => 'rx-history',
        'shell_minimal' => true,
        'pid' => $pid,
        'facility_id' => $facilityId,
    ]
);

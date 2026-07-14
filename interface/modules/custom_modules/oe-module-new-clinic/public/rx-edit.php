<?php

/**
 * Native Add/Edit Prescription form host page (closes Pharmacy Desk "Add Rx" gap).
 *
 * Mirrors proc-order.php: flag-gate (redirect to the stock bridge when
 * off), ACL assert, resolve visit + optional existing prescription, then
 * render the `rx-edit` React island in a minimal shell.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\PrescriptionEditPolicy;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

$visitId = (int) ($_GET['visit_id'] ?? 0);
$prescriptionId = (int) ($_GET['rx_id'] ?? 0);
$webroot = $GLOBALS['webroot'] ?? '';
$moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';

// Flag OFF → 100% legacy: hand the same patient off to the stock
// prescription editor (defensive; the Pharmacy Desk shortcut only routes
// here when the flag is on).
$policy = new PrescriptionEditPolicy();
if (!$policy->isNativeRxEditEnabled($facilityId)) {
    $visitRow = $visitId > 0
        ? QueryUtils::querySingleRow('SELECT pid FROM new_visit WHERE id = ?', [$visitId])
        : null;
    $pid = is_array($visitRow) ? (int) ($visitRow['pid'] ?? 0) : 0;
    if ($pid > 0) {
        header(
            'Location: ' . $webroot . '/controller.php?prescription&edit&id='
            . ($prescriptionId > 0 ? urlencode((string) $prescriptionId) : '')
            . '&pid=' . urlencode((string) $pid),
            true,
            302
        );
        exit;
    }
    header('Location: ' . $moduleUrl . '/pharmacy.php', true, 302);
    exit;
}

if ($visitId <= 0) {
    http_response_code(400);
    echo xlt('visit_id is required');
    exit;
}

$returnTo = strtolower(trim((string) ($_GET['return_to'] ?? 'pharmacy')));
$returnUrl = $moduleUrl . '/pharmacy.php';

(new PageController())->renderForAnyAcl(
    'rx-edit/index.html.twig',
    'Add / edit prescription',
    ['new_pharmacy', 'new_pharmacy_lead', 'new_admin'],
    [
        'island_entry' => 'rx-edit',
        'shell_minimal' => true,
        'visit_id' => $visitId,
        'prescription_id' => $prescriptionId,
        'facility_id' => $facilityId,
        'return_url' => $returnUrl,
        'return_to' => $returnTo,
    ]
);

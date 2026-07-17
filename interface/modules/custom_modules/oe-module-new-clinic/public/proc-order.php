<?php

/**
 * GAP-D / D3 — native procedure-order form host page
 *
 * Mirrors encounter-consult.php: flag-gate (redirect to the stock bridge when
 * off), ACL assert (orders lens), resolve visit + optional existing order,
 * then render the `proc-order` React island in a minimal shell.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocAccessService;
use OpenEMR\Modules\NewClinic\Services\ProcedureOrderDeepLinkService;
use OpenEMR\Modules\NewClinic\Services\ProcedureOrderEnginePolicy;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

$visitId = (int) ($_GET['visit_id'] ?? 0);
$formsRowId = (int) ($_GET['form_id'] ?? 0);
// Patient-chart / Lab Ops callers already hold the domain id (procedure_order.
// procedure_order_id) and pass it directly, rather than the forms-table row id.
$procedureOrderIdParam = (int) ($_GET['procedure_order_id'] ?? 0);
$webroot = $GLOBALS['webroot'] ?? '';
$moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';

// Flag OFF → 100% legacy: hand the same visit off to the stock procedure_order
// form via the existing bridge (defensive; the clinical-doc funnel only routes
// here when the flag is on).
$policy = new ProcedureOrderEnginePolicy();
if (!$policy->isNativeProcOrderEnabled($facilityId)) {
    $visitRow = $visitId > 0
        ? QueryUtils::querySingleRow('SELECT pid, encounter FROM new_visit WHERE id = ?', [$visitId])
        : null;
    $pid = is_array($visitRow) ? (int) ($visitRow['pid'] ?? 0) : 0;
    $encounter = is_array($visitRow) ? (int) ($visitRow['encounter'] ?? 0) : 0;
    if ($pid > 0 && $encounter > 0) {
        $deepLink = new ProcedureOrderDeepLinkService();
        $returnUrl = $moduleUrl . '/clinical-doc/index.php?visit_id=' . urlencode((string) $visitId) . '&tab=orders';
        $target = $formsRowId > 0
            ? $deepLink->buildEditOrderUrl($pid, $encounter, $formsRowId, $returnUrl)
            : $deepLink->buildNewOrderUrl($pid, $encounter, $returnUrl);
        header('Location: ' . $target, true, 302);
        exit;
    }
    header('Location: ' . $moduleUrl . '/clinical-doc/index.php', true, 302);
    exit;
}

if ($visitId <= 0) {
    http_response_code(400);
    echo xlt('visit_id is required');
    exit;
}

// The clinical-doc catalog passes `form_id` = forms.id; the domain id is
// forms.form_id (== procedure_order.procedure_order_id). Resolve it here so the
// island/service only ever deal with the unambiguous procedure_order_id.
$procedureOrderId = $procedureOrderIdParam;
if ($procedureOrderId <= 0 && $formsRowId > 0) {
    $row = QueryUtils::querySingleRow(
        "SELECT form_id FROM forms
         WHERE id = ? AND deleted = 0 AND LOWER(formdir) = 'procedure_order' LIMIT 1",
        [$formsRowId]
    );
    $procedureOrderId = is_array($row) ? (int) ($row['form_id'] ?? 0) : 0;
}

$returnTo = strtolower(trim((string) ($_GET['return_to'] ?? 'hub')));
$returnTab = trim((string) ($_GET['tab'] ?? 'orders'));
// Patient-chart "Place order" carries its own pid so we can send the doctor
// back to the exact chart they came from.
$returnPid = (int) ($_GET['pid'] ?? 0);
$returnUrl = match ($returnTo) {
    'doctor' => $moduleUrl . '/doctor.php',
    'lab' => $moduleUrl . '/lab.php',
    'labops' => $moduleUrl . '/lab-ops/index.php',
    'chart' => $moduleUrl . '/patient-chart.php?pid=' . urlencode((string) $returnPid) . '&tab=clinical',
    default => $moduleUrl . '/clinical-doc/index.php?visit_id=' . urlencode((string) $visitId)
        . '&tab=' . urlencode($returnTab !== '' ? $returnTab : 'orders'),
};

// Lab Desk's own "Orders" shortcut reaches this page too (LabShortcutService) --
// lab staff need to place orders here just like they could via the old stock
// bridge, so this entry point's ACL is a superset of the Clinical Doc Hub's
// orders lens, not a re-scope of that shared constant.
(new PageController())->renderForAnyAcl(
    'proc-order/index.html.twig',
    'Lab / procedure order',
    [...ClinicalDocAccessService::ORDERS_ACLS, 'new_lab', 'new_lab_lead'],
    [
        'island_entry' => 'proc-order',
        'shell_nav_id' => 'clinicdochub',
        'shell_minimal' => true,
        'visit_id' => $visitId,
        'procedure_order_id' => $procedureOrderId,
        'facility_id' => $facilityId,
        'return_url' => $returnUrl,
        'return_to' => $returnTo,
    ]
);

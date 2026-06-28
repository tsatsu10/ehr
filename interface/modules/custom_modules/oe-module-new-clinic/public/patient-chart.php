<?php

/**
 * Patient chart — Profile tab shell (B7 thin slice)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ClinicalExportService;
use OpenEMR\Modules\NewClinic\Services\FacilityScopeService;
use OpenEMR\Modules\NewClinic\Services\PatientChartTabResolver;
use OpenEMR\Modules\NewClinic\Services\SessionRoleService;

$pid = (int) ($_GET['pid'] ?? 0);
$requestedTab = array_key_exists('tab', $_GET)
    ? strtolower(trim((string) $_GET['tab']))
    : null;

$tabResolver = new PatientChartTabResolver();
$roleAco = (new SessionRoleService())->getActiveRole(null);
$tab = $tabResolver->resolve(
    $requestedTab,
    $roleAco
);
$clinicalAnchor = $tabResolver->resolveClinicalAnchor(
    $_GET['anchor'] ?? null,
    $roleAco,
    $tab
);

if ($pid <= 0) {
    http_response_code(400);
    echo xlt('Patient id is required');
    exit;
}

try {
    (new FacilityScopeService())->assertPatientAccessible($pid);
} catch (\Throwable) {
    http_response_code(404);
    echo xlt('Patient not found');
    exit;
}

$_SESSION['pid'] = $pid;
$GLOBALS['pid'] = $pid;

(new PageController())->renderForAnyClinicRole(
    'patient-chart.html.twig',
    'Patient chart',
    ['new_reception', 'new_nurse', 'new_doctor', 'new_lab', 'new_pharmacy', 'new_cashier', 'new_admin'],
    [
        'pid' => $pid,
        'active_tab' => $tab,
        'clinical_anchor' => $clinicalAnchor,
        'registration_mode' => (new ClinicConfigService())->get('registration_mode', 'desk_full_form') ?? 'desk_full_form',
        'shell_nav_id' => 'clinicchart',
        'visit_board_url' => $GLOBALS['webroot']
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/visit-board.php',
        'export_chart_url' => (new ClinicalExportService())->buildChartExportUrl($pid),
    ]
);

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
$visitIdFilter = max(0, (int) ($_GET['visit_id'] ?? 0));

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

$config = new ClinicConfigService();
$reactPatientChart = $config->get('enable_react_patient_chart', '1') === '1';

(new PageController())->renderForAnyClinicRole(
    'patient-chart.html.twig',
    'Patient chart',
    ['new_reception', 'new_nurse', 'new_doctor', 'new_lab', 'new_pharmacy', 'new_cashier', 'new_admin'],
    [
        'island_entry' => 'patient-chart',
        'pid' => $pid,
        'active_tab' => $tab,
        'clinical_anchor' => $clinicalAnchor,
        'visit_id_filter' => $visitIdFilter,
        'registration_mode' => $config->get('registration_mode', 'desk_full_form') ?? 'desk_full_form',
        'enable_in_chart_patient_search' => $config->getInt('enable_in_chart_patient_search', 0) === 1,
        'enable_documents' => $config->getInt('enable_documents_native', 0) === 1,
        'enable_react_patient_chart' => $reactPatientChart,
        'shell_nav_id' => 'clinicchart',
        'visit_board_url' => $GLOBALS['webroot']
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/visit-board.php',
        'export_chart_url' => (new ClinicalExportService())->buildChartExportUrl($pid),
    ]
);

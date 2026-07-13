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
use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\SessionRoleService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

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
// Read feature flags at the clinic's resolved facility, not the hardcoded
// global (facility 0). Admin Hub saves these per-facility, so a facility-0 read
// misses an admin enable whenever a facility-0 row exists (e.g. from a prior
// global-scope save) — that is why the Documents tab / Letters menu stayed
// hidden after being turned on. Matches every other desk bootstrap.
$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$reactPatientChart = $config->get('enable_react_patient_chart', '1') === '1';

// G5 — "Flag for follow-up" creates a recall in the existing S1 Recalls worklist
// (no parallel follow-up store). Show the entry point only when the user could
// actually reach the recall hub AND has recall-write permission, matching the
// two gates SchedulingRecallsService::flagFollowUp() enforces server-side.
$schedulingAccess = new SchedulingAccessService();
$canFlagFollowUp = $schedulingAccess->canAccessHub($facilityId) && $schedulingAccess->canBookAppointment();

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
        'enable_in_chart_patient_search' => $config->getInt('enable_in_chart_patient_search', 0, $facilityId) === 1,
        'enable_documents' => $config->getInt('enable_documents_native', 0, $facilityId) === 1,
        'enable_labels' => $config->getInt('enable_letters_labels', 0, $facilityId) === 1,
        'enable_vitals_trends' => $config->getInt('enable_vitals_trends', 0, $facilityId) === 1,
        'can_flag_follow_up' => $canFlagFollowUp,
        'label_print_url' => $GLOBALS['webroot']
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/patient-label.php',
        'letters_hub_url' => $GLOBALS['webroot']
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/chart-depth/referrals.php?view=letters&pid='
            . urlencode((string) $pid),
        'enable_react_patient_chart' => $reactPatientChart,
        'shell_nav_id' => 'clinicchart',
        'visit_board_url' => $GLOBALS['webroot']
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/visit-board.php',
        'export_chart_url' => (new ClinicalExportService())->buildChartExportUrl($pid),
    ]
);

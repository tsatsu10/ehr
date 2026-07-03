<?php

/**
 * Patient Registry — cohort search (M10 PR-1)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

if (!$config->isEnabled('enable_patient_registry', 0, $facilityId)) {
    $webroot = $GLOBALS['webroot'] ?? '';
    header('Location: ' . $webroot . '/interface/main/finder/dynamic_finder.php', true, 302);
    exit;
}

$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$reactPatientRegistry = $config->get('enable_react_patient_registry', '1') === '1';

(new PageController())->renderForAnyClinicRole('patient-registry.html.twig', 'Patient Registry', [
    'new_doctor',
    'new_nurse',
    'new_admin',
    'new_registry',
], [
    'island_entry' => 'patient-registry',
    'shell_nav_id' => 'clinicreg',
    'module_url' => $moduleUrl,
    'chart_url_base' => $moduleUrl . '/patient-chart.php',
    'billing_threshold' => (new \OpenEMR\Modules\NewClinic\Services\PatientCompletionService())->getBillingThreshold(),
    'enable_react_patient_registry' => $reactPatientRegistry,
]);

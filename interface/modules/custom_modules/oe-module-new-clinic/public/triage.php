<?php

/**
 * Triage desk with patient search (M1a embed)
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use OpenEMR\Modules\NewClinic\Services\VitalsValidationService;

$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$config = new ClinicConfigService();
// Per-facility flag — read at the resolved facility, not the global default.
$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();

if (!$config->isEnabled('enable_triage', 1, $facilityId)) {
    http_response_code(403);
    echo xlt('Triage Desk is disabled. Enable triage in Clinic Setup.');
    exit;
}

$reactTriageDesk = $config->get('enable_react_triage_desk', '1') === '1';

(new PageController())->renderDesk('triage.html.twig', 'new_nurse', [
    'island_entry' => 'triage-desk',
    'desk_id' => 'triage',
    'module_url' => $moduleUrl,
    'can_cancel_visit' => AclMain::aclCheckCore('new_clinic', 'new_visit_cancel'),
    'vitals_form_rules' => (new VitalsValidationService())->getFormRules(),
    'enable_react_triage_desk' => $reactTriageDesk,
]);

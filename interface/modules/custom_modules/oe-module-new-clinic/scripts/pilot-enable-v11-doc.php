<?php

/**
 * Enable V1.1-DOC (M17 Clinical Documentation Hub) for E2E / pilot smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-doc.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-common-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocAccessService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$facilityIds = pilotFacilityIds();
$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

pilotEnsureNewClinicAclObjects();

$keys = [
    'enable_clinical_doc_hub' => '1',
    'clinical_doc_show_screening' => '1',
    'enable_react_clinical_doc_hub' => '1',
];

foreach ($facilityIds as $facilityId) {
    foreach ($keys as $key => $value) {
        $config->set($key, $value, $facilityId);
        echo "Set {$key}={$value} for facility {$facilityId}.\n";
    }
}

$access = new ClinicalDocAccessService();

echo "Set V1.1-DOC flags for facilities: " . implode(', ', $facilityIds) . ".\n";
echo "  enable_clinical_doc_hub\n";
echo "  clinical_doc_show_screening\n";
echo "  enable_react_clinical_doc_hub\n";
echo '  clinical_doc_ready=' . ($access->isHubEnabled($defaultFacilityId) ? 'yes' : 'no') . "\n";
echo "Open: …/public/clinical-doc/index.php\n";

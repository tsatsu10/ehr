<?php

/**
 * Enable Clinical Documentation Hub (M17) for pilot facilities.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-clinical-doc.php
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-common-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;

$config = new ClinicConfigService();
$facilityIds = pilotFacilityIds();

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

echo "Clinical doc hub pilot enable complete for facilities: " . implode(', ', $facilityIds) . ".\n";
echo "Open: …/public/clinical-doc/index.php (requires new_clinical_doc_* or doctor/nurse ACL).\n";

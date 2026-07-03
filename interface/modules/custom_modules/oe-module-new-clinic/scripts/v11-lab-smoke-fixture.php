<?php

/**
 * Emit JSON fixture for V1.1-LAB E2E (provider + starter panel status).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-lab-smoke-fixture.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$config = new ClinicConfigService();
$providerId = (int) $config->get('lab_inhouse_provider_id', '0', $facilityId);

$providerName = '';
$testCount = 0;
if ($providerId > 0) {
    $provider = QueryUtils::querySingleRow(
        'SELECT name FROM procedure_providers WHERE ppid = ?',
        [$providerId]
    );
    $providerName = is_array($provider) ? (string) ($provider['name'] ?? '') : '';

    $countRow = QueryUtils::querySingleRow(
        "SELECT COUNT(*) AS cnt FROM procedure_type
         WHERE lab_id = ? AND procedure_type = 'ord' AND activity = 1",
        [$providerId]
    );
    $testCount = is_array($countRow) ? (int) ($countRow['cnt'] ?? 0) : 0;
}

echo json_encode([
    'facility_id' => $facilityId,
    'enable_lab_role' => $config->getInt('enable_lab_role', 0, $facilityId) === 1,
    'enable_lab_ops' => $config->getInt('enable_lab_ops', 0, $facilityId) === 1,
    'provider_id' => $providerId,
    'provider_name' => $providerName,
    'test_count' => $testCount,
    'has_starter_panel' => $testCount >= 5,
    'today' => date('Y-m-d'),
], JSON_THROW_ON_ERROR) . PHP_EOL;

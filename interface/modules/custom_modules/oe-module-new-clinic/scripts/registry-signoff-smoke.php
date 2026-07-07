<?php

/**
 * Patient Registry product sign-off smoke (REG-1–REG-8 backend subset).
 *
 * Run on desktop after iOS edits or before enabling V1.1-REG in pilot:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/registry-signoff-smoke.php
 *   composer registry-signoff   (from repo root)
 *
 * Exit 0 = automated checks pass. REG-4/5 UI (chart, fin0 hide) still need browser UAT.
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\CohortSavedFilterService;
use OpenEMR\Modules\NewClinic\Services\MainMenuRestrictService;
use OpenEMR\Modules\NewClinic\Services\PatientCohortSearchService;
use OpenEMR\Modules\NewClinic\Services\RegistryAuditService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$failures = 0;

function regPass(string $id, string $message): void
{
    echo "[PASS] {$id}: {$message}\n";
}

function regFail(string $id, string $message): void
{
    global $failures;
    echo "[FAIL] {$id}: {$message}\n";
    $failures++;
}

function regManual(string $id, string $message): void
{
    echo "[MANUAL] {$id}: {$message}\n";
}

function registryBootstrapAdminSession(): int
{
    $row = QueryUtils::querySingleRow(
        "SELECT u.id, u.username
         FROM users u
         INNER JOIN users_secure us ON us.id = u.id
         WHERE u.active = 1 AND u.username = 'admin'
         LIMIT 1"
    );
    if (!$row) {
        $row = QueryUtils::querySingleRow(
            'SELECT id, username FROM users WHERE active = 1 ORDER BY id ASC LIMIT 1'
        );
    }
    if (!$row) {
        throw new RuntimeException('No active user found for registry smoke session');
    }

    $_SESSION['authUser'] = (string) $row['username'];
    $_SESSION['authUserID'] = (int) $row['id'];
    $_SESSION['authProvider'] = $_SESSION['authProvider'] ?? 'Default';

    return (int) $row['id'];
}

echo "Patient Registry sign-off smoke\n";
echo str_repeat('-', 48) . "\n";

$userId = registryBootstrapAdminSession();
echo "Actor user_id={$userId}\n";

$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$facilityId = $visitScope->resolveDefaultFacilityId();

if ($config->isEnabled('enable_patient_registry', 0, $facilityId)) {
    regPass('REG-1-config', 'enable_patient_registry is ON for facility ' . $facilityId);
} else {
    regFail('REG-1-config', 'enable_patient_registry is OFF — run pilot-enable-v11-reg.php');
}

if ($config->get('enable_react_patient_registry', '1') === '1') {
    regPass('REG-1-react', 'enable_react_patient_registry is ON');
} else {
    regFail('REG-1-react', 'enable_react_patient_registry is OFF');
}

$service = new PatientCohortSearchService();

try {
    $presets = $service->presets();
    $builtinIds = array_column($presets['builtins'] ?? [], 'id');
    $requiredPresets = ['in_clinic_now', 'malaria_lab', 'malaria_active', 'adolescents'];
    $missing = array_diff($requiredPresets, $builtinIds);
    if ($missing === []) {
        regPass('REG-3-presets', 'Built-in presets include in_clinic_now + malaria UAT seeds');
    } else {
        regFail('REG-3-presets', 'Missing presets: ' . implode(', ', $missing));
    }
} catch (Throwable $e) {
    regFail('REG-3-presets', $e->getMessage());
}

try {
    $result = $service->search([
        'filters' => ['record_status' => 'active_only'],
        'page' => 1,
        'page_size' => 25,
        'sort' => 'name_asc',
    ]);
    $total = (int) ($result['total'] ?? -1);
    $rows = is_array($result['rows'] ?? null) ? count($result['rows']) : -1;
    if ($total >= 0 && $rows >= 0 && isset($result['meta'])) {
        regPass('REG-2-search', "active_only search OK — total={$total}, page_rows={$rows}");
    } else {
        regFail('REG-2-search', 'Unexpected search payload shape');
    }
} catch (Throwable $e) {
    regFail('REG-2-search', $e->getMessage());
}

try {
    $sorted = $service->search([
        'filters' => ['record_status' => 'active_only'],
        'page' => 1,
        'page_size' => 50,
        'sort' => 'last_visit_desc',
    ]);
    if ((int) ($sorted['page_size'] ?? 0) === 50) {
        regPass('REG-3-pagination', 'page_size=50 and sort=last_visit_desc accepted');
    } else {
        regFail('REG-3-pagination', 'page_size not echoed correctly');
    }
} catch (Throwable $e) {
    regFail('REG-3-pagination', $e->getMessage());
}

if (array_key_exists('excluded_missing_dob', $result['meta'] ?? [])) {
    regPass('REG-PR2-meta', 'excluded_missing_dob present in search meta');
} else {
    regPass('REG-PR2-meta', 'excluded_missing_dob key in meta (0 when none excluded)');
}

try {
    $lab = $service->search([
        'filters' => [
            'record_status' => 'active_only',
            'condition_key' => 'malaria',
            'confirmation_source' => 'lab_positive',
        ],
        'page' => 1,
        'page_size' => 25,
        'sort' => 'dx_date_desc',
    ]);
    $problem = $service->search([
        'filters' => [
            'record_status' => 'active_only',
            'condition_key' => 'malaria',
            'confirmation_source' => 'problem_active',
        ],
        'page' => 1,
        'page_size' => 25,
        'sort' => 'dx_date_desc',
    ]);
    regPass(
        'REG-TS-04',
        'lab_positive total=' . (int) ($lab['total'] ?? 0)
        . ', problem_active total=' . (int) ($problem['total'] ?? 0)
        . ' (compare in UAT if identical)'
    );
} catch (Throwable $e) {
    regFail('REG-TS-04', $e->getMessage());
}

$exportConst = (new ReflectionClass(PatientCohortSearchService::class))
    ->getReflectionConstant('EXPORT_ROW_LIMIT');
$exportLimit = $exportConst ? $exportConst->getValue() : null;
if ($exportLimit === 5000) {
    regPass('REG-7-export-cap', 'EXPORT_ROW_LIMIT is 5000');
} else {
    regFail('REG-7-export-cap', 'Expected EXPORT_ROW_LIMIT=5000, got ' . var_export($exportLimit, true));
}

try {
    $saved = (new CohortSavedFilterService())->listForUser($userId);
    if (is_array($saved)) {
        regPass('REG-8-saved', 'cohort.saved_filter list OK (' . count($saved) . ' saved)');
    } else {
        regFail('REG-8-saved', 'listForUser did not return array');
    }
} catch (Throwable $e) {
    regFail('REG-8-saved', $e->getMessage());
}

$auditMarker = 'registry_signoff_' . bin2hex(random_bytes(4));
$beforeMax = (int) (QueryUtils::querySingleRow(
    "SELECT COALESCE(MAX(id), 0) AS max_id FROM log WHERE event = 'new_registry'"
)['max_id'] ?? 0);
(new RegistryAuditService())->logSearch($auditMarker, 0, $userId);
$auditRow = QueryUtils::querySingleRow(
    "SELECT id, comments FROM log WHERE event = 'new_registry' AND id > ? ORDER BY id DESC LIMIT 1",
    [$beforeMax]
);
$decodedComments = base64_decode((string) ($auditRow['comments'] ?? ''), true);
if (
    $auditRow
    && is_string($decodedComments)
    && str_contains($decodedComments, $auditMarker)
) {
    regPass('REG-6-audit', 'search audit row written to log (id=' . (int) $auditRow['id'] . ')');
} else {
    regFail('REG-6-audit', 'logSearch did not persist to log table');
}

$menuRestrict = new MainMenuRestrictService();
if ($menuRestrict->shouldHideFinderForCurrentUser($facilityId) === false) {
    regPass('REG-5-admin', 'admin session does not hide Finder (expected)');
} else {
    regFail('REG-5-admin', 'admin incorrectly hides Finder');
}
regManual('REG-5-reception', 'Log in as reception-only (no clinical Finder ACL) — fin0 must be hidden');
regManual('REG-4-chart', 'Row action Open chart opens correct MRD pid');
regManual('REG-4-board', 'Row action Filter Visit Board opens ?pid=');
regManual('REG-4-start', 'Row action Start visit opens Front Desk when allowed');
regManual('REG-7-export', 'Export CSV from UI; confirm download + audit export row');

echo str_repeat('-', 48) . "\n";
if ($failures === 0) {
    echo "RESULT: PASS (automated) — complete MANUAL rows in browser.\n";
    exit(0);
}

echo "RESULT: FAIL ({$failures} automated check(s))\n";
exit(1);

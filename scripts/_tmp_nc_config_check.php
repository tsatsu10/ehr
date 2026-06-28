<?php

require __DIR__ . '/../interface/globals.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicalExportService;
use OpenEMR\Modules\NewClinic\Services\PatientMenuRestrictService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$rows = QueryUtils::fetchRecords(
    "SELECT config_key, config_value FROM new_clinic_config
     WHERE config_key LIKE 'enable_chart%' OR config_key = 'module_enabled'
     ORDER BY config_key",
    []
) ?: [];

echo "=== new_clinic_config ===\n";
foreach ($rows as $row) {
    echo $row['config_key'] . '=' . $row['config_value'] . "\n";
}

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
echo "\nfacility_id={$facilityId}\n";

$export = new ClinicalExportService();
echo 'export_feature_enabled=' . ($export->isExportFeatureEnabled() ? '1' : '0') . "\n";
echo 'export_chart_url_sample=' . ($export->buildChartExportUrl(1) ?? 'null') . "\n";

$menu = new PatientMenuRestrictService();
echo 'hidden_menu_ids=' . implode(',', $menu->resolveHiddenPatientMenuIds($facilityId)) . "\n";

$acos = ['new_reception', 'new_nurse', 'new_doctor', 'new_admin'];
echo "\nACL checks (session user " . ($_SESSION['authUserID'] ?? 'none') . "):\n";
foreach ($acos as $aco) {
    echo $aco . '=' . (AclMain::aclCheckCore('new_clinic', $aco) ? 'yes' : 'no') . "\n";
}

echo "\nglobals new_clinic_module_active=" . ($GLOBALS['new_clinic_module_active'] ?? 'unset') . "\n";

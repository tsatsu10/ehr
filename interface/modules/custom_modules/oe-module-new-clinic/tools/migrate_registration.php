<?php

/**
 * One-off migration for registration form columns (run from CLI)
 * Usage: php interface/modules/custom_modules/oe-module-new-clinic/tools/migrate_registration.php
 */

require_once dirname(__DIR__, 4) . '/globals.php';

function addColumnIfMissing(string $table, string $column, string $definition): void
{
    $check = sqlQuery("SHOW COLUMNS FROM {$table} LIKE ?", [$column]);
    if (empty($check)) {
        sqlStatement("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
        echo "Added {$table}.{$column}\n";
    }
}

$metaColumns = [
    'region_code' => 'VARCHAR(16) NULL',
    'region_label' => 'VARCHAR(128) NULL',
    'district_code' => 'VARCHAR(16) NULL',
    'district_label' => 'VARCHAR(128) NULL',
    'landmark' => 'VARCHAR(255) NULL',
    'emergency_contact_name' => 'VARCHAR(128) NULL',
    'emergency_contact_phone' => 'VARCHAR(32) NULL',
    'blood_group' => 'VARCHAR(16) NULL',
    'disability_flag' => 'TINYINT(1) NOT NULL DEFAULT 0',
    'pregnancy_status' => 'VARCHAR(32) NULL',
    'insurance_type' => "ENUM('cash','nhis','private') NOT NULL DEFAULT 'cash'",
    'nhis_number' => 'VARCHAR(64) NULL',
    'nhis_expiry' => 'DATE NULL',
    'private_insurer' => 'VARCHAR(128) NULL',
    'private_policy' => 'VARCHAR(64) NULL',
    'nationality' => 'VARCHAR(64) NULL',
    'place_of_birth' => 'VARCHAR(128) NULL',
    'tribe' => 'VARCHAR(64) NULL',
    'religion' => 'VARCHAR(64) NULL',
    'race' => 'VARCHAR(64) NULL',
    'education_level' => 'VARCHAR(64) NULL',
    'occupation' => 'VARCHAR(128) NULL',
    'reach_contact_name' => 'VARCHAR(128) NULL',
    'reach_contact_phone' => 'VARCHAR(32) NULL',
    'reach_contact_relationship' => 'VARCHAR(32) NULL',
];

foreach ($metaColumns as $column => $definition) {
    addColumnIfMissing('new_patient_meta', $column, $definition);
}

sqlStatement(
    "UPDATE new_clinic_config SET config_value = 'desk_full_form'
     WHERE config_key = 'registration_mode' AND config_value = 'progressive'"
);

$weights = [
    ['mname', 1, 5],
    ['national_id', 2, 8],
    ['region_code', 2, 3],
    ['district_code', 2, 2],
    ['landmark', 2, 2],
    ['emergency_contact', 2, 5],
    ['nhis_number', 4, 5],
];
foreach ($weights as [$key, $level, $weight]) {
    $exists = sqlQuery("SELECT field_key FROM new_completion_field_weight WHERE field_key = ?", [$key]);
    if (empty($exists)) {
        sqlInsert(
            "INSERT INTO new_completion_field_weight (field_key, level, weight, is_active) VALUES (?, ?, ?, 1)",
            [$key, $level, $weight]
        );
        echo "Added weight: $key\n";
    }
}

sqlStatement("UPDATE new_completion_field_weight SET is_active = 0 WHERE field_key IN ('city', 'state')");

echo "Done.\n";

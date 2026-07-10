<?php

/**
 * T2 — "private cash clinic" globals preset.
 *
 * Applies the stock core `globals` values documented in
 * Documentation/NewClinic/new/NEW_CLINIC_T2_GLOBALS_PROFILE.md. Idempotent
 * insert-or-update, same pattern as pilot-enable-login-hardening.php (SEC-8).
 *
 * Deliberately does NOT touch `gbl_time_zone` (site-specific — see doc) or
 * `prevent_browser_refresh` (stock default '2' is already correct for
 * production; '0' is a personal dev-only convenience, not a clinic preset).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-clinic-globals-profile.php
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

$settings = [
    // Cash-only OPD has no employer/workers'-comp billing pipeline in V1 scope;
    // hides the field from the stock demographics form.
    'omit_employers' => '1',
    // M5 Cashier + M14 Billing Back Office are the only supported billing paths;
    // hides the stock widget so staff can't post payment outside the
    // completion/E-Sign gate the Cashier desk enforces.
    'hide_billing_widget' => '1',
    // Explicit non-goals (patient portal, eRx vendor UI) — already off by stock
    // default; reasserted defensively in case a prior admin enabled them.
    'portal_onsite_two_enable' => '0',
    'erx_enable' => '0',
];

foreach ($settings as $name => $value) {
    $existing = sqlQuery('SELECT gl_value FROM `globals` WHERE gl_name = ? AND gl_index = 0', [$name]);
    if (empty($existing)) {
        sqlStatement(
            'INSERT INTO `globals` (gl_name, gl_index, gl_value) VALUES (?, 0, ?)',
            [$name, $value]
        );
        echo "Inserted {$name} = {$value}\n";
    } elseif ((string) $existing['gl_value'] !== $value) {
        sqlStatement(
            'UPDATE `globals` SET gl_value = ? WHERE gl_name = ? AND gl_index = 0',
            [$value, $name]
        );
        echo "Updated {$name}: {$existing['gl_value']} -> {$value}\n";
    } else {
        echo "OK {$name} = {$value}\n";
    }
}

echo "Clinic globals profile applied. Reminders (not automated — see T2 profile doc):\n";
echo "  - Set gbl_time_zone to the clinic's actual timezone.\n";
echo "  - Leave prevent_browser_refresh at its stock default (2).\n";

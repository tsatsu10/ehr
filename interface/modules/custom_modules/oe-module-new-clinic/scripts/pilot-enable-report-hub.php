<?php

/**
 * Enable Reporting Operations Hub (M16) — alias for V1.1-REP pilot enable.
 *
 * @deprecated Use pilot-enable-v11-rep.php
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-report-hub.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

require __DIR__ . '/pilot-enable-v11-rep.php';

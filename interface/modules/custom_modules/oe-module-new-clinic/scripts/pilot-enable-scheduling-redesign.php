<?php

/**
 * Enable S1 Scheduling & Flow shell on a pilot facility.
 *
 * @deprecated Use pilot-enable-v11-scheduling.php
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-scheduling-redesign.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

require __DIR__ . '/pilot-enable-v11-scheduling.php';

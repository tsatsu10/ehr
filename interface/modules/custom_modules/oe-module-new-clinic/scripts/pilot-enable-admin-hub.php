<?php

/**
 * Enable Admin Hub (M15) — alias for V1.1-ADMIN pilot enable.
 *
 * @deprecated Use pilot-enable-v11-admin.php
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-admin-hub.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

require __DIR__ . '/pilot-enable-v11-admin.php';

<?php

/**
 * Release stale doctor desk consults before golden-path E2E.
 *
 * @deprecated Use e2e-prep-golden-path.php — kept for backward compatibility.
 *
 * Usage: php interface/modules/custom_modules/oe-module-new-clinic/scripts/e2e-reset-doctor-consults.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

require __DIR__ . '/e2e-prep-golden-path.php';

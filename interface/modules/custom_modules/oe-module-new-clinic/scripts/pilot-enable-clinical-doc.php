<?php

/**
 * @deprecated Use pilot-enable-v11-doc.php
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-clinical-doc.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

require __DIR__ . '/pilot-enable-v11-doc.php';

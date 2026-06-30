<?php

/**
 * Single OpenEMR globals entry for all module public pages (any nesting depth).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Csrf\CsrfUtils;

// Login apps may land on module routes without main_screen.php (which normally seeds csrf_private_key).
if (!empty($_SESSION['authUserID']) && empty($_SESSION['csrf_private_key'])) {
    CsrfUtils::setupCsrfKey();
}

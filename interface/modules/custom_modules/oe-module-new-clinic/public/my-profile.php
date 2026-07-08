<?php

/**
 * My profile — signed-in user account (React island).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;

(new PageController())->renderForAuthenticatedUser('my-profile.html.twig', 'My profile', [
    'island_entry' => 'my-profile',
]);

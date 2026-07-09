<?php

/**
 * Role picker — session role choice for multi-role users (PAGE_DESIGNS §7.1)
 *
 * Single-role users never see this page (redirect to their desk);
 * zero-role users get a plain message. Mid-session switching also lives
 * in the T1 top-bar dropdown; this page is the shared-device landing.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Bootstrap;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\SessionRoleService;

if (empty($_SESSION['authUserID'])) {
    authLoginScreen();
}

$roleService = new SessionRoleService();
$roles = $roleService->listAvailableRoles();

// Single-role users never see the picker (§7.1.5).
if (count($roles) === 1) {
    $webroot = $GLOBALS['webroot'] ?? '';
    header(
        'Location: ' . $webroot . Bootstrap::MODULE_INSTALLATION_PATH . '/public/' . $roles[0]['path'],
        true,
        302
    );
    exit;
}

$userRow = QueryUtils::querySingleRow(
    'SELECT fname FROM users WHERE id = ?',
    [(int) $_SESSION['authUserID']]
);
$firstName = trim((string) ($userRow['fname'] ?? ''));

(new PageController())->renderForAuthenticatedUser('role-picker.html.twig', 'Pick your role', [
    'shell_minimal' => true,
    'picker_roles' => $roles,
    'picker_last_used' => $roleService->getStoredRole(),
    'picker_first_name' => $firstName,
]);

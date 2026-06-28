<?php

/**
 * Visit Board — floor queue (M2)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;

$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$boardProfile = (string) ($_GET['profile'] ?? '') === 'wall' ? 'wall' : 'default';

// Modernization gates — both default OFF; page is byte-identical without them.
$configService     = new ClinicConfigService();
$reactIslandsDev   = $configService->get('enable_react_islands_dev', '0') === '1';
$reactVisitBoard   = $configService->get('enable_react_visit_board',  '1') === '1';

(new PageController())->renderForAnyClinicRole('visit-board.html.twig', 'Visit Board', [
    'new_reception',
    'new_nurse',
    'new_doctor',
    'new_lab',
    'new_pharmacy',
    'new_cashier',
    'new_admin',
    'reports',
], [
    'module_url' => $moduleUrl,
    'shell_nav_id' => 'clinicvb',
    'board_profile' => $boardProfile,
    'shell_minimal' => $boardProfile === 'wall',
    'enable_react_islands_dev' => $reactIslandsDev,
    'enable_react_visit_board' => $reactVisitBoard,
    'can_cancel_visit' => AclMain::aclCheckCore('new_clinic', 'new_visit_cancel'),
    'desk_urls' => [
        'front_desk' => $moduleUrl . '/front-desk.php',
        'triage' => $moduleUrl . '/triage.php',
        'doctor' => $moduleUrl . '/doctor.php',
        'lab' => $moduleUrl . '/lab.php',
        'pharmacy' => $moduleUrl . '/pharmacy.php',
        'cashier' => $moduleUrl . '/cashier.php',
    ],
]);

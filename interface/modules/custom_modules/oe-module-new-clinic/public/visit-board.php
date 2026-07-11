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
$kioskQuery = (string) ($_GET['kiosk'] ?? '') === '1';

// React visit board — kill-switch defaults ON after w50react cutover.
$configService   = new ClinicConfigService();
$reactVisitBoard = $configService->get('enable_react_visit_board', '1') === '1';
$kioskChrome = $boardProfile === 'wall' && (
    $kioskQuery || $configService->isEnabled('enable_visit_board_kiosk_chrome', 0)
);

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
    'kiosk_chrome' => $kioskChrome,
    'shell_minimal' => $boardProfile === 'wall',
    'enable_react_visit_board' => $reactVisitBoard,
    'can_cancel_visit' => AclMain::aclCheckCore('new_clinic', 'new_visit_cancel'),
    'can_send_back_to_doctor' => AclMain::aclCheckCore('new_clinic', 'new_visit_return_to_doctor'),
    'desk_urls' => [
        'front_desk' => $moduleUrl . '/front-desk.php',
        'triage' => $moduleUrl . '/triage.php',
        'doctor' => $moduleUrl . '/doctor.php',
        'lab' => $moduleUrl . '/lab.php',
        'pharmacy' => $moduleUrl . '/pharmacy.php',
        'cashier' => $moduleUrl . '/cashier.php',
    ],
    'island_entry' => 'visit-board',
]);

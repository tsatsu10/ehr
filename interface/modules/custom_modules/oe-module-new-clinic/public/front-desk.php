<?php

/**
 * Front Desk — search-first entry (M1a shell)
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
use OpenEMR\Modules\NewClinic\Services\AppointmentTodayService;
use OpenEMR\Modules\NewClinic\Services\ScheduledIntegrationService;
use OpenEMR\Modules\NewClinic\Services\SchedulingShellService;
use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$visitScope = new VisitScopeService();
$facilityId = $visitScope->resolveDeskFacilityId(
    !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null
);
$scheduledIntegration = new ScheduledIntegrationService();
$appointmentToday = new AppointmentTodayService();
$schedulingUrls = (new SchedulingShellService())->resolveIntegrationUrls($facilityId);
$schedulingEnabled = (new SchedulingAccessService())->isHubEnabled($facilityId);
$deskConfig = new ClinicConfigService();
$config = $deskConfig;

$reactFrontDesk = $config->get('enable_react_front_desk', '1') === '1';
$moduleUrl = $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public';

(new PageController())->renderDesk('front-desk.html.twig', 'new_reception', [
    'island_entry' => 'front-desk',
    'desk_id' => 'front-desk',
    'registration_mode' => $deskConfig->get('registration_mode', 'desk_full_form') ?? 'desk_full_form',
    'enable_pinned_reception_preview' => $deskConfig->isEnabled('enable_pinned_reception_preview', 0, $facilityId),
    'print_queue_slip_on_start_visit' => $deskConfig->isEnabled('print_queue_slip_on_start_visit', 1, $facilityId),
    'module_url' => $moduleUrl,
    'visit_board_url' => $moduleUrl . '/visit-board.php',
    'can_skip_triage' => AclMain::aclCheckCore('new_clinic', 'new_skip_triage'),
    'can_cancel_visit' => AclMain::aclCheckCore('new_clinic', 'new_visit_cancel'),
    'can_revisit_override' => AclMain::aclCheckCore('new_clinic', 'new_revisit_skip_completion'),
    'enforce_completion_on_revisit' => $deskConfig->isEnabled('enforce_completion_on_revisit', 1, $facilityId),
    'scheduled_integration_enabled' => $scheduledIntegration->isEnabled($facilityId),
    'appointments_today_count' => $scheduledIntegration->isEnabled($facilityId)
        ? $appointmentToday->countTodayAtFacility($facilityId)
        : 0,
    'calendar_url' => $schedulingEnabled
        ? $schedulingUrls['scheduling_url']
        : ($GLOBALS['webroot'] . '/interface/main/main_info.php'),
    'recalls_url' => $schedulingEnabled ? $schedulingUrls['recalls_url'] : null,
    'enable_react_front_desk' => $reactFrontDesk,
    'shell_desk_focus' => $reactFrontDesk,
]);

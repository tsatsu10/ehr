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

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\AppointmentTodayService;
use OpenEMR\Modules\NewClinic\Services\ScheduledIntegrationService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$visitScope = new VisitScopeService();
$facilityId = $visitScope->resolveDeskFacilityId(
    !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null
);
$scheduledIntegration = new ScheduledIntegrationService();
$appointmentToday = new AppointmentTodayService();
$deskConfig = new ClinicConfigService();

(new PageController())->render('front-desk.html.twig', 'Front Desk', 'new_reception', [
    'desk_id' => 'front-desk',
    'registration_mode' => $deskConfig->get('registration_mode', 'desk_full_form') ?? 'desk_full_form',
    'enable_pinned_reception_preview' => $deskConfig->isEnabled('enable_pinned_reception_preview', 0, $facilityId),
    'print_queue_slip_on_start_visit' => $deskConfig->isEnabled('print_queue_slip_on_start_visit', 1, $facilityId),
    'module_url' => $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public',
    'scheduled_integration_enabled' => $scheduledIntegration->isEnabled($facilityId),
    'appointments_today_count' => $scheduledIntegration->isEnabled($facilityId)
        ? $appointmentToday->countTodayAtFacility($facilityId)
        : 0,
    'calendar_url' => $GLOBALS['webroot'] . '/interface/main/main_info.php',
]);

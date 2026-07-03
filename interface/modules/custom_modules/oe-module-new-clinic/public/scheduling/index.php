<?php

/**
 * Scheduling & Flow shell (S1)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once dirname(__DIR__) . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\SchedulingShellService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);
$access = new SchedulingAccessService();

if (!$access->isHubEnabled($facilityId)) {
    $webroot = $GLOBALS['webroot'] ?? '';
    header(
        'Location: ' . $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/front-desk.php',
        true,
        302
    );
    exit;
}

try {
    $access->assertHubAccess($facilityId);
} catch (\Throwable) {
    http_response_code(403);
    echo xlt('Access denied');
    exit;
}

$webroot = $GLOBALS['webroot'] ?? '';
$moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$reactScheduling = $config->get('enable_react_scheduling', '1') === '1';
$lensParam = (string) ($_GET['lens'] ?? 'calendar');
$allowedLenses = ['calendar', 'flow', 'recalls'];
if (!in_array($lensParam, $allowedLenses, true)) {
    $lensParam = 'calendar';
}

$shell = (new SchedulingShellService())->getBootstrapPayload($facilityId);

(new PageController())->renderForAnyAcl(
    'scheduling/index.html.twig',
    'Scheduling & Flow',
    SchedulingAccessService::HUB_READ_ACLS,
    [
        'island_entry' => 'scheduling',
        'shell_nav_id' => 'clinicscheduling',
        'module_url' => $moduleUrl,
        'front_desk_url' => $moduleUrl . '/front-desk.php',
        'visit_board_url' => $moduleUrl . '/visit-board.php',
        'queue_bridge_url' => $moduleUrl . '/queue-bridge/index.php',
        'initial_lens' => $lensParam,
        'initial_date' => (string) ($_GET['date'] ?? $shell['default_date']),
        'initial_provider_id' => (int) ($_GET['provider_id'] ?? 0),
        'initial_facility_id' => (int) ($_GET['facility_id'] ?? $shell['default_facility_id']),
        'can_book' => $access->canBookAppointment(),
        'facilities' => $shell['facilities'],
        'providers' => $shell['providers'],
        'legacy_calendar_url' => $shell['legacy_urls']['calendar'],
        'legacy_flow_board_url' => $shell['legacy_urls']['flow_board'],
        'legacy_recalls_url' => $shell['legacy_urls']['recalls'],
        'enable_react_scheduling' => $reactScheduling,
        'auth_user_id' => (int) ($_SESSION['authUserID'] ?? 0),
        'scheduling_labels' => [
            'bookAppointment' => xl('Book appointment'),
            'newRecall' => xl('New recall'),
            'allProviders' => xl('All providers'),
            'showFilters' => xl('Show filters'),
            'hideFilters' => xl('Hide filters'),
            'flowBoardMode2Hint' => xl('Mode 2 arrivals only — use Front Desk Start visit & check in for the clinical queue.'),
            'calendarAppointments' => xl('appointments'),
            'loadingCalendar' => xl('Loading calendar…'),
            'loadingFlowBoard' => xl('Loading Flow Board…'),
            'lensCalendar' => xl('Calendar'),
            'lensFlow' => xl('Flow Board'),
            'lensRecalls' => xl('Recalls'),
            'calendarNoAppointments' => xl('No appointments for this day.'),
            'calendarSlotIntervals' => xl('Slot grid uses'),
            'calendarOn' => xl('on'),
            'calendarFrom' => xl('from'),
            'calendarTo' => xl('to'),
            'calendarAppointmentSingular' => xl('appointment'),
            'calendarDayGrid' => xl('Day grid'),
            'calendarAgenda' => xl('Agenda'),
            'calendarWeek' => xl('Week'),
            'calendarMonth' => xl('Month'),
            'frontDesk' => xl('Front Desk'),
            'close' => xl('Close'),
            'flowBoardBoard' => xl('Board'),
            'flowBoardList' => xl('List'),
            'flowBoardNoPatients' => xl('No patients'),
            'flowBoardNext' => xl('Next'),
            'flowBoardCheckIn' => xl('Check in'),
            'flowBoardRoomPrefix' => xl('Rm'),
            'moveLaneLeft' => xl('Move lane left'),
            'moveLaneRight' => xl('Move lane right'),
            'recallOverdue' => xl('Overdue'),
            'recallDue' => xl('Due now'),
            'recallUpcoming' => xl('Upcoming'),
            'recallCompleted' => xl('Completed'),
            'recallSearchPlaceholder' => xl('Search patient or reason'),
            'loadingRecalls' => xl('Loading recalls…'),
            'recallNoRows' => xl('No recalls in this bucket.'),
            'recallLogOutcome' => xl('Log outcome'),
            'recallBookAppt' => xl('Book appt'),
            'recallSnooze' => xl('Snooze 7d'),
            'recallEdit' => xl('Edit'),
            'recallDelete' => xl('Delete'),
            'errorLoadFlowBoard' => xl('Could not load Flow Board'),
            'errorStatusUpdate' => xl('Status update failed'),
            'errorRoomUpdate' => xl('Room update failed'),
            'errorLoadCalendar' => xl('Failed to load calendar'),
            'errorMoveAppointment' => xl('Could not move appointment'),
            'errorResizeAppointment' => xl('Could not resize appointment'),
            'errorLoadRecalls' => xl('Failed to load recalls'),
            'errorOpenBooking' => xl('Failed to open booking'),
            'errorBookingFailed' => xl('Booking failed'),
            'errorSaveFailed' => xl('Save failed'),
            'errorSnoozeFailed' => xl('Snooze failed'),
            'errorDeleteFailed' => xl('Delete failed'),
            'bookSheetTitle' => xl('Book appointment'),
            'bookSheetAria' => xl('Book appointment'),
            'cancel' => xl('Cancel'),
            'saveAppointment' => xl('Save appointment'),
            'saving' => xl('Saving…'),
            'bookingHint' => xl('Mode 2 booking only — clinical check-in is still at Front Desk Start visit & check in.'),
            'patient' => xl('Patient'),
            'provider' => xl('Provider'),
            'category' => xl('Category'),
            'time' => xl('Time'),
            'durationMin' => xl('Duration (min)'),
            'comments' => xl('Comments'),
            'bookingValidation' => xl('Patient, provider, category, and time are required'),
            'recallSheetNew' => xl('New recall'),
            'recallSheetEdit' => xl('Edit recall'),
            'recallSheetAria' => xl('Recall form'),
            'saveRecall' => xl('Save recall'),
            'recallHint' => xl('H1-safe path — only recall fields are saved. Contact details are read-only on the worklist.'),
            'dueDate' => xl('Due date'),
            'reason' => xl('Reason'),
            'facility' => xl('Facility'),
            'recallValidation' => xl('Patient, due date, provider, and facility are required'),
            'createRecallTooltip' => xl('Create a new recall'),
            'bookTooltip' => xl('Book a new appointment'),
            'requiresAclTooltip' => xl('Requires patients/appt ACL'),
            'flowBoardUpdatedAt' => xl('Flow board updated at'),
            'recurringTrackerDisabled' => xl('Recurring — tracker updates disabled'),
            'noClinicalVisit' => xl('No clinical visit'),
            'fix' => xl('Fix'),
            'roomFor' => xl('Room for'),
            'listColTime' => xl('Time'),
            'listColPatient' => xl('Patient'),
            'listColStatus' => xl('Status'),
            'listColWait' => xl('Wait'),
            'listColActions' => xl('Actions'),
            'selectedPatient' => xl('Selected'),
            'reasonPlaceholder' => xl('e.g. 6-month review'),
            'deleteRecallConfirm' => xl('Delete recall for'),
            'weekMoreEvents' => xl('more'),
            'resizeAppointmentAria' => xl('Resize appointment'),
            'crossLinkViewAppointment' => xl('View appointment'),
            'crossLinkViewRecalls' => xl('Recalls'),
            'crossLinkFlowBoard' => xl('Flow Board'),
            'outcomeModalTitle' => xl('Log recall outcome'),
            'outcomeModalConfirm' => xl('Save outcome'),
            'outcomeModalStatus' => xl('Status'),
            'outcomeModalNote' => xl('Note'),
            'recallColPatient' => xl('Patient'),
            'recallColDue' => xl('Due'),
            'recallColReason' => xl('Reason'),
            'recallColStatus' => xl('Status'),
            'recallColContact' => xl('Contact'),
            'recallColActions' => xl('Actions'),
            'filteredPatientPid' => xl('Filtered to patient PID'),
            'recallType' => xl('Recall type'),
            'recallSendReminder' => xl('Send reminder'),
            'notifyPatientTitle' => xl('Notify patient?'),
            'notifyPatientBody' => xl('MedEx is enabled. Do you want to notify the patient about this schedule change?'),
            'notifyPatientConfirm' => xl('Notify patient'),
            'notifyPatientSkip' => xl('Save without notify'),
            'notifyPatientAbort' => xl('Cancel change'),
            'notifyMoveLabel' => xl('Move appointment'),
            'notifyResizeLabel' => xl('Resize appointment'),
            'errorSendReminderFailed' => xl('Send reminder failed'),
            'recurringScopeTitle' => xl('Edit recurring appointment'),
            'recurringScopePrompt' => xl('Apply this change to:'),
            'recurringScopeCurrent' => xl('Only this occurrence'),
            'recurringScopeFuture' => xl('This and future occurrences'),
            'recurringScopeAll' => xl('All occurrences in the series'),
        ],
        'webroot' => $webroot,
    ]
);

<?php

/**
 * Session-auth JSON API for New Clinic desks
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Modules\NewClinic\Exceptions\EncounterSessionMismatchException;
use OpenEMR\Modules\NewClinic\Exceptions\StaleVisitException;
use OpenEMR\Modules\NewClinic\Exceptions\AllergiesUndocumentedException;
use OpenEMR\Modules\NewClinic\Exceptions\ExternalRxIncompleteException;
use OpenEMR\Modules\NewClinic\Exceptions\UndispensedRxException;
use OpenEMR\Modules\NewClinic\Exceptions\UnsignedEncounterException;
use OpenEMR\Modules\NewClinic\Exceptions\VisitNotTakeableException;
use OpenEMR\Modules\NewClinic\Services\AclAdminService;
use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\ClinicalExportService;
use OpenEMR\Modules\NewClinic\Services\ClinicalLabsSummaryService;
use OpenEMR\Modules\NewClinic\Services\ClinicalMedsSummaryService;
use OpenEMR\Modules\NewClinic\Services\CommunicationsHubService;
use OpenEMR\Modules\NewClinic\Services\CommHubUserSettingsService;
use OpenEMR\Modules\NewClinic\Services\CohortSavedFilterService;
use OpenEMR\Modules\NewClinic\Services\PatientCohortSearchService;
use OpenEMR\Modules\NewClinic\Services\RegistryAuditService;
use OpenEMR\Modules\NewClinic\Services\CashierService;
use OpenEMR\Modules\NewClinic\Services\ConsultShortcutService;
use OpenEMR\Modules\NewClinic\Services\DoctorRosterService;
use OpenEMR\Modules\NewClinic\Services\VisitRoutingService;
use OpenEMR\Modules\NewClinic\Services\DoctorService;
use OpenEMR\Modules\NewClinic\Services\LabPanelOrderService;
use OpenEMR\Modules\NewClinic\Services\PharmFormularyRxService;
use OpenEMR\Modules\NewClinic\Services\LabService;
use OpenEMR\Modules\NewClinic\Services\LabShortcutService;
use OpenEMR\Modules\NewClinic\Services\BillOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\BillOpsChargeCorrectionService;
use OpenEMR\Modules\NewClinic\Services\BillOpsDaysheetService;
use OpenEMR\Modules\NewClinic\Services\BillOpsOutstandingService;
use OpenEMR\Modules\NewClinic\Services\BillOpsPaymentsSearchService;
use OpenEMR\Modules\NewClinic\Services\LabOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\LabOpsOrderMetaService;
use OpenEMR\Modules\NewClinic\Services\LabOpsResultService;
use OpenEMR\Modules\NewClinic\Services\LabOpsSetupService;
use OpenEMR\Modules\NewClinic\Services\LabOpsWorklistService;
use OpenEMR\Modules\NewClinic\Services\PharmDrugMetaService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsControlledRegisterService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsDestroyService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsDispenseService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsDispenseLabelService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsOtcSaleService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsReceiveService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsSetupService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsRxPrintService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsReportsService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsWorklistService;
use OpenEMR\Modules\NewClinic\Services\PharmacyService;
use OpenEMR\Modules\NewClinic\Services\PharmacyShortcutService;
use OpenEMR\Modules\NewClinic\Services\PaymentHistoryService;
use OpenEMR\Modules\NewClinic\Services\ProfilePaymentsSummaryService;
use OpenEMR\Modules\NewClinic\Services\ReferralCorrespondenceService;
use OpenEMR\Modules\NewClinic\Services\ReferralDocumentService;
use OpenEMR\Modules\NewClinic\Services\StaffAdminService;
use OpenEMR\Modules\NewClinic\Services\StaffAccessSummaryService;
use OpenEMR\Modules\NewClinic\Services\FacilityUserAdminService;
use OpenEMR\Modules\NewClinic\Services\ReportsService;
use OpenEMR\Modules\NewClinic\Services\ReportsSchedulingService;
use OpenEMR\Modules\NewClinic\Services\ReportsAncillaryService;
use OpenEMR\Modules\NewClinic\Services\ReportsDocumentationIntegrityService;
use OpenEMR\Modules\NewClinic\Services\ReportHubAccessService;
use OpenEMR\Modules\NewClinic\Services\ReportHubCatalogService;
use OpenEMR\Modules\NewClinic\Services\ReportHubExportService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocAccessService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocCatalogService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocFormOpenService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocLbfWizardService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocReferralHospitalLbfWizardService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocVisitSummaryService;
use OpenEMR\Modules\NewClinic\Services\ClinicAdminService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\SessionRoleService;
use OpenEMR\Modules\NewClinic\Services\EncounterNoteService;
use OpenEMR\Modules\NewClinic\Services\EncounterSessionService;
use OpenEMR\Modules\NewClinic\Services\SharedDeviceSessionService;
use OpenEMR\Modules\NewClinic\Services\MyProfileService;
use OpenEMR\Modules\NewClinic\Services\PatientActivityFeedService;
use OpenEMR\Modules\NewClinic\Services\PatientChartClinicalService;
use OpenEMR\Modules\NewClinic\Services\PatientChartMessagesService;
use OpenEMR\Modules\NewClinic\Services\PatientChartSearchService;
use OpenEMR\Modules\NewClinic\Services\PatientChartService;
use OpenEMR\Modules\NewClinic\Services\PatientContextService;
use OpenEMR\Modules\NewClinic\Services\PatientDuplicateService;
use OpenEMR\Modules\NewClinic\Services\PatientRegistrationService;
use OpenEMR\Modules\NewClinic\Services\PatientSearchService;
use OpenEMR\Modules\NewClinic\Services\FacilityScopeService;
use OpenEMR\Modules\NewClinic\Services\GeoService;
use OpenEMR\Modules\NewClinic\Services\QuickAddService;
use OpenEMR\Modules\NewClinic\Services\QueueSlipService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeAccessService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeSurfaceService;
use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\SchedulingCalendarService;
use OpenEMR\Modules\NewClinic\Services\SchedulingFlowBoardLaneMapService;
use OpenEMR\Modules\NewClinic\Services\SchedulingFlowBoardService;
use OpenEMR\Modules\NewClinic\Services\SchedulingFlowBoardPrefsService;
use OpenEMR\Modules\NewClinic\Services\SchedulingRecallsService;
use OpenEMR\Modules\NewClinic\Services\RateLimitService;
use OpenEMR\Modules\NewClinic\Services\ReconciliationService;
use OpenEMR\Modules\NewClinic\Services\RevisitCompletionGateService;
use OpenEMR\Modules\NewClinic\Services\AppointmentTodayService;
use OpenEMR\Modules\NewClinic\Services\FrontDeskRecentPatientsService;
use OpenEMR\Modules\NewClinic\Services\FrontDeskStatsService;
use OpenEMR\Modules\NewClinic\Services\TriageService;
use OpenEMR\Modules\NewClinic\Services\VisitTypeAdminService;
use OpenEMR\Modules\NewClinic\Services\FeeScheduleAdminService;
use OpenEMR\Modules\NewClinic\Services\VisitBoardService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitClaimLostService;
use OpenEMR\Modules\NewClinic\Services\SimilarSurnameQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

class AjaxController
{
    /** @var array<string, mixed>|null */
    private ?array $jsonBodyCache = null;
    /** @var array<string, object> */
    private array $services = [];

    /**
     * Lazy, memoized service accessor — avoids eager ctor construction (AUDIT-10a).
     *
     * @template T of object
     * @param class-string<T> $class
     * @return T
     */
    private function svc(string $class): object
    {
        if (!isset($this->services[$class])) {
            $this->services[$class] = new $class();
        }

        return $this->services[$class];
    }

    public function handleRequest(): void
    {
        header('Content-Type: application/json');

        if (empty($_SESSION['authUserID'])) {
            $this->respond(false, 'Unauthorized', ['code' => 'unauthorized'], 401);
        }

        $action = $this->resolveRequestAction();
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $userId = (int) $_SESSION['authUserID'];

        if ($action === 'visit.transition') {
            $this->respond(
                false,
                'Use role-specific workflow actions (triage, doctor, cashier)',
                ['code' => 'deprecated'],
                410
            );
        }

        if ($action !== '' && !$this->svc(AjaxActionPolicy::class)->defersAuthorizationToHandler($action)) {
            $this->authorizeAction($action);
        }

        try {
            switch ($action) {
                case 'health':
                    $this->respond(true, 'ok', ['module' => 'oe-module-new-clinic']);
                    break;
                case 'patients.search':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->svc(RateLimitService::class)->assertWithinLimit('patients.search', $userId);
                    $result = $this->svc(PatientSearchService::class)->search(
                        (string) ($body['q'] ?? ''),
                        (int) ($body['limit'] ?? 8),
                        $userId
                    );
                    $this->respond(true, 'ok', $result->toArray());
                    break;
                case 'patients.preview':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $pid = (int) ($body['pid'] ?? 0);
                    $this->authorizeDeferredHandler('patients.preview', $pid);
                    $this->assertPatientChartPid($pid);
                    $preview = $this->svc(PatientContextService::class)->previewPayload(
                        $pid,
                        $userId,
                        (string) ($body['context'] ?? 'front-desk')
                    );
                    $this->respond(true, 'ok', $preview);
                    break;
                case 'patients.chart.visits':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeDeferredHandler('patients.chart.visits', $pid);
                    $this->assertPatientChartPid($pid);
                    $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                    $limit = (int) ($_REQUEST['limit'] ?? PatientChartService::PAST_VISITS_PAGE_SIZE);
                    $visits = $this->svc(PatientChartService::class)->getVisitsPayload($pid, $offset, $limit);
                    $this->respond(true, 'ok', $visits);
                    break;
                case 'patients.chart.clinical':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeDeferredHandler('patients.chart.clinical', $pid);
                    $this->assertPatientChartPid($pid);
                    $clinical = $this->svc(PatientChartClinicalService::class)->getClinicalPayload($pid);
                    $this->respond(true, 'ok', $clinical);
                    break;
                case 'patients.chart.activity_feed':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeDeferredHandler('patients.chart.activity_feed', $pid);
                    $this->assertPatientChartPid($pid);
                    $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                    $limit = (int) ($_REQUEST['limit'] ?? PatientActivityFeedService::PAGE_SIZE);
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    $lookbackDays = (int) ($_REQUEST['lookback_days'] ?? 0);
                    $feed = $this->svc(PatientActivityFeedService::class)->getActivityFeed(
                        $pid,
                        $offset,
                        $limit,
                        true,
                        $visitId > 0 ? $visitId : null,
                        $lookbackDays > 0 ? $lookbackDays : null,
                    );
                    $this->respond(true, 'ok', $feed);
                    break;
                case 'patients.chart.messages':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeDeferredHandler('patients.chart.messages', $pid);
                    $this->assertPatientChartPid($pid);
                    $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                    $limit = (int) ($_REQUEST['limit'] ?? PatientChartMessagesService::PAGE_SIZE);
                    $messages = $this->svc(PatientChartMessagesService::class)->getMessagesPayload($pid, $offset, $limit);
                    $this->respond(true, 'ok', $messages);
                    break;
                case 'patients.chart.search':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeDeferredHandler('patients.chart.search', $pid);
                    $this->assertPatientChartPid($pid);
                    $config = new ClinicConfigService();
                    if ($config->getInt('enable_in_chart_patient_search', 0) !== 1) {
                        $this->respond(false, 'Feature not enabled', ['code' => 'feature_disabled'], 403);
                    }
                    $query = trim((string) ($_REQUEST['q'] ?? ''));
                    $limit = (int) ($_REQUEST['limit'] ?? PatientChartSearchService::DEFAULT_LIMIT);
                    $search = $this->svc(PatientChartSearchService::class)->search($pid, $query, $limit);
                    $this->respond(true, 'ok', $search);
                    break;
                case 'mrd.profile_payments_summary':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeDeferredHandler('mrd.profile_payments_summary', $pid);
                    $this->assertPatientChartPid($pid);
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    $summary = $this->svc(ProfilePaymentsSummaryService::class)->getSummary(
                        $pid,
                        $visitId > 0 ? $visitId : null
                    );
                    $this->respond(true, 'ok', $summary);
                    break;
                case 'chart_depth.payments_list':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->assertPatientChartPid($pid);
                    $this->authorizeDeferredHandler('chart_depth.payments_list', $pid);
                    $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                    $limit = (int) ($_REQUEST['limit'] ?? PaymentHistoryService::PAGE_SIZE);
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    $filter = (string) ($_REQUEST['filter'] ?? '');
                    if ($filter === '' && $visitId > 0) {
                        $filter = 'this_visit';
                    }
                    $list = $this->svc(PaymentHistoryService::class)->getPaymentsList(
                        $pid,
                        $offset,
                        $limit,
                        $visitId > 0 ? $visitId : null,
                        $filter !== '' ? $filter : 'all_visits',
                        trim((string) ($_REQUEST['date_from'] ?? '')) ?: null,
                        trim((string) ($_REQUEST['date_to'] ?? '')) ?: null,
                    );
                    $this->respond(true, 'ok', $list);
                    break;
                case 'chart_depth.receipt_reprint':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $pid = (int) ($body['pid'] ?? 0);
                    $receiptId = (int) ($body['receipt_id'] ?? 0);
                    $this->authorizeDeferredHandler('chart_depth.receipt_reprint', $pid);
                    $payload = $this->svc(PaymentHistoryService::class)->getReceiptReprintPayload($receiptId, $pid, $userId);
                    $this->respond(true, 'ok', $payload);
                    break;
                case 'mrd.clinical_referrals_strip':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeDeferredHandler('mrd.clinical_referrals_strip', $pid);
                    $this->assertPatientChartPid($pid);
                    $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                    $strip = $this->svc(ReferralCorrespondenceService::class)->getClinicalStrip(
                        $pid,
                        $encounterId > 0 ? $encounterId : null
                    );
                    $this->respond(true, 'ok', $strip);
                    break;
                case 'mrd.clinical_labs_summary':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeDeferredHandler('mrd.clinical_labs_summary', $pid);
                    $this->assertPatientChartPid($pid);
                    $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                    $strip = $this->svc(ClinicalLabsSummaryService::class)->getClinicalStrip(
                        $pid,
                        $encounterId > 0 ? $encounterId : null
                    );
                    $this->respond(true, 'ok', $strip);
                    break;
                case 'mrd.clinical_meds_summary':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeDeferredHandler('mrd.clinical_meds_summary', $pid);
                    $this->assertPatientChartPid($pid);
                    $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                    $strip = $this->svc(ClinicalMedsSummaryService::class)->getClinicalStrip(
                        $pid,
                        $encounterId > 0 ? $encounterId : null
                    );
                    $this->respond(true, 'ok', $strip);
                    break;
                case 'chart_depth.export_builder':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeDeferredHandler('chart_depth.export_builder', $pid);
                    $preset = trim((string) ($_REQUEST['preset'] ?? ''));
                    $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                    $payload = $this->svc(ClinicalExportService::class)->getBuilderPayload(
                        $pid,
                        $preset !== '' ? $preset : null,
                        $encounterId > 0 ? $encounterId : null
                    );
                    $this->respond(true, 'ok', $payload);
                    break;
                case 'chart_depth.export_generate':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $pid = (int) ($body['pid'] ?? 0);
                    $this->authorizeDeferredHandler('chart_depth.export_generate', $pid);
                    $this->assertPatientChartPid($pid);
                    $preset = trim((string) ($body['preset'] ?? ClinicalExportService::PRESET_VISIT_SUMMARY));
                    $encounterId = (int) ($body['encounter_id'] ?? 0);
                    $includes = is_array($body['include'] ?? null) ? $body['include'] : [];
                    $normalizedIncludes = [];
                    foreach ($includes as $key => $value) {
                        $normalizedIncludes[(string) $key] = !empty($value);
                    }
                    $result = $this->svc(ClinicalExportService::class)->preparePdfExport(
                        $pid,
                        $preset,
                        $encounterId > 0 ? $encounterId : null,
                        $normalizedIncludes,
                        $userId
                    );
                    $this->respond(true, 'ok', $result);
                    break;
                case 'chart_depth.referrals_list':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeDeferredHandler('chart_depth.referrals_list', $pid);
                    $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                    $limit = (int) ($_REQUEST['limit'] ?? ReferralCorrespondenceService::PAGE_SIZE);
                    $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                    $list = $this->svc(ReferralCorrespondenceService::class)->getReferralsList(
                        $pid,
                        $offset,
                        $limit,
                        $encounterId > 0 ? $encounterId : null
                    );
                    $this->respond(true, 'ok', $list);
                    break;
                case 'patients.dup_check':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->svc(RateLimitService::class)->assertWithinLimit('patients.dup_check', $userId);
                    $excludePid = (int) ($body['exclude_pid'] ?? $body['pid'] ?? 0);
                    $dup = $this->svc(PatientDuplicateService::class)->scoreProspect(
                        $body,
                        $excludePid > 0 ? $excludePid : null
                    );
                    $this->respond(true, 'ok', $dup);
                    break;
                case 'patients.create':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $created = $this->resolvePatientCreate($body, $userId);
                    $this->respond(true, 'Patient saved', $created);
                    break;
                case 'patients.update':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $section = (int) ($body['section'] ?? 0);
                    $pid = (int) ($body['pid'] ?? 0);
                    $patient = is_array($body['patient'] ?? null) ? $body['patient'] : $body;
                    if ($pid <= 0 || $section < 1 || $section > 4) {
                        $this->respond(false, 'pid and section (1-4) are required', [], 400);
                    }
                    $patient = array_merge($patient, [
                        'dup_confirm' => $body['dup_confirm'] ?? null,
                        'dup_override' => $body['dup_override'] ?? null,
                        'dup_override_reason' => $body['dup_override_reason'] ?? null,
                        'national_id' => trim((string) ($body['national_id'] ?? ($patient['national_id'] ?? ''))),
                        'no_phone' => $body['no_phone'] ?? ($patient['no_phone'] ?? null),
                    ]);
                    $updated = $this->svc(PatientRegistrationService::class)->saveSection($section, $patient, $pid, $userId);
                    $this->respond(true, 'Patient updated', $updated);
                    break;
                case 'patients.registration.get':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $pid = (int) ($body['pid'] ?? 0);
                    $this->authorizeDeferredHandler('patients.registration.get', $pid);
                    $this->assertPatientChartPid($pid);
                    $form = $this->svc(PatientRegistrationService::class)->getFormData($pid);
                    $this->respond(true, 'ok', $form);
                    break;
                case 'admin.geo.regions':
                    $country = (string) ($_REQUEST['country'] ?? 'GH');
                    $this->respond(true, 'ok', ['regions' => $this->svc(GeoService::class)->listRegions($country)]);
                    break;
                case 'admin.geo.districts':
                    $regionCode = (string) ($_REQUEST['region_code'] ?? '');
                    $this->respond(true, 'ok', [
                        'districts' => $this->svc(GeoService::class)->listDistricts($regionCode),
                    ]);
                    break;
                case 'visit.types':
                    $facilityId = $this->resolveRequestFacilityId();
                    $types = $this->svc(VisitTypeAdminService::class)->listForDesk($facilityId);
                    $this->respond(true, 'ok', ['visit_types' => $types]);
                    break;
                case 'visit.board':
                    $facilityId = $this->resolveRequestFacilityId();
                    $board = $this->svc(VisitBoardService::class)->getBoard(
                        $facilityId,
                        $_REQUEST['visit_date'] ?? date('Y-m-d')
                    );
                    $board = $this->svc(SimilarSurnameQueueService::class)->annotateBoard($board, $facilityId);
                    $this->respond(true, 'ok', $board);
                    break;
                case 'visit.detail':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $visitId = (int) ($body['visit_id'] ?? 0);
                    $visit = $this->svc(VisitBoardService::class)->getVisitDetail($visitId, $userId);
                    $preview = $this->svc(PatientContextService::class)->previewPayload(
                        (int) ($visit['visit']['pid'] ?? 0),
                        $userId,
                        'visit_board'
                    );
                    $this->respond(true, 'ok', array_merge($visit, ['preview' => $preview]));
                    break;
                case 'visit.cancel':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $visit = $this->svc(VisitQueueService::class)->cancelVisit(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        (string) ($body['reason'] ?? '')
                    );
                    $this->respond(true, 'Visit cancelled', ['visit' => $visit]);
                    break;
                case 'visit.hard_assign':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = $this->resolveDeskFacilityFromBody($body);
                    $providerRaw = $body['hard_assigned_provider_id'] ?? null;
                    $providerId = ($providerRaw === null || $providerRaw === '')
                        ? null
                        : (int) $providerRaw;
                    if ($providerId !== null && $providerId <= 0) {
                        $providerId = null;
                    }
                    $visit = $this->svc(VisitQueueService::class)->hardAssignProvider(
                        (int) ($body['visit_id'] ?? 0),
                        $facilityId,
                        $providerId,
                        $userId,
                        (int) ($body['row_version'] ?? 0)
                    );
                    $this->respond(true, 'Doctor assignment updated', ['visit' => $visit]);
                    break;
                case 'visit.start':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $visit = $this->svc(VisitQueueService::class)->startVisit(
                        (int) ($body['pid'] ?? 0),
                        (int) ($body['visit_type_id'] ?? 0),
                        $userId,
                        $this->resolveDeskFacilityFromBody($body),
                        isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null,
                        !empty($body['is_urgent']),
                        isset($body['revisit_override_reason'])
                            ? (string) $body['revisit_override_reason']
                            : null,
                        isset($body['referral_document_id'])
                            ? (int) $body['referral_document_id']
                            : null,
                    );
                    $this->respond(true, 'Visit started', $this->enrichStartVisitResponse($visit, $userId));
                    break;
                case 'visit.skip_triage':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $visit = $this->svc(VisitQueueService::class)->skipTriage(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        isset($body['reason']) ? (string) $body['reason'] : null
                    );
                    $this->respond(true, 'Skipped triage', ['visit' => $visit]);
                    break;
                case 'front_desk.desk_stats':
                    $facilityId = $this->resolveRequestFacilityId();
                    $stats = $this->svc(FrontDeskStatsService::class)->getDeskStats($userId, $facilityId);
                    $this->respond(true, 'ok', $stats);
                    break;
                case 'front_desk.flow_charts':
                    $facilityId = $this->resolveRequestFacilityId();
                    $charts = $this->svc(FrontDeskStatsService::class)->getFlowCharts($facilityId);
                    $this->respond(true, 'ok', $charts);
                    break;
                case 'front_desk.todays_appointments':
                    $facilityId = $this->resolveRequestFacilityId();
                    $limit = (int) ($_REQUEST['limit'] ?? 50);
                    $appointments = $this->svc(AppointmentTodayService::class)->listTodayAppointments($facilityId, $limit);
                    $this->respond(true, 'ok', ['appointments' => $appointments]);
                    break;
                case 'front_desk.recently_viewed':
                    $recent = $this->svc(FrontDeskRecentPatientsService::class)->listRecent();
                    $this->respond(true, 'ok', ['recent' => $recent]);
                    break;
                case 'front_desk.recently_viewed.remember':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $pid = (int) ($body['pid'] ?? 0);
                    $displayName = trim((string) ($body['display_name'] ?? ''));
                    $pubpid = trim((string) ($body['pubpid'] ?? ''));
                    try {
                        $recent = $this->svc(FrontDeskRecentPatientsService::class)->remember($pid, $displayName, $pubpid);
                    } catch (\InvalidArgumentException $exception) {
                        $this->respond(false, $exception->getMessage(), [], 400);
                    }
                    $this->respond(true, 'ok', ['recent' => $recent]);
                    break;
                case 'front_desk.recently_viewed.clear':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->svc(FrontDeskRecentPatientsService::class)->clear();
                    $this->respond(true, 'ok', ['recent' => []]);
                    break;
                case 'front_desk.upload_referral':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $this->verifyCsrf($_POST);
                    if (empty($_FILES['file']) || !is_array($_FILES['file'])) {
                        $this->respond(false, 'Referral file is required', ['code' => 'validation'], 400);
                    }
                    $pid = (int) ($_POST['pid'] ?? 0);
                    if ($pid <= 0) {
                        $this->respond(false, 'Patient is required', ['code' => 'validation'], 400);
                    }
                    $this->svc(FacilityScopeService::class)->assertPatientAccessible($pid);
                    $upload = $this->svc(ReferralDocumentService::class)->uploadForPatient(
                        $pid,
                        $_FILES['file'],
                        $userId
                    );
                    $this->respond(true, 'Referral uploaded', $upload);
                    break;
                case 'front_desk.revisit_awaiting_documents':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $pid = (int) ($body['pid'] ?? 0);
                    if ($pid <= 0) {
                        $this->respond(false, 'pid required', [], 400);
                    }
                    $this->assertPatientChartPid($pid);
                    $this->svc(RevisitCompletionGateService::class)->logAwaitingDocuments(
                        $pid,
                        $userId,
                        isset($body['note']) ? (string) $body['note'] : null
                    );
                    $this->respond(true, 'Patient noted as awaiting documents');
                    break;
                case 'visit.start_from_appointment':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(VisitQueueService::class)->startVisitFromAppointment(
                        (int) ($body['pid'] ?? 0),
                        (int) ($body['pc_eid'] ?? 0),
                        (string) ($body['appt_date'] ?? ''),
                        $userId,
                        isset($body['visit_type_id']) ? (int) $body['visit_type_id'] : null,
                        $this->resolveRequestFacilityId(),
                        isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null,
                        !empty($body['is_urgent']),
                        isset($body['revisit_override_reason'])
                            ? (string) $body['revisit_override_reason']
                            : null
                    );
                    $visit = (array) ($result['visit'] ?? []);
                    $this->svc(SchedulingRecallsService::class)->completeLinkedRecallOnCheckIn(
                        (int) ($body['pc_eid'] ?? 0),
                        (int) ($body['pid'] ?? 0),
                        $userId,
                    );
                    $this->respond(
                        true,
                        'Visit started from appointment',
                        array_merge($result, $this->enrichStartVisitResponse($visit, $userId))
                    );
                    break;
                case 'desk.shared_session_probe':
                    $probe = $this->svc(SharedDeviceSessionService::class)->probe(
                        (int) ($_REQUEST['visit_id'] ?? 0),
                        (string) ($_REQUEST['compare_mode'] ?? SharedDeviceSessionService::COMPARE_CLINICAL),
                        $userId
                    );
                    $this->respond(true, 'ok', $probe);
                    break;
                case 'triage.queue':
                    $facilityId = $this->resolveRequestFacilityId();
                    $visitDate = trim((string) ($_REQUEST['visit_date'] ?? ''));
                    $queue = $this->svc(TriageService::class)->getTriageQueue(
                        $facilityId,
                        $visitDate !== '' ? $visitDate : null,
                        $userId
                    );
                    $queue = $this->enrichQueuePayload($queue, $userId, $facilityId);
                    $this->respond(true, 'ok', $queue);
                    break;
                case 'triage.select':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $payload = $this->svc(TriageService::class)->selectPatient(
                        (int) ($body['visit_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $payload);
                    break;
                case 'triage.start':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $visitId = (int) ($body['visit_id'] ?? 0);
                    $visit = $this->svc(VisitQueueService::class)->startTriage(
                        $visitId,
                        $userId,
                        (int) ($body['row_version'] ?? 0)
                    );
                    $this->svc(EncounterSessionService::class)->bindForVisit($visitId, $userId);
                    $this->respond(true, 'Triage started', ['visit' => $visit]);
                    break;
                case 'triage.save_vitals':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(TriageService::class)->saveVitals(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        is_array($body['vitals'] ?? null) ? $body['vitals'] : [],
                        isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null
                    );
                    $this->respond(true, 'Vitals saved', $result);
                    break;
                case 'triage.send_doctor':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $providerRaw = $body['hard_assigned_provider_id'] ?? null;
                    $providerId = ($providerRaw === null || $providerRaw === '')
                        ? null
                        : (int) $providerRaw;
                    if ($providerId !== null && $providerId <= 0) {
                        $providerId = null;
                    }
                    $visit = $this->svc(TriageService::class)->sendToDoctor(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null,
                        $providerId
                    );
                    $this->respond(true, 'Sent to doctor', ['visit' => $visit]);
                    break;
                case 'triage.auto_start':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $visit = $this->svc(VisitQueueService::class)->startVisitAtTriage(
                        (int) ($body['pid'] ?? 0),
                        (int) ($body['visit_type_id'] ?? 0),
                        $userId,
                        $this->resolveDeskFacilityFromBody($body),
                        isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null,
                        !empty($body['is_urgent'])
                    );
                    $this->svc(EncounterSessionService::class)->bindForVisit((int) $visit['id'], $userId);
                    $this->respond(true, 'Visit started at triage', ['visit' => $visit]);
                    break;
                case 'triage.restore_session':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $session = $this->svc(EncounterSessionService::class)->bindForVisitWithDeskAcl(
                        (int) ($body['visit_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'Session restored', ['session' => $session->toArray()]);
                    break;
                case 'doctor.queue':
                    $facilityId = $this->resolveRequestFacilityId();
                    $queue = $this->svc(DoctorService::class)->getDoctorQueue(
                        $facilityId,
                        $_REQUEST['visit_date'] ?? date('Y-m-d'),
                        $userId,
                        (string) ($_REQUEST['scope'] ?? 'me')
                    );
                    $queue = $this->enrichQueuePayload($queue, $userId, $facilityId);
                    $this->respond(true, 'ok', $queue);
                    break;
                case 'doctor.roster':
                    $facilityId = $this->resolveRequestFacilityId();
                    $rosterService = new DoctorRosterService();
                    if (!$rosterService->isEnabled($facilityId)) {
                        $this->respond(true, 'ok', [
                            'enabled' => false,
                            'doctors' => [],
                            'my_user_id' => $userId,
                        ]);
                        break;
                    }
                    $this->respond(true, 'ok', $rosterService->getRosterPayload(
                        $facilityId,
                        $userId,
                        isset($_REQUEST['visit_date']) ? (string) $_REQUEST['visit_date'] : null
                    ));
                    break;
                case 'doctor.roster.set_taking':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = $this->resolveRequestFacilityId();
                    $targetUserId = (int) ($body['user_id'] ?? $userId);
                    if ($targetUserId !== $userId && !AclMain::aclCheckCore('new_clinic', 'new_admin')) {
                        $this->respond(false, 'Forbidden', [], 403);
                    }
                    (new DoctorRosterService())->setTakingPatients(
                        $targetUserId,
                        $facilityId,
                        !empty($body['taking_patients'])
                    );
                    $this->respond(true, 'Roster updated');
                    break;
                case 'doctor.routing.reassign':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $providerId = isset($body['provider_id']) ? (int) $body['provider_id'] : null;
                    if (array_key_exists('provider_id', $body) && ($body['provider_id'] === null || $body['provider_id'] === '')) {
                        $providerId = null;
                    }
                    $visit = (new VisitRoutingService())->reassignSuggestion(
                        (int) ($body['visit_id'] ?? 0),
                        $providerId,
                        $userId,
                        isset($body['note']) ? (string) $body['note'] : null
                    );
                    $this->respond(true, 'Routing suggestion updated', [
                        'visit_id' => (int) ($visit['id'] ?? 0),
                        'routing_suggested_provider_id' => isset($visit['routing_suggested_provider_id'])
                            ? (int) $visit['routing_suggested_provider_id']
                            : null,
                    ]);
                    break;
                case 'doctor.active':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $payload = $this->svc(DoctorService::class)->getActiveConsultPayload(
                        (int) ($body['visit_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $payload);
                    break;
                case 'doctor.take':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $payload = $this->svc(DoctorService::class)->takePatient(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        isset($body['override_reason']) ? (string) $body['override_reason'] : null
                    );
                    $this->respond(true, 'Patient taken', $payload);
                    break;
                case 'doctor.complete':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(DoctorService::class)->completeConsult(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        !empty($body['needs_lab']),
                        !empty($body['needs_rx']),
                        isset($body['notes']) ? (string) $body['notes'] : null,
                        $this->esignOverrideReason($body)
                    );
                    $this->respond(true, 'Consult completed', $result);
                    break;
                case 'doctor.reopen':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(DoctorService::class)->reopenConsult(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        (string) ($body['reason'] ?? '')
                    );
                    $this->respond(true, 'Consult reopened', $result);
                    break;
                case 'doctor.set_supervisor':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $encounterId = (int) ($body['encounter_id'] ?? 0);
                    $supervisorId = isset($body['supervisor_id']) && $body['supervisor_id'] !== null
                        ? (int) $body['supervisor_id']
                        : null;
                    $result = $this->svc(DoctorService::class)->setSupervisor($encounterId, $supervisorId, $userId);
                    $this->respond(true, 'Supervisor updated', $result);
                    break;
                case 'doctor.search_providers':
                    if ($method !== 'GET') {
                        $this->respond(false, 'GET required', [], 405);
                    }
                    $query = (string) ($_REQUEST['q'] ?? '');
                    $facilityId = $this->resolveRequestFacilityId();
                    $results = $this->svc(DoctorService::class)->searchProviders($query, $facilityId, $userId);
                    $this->respond(true, 'ok', ['providers' => $results]);
                    break;
                case 'doctor.shortcut_preflight':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $preflight = $this->svc(ConsultShortcutService::class)->preflight(
                        (int) ($body['visit_id'] ?? 0),
                        (string) ($body['shortcut'] ?? ''),
                        $userId,
                        $this->rxAllergyOverrideReason($body),
                    );
                    $this->respond(true, 'ok', $preflight);
                    break;
                case 'doctor.restore_session':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $session = $this->svc(EncounterSessionService::class)->bindForVisitWithDeskAcl(
                        (int) ($body['visit_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'Session restored', ['session' => $session->toArray()]);
                    break;
                case 'doctor.lab_panel_catalog':
                    if ($method !== 'GET') {
                        $this->respond(false, 'GET required', [], 405);
                    }
                    $facilityId = $this->resolveRequestFacilityId();
                    $catalog = $this->svc(LabPanelOrderService::class)->getCatalogPayload($facilityId);
                    $this->respond(true, 'ok', $catalog);
                    break;
                case 'doctor.lab_panel_place':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(LabPanelOrderService::class)->placeOrder(
                        (int) ($body['visit_id'] ?? 0),
                        (array) ($body['procedure_type_ids'] ?? []),
                        $userId
                    );
                    $this->respond(true, 'Lab order placed', $result);
                    break;
                case 'doctor.formulary_rx_catalog':
                    if ($method !== 'GET') {
                        $this->respond(false, 'GET required', [], 405);
                    }
                    $facilityId = $this->resolveRequestFacilityId();
                    $formularyCatalog = $this->svc(PharmFormularyRxService::class)->getCatalogPayload($facilityId);
                    $this->respond(true, 'ok', $formularyCatalog);
                    break;
                case 'doctor.formulary_rx_place':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $rxResult = $this->svc(PharmFormularyRxService::class)->placePrescriptions(
                        (int) ($body['visit_id'] ?? 0),
                        (array) ($body['drug_ids'] ?? []),
                        $userId
                    );
                    $this->respond(true, 'Prescriptions added', $rxResult);
                    break;
                case 'cashier.queue':
                    $facilityId = $this->resolveRequestFacilityId();
                    $queue = $this->svc(CashierService::class)->getCashierQueue(
                        $facilityId,
                        $_REQUEST['visit_date'] ?? date('Y-m-d'),
                        $userId
                    );
                    $queue = $this->enrichQueuePayload($queue, $userId, $facilityId);
                    $this->respond(true, 'ok', $queue);
                    break;
                case 'cashier.select':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $payload = $this->svc(CashierService::class)->selectVisit(
                        (int) ($body['visit_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $payload);
                    break;
                case 'cashier.resolve_patient':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = $this->resolveRequestFacilityId();
                    $payload = $this->svc(CashierService::class)->resolvePatientCheckout(
                        (int) ($body['pid'] ?? 0),
                        $facilityId,
                        $userId
                    );
                    $this->respond(true, 'ok', $payload);
                    break;
                case 'cashier.charges.post':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $payload = $this->svc(CashierService::class)->postCharges(
                        (int) ($body['visit_id'] ?? 0),
                        (array) ($body['lines'] ?? []),
                        $userId
                    );
                    $this->respond(true, 'Charges posted', $payload);
                    break;
                case 'cashier.pay':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(CashierService::class)->recordPayment(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        (float) ($body['amount_received'] ?? 0),
                        isset($body['receipt_note']) ? (string) $body['receipt_note'] : null,
                        $this->esignOverrideReason($body),
                        isset($body['completion_override_reason'])
                            ? (string) $body['completion_override_reason']
                            : null,
                        isset($body['client_request_id']) ? (string) $body['client_request_id'] : null,
                        isset($body['payment_method']) ? (string) $body['payment_method'] : 'cash',
                        isset($body['momo_reference']) ? (string) $body['momo_reference'] : null,
                    );
                    $this->respond(true, 'Payment recorded', $result);
                    break;
                case 'cashier.mark_unpaid':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(CashierService::class)->markClosedUnpaid(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        (string) ($body['reason'] ?? '')
                    );
                    $this->respond(true, 'Marked left unpaid', $result);
                    break;
                case 'cashier.close_zero':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(CashierService::class)->closeWithoutCharge(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        (string) ($body['reason'] ?? '')
                    );
                    $this->respond(true, 'Visit closed without charge', $result);
                    break;
                case 'lab.queue':
                    $facilityId = $this->resolveRequestFacilityId();
                    $queue = $this->svc(LabService::class)->getLabQueue(
                        $facilityId,
                        $_REQUEST['visit_date'] ?? date('Y-m-d'),
                        $userId
                    );
                    $queue = $this->enrichQueuePayload($queue, $userId, $facilityId);
                    $this->respond(true, 'ok', $queue);
                    break;
                case 'lab.select':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $payload = $this->svc(LabService::class)->selectVisit(
                        (int) ($body['visit_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $payload);
                    break;
                case 'lab.take':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $payload = $this->svc(LabService::class)->takePatient(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0)
                    );
                    $this->respond(true, 'Patient taken', $payload);
                    break;
                case 'lab.complete':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(LabService::class)->completeLab(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        $this->esignOverrideReason($body)
                    );
                    $this->respond(true, 'Lab completed', $result);
                    break;
                case 'lab.skip_to_payment':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(LabService::class)->skipToPayment(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        (string) ($body['reason'] ?? '')
                    );
                    $this->respond(true, 'Skipped to payment', $result);
                    break;
                case 'lab.shortcut_preflight':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $preflight = $this->svc(LabShortcutService::class)->preflight(
                        (int) ($body['visit_id'] ?? 0),
                        (string) ($body['shortcut'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $preflight);
                    break;
                case 'lab.restore_session':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $session = $this->svc(EncounterSessionService::class)->bindForVisitWithDeskAcl(
                        (int) ($body['visit_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'Session restored', ['session' => $session->toArray()]);
                    break;
                case 'pharmacy.queue':
                    $facilityId = $this->resolveRequestFacilityId();
                    $queue = $this->svc(PharmacyService::class)->getPharmacyQueue(
                        $facilityId,
                        $_REQUEST['visit_date'] ?? date('Y-m-d'),
                        $userId
                    );
                    $queue = $this->enrichQueuePayload($queue, $userId, $facilityId);
                    $this->respond(true, 'ok', $queue);
                    break;
                case 'pharmacy.select':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $payload = $this->svc(PharmacyService::class)->selectVisit(
                        (int) ($body['visit_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $payload);
                    break;
                case 'pharmacy.take':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $payload = $this->svc(PharmacyService::class)->takePatient(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0)
                    );
                    $this->respond(true, 'Patient taken', $payload);
                    break;
                case 'pharmacy.complete':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(PharmacyService::class)->completePharmacy(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        $this->esignOverrideReason($body),
                        $this->undispensedOverrideReason($body),
                        isset($body['pharmacy_outcome']) ? (string) $body['pharmacy_outcome'] : null,
                        $this->externalRxOverrideReason($body),
                    );
                    $this->respond(true, 'Pharmacy completed', $result);
                    break;
                case 'pharmacy.walkin_close':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(PharmacyService::class)->closeWalkinWithoutDispense(
                        (int) ($body['visit_id'] ?? 0),
                        (string) ($body['pharmacy_outcome'] ?? ''),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        $this->esignOverrideReason($body),
                    );
                    $this->respond(true, 'Pharmacy walk-in closed', $result);
                    break;
                case 'pharmacy.skip_to_payment':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(PharmacyService::class)->skipToPayment(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        (string) ($body['reason'] ?? '')
                    );
                    $this->respond(true, 'Skipped to payment', $result);
                    break;
                case 'pharmacy.shortcut_preflight':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $preflight = $this->svc(PharmacyShortcutService::class)->preflight(
                        (int) ($body['visit_id'] ?? 0),
                        (string) ($body['shortcut'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $preflight);
                    break;
                case 'pharmacy.restore_session':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $session = $this->svc(EncounterSessionService::class)->bindForVisitWithDeskAcl(
                        (int) ($body['visit_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'Session restored', ['session' => $session->toArray()]);
                    break;
                case 'admin.config':
                    $scope = strtolower(trim((string) ($_REQUEST['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($_REQUEST['facility_id'] ?? 0);
                    if ($scope === 'facility' && $requestedFacilityId <= 0 && !empty($_SESSION['facilityId'])) {
                        $requestedFacilityId = (int) $_SESSION['facilityId'];
                    }
                    $payload = $this->svc(ClinicAdminService::class)->getSettingsPayload(
                        $scope,
                        $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->respond(true, 'ok', $payload);
                    break;
                case 'admin.config.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->svc(ClinicAdminService::class)->saveSettings(
                        $scope,
                        (array) ($body['settings'] ?? []),
                        $userId,
                        $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->respond(true, 'Settings saved', $payload);
                    break;
                case 'admin.completion_weights.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->svc(ClinicAdminService::class)->saveCompletionFieldWeights(
                        (array) ($body['items'] ?? []),
                        $userId,
                        $scope,
                        $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->respond(true, 'Completion weights saved', $payload);
                    break;
                case 'admin.visit_type.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->svc(VisitTypeAdminService::class)->save(
                        $facilityId,
                        (array) ($body['visit_type'] ?? $body),
                        $userId
                    );
                    $this->respond(true, 'Visit type saved', $payload);
                    break;
                case 'admin.visit_type.archive':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->svc(VisitTypeAdminService::class)->archive(
                        $facilityId,
                        (int) ($body['visit_type_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'Visit type archived', $payload);
                    break;
                case 'admin.fee.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->svc(FeeScheduleAdminService::class)->save(
                        $facilityId,
                        (array) ($body['fee'] ?? $body),
                        $userId
                    );
                    $this->respond(true, 'Fee line saved', $payload);
                    break;
                case 'admin.fee.archive':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->svc(FeeScheduleAdminService::class)->archive(
                        $facilityId,
                        (int) ($body['fee_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'Fee line archived', $payload);
                    break;
                case 'admin.fee.billing_codes':
                    $codeType = (string) ($_REQUEST['code_type'] ?? '');
                    $query = (string) ($_REQUEST['q'] ?? '');
                    $codes = $this->svc(FeeScheduleAdminService::class)->searchBillingCodes($codeType, $query);
                    $this->respond(true, 'ok', ['billing_codes' => $codes]);
                    break;
                case 'admin.fee.import':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->svc(FeeScheduleAdminService::class)->importCsv(
                        $facilityId,
                        (string) ($body['csv'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'Fees imported', $payload);
                    break;
                case 'admin.roles.grant_self':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->requireSuperAdmin();
                    $username = (string) ($_SESSION['authUser'] ?? '');
                    if ($username === '') {
                        $this->respond(false, 'No logged-in user', [], 401);
                    }
                    $payload = $this->svc(ClinicAdminService::class)->grantDeskRolesToCurrentUser($username, $userId);
                    $this->respond(true, 'Roles granted — log out and back in for ACL to take effect', $payload);
                    break;
                case 'admin.roles.templates':
                    $facilityId = $this->resolveRequestFacilityId();
                    $this->respond(true, 'ok', $this->svc(StaffAdminService::class)->getTemplatesPayload($facilityId));
                    break;
                case 'admin.staff.list':
                    $page = max(1, (int) ($_REQUEST['page'] ?? 1));
                    $pageSize = max(1, min(100, (int) ($_REQUEST['page_size'] ?? 25)));
                    $search = (string) ($_REQUEST['search'] ?? '');
                    $status = (string) ($_REQUEST['status'] ?? 'active');
                    $this->respond(true, 'ok', $this->svc(StaffAdminService::class)->listStaff($page, $pageSize, $search, $status));
                    break;
                case 'admin.staff.create':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $body['facility_id'] = (int) ($body['facility_id'] ?? $this->resolveRequestFacilityId());
                    $payload = $this->svc(StaffAdminService::class)->createFromTemplate($body, $userId);
                    $this->respond(true, 'Staff created', $payload);
                    break;
                case 'admin.staff.deactivate':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $targetUserId = (int) ($body['user_id'] ?? 0);
                    if ($targetUserId <= 0) {
                        $this->respond(false, 'user_id required', [], 400);
                    }
                    $this->svc(StaffAdminService::class)->deactivateUser($targetUserId, $userId);
                    $this->respond(true, 'Staff deactivated');
                    break;
                case 'admin.staff.access_summary':
                    $targetUserId = (int) ($_REQUEST['user_id'] ?? 0);
                    if ($targetUserId <= 0) {
                        $this->respond(false, 'user_id required', [], 400);
                    }
                    $this->respond(true, 'ok', $this->svc(StaffAccessSummaryService::class)->getSummary($targetUserId));
                    break;
                case 'admin.facility_user.list':
                    $this->respond(true, 'ok', $this->svc(FacilityUserAdminService::class)->listMatrix());
                    break;
                case 'admin.facility_user.get':
                    $targetUserId = (int) ($_REQUEST['user_id'] ?? 0);
                    $facId = (int) ($_REQUEST['facility_id'] ?? $this->resolveRequestFacilityId());
                    if ($targetUserId <= 0 || $facId <= 0) {
                        $this->respond(false, 'user_id and facility_id required', [], 400);
                    }
                    $this->respond(true, 'ok', $this->svc(FacilityUserAdminService::class)->getForUserFacility($targetUserId, $facId));
                    break;
                case 'admin.facility_user.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $targetUserId = (int) ($body['user_id'] ?? 0);
                    $facId = (int) ($body['facility_id'] ?? 0);
                    $values = is_array($body['values'] ?? null) ? $body['values'] : [];
                    if ($targetUserId <= 0 || $facId <= 0) {
                        $this->respond(false, 'user_id and facility_id required', [], 400);
                    }
                    $this->svc(FacilityUserAdminService::class)->saveForUserFacility($targetUserId, $facId, $values);
                    $this->respond(true, 'Facility user fields saved');
                    break;
                case 'admin.facility_user.matrix':
                    $facilityFilter = (int) ($_REQUEST['facility_id'] ?? 0);
                    $search = (string) ($_REQUEST['search'] ?? '');
                    $this->respond(
                        true,
                        'ok',
                        $this->svc(FacilityUserAdminService::class)->getMatrixGrid(
                            $facilityFilter > 0 ? $facilityFilter : null,
                            $search
                        )
                    );
                    break;
                case 'admin.staff.get':
                    $targetUserId = (int) ($_REQUEST['user_id'] ?? 0);
                    if ($targetUserId <= 0) {
                        $this->respond(false, 'user_id required', [], 400);
                    }
                    $this->respond(true, 'ok', $this->svc(StaffAdminService::class)->getUserDetail($targetUserId));
                    break;
                case 'admin.staff.update':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $targetUserId = (int) ($body['user_id'] ?? 0);
                    if ($targetUserId <= 0) {
                        $this->respond(false, 'user_id required', [], 400);
                    }
                    $this->respond(true, 'Staff updated', $this->svc(StaffAdminService::class)->updateUser($targetUserId, $body, $userId));
                    break;
                case 'admin.staff.reset_password':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $targetUserId = (int) ($body['user_id'] ?? 0);
                    if ($targetUserId <= 0) {
                        $this->respond(false, 'user_id required', [], 400);
                    }
                    $this->svc(StaffAdminService::class)->resetPassword(
                        $targetUserId,
                        (string) ($body['admin_password'] ?? ''),
                        (string) ($body['new_password'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'Password reset');
                    break;
                case 'profile.get':
                    $this->respond(true, 'ok', $this->svc(MyProfileService::class)->getProfile($userId));
                    break;
                case 'profile.update':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->respond(true, 'Profile updated', $this->svc(MyProfileService::class)->updateProfile($userId, $body));
                    break;
                case 'profile.change_password':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->svc(MyProfileService::class)->changePassword(
                        $userId,
                        (string) ($body['current_password'] ?? ''),
                        (string) ($body['new_password'] ?? '')
                    );
                    $this->respond(true, 'Password updated');
                    break;
                case 'admin.acl.users':
                    $this->respond(true, 'ok', $this->svc(AclAdminService::class)->listUsers());
                    break;
                case 'admin.acl.membership':
                    $username = (string) ($_REQUEST['username'] ?? '');
                    $this->respond(true, 'ok', $this->svc(AclAdminService::class)->getMembership($username));
                    break;
                case 'admin.acl.membership_add':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $username = (string) ($body['username'] ?? '');
                    $groups = is_array($body['groups'] ?? null) ? $body['groups'] : [];
                    $this->respond(true, 'Membership updated', $this->svc(AclAdminService::class)->addMembership($username, $groups));
                    break;
                case 'admin.acl.membership_remove':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $username = (string) ($body['username'] ?? '');
                    $groups = is_array($body['groups'] ?? null) ? $body['groups'] : [];
                    $this->respond(true, 'Membership updated', $this->svc(AclAdminService::class)->removeMembership($username, $groups));
                    break;
                case 'admin.acl.groups':
                    $this->respond(true, 'ok', $this->svc(AclAdminService::class)->listGroups());
                    break;
                case 'admin.acl.group_permissions':
                    $group = (string) ($_REQUEST['group'] ?? '');
                    $returnValue = (string) ($_REQUEST['return_value'] ?? '');
                    $this->respond(true, 'ok', $this->svc(AclAdminService::class)->getGroupPermissions($group, $returnValue));
                    break;
                case 'admin.acl.group_permissions_add':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->respond(
                        true,
                        'Permissions updated',
                        $this->svc(AclAdminService::class)->addGroupPermissions(
                            (string) ($body['group'] ?? ''),
                            (string) ($body['return_value'] ?? ''),
                            is_array($body['aco_ids'] ?? null) ? $body['aco_ids'] : []
                        )
                    );
                    break;
                case 'admin.acl.group_permissions_remove':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->respond(
                        true,
                        'Permissions updated',
                        $this->svc(AclAdminService::class)->removeGroupPermissions(
                            (string) ($body['group'] ?? ''),
                            (string) ($body['return_value'] ?? ''),
                            is_array($body['aco_ids'] ?? null) ? $body['aco_ids'] : []
                        )
                    );
                    break;
                case 'admin.acl.return_values':
                    $this->respond(true, 'ok', $this->svc(AclAdminService::class)->listReturnValues());
                    break;
                case 'admin.acl.group_create':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->respond(
                        true,
                        'ACL group created',
                        $this->svc(AclAdminService::class)->createGroup(
                            (string) ($body['title'] ?? ''),
                            (string) ($body['identifier'] ?? ''),
                            (string) ($body['return_value'] ?? ''),
                            (string) ($body['description'] ?? '')
                        )
                    );
                    break;
                case 'admin.acl.group_remove':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->respond(
                        true,
                        'ACL group removed',
                        $this->svc(AclAdminService::class)->removeGroup(
                            (string) ($body['title'] ?? ''),
                            (string) ($body['return_value'] ?? '')
                        )
                    );
                    break;
                case 'reports.daily':
                    $facilityId = $this->resolveRequestFacilityId();
                    $report = $this->svc(ReportsService::class)->getDailyReport(
                        $facilityId,
                        $_REQUEST['visit_date'] ?? date('Y-m-d')
                    );
                    $this->respond(true, 'ok', $report);
                    break;
                case 'reports.scheduling':
                    $facilityId = $this->resolveRequestFacilityId();
                    $visitDate = (string) ($_REQUEST['visit_date'] ?? date('Y-m-d'));
                    $this->respond(true, 'ok', $this->svc(ReportsSchedulingService::class)->getReport($facilityId, $visitDate));
                    break;
                case 'reports.ancillary':
                    $facilityId = $this->resolveRequestFacilityId();
                    $startDate = (string) ($_REQUEST['start_date'] ?? $_REQUEST['visit_date'] ?? date('Y-m-d'));
                    $endDate = (string) ($_REQUEST['end_date'] ?? $startDate);
                    try {
                        $this->respond(true, 'ok', $this->svc(ReportsAncillaryService::class)->getReport($facilityId, $startDate, $endDate));
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_date'], 400);
                    }
                    break;
                case 'reports.ancillary_export':
                    $facilityId = $this->resolveRequestFacilityId();
                    $startDate = (string) ($_REQUEST['start_date'] ?? $_REQUEST['visit_date'] ?? date('Y-m-d'));
                    $endDate = (string) ($_REQUEST['end_date'] ?? $startDate);
                    try {
                        $export = $this->svc(ReportsAncillaryService::class)->exportCsv($facilityId, $startDate, $endDate);
                        $this->respondCsv($export['filename'], $export['content']);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_date'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
                    }
                    break;
                case 'reports.documentation_integrity':
                    $facilityId = $this->resolveRequestFacilityId();
                    $startDate = (string) ($_REQUEST['start_date'] ?? $_REQUEST['visit_date'] ?? date('Y-m-d'));
                    $endDate = (string) ($_REQUEST['end_date'] ?? $startDate);
                    try {
                        $this->respond(true, 'ok', $this->svc(ReportsDocumentationIntegrityService::class)->getReport(
                            $facilityId,
                            $startDate,
                            $endDate
                        ));
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_date'], 400);
                    }
                    break;
                case 'reports.documentation_integrity_export':
                    $facilityId = $this->resolveRequestFacilityId();
                    $startDate = (string) ($_REQUEST['start_date'] ?? $_REQUEST['visit_date'] ?? date('Y-m-d'));
                    $endDate = (string) ($_REQUEST['end_date'] ?? $startDate);
                    try {
                        $export = $this->svc(ReportsDocumentationIntegrityService::class)->exportCsv($facilityId, $startDate, $endDate);
                        $this->respondCsv($export['filename'], $export['content']);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_date'], 400);
                    }
                    break;
                case 'reports.reconciliation':
                    $facilityId = $this->resolveRequestFacilityId();
                    $runDate = (string) ($_REQUEST['run_date'] ?? date('Y-m-d'));
                    $this->respond(true, 'ok', [
                        'latest_run' => $this->svc(ReconciliationService::class)->getLatestRun($facilityId),
                        'totals' => $this->svc(ReconciliationService::class)->fetchTotals($facilityId, $runDate),
                    ]);
                    break;
                case 'reports.hub_summary':
                    $this->svc(ReportHubAccessService::class)->assertHubAccess();
                    $facilityId = $this->resolveRequestFacilityId();
                    $visitDate = (string) ($_REQUEST['visit_date'] ?? date('Y-m-d'));
                    $daily = $this->svc(ReportsService::class)->getDailyReport($facilityId, $visitDate);
                    $visits = is_array($daily['visits'] ?? null) ? $daily['visits'] : [];
                    $cash = is_array($daily['cash'] ?? null) ? $daily['cash'] : [];
                    $currency = is_array($daily['currency'] ?? null)
                        ? (string) ($daily['currency']['currency_symbol'] ?? 'GH₵')
                        : 'GH₵';
                    $this->respond(true, 'ok', [
                        'visit_date' => (string) ($daily['visit_date'] ?? $visitDate),
                        'visits_started' => (int) ($visits['started'] ?? 0),
                        'cash_total' => (float) ($cash['total_collected'] ?? 0),
                        'receipt_count' => (int) ($cash['receipt_count'] ?? 0),
                        'currency_symbol' => $currency,
                    ]);
                    break;
                case 'reports.catalog':
                    $this->svc(ReportHubAccessService::class)->assertHubAccess();
                    $facilityId = $this->resolveRequestFacilityId();
                    $lens = isset($_REQUEST['lens']) ? (string) $_REQUEST['lens'] : null;
                    if ($lens === '') {
                        $lens = null;
                    }
                    $this->respond(true, 'ok', $this->svc(ReportHubCatalogService::class)->getCatalog($lens, $facilityId));
                    break;
                case 'reports.run':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $preview = $this->svc(ReportHubExportService::class)->runReportPreview($body, $userId);
                        $this->respond(true, 'ok', $preview);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'reports.export':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $export = $this->svc(ReportHubExportService::class)->requestExport($body, $userId);
                        if (($export['mode'] ?? '') === 'sync') {
                            $this->respondCsv((string) $export['filename'], (string) $export['content']);
                        }
                        $this->respond(true, 'ok', $export);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'reports.export_status':
                    $this->requireReportHubExportAcl();
                    $jobId = (int) ($_REQUEST['job_id'] ?? 0);
                    try {
                        $status = $this->svc(ReportHubExportService::class)->pollExportStatus($jobId, $userId);
                        $this->respond(true, 'ok', $status);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'export_status'], (int) ($e->getCode() ?: 400));
                    }
                    break;
                case 'reports.export_download':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $jobId = (int) ($body['job_id'] ?? 0);
                    try {
                        $download = $this->svc(ReportHubExportService::class)->readExportDownload($jobId, $userId);
                        $this->respondCsv($download['filename'], $download['content']);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'export_download'], (int) ($e->getCode() ?: 400));
                    }
                    break;
                case 'reports.export_run':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $recorded = $this->svc(ReportHubExportService::class)->recordExportRun($body, $userId);
                    $this->respond(true, 'ok', $recorded);
                    break;
                case 'queue_bridge.list':
                    $facilityId = $this->resolveRequestFacilityId();
                    $lens = (string) ($_REQUEST['lens'] ?? 'action');
                    $page = max(1, (int) ($_REQUEST['page'] ?? 1));
                    $this->respond(true, 'ok', $this->svc(QueueBridgeService::class)->listExceptions($facilityId, $lens, $page));
                    break;
                case 'queue_bridge.eod_export':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $this->svc(QueueBridgeAccessService::class)->assertHubAccess();
                        $export = $this->svc(QueueBridgeService::class)->exportEodCsv($facilityId);
                        $this->respondCsv($export['filename'], $export['content']);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
                    }
                    break;
                case 'queue_bridge.resolve':
                case 'queue_bridge.link_appointment':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = $this->resolveRequestFacilityId();
                    $resolveAction = $action === 'queue_bridge.link_appointment'
                        ? 'link_appointment'
                        : (string) ($body['action'] ?? '');
                    try {
                        $result = $this->svc(QueueBridgeService::class)->resolve(
                            (string) ($body['exception_code'] ?? ''),
                            $resolveAction,
                            (int) ($body['pid'] ?? 0),
                            $facilityId,
                            $userId,
                            isset($body['pc_eid']) ? (int) $body['pc_eid'] : null,
                            isset($body['visit_id']) ? (int) $body['visit_id'] : null,
                            isset($body['appt_date']) ? (string) $body['appt_date'] : null,
                            isset($body['visit_type_id']) ? (int) $body['visit_type_id'] : null,
                            isset($body['cancel_reason']) ? (string) $body['cancel_reason'] : null,
                        );
                        $this->respond(true, 'ok', $result);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.list':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $board = $this->svc(SchedulingFlowBoardService::class)->getBoard(
                            $facilityId,
                            (string) ($_REQUEST['date'] ?? date('Y-m-d')),
                            $this->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                        );
                        $this->respond(true, 'ok', $board);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.poll':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $board = $this->svc(SchedulingFlowBoardService::class)->pollBoard(
                            $facilityId,
                            (string) ($_REQUEST['date'] ?? date('Y-m-d')),
                            $this->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                            (string) ($_REQUEST['revision'] ?? ''),
                        );
                        $this->respond(true, 'ok', $board);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.advance':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $facilityId = $this->resolveRequestFacilityId();
                        $this->svc(SchedulingFlowBoardService::class)->advanceStatus(
                            $facilityId,
                            (int) ($body['pc_eid'] ?? 0),
                            (string) ($body['status'] ?? ''),
                            $userId
                        );
                        $board = $this->svc(SchedulingFlowBoardService::class)->getBoard(
                            $facilityId,
                            (string) ($body['date'] ?? date('Y-m-d')),
                            $this->parseOptionalPositiveInt($body['provider_id'] ?? null),
                        );
                        $this->respond(true, 'ok', $board);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.room':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $facilityId = $this->resolveRequestFacilityId();
                        $this->svc(SchedulingFlowBoardService::class)->updateRoom(
                            $facilityId,
                            (int) ($body['pc_eid'] ?? 0),
                            (string) ($body['room'] ?? ''),
                            $userId
                        );
                        $board = $this->svc(SchedulingFlowBoardService::class)->getBoard(
                            $facilityId,
                            (string) ($body['date'] ?? date('Y-m-d')),
                            $this->parseOptionalPositiveInt($body['provider_id'] ?? null),
                        );
                        $this->respond(true, 'ok', $board);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.prefs':
                    try {
                        $prefs = $this->svc(SchedulingFlowBoardPrefsService::class)->getPrefs($userId);
                        $this->respond(true, 'ok', $prefs);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.prefs.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $collapsed = is_array($body['collapsed'] ?? null) ? $body['collapsed'] : [];
                        $order = is_array($body['order'] ?? null) ? $body['order'] : [];
                        $prefs = $this->svc(SchedulingFlowBoardPrefsService::class)->savePrefs($userId, $collapsed, $order);
                        $this->respond(true, 'ok', $prefs);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.lane_map':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $config = $this->svc(SchedulingFlowBoardLaneMapService::class)->getAdminConfig($facilityId);
                        $this->respond(true, 'ok', $config);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.lane_map.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $rows = is_array($body['rows'] ?? null) ? $body['rows'] : [];
                        $config = $this->svc(SchedulingFlowBoardLaneMapService::class)->saveAdminConfig($facilityId, $rows);
                        $this->respond(true, 'ok', $config);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.range':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $view = (string) ($_REQUEST['view'] ?? 'day');
                        $range = $this->svc(SchedulingCalendarService::class)->getRangeView(
                            $facilityId,
                            (string) ($_REQUEST['date'] ?? date('Y-m-d')),
                            $view,
                            $this->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                        );
                        $this->respond(true, 'ok', $range);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.poll':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $view = (string) ($_REQUEST['view'] ?? 'day');
                        $range = $this->svc(SchedulingCalendarService::class)->pollRangeView(
                            $facilityId,
                            (string) ($_REQUEST['date'] ?? date('Y-m-d')),
                            $view,
                            $this->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                            (string) ($_REQUEST['revision'] ?? ''),
                        );
                        $this->respond(true, 'ok', $range);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.move':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $facilityId = $this->resolveRequestFacilityId();
                        $payload = $this->svc(SchedulingCalendarService::class)->moveAppointment($facilityId, $body, $userId);
                        $this->respond(true, 'ok', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.resize':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $facilityId = $this->resolveRequestFacilityId();
                        $payload = $this->svc(SchedulingCalendarService::class)->resizeAppointment($facilityId, $body, $userId);
                        $this->respond(true, 'ok', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.book':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $facilityId = $this->resolveRequestFacilityId();
                        $day = $this->svc(SchedulingCalendarService::class)->bookAppointment($facilityId, $body, $userId);
                        $this->respond(true, 'ok', $day);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.list':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $worklist = $this->svc(SchedulingRecallsService::class)->getWorklist(
                            $facilityId,
                            $this->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                            (string) ($_REQUEST['bucket'] ?? 'due'),
                            $this->parseOptionalPositiveInt($_REQUEST['pid'] ?? null),
                            trim((string) ($_REQUEST['q'] ?? '')),
                        );
                        $this->respond(true, 'ok', $worklist);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $facilityId = $this->resolveRequestFacilityId();
                        $worklist = $this->svc(SchedulingRecallsService::class)->saveRecall($facilityId, $body, $userId);
                        $this->respond(true, 'ok', $worklist);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.delete':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $this->svc(SchedulingRecallsService::class)->deleteRecall((int) ($body['recall_id'] ?? 0), $userId);
                        $facilityId = $this->resolveRequestFacilityId();
                        $worklist = $this->svc(SchedulingRecallsService::class)->getWorklist(
                            $facilityId,
                            $this->parseOptionalPositiveInt($body['provider_id'] ?? null),
                            (string) ($body['bucket'] ?? 'due'),
                        );
                        $this->respond(true, 'ok', $worklist);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.update_status':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $result = $this->svc(SchedulingRecallsService::class)->updateStatus(
                            (int) ($body['recall_id'] ?? 0),
                            (string) ($body['status'] ?? ''),
                            isset($body['note']) ? (string) $body['note'] : null,
                            $userId,
                        );
                        $facilityId = $this->resolveRequestFacilityId();
                        $worklist = $this->svc(SchedulingRecallsService::class)->getWorklist(
                            $facilityId,
                            $this->parseOptionalPositiveInt($body['provider_id'] ?? null),
                            (string) ($body['bucket'] ?? 'due'),
                        );
                        $this->respond(true, 'ok', ['status' => $result, 'worklist' => $worklist]);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.snooze':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $this->svc(SchedulingRecallsService::class)->snoozeRecall(
                            (int) ($body['recall_id'] ?? 0),
                            (int) ($body['days'] ?? 7),
                            $userId,
                            isset($body['note']) ? (string) $body['note'] : '',
                        );
                        $facilityId = $this->resolveRequestFacilityId();
                        $worklist = $this->svc(SchedulingRecallsService::class)->getWorklist(
                            $facilityId,
                            $this->parseOptionalPositiveInt($body['provider_id'] ?? null),
                            (string) ($body['bucket'] ?? 'due'),
                            $this->parseOptionalPositiveInt($body['pid'] ?? null),
                        );
                        $this->respond(true, 'ok', $worklist);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.send_reminder':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $result = $this->svc(SchedulingRecallsService::class)->sendRecallReminder(
                            (int) ($body['recall_id'] ?? 0),
                            $userId,
                        );
                        $this->respond(true, 'ok', $result);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'queue_bridge.dismiss':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $result = $this->svc(QueueBridgeService::class)->dismiss(
                            (string) ($body['exception_code'] ?? ''),
                            (int) ($body['pid'] ?? 0),
                            $facilityId,
                            $userId,
                            (string) ($body['reason'] ?? ''),
                            isset($body['pc_eid']) ? (int) $body['pc_eid'] : null,
                            isset($body['visit_id']) ? (int) $body['visit_id'] : null,
                        );
                        $this->respond(true, 'ok', $result);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'clinical_doc.visit_summary':
                    $this->svc(ClinicalDocAccessService::class)->assertHubAccess();
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    $lens = isset($_REQUEST['lens']) ? (string) $_REQUEST['lens'] : null;
                    if ($lens === '') {
                        $lens = null;
                    }
                    try {
                        $summary = $this->svc(ClinicalDocVisitSummaryService::class)->getVisitSummary($visitId, $userId, $lens);
                        $this->respond(true, 'ok', $summary);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 400);
                        $this->respond(false, $e->getMessage(), ['code' => $code === 409 ? 'no_encounter_on_visit' : 'error'], $code);
                    }
                    break;
                case 'clinical_doc.catalog':
                    $this->svc(ClinicalDocAccessService::class)->assertHubAccess();
                    $facilityId = $this->resolveRequestFacilityId();
                    $lens = isset($_REQUEST['lens']) ? (string) $_REQUEST['lens'] : null;
                    if ($lens === '') {
                        $lens = null;
                    }
                    $this->respond(true, 'ok', $this->svc(ClinicalDocCatalogService::class)->getCatalog($lens, $facilityId));
                    break;
                case 'clinical_doc.sign_status':
                    $this->svc(ClinicalDocAccessService::class)->assertHubAccess();
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    try {
                        $status = $this->svc(ClinicalDocVisitSummaryService::class)->getSignStatus($visitId);
                        $this->respond(true, 'ok', $status);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 400);
                        $this->respond(false, $e->getMessage(), ['code' => $code === 409 ? 'no_encounter_on_visit' : 'error'], $code);
                    }
                    break;
                case 'clinical_doc.open_form':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $result = $this->svc(ClinicalDocFormOpenService::class)->openForm($body, $userId);
                        $this->respond(true, 'ok', $result);
                    } catch (EncounterSessionMismatchException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'session_mismatch'], 409);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'encounter_note.get':
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    if ($visitId <= 0) {
                        $this->respond(false, 'visit_id required', [], 400);
                    }
                    try {
                        $payload = $this->svc(EncounterNoteService::class)->get($visitId, $userId);
                        $this->respond(true, 'ok', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'encounter_note.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $payload = $this->svc(EncounterNoteService::class)->save($body, $userId);
                        $this->respond(true, 'Saved', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'encounter_note.prefill':
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    if ($visitId <= 0) {
                        $this->respond(false, 'visit_id required', [], 400);
                    }
                    try {
                        $payload = $this->svc(EncounterNoteService::class)->prefill($visitId, $userId);
                        $this->respond(true, 'ok', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'encounter_note.validate':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $payload = $this->svc(EncounterNoteService::class)->validate($body, $userId);
                        $this->respond(true, 'ok', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'encounter_note.sign':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $payload = $this->svc(EncounterNoteService::class)->sign($body, $userId);
                        $this->respond(true, 'Signed', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'encounter_note.unlock':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $payload = $this->svc(EncounterNoteService::class)->unlockForClinicalCorrection($body, $userId);
                        $this->respond(true, 'Unlocked', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'clinical_doc.favorites':
                    $this->svc(ClinicalDocAccessService::class)->assertHubAccess();
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    if ($visitId <= 0) {
                        $this->respond(false, 'visit_id required', [], 400);
                    }
                    try {
                        $favorites = $this->svc(ClinicalDocVisitSummaryService::class)->getFavorites($visitId, $userId);
                        $this->respond(true, 'ok', $favorites);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 400);
                        $this->respond(false, $e->getMessage(), ['code' => $code === 409 ? 'no_encounter_on_visit' : 'error'], $code);
                    }
                    break;
                case 'clinical_doc.import_ghana_pack':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->requireSuperAdmin();
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $setAsConsultNote = !empty($body['set_as_consult_note']);
                    $payload = $this->svc(ClinicAdminService::class)->importGhanaOpdLbfPack(
                        $scope,
                        $userId,
                        $setAsConsultNote,
                        $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->respond(true, 'Ghana OPD LBF pack imported', $payload);
                    break;
                case 'clinical_doc.import_referral_hospital_pack':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->requireSuperAdmin();
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $setAsConsultNote = !empty($body['set_as_consult_note']);
                    $payload = $this->svc(ClinicAdminService::class)->importReferralHospitalLbfPack(
                        $scope,
                        $userId,
                        $setAsConsultNote,
                        $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->respond(true, 'Referral hospital LBF pack imported', $payload);
                    break;
                case 'clinical_doc.import_ancillary_pack':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->requireSuperAdmin();
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $packKey = strtolower(trim((string) ($body['pack_key'] ?? '')));
                    if ($packKey === '') {
                        $this->respond(false, 'pack_key required', [], 400);
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->svc(ClinicAdminService::class)->importAncillaryLbfPack(
                            $scope,
                            $userId,
                            $packKey,
                            $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->respond(true, 'Ancillary LBF pack imported', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_pack'], 400);
                    }
                    break;
                case 'admin.reconciliation.run':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = $this->resolveRequestFacilityId();
                    $runDate = (string) ($body['run_date'] ?? date('Y-m-d'));
                    $result = $this->svc(ReconciliationService::class)->run($facilityId, $runDate, 'manual', $userId);
                    $this->respond(true, 'Reconciliation complete', $result);
                    break;
                case 'admin.profile.apply_cash_clinic':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->requireSuperAdmin();
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->svc(ClinicAdminService::class)->applyCashClinicProfile(
                        $scope,
                        $userId,
                        $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->respond(true, 'Cash clinic profile applied', $payload);
                    break;
                case 'admin.forms_catalog.set_state':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $registryId = (int) ($body['registry_id'] ?? 0);
                    $enabled = !empty($body['enabled']);
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->svc(ClinicAdminService::class)->setFormsCatalogState(
                            $scope,
                            $registryId,
                            $enabled,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->respond(true, 'Form registry updated', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'admin.health_status':
                    $params = $this->readRequestParams($method);
                    $scope = strtolower(trim((string) ($params['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($params['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $this->respond(true, 'ok', [
                        'system_health' => $this->svc(ClinicAdminService::class)->getSystemHealth(
                            $scope,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        ),
                    ]);
                    break;
                case 'admin.backup.run':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->svc(ClinicAdminService::class)->initiateBackupRun(
                            $scope,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->respond(true, 'Backup started', $payload);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'admin.backup.complete':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $runId = (int) ($body['run_id'] ?? 0);
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->svc(ClinicAdminService::class)->completeBackupRun(
                            $scope,
                            $userId,
                            $runId > 0 ? $runId : null,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->respond(true, 'Backup marked complete', $payload);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'admin.setup.mark_item':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $checklistKey = trim((string) ($body['checklist_key'] ?? ''));
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->svc(ClinicAdminService::class)->markSetupItem(
                            $scope,
                            $checklistKey,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->respond(true, 'Setup item marked', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    }
                    break;
                case 'admin.setup.complete':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->svc(ClinicAdminService::class)->markSetupComplete(
                            $scope,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->respond(true, 'Setup marked complete', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    }
                    break;
                case 'admin.config.export':
                    $scope = strtolower(trim((string) ($_REQUEST['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($_REQUEST['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->svc(ClinicAdminService::class)->exportConfigSnapshot(
                            $scope,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->respond(true, 'Config export ready', $payload);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'admin.config.import':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $snapshot = is_array($body['snapshot'] ?? null) ? $body['snapshot'] : [];
                    $dryRun = !empty($body['dry_run']);
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->svc(ClinicAdminService::class)->importConfigSnapshot(
                            $scope,
                            $snapshot,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null,
                            $dryRun
                        );
                        $message = $dryRun ? 'Config import preview ready' : 'Config import complete';
                        $this->respond(true, $message, $payload);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    }
                    break;
                case 'queue.counts':
                    $facilityId = $this->resolveRequestFacilityId();
                    $counts = $this->svc(VisitQueueService::class)->getCounts($facilityId);
                    $this->respond(true, 'ok', [
                        'counts' => $counts,
                        'last_updated' => date('c'),
                    ]);
                    break;
                case 'switch_role':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $role = (string) ($body['role'] ?? '');
                    $result = $this->svc(SessionRoleService::class)->switchRole($role, $userId);
                    $this->respond(true, 'ok', $result);
                    break;
                case 'communications.hub_counts':
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $counts = $this->svc(CommunicationsHubService::class)->hubCounts($authUser, $userId);
                    $this->respond(true, 'ok', $counts);
                    break;
                case 'communications.messages_list':
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $list = $this->svc(CommunicationsHubService::class)->listMessages($authUser, [
                        'activity' => $_REQUEST['activity'] ?? '1',
                        'show_all' => $_REQUEST['show_all'] ?? '',
                        'sortby' => $_REQUEST['sortby'] ?? 'pnotes.date',
                        'sortorder' => $_REQUEST['sortorder'] ?? 'desc',
                        'begin' => $_REQUEST['begin'] ?? 0,
                        'limit' => $_REQUEST['limit'] ?? 25,
                        'q' => $_REQUEST['q'] ?? '',
                    ]);
                    $this->respond(true, 'ok', $list);
                    break;
                case 'communications.message_detail':
                    $noteId = (int) ($_REQUEST['id'] ?? 0);
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $detail = $this->svc(CommunicationsHubService::class)->getMessageDetail($noteId, $authUser);
                    $this->respond(true, 'ok', $detail);
                    break;
                case 'communications.reminders_list':
                    $days = (int) ($_REQUEST['days'] ?? 30);
                    $list = $this->svc(CommunicationsHubService::class)->listReminders($userId, $days);
                    $this->respond(true, 'ok', $list);
                    break;
                case 'communications.message_done':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $noteId = (int) ($body['noteid'] ?? $body['id'] ?? 0);
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $this->svc(CommunicationsHubService::class)->markMessageDone($noteId, $authUser);
                    $this->respond(true, 'ok', ['id' => $noteId]);
                    break;
                case 'communications.message_status':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $noteId = (int) ($body['noteid'] ?? $body['id'] ?? 0);
                    $messageStatus = trim((string) ($body['message_status'] ?? ''));
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $this->svc(CommunicationsHubService::class)->setMessageStatus($noteId, $messageStatus, $authUser);
                    $this->respond(true, 'ok', ['id' => $noteId, 'message_status' => $messageStatus]);
                    break;
                case 'communications.assign_patient':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $noteId = (int) ($body['noteid'] ?? $body['id'] ?? 0);
                    $pid = (int) ($body['pid'] ?? 0);
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $result = $this->svc(CommunicationsHubService::class)->assignMessagePatient($noteId, $pid, $authUser);
                    $this->respond(true, 'ok', $result);
                    break;
                case 'communications.message_delete':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $noteId = (int) ($body['noteid'] ?? $body['id'] ?? 0);
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $this->svc(CommunicationsHubService::class)->deleteMessage($noteId, $authUser);
                    $this->respond(true, 'ok', ['id' => $noteId]);
                    break;
                case 'communications.reminder_done':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $reminderId = (int) ($body['dr_id'] ?? $body['id'] ?? 0);
                    $this->svc(CommunicationsHubService::class)->markReminderProcessed($reminderId, $userId);
                    $this->respond(true, 'ok', ['id' => $reminderId]);
                    break;
                case 'communications.compose_options':
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $replyNoteId = (int) ($_REQUEST['reply_note_id'] ?? 0);
                    $options = $this->svc(CommunicationsHubService::class)->getComposeOptions(
                        $replyNoteId > 0 ? $replyNoteId : null,
                        $authUser
                    );
                    $this->respond(true, 'ok', $options);
                    break;
                case 'communications.message_send':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $result = $this->svc(CommunicationsHubService::class)->sendMessage($body, $authUser, $userId);
                    $this->respond(true, 'ok', $result);
                    break;
                case 'communications.reminder_create_options':
                    $forwardReminderId = (int) ($_REQUEST['forward_reminder_id'] ?? 0);
                    $options = $this->svc(CommunicationsHubService::class)->getReminderCreateOptions(
                        $userId,
                        $forwardReminderId > 0 ? $forwardReminderId : null
                    );
                    $this->respond(true, 'ok', $options);
                    break;
                case 'communications.reminder_create':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(CommunicationsHubService::class)->createReminder($body, $userId);
                    $this->respond(true, 'ok', $result);
                    break;
                case 'communications.reminder_log':
                    $filters = [
                        'sent_by' => $_REQUEST['sent_by'] ?? null,
                        'sent_to' => $_REQUEST['sent_to'] ?? null,
                        'processed' => $_REQUEST['processed'] ?? null,
                        'date_from' => $_REQUEST['date_from'] ?? null,
                        'date_to' => $_REQUEST['date_to'] ?? null,
                    ];
                    $log = $this->svc(CommunicationsHubService::class)->listReminderLog($userId, $filters);
                    $this->respond(true, 'ok', $log);
                    break;
                case 'communications.save_preferences':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $canViewAll = AclMain::aclCheckCore('admin', 'super');
                    $prefs = $this->svc(CommHubUserSettingsService::class)->savePreferences($body, $canViewAll);
                    $this->respond(true, 'ok', $prefs);
                    break;
                case 'cohort.presets':
                    $this->svc(PatientCohortSearchService::class)->assertRegistryAccess();
                    $this->respond(true, 'ok', $this->svc(PatientCohortSearchService::class)->presets());
                    break;
                case 'cohort.search':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(PatientCohortSearchService::class)->search($body);
                    $this->svc(RegistryAuditService::class)->logSearch(
                        (string) ($result['meta']['filter_summary'] ?? ''),
                        (int) ($result['total'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $result);
                    break;
                case 'cohort.export':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $export = $this->svc(PatientCohortSearchService::class)->export($body);
                        $filters = is_array($body['filters'] ?? null) ? $body['filters'] : [];
                        $this->svc(RegistryAuditService::class)->logExport(
                            $this->svc(PatientCohortSearchService::class)->explainCriteria($filters),
                            (int) $export['row_count'],
                            $userId
                        );
                        $this->respondCsv($export['filename'], $export['content']);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'export_limit'], 400);
                    }
                    break;
                case 'cohort.saved_filter':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $operation = strtolower(trim((string) ($body['operation'] ?? 'save')));
                    if ($operation === 'delete') {
                        $this->svc(CohortSavedFilterService::class)->delete(
                            $userId,
                            (int) ($body['id'] ?? 0)
                        );
                        $this->respond(true, 'ok', ['deleted' => true]);
                        break;
                    }
                    $saved = $this->svc(CohortSavedFilterService::class)->save($userId, $body);
                    $this->respond(true, 'ok', $saved);
                    break;
                case 'lab_ops.worklist':
                    $body = $this->readRequestParams($method);
                    $worklist = $this->svc(LabOpsWorklistService::class)->worklist([
                        'tab' => $body['tab'] ?? LabOpsWorklistService::TAB_PENDING,
                        'date' => $body['date'] ?? '',
                        'facility_id' => $body['facility_id'] ?? 0,
                        'fulfillment' => $body['fulfillment'] ?? 'all',
                        'urgent_first' => $body['urgent_first'] ?? true,
                    ], $userId);
                    $this->respond(true, 'ok', $worklist);
                    break;
                case 'pharm_ops.worklist':
                    $body = $this->readRequestParams($method);
                    $pharmWorklist = $this->svc(PharmOpsWorklistService::class)->worklist([
                        'tab' => $body['tab'] ?? PharmOpsWorklistService::TAB_PENDING_DISPENSE,
                        'date' => $body['date'] ?? '',
                        'facility_id' => $body['facility_id'] ?? 0,
                        'filters' => is_array($body['filters'] ?? null) ? $body['filters'] : [],
                        'urgent_first' => $body['urgent_first'] ?? true,
                    ], $userId);
                    $this->respond(true, 'ok', $pharmWorklist);
                    break;
                case 'pharm_ops.dispense_get':
                    $body = $this->readRequestParams($method);
                    $prescriptionId = (int) ($body['prescription_id'] ?? $_REQUEST['prescription_id'] ?? 0);
                    $form = $this->svc(PharmOpsDispenseService::class)->getDispenseForm($prescriptionId);
                    $this->respond(true, 'ok', $form);
                    break;
                case 'pharm_ops.dispense_confirm':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $confirmed = $this->svc(PharmOpsDispenseService::class)->confirmDispense(
                        (int) ($body['prescription_id'] ?? 0),
                        $body,
                        $userId
                    );
                    $this->respond(true, 'ok', $confirmed);
                    break;
                case 'pharm_ops.otc_drugs_search':
                    $body = $this->readRequestParams($method);
                    $drugSearch = $this->svc(PharmOpsOtcSaleService::class)->searchDrugs(
                        (string) ($body['q'] ?? $_REQUEST['q'] ?? ''),
                        (int) ($body['limit'] ?? 20)
                    );
                    $this->respond(true, 'ok', $drugSearch);
                    break;
                case 'pharm_ops.otc_sale_get':
                    $body = $this->readRequestParams($method);
                    $otcForm = $this->svc(PharmOpsOtcSaleService::class)->getSaleForm(
                        (int) ($body['pid'] ?? 0),
                        (int) ($body['drug_id'] ?? 0),
                        isset($body['encounter_id']) ? (int) $body['encounter_id'] : null
                    );
                    $this->respond(true, 'ok', $otcForm);
                    break;
                case 'pharm_ops.otc_sale_confirm':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $otcSale = $this->svc(PharmOpsOtcSaleService::class)->confirmSale($body, $userId);
                    $this->respond(true, 'ok', $otcSale);
                    break;
                case 'pharm_ops.receive_get':
                    $body = $this->readRequestParams($method);
                    $receiveForm = $this->svc(PharmOpsReceiveService::class)->getReceiveForm(
                        isset($body['drug_id']) ? (int) $body['drug_id'] : null
                    );
                    $this->respond(true, 'ok', $receiveForm);
                    break;
                case 'pharm_ops.receive_save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $received = $this->svc(PharmOpsReceiveService::class)->saveReceive($body, $userId);
                    $this->respond(true, 'ok', $received);
                    break;
                case 'pharm_ops.setup_status':
                    $setupStatus = $this->svc(PharmOpsSetupService::class)->getSetupStatus();
                    $this->respond(true, 'ok', $setupStatus);
                    break;
                case 'pharm_ops.reports_embed':
                    $reportsEmbed = $this->svc(PharmOpsReportsService::class)->embedCatalog();
                    $this->respond(true, 'ok', $reportsEmbed);
                    break;
                case 'pharm_ops.controlled_catalog':
                    (new PharmOpsAccessService())->assertCatalogAccess();
                    $controlledCatalog = [
                        'drugs' => $this->svc(PharmDrugMetaService::class)->listActiveCatalogFlags(),
                    ];
                    $this->respond(true, 'ok', $controlledCatalog);
                    break;
                case 'pharm_ops.controlled_catalog_save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    (new PharmOpsAccessService())->assertCatalogAccess();
                    $saved = $this->svc(PharmDrugMetaService::class)->saveControlledFlags($body['drugs'] ?? []);
                    $this->respond(true, 'ok', [
                        'saved' => $saved,
                        'drugs' => $this->svc(PharmDrugMetaService::class)->listActiveCatalogFlags(),
                    ]);
                    break;
                case 'pharm_ops.destroy_get':
                    $body = $this->readRequestParams($method);
                    $destroyForm = $this->svc(PharmOpsDestroyService::class)->getDestroyForm(
                        (int) ($body['drug_id'] ?? 0),
                        (int) ($body['inventory_id'] ?? 0)
                    );
                    $this->respond(true, 'ok', $destroyForm);
                    break;
                case 'pharm_ops.destroy_confirm':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $destroyed = $this->svc(PharmOpsDestroyService::class)->confirmDestroy($body, $userId);
                    $this->respond(true, 'ok', $destroyed);
                    break;
                case 'pharm_ops.rx_print_pdf':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $rxPrint = $this->svc(PharmOpsRxPrintService::class)->preparePrint(
                        (int) ($body['prescription_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $rxPrint);
                    break;
                case 'pharm_ops.dispense_label_pdf':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $labelPrint = $this->svc(PharmOpsDispenseLabelService::class)->preparePrint(
                        (int) ($body['sale_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $labelPrint);
                    break;
                case 'pharm_ops.warehouse_create':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $warehouse = $this->svc(PharmOpsSetupService::class)->createDefaultWarehouse(
                        (string) ($body['warehouse_title'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $warehouse);
                    break;
                case 'pharm_ops.formulary_import':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $imported = $this->svc(PharmOpsSetupService::class)->importStarterFormulary(
                        !empty($body['use_starter']) ? null : (string) ($body['csv'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $imported);
                    break;
                case 'lab_ops.result_get':
                    $orderId = (int) ($_REQUEST['procedure_order_id'] ?? 0);
                    if ($method === 'POST') {
                        $body = $this->readRequestParams($method);
                        $orderId = (int) ($body['procedure_order_id'] ?? $orderId);
                    }
                    $form = $this->svc(LabOpsResultService::class)->getEntryForm($orderId);
                    $this->respond(true, 'ok', $form);
                    break;
                case 'lab_ops.result_save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $saved = $this->svc(LabOpsResultService::class)->saveEntry(
                        (int) ($body['procedure_order_id'] ?? 0),
                        $body,
                        $userId
                    );
                    $this->respond(true, 'ok', $saved);
                    break;
                case 'lab_ops.result_release':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $released = $this->svc(LabOpsResultService::class)->releaseReport(
                        (int) ($body['procedure_report_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $released);
                    break;
                case 'lab_ops.specimen_collect':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $collected = $this->svc(LabOpsOrderMetaService::class)->collectSpecimen(
                        (int) ($body['procedure_order_id'] ?? 0),
                        isset($body['accession_no']) ? (string) $body['accession_no'] : null,
                        $userId
                    );
                    $this->respond(true, 'ok', $collected);
                    break;
                case 'lab_ops.setup_status':
                    $status = $this->svc(LabOpsSetupService::class)->getSetupStatus();
                    $this->respond(true, 'ok', $status);
                    break;
                case 'lab_ops.setup_model':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $modelResult = $this->svc(LabOpsSetupService::class)->setSetupModel(
                        (string) ($body['setup_model'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $modelResult);
                    break;
                case 'lab_ops.provider_create':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $providerResult = $this->svc(LabOpsSetupService::class)->createInHouseProvider(
                        isset($body['clinic_name']) ? (string) $body['clinic_name'] : '',
                        $userId
                    );
                    $this->respond(true, 'ok', $providerResult);
                    break;
                case 'lab_ops.sendout_provider_create':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $sendOutResult = $this->svc(LabOpsSetupService::class)->createSendOutProvider(
                        (string) ($body['lab_name'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $sendOutResult);
                    break;
                case 'lab_ops.panel_import':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $providerId = $this->parseOptionalPositiveInt($body['provider_id'] ?? null);
                    if (!empty($body['use_starter'])) {
                        $importResult = $this->svc(LabOpsSetupService::class)->importStarterPanel(
                            $providerId > 0 ? $providerId : null,
                            $userId
                        );
                    } else {
                        $importResult = $this->svc(LabOpsSetupService::class)->importPanelCsv(
                            $providerId > 0 ? $providerId : null,
                            (string) ($body['csv'] ?? ''),
                            $userId
                        );
                    }
                    $this->respond(true, 'ok', $importResult);
                    break;
                case 'lab_ops.fee_map_list':
                    $providerId = $this->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null);
                    $unmapped = $this->svc(LabOpsSetupService::class)->listUnmappedFees(
                        $providerId > 0 ? $providerId : null
                    );
                    $this->respond(true, 'ok', ['rows' => $unmapped]);
                    break;
                case 'lab_ops.fee_map_save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    if (!empty($body['use_starter_defaults'])) {
                        $providerId = $this->parseOptionalPositiveInt($body['provider_id'] ?? null);
                        $feeResult = $this->svc(LabOpsSetupService::class)->applyStarterFeeDefaults(
                            $providerId > 0 ? $providerId : null,
                            $userId
                        );
                    } else {
                        $rows = is_array($body['rows'] ?? null) ? $body['rows'] : [];
                        $feeResult = $this->svc(LabOpsSetupService::class)->saveFeeMappings($rows, $userId);
                    }
                    $this->respond(true, 'ok', $feeResult);
                    break;
                case 'lab_ops.mark_send_out':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $sendOut = $this->svc(LabOpsOrderMetaService::class)->markAsSendOut(
                        (int) ($body['procedure_order_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $sendOut);
                    break;
                case 'bill_ops.visit_charges':
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    if ($method === 'POST') {
                        $body = $this->readRequestParams($method);
                        $visitId = (int) ($body['visit_id'] ?? $visitId);
                    }
                    $charges = $this->svc(BillOpsChargeCorrectionService::class)->getVisitCharges($visitId, $userId);
                    $this->respond(true, 'ok', $charges);
                    break;
                case 'bill_ops.charge_correct':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $corrected = $this->svc(BillOpsChargeCorrectionService::class)->applyCorrection(
                        (int) ($body['visit_id'] ?? 0),
                        is_array($body['add'] ?? null) ? $body['add'] : [],
                        is_array($body['remove'] ?? null) ? array_map('intval', $body['remove']) : [],
                        (string) ($body['reason'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $corrected);
                    break;
                case 'bill_ops.payments_search':
                    $params = $this->readRequestParams($method);
                    $search = $this->svc(BillOpsPaymentsSearchService::class)->search(
                        (string) ($params['q'] ?? ''),
                        isset($params['date_from']) ? (string) $params['date_from'] : null,
                        isset($params['date_to']) ? (string) $params['date_to'] : null,
                        (int) ($params['offset'] ?? 0),
                        (int) ($params['limit'] ?? BillOpsPaymentsSearchService::PAGE_SIZE)
                    );
                    $this->respond(true, 'ok', $search);
                    break;
                case 'bill_ops.payment_reverse':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $reversed = $this->svc(BillOpsPaymentsSearchService::class)->reverse(
                        (int) ($body['payment_id'] ?? $body['receipt_id'] ?? 0),
                        (string) ($body['reason'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $reversed);
                    break;
                case 'bill_ops.receipt_reprint':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $pid = (int) ($body['pid'] ?? 0);
                    $receiptId = (int) ($body['receipt_id'] ?? 0);
                    $payload = $this->svc(PaymentHistoryService::class)->getReceiptReprintForBillOps($receiptId, $pid, $userId);
                    $this->respond(true, 'ok', $payload);
                    break;
                case 'bill_ops.daysheet':
                    $params = $this->readRequestParams($method);
                    $daysheet = $this->svc(BillOpsDaysheetService::class)->getDaysheet(
                        (int) ($params['facility_id'] ?? 0),
                        (string) ($params['date'] ?? '')
                    );
                    $this->respond(true, 'ok', $daysheet);
                    break;
                case 'bill_ops.daysheet_export':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $exported = $this->svc(BillOpsDaysheetService::class)->recordExport(
                        (int) ($body['facility_id'] ?? 0),
                        (string) ($body['date'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $exported);
                    break;
                case 'bill_ops.outstanding_list':
                    $params = $this->readRequestParams($method);
                    $list = $this->svc(BillOpsOutstandingService::class)->listOutstanding(
                        isset($params['bucket']) ? (string) $params['bucket'] : null,
                        (int) ($params['offset'] ?? 0),
                        (int) ($params['limit'] ?? BillOpsOutstandingService::PAGE_SIZE)
                    );
                    $this->respond(true, 'ok', $list);
                    break;
                default:
                    $this->respond(false, 'Unknown action', [], 400);
            }
        } catch (StaleVisitException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'stale_visit'], 409);
        } catch (VisitNotTakeableException $e) {
            $this->respond(false, $e->getMessage(), array_merge(
                ['code' => 'visit_not_takeable'],
                $e->getContext()
            ), 409);
        } catch (UnsignedEncounterException $e) {
            $data = [
                'code' => 'encounter_unsigned',
                'reason' => $e->getReasonCode(),
            ];
            if ($e->getEncounterUrl() !== null) {
                $data['encounter_url'] = $e->getEncounterUrl();
            }
            $this->respond(false, $e->getMessage(), $data, 409);
        } catch (UndispensedRxException $e) {
            $this->respond(false, $e->getMessage(), [
                'code' => 'rx_undispensed',
                'undispensed_count' => $e->getUndispensedCount(),
            ], 409);
        } catch (AllergiesUndocumentedException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'allergies_undocumented'], 409);
        } catch (ExternalRxIncompleteException $e) {
            $this->respond(false, $e->getMessage(), [
                'code' => 'external_rx_incomplete',
                'missing' => $e->getMissing(),
                'field_errors' => $e->getFieldErrors(),
            ], 409);
        } catch (EncounterSessionMismatchException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'session_mismatch'], 409);
        } catch (\InvalidArgumentException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'validation'], 400);
        } catch (\RuntimeException $e) {
            $code = match ($e->getCode()) {
                404 => 404,
                403 => 403,
                429 => 429,
                default => 500,
            };
            $errorCode = match ($code) {
                404 => 'not_found',
                403 => 'forbidden',
                429 => 'rate_limited',
                default => 'server_error',
            };
            $this->respond(false, $e->getMessage(), ['code' => $errorCode], $code);
        } catch (\Throwable $e) {
            error_log('New Clinic AJAX error: ' . $e->getMessage());
            $data = ['code' => 'server_error'];
            if (!empty($GLOBALS['debug'])) {
                $data['detail'] = $e->getMessage();
            }
            $this->respond(false, 'Server error', $data, 500);
        }
    }

    private function esignOverrideReason(array $body): ?string
    {
        $reason = trim((string) ($body['esign_override_reason'] ?? ''));

        return $reason !== '' ? $reason : null;
    }

    private function undispensedOverrideReason(array $body): ?string
    {
        $reason = trim((string) ($body['undispensed_override_reason'] ?? ''));

        return $reason !== '' ? $reason : null;
    }

    private function externalRxOverrideReason(array $body): ?string
    {
        $reason = trim((string) ($body['external_rx_override_reason'] ?? ''));

        return $reason !== '' ? $reason : null;
    }

    private function rxAllergyOverrideReason(array $body): ?string
    {
        $reason = trim((string) ($body['rx_undocumented_allergy_override_reason'] ?? ''));

        return $reason !== '' ? $reason : null;
    }

    private function authorizeAction(string $action): void
    {
        if ($this->svc(AjaxActionPolicy::class)->isDeprecated($action)) {
            $this->respond(
                false,
                'Use role-specific workflow actions (triage, doctor, cashier)',
                ['code' => 'deprecated'],
                410
            );
        }

        $desc = $this->svc(AjaxActionPolicy::class)->describe($action);
        match ($desc['type']) {
            'single_acl' => $this->requireAcl($desc['acl']),
            'any_acl' => $this->requireAnyAcl($desc['acls']),
            'desk_acl' => $this->requireClinicDeskAcl(),
            'core_notes_acl' => $this->requireCoreNotesAcl(),
            'cohort_acl' => $this->requireCohortAcl(),
            'cohort_export_acl' => $this->requireCohortExportAcl(),
            'lab_ops_read_acl' => $this->requireLabOpsReadAcl(),
            'lab_ops_enter_acl' => $this->requireLabOpsEnterAcl(),
            'lab_ops_release_acl' => $this->requireLabOpsReleaseAcl(),
            'lab_ops_catalog_acl' => $this->requireLabOpsEnterAcl(),
            'pharm_ops_read_acl' => $this->requirePharmOpsReadAcl(),
            'pharm_ops_dispense_acl' => $this->requirePharmOpsDispenseAcl(),
            'pharm_ops_receive_acl' => $this->requirePharmOpsReceiveAcl(),
            'pharm_ops_destroy_acl' => $this->requirePharmOpsDestroyAcl(),
            'pharm_ops_rx_print_acl' => $this->requirePharmOpsRxPrintAcl(),
            'pharm_ops_dispense_label_acl' => $this->requirePharmOpsDispenseLabelAcl(),
            'pharm_ops_catalog_acl' => $this->requirePharmOpsCatalogAcl(),
            'bill_ops_correct_acl' => $this->requireBillOpsCorrectAcl(),
            'bill_ops_payment_acl' => $this->requireBillOpsPaymentAcl(),
            'bill_ops_close_acl' => $this->requireBillOpsCloseAcl(),
            'bill_ops_outstanding_acl' => $this->requireBillOpsOutstandingAcl(),
            'report_hub_read_acl' => $this->requireReportHubReadAcl(),
            'report_hub_export_acl' => $this->requireReportHubExportAcl(),
            'queue_bridge_read_acl' => $this->requireQueueBridgeReadAcl(),
            'queue_bridge_resolve_acl' => $this->requireQueueBridgeResolveAcl(),
            'queue_bridge_dismiss_acl' => $this->requireQueueBridgeDismissAcl(),
            'scheduling_read_acl' => $this->requireSchedulingReadAcl(),
            'scheduling_write_acl' => $this->requireSchedulingWriteAcl(),
            'clinical_doc_read_acl' => $this->requireClinicalDocReadAcl(),
            'clinical_doc_write_acl' => $this->requireClinicalDocWriteAcl(),
            'encounter_note_acl' => $this->requireEncounterNoteAcl(),
            'deprecated' => $this->respond(
                false,
                'Use role-specific workflow actions (triage, doctor, cashier)',
                ['code' => 'deprecated'],
                410
            ),
            default => $this->respond(false, 'Unknown action', [], 400),
        };
    }

    private function requireAnyAcl(array $acos): void
    {
        foreach ($acos as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return;
            }
        }

        $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
    }

    private function requireClinicDeskAcl(): void
    {
        $acos = [
            'new_reception', 'new_nurse', 'new_doctor', 'new_lab',
            'new_pharmacy', 'new_cashier', 'new_admin', 'reports',
        ];
        foreach ($acos as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return;
            }
        }

        $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
    }

    private function requireCoreNotesAcl(): void
    {
        if (!AclMain::aclCheckCore('patients', 'notes')) {
            $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
        }
    }

    private function requireCohortAcl(): void
    {
        try {
            (new PatientCohortSearchService())->assertRegistryAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireCohortExportAcl(): void
    {
        try {
            (new PatientCohortSearchService())->assertExportAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireLabOpsReadAcl(): void
    {
        try {
            (new LabOpsAccessService())->assertHubAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireLabOpsEnterAcl(): void
    {
        try {
            (new LabOpsAccessService())->assertEnterAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireLabOpsReleaseAcl(): void
    {
        try {
            (new LabOpsAccessService())->assertReleaseAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsReadAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertHubAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsDispenseAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertDispenseAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsReceiveAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertReceiveAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsDestroyAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertDestroyAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsRxPrintAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertRxPrintAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsDispenseLabelAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertDispenseLabelAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsCatalogAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertCatalogAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireBillOpsCorrectAcl(): void
    {
        try {
            (new BillOpsAccessService())->assertCorrectAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireBillOpsPaymentAcl(): void
    {
        try {
            (new BillOpsAccessService())->assertPaymentAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireBillOpsCloseAcl(): void
    {
        try {
            (new BillOpsAccessService())->assertCloseAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireBillOpsOutstandingAcl(): void
    {
        try {
            (new BillOpsAccessService())->assertOutstandingAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireReportHubReadAcl(): void
    {
        try {
            $this->svc(ReportHubAccessService::class)->assertHubAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireReportHubExportAcl(): void
    {
        try {
            $this->svc(ReportHubAccessService::class)->assertHubAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireQueueBridgeReadAcl(): void
    {
        try {
            $this->svc(QueueBridgeAccessService::class)->assertHubAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireQueueBridgeResolveAcl(): void
    {
        try {
            $this->svc(QueueBridgeAccessService::class)->assertHubAccess();
            if (!$this->svc(QueueBridgeAccessService::class)->canResolve()) {
                throw new \RuntimeException('Queue Bridge resolve permission denied', 403);
            }
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireQueueBridgeDismissAcl(): void
    {
        try {
            $this->svc(QueueBridgeAccessService::class)->assertHubAccess();
            if (!$this->svc(QueueBridgeAccessService::class)->canDismiss()) {
                throw new \RuntimeException('Queue Bridge dismiss permission denied', 403);
            }
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireSchedulingReadAcl(): void
    {
        try {
            $this->svc(SchedulingAccessService::class)->assertHubAccess($this->resolveRequestFacilityId());
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireSchedulingWriteAcl(): void
    {
        try {
            $this->svc(SchedulingAccessService::class)->assertHubAccess($this->resolveRequestFacilityId());
            if (!$this->svc(SchedulingAccessService::class)->canBookAppointment()) {
                throw new \RuntimeException('Appointment write permission denied', 403);
            }
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireClinicalDocReadAcl(): void
    {
        try {
            $this->svc(ClinicalDocAccessService::class)->assertHubAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireClinicalDocWriteAcl(): void
    {
        try {
            $this->svc(ClinicalDocAccessService::class)->assertWriteAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireEncounterNoteAcl(): void
    {
        try {
            $this->svc(ClinicalDocAccessService::class)->assertConsultNoteAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireSuperAdmin(): void
    {
        if (!AclMain::aclCheckCore('admin', 'super')) {
            $this->respond(false, 'Super admin access required', ['code' => 'forbidden'], 403);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function readRequestParams(string $method): array
    {
        if ($method === 'POST') {
            $body = $this->readJsonBody();
            $this->verifyCsrf($body);

            return $body;
        }

        return $_REQUEST;
    }

    private function authorizeDeferredHandler(string $action, int $pid = 0): void
    {
        foreach ($this->svc(AjaxActionPolicy::class)->deferredAuthorizationLayers($action) as $acls) {
            $this->authorizeAnyAclOrNotFound($acls, $pid);
        }
    }

    /**
     * @param array<int, string> $acls
     */
    private function authorizeAnyAclOrNotFound(array $acls, int $pid = 0): void
    {
        foreach ($acls as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return;
            }
        }

        if ($pid > 0) {
            $this->respond(false, 'Patient not found', ['code' => 'not_found'], 404);
        }

        $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
    }

    private function assertPatientChartPid(int $pid): void
    {
        if ($pid <= 0) {
            $this->respond(false, 'Patient not found', ['code' => 'not_found'], 404);
        }

        try {
            $this->svc(FacilityScopeService::class)->assertPatientAccessible($pid);
        } catch (\RuntimeException) {
            $this->respond(false, 'Patient not found', ['code' => 'not_found'], 404);
        }
    }

    private function resolveRequestFacilityId(): int
    {
        $requested = (int) ($_REQUEST['facility_id'] ?? 0);
        $sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;

        return $this->svc(VisitScopeService::class)->resolveQueueFacilityId(
            $requested > 0 ? $requested : $sessionFacility
        );
    }

    /**
     * Treat missing, blank, or JS "undefined"/"null" query values as absent optional ints.
     */
    private function parseOptionalPositiveInt(mixed $value): ?int
    {
        if ($value === null) {
            return null;
        }

        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '' || $trimmed === 'undefined' || $trimmed === 'null') {
                return null;
            }
        }

        if (!is_numeric($value)) {
            return null;
        }

        $parsed = (int) $value;

        return $parsed > 0 ? $parsed : null;
    }

    /**
     * @param array<string, mixed> $visit
     * @return array<string, mixed>
     */
    private function enrichStartVisitResponse(array $visit, int $userId): array
    {
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $visitId = (int) ($visit['id'] ?? 0);
        $response = ['visit' => $visit];

        if ($visitId <= 0) {
            return $response;
        }

        $printEnabled = $this->svc(QueueSlipService::class)->isPrintEnabled($facilityId);
        $response['queue_slip_enabled'] = $printEnabled;
        if ($printEnabled) {
            $webroot = $GLOBALS['webroot'] ?? '';
            $response['queue_slip_url'] = $webroot
                . '/interface/modules/custom_modules/oe-module-new-clinic/public/queue-slip.php?visit_id='
                . urlencode((string) $visitId)
                . '&print=1';
            $response['queue_slip'] = $this->svc(QueueSlipService::class)->buildPrintPayload($visitId, $userId);
        }

        return $response;
    }

    /**
     * Desk facility for writes: prefer explicit client facility_id, else request/session default.
     *
     * @param array<string, mixed> $body
     */
    private function resolveDeskFacilityFromBody(array $body): int
    {
        $fromBody = (int) ($body['facility_id'] ?? 0);
        if ($fromBody > 0) {
            return $this->svc(VisitScopeService::class)->resolveQueueFacilityId($fromBody);
        }

        return $this->resolveRequestFacilityId();
    }

    private function requireAcl(string $aco): void
    {
        if (!AclMain::aclCheckCore('new_clinic', $aco)) {
            $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
        }
    }

    private function verifyCsrf(array $body): void
    {
        $headerToken = trim((string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
        $bodyToken = trim((string) (
            $body['csrf_token_form']
            ?? $body['csrf_token']
            ?? ''
        ));
        $postToken = trim((string) ($_POST['csrf_token_form'] ?? ($_POST['csrf_token'] ?? '')));

        $token = $bodyToken !== '' ? $bodyToken : ($headerToken !== '' ? $headerToken : $postToken);

        if (!CsrfUtils::verifyCsrfToken($token)) {
            $this->respond(false, 'Invalid CSRF token', ['code' => 'csrf'], 403);
        }
    }

    private function resolveRequestAction(): string
    {
        $action = trim((string) ($_REQUEST['action'] ?? ''));
        if ($action !== '') {
            return $this->svc(AjaxActionPolicy::class)->normalizeAction($action);
        }

        if (strcasecmp((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'), 'POST') === 0) {
            $fromBody = trim((string) ($this->readJsonBody()['action'] ?? ''));
            if ($fromBody !== '') {
                return $this->svc(AjaxActionPolicy::class)->normalizeAction($fromBody);
            }
        }

        return '';
    }

    private function readJsonBody(): array
    {
        if ($this->jsonBodyCache !== null) {
            return $this->jsonBodyCache;
        }

        $raw = file_get_contents('php://input');
        if (empty($raw)) {
            $this->jsonBodyCache = $_POST;

            return $this->jsonBodyCache;
        }

        $decoded = json_decode($raw, true);
        $this->jsonBodyCache = is_array($decoded) ? $decoded : [];

        return $this->jsonBodyCache;
    }

    /**
     * @return list<array{visit_id: int, from_state: string}>
     */
    private function parseQueueWatchList(): array
    {
        $raw = $_REQUEST['queue_watch'] ?? '';
        if (!is_string($raw) || $raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        $list = [];
        foreach ($decoded as $item) {
            if (!is_array($item)) {
                continue;
            }
            $visitId = (int) ($item['visit_id'] ?? 0);
            $fromState = trim((string) ($item['from_state'] ?? ''));
            if ($visitId > 0 && $fromState !== '') {
                $list[] = ['visit_id' => $visitId, 'from_state' => $fromState];
            }
        }

        return $list;
    }

    /**
     * @param array<string, mixed> $queuePayload
     *
     * @return array<string, mixed>
     */
    private function enrichQueuePayload(array $queuePayload, int $userId, int $facilityId): array
    {
        if (!empty($queuePayload['visits']) && is_array($queuePayload['visits'])) {
            $queuePayload['visits'] = $this->svc(SimilarSurnameQueueService::class)->annotateVisits(
                $queuePayload['visits'],
                $facilityId
            );
        }

        return $this->withClaimLostPoll($queuePayload, $userId);
    }

    /**
     * @param array<string, mixed> $queuePayload
     *
     * @return array<string, mixed>
     */
    private function withClaimLostPoll(array $queuePayload, int $userId): array
    {
        $watch = $this->parseQueueWatchList();
        if ($watch === []) {
            return $queuePayload;
        }

        return $this->svc(VisitClaimLostService::class)->enrichQueueResponse($queuePayload, $watch, $userId);
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    private function resolvePatientCreate(array $body, int $userId): array
    {
        $config = new ClinicConfigService();
        $mode = (string) ($config->get('registration_mode', 'desk_full_form') ?? 'desk_full_form');
        $section = (int) ($body['section'] ?? 1);
        $patient = is_array($body['patient'] ?? null) ? $body['patient'] : $body;

        if ($mode === 'desk_full_form' || isset($body['section']) || isset($body['patient'])) {
            $patient = array_merge($patient, [
                'dup_confirm' => $body['dup_confirm'] ?? null,
                'dup_override' => $body['dup_override'] ?? null,
                'dup_override_reason' => $body['dup_override_reason'] ?? null,
                'national_id' => trim((string) ($body['national_id'] ?? ($patient['national_id'] ?? ''))),
                'no_phone' => $body['no_phone'] ?? ($patient['no_phone'] ?? null),
            ]);

            return $this->svc(PatientRegistrationService::class)->saveSection($section, $patient, null, $userId);
        }

        return $this->svc(QuickAddService::class)->create($patient, $userId);
    }


    private function respond(bool $success, string $message, array $data = [], int $status = 200): void
    {
        http_response_code($status);
        echo json_encode([
            'success' => $success,
            'message' => $message,
            'data' => $data,
        ]);
        exit;
    }

    private function respondCsv(string $filename, string $content): void
    {
        http_response_code(200);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . basename($filename) . '"');
        header('Cache-Control: no-store');
        echo $content;
        exit;
    }
}


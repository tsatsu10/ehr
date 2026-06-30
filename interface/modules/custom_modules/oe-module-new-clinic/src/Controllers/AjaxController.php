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
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Exceptions\EncounterSessionMismatchException;
use OpenEMR\Modules\NewClinic\Exceptions\StaleVisitException;
use OpenEMR\Modules\NewClinic\Exceptions\UndispensedRxException;
use OpenEMR\Modules\NewClinic\Exceptions\UnsignedEncounterException;
use OpenEMR\Modules\NewClinic\Exceptions\VisitNotTakeableException;
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
use OpenEMR\Modules\NewClinic\Services\ReportsService;
use OpenEMR\Modules\NewClinic\Services\ReportHubAccessService;
use OpenEMR\Modules\NewClinic\Services\ReportHubCatalogService;
use OpenEMR\Modules\NewClinic\Services\ReportHubExportService;
use OpenEMR\Modules\NewClinic\Services\ClinicAdminService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\SessionRoleService;
use OpenEMR\Modules\NewClinic\Services\EncounterSessionService;
use OpenEMR\Modules\NewClinic\Services\SharedDeviceSessionService;
use OpenEMR\Modules\NewClinic\Services\PatientActivityFeedService;
use OpenEMR\Modules\NewClinic\Services\PatientChartClinicalService;
use OpenEMR\Modules\NewClinic\Services\PatientChartMessagesService;
use OpenEMR\Modules\NewClinic\Services\PatientChartService;
use OpenEMR\Modules\NewClinic\Services\PatientContextService;
use OpenEMR\Modules\NewClinic\Services\PatientDuplicateService;
use OpenEMR\Modules\NewClinic\Services\PatientRegistrationService;
use OpenEMR\Modules\NewClinic\Services\PatientSearchService;
use OpenEMR\Modules\NewClinic\Services\FacilityScopeService;
use OpenEMR\Modules\NewClinic\Services\GeoService;
use OpenEMR\Modules\NewClinic\Services\QuickAddService;
use OpenEMR\Modules\NewClinic\Services\QueueSlipService;
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

    public function __construct(
        private readonly VisitQueueService $visitQueueService = new VisitQueueService(),
        private readonly VisitBoardService $visitBoardService = new VisitBoardService(),
        private readonly PatientContextService $patientContextService = new PatientContextService(),
        private readonly PatientSearchService $patientSearchService = new PatientSearchService(),
        private readonly QuickAddService $quickAddService = new QuickAddService(),
        private readonly PatientRegistrationService $registrationService = new PatientRegistrationService(),
        private readonly PatientChartService $patientChartService = new PatientChartService(),
        private readonly PatientChartClinicalService $patientChartClinicalService = new PatientChartClinicalService(),
        private readonly PatientChartMessagesService $patientChartMessagesService = new PatientChartMessagesService(),
        private readonly PatientActivityFeedService $activityFeedService = new PatientActivityFeedService(),
        private readonly GeoService $geoService = new GeoService(),
        private readonly PatientDuplicateService $duplicateService = new PatientDuplicateService(),
        private readonly EncounterSessionService $encounterSessionService = new EncounterSessionService(),
        private readonly TriageService $triageService = new TriageService(),
        private readonly DoctorService $doctorService = new DoctorService(),
        private readonly LabPanelOrderService $labPanelOrderService = new LabPanelOrderService(),
        private readonly PharmFormularyRxService $pharmFormularyRxService = new PharmFormularyRxService(),
        private readonly CashierService $cashierService = new CashierService(),
        private readonly LabService $labService = new LabService(),
        private readonly ConsultShortcutService $consultShortcutService = new ConsultShortcutService(),
        private readonly LabShortcutService $labShortcutService = new LabShortcutService(),
        private readonly PharmacyService $pharmacyService = new PharmacyService(),
        private readonly PharmacyShortcutService $pharmacyShortcutService = new PharmacyShortcutService(),
        private readonly ClinicAdminService $clinicAdminService = new ClinicAdminService(),
        private readonly ReportsService $reportsService = new ReportsService(),
        private readonly ReportHubAccessService $reportHubAccessService = new ReportHubAccessService(),
        private readonly ReportHubCatalogService $reportHubCatalogService = new ReportHubCatalogService(),
        private readonly ReportHubExportService $reportHubExportService = new ReportHubExportService(),
        private readonly RateLimitService $rateLimitService = new RateLimitService(),
        private readonly AjaxActionPolicy $actionPolicy = new AjaxActionPolicy(),
        private readonly VisitScopeService $visitScopeService = new VisitScopeService(),
        private readonly VisitTypeAdminService $visitTypeAdminService = new VisitTypeAdminService(),
        private readonly FeeScheduleAdminService $feeScheduleAdminService = new FeeScheduleAdminService(),
        private readonly SessionRoleService $sessionRoleService = new SessionRoleService(),
        private readonly FacilityScopeService $facilityScopeService = new FacilityScopeService(),
        private readonly ProfilePaymentsSummaryService $profilePaymentsSummaryService = new ProfilePaymentsSummaryService(),
        private readonly PaymentHistoryService $paymentHistoryService = new PaymentHistoryService(),
        private readonly ReferralCorrespondenceService $referralCorrespondenceService = new ReferralCorrespondenceService(),
        private readonly ClinicalLabsSummaryService $clinicalLabsSummaryService = new ClinicalLabsSummaryService(),
        private readonly ClinicalMedsSummaryService $clinicalMedsSummaryService = new ClinicalMedsSummaryService(),
        private readonly ClinicalExportService $clinicalExportService = new ClinicalExportService(),
        private readonly CommunicationsHubService $communicationsHubService = new CommunicationsHubService(),
        private readonly CommHubUserSettingsService $commHubUserSettingsService = new CommHubUserSettingsService(),
        private readonly PatientCohortSearchService $cohortSearchService = new PatientCohortSearchService(),
        private readonly CohortSavedFilterService $cohortSavedFilterService = new CohortSavedFilterService(),
        private readonly RegistryAuditService $registryAuditService = new RegistryAuditService(),
        private readonly LabOpsWorklistService $labOpsWorklistService = new LabOpsWorklistService(),
        private readonly LabOpsResultService $labOpsResultService = new LabOpsResultService(),
        private readonly LabOpsOrderMetaService $labOpsOrderMetaService = new LabOpsOrderMetaService(),
        private readonly LabOpsSetupService $labOpsSetupService = new LabOpsSetupService(),
        private readonly PharmOpsWorklistService $pharmOpsWorklistService = new PharmOpsWorklistService(),
        private readonly PharmOpsDispenseService $pharmOpsDispenseService = new PharmOpsDispenseService(),
        private readonly PharmOpsOtcSaleService $pharmOpsOtcSaleService = new PharmOpsOtcSaleService(),
        private readonly PharmOpsReceiveService $pharmOpsReceiveService = new PharmOpsReceiveService(),
        private readonly PharmOpsSetupService $pharmOpsSetupService = new PharmOpsSetupService(),
        private readonly PharmOpsReportsService $pharmOpsReportsService = new PharmOpsReportsService(),
        private readonly PharmOpsDestroyService $pharmOpsDestroyService = new PharmOpsDestroyService(),
        private readonly PharmOpsRxPrintService $pharmOpsRxPrintService = new PharmOpsRxPrintService(),
        private readonly PharmOpsDispenseLabelService $pharmOpsDispenseLabelService = new PharmOpsDispenseLabelService(),
        private readonly PharmDrugMetaService $pharmDrugMetaService = new PharmDrugMetaService(),
        private readonly PharmOpsControlledRegisterService $pharmOpsControlledRegisterService = new PharmOpsControlledRegisterService(),
        private readonly VisitClaimLostService $visitClaimLostService = new VisitClaimLostService(),
        private readonly SimilarSurnameQueueService $similarSurnameQueueService = new SimilarSurnameQueueService(),
        private readonly SharedDeviceSessionService $sharedDeviceSessionService = new SharedDeviceSessionService(),
        private readonly ReconciliationService $reconciliationService = new ReconciliationService(),
        private readonly BillOpsChargeCorrectionService $billOpsChargeCorrectionService = new BillOpsChargeCorrectionService(),
        private readonly BillOpsPaymentsSearchService $billOpsPaymentsSearchService = new BillOpsPaymentsSearchService(),
        private readonly BillOpsDaysheetService $billOpsDaysheetService = new BillOpsDaysheetService(),
        private readonly BillOpsOutstandingService $billOpsOutstandingService = new BillOpsOutstandingService(),
        private readonly QueueSlipService $queueSlipService = new QueueSlipService(),
        private readonly FrontDeskStatsService $frontDeskStatsService = new FrontDeskStatsService(),
        private readonly FrontDeskRecentPatientsService $frontDeskRecentPatientsService = new FrontDeskRecentPatientsService(),
        private readonly AppointmentTodayService $appointmentTodayService = new AppointmentTodayService(),
        private readonly RevisitCompletionGateService $revisitCompletionGateService = new RevisitCompletionGateService(),
    ) {
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

        if ($action !== '' && !$this->actionPolicy->defersAuthorizationToHandler($action)) {
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
                    $this->rateLimitService->assertWithinLimit('patients.search', $userId);
                    $result = $this->patientSearchService->search(
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
                    $this->authorizeChartRead($pid);
                    $this->assertPatientChartPid($pid);
                    $preview = $this->patientContextService->previewPayload(
                        $pid,
                        $userId,
                        (string) ($body['context'] ?? 'front-desk')
                    );
                    $this->respond(true, 'ok', $preview);
                    break;
                case 'patients.chart.visits':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeChartRead($pid);
                    $this->assertPatientChartPid($pid);
                    $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                    $limit = (int) ($_REQUEST['limit'] ?? PatientChartService::PAST_VISITS_PAGE_SIZE);
                    $visits = $this->patientChartService->getVisitsPayload($pid, $offset, $limit);
                    $this->respond(true, 'ok', $visits);
                    break;
                case 'patients.chart.clinical':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeChartRead($pid);
                    $this->assertPatientChartPid($pid);
                    $clinical = $this->patientChartClinicalService->getClinicalPayload($pid);
                    $this->respond(true, 'ok', $clinical);
                    break;
                case 'patients.chart.activity_feed':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeChartRead($pid);
                    $this->assertPatientChartPid($pid);
                    $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                    $limit = (int) ($_REQUEST['limit'] ?? PatientActivityFeedService::PAGE_SIZE);
                    $feed = $this->activityFeedService->getActivityFeed($pid, $offset, $limit, true);
                    $this->respond(true, 'ok', $feed);
                    break;
                case 'patients.chart.messages':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeChartRead($pid);
                    $this->assertPatientChartPid($pid);
                    $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                    $limit = (int) ($_REQUEST['limit'] ?? PatientChartMessagesService::PAGE_SIZE);
                    $messages = $this->patientChartMessagesService->getMessagesPayload($pid, $offset, $limit);
                    $this->respond(true, 'ok', $messages);
                    break;
                case 'mrd.profile_payments_summary':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeChartRead($pid);
                    $this->assertPatientChartPid($pid);
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    $summary = $this->profilePaymentsSummaryService->getSummary(
                        $pid,
                        $visitId > 0 ? $visitId : null
                    );
                    $this->respond(true, 'ok', $summary);
                    break;
                case 'chart_depth.payments_list':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->assertPatientChartPid($pid);
                    $this->authorizePaymentHistory($pid);
                    $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                    $limit = (int) ($_REQUEST['limit'] ?? PaymentHistoryService::PAGE_SIZE);
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    $filter = (string) ($_REQUEST['filter'] ?? '');
                    if ($filter === '' && $visitId > 0) {
                        $filter = 'this_visit';
                    }
                    $list = $this->paymentHistoryService->getPaymentsList(
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
                    $this->authorizeReceiptReprint($pid);
                    $payload = $this->paymentHistoryService->getReceiptReprintPayload($receiptId, $pid, $userId);
                    $this->respond(true, 'ok', $payload);
                    break;
                case 'mrd.clinical_referrals_strip':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeChartRead($pid);
                    $this->assertPatientChartPid($pid);
                    $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                    $strip = $this->referralCorrespondenceService->getClinicalStrip(
                        $pid,
                        $encounterId > 0 ? $encounterId : null
                    );
                    $this->respond(true, 'ok', $strip);
                    break;
                case 'mrd.clinical_labs_summary':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeChartRead($pid);
                    $this->assertPatientChartPid($pid);
                    $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                    $strip = $this->clinicalLabsSummaryService->getClinicalStrip(
                        $pid,
                        $encounterId > 0 ? $encounterId : null
                    );
                    $this->respond(true, 'ok', $strip);
                    break;
                case 'mrd.clinical_meds_summary':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeChartRead($pid);
                    $this->assertPatientChartPid($pid);
                    $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                    $strip = $this->clinicalMedsSummaryService->getClinicalStrip(
                        $pid,
                        $encounterId > 0 ? $encounterId : null
                    );
                    $this->respond(true, 'ok', $strip);
                    break;
                case 'chart_depth.export_builder':
                    $pid = (int) ($_REQUEST['pid'] ?? 0);
                    $this->authorizeClinicalExport($pid);
                    $preset = trim((string) ($_REQUEST['preset'] ?? ''));
                    $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                    $payload = $this->clinicalExportService->getBuilderPayload(
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
                    $this->authorizeClinicalExport($pid);
                    $this->assertPatientChartPid($pid);
                    $preset = trim((string) ($body['preset'] ?? ClinicalExportService::PRESET_VISIT_SUMMARY));
                    $encounterId = (int) ($body['encounter_id'] ?? 0);
                    $includes = is_array($body['include'] ?? null) ? $body['include'] : [];
                    $normalizedIncludes = [];
                    foreach ($includes as $key => $value) {
                        $normalizedIncludes[(string) $key] = !empty($value);
                    }
                    $result = $this->clinicalExportService->preparePdfExport(
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
                    $this->authorizeReferralHub($pid);
                    $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                    $limit = (int) ($_REQUEST['limit'] ?? ReferralCorrespondenceService::PAGE_SIZE);
                    $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                    $list = $this->referralCorrespondenceService->getReferralsList(
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
                    $this->rateLimitService->assertWithinLimit('patients.dup_check', $userId);
                    $excludePid = (int) ($body['exclude_pid'] ?? $body['pid'] ?? 0);
                    $dup = $this->duplicateService->scoreProspect(
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
                    $updated = $this->registrationService->saveSection($section, $patient, $pid, $userId);
                    $this->respond(true, 'Patient updated', $updated);
                    break;
                case 'patients.registration.get':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $pid = (int) ($body['pid'] ?? 0);
                    $this->authorizeChartRead($pid);
                    $this->assertPatientChartPid($pid);
                    $form = $this->registrationService->getFormData($pid);
                    $this->respond(true, 'ok', $form);
                    break;
                case 'admin.geo.regions':
                    $country = (string) ($_REQUEST['country'] ?? 'GH');
                    $this->respond(true, 'ok', ['regions' => $this->geoService->listRegions($country)]);
                    break;
                case 'admin.geo.districts':
                    $regionCode = (string) ($_REQUEST['region_code'] ?? '');
                    $this->respond(true, 'ok', [
                        'districts' => $this->geoService->listDistricts($regionCode),
                    ]);
                    break;
                case 'visit.types':
                    $facilityId = $this->resolveRequestFacilityId();
                    $types = $this->visitTypeAdminService->listForDesk($facilityId);
                    $this->respond(true, 'ok', ['visit_types' => $types]);
                    break;
                case 'fees.list':
                    $facilityId = $this->resolveRequestFacilityId();
                    $fees = $this->feeScheduleAdminService->listForDesk($facilityId);
                    $this->respond(true, 'ok', ['fee_schedule' => $fees]);
                    break;
                case 'queue.list':
                    $visitDate = trim((string) ($_REQUEST['visit_date'] ?? ''));
                    $visits = $this->visitQueueService->getQueue([
                        'facility_id' => $this->resolveRequestFacilityId(),
                        'visit_date' => $visitDate !== '' ? $visitDate : null,
                        'state' => $_REQUEST['state'] ?? null,
                    ]);
                    $this->respond(true, 'ok', ['visits' => $visits]);
                    break;
                case 'visit.board':
                    $facilityId = $this->resolveRequestFacilityId();
                    $board = $this->visitBoardService->getBoard(
                        $facilityId,
                        $_REQUEST['visit_date'] ?? date('Y-m-d')
                    );
                    $board = $this->similarSurnameQueueService->annotateBoard($board, $facilityId);
                    $this->respond(true, 'ok', $board);
                    break;
                case 'visit.detail':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $visitId = (int) ($body['visit_id'] ?? 0);
                    $visit = $this->visitBoardService->getVisitDetail($visitId, $userId);
                    $preview = $this->patientContextService->previewPayload(
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
                    $visit = $this->visitQueueService->cancelVisit(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        (string) ($body['reason'] ?? '')
                    );
                    $this->respond(true, 'Visit cancelled', ['visit' => $visit]);
                    break;
                case 'visit.start':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $visit = $this->visitQueueService->startVisit(
                        (int) ($body['pid'] ?? 0),
                        (int) ($body['visit_type_id'] ?? 0),
                        $userId,
                        $this->resolveDeskFacilityFromBody($body),
                        isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null,
                        !empty($body['is_urgent']),
                        isset($body['revisit_override_reason'])
                            ? (string) $body['revisit_override_reason']
                            : null
                    );
                    $this->respond(true, 'Visit started', $this->enrichStartVisitResponse($visit, $userId));
                    break;
                case 'visit.skip_triage':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $visit = $this->visitQueueService->skipTriage(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        isset($body['reason']) ? (string) $body['reason'] : null
                    );
                    $this->respond(true, 'Skipped triage', ['visit' => $visit]);
                    break;
                case 'front_desk.desk_stats':
                    $facilityId = $this->resolveRequestFacilityId();
                    $stats = $this->frontDeskStatsService->getDeskStats($userId, $facilityId);
                    $this->respond(true, 'ok', $stats);
                    break;
                case 'front_desk.todays_appointments':
                    $facilityId = $this->resolveRequestFacilityId();
                    $limit = (int) ($_REQUEST['limit'] ?? 50);
                    $appointments = $this->appointmentTodayService->listTodayAppointments($facilityId, $limit);
                    $this->respond(true, 'ok', ['appointments' => $appointments]);
                    break;
                case 'front_desk.recently_viewed':
                    $recent = $this->frontDeskRecentPatientsService->listRecent();
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
                        $recent = $this->frontDeskRecentPatientsService->remember($pid, $displayName, $pubpid);
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
                    $this->frontDeskRecentPatientsService->clear();
                    $this->respond(true, 'ok', ['recent' => []]);
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
                    $this->revisitCompletionGateService->logAwaitingDocuments(
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
                    $result = $this->visitQueueService->startVisitFromAppointment(
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
                    $this->respond(
                        true,
                        'Visit started from appointment',
                        array_merge($result, $this->enrichStartVisitResponse($visit, $userId))
                    );
                    break;
                case 'visit.queue_slip':
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    if ($visitId <= 0) {
                        $this->respond(false, 'visit_id required', [], 400);
                    }
                    $payload = $this->queueSlipService->buildPrintPayload($visitId, $userId);
                    $this->respond(true, 'ok', ['queue_slip' => $payload]);
                    break;
                case 'session.bind':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $session = $this->encounterSessionService->bindForVisitWithDeskAcl(
                        (int) ($body['visit_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'Session bound', ['session' => $session->toArray()]);
                    break;
                case 'desk.shared_session_probe':
                    $probe = $this->sharedDeviceSessionService->probe(
                        (int) ($_REQUEST['visit_id'] ?? 0),
                        (string) ($_REQUEST['compare_mode'] ?? SharedDeviceSessionService::COMPARE_CLINICAL),
                        $userId
                    );
                    $this->respond(true, 'ok', $probe);
                    break;
                case 'triage.queue':
                    $facilityId = $this->resolveRequestFacilityId();
                    $visitDate = trim((string) ($_REQUEST['visit_date'] ?? ''));
                    $queue = $this->triageService->getTriageQueue(
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
                    $payload = $this->triageService->selectPatient(
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
                    $visit = $this->visitQueueService->startTriage(
                        $visitId,
                        $userId,
                        (int) ($body['row_version'] ?? 0)
                    );
                    $this->encounterSessionService->bindForVisit($visitId, $userId);
                    $this->respond(true, 'Triage started', ['visit' => $visit]);
                    break;
                case 'triage.save_vitals':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->triageService->saveVitals(
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
                    $visit = $this->visitQueueService->sendToDoctor(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null
                    );
                    $this->respond(true, 'Sent to doctor', ['visit' => $visit]);
                    break;
                case 'triage.auto_start':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $visit = $this->visitQueueService->startVisitAtTriage(
                        (int) ($body['pid'] ?? 0),
                        (int) ($body['visit_type_id'] ?? 0),
                        $userId,
                        $this->resolveDeskFacilityFromBody($body),
                        isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null,
                        !empty($body['is_urgent'])
                    );
                    $this->encounterSessionService->bindForVisit((int) $visit['id'], $userId);
                    $this->respond(true, 'Visit started at triage', ['visit' => $visit]);
                    break;
                case 'triage.restore_session':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $session = $this->encounterSessionService->bindForVisitWithDeskAcl(
                        (int) ($body['visit_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'Session restored', ['session' => $session->toArray()]);
                    break;
                case 'doctor.queue':
                    $facilityId = $this->resolveRequestFacilityId();
                    $queue = $this->doctorService->getDoctorQueue(
                        $facilityId,
                        $_REQUEST['visit_date'] ?? date('Y-m-d'),
                        $userId,
                        (string) ($_REQUEST['scope'] ?? 'me')
                    );
                    $queue = $this->enrichQueuePayload($queue, $userId, $facilityId);
                    $this->respond(true, 'ok', $queue);
                    break;
                case 'doctor.active':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $payload = $this->doctorService->getActiveConsultPayload(
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
                    $payload = $this->doctorService->takePatient(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0)
                    );
                    $this->respond(true, 'Patient taken', $payload);
                    break;
                case 'doctor.complete':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->doctorService->completeConsult(
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
                    $result = $this->doctorService->reopenConsult(
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
                    $result = $this->doctorService->setSupervisor($encounterId, $supervisorId, $userId);
                    $this->respond(true, 'Supervisor updated', $result);
                    break;
                case 'doctor.search_providers':
                    if ($method !== 'GET') {
                        $this->respond(false, 'GET required', [], 405);
                    }
                    $query = (string) ($_REQUEST['q'] ?? '');
                    $facilityId = $this->resolveRequestFacilityId();
                    $results = $this->doctorService->searchProviders($query, $facilityId, $userId);
                    $this->respond(true, 'ok', ['providers' => $results]);
                    break;
                case 'doctor.shortcut_preflight':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $preflight = $this->consultShortcutService->preflight(
                        (int) ($body['visit_id'] ?? 0),
                        (string) ($body['shortcut'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $preflight);
                    break;
                case 'doctor.restore_session':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $session = $this->encounterSessionService->bindForVisitWithDeskAcl(
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
                    $catalog = $this->labPanelOrderService->getCatalogPayload($facilityId);
                    $this->respond(true, 'ok', $catalog);
                    break;
                case 'doctor.lab_panel_place':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->labPanelOrderService->placeOrder(
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
                    $formularyCatalog = $this->pharmFormularyRxService->getCatalogPayload($facilityId);
                    $this->respond(true, 'ok', $formularyCatalog);
                    break;
                case 'doctor.formulary_rx_place':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $rxResult = $this->pharmFormularyRxService->placePrescriptions(
                        (int) ($body['visit_id'] ?? 0),
                        (array) ($body['drug_ids'] ?? []),
                        $userId
                    );
                    $this->respond(true, 'Prescriptions added', $rxResult);
                    break;
                case 'cashier.queue':
                    $facilityId = $this->resolveRequestFacilityId();
                    $queue = $this->cashierService->getCashierQueue(
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
                    $payload = $this->cashierService->selectVisit(
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
                    $payload = $this->cashierService->resolvePatientCheckout(
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
                    $payload = $this->cashierService->postCharges(
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
                    $result = $this->cashierService->recordPayment(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        (float) ($body['amount_received'] ?? 0),
                        isset($body['receipt_note']) ? (string) $body['receipt_note'] : null,
                        $this->esignOverrideReason($body),
                        isset($body['client_request_id']) ? (string) $body['client_request_id'] : null
                    );
                    $this->respond(true, 'Payment recorded', $result);
                    break;
                case 'cashier.mark_unpaid':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->cashierService->markClosedUnpaid(
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
                    $result = $this->cashierService->closeWithoutCharge(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        (string) ($body['reason'] ?? '')
                    );
                    $this->respond(true, 'Visit closed without charge', $result);
                    break;
                case 'lab.queue':
                    $facilityId = $this->resolveRequestFacilityId();
                    $queue = $this->labService->getLabQueue(
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
                    $payload = $this->labService->selectVisit(
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
                    $payload = $this->labService->takePatient(
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
                    $result = $this->labService->completeLab(
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
                    $result = $this->labService->skipToPayment(
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
                    $preflight = $this->labShortcutService->preflight(
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
                    $session = $this->encounterSessionService->bindForVisitWithDeskAcl(
                        (int) ($body['visit_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'Session restored', ['session' => $session->toArray()]);
                    break;
                case 'pharmacy.queue':
                    $facilityId = $this->resolveRequestFacilityId();
                    $queue = $this->pharmacyService->getPharmacyQueue(
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
                    $payload = $this->pharmacyService->selectVisit(
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
                    $payload = $this->pharmacyService->takePatient(
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
                    $result = $this->pharmacyService->completePharmacy(
                        (int) ($body['visit_id'] ?? 0),
                        $userId,
                        (int) ($body['row_version'] ?? 0),
                        $this->esignOverrideReason($body),
                        $this->undispensedOverrideReason($body)
                    );
                    $this->respond(true, 'Pharmacy completed', $result);
                    break;
                case 'pharmacy.skip_to_payment':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->pharmacyService->skipToPayment(
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
                    $preflight = $this->pharmacyShortcutService->preflight(
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
                    $session = $this->encounterSessionService->bindForVisitWithDeskAcl(
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
                    $payload = $this->clinicAdminService->getSettingsPayload(
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
                    $payload = $this->clinicAdminService->saveSettings(
                        $scope,
                        (array) ($body['settings'] ?? []),
                        $userId,
                        $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->respond(true, 'Settings saved', $payload);
                    break;
                case 'admin.visit_type.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->visitTypeAdminService->save(
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
                    $payload = $this->visitTypeAdminService->archive(
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
                    $payload = $this->feeScheduleAdminService->save(
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
                    $payload = $this->feeScheduleAdminService->archive(
                        $facilityId,
                        (int) ($body['fee_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'Fee line archived', $payload);
                    break;
                case 'admin.fee.billing_codes':
                    $codeType = (string) ($_REQUEST['code_type'] ?? '');
                    $query = (string) ($_REQUEST['q'] ?? '');
                    $codes = $this->feeScheduleAdminService->searchBillingCodes($codeType, $query);
                    $this->respond(true, 'ok', ['billing_codes' => $codes]);
                    break;
                case 'admin.fee.import':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->feeScheduleAdminService->importCsv(
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
                    $payload = $this->clinicAdminService->grantDeskRolesToCurrentUser($username, $userId);
                    $this->respond(true, 'Roles granted — log out and back in for ACL to take effect', $payload);
                    break;
                case 'reports.daily':
                    $facilityId = $this->resolveRequestFacilityId();
                    $report = $this->reportsService->getDailyReport(
                        $facilityId,
                        $_REQUEST['visit_date'] ?? date('Y-m-d')
                    );
                    $this->respond(true, 'ok', $report);
                    break;
                case 'reports.reconciliation':
                    $facilityId = $this->resolveRequestFacilityId();
                    $runDate = (string) ($_REQUEST['run_date'] ?? date('Y-m-d'));
                    $this->respond(true, 'ok', [
                        'latest_run' => $this->reconciliationService->getLatestRun($facilityId),
                        'totals' => $this->reconciliationService->fetchTotals($facilityId, $runDate),
                    ]);
                    break;
                case 'reports.hub_summary':
                    $this->reportHubAccessService->assertHubAccess();
                    $facilityId = $this->resolveRequestFacilityId();
                    $visitDate = (string) ($_REQUEST['visit_date'] ?? date('Y-m-d'));
                    $daily = $this->reportsService->getDailyReport($facilityId, $visitDate);
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
                    $this->reportHubAccessService->assertHubAccess();
                    $facilityId = $this->resolveRequestFacilityId();
                    $lens = isset($_REQUEST['lens']) ? (string) $_REQUEST['lens'] : null;
                    if ($lens === '') {
                        $lens = null;
                    }
                    $this->respond(true, 'ok', $this->reportHubCatalogService->getCatalog($lens, $facilityId));
                    break;
                case 'reports.export_run':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $recorded = $this->reportHubExportService->recordExportRun($body, $userId);
                    $this->respond(true, 'ok', $recorded);
                    break;
                case 'admin.reconciliation.run':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = $this->resolveRequestFacilityId();
                    $runDate = (string) ($body['run_date'] ?? date('Y-m-d'));
                    $result = $this->reconciliationService->run($facilityId, $runDate, 'manual', $userId);
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
                    $payload = $this->clinicAdminService->applyCashClinicProfile(
                        $scope,
                        $userId,
                        $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->respond(true, 'Cash clinic profile applied', $payload);
                    break;
                case 'queue.counts':
                    $facilityId = $this->resolveRequestFacilityId();
                    $counts = $this->visitQueueService->getCounts($facilityId);
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
                    $result = $this->sessionRoleService->switchRole($role, $userId);
                    $this->respond(true, 'ok', $result);
                    break;
                case 'communications.hub_counts':
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $counts = $this->communicationsHubService->hubCounts($authUser, $userId);
                    $this->respond(true, 'ok', $counts);
                    break;
                case 'communications.messages_list':
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $list = $this->communicationsHubService->listMessages($authUser, [
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
                    $detail = $this->communicationsHubService->getMessageDetail($noteId, $authUser);
                    $this->respond(true, 'ok', $detail);
                    break;
                case 'communications.reminders_list':
                    $days = (int) ($_REQUEST['days'] ?? 30);
                    $list = $this->communicationsHubService->listReminders($userId, $days);
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
                    $this->communicationsHubService->markMessageDone($noteId, $authUser);
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
                    $this->communicationsHubService->setMessageStatus($noteId, $messageStatus, $authUser);
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
                    $result = $this->communicationsHubService->assignMessagePatient($noteId, $pid, $authUser);
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
                    $this->communicationsHubService->deleteMessage($noteId, $authUser);
                    $this->respond(true, 'ok', ['id' => $noteId]);
                    break;
                case 'communications.reminder_done':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $reminderId = (int) ($body['dr_id'] ?? $body['id'] ?? 0);
                    $this->communicationsHubService->markReminderProcessed($reminderId, $userId);
                    $this->respond(true, 'ok', ['id' => $reminderId]);
                    break;
                case 'communications.compose_options':
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $replyNoteId = (int) ($_REQUEST['reply_note_id'] ?? 0);
                    $options = $this->communicationsHubService->getComposeOptions(
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
                    $result = $this->communicationsHubService->sendMessage($body, $authUser, $userId);
                    $this->respond(true, 'ok', $result);
                    break;
                case 'communications.reminder_create_options':
                    $forwardReminderId = (int) ($_REQUEST['forward_reminder_id'] ?? 0);
                    $options = $this->communicationsHubService->getReminderCreateOptions(
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
                    $result = $this->communicationsHubService->createReminder($body, $userId);
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
                    $log = $this->communicationsHubService->listReminderLog($userId, $filters);
                    $this->respond(true, 'ok', $log);
                    break;
                case 'communications.save_preferences':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $canViewAll = AclMain::aclCheckCore('admin', 'super');
                    $prefs = $this->commHubUserSettingsService->savePreferences($body, $canViewAll);
                    $this->respond(true, 'ok', $prefs);
                    break;
                case 'cohort.presets':
                    $this->cohortSearchService->assertRegistryAccess();
                    $this->respond(true, 'ok', $this->cohortSearchService->presets());
                    break;
                case 'cohort.search':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->cohortSearchService->search($body);
                    $this->registryAuditService->logSearch(
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
                        $export = $this->cohortSearchService->export($body);
                        $filters = is_array($body['filters'] ?? null) ? $body['filters'] : [];
                        $this->registryAuditService->logExport(
                            $this->cohortSearchService->explainCriteria($filters),
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
                        $this->cohortSavedFilterService->delete(
                            $userId,
                            (int) ($body['id'] ?? 0)
                        );
                        $this->respond(true, 'ok', ['deleted' => true]);
                        break;
                    }
                    $saved = $this->cohortSavedFilterService->save($userId, $body);
                    $this->respond(true, 'ok', $saved);
                    break;
                case 'lab_ops.worklist':
                    $body = $this->readRequestParams($method);
                    $worklist = $this->labOpsWorklistService->worklist([
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
                    $pharmWorklist = $this->pharmOpsWorklistService->worklist([
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
                    $form = $this->pharmOpsDispenseService->getDispenseForm($prescriptionId);
                    $this->respond(true, 'ok', $form);
                    break;
                case 'pharm_ops.dispense_confirm':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $confirmed = $this->pharmOpsDispenseService->confirmDispense(
                        (int) ($body['prescription_id'] ?? 0),
                        $body,
                        $userId
                    );
                    $this->respond(true, 'ok', $confirmed);
                    break;
                case 'pharm_ops.otc_drugs_search':
                    $body = $this->readRequestParams($method);
                    $drugSearch = $this->pharmOpsOtcSaleService->searchDrugs(
                        (string) ($body['q'] ?? $_REQUEST['q'] ?? ''),
                        (int) ($body['limit'] ?? 20)
                    );
                    $this->respond(true, 'ok', $drugSearch);
                    break;
                case 'pharm_ops.otc_sale_get':
                    $body = $this->readRequestParams($method);
                    $otcForm = $this->pharmOpsOtcSaleService->getSaleForm(
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
                    $otcSale = $this->pharmOpsOtcSaleService->confirmSale($body, $userId);
                    $this->respond(true, 'ok', $otcSale);
                    break;
                case 'pharm_ops.receive_get':
                    $body = $this->readRequestParams($method);
                    $receiveForm = $this->pharmOpsReceiveService->getReceiveForm(
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
                    $received = $this->pharmOpsReceiveService->saveReceive($body, $userId);
                    $this->respond(true, 'ok', $received);
                    break;
                case 'pharm_ops.setup_status':
                    $setupStatus = $this->pharmOpsSetupService->getSetupStatus();
                    $this->respond(true, 'ok', $setupStatus);
                    break;
                case 'pharm_ops.reports_embed':
                    $reportsEmbed = $this->pharmOpsReportsService->embedCatalog();
                    $this->respond(true, 'ok', $reportsEmbed);
                    break;
                case 'pharm_ops.controlled_catalog':
                    (new PharmOpsAccessService())->assertCatalogAccess();
                    $controlledCatalog = [
                        'drugs' => $this->pharmDrugMetaService->listActiveCatalogFlags(),
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
                    $saved = $this->pharmDrugMetaService->saveControlledFlags($body['drugs'] ?? []);
                    $this->respond(true, 'ok', [
                        'saved' => $saved,
                        'drugs' => $this->pharmDrugMetaService->listActiveCatalogFlags(),
                    ]);
                    break;
                case 'pharm_ops.destroy_get':
                    $body = $this->readRequestParams($method);
                    $destroyForm = $this->pharmOpsDestroyService->getDestroyForm(
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
                    $destroyed = $this->pharmOpsDestroyService->confirmDestroy($body, $userId);
                    $this->respond(true, 'ok', $destroyed);
                    break;
                case 'pharm_ops.rx_print_pdf':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $rxPrint = $this->pharmOpsRxPrintService->preparePrint(
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
                    $labelPrint = $this->pharmOpsDispenseLabelService->preparePrint(
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
                    $warehouse = $this->pharmOpsSetupService->createDefaultWarehouse(
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
                    $imported = $this->pharmOpsSetupService->importStarterFormulary(
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
                    $form = $this->labOpsResultService->getEntryForm($orderId);
                    $this->respond(true, 'ok', $form);
                    break;
                case 'lab_ops.result_save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $saved = $this->labOpsResultService->saveEntry(
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
                    $released = $this->labOpsResultService->releaseReport(
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
                    $collected = $this->labOpsOrderMetaService->collectSpecimen(
                        (int) ($body['procedure_order_id'] ?? 0),
                        isset($body['accession_no']) ? (string) $body['accession_no'] : null,
                        $userId
                    );
                    $this->respond(true, 'ok', $collected);
                    break;
                case 'lab_ops.setup_status':
                    $status = $this->labOpsSetupService->getSetupStatus();
                    $this->respond(true, 'ok', $status);
                    break;
                case 'lab_ops.setup_model':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $modelResult = $this->labOpsSetupService->setSetupModel(
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
                    $providerResult = $this->labOpsSetupService->createInHouseProvider(
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
                    $sendOutResult = $this->labOpsSetupService->createSendOutProvider(
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
                    $providerId = isset($body['provider_id']) ? (int) $body['provider_id'] : null;
                    if (!empty($body['use_starter'])) {
                        $importResult = $this->labOpsSetupService->importStarterPanel(
                            $providerId > 0 ? $providerId : null,
                            $userId
                        );
                    } else {
                        $importResult = $this->labOpsSetupService->importPanelCsv(
                            $providerId > 0 ? $providerId : null,
                            (string) ($body['csv'] ?? ''),
                            $userId
                        );
                    }
                    $this->respond(true, 'ok', $importResult);
                    break;
                case 'lab_ops.fee_map_list':
                    $providerId = isset($_REQUEST['provider_id']) ? (int) $_REQUEST['provider_id'] : null;
                    $unmapped = $this->labOpsSetupService->listUnmappedFees(
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
                        $providerId = isset($body['provider_id']) ? (int) $body['provider_id'] : null;
                        $feeResult = $this->labOpsSetupService->applyStarterFeeDefaults(
                            $providerId > 0 ? $providerId : null,
                            $userId
                        );
                    } else {
                        $rows = is_array($body['rows'] ?? null) ? $body['rows'] : [];
                        $feeResult = $this->labOpsSetupService->saveFeeMappings($rows, $userId);
                    }
                    $this->respond(true, 'ok', $feeResult);
                    break;
                case 'lab_ops.mark_send_out':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $sendOut = $this->labOpsOrderMetaService->markAsSendOut(
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
                    $charges = $this->billOpsChargeCorrectionService->getVisitCharges($visitId, $userId);
                    $this->respond(true, 'ok', $charges);
                    break;
                case 'bill_ops.charge_correct':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $corrected = $this->billOpsChargeCorrectionService->applyCorrection(
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
                    $search = $this->billOpsPaymentsSearchService->search(
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
                    $reversed = $this->billOpsPaymentsSearchService->reverse(
                        (int) ($body['payment_id'] ?? $body['receipt_id'] ?? 0),
                        (string) ($body['reason'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $reversed);
                    break;
                case 'bill_ops.daysheet':
                    $params = $this->readRequestParams($method);
                    $daysheet = $this->billOpsDaysheetService->getDaysheet(
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
                    $exported = $this->billOpsDaysheetService->recordExport(
                        (int) ($body['facility_id'] ?? 0),
                        (string) ($body['date'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $exported);
                    break;
                case 'bill_ops.outstanding_list':
                    $params = $this->readRequestParams($method);
                    $list = $this->billOpsOutstandingService->listOutstanding(
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

    private function authorizeAction(string $action): void
    {
        if ($this->actionPolicy->isDeprecated($action)) {
            $this->respond(
                false,
                'Use role-specific workflow actions (triage, doctor, cashier)',
                ['code' => 'deprecated'],
                410
            );
        }

        $desc = $this->actionPolicy->describe($action);
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
            $this->reportHubAccessService->assertHubAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireReportHubExportAcl(): void
    {
        try {
            $this->reportHubAccessService->assertHubAccess();
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

    private function authorizeChartRead(int $pid = 0): void
    {
        foreach (AjaxActionPolicy::CHART_READ_ACLS as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return;
            }
        }

        if ($pid > 0) {
            $this->respond(false, 'Patient not found', ['code' => 'not_found'], 404);
        }

        $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
    }

    private function authorizePaymentHistory(int $pid = 0): void
    {
        if (!AclMain::aclCheckCore('new_clinic', 'new_chart_depth_finance')) {
            if ($pid > 0) {
                $this->respond(false, 'Patient not found', ['code' => 'not_found'], 404);
            }
            $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
        }

        $this->authorizeChartRead($pid);
    }

    private function authorizeReceiptReprint(int $pid = 0): void
    {
        if (!AclMain::aclCheckCore('new_clinic', 'new_receipt_reprint')
            && !AclMain::aclCheckCore('new_clinic', 'new_chart_depth_finance')) {
            if ($pid > 0) {
                $this->respond(false, 'Patient not found', ['code' => 'not_found'], 404);
            }
            $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
        }

        $this->authorizeChartRead($pid);
    }

    private function authorizeReferralHub(int $pid = 0): void
    {
        if (!AclMain::aclCheckCore('new_clinic', 'new_chart_depth_referral')
            && !AclMain::aclCheckCore('new_clinic', 'new_chart_depth')) {
            if ($pid > 0) {
                $this->respond(false, 'Patient not found', ['code' => 'not_found'], 404);
            }
            $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
        }

        $this->authorizeChartRead($pid);
    }

    private function authorizeClinicalExport(int $pid = 0): void
    {
        if (!AclMain::aclCheckCore('new_clinic', 'new_chart_depth_export')
            && !AclMain::aclCheckCore('new_clinic', 'new_chart_depth_export_full')
            && !AclMain::aclCheckCore('new_clinic', 'new_admin')) {
            if ($pid > 0) {
                $this->respond(false, 'Patient not found', ['code' => 'not_found'], 404);
            }
            $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
        }

        $this->authorizeChartRead($pid);
    }

    private function assertPatientChartPid(int $pid): void
    {
        if ($pid <= 0) {
            $this->respond(false, 'Patient not found', ['code' => 'not_found'], 404);
        }

        try {
            $this->facilityScopeService->assertPatientAccessible($pid);
        } catch (\RuntimeException) {
            $this->respond(false, 'Patient not found', ['code' => 'not_found'], 404);
        }
    }

    private function resolveRequestFacilityId(): int
    {
        $requested = (int) ($_REQUEST['facility_id'] ?? 0);
        $sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;

        return $this->visitScopeService->resolveQueueFacilityId(
            $requested > 0 ? $requested : $sessionFacility
        );
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

        $printEnabled = $this->queueSlipService->isPrintEnabled($facilityId);
        $response['queue_slip_enabled'] = $printEnabled;
        if ($printEnabled) {
            $webroot = $GLOBALS['webroot'] ?? '';
            $response['queue_slip_url'] = $webroot
                . '/interface/modules/custom_modules/oe-module-new-clinic/public/queue-slip.php?visit_id='
                . urlencode((string) $visitId)
                . '&print=1';
            $response['queue_slip'] = $this->queueSlipService->buildPrintPayload($visitId, $userId);
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
            return $this->visitScopeService->resolveQueueFacilityId($fromBody);
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
            return $action;
        }

        if (strcasecmp((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'), 'POST') === 0) {
            $fromBody = trim((string) ($this->readJsonBody()['action'] ?? ''));
            if ($fromBody !== '') {
                return $fromBody;
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
            $queuePayload['visits'] = $this->similarSurnameQueueService->annotateVisits(
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

        return $this->visitClaimLostService->enrichQueueResponse($queuePayload, $watch, $userId);
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

            return $this->registrationService->saveSection($section, $patient, null, $userId);
        }

        return $this->quickAddService->create($patient, $userId);
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


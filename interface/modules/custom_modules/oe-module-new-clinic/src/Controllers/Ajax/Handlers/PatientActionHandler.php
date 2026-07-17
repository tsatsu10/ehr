<?php

/**
 * patients.* ajax actions (AUDIT-10f).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\ClinicalIssueEditorService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\PatientActivityFeedService;
use OpenEMR\Modules\NewClinic\Services\PatientChartClinicalService;
use OpenEMR\Modules\NewClinic\Services\PatientChartMessagesService;
use OpenEMR\Modules\NewClinic\Services\PatientChartSearchService;
use OpenEMR\Modules\NewClinic\Services\PatientChartService;
use OpenEMR\Modules\NewClinic\Services\PatientContextService;
use OpenEMR\Modules\NewClinic\Services\PatientDuplicateService;
use OpenEMR\Modules\NewClinic\Services\PatientHistoryEditorService;
use OpenEMR\Modules\NewClinic\Services\PatientImmunizationEditorService;
use OpenEMR\Modules\NewClinic\Services\PatientPayerService;
use OpenEMR\Modules\NewClinic\Services\PatientRegistrationService;
use OpenEMR\Modules\NewClinic\Services\PatientSearchService;
use OpenEMR\Modules\NewClinic\Services\RateLimitService;

final class PatientActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'patients.search',
        'patients.preview',
        'patients.chart.visits',
        'patients.chart.clinical',
        'patients.chart.issue_get',
        'patients.chart.issue_save',
        'patients.chart.history_get',
        'patients.chart.history_save',
        'patients.chart.immunization_options',
        'patients.chart.immunization_get',
        'patients.chart.immunization_save',
        'patients.chart.activity_feed',
        'patients.chart.messages',
        'patients.note_detail',
        'patients.chart.search',
        'patients.dup_check',
        'patients.create',
        'patients.update',
        'patients.registration.get',
        'patients.registration.payer_list',
        'patients.registration.payer_add',
        'patients.registration.payer_remove',
    ];

    public function __construct(
        private readonly AjaxController $host,
    ) {
    }

    public function supports(string $action): bool
    {
        return in_array($action, self::ACTIONS, true);
    }

    public function handle(string $action, string $method, int $userId): void
    {
        switch ($action) {
            case 'patients.search':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $this->host->svc(RateLimitService::class)->assertWithinLimit('patients.search', $userId);
                $result = $this->host->svc(PatientSearchService::class)->search(
                    (string) ($body['q'] ?? ''),
                    (int) ($body['limit'] ?? 8),
                    $userId
                );
                $this->host->respond(true, 'ok', $result->toArray());
                break;
            case 'patients.preview':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $pid = (int) ($body['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.preview', $pid);
                $this->host->assertPatientChartPid($pid);
                $preview = $this->host->svc(PatientContextService::class)->previewPayload(
                    $pid,
                    $userId,
                    (string) ($body['context'] ?? 'front-desk')
                );
                $this->host->respond(true, 'ok', $preview);
                break;
            case 'patients.chart.visits':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.chart.visits', $pid);
                $this->host->assertPatientChartPid($pid);
                $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                $limit = (int) ($_REQUEST['limit'] ?? PatientChartService::PAST_VISITS_PAGE_SIZE);
                $visits = $this->host->svc(PatientChartService::class)->getVisitsPayload($pid, $offset, $limit);
                $this->host->respond(true, 'ok', $visits);
                break;
            case 'patients.chart.clinical':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.chart.clinical', $pid);
                $this->host->assertPatientChartPid($pid);
                $clinical = $this->host->svc(PatientChartClinicalService::class)->getClinicalPayload($pid);
                $this->host->respond(true, 'ok', $clinical);
                break;
            case 'patients.chart.issue_get':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.chart.clinical', $pid);
                $this->host->assertPatientChartPid($pid);
                try {
                    $issue = $this->host->svc(ClinicalIssueEditorService::class)
                        ->getIssue($pid, (int) ($_REQUEST['id'] ?? 0));
                    $this->host->respond(true, 'ok', $issue);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'not_found'], (int) ($e->getCode() ?: 404));
                }
                break;
            case 'patients.chart.issue_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.chart.clinical', $pid);
                $this->host->assertPatientChartPid($pid);
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $saved = $this->host->svc(ClinicalIssueEditorService::class)
                        ->saveIssue($pid, (array) ($body['issue'] ?? []), $userId);
                    $this->host->respond(true, 'Saved', $saved);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid'], (int) ($e->getCode() ?: 400));
                } catch (\RuntimeException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                }
                break;
            case 'patients.chart.history_get':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.chart.clinical', $pid);
                $this->host->assertPatientChartPid($pid);
                try {
                    $history = $this->host->svc(PatientHistoryEditorService::class)->getForEdit($pid);
                    $this->host->respond(true, 'ok', $history);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid'], (int) ($e->getCode() ?: 400));
                }
                break;
            case 'patients.chart.history_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.chart.clinical', $pid);
                $this->host->assertPatientChartPid($pid);
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $saved = $this->host->svc(PatientHistoryEditorService::class)
                        ->save($pid, (array) ($body['background'] ?? []), $userId);
                    $this->host->respond(true, 'Saved', $saved);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid'], (int) ($e->getCode() ?: 400));
                } catch (\RuntimeException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                }
                break;
            case 'patients.chart.immunization_options':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.chart.clinical', $pid);
                $this->host->assertPatientChartPid($pid);
                $this->host->respond(true, 'ok', [
                    'vaccines' => $this->host->svc(PatientImmunizationEditorService::class)->vaccineOptions(),
                ]);
                break;
            case 'patients.chart.immunization_get':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.chart.clinical', $pid);
                $this->host->assertPatientChartPid($pid);
                try {
                    $shot = $this->host->svc(PatientImmunizationEditorService::class)
                        ->getShot($pid, (int) ($_REQUEST['id'] ?? 0));
                    $this->host->respond(true, 'ok', $shot);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'not_found'], (int) ($e->getCode() ?: 404));
                }
                break;
            case 'patients.chart.immunization_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.chart.clinical', $pid);
                $this->host->assertPatientChartPid($pid);
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $saved = $this->host->svc(PatientImmunizationEditorService::class)
                        ->saveShot($pid, (array) ($body['immunization'] ?? []), $userId);
                    $this->host->respond(true, 'Saved', $saved);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid'], (int) ($e->getCode() ?: 400));
                } catch (\RuntimeException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                }
                break;
            case 'patients.chart.activity_feed':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.chart.activity_feed', $pid);
                $this->host->assertPatientChartPid($pid);
                $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                $limit = (int) ($_REQUEST['limit'] ?? PatientActivityFeedService::PAGE_SIZE);
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                $lookbackDays = (int) ($_REQUEST['lookback_days'] ?? 0);
                $feed = $this->host->svc(PatientActivityFeedService::class)->getActivityFeed(
                    $pid,
                    $offset,
                    $limit,
                    true,
                    $visitId > 0 ? $visitId : null,
                    $lookbackDays > 0 ? $lookbackDays : null,
                );
                $this->host->respond(true, 'ok', $feed);
                break;
            case 'patients.chart.messages':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.chart.messages', $pid);
                $this->host->assertPatientChartPid($pid);
                $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                $limit = (int) ($_REQUEST['limit'] ?? PatientChartMessagesService::PAGE_SIZE);
                $messages = $this->host->svc(PatientChartMessagesService::class)->getMessagesPayload(
                    $pid,
                    $offset,
                    $limit,
                    (string) ($_REQUEST['activity'] ?? 'all')
                );
                $this->host->respond(true, 'ok', $messages);
                break;
            case 'patients.note_detail':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.note_detail', $pid);
                $this->host->assertPatientChartPid($pid);
                $detail = $this->host->svc(PatientChartMessagesService::class)->getNoteDetail(
                    $pid,
                    (int) ($_REQUEST['note_id'] ?? 0)
                );
                $this->host->respond(true, 'ok', $detail);
                break;
            case 'patients.chart.search':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.chart.search', $pid);
                $this->host->assertPatientChartPid($pid);
                $config = new ClinicConfigService();
                if ($config->getInt('enable_in_chart_patient_search', 0) !== 1) {
                    $this->host->respond(false, 'Feature not enabled', ['code' => 'feature_disabled'], 403);
                }
                $query = trim((string) ($_REQUEST['q'] ?? ''));
                $limit = (int) ($_REQUEST['limit'] ?? PatientChartSearchService::DEFAULT_LIMIT);
                $search = $this->host->svc(PatientChartSearchService::class)->search($pid, $query, $limit);
                $this->host->respond(true, 'ok', $search);
                break;
            case 'patients.dup_check':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $this->host->svc(RateLimitService::class)->assertWithinLimit('patients.dup_check', $userId);
                $excludePid = (int) ($body['exclude_pid'] ?? $body['pid'] ?? 0);
                $dup = $this->host->svc(PatientDuplicateService::class)->scoreProspect(
                    $body,
                    $excludePid > 0 ? $excludePid : null
                );
                $this->host->respond(true, 'ok', $dup);
                break;
            case 'patients.create':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $created = $this->host->resolvePatientCreate($body, $userId);
                $this->host->respond(true, 'Patient saved', $created);
                break;
            case 'patients.update':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $section = (int) ($body['section'] ?? 0);
                $pid = (int) ($body['pid'] ?? 0);
                $patient = is_array($body['patient'] ?? null) ? $body['patient'] : $body;
                if ($pid <= 0 || $section < 1 || $section > 4) {
                    $this->host->respond(false, 'pid and section (1-4) are required', [], 400);
                }
                $patient = array_merge($patient, [
                    'dup_confirm' => $body['dup_confirm'] ?? null,
                    'dup_override' => $body['dup_override'] ?? null,
                    'dup_override_reason' => $body['dup_override_reason'] ?? null,
                    'national_id' => trim((string) ($body['national_id'] ?? ($patient['national_id'] ?? ''))),
                    'no_phone' => $body['no_phone'] ?? ($patient['no_phone'] ?? null),
                ]);
                $updated = $this->host->svc(PatientRegistrationService::class)->saveSection($section, $patient, $pid, $userId);
                $this->host->respond(true, 'Patient updated', $updated);
                break;
            case 'patients.registration.get':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $pid = (int) ($body['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.registration.get', $pid);
                $this->host->assertPatientChartPid($pid);
                $form = $this->host->svc(PatientRegistrationService::class)->getFormData($pid);
                $this->host->respond(true, 'ok', $form);
                break;
            case 'patients.registration.payer_list':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.registration.payer_list', $pid);
                $this->host->assertPatientChartPid($pid);
                $svc = $this->host->svc(PatientPayerService::class);
                $this->host->respond(true, 'ok', [
                    'enabled' => $svc->isEnabled($this->host->resolveRequestFacilityId()),
                    'payers' => $svc->listForPatient($pid),
                ]);
                break;
            case 'patients.registration.payer_add':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $pid = (int) ($body['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.registration.payer_add', $pid);
                $this->host->assertPatientChartPid($pid);
                try {
                    $saved = $this->host->svc(PatientPayerService::class)->addPayer(
                        $pid,
                        (string) ($body['rank'] ?? 'secondary'),
                        (string) ($body['payer_type'] ?? 'nhis'),
                        isset($body['insurance_company_id']) ? (int) $body['insurance_company_id'] : null,
                        (string) ($body['membership_number'] ?? ''),
                        isset($body['expiry_date']) ? (string) $body['expiry_date'] : null
                    );
                    $this->host->respond(true, 'Payer saved', $saved);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid'], 400);
                }
                break;
            case 'patients.registration.payer_remove':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $pid = (int) ($body['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('patients.registration.payer_add', $pid);
                $this->host->assertPatientChartPid($pid);
                $this->host->svc(PatientPayerService::class)->removePayer($pid, (int) ($body['id'] ?? 0));
                $this->host->respond(true, 'Payer removed', []);
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}

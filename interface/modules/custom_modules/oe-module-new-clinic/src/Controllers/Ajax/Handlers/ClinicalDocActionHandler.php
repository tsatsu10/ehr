<?php

/**
 * clinical_doc.* and encounter_note.* ajax actions (AUDIT-10m).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Exceptions\EncounterSessionMismatchException;
use OpenEMR\Modules\NewClinic\Services\ClinicAdminService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocAccessService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocCatalogService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocFormOpenService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocVisitSummaryService;
use OpenEMR\Modules\NewClinic\Services\ClinicalInstructionsEditorService;
use OpenEMR\Modules\NewClinic\Services\EncounterNoteService;
use OpenEMR\Modules\NewClinic\Services\ProcedureOrderFormService;
use OpenEMR\Modules\NewClinic\Services\CertificateService;
use OpenEMR\Modules\NewClinic\Services\EyeExamService;
use OpenEMR\Modules\NewClinic\Services\ScreeningAssessmentService;
use OpenEMR\Modules\NewClinic\Services\VitalsEditorService;

final class ClinicalDocActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'clinical_doc.visit_summary',
        'clinical_doc.catalog',
        'clinical_doc.sign_status',
        'clinical_doc.open_form',
        'clinical_doc.favorites',
        'clinical_doc.import_ghana_pack',
        'clinical_doc.import_referral_hospital_pack',
        'clinical_doc.import_ancillary_pack',
        'encounter_note.get',
        'encounter_note.save',
        'encounter_note.prefill',
        'encounter_note.validate',
        'encounter_note.sign',
        'encounter_note.unlock',
        'proc_order.form_data',
        'proc_order.save',
        'clinical_doc.instructions_get',
        'clinical_doc.instructions_save',
        'clinical_doc.screening_get',
        'clinical_doc.screening_save',
        'clinical_doc.vitals_get',
        'clinical_doc.vitals_save',
        'clinical_doc.certificate_get',
        'clinical_doc.certificate_save',
        'clinical_doc.eye_exam_get',
        'clinical_doc.eye_exam_save',
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
            case 'clinical_doc.visit_summary':
                $this->host->svc(ClinicalDocAccessService::class)->assertHubAccess();
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                $lens = isset($_REQUEST['lens']) ? (string) $_REQUEST['lens'] : null;
                if ($lens === '') {
                    $lens = null;
                }
                try {
                    $summary = $this->host->svc(ClinicalDocVisitSummaryService::class)->getVisitSummary($visitId, $userId, $lens);
                    $this->host->respond(true, 'ok', $summary);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 400);
                    $this->host->respond(false, $e->getMessage(), ['code' => $code === 409 ? 'no_encounter_on_visit' : 'error'], $code);
                }
                break;
            case 'clinical_doc.catalog':
                $this->host->svc(ClinicalDocAccessService::class)->assertHubAccess();
                $facilityId = $this->host->resolveRequestFacilityId();
                $lens = isset($_REQUEST['lens']) ? (string) $_REQUEST['lens'] : null;
                if ($lens === '') {
                    $lens = null;
                }
                $this->host->respond(true, 'ok', $this->host->svc(ClinicalDocCatalogService::class)->getCatalog($lens, $facilityId));
                break;
            case 'clinical_doc.sign_status':
                $this->host->svc(ClinicalDocAccessService::class)->assertHubAccess();
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                try {
                    $status = $this->host->svc(ClinicalDocVisitSummaryService::class)->getSignStatus($visitId);
                    $this->host->respond(true, 'ok', $status);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 400);
                    $this->host->respond(false, $e->getMessage(), ['code' => $code === 409 ? 'no_encounter_on_visit' : 'error'], $code);
                }
                break;
            case 'clinical_doc.open_form':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $result = $this->host->svc(ClinicalDocFormOpenService::class)->openForm($body, $userId);
                    $this->host->respond(true, 'ok', $result);
                } catch (EncounterSessionMismatchException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'session_mismatch'], 409);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'encounter_note.get':
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                if ($visitId <= 0) {
                    $this->host->respond(false, 'visit_id required', [], 400);
                }
                try {
                    $payload = $this->host->svc(EncounterNoteService::class)->get($visitId, $userId);
                    $this->host->respond(true, 'ok', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'encounter_note.save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $payload = $this->host->svc(EncounterNoteService::class)->save($body, $userId);
                    $this->host->respond(true, 'Saved', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'encounter_note.prefill':
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                if ($visitId <= 0) {
                    $this->host->respond(false, 'visit_id required', [], 400);
                }
                try {
                    $payload = $this->host->svc(EncounterNoteService::class)->prefill($visitId, $userId);
                    $this->host->respond(true, 'ok', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'encounter_note.validate':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $payload = $this->host->svc(EncounterNoteService::class)->validate($body, $userId);
                    $this->host->respond(true, 'ok', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'encounter_note.sign':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $payload = $this->host->svc(EncounterNoteService::class)->sign($body, $userId);
                    $this->host->respond(true, 'Signed', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'encounter_note.unlock':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $payload = $this->host->svc(EncounterNoteService::class)->unlockForClinicalCorrection($body, $userId);
                    $this->host->respond(true, 'Unlocked', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'clinical_doc.favorites':
                $this->host->svc(ClinicalDocAccessService::class)->assertHubAccess();
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                if ($visitId <= 0) {
                    $this->host->respond(false, 'visit_id required', [], 400);
                }
                try {
                    $favorites = $this->host->svc(ClinicalDocVisitSummaryService::class)->getFavorites($visitId, $userId);
                    $this->host->respond(true, 'ok', $favorites);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 400);
                    $this->host->respond(false, $e->getMessage(), ['code' => $code === 409 ? 'no_encounter_on_visit' : 'error'], $code);
                }
                break;
            case 'clinical_doc.import_ghana_pack':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $this->host->requireSuperAdmin();
                $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                if ($scope !== 'global') {
                    $scope = 'facility';
                }
                $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                $setAsConsultNote = !empty($body['set_as_consult_note']);
                $payload = $this->host->svc(ClinicAdminService::class)->importGhanaOpdLbfPack(
                    $scope,
                    $userId,
                    $setAsConsultNote,
                    $requestedFacilityId > 0 ? $requestedFacilityId : null
                );
                $this->host->respond(true, 'Ghana OPD LBF pack imported', $payload);
                break;
            case 'clinical_doc.import_referral_hospital_pack':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $this->host->requireSuperAdmin();
                $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                if ($scope !== 'global') {
                    $scope = 'facility';
                }
                $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                $setAsConsultNote = !empty($body['set_as_consult_note']);
                $payload = $this->host->svc(ClinicAdminService::class)->importReferralHospitalLbfPack(
                    $scope,
                    $userId,
                    $setAsConsultNote,
                    $requestedFacilityId > 0 ? $requestedFacilityId : null
                );
                $this->host->respond(true, 'Referral hospital LBF pack imported', $payload);
                break;
            case 'clinical_doc.import_ancillary_pack':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $this->host->requireSuperAdmin();
                $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                if ($scope !== 'global') {
                    $scope = 'facility';
                }
                $packKey = strtolower(trim((string) ($body['pack_key'] ?? '')));
                if ($packKey === '') {
                    $this->host->respond(false, 'pack_key required', [], 400);
                }
                $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                try {
                    $payload = $this->host->svc(ClinicAdminService::class)->importAncillaryLbfPack(
                        $scope,
                        $userId,
                        $packKey,
                        $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->host->respond(true, 'Ancillary LBF pack imported', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_pack'], 400);
                }
                break;
            case 'proc_order.form_data':
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                $procedureOrderId = (int) ($_REQUEST['procedure_order_id'] ?? 0);
                try {
                    $payload = $this->host->svc(ProcedureOrderFormService::class)
                        ->getFormData($visitId, $procedureOrderId, $userId);
                    $this->host->respond(true, 'ok', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'proc_order.save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $payload = $this->host->svc(ProcedureOrderFormService::class)->saveOrder($body, $userId);
                    $this->host->respond(true, 'Order saved', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'clinical_doc.instructions_get':
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                try {
                    $payload = $this->host->svc(ClinicalInstructionsEditorService::class)
                        ->getInstructions($visitId, $userId);
                    $this->host->respond(true, 'ok', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'clinical_doc.instructions_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $payload = $this->host->svc(ClinicalInstructionsEditorService::class)
                        ->saveInstructions($body, $userId);
                    $this->host->respond(true, 'Saved', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'clinical_doc.screening_get':
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                $instrument = (string) ($_REQUEST['instrument'] ?? '');
                try {
                    $payload = $this->host->svc(ScreeningAssessmentService::class)
                        ->getAssessment($visitId, $instrument, $userId);
                    $this->host->respond(true, 'ok', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'clinical_doc.screening_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $payload = $this->host->svc(ScreeningAssessmentService::class)
                        ->saveAssessment($body, $userId);
                    $this->host->respond(true, 'Saved', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'clinical_doc.vitals_get':
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                try {
                    $payload = $this->host->svc(VitalsEditorService::class)
                        ->getVitals($visitId, $userId);
                    $this->host->respond(true, 'ok', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'clinical_doc.vitals_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $payload = $this->host->svc(VitalsEditorService::class)
                        ->saveVitals($body, $userId);
                    $this->host->respond(true, 'Saved', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'clinical_doc.certificate_get':
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                try {
                    $payload = $this->host->svc(CertificateService::class)
                        ->getCertificate($visitId, $userId);
                    $this->host->respond(true, 'ok', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'clinical_doc.certificate_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $payload = $this->host->svc(CertificateService::class)
                        ->saveCertificate($body, $userId);
                    $this->host->respond(true, 'Saved', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'clinical_doc.eye_exam_get':
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                try {
                    $payload = $this->host->svc(EyeExamService::class)
                        ->getExam($visitId, $userId);
                    $this->host->respond(true, 'ok', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            case 'clinical_doc.eye_exam_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $payload = $this->host->svc(EyeExamService::class)
                        ->saveExam($body, $userId);
                    $this->host->respond(true, 'Saved', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $code = (int) ($e->getCode() ?: 403);
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                }
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}

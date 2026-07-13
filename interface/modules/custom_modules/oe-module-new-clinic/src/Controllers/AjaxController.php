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
use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\AdminActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\BillOpsActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\CashierActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\ClinicalDocActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\CohortActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\CommunicationsActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\ChartDepthActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\DoctorActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\LabActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\FrontDeskActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\LabOpsActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\DocumentsActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\OfficeNotesActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\PatientActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\PharmacyActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\PharmOpsActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\OutreachActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\ProfileActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\QueueBridgeActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\ReportsActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\SchedulingActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\TriageActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\VisitActionHandler;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Modules\NewClinic\Exceptions\EncounterSessionMismatchException;
use OpenEMR\Modules\NewClinic\Exceptions\InputValidationException;
use OpenEMR\Modules\NewClinic\Exceptions\StaleVisitException;
use OpenEMR\Modules\NewClinic\Exceptions\AllergiesUndocumentedException;
use OpenEMR\Modules\NewClinic\Exceptions\ExternalRxIncompleteException;
use OpenEMR\Modules\NewClinic\Exceptions\UndispensedRxException;
use OpenEMR\Modules\NewClinic\Exceptions\UnsignedEncounterException;
use OpenEMR\Modules\NewClinic\Exceptions\VisitNotTakeableException;
use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\RateLimitService;
use OpenEMR\Modules\NewClinic\Services\PatientCohortSearchService;
use OpenEMR\Modules\NewClinic\Services\BillOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\LabOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\ReportHubAccessService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocAccessService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\PatientRegistrationService;
use OpenEMR\Modules\NewClinic\Services\FacilityScopeService;
use OpenEMR\Modules\NewClinic\Services\QuickAddService;
use OpenEMR\Modules\NewClinic\Services\QueueSlipService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeAccessService;
use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\VisitClaimLostService;
use OpenEMR\Modules\NewClinic\Services\SimilarSurnameQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use OpenEMR\Modules\NewClinic\Services\QueueRevision;

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
    public function svc(string $class): object
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

        // SCALE-0.1 — server-side perf baseline. Logs ONE structured line for slow
        // (>500 ms) or errored requests only (never per-fast-request → no log spam).
        // Registered before ACL/dispatch so 4xx short-circuits are captured too;
        // uses a shutdown function because respond() exits (a finally never runs).
        $this->registerPerfLogging($action, $userId);

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

        // SCALE-1.1 — release the PHP session lock for vetted read-only actions
        // (queue/board/counts polls, reference + admin reads) once auth + ACL have
        // read the session. Without this, PHP holds an exclusive session file lock
        // for the whole request, so concurrent requests from one user (multiple
        // tabs, or a desk polling while another loads) serialize one-behind-another.
        // The allowlist is proven free of $_SESSION writes; reads after close are
        // fine (the superglobal stays populated), only writes would be dropped.
        if ($action !== ''
            && session_status() === PHP_SESSION_ACTIVE
            && $this->svc(AjaxActionPolicy::class)->isReadOnly($action)) {
            session_write_close();
        }

        // SCALE-3.2 — devil-proofing: recurring poll actions carry a generous
        // per-user-per-action budget so a stuck client, a devtools loop, or a
        // stolen session can't melt the DB. Runs after the session close (the
        // counter lives in the DB, not the session); islands read retry_after_ms
        // and back off for one cycle.
        if ($action !== '' && $this->svc(AjaxActionPolicy::class)->isPollAction($action)) {
            try {
                $this->svc(RateLimitService::class)->assertPollWithinLimit($action, $userId);
            } catch (\RuntimeException) {
                $this->respond(false, 'Too many requests — slowing down', [
                    'code' => 'rate_limited',
                    'retry_after_ms' => RateLimitService::msUntilNextWindow(),
                ], 429);
            }
        }

        try {
            if ($this->dispatchToActionHandler($action, $method, $userId)) {
                return;
            }

            switch ($action) {
                case 'health':
                    $this->respond(true, 'ok', ['module' => 'oe-module-new-clinic']);
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
        } catch (InputValidationException $e) {
            // SEC-3: audit to the queryable trail with action + user + the field
            // NAMES that failed — never the rejected values (may hold PHI/password).
            EventAuditLogger::getInstance()->newEvent(
                'new-clinic-validation',
                (string) ($_SESSION['authUser'] ?? ''),
                (string) ($_SESSION['authProvider'] ?? ''),
                0,
                'Input validation failed: action=' . $action
                    . ' user=' . $userId
                    . ' fields=' . implode(',', array_keys($e->getFieldErrors()))
            );
            $this->respond(false, $e->getMessage(), [
                'code' => 'validation',
                'field_errors' => $e->getFieldErrors(),
            ], 400);
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

    private function dispatchToActionHandler(string $action, string $method, int $userId): bool
    {
        foreach ($this->ajaxActionHandlers() as $handler) {
            if ($handler->supports($action)) {
                $handler->handle($action, $method, $userId);
                return true;
            }
        }

        return false;
    }

    /**
     * @return list<AjaxActionHandlerInterface>
     */
    private function ajaxActionHandlers(): array
    {
        return [
            new VisitActionHandler($this),
            new TriageActionHandler($this),
            new DoctorActionHandler($this),
            new CashierActionHandler($this),
            new ClinicalDocActionHandler($this),
            new CommunicationsActionHandler($this),
            new CohortActionHandler($this),
            new LabOpsActionHandler($this),
            new PharmOpsActionHandler($this),
            new BillOpsActionHandler($this),
            new LabActionHandler($this),
            new PharmacyActionHandler($this),
            new FrontDeskActionHandler($this),
            new PatientActionHandler($this),
            new ChartDepthActionHandler($this),
            new AdminActionHandler($this),
            new ProfileActionHandler($this),
            new OfficeNotesActionHandler($this),
            new DocumentsActionHandler($this),
            new ReportsActionHandler($this),
            new SchedulingActionHandler($this),
            new QueueBridgeActionHandler($this),
            new OutreachActionHandler($this),
        ];
    }

    public function esignOverrideReason(array $body): ?string
    {
        $reason = trim((string) ($body['esign_override_reason'] ?? ''));

        return $reason !== '' ? $reason : null;
    }

    public function undispensedOverrideReason(array $body): ?string
    {
        $reason = trim((string) ($body['undispensed_override_reason'] ?? ''));

        return $reason !== '' ? $reason : null;
    }

    public function externalRxOverrideReason(array $body): ?string
    {
        $reason = trim((string) ($body['external_rx_override_reason'] ?? ''));

        return $reason !== '' ? $reason : null;
    }

    public function rxAllergyOverrideReason(array $body): ?string
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
            'office_notes_acl' => $this->requireOfficeNotesAcl(),
            'patients_docs_acl' => $this->requirePatientsDocsAcl(),
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

    private function requireOfficeNotesAcl(): void
    {
        // Office Notes are clinic-wide staff notes gated on the core encounters/notes
        // pair (matches stock office_comments.php). Clinic staff hold it via their
        // Clinicians group membership (see acl/seed_pilot_users.php).
        if (!AclMain::aclCheckCore('encounters', 'notes')) {
            $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
        }
    }

    private function requirePatientsDocsAcl(): void
    {
        // Per-patient Documents tab (A2). Core patients/docs pair — the same ACL
        // stock's controller.php document viewer enforces.
        if (!AclMain::aclCheckCore('patients', 'docs')) {
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

    public function requireReportHubExportAcl(): void
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

    public function requireSuperAdmin(): void
    {
        if (!AclMain::aclCheckCore('admin', 'super')) {
            $this->respond(false, 'Super admin access required', ['code' => 'forbidden'], 403);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function readRequestParams(string $method): array
    {
        if ($method === 'POST') {
            $body = $this->readJsonBody();
            $this->verifyCsrf($body);

            return $body;
        }

        return $_REQUEST;
    }

    public function authorizeDeferredHandler(string $action, int $pid = 0): void
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

    public function assertPatientChartPid(int $pid): void
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

    public function resolveRequestFacilityId(): int
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
    public function parseOptionalPositiveInt(mixed $value): ?int
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
    public function enrichStartVisitResponse(array $visit, int $userId): array
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
    public function resolveDeskFacilityFromBody(array $body): int
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

    public function verifyCsrf(array $body): void
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
            // SEC-2: audit the failure with action + user only — never the token
            // value (a bad/stale token can indicate an attack or a session bug).
            EventAuditLogger::getInstance()->newEvent(
                'new-clinic-csrf',
                (string) ($_SESSION['authUser'] ?? ''),
                (string) ($_SESSION['authProvider'] ?? ''),
                0,
                'CSRF verification failed: action=' . $this->resolveRequestAction()
                    . ' user=' . (int) ($_SESSION['authUserID'] ?? 0)
            );
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

    public function readJsonBody(): array
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
    public function enrichQueuePayload(array $queuePayload, int $userId, int $facilityId): array
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
    public function resolvePatientCreate(array $body, int $userId): array
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


    /**
     * SCALE-0.1 — one-line perf log for slow/errored ajax requests.
     *
     * Uses a shutdown function (respond() calls exit, so a finally block would
     * never run) and reads the final HTTP status to classify errors. Fast, healthy
     * requests log nothing. Format is grep-friendly and stable:
     *   NC_PERF action=<action> ms=<int> user=<id> facility=<id> [status=<4xx/5xx>]
     */
    private function registerPerfLogging(string $action, int $userId): void
    {
        // True wall-clock request start (more accurate than handler-entry microtime).
        $t0 = isset($_SERVER['REQUEST_TIME_FLOAT'])
            ? (float) $_SERVER['REQUEST_TIME_FLOAT']
            : microtime(true);
        $facilityId = (int) ($_SESSION['facilityId'] ?? 0);

        register_shutdown_function(static function () use ($t0, $action, $userId, $facilityId): void {
            $ms = (int) round((microtime(true) - $t0) * 1000);
            $status = http_response_code();
            $status = is_int($status) ? $status : 200;
            $errored = $status >= 400;

            // Only slow OR errored requests are worth a line — keep the log clean.
            if ($ms <= 500 && !$errored) {
                return;
            }

            error_log(sprintf(
                'NC_PERF action=%s ms=%d user=%d facility=%d%s',
                $action !== '' ? $action : '(none)',
                $ms,
                $userId,
                $facilityId,
                $errored ? ' status=' . $status : ''
            ));
        });
    }

    /**
     * SCALE-1.8 — respond to a queue/board poll with delta support. Hashes the final
     * payload; if it matches the client's `known_revision`, returns a tiny
     * {unchanged:true, revision} (client skips its re-render, we skip shipping the
     * payload). Otherwise returns the payload tagged with its revision. Safe to use
     * everywhere: a client that never sends `known_revision` always gets the full
     * payload, so enabling this per-desk is opt-in from the frontend.
     *
     * @param array<string, mixed> $payload
     */
    public function respondQueue(array $payload): void
    {
        $revision = QueueRevision::of($payload);
        $known = trim((string) ($_REQUEST['known_revision'] ?? ''));
        if ($known !== '' && $known === $revision) {
            $this->respond(true, 'ok', ['unchanged' => true, 'revision' => $revision]);
        }
        $payload['revision'] = $revision;
        $payload['unchanged'] = false;
        $this->respond(true, 'ok', $payload);
    }

    public function respond(bool $success, string $message, array $data = [], int $status = 200): void
    {
        http_response_code($status);
        echo json_encode([
            'success' => $success,
            'message' => $message,
            'data' => $data,
        ]);
        exit;
    }

    public function respondCsv(string $filename, string $content): void
    {
        http_response_code(200);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . basename($filename) . '"');
        header('Cache-Control: no-store');
        echo $content;
        exit;
    }
}


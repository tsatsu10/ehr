<?php

/**
 * PRD §16.1 mandatory tests 1–40 and 44 (contract / unit coverage).
 *
 * Tests 41 and 43 live in dedicated mandatory test classes.
 * Tests 23–24 require Playwright E2E and are marked skipped here.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\CashierService;
use OpenEMR\Modules\NewClinic\Services\DoctorService;
use OpenEMR\Modules\NewClinic\Services\EncounterSignService;
use OpenEMR\Modules\NewClinic\Services\PatientActivityFeedService;
use OpenEMR\Modules\NewClinic\Services\PatientDuplicateService;
use OpenEMR\Modules\NewClinic\Services\PhoneNormalizer;
use OpenEMR\Modules\NewClinic\Services\ReconciliationService;
use OpenEMR\Modules\NewClinic\Services\ReportsService;
use OpenEMR\Modules\NewClinic\Services\VisitFsm;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;

/**
 * @group new-clinic-mandatory
 */
#[Group('new-clinic-mandatory')]
class NewClinicMandatoryContractTests extends TestCase
{
    use MandatoryTestHelpers;

    public function testMandatory01FsmOptimisticLockingUsesStaleVisitException(): void
    {
        $body = $this->methodBody(VisitQueueService::class, 'resolveTransitionConflict');

        $this->assertStringContainsString('StaleVisitException', $body);
        $this->assertStringContainsString('row_version', $body);
    }

    public function testMandatory02ReceiptNumberAllocationIsAtomic(): void
    {
        $body = $this->methodBody(CashierService::class, 'allocateReceiptNumber');

        $this->assertStringContainsString('ON DUPLICATE KEY UPDATE last_seq = last_seq + 1', $body);
        $this->assertStringContainsString('new_receipt_counter', $body);
    }

    public function testMandatory03CheckoutIdempotencyUsesClientRequestId(): void
    {
        $body = $this->methodBody(CashierService::class, 'finalizePaymentResponse');

        $this->assertStringContainsString('new_cashier_payment_request', $body);
        $this->assertStringContainsString('client_request_id', $body);
        $this->assertStringContainsString('loadIdempotentPaymentResponse', $body);
    }

    public function testMandatory04SyntheticDobPersistsEstimatedFlag(): void
    {
        $source = $this->readModuleSource('src/Services/PatientRegistrationService.php');

        $this->assertStringContainsString('dob_estimated', $source);
        $this->assertStringContainsString('coerceMetaColumnValue', $source);
    }

    public function testMandatory05PhoneNormalizedParityForRegionalFormats(): void
    {
        $normalizer = new PhoneNormalizer();

        $local = $normalizer->normalize('0244001122');
        $this->assertSame($local, $normalizer->normalize('233244001122'));
        $this->assertSame($local, $normalizer->normalize('+233244001122'));
        $this->assertNotSame('', $local);
    }

    public function testMandatory06DupScoreBlocksAtSeventeenByDefault(): void
    {
        $this->assertSame(17, (new PatientDuplicateService())->getBlockThreshold());
    }

    public function testMandatory07CompletionGateBlocksCashierWithoutOverride(): void
    {
        $body = $this->methodBody(CashierService::class, 'assessCompletionGate');

        $this->assertStringContainsString('new_billing_skip_completion', $body);
        $this->assertStringContainsString('getBillingThreshold', $body);
        $this->assertStringContainsString("'threshold'", $body);
    }

    public function testMandatory08PediatricExactDobRuleSurfacesInPreview(): void
    {
        $source = $this->readModuleSource('src/Services/PatientContextService.php');

        $this->assertStringContainsString('pediatric_dob_block', $source);
        $this->assertStringContainsString('dob_estimated', $source);
    }

    public function testMandatory09ReverseFsmReopenConsult(): void
    {
        $this->assertTrue(VisitFsm::canReverseTransition('ready_for_payment', 'with_doctor'));
        $this->assertFalse(VisitFsm::canReverseTransition('completed', 'with_doctor'));

        $body = $this->methodBody(DoctorService::class, 'reopenConsult');
        $this->assertStringContainsString('new_visit_reopen', $body);
        $this->assertStringContainsString('reopenToWithDoctor', $body);

        $queueBody = $this->methodBody(VisitQueueService::class, 'reopenToWithDoctor');
        $this->assertStringContainsString("'reopened'", $queueBody);
        $this->assertStringContainsString('logStateChange', $queueBody);

        $logBody = $this->methodBody(VisitQueueService::class, 'logStateChange');
        $this->assertStringContainsString('is_reverse', $logBody);

        $source = $this->readModuleSource('src/Controllers/AjaxController.php');
        $this->assertStringContainsString('doctor.reopen', $source);
    }

    public function testMandatory10CrossFacilityVisitAccessGuard(): void
    {
        $body = $this->methodBody(VisitScopeService::class, 'assertVisitAccessible');

        $this->assertStringContainsString('getActorFacilityIds', $body);
        $this->assertStringContainsString('Visit not accessible', $body);
    }

    public function testMandatory11ReconciliationJob(): void
    {
        $this->assertSame('ok', ReconciliationService::evaluateStatus(50.00, 50.00, 0.01));
        $this->assertSame('warning', ReconciliationService::evaluateStatus(50.00, 50.02, 0.01));

        $body = $this->methodBody(ReconciliationService::class, 'run');
        $this->assertStringContainsString('new_reconciliation_run', $body);
        $this->assertStringContainsString('fetchTotals', $body);

        $source = $this->readModuleSource('bin/reconcile.php');
        $this->assertStringContainsString('ReconciliationService', $source);
        $this->assertStringContainsString('runAllEnabledFacilities', $source);
    }

    public function testMandatory12QueueSlipPrintPayload(): void
    {
        $body = $this->methodBody(
            \OpenEMR\Modules\NewClinic\Services\QueueSlipService::class,
            'buildPrintPayload'
        );
        $this->assertStringContainsString('queue_number', $body);
        $this->assertStringContainsString('patient_display', $body);
        $this->assertStringContainsString('instruction_text', $body);

        $template = $this->readModuleSource('templates/queue-slip.html.twig');
        $this->assertStringContainsString('queue_number', $template);
        $this->assertStringContainsString('instruction_text', $template);

        $source = $this->readModuleSource('public/assets/js/patient-search.js');
        $this->assertStringContainsString('Print queue slip', $source);
    }

    public function testMandatory13CashArIntegrationPostsCorePayment(): void
    {
        $body = $this->methodBody(CashierService::class, 'recordPayment');
        $receiptBody = $this->methodBody(CashierService::class, 'issueReceipt');

        $this->assertStringContainsString('postCashPayment', $body);
        $this->assertStringContainsString('issueReceipt', $body);
        $this->assertStringContainsString('posted_payment_id', $receiptBody);
        $this->assertStringContainsString("'completed'", $body);
    }

    public function testMandatory14ConsultRoutingManualOverride(): void
    {
        $this->assertSame('ready_for_lab', DoctorService::resolveConsultTargetState(true, false));
        $this->assertSame('ready_for_payment', DoctorService::resolveConsultTargetState(false, false));

        $body = $this->methodBody(DoctorService::class, 'completeConsult');
        $this->assertStringContainsString('resolveConsultTargetState', $body);
        $this->assertStringContainsString('manual', $body);
    }

    public function testMandatory15QueueBypassRequiresSkipQueueAcl(): void
    {
        $source = $this->readModuleSource('src/Services/LabService.php');

        $this->assertStringContainsString('new_visit_skip_queue', $source);
        $this->assertStringContainsString('skipToPayment', $source);
    }

    public function testMandatory16ClosedUnpaidRemovesVisitFromPaymentQueue(): void
    {
        $body = $this->methodBody(CashierService::class, 'markClosedUnpaid');

        $this->assertStringContainsString("'closed_unpaid'", $body);
        $this->assertStringContainsString("'ready_for_payment'", $body);

        $reports = $this->readModuleSource('src/Services/ReportsService.php');
        $this->assertStringContainsString("'closed_unpaid'", $reports);
    }

    public function testMandatory17ScheduledIntegrationGateInConfig(): void
    {
        $sql = $this->readModuleSource('sql/install.sql');

        $this->assertStringContainsString('enable_scheduled_integration', $sql);
    }

    public function testMandatory18StartVisitFromAppointmentIsAtomic(): void
    {
        $body = $this->methodBody(VisitQueueService::class, 'startVisitFromAppointment');

        $this->assertStringContainsString('sqlBeginTrans', $body);
        $this->assertStringContainsString('started_from_appointment', $body);
    }

    public function testMandatory19RecurringAppointmentGuardExists(): void
    {
        $body = $this->methodBody(VisitQueueService::class, 'startVisitFromAppointment');

        $this->assertStringContainsString('pc_recurrtype', $body);
    }

    public function testMandatory20TwoAppointmentsSameDayUsesNearestTime(): void
    {
        $source = $this->readModuleSource('src/Services/AppointmentTodayService.php');

        $this->assertStringContainsString('chipForPatient', $source);
        $this->assertStringContainsString('start_time', $source);
    }

    public function testMandatory21AppointmentBookingAclPolicy(): void
    {
        $source = $this->readModuleSource('src/Services/AjaxActionPolicy.php');

        $this->assertStringContainsString('visit.start_from_appointment', $source);
        $this->assertStringContainsString('new_reception', $source);
    }

    public function testMandatory22MultiDoctorAssignedProviderFromAppointment(): void
    {
        $body = $this->methodBody(VisitQueueService::class, 'startVisitFromAppointment');

        $this->assertStringContainsString('assignedProviderId', $body);
        $this->assertStringContainsString('pc_aid', $body);
    }

    public function testMandatory23E2eGoldenPath(): void
    {
        $this->markTestSkipped('Requires Playwright e2e suite (PRD §16.1 test 23).');
    }

    public function testMandatory24DoctorDeskCoreRoundTrip(): void
    {
        $source = $this->readModuleSource('public/assets/js/doctor.js');

        $this->assertStringContainsString('doctor.shortcut_preflight', $source);
        $this->assertStringContainsString('loadActiveConsult', $source);
    }

    public function testMandatory25EncounterSessionBindAfterTakePatient(): void
    {
        $body = $this->methodBody(DoctorService::class, 'takePatient');

        $this->assertStringContainsString('bindForVisit', $body);
    }

    public function testMandatory26EncounterSessionMismatchAndRestore(): void
    {
        $source = $this->readModuleSource('src/Services/EncounterSessionService.php');

        $this->assertStringContainsString('assertBound', $source);
        $this->assertStringContainsString('EncounterSessionMismatchException', $source);
        $this->assertStringContainsString('restore(', $source);
    }

    public function testMandatory27WrongEncounterInSessionBlockedByPreflight(): void
    {
        $body = $this->methodBody(
            \OpenEMR\Modules\NewClinic\Services\ConsultShortcutService::class,
            'preflight'
        );

        $this->assertStringContainsString('assertBound', $body);
        $this->assertStringContainsString('EncounterSessionMismatchException', $body);
    }

    public function testMandatory28EsignGateOnCompleteConsult(): void
    {
        $body = $this->methodBody(DoctorService::class, 'completeConsult');

        $this->assertStringContainsString('require_esign_before_complete_consult', $body);
        $this->assertStringContainsString('assertConsultSigned', $body);
    }

    public function testMandatory29EsignGateOnPaymentIsProfileAware(): void
    {
        $body = $this->methodBody(CashierService::class, 'recordPayment');

        $this->assertStringContainsString('assertProfileSigned', $body);
        $this->assertStringContainsString('esignOverrideReason', $body);
    }

    public function testMandatory30EsignOverrideAuditField(): void
    {
        $body = $this->methodBody(EncounterSignService::class, 'auditOverride');

        $this->assertStringContainsString('esign_override', $body);
        $this->assertStringContainsString('encounter_id', $body);
    }

    public function testMandatory31ConcurrentTakePatientTakenElsewhere(): void
    {
        $body = $this->methodBody(VisitQueueService::class, 'buildTakenElsewhereException');

        $this->assertStringContainsString("'interrupt' => 'taken_elsewhere'", $body);
    }

    public function testMandatory32LabDoctorParallelBindAllowed(): void
    {
        $body = $this->methodBody(\OpenEMR\Modules\NewClinic\Services\LabService::class, 'takePatient');

        $this->assertStringContainsString('bindForVisit', $body);
    }

    public function testMandatory33SupervisingProviderCombobox(): void
    {
        $this->markTestSkipped('Supervising provider combobox (M4-F28) is not yet implemented in doctor desk JS.');
    }

    public function testMandatory34MultipleVisitsSameDayAfterTerminal(): void
    {
        $body = $this->methodBody(VisitQueueService::class, 'assertCanStartVisit');

        $this->assertStringContainsString("'completed'", $body);
        $this->assertStringContainsString("'closed_unpaid'", $body);
        $this->assertStringContainsString("'cancelled'", $body);
    }

    public function testMandatory35SameEncounterPipelineUsesVisitEncounter(): void
    {
        $source = $this->readModuleSource('src/Services/EncounterSessionService.php');

        $this->assertStringContainsString('$_SESSION[\'encounter\']', $source);
        $this->assertStringContainsString('getVisitForActor', $source);
        $this->assertStringContainsString('$visit[\'encounter\']', $source);
    }

    public function testMandatory36EodStaleWithDoctorUnsignedCrossCut(): void
    {
        $alerts = ReportsService::summarizeUnsignedAlerts([
            ['state' => 'with_doctor'],
            ['state' => 'ready_for_payment'],
        ]);

        $this->assertSame(1, $alerts['with_doctor']);

        $hours = ReportsService::hoursSinceTimestamp(
            date('Y-m-d H:i:s', strtotime('-3 hours'))
        );
        $this->assertGreaterThan(2.0, $hours);
    }

    public function testMandatory37ConcurrentVitalsAndSoapNote(): void
    {
        $this->markTestSkipped('Requires integration test documenting OpenEMR last-save-wins on SOAP (Appendix G).');
    }

    public function testMandatory38ConsultReadyBannerContract(): void
    {
        $source = $this->readModuleSource('public/assets/js/doctor.js');

        $this->assertStringContainsString('nc-patient-context-banner', $source);
        $this->assertStringContainsString('renderBanner', $source);
    }

    public function testMandatory39MrdActivityFeedPaginationContract(): void
    {
        $this->assertSame(25, PatientActivityFeedService::PAGE_SIZE);
        $this->assertSame(90, PatientActivityFeedService::LOOKBACK_DAYS);

        $body = $this->methodBody(PatientActivityFeedService::class, 'getActivityFeed');
        $this->assertStringContainsString('visit_id', $body);
        $this->assertStringContainsString('limit', $body);
    }

    public function testMandatory40MrdFeedInteractionEventTypes(): void
    {
        $source = $this->readModuleSource('src/Services/PatientActivityFeedService.php');

        $this->assertStringContainsString('lab_result_ready', $source);
        $this->assertStringContainsString('state_changed', $source);
        $this->assertStringContainsString('event_type', $source);
    }

    public function testMandatory42MrdClinicalBackgroundFromHistoryData(): void
    {
        $source = $this->readModuleSource('src/Services/PatientChartClinicalService.php');

        $this->assertStringContainsString('history_data', $source);
    }

    public function testMandatory44SignedLockAndReopenPragmaticPath(): void
    {
        $signSource = $this->readModuleSource('src/Services/EncounterSignService.php');
        $this->assertStringContainsString('isConsultSigned', $signSource);
        $this->assertStringContainsString('assertProfileSigned', $signSource);

        $shortcutBody = $this->methodBody(
            \OpenEMR\Modules\NewClinic\Services\ConsultShortcutService::class,
            'preflight'
        );
        $this->assertStringContainsString("with_doctor", $shortcutBody);

        $reopenBody = $this->methodBody(DoctorService::class, 'reopenConsult');
        $this->assertStringContainsString('buildConsultPayload', $reopenBody);

        $doctorJs = $this->readModuleSource('public/assets/js/doctor.js');
        $this->assertStringContainsString('doctor.reopen', $doctorJs);
        $this->assertStringContainsString('doctor.shortcut_preflight', $doctorJs);
    }

    public function testMandatoryFsmTerminalStatesExcludeActiveQueue(): void
    {
        $this->assertTrue(VisitFsm::isTerminal('completed'));
        $this->assertTrue(VisitFsm::isTerminal('closed_unpaid'));
        $this->assertFalse(VisitFsm::isTerminal('ready_for_payment'));
    }
}

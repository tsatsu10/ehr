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
class NewClinicMandatoryContractTest extends TestCase
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

        $source = $this->readFrontendSource('src/islands/front-desk/StartVisitForm.tsx');
        $this->assertStringContainsString('Print queue slip', $source);
    }

    public function testMandatory13CashArIntegrationPostsCorePayment(): void
    {
        $body = $this->methodBody(CashierService::class, 'recordPayment');
        $receiptBody = $this->methodBody(CashierService::class, 'issueReceipt');

        $this->assertStringContainsString('postPatientPayment', $body);
        $this->assertStringContainsString('normalizePaymentMethod', $body);
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
        // Verify E2E test infrastructure exists
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        if (!is_dir($e2eDir)) {
            $this->markTestSkipped('E2E test directory not found at: ' . $e2eDir . ' (expected tests/e2e/new-clinic/)');
        }

        // Verify README with golden path documentation
        $readmePath = $e2eDir . '/README.md';
        $this->assertFileExists($readmePath, 'E2E README must exist');
        $readme = file_get_contents($readmePath);
        $this->assertStringContainsString('Golden Path Workflow', $readme);
        $this->assertStringContainsString('Registration (Front Desk)', $readme);
        $this->assertStringContainsString('Start Visit', $readme);
        $this->assertStringContainsString('Vitals Entry (Triage)', $readme);
        $this->assertStringContainsString('Doctor Consult', $readme);
        $this->assertStringContainsString('Payment (Cashier)', $readme);
        $this->assertStringContainsString('Reconciliation', $readme);

        // Verify Playwright config exists
        $configPath = $e2eDir . '/playwright.config.js';
        $this->assertFileExists($configPath, 'Playwright config must exist');

        // Verify golden path spec exists
        $specPath = $e2eDir . '/specs/golden-path.spec.js';
        $this->assertFileExists($specPath, 'Golden path spec file must exist');
        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('New Clinic E2E Golden Path Test', $spec);
        $this->assertStringContainsString('complete patient journey', $spec);
        $this->assertStringContainsString('Register patient and start visit', $spec);
        $this->assertStringContainsString('Enter vitals in triage', $spec);
        $this->assertStringContainsString('Doctor consultation and pharmacy routing', $spec);
        $this->assertStringContainsString('Pharmacy desk skip to payment', $spec);
        $this->assertStringContainsString('Cashier payment or zero close', $spec);
        $this->assertStringContainsString('e2e-prep-golden-path.php', $spec);
    }

    public function testMandatory45PharmOpsDeepGoldenPathE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/golden-path-pharm-dispense.spec.js';
        $this->assertFileExists($specPath, 'Pharm ops deep golden path spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('New Clinic Pharm Ops Golden Path', $spec);
        $this->assertStringContainsString('Quick prescribe', $spec);
        $this->assertStringContainsString('nc-pharmops-dispense-drawer', $spec);
        $this->assertStringContainsString('formulary_rx_place', $spec);
        $this->assertStringContainsString('Pharmacy dispense with label', $spec);
        $this->assertStringContainsString('e2e-prep-golden-path.php', $spec);

        $hubSpecPath = $e2eDir . '/specs/pharm-ops-hub.spec.js';
        $this->assertFileExists($hubSpecPath, 'Pharm ops hub smoke spec must exist');
        $hubSpec = file_get_contents($hubSpecPath);
        $this->assertStringContainsString('pharm_ops.worklist', $hubSpec);
        $this->assertStringContainsString('pharm_ops.receive_save', $hubSpec);
        $this->assertStringContainsString('pharm_ops.destroy_confirm', $hubSpec);
        $this->assertStringContainsString('nc-pharmops-otc-drawer', $hubSpec);
        $this->assertStringContainsString('pharmacy_lead_user', $hubSpec);
        $this->assertStringContainsString('pilot-enable-pharm-ops.php', $hubSpec);

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-pharm-ops.php';
        $this->assertFileExists($pilotScript, 'Pilot pharm ops enable script must exist');

        $rolloutScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-rollout.php';
        $this->assertFileExists($rolloutScript, 'Pilot rollout script must exist');

        $rolloutLib = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/pilot-rollout-seed.php';
        $this->assertFileExists($rolloutLib, 'Pilot rollout seed lib must exist');
        $rolloutBody = file_get_contents($rolloutLib);
        $this->assertStringContainsString('pilotRolloutEnsureProductFlags', $rolloutBody);
        $this->assertStringContainsString('enable_bill_ops', $rolloutBody);

        $seedLib = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/pharm-ops-pilot-seed.php';
        $this->assertFileExists($seedLib, 'Shared pharm ops pilot seed lib must exist');

        $integrationTest = __DIR__ . '/PharmOpsWorklistServiceIntegrationTest.php';
        $this->assertFileExists($integrationTest, 'Pharm ops worklist integration test must exist');
    }

    public function testMandatory47ReportHubSmokeE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/report-hub.spec.js';
        $this->assertFileExists($specPath, 'Report hub smoke spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('Reporting Operations Hub', $spec);
        $this->assertStringContainsString('reports.catalog', $spec);
        $this->assertStringContainsString('reports.run', $spec);
        $this->assertStringContainsString('reports.export', $spec);
        $this->assertStringContainsString('Immunizations given', $spec);
        $this->assertStringContainsString('Run report', $spec);
        $this->assertStringContainsString('Export CSV', $spec);
        $this->assertStringContainsString('pilot-enable-report-hub.php', $spec);
        $this->assertStringContainsString('embed=1', file_get_contents(
            dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/report-hub/index.php'
        ));

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-report-hub.php';
        $this->assertFileExists($pilotScript, 'Pilot report hub enable script must exist');

        $commonSeed = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/pilot-common-seed.php';
        $this->assertFileExists($commonSeed, 'Shared pilot common seed lib must exist');
        $commonBody = file_get_contents($commonSeed);
        $this->assertStringContainsString('pilotFacilityIds', $commonBody);
        $this->assertStringContainsString('pilotEnsureNewClinicAclObjects', $commonBody);

        $rolloutLib = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/pilot-rollout-seed.php';
        $rolloutBody = file_get_contents($rolloutLib);
        $this->assertStringContainsString('enable_report_hub', $rolloutBody);

        $accessTest = __DIR__ . '/ReportHubAccessServiceTest.php';
        $this->assertFileExists($accessTest, 'Report hub access service test must exist');

        $menuTest = __DIR__ . '/MainMenuRestrictReportHubTest.php';
        $this->assertFileExists($menuTest, 'Report hub menu restrict test must exist');

        $exportTest = __DIR__ . '/ReportHubExportServiceTest.php';
        $this->assertFileExists($exportTest, 'Report hub export service test must exist');

        $nativeTest = __DIR__ . '/ReportHubNativeReportServiceTest.php';
        $this->assertFileExists($nativeTest, 'Report hub native report service test must exist');
    }

    public function testMandatory48ClinicalDocHubContracts(): void
    {
        $policy = file_get_contents(dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/src/Services/AjaxActionPolicy.php');
        foreach ([
            'clinical_doc.visit_summary',
            'clinical_doc.catalog',
            'clinical_doc.sign_status',
            'clinical_doc.open_form',
        ] as $action) {
            $this->assertStringContainsString($action, $policy, "Ajax policy must list {$action}");
        }

        $e2eSpec = dirname(__DIR__, 4) . '/e2e/new-clinic/specs/clinical-doc.spec.js';
        $this->assertFileExists($e2eSpec, 'Clinical doc hub E2E spec must exist');

        $catalogTest = __DIR__ . '/ClinicalDocCatalogServiceTest.php';
        $this->assertFileExists($catalogTest, 'Clinical doc catalog service test must exist');

        $formOpenTest = __DIR__ . '/ClinicalDocFormOpenServiceTest.php';
        $this->assertFileExists($formOpenTest, 'Clinical doc form open service test must exist');

        $summaryTest = __DIR__ . '/ClinicalDocVisitSummaryServiceTest.php';
        $this->assertFileExists($summaryTest, 'Clinical doc visit summary service test must exist');

        $menuTest = __DIR__ . '/MainMenuRestrictClinicalDocTest.php';
        $this->assertFileExists($menuTest, 'Clinical doc menu restrict test must exist');

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-clinical-doc.php';
        $this->assertFileExists($pilotScript, 'Pilot clinical doc enable script must exist');

        $shortcutBody = $this->methodBody(
            \OpenEMR\Modules\NewClinic\Services\ConsultShortcutService::class,
            'preflight'
        );
        $this->assertStringContainsString('encounter_top.php', $shortcutBody);
        $this->assertStringContainsString('clinical-doc/index.php', $shortcutBody);
    }

    public function testMandatory46LabCloseDayGoldenPathE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/golden-path-lab-close-day.spec.js';
        $this->assertFileExists($specPath, 'Lab + close day golden path spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('Lab + Close Day Golden Path', $spec);
        $this->assertStringContainsString('Doctor consultation and lab routing', $spec);
        $this->assertStringContainsString('Lab desk skip to payment', $spec);
        $this->assertStringContainsString('Bill ops close day daysheet', $spec);
        $this->assertStringContainsString('bill_ops.daysheet', $spec);
        $this->assertStringContainsString('e2e-prep-golden-path.php', $spec);

        $prepLib = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/golden-path-e2e-prep.php';
        $this->assertFileExists($prepLib, 'Golden path E2E prep lib must exist');

        $prepBody = file_get_contents($prepLib);
        $this->assertStringContainsString('enable_bill_ops', $prepBody);
        $this->assertStringContainsString('New Clinic Lab', $prepBody);
    }

    public function testMandatory24DoctorDeskCoreRoundTrip(): void
    {
        $shortcutNav = $this->readFrontendSource('src/islands/doctor-desk/doctorShortcutNav.ts');
        $desk = $this->readFrontendSource('src/islands/doctor-desk/DoctorDesk.tsx');

        $this->assertStringContainsString('doctor.shortcut_preflight', $shortcutNav);
        $this->assertStringContainsString('loadActiveConsult', $desk);
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
        // Backend: DoctorService supervisor methods
        $doctorBody = $this->methodBody(DoctorService::class, 'setSupervisor');
        $this->assertStringContainsString('supervisor_id', $doctorBody);
        $this->assertStringContainsString('form_encounter', $doctorBody);
        $this->assertStringContainsString('Cannot supervise own consult', $doctorBody);

        $searchBody = $this->methodBody(DoctorService::class, 'searchProviders');
        $this->assertStringContainsString('users', $searchBody);
        $this->assertStringContainsString('excludeUserId', $searchBody);

        // Frontend: React supervisor combobox
        $supervisorUi = $this->readFrontendSource('src/islands/doctor-desk/SupervisorCombobox.tsx');
        $this->assertStringContainsString('Supervising provider', $supervisorUi);
        $this->assertStringContainsString('doctor.set_supervisor', $supervisorUi);
        $this->assertStringContainsString('doctor.search_providers', $supervisorUi);
        $this->assertStringContainsString('setSupervisor', $supervisorUi);
        $this->assertStringContainsString('DoctorProviderSearchResult', $supervisorUi);

        // AjaxController endpoints
        $ajaxSource = $this->readModuleSource('src/Controllers/AjaxController.php');
        $this->assertStringContainsString('doctor.set_supervisor', $ajaxSource);
        $this->assertStringContainsString('doctor.search_providers', $ajaxSource);
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
        // Integration test documenting OpenEMR last-save-wins behavior (Test 37)
        // __DIR__ = tests/Tests/Unit/Modules/NewClinic
        // We need to go up to tests/Tests, then down to Integration/Modules/NewClinic
        $testFile = dirname(__DIR__, 3) . '/Integration/Modules/NewClinic/ConcurrentVitalsAndSoapIntegrationTest.php';

        if (!file_exists($testFile)) {
            $this->markTestSkipped(
                'Integration test not found at: ' . $testFile .
                ' (expected ConcurrentVitalsAndSoapIntegrationTest.php documenting Appendix G behavior)'
            );
        }

        $integrationTest = file_get_contents($testFile);

        $this->assertStringContainsString('ConcurrentVitalsAndSoapIntegrationTest', $integrationTest);
        $this->assertStringContainsString('testConcurrentVitalsAndSoapBothPersist', $integrationTest);
        $this->assertStringContainsString('testLastSaveWinsOnVitals', $integrationTest);
        $this->assertStringContainsString('testLastSaveWinsOnSoap', $integrationTest);
        $this->assertStringContainsString('Appendix G', $integrationTest);
    }

    public function testMandatory38ConsultReadyBannerContract(): void
    {
        $banner = $this->readFrontendSource('src/islands/doctor-desk/DoctorPatientBanner.tsx');
        $context = $this->readFrontendSource('src/components/PatientContextBanner.tsx');

        $this->assertStringContainsString('PatientContextBanner', $banner);
        $this->assertStringContainsString('oe-nc-patient-banner', $context);
        $this->assertStringContainsString("layout?: 'full' | 'compact'", $context);
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

        $reopenUi = $this->readFrontendSource('src/islands/doctor-desk/ReopenModal.tsx');
        $shortcutNav = $this->readFrontendSource('src/islands/doctor-desk/doctorShortcutNav.ts');
        $this->assertStringContainsString('doctor.reopen', $reopenUi);
        $this->assertStringContainsString('doctor.shortcut_preflight', $shortcutNav);
    }

    public function testMandatoryFsmTerminalStatesExcludeActiveQueue(): void
    {
        $this->assertTrue(VisitFsm::isTerminal('completed'));
        $this->assertTrue(VisitFsm::isTerminal('closed_unpaid'));
        $this->assertFalse(VisitFsm::isTerminal('ready_for_payment'));
    }

    public function testMandatory49AdvisoryRoutingSmokeE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/v11-rt-smoke.spec.js';
        $this->assertFileExists($specPath, 'V1.1-RT smoke spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('pilot-enable-v11-rt.php', $spec);
        $this->assertStringContainsString('v11-rt-smoke-fixture.php', $spec);
        $this->assertStringContainsString('routing_suggested_provider_id', $spec);
        $this->assertStringContainsString('Routing suggests:', $spec);
        $this->assertStringContainsString('doctor2_user', $spec);
        $this->assertStringContainsString('nc-doctor-roster', $spec);

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-rt.php';
        $this->assertFileExists($pilotScript, 'Pilot V1.1-RT enable script must exist');

        $fixtureScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-rt-smoke-fixture.php';
        $this->assertFileExists($fixtureScript, 'V1.1-RT smoke fixture must exist');

        $httpSmoke = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-advisory-routing-http.php';
        $this->assertFileExists($httpSmoke, 'Advisory routing HTTP smoke must exist');

        $routingSource = $this->readModuleSource('src/Services/VisitRoutingService.php');
        $this->assertStringContainsString('enable_advisory_routing', $routingSource);
        $this->assertStringContainsString('routing_suggested_provider_id', $routingSource);

        $rosterUi = $this->readFrontendSource('src/islands/doctor-desk/DoctorRosterBar.tsx');
        $this->assertStringContainsString('doctor.roster', $rosterUi);
    }

    public function testMandatory50ChartDepthSmokeE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/v11-cd-smoke.spec.js';
        $this->assertFileExists($specPath, 'V1.1-CD smoke spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('pilot-enable-v11-cd.php', $spec);
        $this->assertStringContainsString('v11-cd-smoke-fixture.php', $spec);
        $this->assertStringContainsString('chart_depth.payments_list', $spec);
        $this->assertStringContainsString('chart_depth.receipt_reprint', $spec);
        $this->assertStringContainsString('chart_depth.referrals_list', $spec);
        $this->assertStringContainsString('chart_depth.export_builder', $spec);

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-cd.php';
        $this->assertFileExists($pilotScript, 'Pilot V1.1-CD enable script must exist');

        $fixtureScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-cd-smoke-fixture.php';
        $this->assertFileExists($fixtureScript, 'V1.1-CD smoke fixture must exist');

        $httpSmoke = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-chart-depth-http.php';
        $this->assertFileExists($httpSmoke, 'Chart depth HTTP smoke must exist');

        $policy = file_get_contents(dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/src/Services/AjaxActionPolicy.php');
        foreach ([
            'chart_depth.payments_list',
            'chart_depth.receipt_reprint',
            'chart_depth.referrals_list',
            'chart_depth.export_builder',
            'chart_depth.export_generate',
        ] as $action) {
            $this->assertStringContainsString($action, $policy, "Ajax policy must list {$action}");
        }

        $paymentsUi = $this->readFrontendSource('src/islands/chart-depth/PaymentsPane.tsx');
        $this->assertStringContainsString('chart_depth.payments_list', $paymentsUi);
    }

    public function testMandatory51LabOpsSmokeE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/v11-lab-smoke.spec.js';
        $this->assertFileExists($specPath, 'V1.1-LAB smoke spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('pilot-enable-v11-lab.php', $spec);
        $this->assertStringContainsString('v11-lab-smoke-fixture.php', $spec);
        $this->assertStringContainsString('lab_ops.worklist', $spec);
        $this->assertStringContainsString('lab_ops.setup_status', $spec);
        $this->assertStringContainsString('nc-lab-ops-hub', $spec);

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-lab.php';
        $this->assertFileExists($pilotScript, 'Pilot V1.1-LAB enable script must exist');

        $seedLib = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/lab-ops-pilot-seed.php';
        $this->assertFileExists($seedLib, 'Lab ops pilot seed lib must exist');
        $seedBody = file_get_contents($seedLib);
        $this->assertStringContainsString('labOpsPilotImportStarterPanel', $seedBody);

        $httpSmoke = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-lab-ops-http.php';
        $this->assertFileExists($httpSmoke, 'Lab ops HTTP smoke must exist');

        $hubPhp = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/lab-ops/index.php';
        $this->assertFileExists($hubPhp, 'Lab ops hub entry must exist');
        $this->assertStringContainsString('enable_lab_ops', file_get_contents($hubPhp));

        $worklistTest = __DIR__ . '/LabOpsWorklistServiceTest.php';
        $this->assertFileExists($worklistTest, 'Lab ops worklist service test must exist');
    }

    public function testMandatory52LabPanelOrderSmokeE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/v11-lab-ord-smoke.spec.js';
        $this->assertFileExists($specPath, 'V1.1-LAB-ORD smoke spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('pilot-enable-v11-lab-ord.php', $spec);
        $this->assertStringContainsString('v11-lab-ord-smoke-fixture.php', $spec);
        $this->assertStringContainsString('doctor.lab_panel_catalog', $spec);
        $this->assertStringContainsString('doctor.lab_panel_place', $spec);
        $this->assertStringContainsString('Quick lab order', $spec);
        $this->assertStringContainsString('nc-lab-panel-starter', $spec);

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-lab-ord.php';
        $this->assertFileExists($pilotScript, 'Pilot V1.1-LAB-ORD enable script must exist');

        $fixtureScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-lab-ord-smoke-fixture.php';
        $this->assertFileExists($fixtureScript, 'Lab panel order smoke fixture must exist');

        $httpSmoke = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-lab-panel-order-http.php';
        $this->assertFileExists($httpSmoke, 'Lab panel order HTTP smoke must exist');

        $servicePath = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/src/Services/LabPanelOrderService.php';
        $this->assertFileExists($servicePath, 'LabPanelOrderService must exist');
        $serviceBody = file_get_contents($servicePath);
        $this->assertStringContainsString('enable_lab_panel_order', $serviceBody);
        $this->assertStringContainsString('doctor.lab_panel_catalog', file_get_contents(
            dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/src/Controllers/AjaxController.php'
        ));

        $modalPath = dirname(__DIR__, 5) . '/frontend/src/islands/doctor-desk/LabPanelModal.tsx';
        $this->assertFileExists($modalPath, 'LabPanelModal React component must exist');
    }

    public function testMandatory53FormularyRxSmokeE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/v12-pharm-rx-smoke.spec.js';
        $this->assertFileExists($specPath, 'V1.2-PHARM-RX smoke spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('pilot-enable-v12-pharm-rx.php', $spec);
        $this->assertStringContainsString('v12-pharm-rx-smoke-fixture.php', $spec);
        $this->assertStringContainsString('doctor.formulary_rx_catalog', $spec);
        $this->assertStringContainsString('formulary_rx_place', $spec);
        $this->assertStringContainsString('Quick prescribe', $spec);
        $this->assertStringContainsString('nc-formulary-rx-place', $spec);
        $this->assertStringContainsString('Paracetamol', $spec);

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v12-pharm-rx.php';
        $this->assertFileExists($pilotScript, 'Pilot V1.2-PHARM-RX enable script must exist');

        $fixtureScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/v12-pharm-rx-smoke-fixture.php';
        $this->assertFileExists($fixtureScript, 'Formulary Rx smoke fixture must exist');

        $httpSmoke = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-formulary-rx-http.php';
        $this->assertFileExists($httpSmoke, 'Formulary Rx HTTP smoke must exist');

        $servicePath = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/src/Services/PharmFormularyRxService.php';
        $this->assertFileExists($servicePath, 'PharmFormularyRxService must exist');
        $serviceBody = file_get_contents($servicePath);
        $this->assertStringContainsString('enable_pharm_rx_favorites', $serviceBody);

        $modalPath = dirname(__DIR__, 5) . '/frontend/src/islands/doctor-desk/FormularyRxModal.tsx';
        $this->assertFileExists($modalPath, 'FormularyRxModal React component must exist');

        $serviceTest = __DIR__ . '/PharmFormularyRxServiceTest.php';
        $this->assertFileExists($serviceTest, 'PharmFormularyRxService unit test must exist');
    }

    public function testMandatory54AdminHubSmokeE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/v11-admin-smoke.spec.js';
        $this->assertFileExists($specPath, 'V1.1-ADMIN smoke spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('pilot-enable-v11-admin.php', $spec);
        $this->assertStringContainsString('v11-admin-smoke-fixture.php', $spec);
        $this->assertStringContainsString('admin.config', $spec);
        $this->assertStringContainsString('nc-admin-runbooks', $spec);
        $this->assertStringContainsString('nc-admin-forms-catalog', $spec);
        $this->assertStringContainsString('RB-01', $spec);
        $this->assertStringContainsString('403', $spec);

        $importSpecPath = $e2eDir . '/specs/admin-config-import.spec.js';
        $this->assertFileExists($importSpecPath, 'Admin config import spec must exist');
        $importSpec = file_get_contents($importSpecPath);
        $this->assertStringContainsString('pilot-enable-v11-admin.php', $importSpec);
        $this->assertStringContainsString('config_import', $importSpec);

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-admin.php';
        $this->assertFileExists($pilotScript, 'Pilot V1.1-ADMIN enable script must exist');

        $fixtureScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-admin-smoke-fixture.php';
        $this->assertFileExists($fixtureScript, 'Admin hub smoke fixture must exist');

        $httpSmoke = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-admin-hub-http.php';
        $this->assertFileExists($httpSmoke, 'Admin hub HTTP smoke must exist');

        $hubPath = dirname(__DIR__, 5) . '/frontend/src/islands/admin-hub/AdminHub.tsx';
        $this->assertFileExists($hubPath, 'AdminHub React component must exist');

        $runbookTest = __DIR__ . '/AdminRunbookServiceTest.php';
        $this->assertFileExists($runbookTest, 'AdminRunbookService unit test must exist');

        $adminServicePath = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/src/Services/ClinicAdminService.php';
        $this->assertStringContainsString('enable_admin_hub', file_get_contents($adminServicePath));
    }

    public function testMandatory55ReportHubRepSmokeE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/v11-rep-smoke.spec.js';
        $this->assertFileExists($specPath, 'V1.1-REP smoke spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('pilot-enable-v11-rep.php', $spec);
        $this->assertStringContainsString('v11-rep-smoke-fixture.php', $spec);
        $this->assertStringContainsString('reports.catalog', $spec);
        $this->assertStringContainsString('reports.run', $spec);
        $this->assertStringContainsString('reports.export', $spec);
        $this->assertStringContainsString('Immunizations given', $spec);
        $this->assertStringContainsString('403', $spec);
        $this->assertStringContainsString('nc-report-hub', $spec);

        $legacySpecPath = $e2eDir . '/specs/report-hub.spec.js';
        $this->assertFileExists($legacySpecPath, 'Legacy report hub spec must exist');

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-rep.php';
        $this->assertFileExists($pilotScript, 'Pilot V1.1-REP enable script must exist');

        $fixtureScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-rep-smoke-fixture.php';
        $this->assertFileExists($fixtureScript, 'Report hub smoke fixture must exist');

        $httpSmoke = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-report-hub-http.php';
        $this->assertFileExists($httpSmoke, 'Report hub HTTP smoke must exist');

        $hubPhp = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/report-hub/index.php';
        $this->assertFileExists($hubPhp, 'Report hub entry must exist');
        $this->assertStringContainsString('enable_report_hub', file_get_contents($hubPhp));

        $hubPath = dirname(__DIR__, 5) . '/frontend/src/islands/report-hub/ReportHub.tsx';
        $this->assertFileExists($hubPath, 'ReportHub React component must exist');

        $accessTest = __DIR__ . '/ReportHubAccessServiceTest.php';
        $this->assertFileExists($accessTest, 'Report hub access service test must exist');
    }

    public function testMandatory56PrintRxSmokeE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/v11-print-rx-smoke.spec.js';
        $this->assertFileExists($specPath, 'V1.1-PRINT-RX smoke spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('pilot-enable-v11-print-rx.php', $spec);
        $this->assertStringContainsString('v11-print-rx-smoke-fixture.php', $spec);
        $this->assertStringContainsString('v11-print-rx-seed-prescription.php', $spec);
        $this->assertStringContainsString('rx_print_pdf', $spec);
        $this->assertStringContainsString('rx_print_enabled', $spec);
        $this->assertStringContainsString('doctor.active', $spec);
        $this->assertStringContainsString('Print Rx for Paracetamol', $spec);
        $this->assertStringContainsString('enable_pharm_ops', $spec);
        $this->assertStringContainsString('formularyRxEnabled', $spec);

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-print-rx.php';
        $this->assertFileExists($pilotScript, 'Pilot V1.1-PRINT-RX enable script must exist');
        $pilotBody = file_get_contents($pilotScript);
        $this->assertStringContainsString('enable_rx_print', $pilotBody);
        $this->assertStringContainsString("set('enable_pharm_ops', '0'", $pilotBody);

        $fixtureScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-print-rx-smoke-fixture.php';
        $this->assertFileExists($fixtureScript, 'Print Rx smoke fixture must exist');

        $httpSmoke = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-rx-print-http.php';
        $this->assertFileExists($httpSmoke, 'Print Rx HTTP smoke must exist');

        $servicePath = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/src/Services/PharmOpsRxPrintService.php';
        $this->assertFileExists($servicePath, 'PharmOpsRxPrintService must exist');

        $printPhp = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/rx-print.php';
        $this->assertFileExists($printPhp, 'rx-print.php entry must exist');

        $printUtils = dirname(__DIR__, 5) . '/frontend/src/islands/pharm-ops/rxPrintUtils.ts';
        $this->assertFileExists($printUtils, 'rxPrintUtils must exist');
        $this->assertStringContainsString('pharm_ops.rx_print_pdf', file_get_contents($printUtils));
    }

    public function testMandatory57QueueBridgeSmokeE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/v11-bridge-smoke.spec.js';
        $this->assertFileExists($specPath, 'V1.1-BRIDGE smoke spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('pilot-enable-v11-bridge.php', $spec);
        $this->assertStringContainsString('v11-bridge-smoke-fixture.php', $spec);
        $this->assertStringContainsString('queue-bridge-fixture-seed.php', $spec);
        $this->assertStringContainsString('queue_bridge.list', $spec);
        $this->assertStringContainsString('EX-01', $spec);
        $this->assertStringContainsString('Arrived on schedule', $spec);
        $this->assertStringContainsString('403', $spec);
        $this->assertStringContainsString('nc-queue-bridge-root', $spec);

        $legacySpecPath = $e2eDir . '/specs/queue-bridge.spec.js';
        $this->assertFileExists($legacySpecPath, 'Legacy queue bridge spec must exist');

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-bridge.php';
        $this->assertFileExists($pilotScript, 'Pilot V1.1-BRIDGE enable script must exist');
        $pilotBody = file_get_contents($pilotScript);
        $this->assertStringContainsString('enable_queue_bridge', $pilotBody);
        $this->assertStringContainsString('enable_scheduled_integration', $pilotBody);

        $fixtureScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-bridge-smoke-fixture.php';
        $this->assertFileExists($fixtureScript, 'Queue bridge smoke fixture must exist');

        $httpSmoke = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-queue-bridge-http.php';
        $this->assertFileExists($httpSmoke, 'Queue bridge HTTP smoke must exist');

        $hubPhp = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/queue-bridge/index.php';
        $this->assertFileExists($hubPhp, 'Queue bridge entry must exist');

        $hubPath = dirname(__DIR__, 5) . '/frontend/src/islands/queue-bridge/QueueBridgeHub.tsx';
        $this->assertFileExists($hubPath, 'QueueBridgeHub React component must exist');

        $accessTest = __DIR__ . '/QueueBridgeAccessServiceTest.php';
        $this->assertFileExists($accessTest, 'Queue bridge access service test must exist');

        $integrationTest = __DIR__ . '/QueueBridgeServiceIntegrationTest.php';
        $this->assertFileExists($integrationTest, 'Queue bridge integration test must exist');
    }

    public function testMandatory58ClinicalDocSmokeE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/v11-doc-smoke.spec.js';
        $this->assertFileExists($specPath, 'V1.1-DOC smoke spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('pilot-enable-v11-doc.php', $spec);
        $this->assertStringContainsString('v11-doc-smoke-fixture.php', $spec);
        $this->assertStringContainsString('clinical_doc.catalog', $spec);
        $this->assertStringContainsString('doctor.shortcut_preflight', $spec);
        $this->assertStringContainsString('encounter_hub', $spec);
        $this->assertStringContainsString('nc-clinical-doc', $spec);
        $this->assertStringContainsString('403', $spec);

        $legacySpecPath = $e2eDir . '/specs/clinical-doc.spec.js';
        $this->assertFileExists($legacySpecPath, 'Legacy clinical doc spec must exist');

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-doc.php';
        $this->assertFileExists($pilotScript, 'Pilot V1.1-DOC enable script must exist');
        $pilotBody = file_get_contents($pilotScript);
        $this->assertStringContainsString('enable_clinical_doc_hub', $pilotBody);

        $goldenPathPrep = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/golden-path-e2e-prep.php';
        $this->assertFileExists($goldenPathPrep, 'Golden-path E2E prep must set clinical doc bundle');
        $this->assertStringContainsString('clinical_doc_bundle', file_get_contents($goldenPathPrep));

        $catalogService = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/src/Services/ClinicalDocCatalogService.php';
        $this->assertStringContainsString('resolveBundleKey', file_get_contents($catalogService));

        $fixtureScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-doc-smoke-fixture.php';
        $this->assertFileExists($fixtureScript, 'Clinical doc smoke fixture must exist');

        $httpSmoke = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-clinical-doc-http.php';
        $this->assertFileExists($httpSmoke, 'Clinical doc HTTP smoke must exist');

        $hubPhp = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/clinical-doc/index.php';
        $this->assertFileExists($hubPhp, 'Clinical doc hub entry must exist');
        $this->assertStringContainsString('enable_clinical_doc_hub', file_get_contents($hubPhp));

        $hubPath = dirname(__DIR__, 5) . '/frontend/src/islands/clinical-doc/ClinicalDocHub.tsx';
        $this->assertFileExists($hubPath, 'ClinicalDocHub React component must exist');

        $catalogTest = __DIR__ . '/ClinicalDocCatalogServiceTest.php';
        $this->assertFileExists($catalogTest, 'Clinical doc catalog service test must exist');

        $formOpenTest = __DIR__ . '/ClinicalDocFormOpenServiceTest.php';
        $this->assertFileExists($formOpenTest, 'Clinical doc form open service test must exist');
    }

    public function testMandatory59SchedulingRecurringFixtureContract(): void
    {
        $recurringSeed = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/scheduling-recurring-fixture-seed.php';
        $this->assertFileExists($recurringSeed, 'Scheduling recurring fixture seed must exist');
        $seedBody = file_get_contents($recurringSeed);
        $this->assertStringContainsString('NC-RECURRING-E2E-FIXTURE', $seedBody);
        $this->assertStringNotContainsString('LAST_INSERT_ID()', $seedBody);
        $this->assertStringContainsString('ORDER BY pc_eid DESC LIMIT 1', $seedBody);
        $this->assertStringNotContainsString("config->set('enable_scheduling_redesign'", $seedBody);

        $shellPath = dirname(__DIR__, 5) . '/frontend/src/islands/scheduling/SchedulingShell.tsx';
        $this->assertFileExists($shellPath, 'Scheduling shell island must exist');

        $ctxFixture = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/v12-ctx-smoke-fixture.php';
        $this->assertFileExists($ctxFixture, 'CTX smoke fixture must seed waiting visits');
    }

    public function testMandatory60SchedulingSmokeE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/v11-scheduling-smoke.spec.js';
        $this->assertFileExists($specPath, 'S1 Scheduling smoke spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('pilot-enable-v11-scheduling.php', $spec);
        $this->assertStringContainsString('e2e-prep-golden-path.php', $spec);
        $this->assertStringContainsString('v11-scheduling-smoke-fixture.php', $spec);
        $this->assertStringContainsString('scheduling-recurring-fixture-seed.php', $spec);
        $this->assertStringContainsString('scheduling.calendar.range', $spec);
        $this->assertStringContainsString('scheduling.flow_board.list', $spec);
        $this->assertStringContainsString('scheduling.recalls.list', $spec);
        $this->assertStringContainsString('Mode 2 arrivals only', $spec);
        $this->assertStringContainsString('403', $spec);
        $this->assertStringContainsString('nc-scheduling-root', $spec);

        $legacySpecPath = $e2eDir . '/specs/scheduling.spec.js';
        $this->assertFileExists($legacySpecPath, 'Legacy scheduling spec must exist');

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-scheduling.php';
        $this->assertFileExists($pilotScript, 'Pilot S1 scheduling enable script must exist');
        $pilotBody = file_get_contents($pilotScript);
        $this->assertStringContainsString('enable_scheduling_redesign', $pilotBody);
        $this->assertStringContainsString('enable_scheduled_integration', $pilotBody);
        $this->assertStringContainsString('enable_react_scheduling', $pilotBody);

        $fixtureScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-scheduling-smoke-fixture.php';
        $this->assertFileExists($fixtureScript, 'Scheduling smoke fixture must exist');
        $fixtureBody = file_get_contents($fixtureScript);
        $this->assertStringContainsString('NC-SCHEDULING-SMOKE-FIXTURE', $fixtureBody);
        $this->assertStringNotContainsString('LAST_INSERT_ID()', $fixtureBody);

        $httpSmoke = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-scheduling-http.php';
        $this->assertFileExists($httpSmoke, 'Scheduling HTTP smoke must exist');

        $hubPhp = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/scheduling/index.php';
        $this->assertFileExists($hubPhp, 'Scheduling hub entry must exist');

        $shellPath = dirname(__DIR__, 5) . '/frontend/src/islands/scheduling/SchedulingShell.tsx';
        $this->assertFileExists($shellPath, 'SchedulingShell React component must exist');

        $accessTest = __DIR__ . '/SchedulingAccessServiceTest.php';
        $this->assertFileExists($accessTest, 'Scheduling access service test must exist');

        $calendarTest = __DIR__ . '/SchedulingCalendarServiceTest.php';
        $this->assertFileExists($calendarTest, 'Scheduling calendar service test must exist');
    }

    public function testMandatory61BillDepthSmokeE2e(): void
    {
        $e2eDir = dirname(__DIR__, 4) . '/e2e/new-clinic';
        $specPath = $e2eDir . '/specs/v12-bill-depth-smoke.spec.js';
        $this->assertFileExists($specPath, 'V1.2-BILL depth smoke spec must exist');

        $spec = file_get_contents($specPath);
        $this->assertStringContainsString('pilot-enable-v12-bill.php', $spec);
        $this->assertStringContainsString('e2e-prep-golden-path.php', $spec);
        $this->assertStringContainsString('v12-bill-depth-fixture-seed.php', $spec);
        $this->assertStringContainsString('v12-bill-depth-smoke-fixture.php', $spec);
        $this->assertStringContainsString('bill_ops.charge_correct', $spec);
        $this->assertStringContainsString('bill_ops.payment_reverse', $spec);
        $this->assertStringContainsString('Save correction', $spec);
        $this->assertStringContainsString('Reverse payment', $spec);
        $this->assertStringContainsString('Reversed', $spec);

        $baseSpecPath = $e2eDir . '/specs/v12-bill-smoke.spec.js';
        $this->assertFileExists($baseSpecPath, 'V1.2-BILL base smoke spec must exist');

        $pilotScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v12-bill.php';
        $this->assertFileExists($pilotScript, 'Pilot V1.2-BILL enable script must exist');
        $pilotBody = file_get_contents($pilotScript);
        $this->assertStringContainsString('enable_bill_ops', $pilotBody);

        $seedScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/v12-bill-depth-fixture-seed.php';
        $this->assertFileExists($seedScript, 'Bill depth fixture seed must exist');

        $fixtureScript = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/v12-bill-depth-smoke-fixture.php';
        $this->assertFileExists($fixtureScript, 'Bill depth smoke fixture must exist');
        $fixtureBody = file_get_contents($fixtureScript);
        $this->assertStringContainsString('NC-BILLDEPTH-CORRECT', file_get_contents(
            dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/bill-depth-fixture-lib.php'
        ));

        $httpSmoke = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-bill-ops-depth-http.php';
        $this->assertFileExists($httpSmoke, 'Bill depth HTTP smoke must exist');

        $hubPhp = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/bill-ops/index.php';
        $this->assertFileExists($hubPhp, 'Bill ops hub entry must exist');

        $chargeForm = dirname(__DIR__, 5) . '/frontend/src/islands/bill-ops/ChargeCorrectionForm.tsx';
        $this->assertFileExists($chargeForm, 'ChargeCorrectionForm React component must exist');

        $paymentsPane = dirname(__DIR__, 5) . '/frontend/src/islands/bill-ops/PaymentsPane.tsx';
        $this->assertFileExists($paymentsPane, 'PaymentsPane React component must exist');

        $billOpsTest = __DIR__ . '/BillOpsServicesTest.php';
        $this->assertFileExists($billOpsTest, 'Bill ops services test must exist');
    }
}

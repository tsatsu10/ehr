<?php

/**
 * Mandatory test 43 — wrong patient prevention (PRD §16, G12, D50–D56).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Exceptions\VisitNotTakeableException;
use OpenEMR\Modules\NewClinic\Services\CashierService;
use OpenEMR\Modules\NewClinic\Services\DoctorService;
use OpenEMR\Modules\NewClinic\Services\EncounterIdentityStripService;
use OpenEMR\Modules\NewClinic\Services\PatientContextService;
use OpenEMR\Modules\NewClinic\Services\VisitClaimLostService;
use OpenEMR\Modules\NewClinic\Support\VisitTransitionConflictResolver;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * @group new-clinic-mandatory
 */
#[Group('new-clinic-mandatory')]
class WrongPatientPreventionMandatoryTest extends TestCase
{
    private function moduleRoot(): string
    {
        return dirname(__DIR__, 5) . '/interface/modules/custom_modules/oe-module-new-clinic';
    }

    private function readSource(string $relativePath): string
    {
        $path = $this->moduleRoot() . '/' . ltrim($relativePath, '/');
        $this->assertFileExists($path, 'Expected module file: ' . $relativePath);

        return (string) file_get_contents($path);
    }

    private function frontendRoot(): string
    {
        return dirname(__DIR__, 5) . '/frontend';
    }

    private function readFrontendSource(string $relativePath): string
    {
        $path = $this->frontendRoot() . '/' . ltrim($relativePath, '/');
        $this->assertFileExists($path, 'Expected frontend file: ' . $relativePath);

        return (string) file_get_contents($path);
    }

    private function methodBody(string $class, string $method): string
    {
        $reflection = new ReflectionMethod($class, $method);
        $source = file_get_contents($reflection->getFileName());
        $lines = explode("\n", $source);

        return implode("\n", array_slice($lines, $reflection->getStartLine() - 1, $reflection->getEndLine() - $reflection->getStartLine() + 1));
    }

    /** 43a — M4-F33 */
    public function test43aDoctorCannotTakeSecondPatientWhileWithDoctor(): void
    {
        $body = $this->methodBody(DoctorService::class, 'takePatient');

        $this->assertStringContainsString('findActiveConsult', $body);
        $this->assertStringContainsString(
            'Complete or release your current patient before taking another',
            $body
        );
        $this->assertStringContainsString('VisitNotTakeableException', $body);
    }

    /** 43b — concurrent Take patient loser */
    public function test43bConcurrentTakePatientClaimLossIsTakenElsewhere(): void
    {
        $outcome = VisitTransitionConflictResolver::classify(
            'ready_for_doctor',
            'with_doctor',
            'with_doctor',
            2,
            3
        );

        $this->assertSame(VisitTransitionConflictResolver::OUTCOME_CLAIM_LOSS, $outcome);

        $body = $this->methodBody(
            \OpenEMR\Modules\NewClinic\Services\VisitQueueService::class,
            'buildTakenElsewhereException'
        );
        $this->assertStringContainsString("'interrupt' => 'taken_elsewhere'", $body);
        $this->assertStringContainsString('take_patient', $body);
    }

    /** 43b2 — concurrent start_triage loser */
    public function test43b2ConcurrentStartTriageClaimLossIsTakenElsewhere(): void
    {
        $outcome = VisitTransitionConflictResolver::classify(
            'waiting',
            'in_triage',
            'in_triage',
            1,
            2
        );

        $this->assertSame(VisitTransitionConflictResolver::OUTCOME_CLAIM_LOSS, $outcome);

        $meta = VisitTransitionConflictResolver::claimMetaForState('in_triage');
        $this->assertSame('start_triage', $meta['kind'] ?? null);
        $this->assertSame('Nurse', $meta['role'] ?? null);

        $exception = new VisitNotTakeableException('Nurse Ada started triage first', [
            'interrupt' => 'taken_elsewhere',
            'claim_kind' => 'start_triage',
            'taker_display_name' => 'Ada Lovelace',
        ]);
        $this->assertSame('taken_elsewhere', $exception->getContext()['interrupt']);
    }

    /** 43c — M3-F16 triage dirty vitals switch */
    public function test43cTriageDirtyVitalsSwitchShowsConfirm(): void
    {
        $source = $this->readFrontendSource('src/islands/triage-desk/TriageDesk.tsx');

        $this->assertStringContainsString('formDirty', $source);
        $this->assertStringContainsString(
            'Discard unsaved vitals and open another patient?',
            $source
        );
    }

    /** 43d — M1a-F14 Front Desk Start visit switch guard */
    public function test43dFrontDeskStartVisitSwitchShowsConfirm(): void
    {
        $source = $this->readFrontendSource('src/islands/front-desk/FrontDesk.tsx');

        $this->assertStringContainsString('resolveSwitchTarget', $source);
        $this->assertStringContainsString('Discard changes and switch to', $source);
        $this->assertStringContainsString('startVisitDirtyRef', $source);
        $this->assertStringContainsString('Switch patient?', $source);
    }

    /** 43e — M5-F15 cashier payment confirm identity */
    public function test43eCashierPaymentConfirmShowsIdentityAndTotal(): void
    {
        $source = $this->readFrontendSource('src/islands/cashier-desk/PayConfirmModal.tsx');
        $identityBanner = $this->readFrontendSource('src/components/ConfirmModal.tsx');

        $this->assertStringContainsString('identity.display_name', $source);
        $this->assertStringContainsString('identity.pubpid', $source);
        $this->assertStringContainsString('Total due', $source);
        $this->assertStringContainsString('IdentityConfirmBanner', $source);
        $this->assertStringContainsString('queueNumber', $source);
        $this->assertStringContainsString('Queue #', $identityBanner);
        $this->assertStringContainsString('MRN', $identityBanner);
    }

    /** 43f — T1-F17 server-injected encounter identity strip */
    public function test43fCoreShortcutUsesServerInjectedIdentityStrip(): void
    {
        $service = new EncounterIdentityStripService();

        $this->assertTrue($service->shortcutShowsStrip('doctor', 'encounter'));
        $this->assertFalse($service->shortcutShowsStrip('doctor', 'chart'));

        $html = '<html><body><div>Form</div></body></html>';
        $strip = '<div id="encounter-identity-strip">strip</div>';
        $this->assertStringContainsString(
            'encounter-identity-strip',
            $service->injectIntoHtml($html, $strip)
        );
    }

    /** 43g — patient switch re-binds session on take */
    public function test43gTakePatientRebindsEncounterSession(): void
    {
        $body = $this->methodBody(DoctorService::class, 'takePatient');

        $this->assertStringContainsString('bindForVisit', $body);
    }

    /** 43h — same-day second visit shows new queue after first completed */
    public function test43hActiveVisitExcludesCompletedForBannerQueueNumber(): void
    {
        $body = $this->methodBody(PatientContextService::class, 'previewPayload');

        $this->assertStringContainsString("'completed'", $body);
        $this->assertStringContainsString("'closed_unpaid'", $body);
        $this->assertStringContainsString('ORDER BY v.id DESC LIMIT 1', $body);
    }

    /** 43i — M1a-F15 cashier resolves checkout by visit_id not pid alone */
    public function test43iCashierCheckoutRequiresVisitResolutionNotPidAlone(): void
    {
        $body = $this->methodBody(CashierService::class, 'resolvePatientCheckout');

        $this->assertStringContainsString("state = 'ready_for_payment'", $body);
        $this->assertStringContainsString("'pick_visit'", $body);
        $this->assertStringContainsString("'single'", $body);
        $this->assertStringNotContainsString('transition', $body);
    }

    /** 43j — M1a-F14b Quick Add / registration dirty switch */
    public function test43jRegistrationFormDirtySwitchShowsConfirm(): void
    {
        $deskSource = $this->readFrontendSource('src/islands/front-desk/FrontDesk.tsx');
        $formSource = $this->readFrontendSource('src/islands/front-desk/RegistrationForm.tsx');

        $this->assertStringContainsString('requestRegistrationDiscard', $deskSource);
        $this->assertStringContainsString('discard_registration', $deskSource);
        $this->assertStringContainsString('requestDiscard', $formSource);
        $this->assertStringContainsString('Discard unsaved registration changes?', $formSource);
    }

    /** 43k — M5-F16 terminal modals repeat Patient · MRN · Queue # */
    public function test43kCashierTerminalModalsRepeatPatientIdentity(): void
    {
        $markUnpaid = $this->readFrontendSource('src/islands/cashier-desk/MarkUnpaidModal.tsx');
        $discount = $this->readFrontendSource('src/islands/cashier-desk/DiscountConfirmModal.tsx');
        $payConfirm = $this->readFrontendSource('src/islands/cashier-desk/PayConfirmModal.tsx');
        $identityBanner = $this->readFrontendSource('src/components/ConfirmModal.tsx');

        $this->assertStringContainsString('identity.display_name', $markUnpaid);
        $this->assertStringContainsString('identity.pubpid', $markUnpaid);
        $this->assertStringContainsString('IdentityConfirmBanner', $markUnpaid);
        $this->assertStringContainsString('queueNumber', $markUnpaid);
        $this->assertStringContainsString('identity.display_name', $discount);
        $this->assertStringContainsString('IdentityConfirmBanner', $discount);
        $this->assertStringContainsString('IdentityConfirmBanner', $payConfirm);
        $this->assertStringContainsString('MRN', $identityBanner);
    }

    /** 43l — stale complete_consult maps to stale_visit, not taken_elsewhere */
    public function test43lStaleCompleteConsultMapsToStaleVisitNotTakenElsewhere(): void
    {
        $outcome = VisitTransitionConflictResolver::classify(
            'with_doctor',
            'ready_for_payment',
            'with_doctor',
            4,
            5
        );

        $this->assertSame(VisitTransitionConflictResolver::OUTCOME_STALE_VISIT, $outcome);

        $ajaxSource = $this->readSource('src/Controllers/AjaxController.php');
        $this->assertStringContainsString("catch (StaleVisitException", $ajaxSource);
        $this->assertStringContainsString("'code' => 'stale_visit'", $ajaxSource);

        $uiSource = $this->readSource('public/assets/js/ui-components.js');
        $this->assertStringContainsString("code === 'stale_visit'", $uiSource);
        $this->assertStringContainsString("type: 'stale_visit'", $uiSource);
    }

    /** 43m — M0-F36 highlight-only loser gets claim_lost on poll */
    public function test43mHighlightOnlyLoserGetsClaimLostOnPoll(): void
    {
        $method = new ReflectionMethod(VisitClaimLostService::class, 'isClaimLost');
        $service = new VisitClaimLostService();

        $lost = $method->invoke($service, [
            'state' => 'with_doctor',
            'assigned_provider_id' => 99,
        ], 'ready_for_doctor', 12);

        $this->assertTrue($lost);

        $uiSource = $this->readSource('public/assets/js/ui-components.js');
        $this->assertStringContainsString('claim_lost', $uiSource);
        $this->assertStringContainsString('processClaimLostPoll', $uiSource);
    }
}

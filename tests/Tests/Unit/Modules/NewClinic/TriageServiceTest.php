<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Exceptions\VitalsValidationException;
use OpenEMR\Modules\NewClinic\Services\ClinicDateService;
use OpenEMR\Modules\NewClinic\Services\EncounterSessionService;
use OpenEMR\Modules\NewClinic\Services\PatientContextService;
use OpenEMR\Modules\NewClinic\Services\TriageService;
use OpenEMR\Modules\NewClinic\Services\VisitBoardService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitRowEnricher;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use OpenEMR\Modules\NewClinic\Services\VitalsPreviewBuilder;
use OpenEMR\Modules\NewClinic\Services\VitalsValidationService;
use PHPUnit\Framework\TestCase;

class TriageServiceTest extends TestCase
{
    private VisitQueueService $queue;
    private VisitBoardService $board;
    private PatientContextService $patientContext;
    private EncounterSessionService $encounterSession;
    private VisitRowEnricher $rowEnricher;
    private VitalsValidationService $vitalsValidation;
    private VitalsPreviewBuilder $vitalsPreview;

    protected function setUp(): void
    {
        $this->queue = $this->createMock(VisitQueueService::class);
        $this->board = $this->createMock(VisitBoardService::class);
        $this->patientContext = $this->createMock(PatientContextService::class);
        $this->encounterSession = $this->createMock(EncounterSessionService::class);
        $this->rowEnricher = $this->createMock(VisitRowEnricher::class);
        $this->vitalsValidation = $this->createMock(VitalsValidationService::class);
        $this->vitalsPreview = $this->createMock(VitalsPreviewBuilder::class);
    }

    private function makeService(): TriageService
    {
        return new TriageService(
            $this->queue,
            $this->board,
            $this->patientContext,
            $this->encounterSession,
            $this->createMock(VisitScopeService::class),
            $this->rowEnricher,
            $this->vitalsValidation,
            $this->vitalsPreview,
            $this->createMock(ClinicDateService::class),
        );
    }

    public function testSelectPatientRejectsVisitNotOnTriageQueue(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'with_doctor', 'pid' => 10, 'encounter' => 20,
        ]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Visit is not on the triage queue');

        $this->makeService()->selectPatient(5, 7);
    }

    public function testSelectPatientRejectsVisitHeldByAnotherNurse(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'in_triage', 'pid' => 10, 'encounter' => 20, 'row_version' => 1,
        ]);
        $this->rowEnricher->method('batchTriageHolders')->willReturn([
            5 => ['actor_user_id' => 99, 'actor_name' => 'Nurse Adjoa', 'created_at' => '2026-07-08 09:00:00'],
        ]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Visit is being triaged by Nurse Adjoa');

        $this->makeService()->selectPatient(5, 7);
    }

    public function testSelectPatientAllowsReentryByTheSameNurse(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'in_triage', 'pid' => 10, 'encounter' => 20, 'row_version' => 1,
        ]);
        $this->rowEnricher->method('batchTriageHolders')->willReturn([
            5 => ['actor_user_id' => 7, 'actor_name' => 'Me', 'created_at' => '2026-07-08 09:00:00'],
        ]);
        $this->encounterSession->expects($this->once())->method('bindForVisit')->with(5, 7);
        $this->board->method('getVisitDetail')->willReturn([
            'visit' => ['id' => 5, 'state' => 'in_triage'],
            'skipped_triage' => false,
        ]);
        $this->patientContext->method('previewPayload')->willReturn(['identity' => []]);
        $this->vitalsPreview->method('getEncounterVitals')->willReturn([]);
        $this->vitalsPreview->method('evaluateWarnings')->willReturn([]);
        $this->vitalsPreview->method('mergeIntoPreview')->willReturn(['identity' => []]);
        $this->vitalsPreview->method('formatLatestForForm')->willReturn([]);

        $result = $this->makeService()->selectPatient(5, 7);

        $this->assertSame(5, $result['visit']['id']);
        $this->assertFalse($result['skipped_triage']);
    }

    public function testSendToDoctorRequiresInTriageState(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'waiting', 'pid' => 10, 'encounter' => 20,
        ]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Visit is not in triage');

        $this->makeService()->sendToDoctor(5, 7, 1);
    }

    public function testSendToDoctorBlocksWithoutCompleteVitals(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'in_triage', 'pid' => 10, 'encounter' => 20,
        ]);
        $this->vitalsPreview->method('hasCompleteTriageVitals')->willReturn(false);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Save vitals before sending the patient to the doctor');

        $this->makeService()->sendToDoctor(5, 7, 1);
    }

    public function testSendToDoctorDelegatesToQueueFsmWhenVitalsComplete(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'in_triage', 'pid' => 10, 'encounter' => 20,
        ]);
        $this->vitalsPreview->method('hasCompleteTriageVitals')->willReturn(true);
        $this->queue->expects($this->once())
            ->method('sendToDoctor')
            ->with(5, 7, 3, 'fever', null)
            ->willReturn(['visit' => ['id' => 5, 'state' => 'ready_for_doctor']]);

        $result = $this->makeService()->sendToDoctor(5, 7, 3, 'fever');

        $this->assertSame('ready_for_doctor', $result['visit']['state']);
    }

    public function testSaveVitalsRequiresInTriageState(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'ready_for_doctor', 'pid' => 10, 'encounter' => 20,
        ]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Visit must be in triage to save vitals');

        $this->makeService()->saveVitals(5, 7, ['temperature' => '37.0']);
    }

    public function testSaveVitalsSurfacesValidationErrorsWithoutSaving(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'in_triage', 'pid' => 10, 'encounter' => 20,
        ]);
        $this->vitalsValidation->method('validateForTriage')->willReturn([
            'errors' => ['Temperature out of range'],
            'field_errors' => ['temperature' => 'Out of range'],
            'field_warnings' => [],
            'payload' => [],
        ]);
        $this->encounterSession->expects($this->never())->method('bindForVisit');

        $this->expectException(VitalsValidationException::class);

        $this->makeService()->saveVitals(5, 7, ['temperature' => '99']);
    }
}

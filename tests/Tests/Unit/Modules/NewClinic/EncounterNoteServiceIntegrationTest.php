<?php

/**
 * DB-backed integration tests for native encounter consult note immutability and unlock.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\EncounterNoteService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use OpenEMR\Services\PatientService;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;

#[Group('new-clinic-integration')]
class EncounterNoteServiceIntegrationTest extends TestCase
{
    private static bool $bootstrapped = false;

    private int $facilityId = 0;

    private ?string $prevEngine = null;

    protected function setUp(): void
    {
        if (!self::$bootstrapped) {
            $_GET['site'] = 'default';
            $ignoreAuth = true;
            require_once dirname(__DIR__, 5) . '/interface/globals.php';
            self::$bootstrapped = true;
        }
        // CLI has no client address; the audit logger's sanitize path warns
        // on the missing key otherwise.
        $_SERVER['REMOTE_ADDR'] = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

        $this->facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
        if ($this->facilityId <= 0) {
            $this->markTestSkipped('No service-location facility configured');
        }

        $_SESSION['facilityId'] = $this->facilityId;
        $config = new ClinicConfigService();
        $this->prevEngine = (string) ($config->get('encounter_note_engine', EncounterNoteService::ENGINE_LEGACY, $this->facilityId) ?? EncounterNoteService::ENGINE_LEGACY);
        $config->set('encounter_note_engine', EncounterNoteService::ENGINE_NATIVE, $this->facilityId);
    }

    protected function tearDown(): void
    {
        if ($this->facilityId > 0 && $this->prevEngine !== null) {
            (new ClinicConfigService())->set('encounter_note_engine', $this->prevEngine, $this->facilityId);
        }
    }

    public function testBuildPrefillIncludesPatientDemographics(): void
    {
        $fixture = $this->createConsultVisit();
        if ($fixture === null) {
            $this->markTestSkipped('Could not create consult visit fixture');
        }

        $service = new EncounterNoteService();
        $prefill = $service->prefill($fixture['visit_id'], $fixture['actor_user_id']);

        $this->assertNotSame('', trim((string) ($prefill['patient']['display_name'] ?? '')));
        $this->assertNotSame('', trim((string) ($prefill['patient']['pubpid'] ?? '')));
        $this->assertArrayHasKey('age_years', $prefill['patient']);

        $this->cleanupVisitNote($fixture['visit_id']);
    }

    public function testSaveRejectsLockedConsultNote(): void
    {
        $fixture = $this->createConsultVisit();
        if ($fixture === null) {
            $this->markTestSkipped('Could not create consult visit fixture');
        }

        $service = new EncounterNoteService();
        $sections = $this->minimalSections();
        $saved = $service->save([
            'visit_id' => $fixture['visit_id'],
            'variant' => 'general_opd',
            'sections' => $sections,
        ], $fixture['actor_user_id']);

        $formsRowId = (int) ($saved['forms_row_id'] ?? 0);
        $this->assertGreaterThan(0, $formsRowId);

        QueryUtils::sqlInsert(
            'INSERT INTO esign_signatures (tid, `table`, uid, datetime, is_lock, hash, amendment, signature_hash)
             VALUES (?, ?, ?, NOW(), 1, ?, NULL, ?)',
            [$formsRowId, 'forms', $fixture['actor_user_id'], 'integration-lock-hash', 'integration-lock-signature-hash']
        );

        try {
            $this->expectException(\RuntimeException::class);
            $this->expectExceptionMessage('signed and cannot be modified');
            $service->save([
                'visit_id' => $fixture['visit_id'],
                'variant' => 'general_opd',
                'sections' => $sections,
            ], $fixture['actor_user_id']);
        } finally {
            $this->cleanupVisitNote($fixture['visit_id'], $formsRowId);
        }
    }

    public function testUnlockForClinicalCorrectionRemovesLock(): void
    {
        if (!function_exists('acl_check') && !class_exists(\OpenEMR\Common\Acl\AclMain::class)) {
            $this->markTestSkipped('ACL not available');
        }

        $fixture = $this->createConsultVisit();
        if ($fixture === null) {
            $this->markTestSkipped('Could not create consult visit fixture');
        }

        $_SESSION['authUser'] = 'Adminstrator';
        $_SESSION['authUserID'] = $fixture['admin_user_id'];

        $service = new EncounterNoteService();
        $sections = $this->minimalSections();
        $saved = $service->save([
            'visit_id' => $fixture['visit_id'],
            'variant' => 'general_opd',
            'sections' => $sections,
        ], $fixture['actor_user_id']);
        $formsRowId = (int) ($saved['forms_row_id'] ?? 0);
        $this->assertGreaterThan(0, $formsRowId);

        QueryUtils::sqlInsert(
            'INSERT INTO esign_signatures (tid, `table`, uid, datetime, is_lock, hash, amendment, signature_hash)
             VALUES (?, ?, ?, NOW(), 1, ?, NULL, ?)',
            [$formsRowId, 'forms', $fixture['actor_user_id'], 'integration-lock-hash', 'integration-lock-signature-hash']
        );

        try {
            $result = $service->unlockForClinicalCorrection([
                'visit_id' => $fixture['visit_id'],
                'reason' => 'Integration test clinical correction',
                'password' => 'passpass1',
            ], $fixture['admin_user_id']);

            $this->assertTrue($result['unlocked'] ?? false);
            $this->assertFalse($result['signed'] ?? true);

            $updated = $service->save([
                'visit_id' => $fixture['visit_id'],
                'variant' => 'general_opd',
                'sections' => $this->minimalSections('Updated CC'),
            ], $fixture['actor_user_id']);
            $this->assertTrue($updated['saved'] ?? false);
        } catch (\Throwable $e) {
            if (str_contains($e->getMessage(), 'Manager access required') || str_contains($e->getMessage(), 'invalid')) {
                $this->markTestSkipped('Admin unlock ACL or password unavailable in this environment: ' . $e->getMessage());
            }
            throw $e;
        } finally {
            $this->cleanupVisitNote($fixture['visit_id'], $formsRowId);
        }
    }

    /**
     * @return array{visit_id: int, actor_user_id: int, admin_user_id: int}|null
     */
    private function createConsultVisit(): ?array
    {
        $visitType = QueryUtils::querySingleRow(
            'SELECT id FROM new_visit_type WHERE facility_id = ? AND is_active = 1 ORDER BY id ASC LIMIT 1',
            [$this->facilityId]
        );
        $visitTypeId = is_array($visitType) ? (int) ($visitType['id'] ?? 0) : 0;
        if ($visitTypeId <= 0) {
            return null;
        }

        $suffix = (string) time();
        $patientService = new PatientService();
        $created = $patientService->insert([
            'fname' => 'EncInt',
            'lname' => 'Note' . substr($suffix, -5),
            'DOB' => '1988-04-12',
            'sex' => 'Male',
            'pubpid' => 'ENCINT' . substr($suffix, -6),
            'phone_cell' => '0247111' . substr($suffix, -4),
        ]);
        if (!$created->isValid()) {
            return null;
        }

        $pid = (int) ($created->getData()[0]['pid'] ?? 0);
        if ($pid <= 0) {
            return null;
        }

        $doctor = QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ?', ['doctor_user']);
        $actorUserId = (int) ($doctor['id'] ?? 0);
        if ($actorUserId <= 0) {
            return null;
        }

        $admin = QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ?', ['Adminstrator']);
        $adminUserId = (int) ($admin['id'] ?? 0);
        if ($adminUserId <= 0) {
            return null;
        }

        $_SESSION['authUser'] = 'doctor_user';
        $_SESSION['authUserID'] = $actorUserId;

        $visit = (new VisitQueueService())->startVisit(
            $pid,
            $visitTypeId,
            $actorUserId,
            $this->facilityId,
            'Integration consult note'
        );
        $visitId = (int) ($visit['id'] ?? 0);
        if ($visitId <= 0) {
            return null;
        }

        QueryUtils::sqlStatementThrowException(
            "UPDATE new_visit
             SET state = 'with_doctor', assigned_provider_id = ?, row_version = row_version + 1
             WHERE id = ?",
            [$actorUserId, $visitId]
        );

        $_SESSION['new_clinic_visit_id'] = $visitId;
        $_SESSION['pid'] = $pid;
        $_SESSION['encounter'] = (int) ($visit['encounter'] ?? 0);

        return [
            'visit_id' => $visitId,
            'actor_user_id' => $actorUserId,
            'admin_user_id' => $adminUserId,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function minimalSections(string $cc = 'Integration headache'): array
    {
        return [
            'referral' => [
                'requesting_clinician' => '',
                'requesting_service' => '',
                'clinical_question' => '',
                'urgency' => '',
            ],
            'source' => [
                'sources' => [],
                'narrative' => '',
            ],
            'cc' => ['chief_complaint' => $cc],
            'hpi' => [
                'narrative' => 'Integration HPI',
                'onset' => '',
                'duration' => '',
                'severity' => '',
                'aggravating' => '',
                'relieving' => '',
            ],
            'ros' => ['systems' => [], 'narrative' => ''],
            'data_reviewed' => [
                'lab_ids' => [],
                'imaging_narrative' => '',
                'outside_records' => '',
                'narrative' => '',
            ],
            'pe' => ['general' => 'Normal exam', 'specialty' => []],
            'problems' => [
                'items' => [[
                    'id' => 'p1',
                    'problem_label' => 'Headache',
                    'status' => 'active',
                    'assessment_narrative' => 'Likely tension headache',
                    'differential' => '',
                    'plan_items' => [[
                        'id' => 'plan1',
                        'type' => 'other',
                        'text' => 'Analgesia PRN',
                    ]],
                ]],
            ],
            'follow_up' => [
                'return_visit' => '',
                'callback_contact' => '',
                'availability' => '',
                'instructions' => 'Return if worse',
            ],
            'assessment' => ['narrative' => ''],
            'plan' => ['narrative' => ''],
            'attestation' => ['supervisor_attested' => false],
            'context' => [
                'allergies_acknowledged' => true,
                'meds_acknowledged' => true,
            ],
        ];
    }

    private function cleanupVisitNote(int $visitId, int $formsRowId = 0): void
    {
        if ($formsRowId <= 0) {
            $row = QueryUtils::querySingleRow(
                'SELECT forms_row_id FROM nc_encounter_note WHERE visit_id = ? LIMIT 1',
                [$visitId]
            );
            $formsRowId = is_array($row) ? (int) ($row['forms_row_id'] ?? 0) : 0;
        }

        if ($formsRowId > 0) {
            QueryUtils::sqlStatementThrowException(
                'DELETE FROM esign_signatures WHERE tid = ? AND `table` = ?',
                [$formsRowId, 'forms']
            );
            QueryUtils::sqlStatementThrowException(
                'UPDATE forms SET deleted = 1 WHERE id = ?',
                [$formsRowId]
            );
        }

        QueryUtils::sqlStatementThrowException(
            'DELETE FROM nc_encounter_note WHERE visit_id = ?',
            [$visitId]
        );
    }
}

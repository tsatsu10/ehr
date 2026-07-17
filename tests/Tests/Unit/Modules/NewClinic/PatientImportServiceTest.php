<?php

/**
 * Unit tests for patient import row normalization and duplicate resolution
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\PatientImportService;
use PHPUnit\Framework\TestCase;

class PatientImportServiceTest extends TestCase
{
    private function service(): PatientImportService
    {
        $config = new class extends ClinicConfigService {
            public function get(string $key, ?string $default = null, int $facilityId = 0): ?string
            {
                return $default;
            }
        };

        return new PatientImportService(config: $config);
    }

    public function testValidRowNormalizes(): void
    {
        $r = $this->service()->normalizeRow([
            'fname' => ' Ama ', 'lname' => 'Mensah', 'mname' => '',
            'sex' => 'f', 'dob' => '12/03/1988', 'phone' => '024 412 3456',
            'street' => '12 Ring Road', 'old_clinic_number' => 'OPD-0031', 'national_id' => '',
        ]);
        $this->assertTrue($r['ok']);
        $this->assertSame('Ama', $r['data']['fname']);
        $this->assertSame('Female', $r['data']['sex']);
        $this->assertSame('1988-03-12', $r['data']['dob']);
        $this->assertSame('0244123456', $r['data']['phone']);
    }

    public function testIsoDateAccepted(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'K', 'lname' => 'Boateng', 'sex' => 'M', 'dob' => '1975-11-02']);
        $this->assertTrue($r['ok']);
        $this->assertSame('1975-11-02', $r['data']['dob']);
    }

    public function testMissingNameFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => '', 'lname' => 'Mensah', 'dob' => '12/03/1988']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('name', strtolower($r['reason']));
    }

    public function testShortLastNameFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'M', 'dob' => '12/03/1988']);
        $this->assertFalse($r['ok']);
    }

    public function testNeedsDobOrAge(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('date of birth or an age', $r['reason']);
    }

    /** Per the audit amendment, a phone number alone no longer satisfies the identity rule. */
    public function testPhoneAloneNoLongerSatisfiesIdentityRule(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'phone' => '0244123456']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('date of birth or an age', $r['reason']);
    }

    public function testAgeSynthesizesEstimatedDob(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'age' => '30']);
        $this->assertTrue($r['ok']);
        $expectedYear = (int) date('Y') - 30;
        $this->assertSame(sprintf('%04d-07-01', $expectedYear), $r['data']['dob']);
        $this->assertSame('1', $r['data']['dob_estimated']);
    }

    public function testAgeOutOfRangeFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'age' => '131']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('age', strtolower($r['reason']));
    }

    public function testNonNumericAgeFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'age' => 'thirty']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('age', strtolower($r['reason']));
    }

    public function testAgeIgnoredWhenRealDobPresent(): void
    {
        $r = $this->service()->normalizeRow([
            'fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'dob' => '12/03/1988', 'age' => '5',
        ]);
        $this->assertTrue($r['ok']);
        $this->assertSame('1988-03-12', $r['data']['dob']);
        $this->assertSame('0', $r['data']['dob_estimated']);
    }

    public function testBadDateFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'dob' => '31/02/1990']);
        $this->assertFalse($r['ok']);
    }

    public function testTwoDigitYearFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'dob' => '12/03/88']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('4-digit', $r['reason']);
    }

    public function testFutureDateFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'dob' => '12/03/2099']);
        $this->assertFalse($r['ok']);
    }

    public function testUnknownSexFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/1988', 'sex' => 'X']);
        $this->assertFalse($r['ok']);
    }

    public function testBlankSexFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/1988', 'sex' => '']);
        $this->assertFalse($r['ok']);
        $this->assertSame('Sex is required — use M or F', $r['reason']);
    }

    public function testInvalidPhoneFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'phone' => '12345']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('phone', strtolower($r['reason']));
    }

    public function testDuplicateByNameDob(): void
    {
        $svc = $this->service();
        $data = $svc->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'dob' => '12/03/1988'])['data'];
        $index = ['name_dob' => ['ama|mensah|1988-03-12' => true], 'name_phone' => [], 'national_id' => []];
        $this->assertNotSame('', $svc->resolveDuplicate($data, $index));
    }

    public function testPhoneAloneIsNotDuplicate(): void
    {
        $svc = $this->service();
        $data = $svc->normalizeRow(['fname' => 'Kojo', 'lname' => 'Mensah', 'sex' => 'M', 'dob' => '01/01/2015', 'phone' => '0244123456'])['data'];
        // Same phone in the clinic (a parent) but different name+dob and no name_phone entry for THIS name.
        $index = ['name_dob' => ['ama|mensah|1988-03-12' => true], 'name_phone' => ['ama|mensah|0244123456' => true], 'national_id' => []];
        $this->assertSame('', $svc->resolveDuplicate($data, $index));
    }

    public function testDuplicateByNationalId(): void
    {
        $svc = $this->service();
        $data = $svc->normalizeRow(['fname' => 'Ama', 'lname' => 'Owusu', 'sex' => 'F', 'dob' => '02/02/1990', 'national_id' => 'GHA-1'])['data'];
        $index = ['name_dob' => [], 'name_phone' => [], 'national_id' => ['GHA-1' => true]];
        $this->assertNotSame('', $svc->resolveDuplicate($data, $index));
    }

    public function testOverlongNameFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => str_repeat('A', 81), 'lname' => 'Mensah', 'dob' => '12/03/1988']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('too long', strtolower($r['reason']));
    }

    public function testOverlongOldClinicNumberFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/1988', 'old_clinic_number' => str_repeat('X', 41)]);
        $this->assertFalse($r['ok']);
    }

    public function testOverlongNationalIdFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/1988', 'national_id' => str_repeat('Y', 41)]);
        $this->assertFalse($r['ok']);
    }

    public function testStreetIsTruncatedTo255(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'dob' => '12/03/1988', 'street' => str_repeat('Z', 300)]);
        $this->assertTrue($r['ok']);
        $this->assertSame(255, mb_strlen($r['data']['street']));
        $this->assertStringContainsString('Z', $r['data']['street']);
    }

    public function testChunkTooLargeThrows(): void
    {
        $rows = array_fill(0, PatientImportService::MAX_CHUNK_ROWS + 1, ['row_number' => 2, 'fname' => 'A', 'lname' => 'Bb', 'dob' => '01/01/2000']);
        $this->expectException(\InvalidArgumentException::class);
        $this->service()->processChunk($rows, true, 1, 3);
    }

    /**
     * A row-level insert failure (e.g. a transient DB error on one row) must not
     * abort the whole chunk: earlier successes stay committed, the failing row
     * becomes an 'error' result, and later rows still get a chance to import.
     */
    public function testInsertFailureDoesNotAbortChunk(): void
    {
        $config = new class extends ClinicConfigService {
            public function get(string $key, ?string $default = null, int $facilityId = 0): ?string
            {
                return $default;
            }
        };

        $svc = new class (config: $config) extends PatientImportService {
            protected function buildDuplicateIndex(): array
            {
                // Keep this test DB-free: no real patient_data query.
                return ['name_dob' => [], 'name_phone' => [], 'national_id' => []];
            }

            protected function insertPatient(array $d, int $facilityId): int
            {
                // Keep this test DB-free: no real PatientService::insert call.
                if ($d['lname'] === 'Failme') {
                    throw new \RuntimeException('simulated database failure');
                }

                return 999;
            }

            protected function logChunkAudit(int $actorUserId, array $summary): void
            {
                // Keep this test DB-free: EventAuditLogger::recordLogItem() has no
                // enable_auditlog gate and would otherwise write a real row into the
                // `log` table via the live DB connection the test bootstrap opens.
            }
        };

        $rows = [
            ['row_number' => 2, 'fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'dob' => '01/01/2000'],
            ['row_number' => 3, 'fname' => 'Kojo', 'lname' => 'Failme', 'sex' => 'M', 'dob' => '02/02/2001'],
            ['row_number' => 4, 'fname' => 'Efua', 'lname' => 'Boateng', 'sex' => 'F', 'dob' => '03/03/2002'],
        ];

        $out = $svc->processChunk($rows, false, 1, 0);

        $this->assertSame(['processed' => 3, 'ok' => 2, 'duplicates' => 0, 'errors' => 1], $out['summary']);

        $this->assertSame('imported', $out['results'][0]['status']);
        $this->assertSame(999, $out['results'][0]['pid']);

        // Per the audit amendment (Task D), a raw SQL/DB exception message is never
        // shown to the user — only a generic, safe reason. The real message goes to
        // error_log() instead (see testDbFailureReasonIsLoggedNotShown).
        $this->assertSame('error', $out['results'][1]['status']);
        $this->assertStringNotContainsString('simulated database failure', $out['results'][1]['reason']);
        $this->assertStringContainsString('Could not save this patient', $out['results'][1]['reason']);
        $this->assertNull($out['results'][1]['pid']);

        $this->assertSame('imported', $out['results'][2]['status']);
        $this->assertSame(999, $out['results'][2]['pid']);
    }

    /**
     * Task D: the raw exception message must not leak to the user for a generic
     * save failure — it belongs in the server log, tagged with the row number,
     * so support can diagnose it without exposing internals in the UI.
     */
    public function testDbFailureReasonIsLoggedNotShown(): void
    {
        $config = new class extends ClinicConfigService {
            public function get(string $key, ?string $default = null, int $facilityId = 0): ?string
            {
                return $default;
            }
        };

        $svc = new class (config: $config) extends PatientImportService {
            protected function buildDuplicateIndex(): array
            {
                return ['name_dob' => [], 'name_phone' => [], 'national_id' => []];
            }

            protected function insertPatient(array $d, int $facilityId): int
            {
                throw new \RuntimeException('secret column mismatch on pid 4471');
            }

            protected function logChunkAudit(int $actorUserId, array $summary): void
            {
            }
        };

        $tmpLog = tempnam(sys_get_temp_dir(), 'nc_import_test_');
        $priorErrorLog = ini_set('error_log', $tmpLog);
        try {
            $out = $svc->processChunk(
                [['row_number' => 7, 'fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'dob' => '01/01/2000']],
                false,
                1,
                0
            );
        } finally {
            ini_set('error_log', $priorErrorLog === false ? '' : $priorErrorLog);
        }

        $this->assertStringNotContainsString('secret column mismatch', $out['results'][0]['reason']);

        $logged = (string) file_get_contents($tmpLog);
        unlink($tmpLog);
        $this->assertStringContainsString('secret column mismatch on pid 4471', $logged);
        $this->assertStringContainsString('7', $logged);
    }

    /**
     * Task D: a *validation*-shaped create failure (e.g. core PatientValidator
     * rejecting the row) is user-actionable, so — unlike a raw SQL error — its
     * message is safe to show as-is, not sanitized away.
     */
    public function testValidationFailureReasonIsShownAsIs(): void
    {
        $config = new class extends ClinicConfigService {
            public function get(string $key, ?string $default = null, int $facilityId = 0): ?string
            {
                return $default;
            }
        };

        $svc = new class (config: $config) extends PatientImportService {
            protected function buildDuplicateIndex(): array
            {
                return ['name_dob' => [], 'name_phone' => [], 'national_id' => []];
            }

            protected function insertPatient(array $d, int $facilityId): int
            {
                throw new \OpenEMR\Modules\NewClinic\Exceptions\PatientImportValidationException(
                    'Could not create patient (sex: Sex is required)'
                );
            }

            protected function logChunkAudit(int $actorUserId, array $summary): void
            {
            }
        };

        $out = $svc->processChunk(
            [['row_number' => 5, 'fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F', 'dob' => '01/01/2000']],
            false,
            1,
            0
        );

        $this->assertSame('Could not create patient (sex: Sex is required)', $out['results'][0]['reason']);
    }

    /**
     * Circuit breaker (Task C): 10 consecutive insert failures stop the whole
     * chunk rather than silently grinding through hundreds of doomed rows (e.g. a
     * full DB outage mid-import). The counter must reset on any success.
     */
    public function testCircuitBreakerStopsAfterTenConsecutiveFailures(): void
    {
        $config = new class extends ClinicConfigService {
            public function get(string $key, ?string $default = null, int $facilityId = 0): ?string
            {
                return $default;
            }
        };

        $svc = new class (config: $config) extends PatientImportService {
            protected function buildDuplicateIndex(): array
            {
                return ['name_dob' => [], 'name_phone' => [], 'national_id' => []];
            }

            protected function insertPatient(array $d, int $facilityId): int
            {
                throw new \RuntimeException('simulated outage');
            }

            protected function logChunkAudit(int $actorUserId, array $summary): void
            {
            }
        };

        $rows = [];
        for ($i = 0; $i < 15; $i++) {
            $rows[] = ['row_number' => $i + 2, 'fname' => 'Patient', 'lname' => 'Number' . $i, 'sex' => 'F', 'dob' => '01/01/2000'];
        }

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Import stopped after repeated save failures — fix the reported rows and re-run');
        $svc->processChunk($rows, false, 1, 0);
    }

    /**
     * A breaker trip must still emit exactly one audit event for the counts
     * accumulated so far — otherwise a chunk that trips after a partial run of
     * real successes leaves no audit trail for what was actually committed.
     */
    public function testCircuitBreakerTripStillLogsAuditWithAccumulatedCounts(): void
    {
        $config = new class extends ClinicConfigService {
            public function get(string $key, ?string $default = null, int $facilityId = 0): ?string
            {
                return $default;
            }
        };

        $svc = new class (config: $config) extends PatientImportService {
            /** @var list<array<string, int>> */
            public array $auditCalls = [];

            protected function buildDuplicateIndex(): array
            {
                return ['name_dob' => [], 'name_phone' => [], 'national_id' => []];
            }

            protected function insertPatient(array $d, int $facilityId): int
            {
                if ($d['lname'] === 'Ok') {
                    return 999;
                }
                throw new \RuntimeException('simulated outage');
            }

            protected function logChunkAudit(int $actorUserId, array $summary): void
            {
                $this->auditCalls[] = $summary;
            }
        };

        // Two real successes, then 10 consecutive failures to trip the breaker.
        $rows = [
            ['row_number' => 2, 'fname' => 'Patient', 'lname' => 'Ok', 'sex' => 'F', 'dob' => '01/01/2000'],
            ['row_number' => 3, 'fname' => 'Patient', 'lname' => 'Ok', 'sex' => 'F', 'dob' => '01/01/2001'],
        ];
        for ($i = 0; $i < 10; $i++) {
            $rows[] = ['row_number' => $i + 4, 'fname' => 'Patient', 'lname' => 'Fail' . $i, 'sex' => 'F', 'dob' => '01/01/2000'];
        }

        try {
            $svc->processChunk($rows, false, 1, 0);
            $this->fail('Expected a RuntimeException after 10 consecutive failures');
        } catch (\RuntimeException $e) {
            $this->assertSame('Import stopped after repeated save failures — fix the reported rows and re-run', $e->getMessage());
        }

        // Exactly one audit call — the breaker throw must not also hit the
        // normal post-loop audit call (the exception exits processChunk first).
        $this->assertCount(1, $svc->auditCalls);
        $this->assertSame(
            ['processed' => 12, 'ok' => 2, 'duplicates' => 0, 'errors' => 10],
            $svc->auditCalls[0]
        );
    }

    public function testCircuitBreakerProcessesExactlyTenErrorRowsBeforeStopping(): void
    {
        $config = new class extends ClinicConfigService {
            public function get(string $key, ?string $default = null, int $facilityId = 0): ?string
            {
                return $default;
            }
        };

        $svc = new class (config: $config) extends PatientImportService {
            public int $insertAttempts = 0;

            protected function buildDuplicateIndex(): array
            {
                return ['name_dob' => [], 'name_phone' => [], 'national_id' => []];
            }

            protected function insertPatient(array $d, int $facilityId): int
            {
                $this->insertAttempts++;
                throw new \RuntimeException('simulated outage');
            }

            protected function logChunkAudit(int $actorUserId, array $summary): void
            {
            }
        };

        $rows = [];
        for ($i = 0; $i < 15; $i++) {
            $rows[] = ['row_number' => $i + 2, 'fname' => 'Patient', 'lname' => 'Number' . $i, 'sex' => 'F', 'dob' => '01/01/2000'];
        }

        try {
            $svc->processChunk($rows, false, 1, 0);
            $this->fail('Expected a RuntimeException after 10 consecutive failures');
        } catch (\RuntimeException $e) {
            $this->assertSame('Import stopped after repeated save failures — fix the reported rows and re-run', $e->getMessage());
        }

        // Exactly 10 rows were attempted (and thus turned into 'error' results
        // inside the loop) before the breaker tripped — rows 11-15 never ran.
        $this->assertSame(10, $svc->insertAttempts);
    }
}

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
        $r = $this->service()->normalizeRow(['fname' => 'K', 'lname' => 'Boateng', 'dob' => '1975-11-02']);
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

    public function testNeedsDobOrPhone(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('date of birth or a phone', $r['reason']);
    }

    public function testBadDateFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '31/02/1990']);
        $this->assertFalse($r['ok']);
    }

    public function testTwoDigitYearFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/88']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('4-digit', $r['reason']);
    }

    public function testFutureDateFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/2099']);
        $this->assertFalse($r['ok']);
    }

    public function testUnknownSexFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/1988', 'sex' => 'X']);
        $this->assertFalse($r['ok']);
    }

    public function testBlankSexAllowed(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/1988', 'sex' => '']);
        $this->assertTrue($r['ok']);
        $this->assertSame('', $r['data']['sex']);
    }

    public function testInvalidPhoneFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'phone' => '12345']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('phone', strtolower($r['reason']));
    }

    public function testDuplicateByNameDob(): void
    {
        $svc = $this->service();
        $data = $svc->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/1988'])['data'];
        $index = ['name_dob' => ['ama|mensah|1988-03-12' => true], 'name_phone' => [], 'national_id' => []];
        $this->assertNotSame('', $svc->resolveDuplicate($data, $index));
    }

    public function testPhoneAloneIsNotDuplicate(): void
    {
        $svc = $this->service();
        $data = $svc->normalizeRow(['fname' => 'Kojo', 'lname' => 'Mensah', 'dob' => '01/01/2015', 'phone' => '0244123456'])['data'];
        // Same phone in the clinic (a parent) but different name+dob and no name_phone entry for THIS name.
        $index = ['name_dob' => ['ama|mensah|1988-03-12' => true], 'name_phone' => ['ama|mensah|0244123456' => true], 'national_id' => []];
        $this->assertSame('', $svc->resolveDuplicate($data, $index));
    }

    public function testDuplicateByNationalId(): void
    {
        $svc = $this->service();
        $data = $svc->normalizeRow(['fname' => 'Ama', 'lname' => 'Owusu', 'dob' => '02/02/1990', 'national_id' => 'GHA-1'])['data'];
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
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/1988', 'street' => str_repeat('Z', 300)]);
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
            ['row_number' => 2, 'fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '01/01/2000'],
            ['row_number' => 3, 'fname' => 'Kojo', 'lname' => 'Failme', 'dob' => '02/02/2001'],
            ['row_number' => 4, 'fname' => 'Efua', 'lname' => 'Boateng', 'dob' => '03/03/2002'],
        ];

        $out = $svc->processChunk($rows, false, 1, 0);

        $this->assertSame(['processed' => 3, 'ok' => 2, 'duplicates' => 0, 'errors' => 1], $out['summary']);

        $this->assertSame('imported', $out['results'][0]['status']);
        $this->assertSame(999, $out['results'][0]['pid']);

        $this->assertSame('error', $out['results'][1]['status']);
        $this->assertStringContainsString('simulated database failure', $out['results'][1]['reason']);
        $this->assertNull($out['results'][1]['pid']);

        $this->assertSame('imported', $out['results'][2]['status']);
        $this->assertSame(999, $out['results'][2]['pid']);
    }
}

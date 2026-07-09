<?php

/**
 * Integration tests for phone_normalized backfill cron (AUDIT-15)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\PhoneBackfillService;
use OpenEMR\Modules\NewClinic\Services\PhoneNormalizer;
use OpenEMR\Services\PatientService;
use PHPUnit\Framework\TestCase;

class PhoneBackfillServiceTest extends TestCase
{
    public function testZeroLimitBatchIsANoop(): void
    {
        $this->assertSame(0, (new PhoneBackfillService())->runBatch(0));
    }

    public function testBatchNormalizesCellPhoneForPatientMissingNormalizedValue(): void
    {
        $created = (new PatientService())->insert([
            'fname' => 'BackfillTest',
            'lname' => 'Fixture' . substr(uniqid(), -6),
            'sex' => 'Female',
            'DOB' => '1990-01-01',
            'phone_cell' => '024 412 3456',
        ]);
        $pid = (int) ($created->getData()[0]['pid'] ?? 0);
        if ($pid <= 0) {
            $this->markTestSkipped('Could not create patient fixture');
        }

        try {
            QueryUtils::sqlStatementThrowException(
                "UPDATE patient_data SET phone_normalized = '' WHERE pid = ?",
                [$pid]
            );

            $updated = (new PhoneBackfillService())->runBatch(5000);
            $this->assertGreaterThanOrEqual(1, $updated);

            $row = QueryUtils::querySingleRow(
                'SELECT phone_normalized FROM patient_data WHERE pid = ?',
                [$pid]
            );
            $expected = (new PhoneNormalizer())->normalize('024 412 3456');

            $this->assertSame($expected, (string) ($row['phone_normalized'] ?? ''));
            $this->assertNotSame('', (string) ($row['phone_normalized'] ?? ''));
        } finally {
            QueryUtils::sqlStatementThrowException(
                'DELETE FROM patient_data WHERE pid = ?',
                [$pid]
            );
        }
    }
}

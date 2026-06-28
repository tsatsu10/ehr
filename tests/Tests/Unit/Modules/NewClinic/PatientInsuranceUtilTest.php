<?php

/**
 * Unit tests for patient insurance helpers (M1b §8)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PatientInsuranceUtil;
use PHPUnit\Framework\TestCase;

class PatientInsuranceUtilTest extends TestCase
{
    public function testExpiredNhisTreatedAsCash(): void
    {
        $meta = [
            'insurance_type' => 'nhis',
            'nhis_number' => 'GHA-123',
            'nhis_expiry' => '2020-01-01',
        ];

        $this->assertSame('cash', PatientInsuranceUtil::effectiveType($meta));
        $this->assertSame('Cash (NHIS expired)', PatientInsuranceUtil::displayLabel($meta));
    }

    public function testActiveNhisRemainsNhis(): void
    {
        $meta = [
            'insurance_type' => 'nhis',
            'nhis_number' => 'GHA-123',
            'nhis_expiry' => '2099-12-31',
        ];

        $this->assertSame('nhis', PatientInsuranceUtil::effectiveType($meta));
        $this->assertSame('NHIS', PatientInsuranceUtil::displayLabel($meta));
    }
}

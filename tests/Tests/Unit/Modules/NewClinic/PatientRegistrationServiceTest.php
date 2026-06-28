<?php

/**
 * Unit tests for patient registration meta persistence
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PatientRegistrationService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class PatientRegistrationServiceTest extends TestCase
{
    public function testCoerceMetaColumnValueAppliesNotNullDefaults(): void
    {
        $method = new ReflectionMethod(PatientRegistrationService::class, 'coerceMetaColumnValue');
        $service = new PatientRegistrationService();

        $this->assertSame(0, $method->invoke($service, 'disability_flag', null));
        $this->assertSame(0, $method->invoke($service, 'dob_estimated', null));
        $this->assertSame('cash', $method->invoke($service, 'insurance_type', null));
        $this->assertSame(1, $method->invoke($service, 'disability_flag', 1));
        $this->assertNull($method->invoke($service, 'blood_group', null));
    }
}

<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Exceptions\AllergiesUndocumentedException;
use OpenEMR\Modules\NewClinic\Services\AllergyGateService;
use OpenEMR\Modules\NewClinic\Services\PatientCompletionService;
use PHPUnit\Framework\TestCase;

class AllergyGateServiceTest extends TestCase
{
    public function testAssertDocumentedThrowsWhenAllergiesUndocumented(): void
    {
        $completion = $this->createMock(PatientCompletionService::class);
        $completion->method('hasAllergyDocumentationForPatient')->willReturn(false);
        $service = new AllergyGateService($completion);

        $this->assertFalse($service->isDocumented(42));

        $this->expectException(AllergiesUndocumentedException::class);
        $service->assertDocumented(42);
    }

    public function testAssertDocumentedPassesWhenDocumented(): void
    {
        $completion = $this->createMock(PatientCompletionService::class);
        $completion->method('hasAllergyDocumentationForPatient')->willReturn(true);
        $service = new AllergyGateService($completion);

        $service->assertDocumented(42);

        $this->assertTrue($service->isDocumented(42));
    }
}

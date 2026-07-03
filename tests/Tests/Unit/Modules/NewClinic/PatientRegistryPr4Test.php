<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\PatientCohortSearchService;
use PHPUnit\Framework\TestCase;

class PatientRegistryPr4Test extends TestCase
{
    public function testExplainCriteriaIncludesAllergyMedicationFilters(): void
    {
        $service = new PatientCohortSearchService();
        $summary = $service->explainCriteria([
            'allergy_substance_contains' => 'penicillin',
            'medication_contains' => 'amoxicillin',
        ]);

        $this->assertStringContainsString('Allergy contains "penicillin"', $summary);
        $this->assertStringContainsString('Medication contains "amoxicillin"', $summary);
    }

    public function testExplainCriteriaIncludesCommunicationsFilters(): void
    {
        $service = new PatientCohortSearchService();
        $summary = $service->explainCriteria([
            'unread_staff_message' => 'yes',
            'open_dated_reminder' => 'no',
        ]);

        $this->assertStringContainsString('Unread staff message for me', $summary);
        $this->assertStringContainsString('No open dated reminder for me', $summary);
    }
}

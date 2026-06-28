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

class PatientRegistryPr3Test extends TestCase
{
    public function testConfirmationSourcesIncludeLabPositive(): void
    {
        $this->assertContains('lab_positive', PatientCohortSearchService::CONFIRMATION_SOURCES);
    }

    public function testPresetsIncludeMalariaLabBuiltin(): void
    {
        $service = new PatientCohortSearchService();
        $presets = $service->presets();
        $ids = array_column($presets['builtins'], 'id');

        $this->assertContains('malaria_lab', $ids);
        $malariaLab = array_values(array_filter(
            $presets['builtins'],
            static fn (array $p) => $p['id'] === 'malaria_lab'
        ));
        $this->assertNotEmpty($malariaLab);
        $this->assertSame('lab_positive', $malariaLab[0]['filters']['confirmation_source'] ?? null);
        $this->assertSame('malaria', $malariaLab[0]['filters']['condition_key'] ?? null);
    }

    public function testExplainCriteriaIncludesLabTestFilter(): void
    {
        $service = new PatientCohortSearchService();
        $summary = $service->explainCriteria([
            'lab_test_contains' => 'RDT',
            'confirmation_source' => 'lab_positive',
        ]);

        $this->assertStringContainsString('Lab test contains', $summary);
        $this->assertStringContainsString('Confirmation: lab_positive', $summary);
    }

    public function testPresetsExposeSavedFiltersArray(): void
    {
        $service = new PatientCohortSearchService();
        $presets = $service->presets();

        $this->assertArrayHasKey('saved', $presets);
        $this->assertIsArray($presets['saved']);
        $this->assertArrayHasKey('can_share_filter', $presets);
    }
}

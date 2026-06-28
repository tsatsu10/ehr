<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\MainMenuRestrictService;
use OpenEMR\Modules\NewClinic\Services\PatientCohortSearchService;
use PHPUnit\Framework\TestCase;

class PatientRegistryPr2Test extends TestCase
{
    public function testFilterMainMenuRemovesHiddenIds(): void
    {
        $service = new MainMenuRestrictService();
        $finder = (object) ['menu_id' => 'fin0', 'label' => 'Finder'];
        $other = (object) ['menu_id' => 'patimg', 'label' => 'Patients', 'children' => [
            (object) ['menu_id' => 'fin0', 'label' => 'Nested Finder'],
            (object) ['menu_id' => 'dem1', 'label' => 'Demographics'],
        ]];

        $filtered = $service->filterMainMenu([$finder, $other], ['fin0']);

        $this->assertCount(1, $filtered);
        $this->assertSame('patimg', $filtered[0]->menu_id);
        $this->assertCount(1, $filtered[0]->children);
        $this->assertSame('dem1', $filtered[0]->children[0]->menu_id);
    }

    public function testExplainCriteriaIncludesVisitFilters(): void
    {
        $service = new PatientCohortSearchService();
        $summary = $service->explainCriteria([
            'visit_states' => ['ready_for_doctor'],
            'visit_date_from' => '2026-06-25',
            'visit_date_to' => '2026-06-25',
            'payment_status' => 'outstanding',
            'last_visit_to' => '2026-01-01',
        ]);

        $this->assertStringContainsString('Visit state: ready_for_doctor', $summary);
        $this->assertStringContainsString('Visit dates', $summary);
        $this->assertStringContainsString('Payment: outstanding', $summary);
        $this->assertStringContainsString('Last visit', $summary);
    }

    public function testPresetsIncludePr2Builtins(): void
    {
        $service = new PatientCohortSearchService();
        $presets = $service->presets();
        $ids = array_column($presets['builtins'], 'id');

        $this->assertContains('ready_for_doctor_today', $ids);
        $this->assertContains('lost_to_followup', $ids);
        $this->assertContains('my_patients_in_clinic', $ids);
        $this->assertContains('malaria_active', $ids);
        $this->assertContains('adolescents', $ids);
        $this->assertContains('recall_overdue', $ids);
        $this->assertContains('ready_for_doctor', $presets['visit_states']);
        $this->assertNotEmpty($presets['confirmation_sources']);
        $malaria = array_values(array_filter($presets['builtins'], static fn (array $p) => $p['id'] === 'malaria_active'));
        $this->assertNotEmpty($malaria);
        $this->assertSame('malaria', $malaria[0]['filters']['condition_key'] ?? null);
        $ready = array_values(array_filter($presets['builtins'], static fn (array $p) => $p['id'] === 'lost_to_followup'));
        $this->assertNotEmpty($ready);
        $this->assertSame('active_only', $ready[0]['filters']['record_status'] ?? null);
    }

    public function testExplainCriteriaIncludesClinicalFilters(): void
    {
        $service = new PatientCohortSearchService();
        $summary = $service->explainCriteria([
            'problem_title_contains' => 'malaria',
            'icd_prefix' => 'B50',
            'confirmation_source' => 'problem_active',
            'national_id' => 'GHA',
            'nhis_number' => '12345',
            'visit_type_id' => 2,
            'my_provider_today' => true,
        ]);

        $this->assertStringContainsString('Problem contains', $summary);
        $this->assertStringContainsString('ICD prefix B50', $summary);
        $this->assertStringContainsString('Confirmation: problem_active', $summary);
        $this->assertStringContainsString('National ID', $summary);
        $this->assertStringContainsString('NHIS', $summary);
        $this->assertStringContainsString('Visit type id 2', $summary);
        $this->assertStringContainsString('My patients in clinic today', $summary);
    }

    public function testExplainCriteriaIncludesSchedulingFilters(): void
    {
        $service = new PatientCohortSearchService();
        $summary = $service->explainCriteria([
            'appointment_today' => 'yes',
            'recall_due' => 'overdue',
            'condition_key' => 'malaria',
            'age_at_diagnosis_min' => 12,
            'age_at_diagnosis_max' => 19,
        ]);

        $this->assertStringContainsString('Appointment today', $summary);
        $this->assertStringContainsString('Recall: overdue', $summary);
        $this->assertStringContainsString('Condition: malaria', $summary);
        $this->assertStringContainsString('Age at diagnosis ≥ 12', $summary);
        $this->assertStringContainsString('Age at diagnosis ≤ 19', $summary);
    }
}

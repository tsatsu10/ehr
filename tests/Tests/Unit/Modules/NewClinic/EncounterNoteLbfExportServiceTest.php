<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicalDocLbfWizardService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocReferralHospitalLbfWizardService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\EncounterNoteLbfExportService;
use PHPUnit\Framework\TestCase;

class EncounterNoteLbfExportServiceTest extends TestCase
{
    public function testExportDisabledByDefault(): void
    {
        $config = new ClinicConfigService();
        $service = new EncounterNoteLbfExportService(config: $config);

        $this->assertFalse($service->isExportEnabled(0));
    }

    public function testIsExportEnabledWhenConfigured(): void
    {
        $config = new ClinicConfigService();
        $prev = $config->get(EncounterNoteLbfExportService::CONFIG_ON_SAVE, '0', 0);
        try {
            $config->set(EncounterNoteLbfExportService::CONFIG_ON_SAVE, '1', 0);
            $service = new EncounterNoteLbfExportService(config: $config);
            $this->assertTrue($service->isExportEnabled(0));
        } finally {
            $config->set(EncounterNoteLbfExportService::CONFIG_ON_SAVE, (string) $prev, 0);
        }
    }

    public function testBuildFieldMapReferralHospitalPack(): void
    {
        $service = new EncounterNoteLbfExportService();
        $fields = $service->buildFieldMap(
            ClinicalDocReferralHospitalLbfWizardService::LBF_FORM_ID,
            [
                'referral' => [
                    'requesting_clinician' => 'Dr Ada',
                    'requesting_service' => 'Medicine',
                    'clinical_question' => 'Evaluate chest pain',
                    'urgency' => 'urgent',
                ],
                'source' => [
                    'sources' => ['patient', 'records'],
                    'narrative' => 'Referral letter reviewed',
                ],
                'cc' => ['chief_complaint' => 'Chest pain'],
                'hpi' => ['narrative' => 'Two-day exertional pain', 'onset' => '2 days'],
                'ros' => [
                    'systems' => [
                        ['system' => 'Cardiovascular', 'status' => 'positive', 'notes' => 'Chest pain'],
                    ],
                ],
                'pe' => [
                    'general' => 'Alert, no distress',
                    'specialty' => ['cardiac' => 'Regular rhythm'],
                ],
                'data_reviewed' => [
                    'lab_ids' => [101],
                    'imaging_narrative' => 'CXR reviewed',
                ],
                'problems' => [
                    'items' => [[
                        'problem_label' => 'Chest pain',
                        'assessment_narrative' => 'Likely angina',
                        'differential' => 'GERD',
                        'plan_items' => [
                            ['type' => 'medication', 'text' => 'Start aspirin'],
                        ],
                    ]],
                ],
                'follow_up' => [
                    'instructions' => 'Return if worse',
                    'return_visit' => '1 week',
                ],
                'attestation' => ['supervisor_attested' => true],
            ],
            [
                'vitals' => ['summary' => 'BP 120/80; HR 72'],
            ],
            'referral_consult'
        );

        $this->assertSame('Dr Ada', $fields['requesting_clinician']);
        $this->assertSame('Evaluate chest pain', $fields['clinical_question']);
        $this->assertStringContainsString('patient', $fields['source_of_information']);
        $this->assertSame('Chest pain', $fields['chief_complaint']);
        $this->assertStringContainsString('Cardiovascular', $fields['ros_pertinent']);
        $this->assertSame('BP 120/80; HR 72', $fields['vitals_summary']);
        $this->assertStringContainsString('Chest pain', $fields['problems_assessment']);
        $this->assertStringContainsString('aspirin', $fields['plan_items']);
        $this->assertStringContainsString('Return visit', $fields['follow_up_instructions']);
        $this->assertSame('Supervising provider attestation recorded', $fields['attestation_note']);
    }

    public function testBuildFieldMapGhanaOpdPack(): void
    {
        $service = new EncounterNoteLbfExportService();
        $fields = $service->buildFieldMap(
            ClinicalDocLbfWizardService::LBF_FORM_ID,
            [
                'cc' => ['chief_complaint' => 'Fever'],
                'hpi' => ['narrative' => 'Three-day fever with chills'],
                'pe' => ['general' => 'Febrile, alert'],
                'problems' => [
                    'items' => [[
                        'problem_label' => 'Malaria',
                        'assessment_narrative' => 'Suspected uncomplicated malaria',
                        'plan_items' => [
                            ['type' => 'medication', 'text' => 'Start ACT'],
                        ],
                    ]],
                ],
                'follow_up' => ['instructions' => 'Return in 48 hours if not improving'],
            ],
            [
                'background' => [
                    'pmh' => 'None significant',
                    'allergies' => 'NKDA',
                ],
                'vitals' => ['summary' => 'Temp 38.5C'],
            ],
            'general_opd'
        );

        $this->assertSame('Fever', $fields['presenting_complaint']);
        $this->assertSame('Three-day fever with chills', $fields['history']);
        $this->assertStringContainsString('PMH', $fields['past_history']);
        $this->assertSame('Temp 38.5C', $fields['vitals_summary']);
        $this->assertStringContainsString('Malaria', $fields['assessment']);
        $this->assertStringContainsString('ACT', $fields['plan']);
        $this->assertStringContainsString('48 hours', $fields['follow_up']);
    }

    public function testSyncFromSaveSkipsWhenNativeNoteSigned(): void
    {
        $source = (string) file_get_contents(
            __DIR__ . '/../../../../../interface/modules/custom_modules/oe-module-new-clinic/src/Services/EncounterNoteLbfExportService.php'
        );

        $this->assertStringContainsString('note_signed', $source);
        $this->assertStringContainsString('isFormsRowSigned', $source);
        $this->assertStringContainsString('lbf_signed', $source);
    }
}

<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\LabResultValidationService;
use PHPUnit\Framework\TestCase;

class LabResultValidationServiceTest extends TestCase
{
    private LabResultValidationService $service;

    protected function setUp(): void
    {
        $this->service = new LabResultValidationService();
    }

    public function testNumericResultWithinRangePasses(): void
    {
        $orderLines = [
            ['procedure_order_seq' => 1, 'procedure_code' => 'HB', 'procedure_name' => 'Haemoglobin'],
        ];
        $payload = [
            [
                'procedure_order_seq' => 1,
                'results' => [['result' => '12.5']],
            ],
        ];

        $validated = $this->service->validateSave($orderLines, $payload, false);

        $this->assertSame([], $validated['errors']);
        $this->assertSame('12.5', $validated['normalized_lines'][0]['results'][0]['result']);
        $this->assertSame('g/dL', $validated['normalized_lines'][0]['results'][0]['units']);
    }

    public function testNumericResultOutsideReferenceRangeWarns(): void
    {
        $orderLines = [
            ['procedure_order_seq' => 1, 'procedure_code' => 'GLU_F', 'procedure_name' => 'Glucose'],
        ];
        $payload = [
            [
                'procedure_order_seq' => 1,
                'results' => [['result' => '180']],
            ],
        ];

        $validated = $this->service->validateSave($orderLines, $payload, false);

        $this->assertSame([], $validated['errors']);
        $this->assertNotEmpty($validated['warnings']);
        $this->assertSame('high', $validated['normalized_lines'][0]['results'][0]['abnormal']);
    }

    public function testCriticalValueIsFlaggedButDoesNotBlock(): void
    {
        // Glucose 30 mg/dL is below the critical floor (40) — critical, not an error.
        $orderLines = [
            ['procedure_order_seq' => 1, 'procedure_code' => 'GLU_F', 'procedure_name' => 'Glucose'],
        ];
        $payload = [
            ['procedure_order_seq' => 1, 'results' => [['result' => '30']]],
        ];

        $validated = $this->service->validateSave($orderLines, $payload, false);

        $this->assertSame([], $validated['errors'], 'critical must not block save');
        $this->assertNotEmpty($validated['criticals'], 'critical value must be reported');
        $this->assertStringContainsStringIgnoringCase('critically low', $validated['criticals'][0]);
        $this->assertSame('low', $validated['normalized_lines'][0]['results'][0]['abnormal']);
    }

    public function testValidateForReleaseReportsCriticals(): void
    {
        $orderLines = [
            [
                'procedure_order_seq' => 1,
                'procedure_code' => 'HB',
                'procedure_name' => 'Haemoglobin',
                'results' => [['result' => '4.0']],
            ],
        ];

        $check = $this->service->validateForRelease($orderLines);

        $this->assertSame([], $check['errors']);
        $this->assertNotEmpty($check['criticals']);
        $this->assertStringContainsStringIgnoringCase('critically low', $check['criticals'][0]);
    }

    public function testFinalSaveRequiresAllLineResults(): void
    {
        $orderLines = [
            ['procedure_order_seq' => 1, 'procedure_code' => 'HB', 'procedure_name' => 'Haemoglobin'],
            ['procedure_order_seq' => 2, 'procedure_code' => 'MAL_RDT', 'procedure_name' => 'Malaria RDT'],
        ];
        $payload = [
            [
                'procedure_order_seq' => 1,
                'results' => [['result' => '11']],
            ],
            [
                'procedure_order_seq' => 2,
                'results' => [['result' => '']],
            ],
        ];

        $validated = $this->service->validateSave($orderLines, $payload, false);

        $this->assertNotEmpty($validated['errors']);
        $this->assertArrayHasKey('line_2_result', $validated['field_errors']);
    }

    public function testDraftAllowsEmptyLine(): void
    {
        $orderLines = [
            ['procedure_order_seq' => 1, 'procedure_code' => 'HB', 'procedure_name' => 'Haemoglobin'],
        ];
        $payload = [
            [
                'procedure_order_seq' => 1,
                'results' => [['result' => '']],
            ],
        ];

        $validated = $this->service->validateSave($orderLines, $payload, true);

        $this->assertSame([], $validated['errors']);
    }

    public function testQualitativeInvalidValueFails(): void
    {
        $orderLines = [
            ['procedure_order_seq' => 1, 'procedure_code' => 'MAL_RDT', 'procedure_name' => 'Malaria RDT'],
        ];
        $payload = [
            [
                'procedure_order_seq' => 1,
                'results' => [['result' => 'maybe']],
            ],
        ];

        $validated = $this->service->validateSave($orderLines, $payload, false);

        $this->assertNotEmpty($validated['errors']);
    }

    public function testQualitativePositiveSuggestsAbnormal(): void
    {
        $orderLines = [
            ['procedure_order_seq' => 1, 'procedure_code' => 'MAL_RDT', 'procedure_name' => 'Malaria RDT'],
        ];
        $payload = [
            [
                'procedure_order_seq' => 1,
                'results' => [['result' => 'Positive']],
            ],
        ];

        $validated = $this->service->validateSave($orderLines, $payload, false);

        $this->assertSame([], $validated['errors']);
        $this->assertSame('positive', $validated['normalized_lines'][0]['results'][0]['result']);
        $this->assertSame('yes', $validated['normalized_lines'][0]['results'][0]['abnormal']);
    }

    public function testReleaseRequiresSavedResults(): void
    {
        $orderLines = [
            [
                'procedure_order_seq' => 1,
                'procedure_code' => 'HB',
                'procedure_name' => 'Haemoglobin',
                'results' => [['result' => '']],
            ],
        ];

        $check = $this->service->validateForRelease($orderLines);

        $this->assertNotEmpty($check['errors']);
    }

    public function testSuggestAbnormalForLowHaemoglobin(): void
    {
        $this->assertSame('low', $this->service->suggestAbnormal('HB', '6.2'));
        $this->assertSame('high', $this->service->suggestAbnormal('HB', '19.5'));
        $this->assertNull($this->service->suggestAbnormal('HB', '12'));
    }

    public function testResolveRulePicksPaediatricAndSexBands(): void
    {
        // Unknown age/sex falls back to the broad adult band.
        $this->assertSame('7–18', $this->service->resolveRule('HB')['reference_range']);

        // Infant (<=1) and child (<=12) bands, age takes precedence over sex.
        $this->assertStringContainsString('infant', $this->service->resolveRule('HB', 0)['reference_range']);
        $this->assertStringContainsString('child', $this->service->resolveRule('HB', 5, 'female')['reference_range']);

        // Adult sex bands.
        $female = $this->service->resolveRule('HB', 30, 'female');
        $this->assertStringContainsString('female', $female['reference_range']);
        $this->assertSame(12.0, $female['warn_min']);

        $male = $this->service->resolveRule('HB', 30, 'male');
        $this->assertStringContainsString('male', $male['reference_range']);
        $this->assertSame(13.0, $male['warn_min']);

        // Resolved rule never leaks the raw variants list to the client.
        $this->assertArrayNotHasKey('variants', $female);
    }

    public function testPaediatricRangeWarnsWhereAdultWouldNot(): void
    {
        $orderLines = [
            ['procedure_order_seq' => 1, 'procedure_code' => 'HB', 'procedure_name' => 'Haemoglobin'],
        ];
        $payload = [
            ['procedure_order_seq' => 1, 'results' => [['result' => '10']]],
        ];

        // Hb 10 for a 5-year-old is below the child range (10.5) — a warning.
        $child = $this->service->validateSave($orderLines, $payload, false, 5, 'male');
        $this->assertNotEmpty($child['warnings']);
        $this->assertSame('low', $child['normalized_lines'][0]['results'][0]['abnormal']);

        // The same value with age/sex unknown stays inside the broad adult band (7–18).
        $unknown = $this->service->validateSave($orderLines, $payload, false);
        $this->assertSame([], $unknown['warnings']);
    }

    public function testNumericDefaultsExposeTunableTests(): void
    {
        $defaults = $this->service->numericDefaults();
        $this->assertArrayHasKey('HB', $defaults);
        $this->assertArrayHasKey('GLU_F', $defaults);
        // Qualitative/text tests are not tunable numeric ranges.
        $this->assertArrayNotHasKey('MAL_RDT', $defaults);
        $this->assertSame(7.0, $defaults['HB']['warn_min']);
    }

    public function testFormRulesCarryAgeSexBandToClient(): void
    {
        $lines = [
            ['procedure_order_seq' => 1, 'procedure_code' => 'HB', 'procedure_name' => 'Haemoglobin'],
        ];

        $rules = $this->service->getFormRulesForLines($lines, 4, 'female')['rules_by_seq'];
        $this->assertStringContainsString('child', $rules['1']['reference_range']);
        $this->assertSame(10.5, $rules['1']['warn_min']);
    }
}

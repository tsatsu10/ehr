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
}

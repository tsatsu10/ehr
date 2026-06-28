<?php

/**
 * Unit tests for triage vitals validation
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\VitalsValidationService;
use PHPUnit\Framework\TestCase;

class VitalsValidationServiceTest extends TestCase
{
    private VitalsValidationService $service;

    protected function setUp(): void
    {
        $GLOBALS['units_of_measurement'] = 2;
        $this->service = new VitalsValidationService();
    }

    public function testValidVitalsPassValidation(): void
    {
        $result = $this->service->validateForTriage([
            'bps' => 120,
            'bpd' => 80,
            'pulse' => 72,
            'temperature' => 36.8,
            'weight' => 70,
        ]);

        $this->assertEmpty($result['errors']);
        $this->assertSame(36.8, $result['payload']['temperature']);
    }

    public function testMissingRequiredFieldFails(): void
    {
        $result = $this->service->validateForTriage([
            'bps' => 120,
            'bpd' => 80,
            'pulse' => 72,
            'temperature' => 36.8,
        ]);

        $this->assertNotEmpty($result['errors']);
    }

    public function testOutOfRangePulseProducesWarningNotError(): void
    {
        $result = $this->service->validateForTriage([
            'bps' => 120,
            'bpd' => 80,
            'pulse' => 130,
            'temperature' => 36.8,
            'weight' => 70,
        ]);

        $this->assertEmpty($result['errors']);
        $this->assertContains('Pulse outside normal range', $result['warnings']);
    }

    public function testTemperatureStoredInCelsiusWhenMetricPersistence(): void
    {
        $GLOBALS['units_of_measurement'] = 2;
        $service = new VitalsValidationService();
        $stored = $service->normalizeTemperatureForStorage(37.0);

        $this->assertSame(37.0, $stored);
    }

    public function testTemperatureConvertedToFahrenheitWhenUsaPersistence(): void
    {
        $GLOBALS['units_of_measurement'] = 1;
        $service = new VitalsValidationService();
        $stored = $service->normalizeTemperatureForStorage(37.0);

        $this->assertEqualsWithDelta(98.6, $stored, 0.1);
    }

    public function testFormTemperatureUnitLabelIsAlwaysCelsius(): void
    {
        $GLOBALS['units_of_measurement'] = 1;
        $service = new VitalsValidationService();

        $this->assertSame('°C', $service->formTemperatureUnitLabel());
    }

    public function testGetFormRulesIncludesRequiredAndRanges(): void
    {
        $rules = $this->service->getFormRules();

        $this->assertContains('bps', $rules['required']);
        $this->assertArrayHasKey('bps', $rules['fields']);
        $this->assertSame(40, $rules['fields']['bps']['min']);
        $this->assertSame(300, $rules['fields']['bps']['max']);
        $this->assertTrue($rules['fields']['bps']['required']);
    }

    public function testValidateForTriageReturnsFieldErrors(): void
    {
        $result = $this->service->validateForTriage([
            'bps' => 120,
            'bpd' => 80,
            'pulse' => 72,
            'temperature' => 36.8,
        ]);

        $this->assertArrayHasKey('weight', $result['field_errors']);
        $this->assertNotEmpty($result['errors']);
    }

    public function testOutOfRangeValueMapsToFieldError(): void
    {
        $result = $this->service->validateForTriage([
            'bps' => 120,
            'bpd' => 80,
            'pulse' => 999,
            'temperature' => 36.8,
            'weight' => 70,
        ]);

        $this->assertArrayHasKey('pulse', $result['field_errors']);
    }
}

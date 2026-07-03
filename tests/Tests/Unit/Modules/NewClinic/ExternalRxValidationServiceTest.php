<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Exceptions\ExternalRxIncompleteException;
use OpenEMR\Modules\NewClinic\Services\ExternalRxValidationService;
use PHPUnit\Framework\TestCase;

class ExternalRxValidationServiceTest extends TestCase
{
    public function testValidExternalRxFieldsPass(): void
    {
        $result = ExternalRxValidationService::evaluate(
            [
                'prescriber_name' => 'Dr Jane Doe',
                'prescriber_reg_id' => 'MD-12345',
                'rx_date' => '2026-01-15',
            ],
            '2026-07-02',
            730,
            null,
            false
        );

        $this->assertTrue($result['valid']);
        $this->assertSame([], $result['missing']);
    }

    public function testRejectsShortPrescriberName(): void
    {
        $result = ExternalRxValidationService::evaluate(
            [
                'prescriber_name' => 'J',
                'prescriber_reg_id' => 'MD-12345',
                'rx_date' => '2026-01-15',
            ],
            '2026-07-02',
            730,
            null,
            false
        );

        $this->assertFalse($result['valid']);
        $this->assertContains('prescriber_name', $result['missing']);
    }

    public function testRejectsFutureRxDate(): void
    {
        $result = ExternalRxValidationService::evaluate(
            [
                'prescriber_name' => 'Dr Jane Doe',
                'prescriber_reg_id' => 'MD-12345',
                'rx_date' => '2026-12-31',
            ],
            '2026-07-02',
            730,
            null,
            false
        );

        $this->assertFalse($result['valid']);
        $this->assertContains('rx_date', $result['missing']);
        $this->assertArrayHasKey('rx_date', $result['field_errors']);
    }

    public function testRejectsRxDateOlderThanMaxAge(): void
    {
        $result = ExternalRxValidationService::evaluate(
            [
                'prescriber_name' => 'Dr Jane Doe',
                'prescriber_reg_id' => 'MD-12345',
                'rx_date' => '2020-01-01',
            ],
            '2026-07-02',
            730,
            null,
            false
        );

        $this->assertFalse($result['valid']);
        $this->assertContains('rx_date', $result['missing']);
    }

    public function testOverrideAllowsIncompleteFields(): void
    {
        $result = ExternalRxValidationService::evaluate(
            [
                'prescriber_name' => '',
                'prescriber_reg_id' => '',
                'rx_date' => '',
            ],
            '2026-07-02',
            730,
            'Illegible external script on file',
            true
        );

        $this->assertTrue($result['valid']);
        $this->assertTrue($result['override_used']);
    }

    public function testAssertCompleteThrowsWhenIncomplete(): void
    {
        $service = $this->getMockBuilder(ExternalRxValidationService::class)
            ->onlyMethods(['readFieldsFromEncounter', 'maxAgeDays', 'canOverride'])
            ->getMock();
        $service->method('readFieldsFromEncounter')->willReturn([
            'prescriber_name' => '',
            'prescriber_reg_id' => '',
            'rx_date' => '',
        ]);
        $service->method('maxAgeDays')->willReturn(730);
        $service->method('canOverride')->willReturn(false);

        $this->expectException(ExternalRxIncompleteException::class);
        $service->assertComplete(10, 20, 1, null, 99, 5);
    }
}

<?php

/**
 * Unit tests for duplicate scoring helpers (M1b §11)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PatientDuplicateService;
use PHPUnit\Framework\TestCase;

class PatientDuplicateServiceTest extends TestCase
{
    private PatientDuplicateService $service;

    protected function setUp(): void
    {
        $this->service = new PatientDuplicateService();
    }

    public function testEmptyProspectReturnsNoneWithoutQuerying(): void
    {
        $result = $this->service->scoreProspect([]);

        $this->assertSame(0, $result['max_score']);
        $this->assertSame('none', $result['level']);
        $this->assertSame([], $result['candidates']);
    }

    public function testWhitespaceOnlyProspectReturnsNone(): void
    {
        $result = $this->service->scoreProspect([
            'fname' => '   ',
            'lname' => '',
            'phone' => '',
            'DOB' => '',
            'national_id' => '',
        ]);

        $this->assertSame('none', $result['level']);
        $this->assertEmpty($result['candidates']);
    }

    public function testBlockThresholdDefaultIs17(): void
    {
        $this->assertSame(17, $this->service->getBlockThreshold());
    }
}

<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\LabOpsSetupService;
use PHPUnit\Framework\TestCase;

class LabOpsSetupServiceTest extends TestCase
{
    public function testNormalizeSetupModelAcceptsKnownValues(): void
    {
        $this->assertSame(
            LabOpsSetupService::MODEL_IN_HOUSE,
            LabOpsSetupService::normalizeSetupModel('in_house')
        );
        $this->assertSame(
            LabOpsSetupService::MODEL_HYBRID,
            LabOpsSetupService::normalizeSetupModel(' hybrid ')
        );
        $this->assertSame(
            LabOpsSetupService::MODEL_SEND_OUT_ONLY,
            LabOpsSetupService::normalizeSetupModel('SEND_OUT_ONLY')
        );
    }

    public function testNormalizeSetupModelRejectsUnknownValue(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        LabOpsSetupService::normalizeSetupModel('lis_only');
    }
}

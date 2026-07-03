<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Exceptions\VisitNotTakeableException;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitHardAssignService;
use PHPUnit\Framework\TestCase;

class VisitHardAssignServiceTest extends TestCase
{
    public function testAssertCanTakeAllowsMatchingDoctor(): void
    {
        $service = new VisitHardAssignService();
        $visit = [
            'facility_id' => 0,
            'hard_assigned_provider_id' => 5,
        ];

        $service->assertCanTake($visit, 5, null);
        $this->assertTrue(true);
    }

    public function testAssertCanTakeThrowsWhenMismatchWithoutOverride(): void
    {
        $config = new ClinicConfigService();
        $facilityId = 0;
        $previous = $config->get('enable_hard_provider_assignment', '0', $facilityId);
        $config->set('enable_hard_provider_assignment', '1', $facilityId);

        try {
            $service = new VisitHardAssignService();
            $visit = [
                'facility_id' => $facilityId,
                'hard_assigned_provider_id' => 5,
            ];

            $this->expectException(VisitNotTakeableException::class);
            $service->assertCanTake($visit, 9, null);
        } finally {
            $config->set('enable_hard_provider_assignment', (string) $previous, $facilityId);
        }
    }

    public function testIsAssignableStateMatchesFrontDeskContract(): void
    {
        $service = new VisitHardAssignService();
        $this->assertTrue($service->isAssignableState('waiting'));
        $this->assertTrue($service->isAssignableState('in_triage'));
        $this->assertTrue($service->isAssignableState('ready_for_doctor'));
        $this->assertFalse($service->isAssignableState('with_doctor'));
        $this->assertFalse($service->isAssignableState('completed'));
    }
}

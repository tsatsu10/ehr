<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\LabResultsReadinessService;
use PHPUnit\Framework\TestCase;

class LabResultsReadinessServiceTest extends TestCase
{
    public function testEmptyRoutingWhenLabRoleDisabled(): void
    {
        $service = new class extends LabResultsReadinessService {
            public function isLabRoleEnabled(int $facilityId): bool
            {
                return false;
            }
        };

        $routing = $service->getEncounterRouting(1, 10, 1);

        $this->assertFalse($routing['lab_ordered']);
        $this->assertFalse($routing['results_ready']);
        $this->assertFalse($routing['rx_pending']);
    }

    public function testAjaxPolicyRegistersFeeMapActions(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('lab_ops_catalog_acl', $policy->describe('lab_ops.fee_map_list')['type']);
        $this->assertSame('lab_ops_catalog_acl', $policy->describe('lab_ops.fee_map_save')['type']);
    }
}

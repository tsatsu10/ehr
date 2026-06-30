<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\PharmOpsDestroyService;
use PHPUnit\Framework\TestCase;

class PharmOpsDestroyServiceTest extends TestCase
{
    public function testAjaxPolicyMapsDestroyActions(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('pharm_ops_destroy_acl', $policy->describe('pharm_ops.destroy_get')['type']);
        $this->assertSame('pharm_ops_destroy_acl', $policy->describe('pharm_ops.destroy_confirm')['type']);
    }

    public function testClassifyLotExpiryExpiredBeforeToday(): void
    {
        $yesterday = date('Y-m-d', strtotime('-1 day'));

        $this->assertSame(
            PharmOpsDestroyService::LOT_EXPIRED,
            PharmOpsDestroyService::classifyLotExpiry($yesterday, 90)
        );
    }

    public function testClassifyLotExpiryExpiringSoonWithinWarnWindow(): void
    {
        $inThirtyDays = date('Y-m-d', strtotime('+30 days'));

        $this->assertSame(
            PharmOpsDestroyService::LOT_EXPIRING_SOON,
            PharmOpsDestroyService::classifyLotExpiry($inThirtyDays, 90)
        );
    }

    public function testClassifyLotExpiryReturnsNullBeyondWarnWindow(): void
    {
        $inOneYear = date('Y-m-d', strtotime('+365 days'));

        $this->assertNull(PharmOpsDestroyService::classifyLotExpiry($inOneYear, 90));
    }
}

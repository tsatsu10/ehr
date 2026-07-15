<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\PharmOpsAdjustService;
use PHPUnit\Framework\TestCase;

class PharmOpsAdjustServiceTest extends TestCase
{
    public function testAjaxPolicyMapsAdjustToReceiveAcl(): void
    {
        $policy = new AjaxActionPolicy();

        // Adjust writes stock, so it rides the receive ACL, not read-only.
        $this->assertSame('pharm_ops_receive_acl', $policy->describe('pharm_ops.inventory.adjust')['type']);
    }

    /**
     * The ledger sign convention (mirrors PharmOpsReceiveService: a stock-out is
     * stored positive, a stock-in stored negative). Counting FEWER than the system
     * shows is a stock-out → positive; counting MORE is a stock-in → negative.
     */
    public function testAdjustmentQuantityStoresAShortfallAsPositive(): void
    {
        // System says 50, counted 40 → 10 fewer on the shelf → +10 stored.
        $this->assertSame(10, PharmOpsAdjustService::adjustmentQuantity(50, 40));
    }

    public function testAdjustmentQuantityStoresASurplusAsNegative(): void
    {
        // System says 40, counted 50 → 10 more on the shelf → -10 stored.
        $this->assertSame(-10, PharmOpsAdjustService::adjustmentQuantity(40, 50));
    }

    public function testAdjustmentQuantityIsZeroWhenCountMatches(): void
    {
        $this->assertSame(0, PharmOpsAdjustService::adjustmentQuantity(30, 30));
    }
}

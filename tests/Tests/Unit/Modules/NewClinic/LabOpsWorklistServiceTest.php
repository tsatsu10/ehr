<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\LabOpsWorklistService;
use PHPUnit\Framework\TestCase;

class LabOpsWorklistServiceTest extends TestCase
{
    public function testClassifyPendingWhenNotCollected(): void
    {
        $tab = LabOpsWorklistService::classifyWorklistTab([
            'order_status' => 'pending',
            'fulfillment' => 'in_house',
            'collected' => false,
            'review_status' => '',
        ]);

        $this->assertSame(LabOpsWorklistService::TAB_PENDING, $tab);
    }

    public function testClassifyInProgressWhenCollectedButNotReviewed(): void
    {
        $tab = LabOpsWorklistService::classifyWorklistTab([
            'order_status' => 'pending',
            'fulfillment' => 'in_house',
            'collected' => true,
            'review_status' => 'received',
        ]);

        $this->assertSame(LabOpsWorklistService::TAB_IN_PROGRESS, $tab);
    }

    public function testClassifyInProgressWhenDraftSaved(): void
    {
        $tab = LabOpsWorklistService::classifyWorklistTab([
            'order_status' => 'pending',
            'fulfillment' => 'in_house',
            'collected' => true,
            'review_status' => 'draft',
        ]);

        $this->assertSame(LabOpsWorklistService::TAB_IN_PROGRESS, $tab);
    }

    public function testClassifySendOutTab(): void
    {
        $tab = LabOpsWorklistService::classifyWorklistTab([
            'order_status' => 'pending',
            'fulfillment' => 'send_out',
            'collected' => false,
            'review_status' => '',
        ]);

        $this->assertSame(LabOpsWorklistService::TAB_SEND_OUT, $tab);
    }

    public function testTerminalOrdersExcluded(): void
    {
        $tab = LabOpsWorklistService::classifyWorklistTab([
            'order_status' => 'complete',
            'fulfillment' => 'in_house',
            'collected' => false,
            'review_status' => '',
        ]);

        $this->assertNull($tab);
    }

    public function testReviewedSendOutOrderExcluded(): void
    {
        $tab = LabOpsWorklistService::classifyWorklistTab([
            'order_status' => 'pending',
            'fulfillment' => 'send_out',
            'collected' => true,
            'review_status' => 'reviewed',
        ]);

        $this->assertNull($tab);
    }

    public function testReviewedInHouseOrderExcluded(): void
    {
        $tab = LabOpsWorklistService::classifyWorklistTab([
            'order_status' => 'pending',
            'fulfillment' => 'in_house',
            'collected' => true,
            'review_status' => 'reviewed',
        ]);

        $this->assertNull($tab);
    }
}

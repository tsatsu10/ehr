<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\LabOpsFollowUpService;
use PHPUnit\Framework\TestCase;

class LabOpsFollowUpServiceTest extends TestCase
{
    public function testAjaxPolicyMapsFollowupToLabOpsReadAcl(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame(
            ['type' => 'lab_ops_read_acl'],
            $policy->describe('lab_ops.followup')
        );
    }

    public function testFollowupIsReadOnly(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertTrue($policy->isReadOnly('lab_ops.followup'));
    }

    public function testBucketLabelBoundaries(): void
    {
        $this->assertSame('0_2', LabOpsFollowUpService::bucketLabel(0));
        $this->assertSame('0_2', LabOpsFollowUpService::bucketLabel(2));
        $this->assertSame('3_7', LabOpsFollowUpService::bucketLabel(3));
        $this->assertSame('3_7', LabOpsFollowUpService::bucketLabel(7));
        $this->assertSame('8_plus', LabOpsFollowUpService::bucketLabel(8));
        $this->assertSame('8_plus', LabOpsFollowUpService::bucketLabel(90));
    }
}

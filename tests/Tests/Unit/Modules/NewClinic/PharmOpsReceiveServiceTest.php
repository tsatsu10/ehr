<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use PHPUnit\Framework\TestCase;

class PharmOpsReceiveServiceTest extends TestCase
{
    public function testAjaxPolicyMapsReceiveActions(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('pharm_ops_receive_acl', $policy->describe('pharm_ops.receive_get')['type']);
        $this->assertSame('pharm_ops_receive_acl', $policy->describe('pharm_ops.receive_save')['type']);
    }
}

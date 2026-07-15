<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\PharmOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsReceiveService;
use PHPUnit\Framework\TestCase;

class PharmOpsReceiveServiceTest extends TestCase
{
    public function testAjaxPolicyMapsReceiveActions(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('pharm_ops_receive_acl', $policy->describe('pharm_ops.receive_get')['type']);
        $this->assertSame('pharm_ops_receive_acl', $policy->describe('pharm_ops.receive_save')['type']);
    }

    public function testSaveReceiveRejectsOverlengthLotNumber(): void
    {
        // drug_inventory.lot_number is VARCHAR(20) and this install isn't in strict SQL mode, so
        // an over-length value would otherwise be silently truncated with no error — reject it
        // before any DB write instead. The check fires before loadDrugRow(), so no DB is needed.
        $access = $this->createMock(PharmOpsAccessService::class);
        $access->method('assertReceiveAccess');
        $service = new PharmOpsReceiveService($access);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Lot number must be 20 characters or fewer');
        $service->saveReceive([
            'drug_id' => 1,
            'warehouse_id' => 'onsite',
            'lot_number' => str_repeat('X', 21),
            'expiration' => '2028-01-01',
            'quantity' => 1,
        ], 7);
    }
}

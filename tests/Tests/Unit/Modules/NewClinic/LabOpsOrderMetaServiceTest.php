<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\LabOpsOrderMetaService;
use PHPUnit\Framework\TestCase;

class LabOpsOrderMetaServiceTest extends TestCase
{
    private LabOpsOrderMetaService $service;

    protected function setUp(): void
    {
        $this->service = new LabOpsOrderMetaService();
    }

    public function testInferFulfillmentFromInhouseProviderType(): void
    {
        $this->assertSame(
            'in_house',
            $this->service->inferFulfillmentFromProviderRow(['type' => 'inhouse', 'protocol' => 'DL', 'remote_host' => ''])
        );
    }

    public function testInferFulfillmentFromManualDownloadProvider(): void
    {
        $this->assertSame(
            'in_house',
            $this->service->inferFulfillmentFromProviderRow(['type' => '', 'protocol' => 'DL', 'remote_host' => ''])
        );
    }

    public function testInferFulfillmentFromHl7Provider(): void
    {
        $this->assertSame(
            'send_out',
            $this->service->inferFulfillmentFromProviderRow([
                'type' => '',
                'protocol' => 'HL7',
                'remote_host' => 'lab.example.com',
            ])
        );
    }

    public function testResolveFulfillmentKeepsExplicitSendOut(): void
    {
        $this->assertSame(
            'send_out',
            $this->service->resolveFulfillment('send_out', 1)
        );
    }

    public function testResolveFulfillmentInfersInHouseWhenNoStoredSendOut(): void
    {
        $this->assertSame(
            'in_house',
            $this->service->resolveFulfillment('in_house', 0)
        );
    }

    public function testInferFulfillmentDefaultsWhenProviderMissing(): void
    {
        $this->assertSame('in_house', $this->service->inferFulfillmentFromProviderRow(null));
        $this->assertSame('in_house', $this->service->inferFulfillmentFromProviderId(0));
    }
}

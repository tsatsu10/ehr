<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicalDocAncillaryLbfService;
use PHPUnit\Framework\TestCase;

class ClinicalDocAncillaryLbfServiceTest extends TestCase
{
    public function testAllPackStatusShape(): void
    {
        $service = new ClinicalDocAncillaryLbfService();
        $statuses = $service->getAllPackStatus(0);

        $this->assertCount(2, $statuses);
        $keys = array_column($statuses, 'pack_key');
        $this->assertContains('lab_intake', $keys);
        $this->assertContains('pharmacy_service', $keys);
    }

    public function testUnknownPackThrows(): void
    {
        $service = new ClinicalDocAncillaryLbfService();

        $this->expectException(\InvalidArgumentException::class);
        $service->getPackStatus('unknown_pack', 0);
    }
}

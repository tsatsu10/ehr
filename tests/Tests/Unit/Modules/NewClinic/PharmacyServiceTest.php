<?php

/**
 * Unit tests for pharmacy post-complete routing
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PharmacyService;
use PHPUnit\Framework\TestCase;

class PharmacyServiceTest extends TestCase
{
    public function testResolvePostPharmacyStatePayment(): void
    {
        $this->assertSame('ready_for_payment', PharmacyService::resolvePostPharmacyState());
    }
}

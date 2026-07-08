<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\OpenEmrProductRegistrationDismissService;
use PHPUnit\Framework\TestCase;

class OpenEmrProductRegistrationDismissServiceTest extends TestCase
{
    private mixed $savedFlag = null;

    protected function setUp(): void
    {
        $this->savedFlag = $_SESSION['nc_product_reg_dismissed'] ?? null;
        unset($_SESSION['nc_product_reg_dismissed']);
    }

    protected function tearDown(): void
    {
        if ($this->savedFlag === null) {
            unset($_SESSION['nc_product_reg_dismissed']);
        } else {
            $_SESSION['nc_product_reg_dismissed'] = $this->savedFlag;
        }
    }

    public function testDoesNothingWhenAutoDismissDisabled(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(0);
        $service = new OpenEmrProductRegistrationDismissService($config);

        $service->dismissIfPrompting(1);

        $this->assertArrayNotHasKey('nc_product_reg_dismissed', $_SESSION);
    }

    public function testSkipsWorkWhenAlreadyDismissedThisSession(): void
    {
        $_SESSION['nc_product_reg_dismissed'] = 1;
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(1);
        $service = new OpenEmrProductRegistrationDismissService($config);

        $service->dismissIfPrompting(1);

        $this->assertSame(1, $_SESSION['nc_product_reg_dismissed']);
    }
}

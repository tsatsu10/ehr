<?php

/**
 * Unit tests for module lifecycle lookup (AUDIT-15)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ModuleService;
use PHPUnit\Framework\TestCase;

class ModuleServiceTest extends TestCase
{
    public function testActiveModuleReportsTrueByDirectory(): void
    {
        $this->assertTrue(ModuleService::getModuleState('oe-module-new-clinic'));
    }

    public function testUnknownModuleReportsFalse(): void
    {
        $this->assertFalse(ModuleService::getModuleState('oe-module-does-not-exist-xyz'));
    }
}

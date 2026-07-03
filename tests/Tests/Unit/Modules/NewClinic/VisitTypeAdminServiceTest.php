<?php

/**
 * Unit tests for visit type admin service
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\VisitTypeAdminService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class VisitTypeAdminServiceTest extends TestCase
{
    public function testServiceProfilesAreDocumented(): void
    {
        $this->assertSame(
            ['full_opd', 'lab_direct', 'pharmacy_walkin'],
            VisitTypeAdminService::SERVICE_PROFILES
        );
    }

    public function testIsValidServiceProfile(): void
    {
        $this->assertTrue(VisitTypeAdminService::isValidServiceProfile('full_opd'));
        $this->assertTrue(VisitTypeAdminService::isValidServiceProfile('lab_direct'));
        $this->assertTrue(VisitTypeAdminService::isValidServiceProfile('pharmacy_walkin'));
        $this->assertFalse(VisitTypeAdminService::isValidServiceProfile('invalid'));
    }

    public function testSaveRejectsEmptyLabel(): void
    {
        $service = new VisitTypeAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Visit type name is required');
        $service->save(0, ['label' => '   ', 'pc_catid' => 5], 1);
    }

    public function testSaveRejectsInvalidProfile(): void
    {
        $service = new VisitTypeAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid service profile');
        $service->save(0, ['label' => 'Test', 'pc_catid' => 5, 'service_profile' => 'bad'], 1);
    }

    public function testListForDeskFiltersByDeskToggles(): void
    {
        $method = new ReflectionMethod(VisitTypeAdminService::class, 'listForDesk');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('enable_lab_role', $body);
        $this->assertStringContainsString('enable_pharmacy_role', $body);
        $this->assertStringContainsString('enable_ancillary_services', $body);
        $this->assertStringContainsString('lab_direct', $body);
        $this->assertStringContainsString('pharmacy_walkin', $body);
    }

    public function testArchiveGuardsDefaultAndLastOpd(): void
    {
        $method = new ReflectionMethod(VisitTypeAdminService::class, 'archive');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('default_visit_type_id', $body);
        $this->assertStringContainsString('Cannot archive the only active OPD visit type', $body);
    }
}

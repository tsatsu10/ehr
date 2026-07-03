<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AdminConfigExportService;
use PHPUnit\Framework\TestCase;

class AdminConfigExportServiceTest extends TestCase
{
    public function testExportMetaShape(): void
    {
        $service = new AdminConfigExportService();
        $meta = $service->getExportMeta();

        $this->assertArrayHasKey('can_export', $meta);
        $this->assertArrayHasKey('blocked_reason', $meta);
        $this->assertSame('new_clinic_m6_config', $meta['export_format']);
        $this->assertSame(1, $meta['export_version']);
    }

    public function testBuildSnapshotRequiresSuperAdmin(): void
    {
        $service = new AdminConfigExportService();

        if ($service->canExport()) {
            $this->markTestSkipped('Super admin session present — cannot assert blocked export');
        }

        $this->expectException(\RuntimeException::class);
        $service->buildSnapshot(0, 'All facilities (global default)');
    }

    public function testEditableSettingsMetaIsSharedWithClinicAdmin(): void
    {
        $meta = \OpenEMR\Modules\NewClinic\Services\ClinicAdminService::editableSettingsMeta();

        $this->assertArrayHasKey('enable_triage', $meta);
        $this->assertArrayHasKey('currency_code', $meta);
    }
}

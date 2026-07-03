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
use OpenEMR\Modules\NewClinic\Services\AdminConfigImportService;
use PHPUnit\Framework\TestCase;

class AdminConfigImportServiceTest extends TestCase
{
    public function testImportMetaShape(): void
    {
        $service = new AdminConfigImportService();
        $meta = $service->getImportMeta();

        $this->assertArrayHasKey('can_import', $meta);
        $this->assertArrayHasKey('import_blocked_reason', $meta);
        $this->assertSame('new_clinic_m6_config', $meta['import_format']);
        $this->assertSame(1, $meta['import_version']);
    }

    public function testValidateSnapshotRejectsWrongFormat(): void
    {
        $service = new AdminConfigImportService();

        if ($service->canImport()) {
            $this->markTestSkipped('Super admin session present — cannot assert blocked import');
        }

        $this->expectException(\RuntimeException::class);
        $service->previewImport(0, ['export_format' => 'wrong']);
    }

    public function testFilterImportableSettingsExcludesSetupComplete(): void
    {
        $service = new AdminConfigImportService();
        $filtered = $service->filterImportableSettings([
            'enable_triage' => true,
            'admin_hub_setup_complete' => true,
            'unknown_key' => 'skip',
        ]);

        $this->assertArrayHasKey('enable_triage', $filtered);
        $this->assertArrayNotHasKey('admin_hub_setup_complete', $filtered);
        $this->assertArrayNotHasKey('unknown_key', $filtered);
    }

    public function testDryRunPreviewShapeWhenAllowed(): void
    {
        $service = new AdminConfigImportService();

        if (!$service->canImport()) {
            $this->markTestSkipped('Super admin required for import preview');
        }

        $snapshot = [
            'export_format' => AdminConfigExportService::EXPORT_FORMAT,
            'export_version' => AdminConfigExportService::EXPORT_VERSION,
            'settings' => ['enable_triage' => true],
            'fee_schedule' => [],
            'visit_types' => [],
        ];

        $result = $service->previewImport(0, $snapshot);

        $this->assertTrue($result['dry_run']);
        $this->assertSame(1, $result['summary']['settings_planned']);
        $this->assertSame(0, $result['summary']['fees_planned']);
        $this->assertSame(0, $result['summary']['visit_types_planned']);
    }
}

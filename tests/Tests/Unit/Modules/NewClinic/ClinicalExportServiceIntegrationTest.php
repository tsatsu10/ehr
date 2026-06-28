<?php

/**
 * Integration tests for clinical export builder (requires local DB)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicalExportService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class ClinicalExportServiceIntegrationTest extends TestCase
{
    private int $facilityId = 0;

    protected function setUp(): void
    {
        $this->facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
        if ($this->facilityId <= 0) {
            $this->markTestSkipped('No service-location facility configured');
        }
    }

    public function testVisitExportUrlNullWhenFeatureDisabled(): void
    {
        $pid = $this->resolveAnyPatientPid();
        if ($pid <= 0) {
            $this->markTestSkipped('No patient in database');
        }

        $this->withExportDisabled(function () use ($pid): void {
            $service = new ClinicalExportService();
            $this->assertNull($service->buildVisitExportUrl($pid, 1));
        });
    }

    public function testBuilderPayloadHiddenWhenExportDisabled(): void
    {
        $pid = $this->resolveAnyPatientPid();
        if ($pid <= 0) {
            $this->markTestSkipped('No patient in database');
        }

        $this->withExportDisabled(function () use ($pid): void {
            $this->expectException(\RuntimeException::class);
            (new ClinicalExportService())->getBuilderPayload($pid);
        });
    }

    /**
     * @param callable(): void $callback
     */
    private function withExportDisabled(callable $callback): void
    {
        $config = new ClinicConfigService();
        $keys = ['enable_chart_depth', 'enable_chart_depth_export'];
        $facilityIds = array_values(array_unique([0, $this->facilityId]));
        $saved = [];

        foreach ($facilityIds as $facilityId) {
            foreach ($keys as $key) {
                $saved[$facilityId][$key] = $config->get($key, null, $facilityId);
                $config->set($key, '0', $facilityId);
            }
        }

        try {
            $callback();
        } finally {
            foreach ($facilityIds as $facilityId) {
                foreach ($keys as $key) {
                    $value = $saved[$facilityId][$key] ?? '0';
                    $config->set($key, (string) $value, $facilityId);
                }
            }
        }
    }

    private function resolveAnyPatientPid(): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT pid FROM patient_data ORDER BY pid DESC LIMIT 1',
            []
        );

        return is_array($row) ? (int) ($row['pid'] ?? 0) : 0;
    }
}

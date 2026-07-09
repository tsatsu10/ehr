<?php

/**
 * Tests for M16 pharmacy native inventory reports (AUDIT-15)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ReportHubPharmacyNativeReportService;
use PHPUnit\Framework\TestCase;

class ReportHubPharmacyNativeReportServiceTest extends TestCase
{
    private ReportHubPharmacyNativeReportService $service;

    protected function setUp(): void
    {
        $this->service = new ReportHubPharmacyNativeReportService();
    }

    public function testIsPharmacyKeyAcceptsBothNativeReports(): void
    {
        $this->assertTrue($this->service->isPharmacyKey(
            ReportHubPharmacyNativeReportService::KEY_INVENTORY_TRANSACTIONS
        ));
        $this->assertTrue($this->service->isPharmacyKey(
            ReportHubPharmacyNativeReportService::KEY_INVENTORY_ACTIVITY
        ));
        $this->assertFalse($this->service->isPharmacyKey('audit_amc'));
        $this->assertFalse($this->service->isPharmacyKey(''));
    }

    public function testRunReportRejectsUnknownKey(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->service->runReport('not_a_pharmacy_report', null, null, 10, 0, 0);
    }

    public function testCountRowsReturnsZeroForUnknownKey(): void
    {
        $this->assertSame(0, $this->service->countRows('not_a_pharmacy_report', null, null, 0));
    }

    public function testInventoryTransactionsReportHasStableShape(): void
    {
        $result = $this->service->runReport(
            ReportHubPharmacyNativeReportService::KEY_INVENTORY_TRANSACTIONS,
            null,
            null,
            5,
            0,
            0
        );

        $this->assertArrayHasKey('columns', $result);
        $this->assertArrayHasKey('rows', $result);
        $this->assertArrayHasKey('total', $result);
        $this->assertNotEmpty($result['columns']);
        $this->assertLessThanOrEqual(5, count($result['rows']));
        foreach ($result['rows'] as $row) {
            $this->assertCount(count($result['columns']), $row);
        }
    }

    public function testInventoryActivityReportHasStableShape(): void
    {
        $result = $this->service->runReport(
            ReportHubPharmacyNativeReportService::KEY_INVENTORY_ACTIVITY,
            null,
            null,
            5,
            0,
            0
        );

        $this->assertArrayHasKey('columns', $result);
        $this->assertArrayHasKey('rows', $result);
        $this->assertArrayHasKey('total', $result);
        $this->assertNotEmpty($result['columns']);
    }
}

<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ReportsDocumentationIntegrityService;
use PHPUnit\Framework\TestCase;

class ReportsDocumentationIntegrityServiceTest extends TestCase
{
    public function testReportPayloadShape(): void
    {
        $service = new ReportsDocumentationIntegrityService();
        $report = $service->getReport(0, '2099-01-01', '2099-01-01');

        $this->assertTrue($report['enabled']);
        $this->assertSame('2099-01-01', $report['start_date']);
        $this->assertSame('2099-01-01', $report['end_date']);
        $this->assertIsArray($report['summary']);
        $this->assertIsArray($report['rows']);
        $this->assertArrayHasKey('visits_with_events', $report['summary']);
        $this->assertArrayHasKey('override_events', $report['summary']);
    }

    public function testInvalidDateRangeRejected(): void
    {
        $service = new ReportsDocumentationIntegrityService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('end_date must be on or after start_date');
        $service->getReport(0, '2099-01-02', '2099-01-01');
    }

    public function testExportCsvHeaders(): void
    {
        $service = new ReportsDocumentationIntegrityService();
        $export = $service->exportCsv(0, '2099-01-01', '2099-01-01');

        $this->assertSame('documentation-integrity-2099-01-01-to-2099-01-01.csv', $export['filename']);
        $this->assertStringContainsString('event_category', $export['content']);
        $this->assertStringContainsString('amendment_note', $export['content']);
        $this->assertStringContainsString('override_reason', $export['content']);
        $this->assertSame(0, $export['row_count']);
    }

    public function testLegacyOverrideActorUsesSuccessFieldWhenUserSwapped(): void
    {
        $service = new ReportsDocumentationIntegrityService();
        $method = new \ReflectionMethod(ReportsDocumentationIntegrityService::class, 'resolveLogActor');
        $method->setAccessible(true);

        $actor = $method->invoke($service, [
            'user' => 'esign_override',
            'groupname' => 'default',
            'success' => 'dr.admin',
        ]);

        $this->assertSame('dr.admin', $actor);
    }
}

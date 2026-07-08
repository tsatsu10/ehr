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
use OpenEMR\Modules\NewClinic\Services\LabOpsPanelImportService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class LabOpsPanelImportServiceTest extends TestCase
{
    private function makeService(): LabOpsPanelImportService
    {
        return new LabOpsPanelImportService(
            $this->createMock(ClinicConfigService::class),
            $this->createMock(VisitScopeService::class),
        );
    }

    public function testImportRequiresLabProviderId(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Lab provider id is required');

        $this->makeService()->importCsvContent(0, "a,b,c,d\n", 7);
    }

    public function testParseCsvSkipsHeaderAndShortRowsAndTrims(): void
    {
        $service = $this->makeService();
        $parse = new ReflectionMethod(LabOpsPanelImportService::class, 'parseCsv');

        $csv = implode("\n", [
            'Order Code,Order Name,Result Code,Result Name',
            ' FBC , Full Blood Count , HGB , Haemoglobin ',
            'too,short,row',
            'MAL,Malaria RDT,MAL-R,Malaria result',
        ]);

        $lines = $parse->invoke($service, $csv);

        $this->assertCount(2, $lines);
        $this->assertSame(
            ['order_code' => 'FBC', 'order_name' => 'Full Blood Count', 'result_code' => 'HGB', 'result_name' => 'Haemoglobin'],
            $lines[0]
        );
        $this->assertSame('MAL', $lines[1]['order_code']);
    }
}

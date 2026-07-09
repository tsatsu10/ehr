<?php

/**
 * Tests for the Ghana OPD HIS field pack (M6-F28 / D-HIST-6)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\HisPackImportService;
use PHPUnit\Framework\TestCase;

class HisPackImportServiceTest extends TestCase
{
    public function testPackHidesUsCentricScreeningFields(): void
    {
        // §10.2 — US-centric fields the Ghana pack removes from the HIS editor.
        $this->assertSame(
            ['exams', 'seatbelt_use', 'hazardous_activities'],
            HisPackImportService::HIDE_FIELDS
        );
        $this->assertSame('relatives_sickle_cell', HisPackImportService::SICKLE_CELL_FIELD);
    }

    public function testStatusIsReadOnlyAndWellFormed(): void
    {
        $status = (new HisPackImportService())->getStatus();

        $this->assertArrayHasKey('applied', $status);
        $this->assertArrayHasKey('hidden_count', $status);
        $this->assertArrayHasKey('sickle_cell_present', $status);
        $this->assertIsBool($status['applied']);
        $this->assertGreaterThanOrEqual(0, $status['hidden_count']);
        $this->assertLessThanOrEqual(count(HisPackImportService::HIDE_FIELDS), $status['hidden_count']);
    }
}

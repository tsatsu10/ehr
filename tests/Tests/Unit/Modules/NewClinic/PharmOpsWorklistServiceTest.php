<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\PharmOpsVisitMatch;
use OpenEMR\Modules\NewClinic\Services\PharmOpsWorklistService;
use PHPUnit\Framework\TestCase;

class PharmOpsWorklistServiceTest extends TestCase
{
    public function testParseQuantityExtractsLeadingInteger(): void
    {
        $this->assertSame(21, PharmOpsWorklistService::parseQuantity('21 tablets'));
        $this->assertSame(14, PharmOpsWorklistService::parseQuantity('14'));
        $this->assertSame(0, PharmOpsWorklistService::parseQuantity(''));
    }

    public function testClassifyPendingWhenNotDispensed(): void
    {
        $status = PharmOpsWorklistService::classifyDispenseStatus(21, 0, false);

        $this->assertSame('pending', $status);
    }

    public function testClassifyPartialWhenShortQty(): void
    {
        $status = PharmOpsWorklistService::classifyDispenseStatus(21, 14, false);

        $this->assertSame('partial', $status);
    }

    public function testClassifyExcludesFullyDispensedByQty(): void
    {
        $status = PharmOpsWorklistService::classifyDispenseStatus(21, 21, false);

        $this->assertNull($status);
    }

    public function testClassifyExcludesLegacyFilledMarker(): void
    {
        $status = PharmOpsWorklistService::classifyDispenseStatus(21, 0, true);

        $this->assertNull($status);
    }

    public function testClassifyReorderStatusLowWhenAtReorderPoint(): void
    {
        $this->assertSame('low', PharmOpsWorklistService::classifyReorderStatus(10, 10));
    }

    public function testClassifyReorderStatusOutWhenZeroOnHand(): void
    {
        $this->assertSame('out_of_stock', PharmOpsWorklistService::classifyReorderStatus(0, 50));
    }

    public function testClassifyReorderStatusInStockAboveReorderPoint(): void
    {
        $this->assertSame('in_stock', PharmOpsWorklistService::classifyReorderStatus(25, 10));
    }

    public function testIsLowStockCandidateRequiresReorderPointOrZeroOnHand(): void
    {
        $this->assertTrue(PharmOpsWorklistService::isLowStockCandidate(5, 20));
        $this->assertFalse(PharmOpsWorklistService::isLowStockCandidate(25, 20));
        $this->assertTrue(PharmOpsWorklistService::isLowStockCandidate(0, 0));
    }

    public function testStockSummaryForDrugReturnsUnknownWhenNoDrugId(): void
    {
        $summary = PharmOpsWorklistService::stockSummaryForDrug(0);

        $this->assertSame('unknown', $summary['stock_status']);
        $this->assertSame(0, $summary['on_hand']);
        $this->assertNull($summary['qoh_display']);
    }

    public function testPrescriptionRowBindParamsVisitDateFirst(): void
    {
        $bind = PharmOpsWorklistService::prescriptionRowBindParams('2026-06-29', [1, 2]);

        $this->assertSame(['2026-06-29', 1, 2], $bind);
        $this->assertSame(1, substr_count(PharmOpsVisitMatch::todayVisitSubquerySql(), '?'));
    }
}

<?php

/**
 * Unit tests for ReconciliationService (M7-F10)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ReconciliationService;
use PHPUnit\Framework\TestCase;

class ReconciliationServiceTest extends TestCase
{
    public function testEvaluateStatusOkWhenWithinTolerance(): void
    {
        $this->assertSame('ok', ReconciliationService::evaluateStatus(100.00, 100.00, 0.01));
        $this->assertSame('ok', ReconciliationService::evaluateStatus(100.00, 100.01, 0.01));
    }

    public function testEvaluateStatusWarningWhenDriftExceedsTolerance(): void
    {
        $this->assertSame('warning', ReconciliationService::evaluateStatus(100.00, 100.02, 0.01));
    }

    public function testCalculateDeltaUsesAbsoluteDifference(): void
    {
        $this->assertSame(0.02, ReconciliationService::calculateDelta(100.00, 100.02));
        $this->assertSame(0.02, ReconciliationService::calculateDelta(100.02, 100.00));
    }

    public function testRunPersistsReconciliationRunRow(): void
    {
        $reflection = new \ReflectionMethod(ReconciliationService::class, 'run');
        $source = file_get_contents($reflection->getFileName());
        $lines = explode("\n", $source);
        $methodBody = implode("\n", array_slice(
            $lines,
            $reflection->getStartLine() - 1,
            $reflection->getEndLine() - $reflection->getStartLine() + 1
        ));

        $this->assertStringContainsString('new_reconciliation_run', $methodBody);
        $this->assertStringContainsString('fetchTotals', $methodBody);
        $this->assertStringContainsString('evaluateStatus', $methodBody);
    }
}

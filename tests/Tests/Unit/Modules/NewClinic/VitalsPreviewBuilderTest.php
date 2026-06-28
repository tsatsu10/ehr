<?php

/**
 * Unit tests for shared vitals preview builder
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\VitalsPreviewBuilder;
use PHPUnit\Framework\TestCase;

class VitalsPreviewBuilderTest extends TestCase
{
    private VitalsPreviewBuilder $builder;

    protected function setUp(): void
    {
        $GLOBALS['units_of_measurement'] = 2;
        $this->builder = new VitalsPreviewBuilder();
    }

    public function testMergeIntoPreviewFlagsMissingVitals(): void
    {
        $preview = $this->builder->mergeIntoPreview(['identity' => []], [], [], false);

        $this->assertTrue($preview['vitals_today']['vitals_missing_today']);
        $this->assertNull($preview['vitals_today']['summary']);
    }

    public function testMergeIntoPreviewBuildsSummary(): void
    {
        $vitals = [[
            'bps' => 120,
            'bpd' => 80,
            'pulse' => 72,
            'temperature' => 36.8,
        ]];

        $preview = $this->builder->mergeIntoPreview(['identity' => []], $vitals, [], false);

        $this->assertStringContainsString('BP 120/80', $preview['vitals_today']['summary']);
        $this->assertStringContainsString('HR 72', $preview['vitals_today']['summary']);
        $this->assertFalse($preview['vitals_today']['vitals_missing_today']);
    }

    public function testEvaluateWarningsEmptyWhenNoVitals(): void
    {
        $this->assertEmpty($this->builder->evaluateWarnings([]));
    }

    public function testHasCompleteTriageVitalsFromRowsRequiresCoreFields(): void
    {
        $this->assertFalse($this->builder->hasCompleteTriageVitalsFromRows([]));
        $this->assertFalse($this->builder->hasCompleteTriageVitalsFromRows([[
            'bps' => 120,
            'bpd' => 80,
            'pulse' => 72,
        ]]));
        $this->assertTrue($this->builder->hasCompleteTriageVitalsFromRows([[
            'bps' => 120,
            'bpd' => 80,
            'pulse' => 72,
            'temperature' => 36.8,
            'weight' => 70,
        ]]));
    }
}

<?php

/**
 * Provider calendar colour resolution/defaults.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\SchedulingProviderColorService;
use PHPUnit\Framework\TestCase;

class SchedulingProviderColorServiceTest extends TestCase
{
    public function testDefaultPaletteCyclesByIndex(): void
    {
        $palette = SchedulingProviderColorService::DEFAULT_PALETTE;
        $this->assertNotEmpty($palette);
        $this->assertSame($palette[0], SchedulingProviderColorService::defaultColorForIndex(0));
        $this->assertSame($palette[1], SchedulingProviderColorService::defaultColorForIndex(1));
        // Wraps around past the end of the palette.
        $this->assertSame(
            $palette[0],
            SchedulingProviderColorService::defaultColorForIndex(count($palette))
        );
    }

    public function testEveryDefaultIsAValidSixDigitHex(): void
    {
        foreach (SchedulingProviderColorService::DEFAULT_PALETTE as $hex) {
            $this->assertMatchesRegularExpression('/^#[0-9a-f]{6}$/', $hex);
        }
    }
}

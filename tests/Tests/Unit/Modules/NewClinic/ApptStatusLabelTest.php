<?php

/**
 * ApptStatusLabel::clean() — stock apptstat title normalization
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Support\ApptStatusLabel;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ApptStatusLabelTest extends TestCase
{
    /** @return array<string, array{string, string, string}> */
    public static function titleProvider(): array
    {
        return [
            'symbol prefix stripped' => ['-', '- None', 'None'],
            'at-sign prefix stripped' => ['@', '@ Arrived', 'Arrived'],
            'multi-word kept after strip' => ['%', '% Canceled < 24h', 'Canceled < 24h'],
            'alpha code keeps prefix' => ['AVM', 'AVM Confirmed', 'AVM Confirmed'],
            'alpha code keeps prefix (SMS)' => ['SMS', 'SMS Confirmed', 'SMS Confirmed'],
            'renamed title untouched' => ['-', 'Booked', 'Booked'],
            'title without space untouched' => ['CALL', 'Callback requested', 'Callback requested'],
            'title equal to code stays' => ['@', '@', '@'],
            'empty title falls back to code' => ['@', '', '@'],
            'prefix-only title falls back to full title' => ['-', '-', '-'],
        ];
    }

    #[DataProvider('titleProvider')]
    public function testClean(string $code, string $title, string $expected): void
    {
        $this->assertSame($expected, ApptStatusLabel::clean($code, $title));
    }
}

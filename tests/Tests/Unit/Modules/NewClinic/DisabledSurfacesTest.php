<?php

/**
 * SEC-4 / SEC-8: product non-goal surfaces (patient portal, REST API, FHIR)
 * stay disabled. If a deployment turns one on, that is a scope change requiring
 * a PRD amendment and a security review — this test flags it in the build.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use PHPUnit\Framework\TestCase;

class DisabledSurfacesTest extends TestCase
{
    /**
     * @return array<int, array{0: string}>
     */
    public static function nonGoalGlobals(): array
    {
        return [
            ['rest_api'],
            ['rest_fhir_api'],
            ['rest_portal_api'],
            ['portal_onsite_two_enable'],
        ];
    }

    /**
     * @dataProvider nonGoalGlobals
     */
    public function testNonGoalSurfaceIsDisabled(string $global): void
    {
        $row = QueryUtils::querySingleRow(
            'SELECT gl_value FROM globals WHERE gl_name = ? AND gl_index = 0',
            [$global]
        );
        // Unset = core default off; set must be "0".
        $value = $row['gl_value'] ?? '0';
        $this->assertSame(
            '0',
            (string) $value,
            "{$global} must stay disabled (product non-goal). Enabling it needs a PRD amendment + security review."
        );
    }
}

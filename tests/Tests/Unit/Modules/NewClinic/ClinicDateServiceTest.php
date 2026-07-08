<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicDateService;
use PHPUnit\Framework\TestCase;

class ClinicDateServiceTest extends TestCase
{
    public function testTodayIsCanonicalIsoCalendarDate(): void
    {
        $today = (new ClinicDateService())->today();

        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $today);
        $this->assertSame(date('Y-m-d'), $today);
    }
}

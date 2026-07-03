<?php

/**
 * Unit tests for cash clinic profile target mapping (M6-F07)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\CashClinicProfileService;
use PHPUnit\Framework\TestCase;

class CashClinicProfileServiceTest extends TestCase
{
    public function testBuildOpenEmrGlobalTargetsUsesCurrencyAndTimezone(): void
    {
        $targets = CashClinicProfileService::buildOpenEmrGlobalTargets('GH₵', 'Africa/Lagos', false);

        $this->assertSame('GH₵', $targets['gbl_currency_symbol']);
        $this->assertSame('Africa/Lagos', $targets['gbl_time_zone']);
        $this->assertSame('0', $targets['inhouse_pharmacy']);
        $this->assertSame('1', $targets['esign_individual']);
        $this->assertSame('1', $targets['lock_esign_individual']);
        $this->assertSame('1', $targets['disable_eligibility_log']);
        $this->assertSame('0', $targets['gbl_show_pat_search']);
    }

    public function testBuildOpenEmrGlobalTargetsMirrorsPharmacyRole(): void
    {
        $off = CashClinicProfileService::buildOpenEmrGlobalTargets('$', 'America/New_York', false);
        $on = CashClinicProfileService::buildOpenEmrGlobalTargets('$', 'America/New_York', true);

        $this->assertSame('0', $off['inhouse_pharmacy']);
        $this->assertSame('1', $on['inhouse_pharmacy']);
    }

    public function testBuildOpenEmrGlobalTargetsFallsBackToDefaultTimezone(): void
    {
        $targets = CashClinicProfileService::buildOpenEmrGlobalTargets('₦', '   ', false);

        $this->assertSame(CashClinicProfileService::DEFAULT_CLINIC_TZ, $targets['gbl_time_zone']);
    }
}

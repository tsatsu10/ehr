<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AncillaryVisitBadgeService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use PHPUnit\Framework\TestCase;

class AncillaryVisitBadgeServiceTest extends TestCase
{
    public function testBadgesForLabDirectWithReferral(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(1);

        $service = new AncillaryVisitBadgeService($config);
        $badges = $service->badgesForRow([
            'facility_id' => 1,
            'service_profile' => 'lab_direct',
            'referral_document_id' => 42,
        ]);

        $this->assertSame(
            [
                AncillaryVisitBadgeService::BADGE_LAB_DIRECT,
                AncillaryVisitBadgeService::BADGE_REFERRAL_ON_FILE,
            ],
            $badges
        );
    }

    public function testBadgesForPharmacyWalkin(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(1);

        $service = new AncillaryVisitBadgeService($config);
        $badges = $service->badgesForRow([
            'facility_id' => 1,
            'service_profile' => 'pharmacy_walkin',
        ]);

        $this->assertSame([AncillaryVisitBadgeService::BADGE_PHARMACY_WALKIN], $badges);
    }

    public function testReferredToOpdBadgeOnFullOpdVisit(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(1);

        $service = new AncillaryVisitBadgeService($config);
        $badges = $service->badgesForRow([
            'facility_id' => 1,
            'service_profile' => 'full_opd',
        ], true);

        $this->assertSame([AncillaryVisitBadgeService::BADGE_REFERRED_TO_OPD], $badges);
    }

    public function testReturnsNoBadgesWhenAncillaryDisabled(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(0);

        $service = new AncillaryVisitBadgeService($config);
        $badges = $service->badgesForRow([
            'facility_id' => 1,
            'service_profile' => 'lab_direct',
            'referral_document_id' => 99,
        ], true);

        $this->assertSame([], $badges);
    }

    public function testShouldCheckReferredToOpdOnlyForFullOpd(): void
    {
        $service = new AncillaryVisitBadgeService();

        $this->assertTrue($service->shouldCheckReferredToOpd(['service_profile' => 'full_opd']));
        $this->assertTrue($service->shouldCheckReferredToOpd(['service_profile' => '']));
        $this->assertFalse($service->shouldCheckReferredToOpd(['service_profile' => 'lab_direct']));
        $this->assertFalse($service->shouldCheckReferredToOpd(['service_profile' => 'pharmacy_walkin']));
    }
}

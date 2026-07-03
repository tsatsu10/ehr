<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\ReportHubAccessService;
use PHPUnit\Framework\TestCase;

class ReportHubAccessServiceTest extends TestCase
{
    public function testPharmacyLensAclsIncludeLeadTier(): void
    {
        $this->assertContains('new_reports_pharmacy', ReportHubAccessService::PHARMACY_ACLS);
        $this->assertContains('new_pharmacy_lead', ReportHubAccessService::PHARMACY_ACLS);
    }

    public function testHubReadIncludesReportsAco(): void
    {
        $this->assertContains('reports', ReportHubAccessService::HUB_READ_ACLS);
        $this->assertContains('new_reports_hub', ReportHubAccessService::HUB_READ_ACLS);
    }

    public function testAllowedLensesRespectsAclChecker(): void
    {
        $access = new ReportHubAccessService(
            aclChecker: static fn (string $section, string $aco): bool => $section === 'new_clinic' && $aco === 'new_reports_clinical',
        );

        $this->assertSame(['clinical'], $access->allowedLenses());
        $this->assertTrue($access->canViewClinical());
        $this->assertFalse($access->canViewPharmacy());
    }
}

<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\ClinicalDocAccessService;
use PHPUnit\Framework\TestCase;

class ClinicalDocAccessServiceTest extends TestCase
{
    public function testHubReadIncludesDoctorAndNurse(): void
    {
        $this->assertContains('new_doctor', ClinicalDocAccessService::HUB_READ_ACLS);
        $this->assertContains('new_nurse', ClinicalDocAccessService::HUB_READ_ACLS);
        $this->assertContains('new_clinical_doc_hub', ClinicalDocAccessService::HUB_READ_ACLS);
    }

    public function testAllowedLensesRespectsAclChecker(): void
    {
        $access = new ClinicalDocAccessService(
            aclChecker: static fn (string $section, string $aco): bool => $section === 'new_clinic' && $aco === 'new_clinical_doc_nursing',
        );

        $this->assertSame(['nursing'], $access->allowedLenses());
        $this->assertTrue($access->canViewNursing());
        $this->assertFalse($access->canViewConsult());
    }
}

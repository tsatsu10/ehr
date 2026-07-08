<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicRolesService;
use PHPUnit\Framework\TestCase;

class StaffAdminServiceTest extends TestCase
{
    public function testReceptionTemplateGroups(): void
    {
        $groups = ClinicRolesService::groupsForTemplate('reception', false);
        $this->assertContains('New Clinic Reception', $groups);
        $this->assertContains('Clinicians', $groups);
    }

    public function testReceptionLeadAddsLeadGroup(): void
    {
        $groups = ClinicRolesService::groupsForTemplate('reception', true);
        $this->assertContains('New Clinic Reception Lead', $groups);
    }

    public function testBuildTemplateReviewIncludesGroups(): void
    {
        $review = ClinicRolesService::buildTemplateReview('reception', false);
        $this->assertNotEmpty($review);
        $kinds = array_column($review, 'kind');
        $this->assertContains('groups', $kinds);
    }

    public function testInferTemplateFromGroups(): void
    {
        $template = ClinicRolesService::inferTemplateFromGroups([
            'Clinicians',
            'New Clinic Doctor',
        ]);
        $this->assertSame('doctor', $template['id']);
    }
}

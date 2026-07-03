<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use PHPUnit\Framework\TestCase;

class AjaxActionPolicyTest extends TestCase
{
    public function testAdminHubActionAliasesNormalize(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('admin.health_status', $policy->normalizeAction('admin_hub.health_status'));
        $this->assertSame('admin.backup.run', $policy->normalizeAction('admin_hub.backup_run'));
        $this->assertSame('admin.backup.complete', $policy->normalizeAction('admin_hub.backup_complete'));
        $this->assertSame('admin.setup.mark_item', $policy->normalizeAction('admin_hub.setup_progress'));
        $this->assertSame('admin.setup.complete', $policy->normalizeAction('admin_hub.setup_complete'));
        $this->assertSame('admin.config', $policy->normalizeAction('admin.config'));
    }

    public function testDoctorRosterActionsUseDeskAndDoctorAcl(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('desk_acl', $policy->describe('doctor.roster')['type']);
        $this->assertSame('single_acl', $policy->describe('doctor.roster.set_taking')['type']);
        $this->assertSame('new_doctor', $policy->describe('doctor.roster.set_taking')['acl']);
        $this->assertSame('new_doctor', $policy->requiresSingleAcl('doctor.roster.set_taking'));
    }

    public function testDoctorRoutingReassignAllowsAdminOrReception(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('any_acl', $policy->describe('doctor.routing.reassign')['type']);
        $this->assertContains('new_admin', $policy->describe('doctor.routing.reassign')['acls'] ?? []);
        $this->assertContains('new_reception', $policy->describe('doctor.routing.reassign')['acls'] ?? []);
    }
}

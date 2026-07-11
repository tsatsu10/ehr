<?php

/**
 * Unit tests for clinic roles ACL catalog
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicRolesService;
use PHPUnit\Framework\TestCase;

class ClinicRolesServiceTest extends TestCase
{
    public function testGrantMatrixIncludesDeskGroups(): void
    {
        $matrix = ClinicRolesService::buildGrantMatrix();

        $this->assertContains('New Clinic Reception', $matrix['new_reception']);
        $this->assertContains('New Clinic Doctor', $matrix['new_doctor']);
        $this->assertContains('New Clinic Admin', $matrix['new_admin']);
    }

    public function testGrantMatrixIncludesLeadPrivileges(): void
    {
        $matrix = ClinicRolesService::buildGrantMatrix();

        $this->assertContains('New Clinic Reception Lead', $matrix['new_visit_cancel']);
        $this->assertContains('New Clinic Cashier Lead', $matrix['new_visit_mark_outstanding']);
        $this->assertContains('New Clinic Doctor', $matrix['new_visit_skip_queue']);
    }

    public function testAdminGroupHasReportsAcl(): void
    {
        $matrix = ClinicRolesService::buildGrantMatrix();

        $this->assertContains('New Clinic Admin', $matrix['reports']);
    }

    /**
     * Regression guard for the 2026-07-11 audit finding: this class's ACOS/
     * buildGrantMatrix() are a hand-maintained display copy of
     * acl/acl_setup.php's real $acos/$extraGrants/$roleAddonGrants and had
     * drifted (missing ~44 ACOs and most lead/doctor extra grants). Spot-check
     * a representative sample of the previously-missing entries.
     */
    public function testGrantMatrixIncludesPreviouslyMissingLeadAndDoctorGrants(): void
    {
        $matrix = ClinicRolesService::buildGrantMatrix();

        // Lab Lead and Cashier Lead now have their own self-named ACO, same
        // pattern as Pharmacy Lead already had.
        $this->assertContains('New Clinic Lab Lead', $matrix['new_lab_lead']);
        $this->assertContains('New Clinic Cashier Lead', $matrix['new_cashier_lead']);

        // Lab Lead's full real grant set (was just ['new_lab']).
        $this->assertContains('New Clinic Lab Lead', $matrix['new_lab_ops']);
        $this->assertContains('New Clinic Lab Lead', $matrix['new_lab_ops_enter']);
        $this->assertContains('New Clinic Lab Lead', $matrix['new_lab_ops_release']);
        $this->assertContains('New Clinic Lab Lead', $matrix['new_lab_order_intake']);

        // Cashier Lead's bill-ops grants (were entirely missing).
        $this->assertContains('New Clinic Cashier Lead', $matrix['new_bill_ops_correct']);
        $this->assertContains('New Clinic Cashier Lead', $matrix['new_bill_ops_outstanding']);

        // Doctor's registry/clinical-doc/lab-ops grants (were entirely missing).
        $this->assertContains('New Clinic Doctor', $matrix['new_registry']);
        $this->assertContains('New Clinic Doctor', $matrix['new_clinical_doc_hub']);
        $this->assertContains('New Clinic Doctor', $matrix['new_lab_ops']);

        // Base-role addon grants (new_lab/new_pharmacy) that were entirely missing.
        $this->assertContains('New Clinic Lab', $matrix['new_lab_ops']);
        $this->assertContains('New Clinic Pharmacy', $matrix['new_pharm_ops']);
    }

    public function testAclInventoryIncludesPreviouslyMissingAcos(): void
    {
        $acoKeys = array_column(
            (new ClinicRolesService())->getRolesPayload()['acl_inventory'],
            'aco_key'
        );

        foreach ([
            'new_lab_lead', 'new_cashier_lead', 'new_lab_ops_enter', 'new_lab_ops_release',
            'new_pharm_ops_dispense', 'new_bill_ops_correct', 'new_queue_bridge',
            'new_clinical_doc_hub', 'new_hard_assign_provider', 'new_visit_return_to_doctor',
        ] as $key) {
            $this->assertContains($key, $acoKeys, "ACL inventory is missing {$key}");
        }
    }
}

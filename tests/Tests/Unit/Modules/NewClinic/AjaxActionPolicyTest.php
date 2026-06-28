<?php

/**
 * Unit tests for AJAX action ACL policy
 *
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
    private AjaxActionPolicy $policy;

    protected function setUp(): void
    {
        $this->policy = new AjaxActionPolicy();
    }

    public function testDeprecatedTransitionAction(): void
    {
        $this->assertTrue($this->policy->isDeprecated('visit.transition'));
        $desc = $this->policy->describe('visit.transition');
        $this->assertSame('deprecated', $desc['type']);
    }

    public function testCashierPayRequiresCashierAcl(): void
    {
        $this->assertSame('new_cashier', $this->policy->requiresSingleAcl('cashier.pay'));
    }

    public function testCashierResolvePatientRequiresCashierAcl(): void
    {
        $this->assertSame('new_cashier', $this->policy->requiresSingleAcl('cashier.resolve_patient'));
    }

    public function testDoctorLabPanelCatalogRequiresDoctorAcl(): void
    {
        $this->assertSame('new_doctor', $this->policy->requiresSingleAcl('doctor.lab_panel_catalog'));
    }

    public function testDoctorLabPanelPlaceRequiresDoctorAcl(): void
    {
        $this->assertSame('new_doctor', $this->policy->requiresSingleAcl('doctor.lab_panel_place'));
    }

    public function testLabTakeRequiresLabAcl(): void
    {
        $this->assertSame('new_lab', $this->policy->requiresSingleAcl('lab.take'));
    }

    public function testDoctorTakeRequiresDoctorAcl(): void
    {
        $this->assertSame('new_doctor', $this->policy->requiresSingleAcl('doctor.take'));
    }

    public function testDoctorReopenRequiresReopenAcl(): void
    {
        $this->assertSame('new_visit_reopen', $this->policy->requiresSingleAcl('doctor.reopen'));
    }

    public function testCloseZeroRequiresSupervisorAcl(): void
    {
        $this->assertSame('new_close_without_charge', $this->policy->requiresSingleAcl('cashier.close_zero'));
    }

    public function testLabSkipRequiresSkipQueueAcl(): void
    {
        $this->assertSame('new_visit_skip_queue', $this->policy->requiresSingleAcl('lab.skip_to_payment'));
    }

    public function testLabQueueUsesDeskAcl(): void
    {
        $desc = $this->policy->describe('lab.queue');
        $this->assertSame('desk_acl', $desc['type']);
    }

    public function testPharmacyTakeRequiresPharmacyAcl(): void
    {
        $this->assertSame('new_pharmacy', $this->policy->requiresSingleAcl('pharmacy.take'));
    }

    public function testPharmacySkipRequiresSkipQueueAcl(): void
    {
        $this->assertSame('new_visit_skip_queue', $this->policy->requiresSingleAcl('pharmacy.skip_to_payment'));
    }

    public function testAdminConfigSaveRequiresAdminAcl(): void
    {
        $this->assertSame('new_admin', $this->policy->requiresSingleAcl('admin.config.save'));
    }

    public function testVisitTypeSaveRequiresAdminAcl(): void
    {
        $this->assertSame('new_admin', $this->policy->requiresSingleAcl('admin.visit_type.save'));
    }

    public function testVisitTypeArchiveRequiresAdminAcl(): void
    {
        $this->assertSame('new_admin', $this->policy->requiresSingleAcl('admin.visit_type.archive'));
    }

    public function testFeeSaveRequiresFeeScheduleAdminAcl(): void
    {
        $this->assertSame('new_fee_schedule_admin', $this->policy->requiresSingleAcl('admin.fee.save'));
    }

    public function testCashierChargesPostRequiresCashierAcl(): void
    {
        $this->assertSame('new_cashier', $this->policy->requiresSingleAcl('cashier.charges.post'));
    }

    public function testFeesListAllowsCashierOrAdmin(): void
    {
        $desc = $this->policy->describe('fees.list');
        $this->assertSame('any_acl', $desc['type']);
        $this->assertContains('new_cashier', $desc['acls']);
        $this->assertContains('new_admin', $desc['acls']);
    }

    public function testAdminConfigRequiresAdminAcl(): void
    {
        $this->assertSame('new_admin', $this->policy->requiresSingleAcl('admin.config'));
        $desc = $this->policy->describe('admin.config');
        $this->assertSame('single_acl', $desc['type']);
        $this->assertSame('new_admin', $desc['acl']);
    }

    public function testReportsDailyRequiresReportsAcl(): void
    {
        $desc = $this->policy->describe('reports.daily');
        $this->assertSame('single_acl', $desc['type']);
        $this->assertSame('reports', $desc['acl']);
        $this->assertSame('reports', $this->policy->requiresSingleAcl('reports.daily'));
    }

    public function testHealthRequiresDeskAcl(): void
    {
        $desc = $this->policy->describe('health');
        $this->assertSame('desk_acl', $desc['type']);
    }

    public function testVisitTakeIsUnknown(): void
    {
        $this->assertSame('unknown', $this->policy->describe('visit.take')['type']);
    }

    public function testSessionBindUsesDeskAcl(): void
    {
        $desc = $this->policy->describe('session.bind');
        $this->assertSame('desk_acl', $desc['type']);
    }

    public function testPatientSearchUsesSearchAclGroup(): void
    {
        $desc = $this->policy->describe('patients.search');
        $this->assertSame('any_acl', $desc['type']);
        $this->assertContains('new_reception', $desc['acls']);
    }

    public function testPatientUpdateAllowsProfileEditRoles(): void
    {
        $desc = $this->policy->describe('patients.update');
        $this->assertSame('any_acl', $desc['type']);
        $this->assertContains('new_doctor', $desc['acls']);
        $this->assertContains('new_cashier', $desc['acls']);
    }

    public function testRegistrationGetAllowsProfileEditRoles(): void
    {
        $desc = $this->policy->describe('patients.registration.get');
        $this->assertSame('any_acl', $desc['type']);
        $this->assertContains('new_nurse', $desc['acls']);
    }

    public function testChartVisitsAllowsProfileEditRoles(): void
    {
        $desc = $this->policy->describe('patients.chart.visits');
        $this->assertSame('any_acl', $desc['type']);
        $this->assertContains('new_reception', $desc['acls']);
        $this->assertContains('new_doctor', $desc['acls']);
    }

    public function testChartReadAllowsLabAndPharmacy(): void
    {
        $preview = $this->policy->describe('patients.preview');
        $clinical = $this->policy->describe('patients.chart.clinical');
        $messages = $this->policy->describe('patients.chart.messages');
        $this->assertContains('new_lab', $preview['acls']);
        $this->assertContains('new_pharmacy', $preview['acls']);
        $this->assertContains('new_lab', $clinical['acls']);
        $this->assertContains('new_pharmacy', $clinical['acls']);
        $this->assertContains('new_doctor', $messages['acls']);
    }

    public function testPatientUpdateDoesNotAllowLabOrPharmacy(): void
    {
        $desc = $this->policy->describe('patients.update');
        $this->assertNotContains('new_lab', $desc['acls']);
        $this->assertNotContains('new_pharmacy', $desc['acls']);
    }

    public function testPatientSearchAllowsLabAndPharmacy(): void
    {
        $desc = $this->policy->describe('patients.search');
        $this->assertContains('new_lab', $desc['acls']);
        $this->assertContains('new_pharmacy', $desc['acls']);
    }

    public function testClinicalLabsSummaryUsesChartReadAcl(): void
    {
        $desc = $this->policy->describe('mrd.clinical_labs_summary');
        $this->assertSame('any_acl', $desc['type']);
        $this->assertContains('new_doctor', $desc['acls']);
        $this->assertContains('new_lab', $desc['acls']);
    }

    public function testClinicalMedsSummaryUsesChartReadAcl(): void
    {
        $desc = $this->policy->describe('mrd.clinical_meds_summary');
        $this->assertSame('any_acl', $desc['type']);
        $this->assertContains('new_doctor', $desc['acls']);
        $this->assertContains('new_pharmacy', $desc['acls']);
    }

    public function testExportBuilderUsesExportAcl(): void
    {
        $desc = $this->policy->describe('chart_depth.export_builder');
        $this->assertSame('any_acl', $desc['type']);
        $this->assertContains('new_chart_depth_export', $desc['acls']);
        $this->assertContains('new_admin', $desc['acls']);
    }

    public function testFeeImportRequiresFeeScheduleAdminAcl(): void
    {
        $this->assertSame('new_fee_schedule_admin', $this->policy->requiresSingleAcl('admin.fee.import'));
    }

    public function testGrantSelfRolesRequiresAdminAcl(): void
    {
        $this->assertSame('new_admin', $this->policy->requiresSingleAcl('admin.roles.grant_self'));
    }

    public function testCommunicationsHubCountsUsesCoreNotesAcl(): void
    {
        $desc = $this->policy->describe('communications.hub_counts');
        $this->assertSame('core_notes_acl', $desc['type']);
    }

    public function testCommunicationsMessageDoneUsesCoreNotesAcl(): void
    {
        $desc = $this->policy->describe('communications.message_done');
        $this->assertSame('core_notes_acl', $desc['type']);
    }

    public function testCommunicationsMessageStatusUsesCoreNotesAcl(): void
    {
        $desc = $this->policy->describe('communications.message_status');
        $this->assertSame('core_notes_acl', $desc['type']);
    }

    public function testCommunicationsAssignPatientUsesCoreNotesAcl(): void
    {
        $desc = $this->policy->describe('communications.assign_patient');
        $this->assertSame('core_notes_acl', $desc['type']);
    }

    public function testCommunicationsMessageDeleteUsesCoreNotesAcl(): void
    {
        $desc = $this->policy->describe('communications.message_delete');
        $this->assertSame('core_notes_acl', $desc['type']);
    }

    public function testCohortExportUsesCohortExportAcl(): void
    {
        $desc = $this->policy->describe('cohort.export');
        $this->assertSame('cohort_export_acl', $desc['type']);
    }

    public function testVisitStartFromAppointmentRequiresReceptionAcl(): void
    {
        $this->assertSame('new_reception', $this->policy->requiresSingleAcl('visit.start_from_appointment'));
    }

    public function testBillOpsDaysheetUsesCloseAcl(): void
    {
        $desc = $this->policy->describe('bill_ops.daysheet');
        $this->assertSame('bill_ops_close_acl', $desc['type']);
    }

    public function testBillOpsChargeCorrectUsesCorrectAcl(): void
    {
        $desc = $this->policy->describe('bill_ops.charge_correct');
        $this->assertSame('bill_ops_correct_acl', $desc['type']);
    }

    public function testBillOpsPaymentsSearchUsesPaymentAcl(): void
    {
        $desc = $this->policy->describe('bill_ops.payments_search');
        $this->assertSame('bill_ops_payment_acl', $desc['type']);
    }

    public function testBillOpsDaysheetExportUsesCloseAcl(): void
    {
        $desc = $this->policy->describe('bill_ops.daysheet_export');
        $this->assertSame('bill_ops_close_acl', $desc['type']);
    }
}

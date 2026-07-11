<?php

/**
 * New Clinic ACL installation
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

if ($aclSetupFlag !== true) {
    die(function_exists('xlt') ? xlt('Authentication Error') : 'Authentication Error');
}

use OpenEMR\Common\Acl\AclExtended;

$section = 'new_clinic';
$sectionTitle = 'New Clinic';

AclExtended::addObjectSectionAcl($section, $sectionTitle);

$acos = [
    'new_reception' => 'Reception Desk',
    'new_nurse' => 'Nurse Desk',
    'new_doctor' => 'Doctor Desk',
    'new_lab' => 'Lab Desk',
    'new_pharmacy' => 'Pharmacy Desk',
    'new_pharmacy_lead' => 'New Clinic Pharmacy Lead',
    'new_cashier' => 'Cashier Desk',
    'new_admin' => 'Clinic Admin',
    'new_create_despite_dup' => 'Create Despite Duplicate',
    'new_billing_skip_completion' => 'Skip Billing Completion',
    'new_revisit_skip_completion' => 'Skip Revisit Completion',
    'new_skip_triage' => 'Skip Triage',
    'new_visit_reopen' => 'Reopen Consult',
    'new_visit_return_to_doctor' => 'Return Visit to Doctor Queue',
    'new_visit_cancel' => 'Cancel Visit',
    'new_discount' => 'Apply Discount',
    'new_receipt_reprint' => 'Reprint Receipt',
    'new_fee_schedule_admin' => 'Fee Schedule Admin',
    'new_clinic_config_admin' => 'Clinic Config Admin',
    'new_visit_skip_queue' => 'Skip Lab/Pharmacy Queue',
    'new_visit_mark_outstanding' => 'Mark Left Unpaid',
    'new_close_without_charge' => 'Close Without Charge',
    'new_esign_skip_complete' => 'Skip E-Sign Gate',
    'new_chart_depth' => 'Chart Depth Read',
    'new_chart_depth_finance' => 'Chart Depth Payment History',
    'new_chart_depth_finance_summary' => 'Chart Depth Visit Charge Summary',
    'new_chart_depth_referral' => 'Chart Depth Referrals',
    'new_chart_depth_export' => 'Chart Depth Export',
    'new_chart_depth_export_full' => 'Chart Depth Full Export',
    'new_registry' => 'Patient Registry',
    'new_registry_export' => 'Patient Registry Export',
    'new_cohort_share_filter' => 'Patient Registry Share Filter',
    'new_lab_ops' => 'Lab Operations Hub',
    'new_lab_ops_enter' => 'Lab Operations Enter Results',
    'new_lab_ops_release' => 'Lab Operations Release Results',
    'new_lab_ops_catalog' => 'Lab Operations Catalog Admin',
    'new_lab_order_intake' => 'Lab Direct Order Intake',
    'new_start_ancillary_visit' => 'Start Ancillary Visit',
    'new_pharm_ops' => 'Pharmacy Operations Hub',
    'new_pharm_ops_dispense' => 'Pharmacy Operations Dispense',
    'new_pharm_ops_receive' => 'Pharmacy Operations Receive Stock',
    'new_pharm_ops_destroy' => 'Pharmacy Operations Destroy Lot',
    'new_pharm_ops_catalog' => 'Pharmacy Operations Catalog Setup',
    'new_pharmacy_undispensed_override' => 'Pharmacy Complete With Undispensed Rx',
    'new_pharmacy_external_rx_override' => 'Pharmacy External Rx Metadata Override',
    'new_rx_undocumented_allergy_override' => 'Rx Undocumented Allergy Override',
    'new_pharmacy_walkin_dispense' => 'Pharmacy Walk-in Dispense',
    'new_pharmacy_refer_to_opd' => 'Pharmacy Walk-in Refer / Close Without Dispense',
    'new_bill_ops' => 'Billing Back Office Hub',
    'new_bill_ops_correct' => 'Billing Charge Corrections',
    'new_bill_ops_payment' => 'Billing Payment Search',
    'new_bill_ops_close' => 'Billing Close Day',
    'new_bill_ops_outstanding' => 'Billing Outstanding Balances',
    'new_bill_ops_insurance' => 'Billing Insurance Vault',
    'reports' => 'Daily Reports',
    'new_reports_hub' => 'Reporting Operations Hub',
    'new_reports_clinical' => 'Reporting Clinical Lens',
    'new_reports_pharmacy' => 'Reporting Pharmacy Lens',
    'new_reports_financial' => 'Reporting Financial Lens',
    'new_reports_public_health' => 'Reporting Public Health Lens',
    'new_reports_audit' => 'Reporting Audit Lens',
    'new_clinical_doc_hub' => 'Clinical Documentation Hub',
    'new_clinical_doc_consult' => 'Clinical Documentation Consult Lens',
    'new_clinical_doc_screening' => 'Clinical Documentation Screening Lens',
    'new_clinical_doc_nursing' => 'Clinical Documentation Nursing Lens',
    'new_clinical_doc_orders' => 'Clinical Documentation Orders Lens',
    'new_clinical_doc_specialty' => 'Clinical Documentation Specialty Lens',
    'new_admin_hub_system' => 'Admin Hub System Health & Backup',
    'new_admin_hub_forms' => 'Admin Hub Forms Bundle',
    'new_admin_hub_people' => 'Admin Hub People & Access',
    'new_queue_bridge' => 'Queue Bridge Hub',
    'new_queue_bridge_resolve' => 'Queue Bridge Resolve Actions',
    'new_queue_bridge_dismiss' => 'Queue Bridge Dismiss Exceptions',
    'new_hard_assign_provider' => 'Hard Assign Provider',
    'new_take_assigned_override' => 'Take Hard-Assigned Visit Override',
];

foreach ($acos as $name => $title) {
    AclExtended::addObjectAcl($section, $sectionTitle, $name, $title);
}

$groups = [
    'new_reception' => 'New Clinic Reception',
    'new_reception_lead' => 'New Clinic Reception Lead',
    'new_nurse' => 'New Clinic Nurse',
    'new_nurse_lead' => 'New Clinic Nurse Lead',
    'new_doctor' => 'New Clinic Doctor',
    'new_lab' => 'New Clinic Lab',
    'new_lab_lead' => 'New Clinic Lab Lead',
    'new_pharmacy' => 'New Clinic Pharmacy',
    'new_pharmacy_lead' => 'New Clinic Pharmacy Lead',
    'new_cashier' => 'New Clinic Cashier',
    'new_cashier_lead' => 'New Clinic Cashier Lead',
    'new_admin' => 'New Clinic Admin',
];

$groupAcls = [];
foreach ($groups as $name => $title) {
    $groupAcls[$name] = AclExtended::addNewACL($title, $name, 'write', $title);
}

$deskMap = [
    'new_reception' => 'new_reception',
    'new_nurse' => 'new_nurse',
    'new_doctor' => 'new_doctor',
    'new_lab' => 'new_lab',
    'new_pharmacy' => 'new_pharmacy',
    'new_cashier' => 'new_cashier',
    'new_admin' => 'new_admin',
];

foreach ($deskMap as $group => $aco) {
    if (!empty($groupAcls[$group])) {
        AclExtended::updateAcl(
            $groupAcls[$group],
            $groups[$group],
            $section,
            $sectionTitle,
            $aco,
            $acos[$aco],
            'write'
        );
    }
}

$leadTierAco = 'new_pharmacy_lead';
if (!empty($groupAcls[$leadTierAco]) && isset($acos[$leadTierAco])) {
    AclExtended::updateAcl(
        $groupAcls[$leadTierAco],
        $groups[$leadTierAco],
        $section,
        $sectionTitle,
        $leadTierAco,
        $acos[$leadTierAco],
        'write'
    );
}

$extraGrants = [
    'new_reception_lead' => ['new_reception', 'new_create_despite_dup', 'new_skip_triage', 'new_visit_cancel', 'new_visit_skip_queue', 'new_visit_return_to_doctor', 'new_queue_bridge', 'new_queue_bridge_resolve', 'new_queue_bridge_dismiss', 'new_start_ancillary_visit', 'new_hard_assign_provider'],
    'new_nurse_lead' => ['new_nurse', 'new_skip_triage', 'new_cohort_share_filter', 'new_reports_clinical', 'new_clinical_doc_screening', 'new_hard_assign_provider'],
    'new_lab_lead' => ['new_lab', 'new_lab_ops', 'new_lab_ops_enter', 'new_lab_ops_release', 'new_lab_order_intake'],
    'new_pharmacy_lead' => ['new_pharmacy', 'new_pharm_ops', 'new_pharm_ops_dispense', 'new_pharm_ops_receive', 'new_pharm_ops_destroy', 'new_pharmacy_undispensed_override', 'new_pharmacy_external_rx_override', 'new_pharmacy_walkin_dispense', 'new_pharmacy_refer_to_opd', 'new_reports_pharmacy'],
    'new_cashier_lead' => ['new_cashier', 'new_billing_skip_completion', 'new_discount', 'new_visit_mark_outstanding', 'new_close_without_charge', 'new_receipt_reprint', 'new_esign_skip_complete', 'new_chart_depth', 'new_chart_depth_finance', 'new_chart_depth_referral', 'new_bill_ops', 'new_bill_ops_correct', 'new_bill_ops_payment', 'new_bill_ops_close', 'new_bill_ops_outstanding', 'new_reports_financial'],
    'new_admin' => array_keys($acos),
    'new_doctor' => ['new_doctor', 'new_visit_reopen', 'new_visit_skip_queue', 'new_chart_depth', 'new_chart_depth_finance_summary', 'new_chart_depth_referral', 'new_chart_depth_export', 'new_registry', 'new_registry_export', 'new_lab_ops', 'new_lab_order_intake', 'new_clinical_doc_hub', 'new_clinical_doc_consult', 'new_clinical_doc_screening', 'new_clinical_doc_orders', 'new_clinical_doc_specialty', 'new_take_assigned_override'],
    'new_nurse' => ['new_nurse', 'new_registry', 'new_registry_export', 'new_clinical_doc_hub', 'new_clinical_doc_nursing', 'new_visit_return_to_doctor'],
    'new_cashier' => ['new_cashier', 'new_receipt_reprint', 'new_chart_depth', 'new_chart_depth_finance'],
];

$roleAddonGrants = [
    'new_reception' => ['new_chart_depth_export'],
    'new_lab' => ['new_lab_ops', 'new_lab_ops_enter'],
    'new_pharmacy' => ['new_pharm_ops', 'new_pharm_ops_dispense', 'new_pharmacy_walkin_dispense', 'new_pharmacy_refer_to_opd'],
];

foreach ($roleAddonGrants as $group => $keys) {
    if (empty($groupAcls[$group])) {
        continue;
    }
    foreach ($keys as $aco) {
        if (!isset($acos[$aco])) {
            continue;
        }
        AclExtended::updateAcl(
            $groupAcls[$group],
            $groups[$group],
            $section,
            $sectionTitle,
            $aco,
            $acos[$aco],
            'write'
        );
    }
}

foreach ($extraGrants as $group => $keys) {
    if (empty($groupAcls[$group])) {
        continue;
    }
    foreach ($keys as $aco) {
        if (!isset($acos[$aco])) {
            continue;
        }
        AclExtended::updateAcl(
            $groupAcls[$group],
            $groups[$group],
            $section,
            $sectionTitle,
            $aco,
            $acos[$aco],
            'write'
        );
    }
}

// D-FIN-10 — pilot stock Ledger path: cashier groups need core acct/rep so the
// wrapped pat_ledger.php stays reachable until Chart Depth finance replaces it.
// D-EXP-11 — pilot stock Report path: reception groups need patients/pat_rep so
// the wrapped patient_report.php stays reachable until Chart Depth export ships.
$coreGrants = [
    'new_cashier' => [['acct', 'Accounting', 'rep', 'Financial Reporting - my encounters']],
    'new_cashier_lead' => [['acct', 'Accounting', 'rep', 'Financial Reporting - my encounters']],
    'new_reception' => [['patients', 'Patients', 'pat_rep', 'Patient Report']],
    'new_reception_lead' => [['patients', 'Patients', 'pat_rep', 'Patient Report']],
];

foreach ($coreGrants as $group => $grants) {
    if (empty($groupAcls[$group])) {
        continue;
    }
    foreach ($grants as [$coreSection, $coreSectionTitle, $coreAco, $coreAcoTitle]) {
        AclExtended::updateAcl(
            $groupAcls[$group],
            $groups[$group],
            $coreSection,
            $coreSectionTitle,
            $coreAco,
            $coreAcoTitle,
            'write'
        );
    }
}

?>
<html>
<head>
    <title>New Clinic ACL Setup</title>
    <link rel="stylesheet" href="interface/themes/style_blue.css">
</head>
<body>
<b>OpenEMR [New Clinic] ACL Setup</b><br>
All done configuring and installing access controls (php-GACL)!
</body>
</html>

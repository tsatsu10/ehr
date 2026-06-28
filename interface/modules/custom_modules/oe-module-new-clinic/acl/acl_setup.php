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
    'new_cashier' => 'Cashier Desk',
    'new_admin' => 'Clinic Admin',
    'new_create_despite_dup' => 'Create Despite Duplicate',
    'new_billing_skip_completion' => 'Skip Billing Completion',
    'new_revisit_skip_completion' => 'Skip Revisit Completion',
    'new_skip_triage' => 'Skip Triage',
    'new_visit_reopen' => 'Reopen Consult',
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
    'reports' => 'Daily Reports',
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

$extraGrants = [
    'new_reception_lead' => ['new_reception', 'new_create_despite_dup', 'new_skip_triage', 'new_visit_cancel', 'new_visit_skip_queue'],
    'new_nurse_lead' => ['new_nurse', 'new_skip_triage', 'new_cohort_share_filter'],
    'new_lab_lead' => ['new_lab', 'new_lab_ops', 'new_lab_ops_enter', 'new_lab_ops_release'],
    'new_pharmacy_lead' => ['new_pharmacy'],
    'new_cashier_lead' => ['new_cashier', 'new_billing_skip_completion', 'new_discount', 'new_visit_mark_outstanding', 'new_close_without_charge', 'new_receipt_reprint', 'new_esign_skip_complete', 'new_chart_depth', 'new_chart_depth_finance', 'new_chart_depth_referral'],
    'new_admin' => array_keys($acos),
    'new_doctor' => ['new_doctor', 'new_visit_reopen', 'new_visit_skip_queue', 'new_chart_depth', 'new_chart_depth_referral', 'new_chart_depth_export', 'new_registry', 'new_registry_export', 'new_lab_ops'],
    'new_nurse' => ['new_nurse', 'new_registry', 'new_registry_export'],
    'new_cashier' => ['new_cashier', 'new_receipt_reprint', 'new_chart_depth', 'new_chart_depth_finance'],
];

$roleAddonGrants = [
    'new_reception' => ['new_chart_depth_export'],
    'new_lab' => ['new_lab_ops', 'new_lab_ops_enter'],
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

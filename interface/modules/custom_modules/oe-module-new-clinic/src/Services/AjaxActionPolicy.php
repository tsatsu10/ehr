<?php

/**
 * ACL and HTTP policy for New Clinic AJAX actions (testable contract)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class AjaxActionPolicy
{
    /** @var array<int, string> Roles that may open patient chart read APIs (MRD D-MRD-13) */
    public const CHART_READ_ACLS = [
        'new_reception', 'new_nurse', 'new_doctor', 'new_lab',
        'new_pharmacy', 'new_cashier', 'new_admin',
    ];

    /** @var array<string, string> action => single ACL */
    private const SINGLE_ACL = [
        'patients.dup_check' => 'new_reception',
        'patients.create' => 'new_reception',
        'visit.cancel' => 'new_visit_cancel',
        'visit.start' => 'new_reception',
        'visit.start_from_appointment' => 'new_reception',
        'visit.skip_triage' => 'new_skip_triage',
        'visit.queue_slip' => 'new_reception',
        'front_desk.revisit_awaiting_documents' => 'new_reception',
        'doctor.take' => 'new_doctor',
        'doctor.active' => 'new_doctor',
        'doctor.complete' => 'new_doctor',
        'doctor.reopen' => 'new_visit_reopen',
        'doctor.set_supervisor' => 'new_doctor',
        'doctor.search_providers' => 'new_doctor',
        'doctor.shortcut_preflight' => 'new_doctor',
        'doctor.restore_session' => 'new_doctor',
        'doctor.lab_panel_catalog' => 'new_doctor',
        'doctor.lab_panel_place' => 'new_doctor',
        'doctor.formulary_rx_catalog' => 'new_doctor',
        'doctor.formulary_rx_place' => 'new_doctor',
        'triage.restore_session' => 'new_nurse',
        'triage.select' => 'new_nurse',
        'triage.start' => 'new_nurse',
        'triage.save_vitals' => 'new_nurse',
        'triage.send_doctor' => 'new_nurse',
        'triage.auto_start' => 'new_nurse',
        'cashier.select' => 'new_cashier',
        'cashier.resolve_patient' => 'new_cashier',
        'cashier.charges.post' => 'new_cashier',
        'cashier.pay' => 'new_cashier',
        'cashier.mark_unpaid' => 'new_visit_mark_outstanding',
        'cashier.close_zero' => 'new_close_without_charge',
        'lab.select' => 'new_lab',
        'lab.take' => 'new_lab',
        'lab.complete' => 'new_lab',
        'lab.shortcut_preflight' => 'new_lab',
        'lab.restore_session' => 'new_lab',
        'lab.skip_to_payment' => 'new_visit_skip_queue',
        'pharmacy.select' => 'new_pharmacy',
        'pharmacy.take' => 'new_pharmacy',
        'pharmacy.complete' => 'new_pharmacy',
        'pharmacy.shortcut_preflight' => 'new_pharmacy',
        'pharmacy.restore_session' => 'new_pharmacy',
        'pharmacy.skip_to_payment' => 'new_visit_skip_queue',
        'admin.config' => 'new_admin',
        'admin.config.save' => 'new_admin',
        'admin.visit_type.save' => 'new_admin',
        'admin.visit_type.archive' => 'new_admin',
        'admin.fee.save' => 'new_fee_schedule_admin',
        'admin.fee.archive' => 'new_fee_schedule_admin',
        'admin.fee.billing_codes' => 'new_fee_schedule_admin',
        'admin.fee.import' => 'new_fee_schedule_admin',
        'admin.roles.grant_self' => 'new_admin',
        'admin.reconciliation.run' => 'new_admin',
        'admin.profile.apply_cash_clinic' => 'new_admin',
        'reports.daily' => 'reports',
        'reports.reconciliation' => 'reports',
    ];

    /** @var array<int, string> */
    private const DESK_ACL_ANY = [
        'new_reception', 'new_nurse', 'new_doctor', 'new_lab',
        'new_pharmacy', 'new_cashier', 'new_admin', 'reports',
    ];

    /** @var array<int, string> */
    private const SEARCH_ACL_ANY = [
        'new_reception', 'new_nurse', 'new_doctor', 'new_lab',
        'new_pharmacy', 'new_cashier', 'new_admin',
    ];

    /** @var array<int, string> */
    private const PROFILE_EDIT_ACL_ANY = [
        'new_reception', 'new_nurse', 'new_doctor', 'new_cashier', 'new_admin',
    ];

    /** @var array<int, string> */
    private const COHORT_ACTIONS = [
        'cohort.search',
        'cohort.presets',
        'cohort.saved_filter',
    ];

    /** @var array<int, string> */
    private const COHORT_EXPORT_ACTIONS = [
        'cohort.export',
    ];

    /** @var array<int, string> */
    private const COMMUNICATIONS_ACTIONS = [
        'communications.hub_counts',
        'communications.messages_list',
        'communications.message_detail',
        'communications.reminders_list',
        'communications.message_done',
        'communications.message_status',
        'communications.assign_patient',
        'communications.message_delete',
        'communications.reminder_done',
        'communications.compose_options',
        'communications.message_send',
        'communications.reminder_create_options',
        'communications.reminder_create',
        'communications.reminder_log',
        'communications.save_preferences',
    ];

    /** @var array<int, string> */
    private const LAB_OPS_READ_ACTIONS = [
        'lab_ops.worklist',
        'lab_ops.result_get',
        'lab_ops.setup_status',
    ];

    /** @var array<int, string> */
    private const LAB_OPS_ENTER_ACTIONS = [
        'lab_ops.result_save',
        'lab_ops.specimen_collect',
        'lab_ops.mark_send_out',
    ];

    /** @var array<int, string> */
    private const LAB_OPS_RELEASE_ACTIONS = [
        'lab_ops.result_release',
    ];

    /** @var array<int, string> */
    private const LAB_OPS_CATALOG_ACTIONS = [
        'lab_ops.panel_import',
        'lab_ops.fee_map_list',
        'lab_ops.fee_map_save',
        'lab_ops.setup_model',
        'lab_ops.provider_create',
        'lab_ops.sendout_provider_create',
    ];

    /** @var array<int, string> */
    private const PHARM_OPS_READ_ACTIONS = [
        'pharm_ops.worklist',
        'pharm_ops.dispense_get',
        'pharm_ops.otc_drugs_search',
        'pharm_ops.otc_sale_get',
        'pharm_ops.setup_status',
        'pharm_ops.reports_embed',
    ];

    /** @var array<int, string> */
    private const PHARM_OPS_DESTROY_ACTIONS = [
        'pharm_ops.destroy_get',
        'pharm_ops.destroy_confirm',
    ];

    /** @var array<int, string> */
    private const PHARM_OPS_RX_PRINT_ACTIONS = [
        'pharm_ops.rx_print_pdf',
    ];

    /** @var array<int, string> */
    private const PHARM_OPS_DISPENSE_LABEL_ACTIONS = [
        'pharm_ops.dispense_label_pdf',
    ];

    /** @var array<int, string> */
    private const PHARM_OPS_DISPENSE_ACTIONS = [
        'pharm_ops.dispense_confirm',
        'pharm_ops.otc_sale_confirm',
    ];

    /** @var array<int, string> */
    private const PHARM_OPS_RECEIVE_ACTIONS = [
        'pharm_ops.receive_get',
        'pharm_ops.receive_save',
    ];

    /** @var array<int, string> */
    private const PHARM_OPS_RECEIVE_ACLS = [
        'new_pharm_ops_receive',
        'new_pharmacy_lead',
        'new_admin',
    ];

    /** @var array<int, string> */
    private const PHARM_OPS_CATALOG_ACTIONS = [
        'pharm_ops.warehouse_create',
        'pharm_ops.formulary_import',
        'pharm_ops.controlled_catalog',
        'pharm_ops.controlled_catalog_save',
    ];

    /** @var array<int, string> */
    private const REPORT_HUB_READ_ACTIONS = [
        'reports.hub_summary',
        'reports.catalog',
    ];

    /** @var array<int, string> */
    private const REPORT_HUB_EXPORT_ACTIONS = [
        'reports.export_run',
    ];

    /** @var array<int, string> */
    private const BILL_OPS_CORRECT_READ_ACTIONS = [
        'bill_ops.visit_charges',
    ];

    /** @var array<int, string> */
    private const BILL_OPS_CORRECT_WRITE_ACTIONS = [
        'bill_ops.charge_correct',
    ];

    /** @var array<int, string> */
    private const BILL_OPS_PAYMENT_ACTIONS = [
        'bill_ops.payments_search',
        'bill_ops.payment_reverse',
    ];

    /** @var array<int, string> */
    private const BILL_OPS_CLOSE_ACTIONS = [
        'bill_ops.daysheet',
        'bill_ops.daysheet_export',
    ];

    /** @var array<int, string> */
    private const BILL_OPS_OUTSTANDING_ACTIONS = [
        'bill_ops.outstanding_list',
    ];

    /** @var array<int, string> */
    private const BILL_OPS_CORRECT_ACLS = [
        'new_bill_ops_correct',
        'new_admin',
    ];

    /** @var array<int, string> */
    private const BILL_OPS_PAYMENT_ACLS = [
        'new_bill_ops_payment',
        'new_admin',
    ];

    /** @var array<int, string> */
    private const BILL_OPS_CLOSE_ACLS = [
        'new_bill_ops_close',
        'new_admin',
    ];

    /** @var array<int, string> */
    private const BILL_OPS_OUTSTANDING_ACLS = [
        'new_bill_ops_outstanding',
        'new_admin',
    ];

    /** @var array<int, string> */
    private const LAB_OPS_READ_ACLS = [
        'new_lab_ops',
        'new_lab',
        'new_lab_lead',
        'new_doctor',
        'new_admin',
    ];

    /** @var array<int, string> */
    private const LAB_OPS_ENTER_ACLS = [
        'new_lab_ops_enter',
        'new_lab',
        'new_lab_lead',
        'new_admin',
    ];

    /** @var array<int, string> */
    private const LAB_OPS_RELEASE_ACLS = [
        'new_lab_ops_release',
        'new_lab_lead',
        'new_admin',
    ];

    /** @var array<int, string> */
    private const RECEIPT_REPRINT_ACLS = [
        'new_receipt_reprint',
        'new_chart_depth_finance',
        'new_admin',
    ];

    /** @var array<int, string> */
    private const EXPORT_ACTIONS = [
        'chart_depth.export_builder',
        'chart_depth.export_generate',
    ];

    /** @var array<int, string> */
    private const EXPORT_ACL_ANY = [
        'new_chart_depth_export',
        'new_chart_depth_export_full',
        'new_admin',
    ];

    /** @var array<int, string> */
    private const RECEIPT_REPRINT_ACTIONS = [
        'chart_depth.receipt_reprint',
    ];

    /** @var array<int, string> */
    private const CHART_READ_ACTIONS = [
        'patients.preview',
        'patients.registration.get',
        'patients.chart.visits',
        'patients.chart.clinical',
        'patients.chart.activity_feed',
        'patients.chart.messages',
        'mrd.profile_payments_summary',
        'chart_depth.payments_list',
        'mrd.clinical_referrals_strip',
        'mrd.clinical_labs_summary',
        'mrd.clinical_meds_summary',
        'chart_depth.referrals_list',
    ];

    /** @var array<string, true> */
    private const DEPRECATED = [
        'visit.transition' => true,
    ];

    /**
     * @return array{type: string, acl?: string, acls?: array<int, string>, deprecated?: bool}
     */
    public function describe(string $action): array
    {
        if (isset(self::DEPRECATED[$action])) {
            return ['type' => 'deprecated', 'deprecated' => true];
        }

        if ($action === 'health') {
            return ['type' => 'desk_acl'];
        }

        if (isset(self::SINGLE_ACL[$action])) {
            return ['type' => 'single_acl', 'acl' => self::SINGLE_ACL[$action]];
        }

        if (in_array($action, ['patients.search', 'visit.types', 'admin.geo.regions', 'admin.geo.districts'], true)) {
            return ['type' => 'any_acl', 'acls' => self::SEARCH_ACL_ANY];
        }

        if (in_array($action, self::EXPORT_ACTIONS, true)) {
            return ['type' => 'any_acl', 'acls' => self::EXPORT_ACL_ANY];
        }

        if (in_array($action, self::COMMUNICATIONS_ACTIONS, true)) {
            return ['type' => 'core_notes_acl'];
        }

        if (in_array($action, self::LAB_OPS_READ_ACTIONS, true)) {
            return ['type' => 'lab_ops_read_acl'];
        }

        if (in_array($action, self::LAB_OPS_ENTER_ACTIONS, true)) {
            return ['type' => 'lab_ops_enter_acl'];
        }

        if (in_array($action, self::LAB_OPS_RELEASE_ACTIONS, true)) {
            return ['type' => 'lab_ops_release_acl'];
        }

        if (in_array($action, self::LAB_OPS_CATALOG_ACTIONS, true)) {
            return ['type' => 'lab_ops_catalog_acl'];
        }

        if (in_array($action, self::PHARM_OPS_READ_ACTIONS, true)) {
            return ['type' => 'pharm_ops_read_acl'];
        }

        if (in_array($action, self::PHARM_OPS_DISPENSE_ACTIONS, true)) {
            return ['type' => 'pharm_ops_dispense_acl'];
        }

        if (in_array($action, self::PHARM_OPS_RECEIVE_ACTIONS, true)) {
            return ['type' => 'pharm_ops_receive_acl'];
        }

        if (in_array($action, self::PHARM_OPS_DESTROY_ACTIONS, true)) {
            return ['type' => 'pharm_ops_destroy_acl'];
        }

        if (in_array($action, self::PHARM_OPS_RX_PRINT_ACTIONS, true)) {
            return ['type' => 'pharm_ops_rx_print_acl'];
        }

        if (in_array($action, self::PHARM_OPS_DISPENSE_LABEL_ACTIONS, true)) {
            return ['type' => 'pharm_ops_dispense_label_acl'];
        }

        if (in_array($action, self::PHARM_OPS_CATALOG_ACTIONS, true)) {
            return ['type' => 'pharm_ops_catalog_acl'];
        }

        if (in_array($action, self::BILL_OPS_CORRECT_READ_ACTIONS, true)
            || in_array($action, self::BILL_OPS_CORRECT_WRITE_ACTIONS, true)) {
            return ['type' => 'bill_ops_correct_acl'];
        }

        if (in_array($action, self::BILL_OPS_PAYMENT_ACTIONS, true)) {
            return ['type' => 'bill_ops_payment_acl'];
        }

        if (in_array($action, self::BILL_OPS_CLOSE_ACTIONS, true)) {
            return ['type' => 'bill_ops_close_acl'];
        }

        if (in_array($action, self::BILL_OPS_OUTSTANDING_ACTIONS, true)) {
            return ['type' => 'bill_ops_outstanding_acl'];
        }

        if (in_array($action, self::REPORT_HUB_READ_ACTIONS, true)) {
            return ['type' => 'report_hub_read_acl'];
        }

        if (in_array($action, self::REPORT_HUB_EXPORT_ACTIONS, true)) {
            return ['type' => 'report_hub_export_acl'];
        }

        if (in_array($action, self::COHORT_ACTIONS, true)) {
            return ['type' => 'cohort_acl'];
        }

        if (in_array($action, self::COHORT_EXPORT_ACTIONS, true)) {
            return ['type' => 'cohort_export_acl'];
        }

        if (in_array($action, self::CHART_READ_ACTIONS, true)) {
            return ['type' => 'any_acl', 'acls' => self::CHART_READ_ACLS];
        }

        if (in_array($action, self::RECEIPT_REPRINT_ACTIONS, true)) {
            return ['type' => 'any_acl', 'acls' => self::RECEIPT_REPRINT_ACLS];
        }

        if ($action === 'patients.update') {
            return ['type' => 'any_acl', 'acls' => self::PROFILE_EDIT_ACL_ANY];
        }

        if ($action === 'fees.list') {
            return ['type' => 'any_acl', 'acls' => ['new_cashier', 'new_admin', 'new_fee_schedule_admin']];
        }

        if (in_array($action, [
            'queue.list', 'visit.board', 'visit.detail', 'queue.counts',
            'triage.queue', 'doctor.queue', 'cashier.queue', 'lab.queue', 'pharmacy.queue',
            'desk.shared_session_probe', 'front_desk.desk_stats', 'front_desk.todays_appointments',
            'front_desk.recently_viewed', 'front_desk.recently_viewed.remember', 'front_desk.recently_viewed.clear',
        ], true)) {
            return ['type' => 'desk_acl'];
        }

        if ($action === 'switch_role') {
            return ['type' => 'desk_acl'];
        }

        if ($action === 'session.bind') {
            return ['type' => 'desk_acl', 'note' => 'plus visit-state desk ACL at bind time'];
        }

        return ['type' => 'unknown'];
    }

    public function isChartReadAction(string $action): bool
    {
        return in_array($action, self::CHART_READ_ACTIONS, true);
    }

    public function defersAuthorizationToHandler(string $action): bool
    {
        return $this->isChartReadAction($action) || in_array($action, self::EXPORT_ACTIONS, true);
    }

    public function isExportAction(string $action): bool
    {
        return in_array($action, self::EXPORT_ACTIONS, true);
    }

    public function isDeprecated(string $action): bool
    {
        return isset(self::DEPRECATED[$action]);
    }

    public function requiresSingleAcl(string $action): ?string
    {
        return self::SINGLE_ACL[$action] ?? null;
    }
}

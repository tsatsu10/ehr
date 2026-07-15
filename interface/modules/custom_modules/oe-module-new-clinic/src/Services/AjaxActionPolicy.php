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
        'visit.hard_assign' => 'new_hard_assign_provider',
        'visit.start' => 'new_reception',
        'visit.start_from_appointment' => 'new_reception',
        'visit.skip_triage' => 'new_skip_triage',
        'visit.send_back_to_doctor' => 'new_visit_return_to_doctor',
        'front_desk.revisit_awaiting_documents' => 'new_reception',
        'front_desk.upload_referral' => 'new_reception',
        'doctor.take' => 'new_doctor',
        'doctor.start_walk_in' => 'new_doctor',
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
        'doctor.roster.set_taking' => 'new_doctor',
        'triage.restore_session' => 'new_nurse',
        'triage.select' => 'new_nurse',
        'triage.start' => 'new_nurse',
        'triage.save_vitals' => 'new_nurse',
        'triage.send_doctor' => 'new_nurse',
        'triage.auto_start' => 'new_nurse',
        'triage.set_urgent' => 'new_nurse',
        'cashier.select' => 'new_cashier',
        'cashier.resolve_patient' => 'new_cashier',
        'cashier.charges.post' => 'new_cashier',
        'cashier.pay' => 'new_cashier',
        'cashier.pay_partial' => 'new_visit_mark_outstanding',
        'cashier.scheme.list' => 'new_cashier',
        'cashier.scheme.pay' => 'new_cashier',
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
        'pharmacy.walkin_close' => 'new_pharmacy',
        'pharmacy.shortcut_preflight' => 'new_pharmacy',
        'pharmacy.restore_session' => 'new_pharmacy',
        'pharmacy.skip_to_payment' => 'new_visit_skip_queue',
        'pharmacy.rx_history' => 'new_pharmacy',
        'admin.config' => 'new_admin',
        'admin.config.save' => 'new_admin',
        'admin.visit_type.save' => 'new_admin',
        'admin.visit_type.archive' => 'new_admin',
        'admin.fee.save' => 'new_fee_schedule_admin',
        'admin.fee.archive' => 'new_fee_schedule_admin',
        'admin.fee.billing_codes' => 'new_fee_schedule_admin',
        'admin.fee.import' => 'new_fee_schedule_admin',
        'admin.fee.bulk_price' => 'new_fee_schedule_admin',
        'admin.lists.catalog' => 'new_admin',
        'admin.lists.options' => 'new_admin',
        'admin.lists.save' => 'new_admin',
        'admin.lists.set_active' => 'new_admin',
        'admin.duplicates.list' => 'new_admin',
        'admin.directory.save' => 'new_admin',
        'admin.directory.delete' => 'new_admin',
        'outreach.presets' => 'new_admin',
        'outreach.preview' => 'new_admin',
        'outreach.queue' => 'new_admin',
        'outreach.history' => 'new_admin',
        'admin.roles.grant_self' => 'new_admin',
        'admin.roles.templates' => 'new_admin',
        'admin.staff.list' => 'new_admin',
        'admin.staff.create' => 'new_admin',
        'admin.staff.deactivate' => 'new_admin',
        'admin.staff.access_summary' => 'new_admin',
        'admin.audit.query' => 'new_admin',
        'admin.audit.detail' => 'new_admin',
        'admin.audit.export' => 'new_admin',
        'admin.backup.verify' => 'new_admin',
        'admin.backup.export_recovery_key' => 'new_admin',
        'admin.facility_user.list' => 'new_admin',
        'admin.facility_user.get' => 'new_admin',
        'admin.facility_user.save' => 'new_admin',
        'admin.facility_user.matrix' => 'new_admin',
        'admin.acl.users' => 'new_admin',
        'admin.acl.membership' => 'new_admin',
        'admin.acl.membership_add' => 'new_admin',
        'admin.acl.membership_remove' => 'new_admin',
        'admin.acl.groups' => 'new_admin',
        'admin.acl.group_permissions' => 'new_admin',
        'admin.acl.group_permissions_add' => 'new_admin',
        'admin.acl.group_permissions_remove' => 'new_admin',
        'admin.acl.return_values' => 'new_admin',
        'admin.acl.group_create' => 'new_admin',
        'admin.acl.group_remove' => 'new_admin',
        'admin.staff.get' => 'new_admin',
        'admin.staff.update' => 'new_admin',
        'admin.staff.reset_password' => 'new_admin',
        'admin.staff.locked_list' => 'new_admin',
        'admin.staff.unlock' => 'new_admin',
        'admin.reconciliation.run' => 'new_admin',
        'admin.profile.apply_cash_clinic' => 'new_admin',
        'admin.forms_catalog.set_state' => 'new_admin',
        'admin.his_pack_status' => 'new_admin',
        'admin.his_pack_import' => 'new_admin',
        'chart_depth.referral_save' => 'new_chart_depth_referral',
        'chart_depth.referral_print' => 'new_chart_depth_referral',
        'chart_depth.referral_status' => 'new_chart_depth_referral',
        'admin.health_status' => 'new_admin',
        'admin.perf.summary' => 'new_admin',
        'admin.backup.run' => 'new_admin',
        'admin.backup.run_files' => 'new_admin',
        'admin.backup.complete' => 'new_admin',
        'admin.setup.mark_item' => 'new_admin',
        'admin.setup.complete' => 'new_admin',
        'admin.config.export' => 'new_admin',
        'admin.config.import' => 'new_admin',
        'admin.completion_weights.save' => 'new_admin',
        'clinical_doc.import_ghana_pack' => 'new_admin',
        'clinical_doc.import_referral_hospital_pack' => 'new_admin',
        'clinical_doc.import_ancillary_pack' => 'new_admin',
        'reports.daily' => 'reports',
        'reports.reconciliation' => 'reports',
        'reports.ancillary_export' => 'reports',
        'reports.documentation_integrity_export' => 'reports',
        // SEC-1: report reads must match their export siblings (reports-gated),
        // not any-desk-role — they return cross-patient operational/clinical
        // status (e.g. documentation_integrity lists unsigned encounters).
        'reports.ancillary' => 'reports',
        'reports.documentation_integrity' => 'reports',
        'reports.scheduling' => 'reports',
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
    // Profile (demographics) editing is limited to the front-of-house roles that
    // own patient registration data: front desk, nurse, and admin. Doctors,
    // cashiers, lab and pharmacy get a read-only chart profile (they view, the
    // chart's Edit button is hidden). Gates patients.update.
    private const PROFILE_EDIT_ACL_ANY = [
        'new_reception', 'new_nurse', 'new_admin',
    ];

    /** @var array<int, string> */
    private const PROFILE_ACTIONS = [
        'profile.get',
        'profile.update',
        'profile.change_password',
        'profile.mfa.status',
        'profile.mfa.enroll_start',
        'profile.mfa.enroll_verify',
        'profile.mfa.remove',
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
        'cohort.export_status',
        'cohort.export_download',
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

    /** @var array<int, string> Office Notes (GAP-A / A1) — core encounters/notes ACL */
    private const OFFICE_NOTES_ACTIONS = [
        'onotes.list',
        'onotes.save',
        'onotes.archive',
        'onotes.pin',
        'onotes.delete',
    ];

    /** @var array<int, string> Documents manager (GAP-A / A2) — core patients/docs ACL */
    private const DOCUMENTS_ACTIONS = [
        'documents.list',
        'documents.categories',
        'documents.upload',
        'documents.recategorize',
        'documents.delete',
        'documents.unfiled_list',
        'documents.assign_patient',
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
        'lab_ops.specimen_reject',
        'lab_ops.mark_send_out',
    ];

    /** @var array<int, string> */
    private const LAB_OPS_RELEASE_ACTIONS = [
        'lab_ops.result_release',
        'lab_ops.result_amend',
    ];

    /** @var array<int, string> */
    private const LAB_OPS_CATALOG_ACTIONS = [
        'lab_ops.panel_import',
        'lab_ops.fee_map_list',
        'lab_ops.fee_map_save',
        'lab_ops.qc_rules_list',
        'lab_ops.qc_rule_save',
        'lab_ops.qc_rule_reset',
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
        'pharm_ops.inventory.reorder',
        'pharm_ops.inventory.destroyed',
        'pharm_ops.inventory.activity',
        'pharm_ops.inventory.transactions',
        'pharm_ops.inventory.prescriptions',
        'pharm_ops.inventory.stock_list',
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
        // Stock adjustment (row Adjust + stock-take) is a stock-management write,
        // gated at the same receive level; POST + CSRF, never read-only.
        'pharm_ops.inventory.adjust',
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
        'pharm_ops.catalog_list',
        'pharm_ops.catalog_save',
    ];

    /** @var array<int, string> */
    private const SCHEDULING_READ_ACTIONS = [
        'scheduling.flow_board.list',
        'scheduling.flow_board.poll',
        'scheduling.flow_board.prefs',
        'scheduling.flow_board.lane_map',
        'scheduling.calendar.range',
        'scheduling.calendar.poll',
        'scheduling.recalls.list',
    ];

    /** @var array<int, string> */
    private const SCHEDULING_WRITE_ACTIONS = [
        'scheduling.flow_board.advance',
        'scheduling.flow_board.room',
        'scheduling.flow_board.prefs.save',
        'scheduling.flow_board.lane_map.save',
        'scheduling.calendar.book',
        'scheduling.calendar.move',
        'scheduling.calendar.resize',
        'scheduling.recalls.save',
        'scheduling.recalls.delete',
        'scheduling.recalls.update_status',
        'scheduling.recalls.snooze',
        'scheduling.recalls.send_reminder',
        'scheduling.recalls.flag_follow_up',
    ];

    /** @var array<int, string> */
    private const QUEUE_BRIDGE_READ_ACTIONS = [
        'queue_bridge.list',
        'queue_bridge.eod_export',
    ];

    /** @var array<int, string> */
    private const QUEUE_BRIDGE_RESOLVE_ACTIONS = [
        'queue_bridge.resolve',
        'queue_bridge.link_appointment',
    ];

    /** @var array<int, string> */
    private const QUEUE_BRIDGE_DISMISS_ACTIONS = [
        'queue_bridge.dismiss',
    ];

    /** @var array<int, string> */
    private const REPORT_HUB_READ_ACTIONS = [
        'reports.hub_summary',
        'reports.catalog',
    ];

    /** @var array<int, string> */
    private const REPORT_HUB_EXPORT_ACTIONS = [
        'reports.export_run',
        'reports.run',
        'reports.export',
        'reports.export_status',
        'reports.export_download',
    ];

    /** @var array<int, string> */
    private const CLINICAL_DOC_READ_ACTIONS = [
        'clinical_doc.visit_summary',
        'clinical_doc.catalog',
        'clinical_doc.sign_status',
        'clinical_doc.favorites',
    ];

    /** @var array<int, string> */
    private const CLINICAL_DOC_WRITE_ACTIONS = [
        'clinical_doc.open_form',
        // D3 native procedure-order form — form bootstrap + save. Both require
        // clinical-doc write access (the service also calls assertWriteAccess()).
        'proc_order.form_data',
        'proc_order.save',
    ];

    /** @var array<int, string> */
    private const ENCOUNTER_NOTE_ACTIONS = [
        'encounter_note.get',
        'encounter_note.prefill',
        'encounter_note.save',
        'encounter_note.validate',
        'encounter_note.sign',
        'encounter_note.unlock',
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
        'bill_ops.receipt_reprint',
    ];

    /** @var array<int, string> */
    private const BILL_OPS_CLOSE_ACTIONS = [
        'bill_ops.daysheet',
        'bill_ops.daysheet_export',
        'bill_ops.momo_save',
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

    /**
     * The native Add/Edit Rx form (rx-edit island) is shared: the Pharmacy Desk
     * reaches it from "Add Rx", and the Doctor Desk reaches it from "Full Rx
     * form" during consult. Both roles legitimately prescribe, so these actions
     * are any-of rather than pharmacy-only.
     *
     * @var array<int, string>
     */
    private const RX_FORM_ACTIONS = [
        'pharmacy.rx_form_data',
        'pharmacy.rx_search_drugs',
        'pharmacy.rx_save',
    ];

    /** @var array<int, string> */
    private const RX_FORM_ACLS = [
        'new_pharmacy',
        'new_pharmacy_lead',
        'new_doctor',
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
        'patients.chart.issue_get',
        'patients.chart.issue_save',
        'patients.chart.history_get',
        'patients.chart.history_save',
        'patients.chart.immunization_options',
        'patients.chart.immunization_get',
        'patients.chart.immunization_save',
        'patients.chart.activity_feed',
        'patients.chart.messages',
        'patients.chart.search',
        'mrd.profile_payments_summary',
        'chart_depth.payments_list',
        'chart_depth.visit_charges_summary',
        'mrd.clinical_referrals_strip',
        'mrd.clinical_labs_summary',
        'mrd.clinical_meds_summary',
        'mrd.clinical_vitals_series',
        'chart_depth.referrals_list',
        'letters.templates',
        'letters.render',
    ];

    /**
     * Extra ACL gate(s) applied in AjaxController before chart-read for deferred handlers.
     * Values must stay aligned with inline handler checks (AUDIT-6).
     *
     * @var array<string, array<int, string>>
     */
    private const DEFERRED_PRIMARY_ACLS = [
        'chart_depth.payments_list' => ['new_chart_depth_finance'],
        'chart_depth.visit_charges_summary' => ['new_chart_depth_finance_summary', 'new_chart_depth_finance'],
        'chart_depth.receipt_reprint' => ['new_receipt_reprint', 'new_chart_depth_finance'],
        'chart_depth.referrals_list' => ['new_chart_depth_referral', 'new_chart_depth'],
        'letters.templates' => ['new_chart_depth_referral', 'new_chart_depth'],
        'letters.render' => ['new_chart_depth_referral', 'new_chart_depth'],
    ];

    /** @var array<string, true> */
    private const DEPRECATED = [
        'visit.transition' => true,
    ];

    /**
     * SCALE-1.1 — actions safe to release the PHP session lock for
     * (`session_write_close()`) before dispatch, so concurrent tabs/requests from
     * one user stop serializing on the session file.
     *
     * MEMBERSHIP RULE (safety): an action belongs here ONLY if its handler + service
     * chain performs NO `$_SESSION` writes (a write after close is silently dropped)
     * and does no mutation. Verified against every `$_SESSION[...] =` site in the
     * module: the writers are encounter/patient context binding (take/select/restore),
     * MFA enrol, product-reg dismiss, session role switch, and the (now guarded)
     * desk-facility fallback — none of which are listed here. DEFAULT IS LOCKED:
     * anything not in this set keeps the lock, so a forgotten new action is merely
     * un-optimised, never incorrect.
     *
     * SCALE-3.1: `patients.search` / `patients.dup_check` joined the set once the
     * rate limiter moved off `$_SESSION` onto `new_clinic_rate_limit` (the DB
     * counter write is fine after session close). Still deliberately EXCLUDED:
     * the chart/patient reads that bind `$_SESSION['pid']`, and
     * `reports.export_status` (inline fallback may run work — SCALE-2.1).
     *
     * @var array<string, true>
     */
    private const READONLY_ACTIONS = [
        // Hot desk/board polls (fire every 10–30 s from every open desk).
        'queue.counts' => true,
        'visit.board' => true,
        'visit.detail' => true,
        'triage.queue' => true,
        'doctor.queue' => true,
        'cashier.queue' => true,
        'lab.queue' => true,
        'pharmacy.queue' => true,
        'pharmacy.rx_history' => true,
        'outreach.queue' => true,
        'doctor.roster' => true,
        'queue_bridge.list' => true,
        // Scheduling reads/polls.
        'scheduling.flow_board.list' => true,
        'scheduling.flow_board.poll' => true,
        'scheduling.flow_board.prefs' => true,
        'scheduling.flow_board.lane_map' => true,
        'scheduling.calendar.range' => true,
        'scheduling.calendar.poll' => true,
        'scheduling.recalls.list' => true,
        // Communications reads.
        'communications.hub_counts' => true,
        'communications.messages_list' => true,
        'communications.message_detail' => true,
        'communications.reminders_list' => true,
        'communications.reminder_log' => true,
        'communications.compose_options' => true,
        'communications.reminder_create_options' => true,
        // List reads.
        'onotes.list' => true,
        'documents.list' => true,
        'documents.categories' => true,
        'documents.unfiled_list' => true,
        // Patient chart / MRD reads (SCALE-1.2). Verified free of $_SESSION writes; the chart
        // fires several of these in parallel, so serializing them on the session lock made the
        // Clinical tab — and the native history editor opened on top of it — load in seconds
        // instead of ~500 ms. assertPatientChartPid only validates (no write). NOTE: patients.preview
        // and patients.chart.visits are deliberately EXCLUDED — the guardrail test lists them as
        // mutating (they have side effects), so they keep the exclusive lock.
        'patients.registration.get' => true,
        'patients.chart.clinical' => true,
        'patients.chart.messages' => true,
        'patients.chart.activity_feed' => true,
        'patients.chart.history_get' => true,
        'patients.chart.immunization_options' => true,
        'patients.chart.immunization_get' => true,
        'patients.chart.search' => true,
        'mrd.clinical_labs_summary' => true,
        'mrd.clinical_meds_summary' => true,
        'mrd.clinical_referrals_strip' => true,
        'mrd.clinical_vitals_series' => true,
        'mrd.profile_payments_summary' => true,
        // Lab/Pharmacy ops reads.
        'lab_ops.worklist' => true,
        'lab_ops.result_get' => true,
        'lab_ops.setup_status' => true,
        'lab_ops.fee_map_list' => true,
        'lab_ops.qc_rules_list' => true,
        'pharm_ops.worklist' => true,
        'pharm_ops.dispense_get' => true,
        'pharm_ops.otc_drugs_search' => true,
        'pharm_ops.otc_sale_get' => true,
        'pharm_ops.setup_status' => true,
        'pharm_ops.inventory.reorder' => true,
        'pharm_ops.inventory.destroyed' => true,
        'pharm_ops.inventory.activity' => true,
        'pharm_ops.inventory.transactions' => true,
        'pharm_ops.inventory.prescriptions' => true,
        'pharm_ops.inventory.stock_list' => true,
        'pharm_ops.catalog_list' => true,
        'pharm_ops.controlled_catalog' => true,
        // Export-job status polls (pure read; inline fallback writes DB/files, not $_SESSION).
        'cohort.export_status' => true,
        // Rate-limited searches (SCALE-3.1: limiter counts in DB, not $_SESSION).
        'patients.search' => true,
        'patients.dup_check' => true,
        // Report hub + clinical-doc reads.
        'reports.hub_summary' => true,
        'reports.catalog' => true,
        // Report reads (SCALE-1.2). Verified free of $_SESSION writes. reports.daily was the
        // worst session-lock holder in the module: 4.5–68 s runs froze every other request from
        // the same user (hub_summary queued to 5.9 s; other pages died at 60 s inside
        // SessionUtil waiting for the lock). daily + scheduling stay in BUDGET_EXEMPT (their
        // legitimate batch reads may exceed the 15 s budget) — membership here is what makes
        // that pre-existing exemption meaningful at all. Exports are mutations and stay off.
        'reports.daily' => true,
        'reports.reconciliation' => true,
        'reports.ancillary' => true,
        'reports.documentation_integrity' => true,
        'reports.scheduling' => true,
        'clinical_doc.visit_summary' => true,
        'clinical_doc.catalog' => true,
        'clinical_doc.sign_status' => true,
        'clinical_doc.favorites' => true,
        // Bill-ops reads.
        'bill_ops.visit_charges' => true,
        'bill_ops.payments_search' => true,
        'bill_ops.outstanding_list' => true,
        'bill_ops.daysheet' => true,
        // Reference reads.
        'visit.types' => true,
        'admin.geo.regions' => true,
        'admin.geo.districts' => true,
        // Admin reads (admin.config is the worst baseline offender — SCALE-1.4 also).
        'admin.config' => true,
        'admin.health_status' => true,
        'admin.audit.query' => true,
        'admin.audit.detail' => true,
        'admin.duplicates.list' => true,
        'admin.staff.list' => true,
        'admin.staff.access_summary' => true,
        'admin.facility_user.list' => true,
        'admin.facility_user.matrix' => true,
        'admin.his_pack_status' => true,
        'admin.perf.summary' => true,
    ];

    /**
     * SCALE-4.1 — actions that legitimately carry a large request body
     * (multipart file uploads, CSV/pack/config imports). Every other action's
     * body is capped at AjaxController::MAX_JSON_BODY_BYTES (1 MB) — no form
     * save or filter payload comes anywhere near that.
     *
     * @var array<string, true>
     */
    private const LARGE_BODY_ACTIONS = [
        'documents.upload' => true,
        'front_desk.upload_referral' => true,
        'lab_ops.panel_import' => true,
        'admin.fee.import' => true,
        'pharm_ops.formulary_import' => true,
        'admin.config.import' => true,
        'admin.his_pack_import' => true,
    ];

    /**
     * SCALE-4.2 — read-only actions exempt from the request execution budgets
     * (set_time_limit + DB statement kill): their handlers may legitimately run
     * bounded batch work inline (the export-status inline fallback builds the
     * export in-request until the job worker is scheduled).
     *
     * @var array<string, true>
     */
    private const BUDGET_EXEMPT = [
        'cohort.export_status' => true,
    ];

    /**
     * SCALE-3.2 — actions the frontend hits on a RECURRING TIMER (desk/board
     * polls, shell badge refresh, export-status loops). These carry a generous
     * per-user-per-action rate budget (`rate_limit_poll_per_minute`, default 90 —
     * legitimate use is ~6/min per tab, export-status loops peak at 60/min) so a
     * stuck client, a devtools loop, or a stolen session can't melt the DB.
     * Islands receive `retry_after_ms` on 429 and back off for one cycle.
     *
     * @var array<string, true>
     */
    private const POLL_ACTIONS = [
        // Shell badge refresh (every 30 s from every open shell page).
        'queue.counts' => true,
        // Desk queues + board (every 10–30 s per open desk).
        'visit.board' => true,
        'triage.queue' => true,
        'doctor.queue' => true,
        'cashier.queue' => true,
        'lab.queue' => true,
        'pharmacy.queue' => true,
        'outreach.queue' => true,
        'doctor.roster' => true,
        'lab_ops.worklist' => true,
        'pharm_ops.worklist' => true,
        'queue_bridge.list' => true,
        // Scheduling delta polls.
        'scheduling.flow_board.poll' => true,
        'scheduling.calendar.poll' => true,
        // Communications hub refresh.
        'communications.hub_counts' => true,
        'communications.messages_list' => true,
        'communications.reminders_list' => true,
        // Daily-reports auto-refresh.
        'reports.daily' => true,
        'reports.scheduling' => true,
        'reports.ancillary' => true,
        'reports.documentation_integrity' => true,
        // Export-status loops (1/s while an export runs, ≤150 attempts).
        'cohort.export_status' => true,
        'reports.export_status' => true,
    ];

    /**
     * @return array{type: string, acl?: string, acls?: array<int, string>, deprecated?: bool}
     */
    public function describe(string $action): array
    {
        $action = $this->normalizeAction($action);

        if (isset(self::DEPRECATED[$action])) {
            return ['type' => 'deprecated', 'deprecated' => true];
        }

        if ($action === 'health') {
            return ['type' => 'desk_acl'];
        }

        if (in_array($action, self::RX_FORM_ACTIONS, true)) {
            return ['type' => 'any_acl', 'acls' => self::RX_FORM_ACLS];
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

        if (in_array($action, self::OFFICE_NOTES_ACTIONS, true)) {
            return ['type' => 'office_notes_acl'];
        }

        if (in_array($action, self::DOCUMENTS_ACTIONS, true)) {
            return ['type' => 'patients_docs_acl'];
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

        if (in_array($action, self::SCHEDULING_READ_ACTIONS, true)) {
            return ['type' => 'scheduling_read_acl'];
        }

        if (in_array($action, self::SCHEDULING_WRITE_ACTIONS, true)) {
            return ['type' => 'scheduling_write_acl'];
        }

        if (in_array($action, self::QUEUE_BRIDGE_READ_ACTIONS, true)) {
            return ['type' => 'queue_bridge_read_acl'];
        }

        if (in_array($action, self::QUEUE_BRIDGE_RESOLVE_ACTIONS, true)) {
            return ['type' => 'queue_bridge_resolve_acl'];
        }

        if (in_array($action, self::QUEUE_BRIDGE_DISMISS_ACTIONS, true)) {
            return ['type' => 'queue_bridge_dismiss_acl'];
        }

        if (in_array($action, self::REPORT_HUB_READ_ACTIONS, true)) {
            return ['type' => 'report_hub_read_acl'];
        }

        if (in_array($action, self::REPORT_HUB_EXPORT_ACTIONS, true)) {
            return ['type' => 'report_hub_export_acl'];
        }

        if (in_array($action, self::ENCOUNTER_NOTE_ACTIONS, true)) {
            return ['type' => 'encounter_note_acl'];
        }

        if (in_array($action, self::CLINICAL_DOC_READ_ACTIONS, true)) {
            return ['type' => 'clinical_doc_read_acl'];
        }

        if (in_array($action, self::CLINICAL_DOC_WRITE_ACTIONS, true)) {
            return ['type' => 'clinical_doc_write_acl'];
        }

        if (in_array($action, self::PROFILE_ACTIONS, true)) {
            return ['type' => 'desk_acl'];
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

        if ($action === 'doctor.routing.reassign') {
            return ['type' => 'any_acl', 'acls' => ['new_admin', 'new_reception']];
        }

        if ($action === 'patients.update') {
            return ['type' => 'any_acl', 'acls' => self::PROFILE_EDIT_ACL_ANY];
        }

        if (in_array($action, [
            'visit.board', 'visit.detail', 'queue.counts',
            'triage.queue', 'doctor.queue', 'doctor.roster', 'cashier.queue', 'lab.queue', 'pharmacy.queue',
            'desk.shared_session_probe', 'front_desk.desk_stats', 'front_desk.todays_appointments',
            'front_desk.flow_charts',
            'front_desk.recently_viewed', 'front_desk.recently_viewed.remember', 'front_desk.recently_viewed.clear',
        ], true)) {
            return ['type' => 'desk_acl'];
        }

        if ($action === 'switch_role') {
            return ['type' => 'desk_acl'];
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

    /**
     * Ordered ACL layers for actions that skip top-level authorizeAction().
     *
     * @return array<int, array<int, string>>
     */
    public function deferredAuthorizationLayers(string $action): array
    {
        $action = $this->normalizeAction($action);
        $layers = [];

        if (isset(self::DEFERRED_PRIMARY_ACLS[$action])) {
            $layers[] = self::DEFERRED_PRIMARY_ACLS[$action];
        } elseif (in_array($action, self::EXPORT_ACTIONS, true)) {
            $layers[] = self::EXPORT_ACL_ANY;
        }

        if ($this->isChartReadAction($action)
            || in_array($action, self::EXPORT_ACTIONS, true)
            || in_array($action, self::RECEIPT_REPRINT_ACTIONS, true)) {
            $layers[] = self::CHART_READ_ACLS;
        }

        return $layers;
    }

    public function isExportAction(string $action): bool
    {
        return in_array($action, self::EXPORT_ACTIONS, true);
    }

    public function isDeprecated(string $action): bool
    {
        return isset(self::DEPRECATED[$action]);
    }

    /**
     * SCALE-1.1 — is this action safe to release the PHP session lock for before
     * dispatch (no `$_SESSION` writes, no mutation)? Default is false (keep the
     * lock) for any action not in the vetted allowlist.
     */
    public function isReadOnly(string $action): bool
    {
        return isset(self::READONLY_ACTIONS[$this->normalizeAction($action)]);
    }

    /**
     * The vetted read-only action allowlist (SCALE-1.1). Exposed for the guardrail
     * test that asserts these never overlap known-mutating actions.
     *
     * @return array<int, string>
     */
    public function readOnlyActions(): array
    {
        return array_keys(self::READONLY_ACTIONS);
    }

    /**
     * SCALE-4.1 — may this action carry a large (upload/import-sized) body?
     */
    public function allowsLargeBody(string $action): bool
    {
        return isset(self::LARGE_BODY_ACTIONS[$this->normalizeAction($action)]);
    }

    /**
     * The large-body allowlist (SCALE-4.1). Exposed for the guardrail test
     * that asserts every entry is a real dispatchable action.
     *
     * @return array<int, string>
     */
    public function largeBodyActions(): array
    {
        return array_keys(self::LARGE_BODY_ACTIONS);
    }

    /**
     * SCALE-4.2 — does this action get the tight read-request budgets
     * (15 s PHP execution limit + 10 s DB statement kill)? Read-only actions
     * only, minus the few that run bounded batch work inline. Mutations never
     * get a budget: killing a write mid-flight is worse than a slow write.
     */
    public function hasReadBudget(string $action): bool
    {
        $action = $this->normalizeAction($action);

        return isset(self::READONLY_ACTIONS[$action]) && !isset(self::BUDGET_EXEMPT[$action]);
    }

    /**
     * SCALE-4.3 — should this request be refused while `panic_readonly_mode` is
     * on? Allowed: GET requests (module mutations are POST-only — CSRF is
     * enforced on POST — so a mutating GET cannot exist) and the vetted
     * read-only allowlist (covers the POST-shaped reads like patients.search).
     * Everything else gets the maintenance envelope. Never allows a mutation;
     * the cost is that a few POST-shaped reads outside the allowlist are also
     * paused during an incident.
     */
    public function isBlockedInReadonlyPanic(string $action, string $method): bool
    {
        if (strtoupper($method) === 'GET') {
            return false;
        }

        return !$this->isReadOnly($action);
    }

    /**
     * SCALE-3.2 — is this a recurring-timer poll action that carries the generous
     * per-user poll rate budget?
     */
    public function isPollAction(string $action): bool
    {
        return isset(self::POLL_ACTIONS[$this->normalizeAction($action)]);
    }

    /**
     * The poll-action set (SCALE-3.2). Exposed for guardrail tests.
     *
     * @return array<int, string>
     */
    public function pollActions(): array
    {
        return array_keys(self::POLL_ACTIONS);
    }

    public function requiresSingleAcl(string $action): ?string
    {
        $action = $this->normalizeAction($action);

        return self::SINGLE_ACL[$action] ?? null;
    }

    /**
     * PRD §13.1 `admin_hub.*` aliases map to module `admin.*` handlers.
     */
    public function normalizeAction(string $action): string
    {
        return match ($action) {
            'admin_hub.health_status' => 'admin.health_status',
            'admin_hub.backup_run' => 'admin.backup.run',
            'admin_hub.backup_complete' => 'admin.backup.complete',
            'admin_hub.setup_progress' => 'admin.setup.mark_item',
            'admin_hub.setup_complete' => 'admin.setup.complete',
            'admin_hub.config_export' => 'admin.config.export',
            'admin_hub.config_import' => 'admin.config.import',
            default => $action,
        };
    }
}

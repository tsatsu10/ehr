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
        'visit.queue_slip' => 'new_reception',
        'doctor.take' => 'new_doctor',
        'doctor.active' => 'new_doctor',
        'doctor.complete' => 'new_doctor',
        'doctor.reopen' => 'new_visit_reopen',
        'doctor.shortcut_preflight' => 'new_doctor',
        'doctor.restore_session' => 'new_doctor',
        'triage.restore_session' => 'new_nurse',
        'triage.select' => 'new_nurse',
        'triage.start' => 'new_nurse',
        'triage.save_vitals' => 'new_nurse',
        'triage.send_doctor' => 'new_nurse',
        'triage.auto_start' => 'new_nurse',
        'cashier.select' => 'new_cashier',
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
        'communications.reminder_done',
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

        if (in_array($action, self::COHORT_ACTIONS, true)) {
            return ['type' => 'cohort_acl'];
        }

        if (in_array($action, self::COHORT_EXPORT_ACTIONS, true)) {
            return ['type' => 'cohort_export_acl'];
        }

        if (in_array($action, self::CHART_READ_ACTIONS, true)) {
            return ['type' => 'any_acl', 'acls' => self::CHART_READ_ACLS];
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
            'desk.shared_session_probe',
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

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

    public function testEncounterNoteActionsDoNotRequireClinicalDocHub(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('encounter_note_acl', $policy->describe('encounter_note.get')['type']);
        $this->assertSame('encounter_note_acl', $policy->describe('encounter_note.save')['type']);
        $this->assertSame('encounter_note_acl', $policy->describe('encounter_note.unlock')['type']);
    }

    public function testDeferredAuthorizationLayersMatchInlineHandlerGates(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame(
            [AjaxActionPolicy::CHART_READ_ACLS],
            $policy->deferredAuthorizationLayers('patients.chart.visits')
        );

        $this->assertSame(
            [
                ['new_chart_depth_finance'],
                AjaxActionPolicy::CHART_READ_ACLS,
            ],
            $policy->deferredAuthorizationLayers('chart_depth.payments_list')
        );

        $this->assertSame(
            [
                ['new_receipt_reprint', 'new_chart_depth_finance'],
                AjaxActionPolicy::CHART_READ_ACLS,
            ],
            $policy->deferredAuthorizationLayers('chart_depth.receipt_reprint')
        );

        $this->assertSame(
            [
                ['new_chart_depth_referral', 'new_chart_depth'],
                AjaxActionPolicy::CHART_READ_ACLS,
            ],
            $policy->deferredAuthorizationLayers('chart_depth.referrals_list')
        );

        $exportAcls = $policy->describe('chart_depth.export_builder')['acls'];

        $this->assertSame(
            [
                $exportAcls,
                AjaxActionPolicy::CHART_READ_ACLS,
            ],
            $policy->deferredAuthorizationLayers('chart_depth.export_builder')
        );
        $this->assertSame(
            $policy->deferredAuthorizationLayers('chart_depth.export_builder'),
            $policy->deferredAuthorizationLayers('chart_depth.export_generate')
        );
    }

    public function testDeferredActionsSkipTopLevelAuthorizeAction(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertTrue($policy->defersAuthorizationToHandler('patients.preview'));
        $this->assertTrue($policy->defersAuthorizationToHandler('chart_depth.export_generate'));
        $this->assertFalse($policy->defersAuthorizationToHandler('visit.board'));
    }

    // ---- SCALE-1.1: read-only session-lock release ------------------------

    public function testHotPollsAreReadOnly(): void
    {
        $policy = new AjaxActionPolicy();

        foreach (
            [
                'queue.counts', 'visit.board', 'triage.queue', 'doctor.queue',
                'cashier.queue', 'lab.queue', 'pharmacy.queue', 'doctor.roster',
                'queue_bridge.list', 'scheduling.flow_board.poll', 'admin.config',
                'communications.hub_counts', 'documents.list',
                // SCALE-3.1: read-only since the rate limiter moved off $_SESSION.
                'patients.search', 'patients.dup_check',
            ] as $action
        ) {
            $this->assertTrue($policy->isReadOnly($action), "$action should be read-only");
        }
    }

    /**
     * SAFETY-CRITICAL: a mutating action must never be marked read-only — releasing
     * the session lock before a $_SESSION write would silently drop that write.
     */
    public function testMutatingActionsAreNotReadOnly(): void
    {
        $policy = new AjaxActionPolicy();

        foreach (
            [
                // money + state transitions
                'cashier.pay', 'cashier.charges.post', 'cashier.mark_unpaid',
                'visit.start', 'visit.cancel', 'doctor.take', 'doctor.complete',
                'triage.save_vitals', 'triage.send_doctor', 'lab.take', 'pharmacy.take',
                // patient/session context + writes
                'patients.create', 'patients.preview', 'patients.chart.visits',
                // config/admin writes
                'admin.config.save', 'admin.fee.save', 'admin.backup.run',
                // clinical writes + exports (inline work / session pid)
                'encounter_note.save', 'encounter_note.sign', 'clinical_doc.open_form',
                'scheduling.calendar.book', 'scheduling.recalls.save',
                'reports.export_run', 'reports.export_status', 'cohort.export',
                'profile.switch_role', 'profile.mfa.enroll_start',
            ] as $action
        ) {
            $this->assertFalse($policy->isReadOnly($action), "$action must NOT be read-only");
        }
    }

    // ---- SCALE-4.3: panic readonly mode ----------------------------------

    public function testPanicReadonlyBlocksMutationsButNeverReads(): void
    {
        $policy = new AjaxActionPolicy();

        // Mutations (POST) are blocked.
        foreach (['cashier.pay', 'visit.start', 'patients.create', 'admin.config.save'] as $action) {
            $this->assertTrue(
                $policy->isBlockedInReadonlyPanic($action, 'POST'),
                "$action must be blocked in panic readonly mode"
            );
        }
        // GET reads and allowlisted POST-shaped reads keep working.
        $this->assertFalse($policy->isBlockedInReadonlyPanic('visit.board', 'GET'));
        $this->assertFalse($policy->isBlockedInReadonlyPanic('patients.chart.visits', 'GET'));
        $this->assertFalse($policy->isBlockedInReadonlyPanic('patients.search', 'POST'));
        $this->assertFalse($policy->isBlockedInReadonlyPanic('queue.counts', 'GET'));
    }

    // ---- SCALE-3.2: poll-action rate budget ------------------------------

    public function testRecurringPollsCarryThePollBudget(): void
    {
        $policy = new AjaxActionPolicy();

        foreach (
            [
                'queue.counts', 'visit.board', 'triage.queue', 'doctor.queue',
                'cashier.queue', 'lab.queue', 'pharmacy.queue', 'doctor.roster',
                'lab_ops.worklist', 'pharm_ops.worklist', 'queue_bridge.list',
                'scheduling.flow_board.poll', 'scheduling.calendar.poll',
                'communications.hub_counts', 'cohort.export_status',
                'reports.export_status',
            ] as $action
        ) {
            $this->assertTrue($policy->isPollAction($action), "$action should be a poll action");
        }
    }

    public function testMutationsAndOneShotReadsAreNotPollActions(): void
    {
        $policy = new AjaxActionPolicy();

        foreach (
            ['cashier.pay', 'visit.start', 'patients.search', 'patients.create',
                'admin.config', 'visit.detail'] as $action
        ) {
            $this->assertFalse($policy->isPollAction($action), "$action must NOT be a poll action");
        }
    }

    /**
     * SCALE-3.5 guardrail: every entry in the read-only allowlist (the future
     * read-replica set) and the poll set must be a REAL dispatchable action.
     * These are allowlists matched by string — a typo would silently never
     * match, which for READONLY_ACTIONS means an intended optimisation quietly
     * missing, and for a future replica split means a misrouted action.
     */
    public function testReadOnlyAndPollSetsContainOnlyRealActions(): void
    {
        require_once dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/ajax-action-crosscheck.php';
        $catalog = array_flip(moduleVerifyExtractControllerActions());
        $policy = new AjaxActionPolicy();

        foreach ($policy->readOnlyActions() as $action) {
            $this->assertArrayHasKey(
                $action,
                $catalog,
                "READONLY_ACTIONS entry '$action' is not a dispatchable controller action"
            );
        }
        foreach ($policy->pollActions() as $action) {
            $this->assertArrayHasKey(
                $action,
                $catalog,
                "POLL_ACTIONS entry '$action' is not a dispatchable controller action"
            );
        }
    }

    // ---- SCALE-4.2: read-request execution budgets ------------------------

    public function testReadOnlyActionsCarryTheReadBudget(): void
    {
        $policy = new AjaxActionPolicy();

        foreach (['queue.counts', 'visit.board', 'patients.search', 'admin.config'] as $action) {
            $this->assertTrue($policy->hasReadBudget($action), "$action should carry the read budget");
        }
    }

    public function testMutationsAndInlineBatchReadsHaveNoReadBudget(): void
    {
        $policy = new AjaxActionPolicy();

        // Mutations: killing a write mid-flight is worse than a slow write.
        foreach (['cashier.pay', 'visit.start', 'admin.config.save'] as $action) {
            $this->assertFalse($policy->hasReadBudget($action), "$action must NOT carry the read budget");
        }
        // Read-only but may run the inline export fallback in-request.
        $this->assertTrue((new AjaxActionPolicy())->isReadOnly('cohort.export_status'));
        $this->assertFalse($policy->hasReadBudget('cohort.export_status'));
    }

    /**
     * SCALE-4.5 audit guardrail: every dispatchable action must be describable
     * by the policy. Two things depend on this: authorizeAction() 400s
     * unknown-described actions BEFORE dispatch (an undescribed real action
     * would be dead code), and the perf counter collapses unknown-described
     * actions to one '(unknown)' bucket (an undescribed real action would
     * vanish from the perf panel).
     */
    public function testEveryDispatchableActionIsDescribable(): void
    {
        require_once dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/ajax-action-crosscheck.php';
        $policy = new AjaxActionPolicy();

        foreach (moduleVerifyExtractControllerActions() as $action) {
            $this->assertNotSame(
                'unknown',
                $policy->describe($action)['type'],
                "dispatchable action '$action' is not describable — it would be 400'd before dispatch"
            );
        }
        // And garbage stays unknown (the perf counter's '(unknown)' bucket test).
        $this->assertSame('unknown', $policy->describe('no.such_action')['type']);
    }

    public function testReadOnlyActionsAreNormalizedAndUnique(): void
    {
        $policy = new AjaxActionPolicy();
        $actions = $policy->readOnlyActions();

        $this->assertSame(
            array_values(array_unique($actions)),
            $actions,
            'read-only allowlist has duplicate entries'
        );
        foreach ($actions as $action) {
            $this->assertSame(
                $action,
                $policy->normalizeAction($action),
                "read-only action '$action' is not in normalized form (typo/alias?)"
            );
        }
    }
}

<?php

/**
 * SEC-1 mandatory contract: every dispatchable ajax action is ACL-classified,
 * and sensitive actions stay pinned to their narrow role (deny-by-default).
 *
 * This is a security control, not just a unit test — a new handler action with
 * no policy entry, or a re-broadening of a clinical/financial/report action,
 * fails the build. Pairs with ajax-action-crosscheck.php (composer verify).
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

/**
 * @group new-clinic-mandatory
 */
class AjaxAclContractTest extends TestCase
{
    /**
     * Actions dispatched by any Ajax handler `case '...':`, read live so the
     * contract can't drift from the code.
     *
     * @return string[]
     */
    private function dispatchedActions(): array
    {
        $dir = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/src/Controllers/Ajax/Handlers';
        $actions = [];
        foreach (glob($dir . '/*.php') ?: [] as $file) {
            $src = (string) file_get_contents($file);
            if (preg_match_all("/case '([a-z_]+\\.[a-z_.]+)':/", $src, $m)) {
                foreach ($m[1] as $a) {
                    $actions[$a] = true;
                }
            }
        }

        return array_keys($actions);
    }

    public function testEveryDispatchedActionIsClassified(): void
    {
        $policy = new AjaxActionPolicy();
        $actions = $this->dispatchedActions();
        $this->assertGreaterThan(200, count($actions), 'Handler enumeration looks wrong');

        $unclassified = [];
        foreach ($actions as $action) {
            if ($policy->describe($policy->normalizeAction($action))['type'] === 'unknown') {
                $unclassified[] = $action;
            }
        }

        $this->assertSame(
            [],
            $unclassified,
            'Unclassified ajax actions bypass authorizeAction() — add them to AjaxActionPolicy: '
                . implode(', ', $unclassified)
        );
    }

    /**
     * Sensitive actions must stay on their narrow role. If someone widens one
     * back to `desk_acl` (any of 8 roles), this fails — the SEC-1 fix and the
     * general deny-by-default posture are locked in.
     */
    public function testSensitiveActionsRequireNarrowAcl(): void
    {
        $policy = new AjaxActionPolicy();

        // SEC-1 fix: report reads gated to `reports`, matching their exports.
        foreach ([
            'reports.ancillary',
            'reports.documentation_integrity',
            'reports.scheduling',
            'reports.ancillary_export',
            'reports.documentation_integrity_export',
            'reports.daily',
            'reports.reconciliation',
        ] as $action) {
            $desc = $policy->describe($action);
            $this->assertSame('single_acl', $desc['type'], "{$action} should be single_acl");
            $this->assertSame('reports', $desc['acl'], "{$action} must require the reports ACL");
        }

        // Financial and clinical writes never fall back to any-desk-role.
        $narrow = [
            'cashier.pay' => 'new_cashier',
            'cashier.mark_unpaid' => 'new_visit_mark_outstanding',
            'admin.staff.create' => 'new_admin',
            'admin.staff.unlock' => 'new_admin',
            'chart_depth.referral_save' => 'new_chart_depth_referral',
            'doctor.complete' => 'new_doctor',
        ];
        foreach ($narrow as $action => $acl) {
            $this->assertSame($acl, $policy->requiresSingleAcl($action), "{$action} must require {$acl}");
        }

        // Bill-ops payment reversal must require its own ACO (or admin), never desk-wide.
        $billing = $policy->describe('bill_ops.payment_reverse');
        $this->assertSame('bill_ops_payment_acl', $billing['type']);
    }

    public function testChartReadsAreDeferredForPerPatientReAuth(): void
    {
        $policy = new AjaxActionPolicy();
        foreach ([
            'patients.chart.clinical',
            'patients.chart.activity_feed',
            'chart_depth.payments_list',
            'chart_depth.referrals_list',
        ] as $action) {
            $this->assertTrue(
                $policy->defersAuthorizationToHandler($action),
                "{$action} must defer to the handler so assertPatientChartPid() runs (IDOR/G12)"
            );
        }
    }
}

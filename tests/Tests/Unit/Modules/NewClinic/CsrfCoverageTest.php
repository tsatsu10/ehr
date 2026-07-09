<?php

/**
 * SEC-2 contract: write actions enforce CSRF and reject GET.
 *
 * Parses the Ajax handler case blocks and asserts method discipline so a new
 * write can't ship CSRF-checked-but-GET-allowed, or POST-guarded-but-no-CSRF.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use PHPUnit\Framework\TestCase;

/**
 * @group new-clinic-mandatory
 */
class CsrfCoverageTest extends TestCase
{
    /**
     * @return array<string, array{post: bool, csrf: bool, file: string}>
     */
    private function caseBlocks(): array
    {
        $dir = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/src/Controllers/Ajax/Handlers';
        $blocks = [];
        foreach (glob($dir . '/*.php') ?: [] as $file) {
            $src = (string) file_get_contents($file);
            if (!preg_match_all(
                "/case '([a-z_]+\\.[a-z_.]+)':(.*?)(?=\\n\\s+case '|\\n\\s+default:|\\z)/s",
                $src,
                $m,
                PREG_SET_ORDER
            )) {
                continue;
            }
            foreach ($m as $c) {
                $body = $c[2];
                $blocks[$c[1]] = [
                    'post' => str_contains($body, 'POST required') || str_contains($body, "=== 'POST'"),
                    'csrf' => str_contains($body, 'verifyCsrf'),
                    'file' => basename($file),
                ];
            }
        }

        return $blocks;
    }

    public function testEveryCsrfCheckedActionIsPostOnly(): void
    {
        $offenders = [];
        foreach ($this->caseBlocks() as $action => $meta) {
            if ($meta['csrf'] && !$meta['post']) {
                $offenders[] = "{$action} ({$meta['file']})";
            }
        }

        $this->assertSame(
            [],
            $offenders,
            'CSRF-checked actions that still accept GET (method-discipline gap): ' . implode(', ', $offenders)
        );
    }

    public function testKnownWritesEnforceBothPostAndCsrf(): void
    {
        $blocks = $this->caseBlocks();
        $writes = [
            'patients.create',
            'patients.update',
            'cashier.pay',
            'cashier.charges.post',
            'admin.staff.create',
            'admin.staff.update',
            'admin.staff.unlock',
            'chart_depth.referral_save',
            'scheduling.calendar.book',
            'bill_ops.payment_reverse',
            'encounter_note.sign',
        ];
        foreach ($writes as $action) {
            $this->assertArrayHasKey($action, $blocks, "{$action} not found in any handler");
            $this->assertTrue($blocks[$action]['post'], "{$action} must reject GET (POST-required)");
            $this->assertTrue($blocks[$action]['csrf'], "{$action} must call verifyCsrf before side effects");
        }
    }
}

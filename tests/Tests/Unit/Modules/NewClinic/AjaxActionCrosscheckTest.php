<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use PHPUnit\Framework\TestCase;

class AjaxActionCrosscheckTest extends TestCase
{
    public function testAjaxActionCrosscheckPasses(): void
    {
        require_once dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/ajax-action-crosscheck.php';

        $errors = moduleVerifyAjaxActionCrosscheckErrors();
        $this->assertSame([], $errors, implode("\n", $errors));
    }

    public function testKnownServerOnlyActionsAreAllowlisted(): void
    {
        require_once dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/ajax-action-crosscheck.php';

        $allowlist = moduleVerifyAjaxActionCallerAllowlist();
        $this->assertArrayHasKey('queue_bridge.eod_export', $allowlist);
        $this->assertArrayHasKey('health', $allowlist);
        $this->assertArrayHasKey('clinical_doc.sign_status', $allowlist);
    }

    public function testRestoreActionAndTernaryCallersAreDetected(): void
    {
        require_once dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/ajax-action-crosscheck.php';

        $callers = moduleVerifyCollectActionCallers();
        $this->assertArrayHasKey('doctor.restore_session', $callers);
        $this->assertArrayHasKey('visit.start_from_appointment', $callers);
        $this->assertArrayHasKey('patients.update', $callers);
        $this->assertArrayHasKey('queue_bridge.link_appointment', $callers);
        $this->assertArrayHasKey('reports.ancillary_export', $callers);
        $this->assertArrayHasKey('lab_ops.result_save', $callers);
    }
}

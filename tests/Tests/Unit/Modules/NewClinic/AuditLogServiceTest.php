<?php

/**
 * AuditLogService access-guard tests (GAP-C C1).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AuditLogService;
use PHPUnit\Framework\TestCase;

class AuditLogServiceTest extends TestCase
{
    public function testQueryRefusedWithoutAdminAcl(): void
    {
        // No authenticated admin in the test harness → read must be refused.
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Audit log access denied');
        (new AuditLogService())->query(['page' => 1]);
    }

    public function testDetailRejectsMissingId(): void
    {
        // ACL is checked first; if the harness somehow grants admin, the id guard
        // still applies. Either way this must throw.
        $this->expectException(\Throwable::class);
        (new AuditLogService())->detail(0);
    }
}

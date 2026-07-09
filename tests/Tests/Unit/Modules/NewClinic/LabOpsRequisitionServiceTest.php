<?php

/**
 * Tests for send-out lab requisition payload (M12-F05 / AUDIT-15)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\LabOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\LabOpsRequisitionService;
use PHPUnit\Framework\TestCase;

class LabOpsRequisitionServiceTest extends TestCase
{
    public function testUnauthorizedContextCannotBuildRequisition(): void
    {
        // Without an authenticated clinic session the hub gate must refuse
        // before any data access. Earlier integration tests may leave a
        // session user behind — clear it for the duration of this test.
        $savedUser = $_SESSION['authUser'] ?? null;
        $savedUserId = $_SESSION['authUserID'] ?? null;
        unset($_SESSION['authUser'], $_SESSION['authUserID']);

        try {
            $this->expectException(\RuntimeException::class);
            (new LabOpsRequisitionService())->buildRequisition(1);
        } finally {
            if ($savedUser !== null) {
                $_SESSION['authUser'] = $savedUser;
            }
            if ($savedUserId !== null) {
                $_SESSION['authUserID'] = $savedUserId;
            }
        }
    }

    public function testMissingOrderIdIsRejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Procedure order id is required');
        $this->serviceWithOpenAccess()->buildRequisition(0);
    }

    public function testUnknownOrderIsNotFound(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Lab order not found');
        $this->serviceWithOpenAccess()->buildRequisition(999999999);
    }

    private function serviceWithOpenAccess(): LabOpsRequisitionService
    {
        $access = new class extends LabOpsAccessService {
            public function assertHubAccess(): void
            {
                // Access granted for behavioral tests of the payload logic.
            }
        };

        return new LabOpsRequisitionService(access: $access);
    }
}

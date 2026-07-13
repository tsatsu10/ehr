<?php

/**
 * OutreachService gating tests (GAP-B B1).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\OutreachService;
use PHPUnit\Framework\TestCase;

class OutreachServiceTest extends TestCase
{
    public function testPreviewRefusedWhenOutreachDisabled(): void
    {
        // Feature ships OFF by default; the service must refuse before touching data.
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Outreach is not enabled');
        (new OutreachService())->preview(['channel' => 'sms', 'filters' => []]);
    }

    public function testQueueRefusedWhenOutreachDisabled(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Outreach is not enabled');
        (new OutreachService())->queue(['channel' => 'sms', 'body' => 'hi'], 1);
    }
}

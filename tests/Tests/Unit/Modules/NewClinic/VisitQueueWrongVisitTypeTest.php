<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class VisitQueueWrongVisitTypeTest extends TestCase
{
    public function testCancelVisitGuardsWrongVisitTypeToWaitingOnly(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'cancelVisit');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('wrong_visit_type', $body);
        $this->assertStringContainsString("!== 'waiting'", $body);
    }

    public function testCreateVisitLinksWrongVisitTypeReplacement(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'linkWrongVisitTypeReplacement');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('wrong_visit_type', $body);
        $this->assertStringContainsString('referred_to_visit_id', $body);
        $this->assertStringContainsString('wrong_visit_type_replacement_linked', $body);
    }
}

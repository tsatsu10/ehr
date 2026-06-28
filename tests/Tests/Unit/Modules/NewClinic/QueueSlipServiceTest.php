<?php

/**
 * Unit tests for queue slip print payload (M5.4)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\QueueSlipService;
use PHPUnit\Framework\TestCase;

class QueueSlipServiceTest extends TestCase
{
    public function testBuildPrintPayloadIncludesQueueNumberInstructionAndPatientDisplay(): void
    {
        $reflection = new \ReflectionMethod(QueueSlipService::class, 'buildPrintPayload');
        $source = file_get_contents($reflection->getFileName());
        $lines = explode("\n", $source);
        $body = implode("\n", array_slice(
            $lines,
            $reflection->getStartLine() - 1,
            $reflection->getEndLine() - $reflection->getStartLine() + 1
        ));

        $this->assertStringContainsString('queue_number', $body);
        $this->assertStringContainsString('instruction_text', $body);
        $this->assertStringContainsString('queue_slip_instruction_text', $body);
        $this->assertStringContainsString('patient_display', $body);
    }

    public function testPrintTemplateIncludesRequiredFields(): void
    {
        $template = file_get_contents(
            dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/templates/queue-slip.html.twig'
        );

        $this->assertStringContainsString('queue_number', $template);
        $this->assertStringContainsString('patient_display', $template);
        $this->assertStringContainsString('instruction_text', $template);
    }
}

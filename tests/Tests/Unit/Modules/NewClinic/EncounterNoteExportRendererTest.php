<?php

/**
 * Tests for native consult note report rendering (HLF-6 / AUDIT-15)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\EncounterNoteExportRenderer;
use PHPUnit\Framework\TestCase;

class EncounterNoteExportRendererTest extends TestCase
{
    public function testInvalidIdsRenderNotFoundMessage(): void
    {
        ob_start();
        (new EncounterNoteExportRenderer())->renderReport(0, 0, 0);
        $html = (string) ob_get_clean();

        $this->assertStringContainsString('Consult note not found', $html);
        $this->assertStringNotContainsString('<table', $html);
    }

    public function testMissingNoteRowRendersNotFoundMessage(): void
    {
        ob_start();
        (new EncounterNoteExportRenderer())->renderReport(1, 1, 999999999);
        $html = (string) ob_get_clean();

        $this->assertStringContainsString('Consult note not found', $html);
    }
}

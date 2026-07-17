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
use OpenEMR\Modules\NewClinic\Services\PatientChartMessagesService;
use PHPUnit\Framework\TestCase;

class PatientChartMessagesServiceTest extends TestCase
{
    public function testNoteDetailIsAChartReadReadonlyAction(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertTrue($policy->isChartReadAction('patients.note_detail'));
        $this->assertContains('patients.note_detail', $policy->readOnlyActions());
    }

    public function testThreadHtmlEscapesMarkupBeforeLinkifying(): void
    {
        $html = PatientChartMessagesService::renderThreadHtml(
            "<script>alert(1)</script>\nSee https://example.org/x"
        );

        // Markup must never survive raw — the stock linkifier does not escape.
        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
        // Newlines become <br />, and (when the core helper is loaded) URLs
        // become anchors; either way the URL text is present.
        $this->assertStringContainsString('https://example.org/x', $html);
    }

    public function testThreadHtmlKeepsPlainTextIntact(): void
    {
        $html = PatientChartMessagesService::renderThreadHtml("Patient called.\nWill come Friday.");

        $this->assertStringContainsString('Patient called.', $html);
        $this->assertStringContainsString('Will come Friday.', $html);
    }
}

<?php

/**
 * Deep-link restoreSession injection for stock pages
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\DeepLinkRestoreSessionService;
use PHPUnit\Framework\TestCase;

class DeepLinkRestoreSessionServiceTest extends TestCase
{
    public function testInjectIntoHtmlInsertsScriptBeforeBodyContent(): void
    {
        $service = new DeepLinkRestoreSessionService();
        $html = '<html><head><title>Test</title></head><body><p>Hi</p></body></html>';

        $result = $service->injectIntoHtml($html);

        $this->assertStringContainsString('function restoreSession', $result);
        $this->assertStringContainsString('oemr_session_name', $result);
        $this->assertMatchesRegularExpression('/<head>\s*<script>/i', $result);
        $this->assertStringContainsString('<p>Hi</p>', $result);
    }

    public function testInjectIntoHtmlSkipsWhenAlreadyPresent(): void
    {
        $service = new DeepLinkRestoreSessionService();
        $html = '<html><head><script>function restoreSession() { return true; }</script></head><body></body></html>';

        $this->assertSame($html, $service->injectIntoHtml($html));
    }

    public function testAllowlistIncludesEncounterTopAndLabdata(): void
    {
        $suffixes = DeepLinkRestoreSessionService::RESTORE_SESSION_SCRIPT_SUFFIXES;

        $this->assertContains('/patient_file/encounter/encounter_top.php', $suffixes);
        $this->assertContains('/patient_file/summary/labdata.php', $suffixes);
        $this->assertContains('/patient_file/report/patient_report.php', $suffixes);
    }
}

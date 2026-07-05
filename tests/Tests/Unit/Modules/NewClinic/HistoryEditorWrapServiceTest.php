<?php

/**
 * Unit tests for History editor T1 wrap (V1.1-HIST-WRAP)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\HistoryEditorWrapService;
use OpenEMR\Modules\NewClinic\Support\HistoryEditorWrapGate;
use PHPUnit\Framework\TestCase;

class HistoryEditorWrapServiceTest extends TestCase
{
    public function testResolveBackUrlForClinicalBackground(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $_GET['return'] = HistoryEditorWrapService::RETURN_CLINICAL_BACKGROUND;

        $service = new HistoryEditorWrapService();
        $url = $service->resolveBackToChartUrl(42);

        $this->assertNotNull($url);
        $this->assertStringContainsString('patient-chart.php?pid=42', $url);
        $this->assertStringContainsString('tab=clinical', $url);
        $this->assertStringEndsWith('#clinical-background', $url);

        unset($_GET['return']);
    }

    public function testInjectIntoHtmlAddsWrapMarkersAndBackButton(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $_SESSION['pid'] = 7;
        $_GET['return'] = HistoryEditorWrapService::RETURN_CLINICAL_BACKGROUND;

        $html = '<html><body><div class="btn-group"><button type="submit">Save</button></div></body></html>';
        $service = new HistoryEditorWrapService();
        $out = $service->injectIntoHtml($html, '<header id="nc-history-editor-wrap"></header>');

        $this->assertStringContainsString('class="nc-history-editor-wrap"', $out);
        $this->assertStringContainsString('id="nc-history-editor-wrap"', $out);
        $this->assertStringContainsString('nc-history-editor-wrap-back', $out);
        $this->assertStringContainsString('patient-chart.php?pid=7', $out);

        unset($_SESSION['pid'], $_GET['return']);
    }

    public function testInjectIntoHtmlMergesExistingBodyClass(): void
    {
        $html = '<html><body class="body_top"><div class="btn-group"></div></body></html>';
        $service = new HistoryEditorWrapService();
        $out = $service->injectIntoHtml($html, '<header id="nc-history-editor-wrap"></header>');

        $this->assertStringContainsString('class="body_top nc-history-editor-wrap"', $out);
        $this->assertStringNotContainsString('class="body_top" class="nc-history-editor-wrap"', $out);

        unset($_SESSION['pid'], $_GET['return']);
    }

    public function testWrapGateUsesFeatureFlag(): void
    {
        $method = new \ReflectionMethod(HistoryEditorWrapService::class, 'isWrapEnabled');
        $source = file_get_contents($method->getFileName());
        $lines = explode("\n", $source);
        $body = implode("\n", array_slice(
            $lines,
            $method->getStartLine() - 1,
            $method->getEndLine() - $method->getStartLine() + 1
        ));

        $this->assertStringContainsString('enable_history_editor_wrap', $body);
    }

    public function testTargetsHistoryFullEditorOnly(): void
    {
        $this->assertSame('/patient_file/history/history_full.php', HistoryEditorWrapGate::EDITOR_SUFFIX);
    }
}

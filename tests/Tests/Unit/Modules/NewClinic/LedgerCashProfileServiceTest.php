<?php

/**
 * Unit tests for the ledger cash-profile wrapper (M11-F11 / FIN-1)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\LedgerCashProfileService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class LedgerCashProfileServiceTest extends TestCase
{
    private LedgerCashProfileService $service;

    protected function setUp(): void
    {
        $this->service = new LedgerCashProfileService();
    }

    public function testRenderSnippetTargetsReportResults(): void
    {
        $snippet = $this->service->renderSnippet();

        $this->assertStringContainsString('nc-ledger-cash-profile', $snippet);
        $this->assertStringContainsString('report_results', $snippet);
        $this->assertStringContainsString('String.fromCharCode(160)', $snippet);
    }

    public function testInjectIntoHtmlBeforeBodyClose(): void
    {
        $html = '<html><body><div id="report_results"></div></body></html>';
        $result = $this->service->injectIntoHtml($html, '<script>x</script>');

        $this->assertStringContainsString('<script>x</script></body>', $result);
    }

    public function testInjectIntoHtmlAppendsWhenNoBodyTag(): void
    {
        $result = $this->service->injectIntoHtml('<div>partial</div>', '<script>x</script>');

        $this->assertSame('<div>partial</div><script>x</script>', $result);
    }

    public function testInjectIntoHtmlNoopOnEmptySnippet(): void
    {
        $html = '<html><body></body></html>';

        $this->assertSame($html, $this->service->injectIntoHtml($html, ''));
    }

    public function testGateChecksLedgerScriptCsvInsuranceAndRole(): void
    {
        $source = file_get_contents(
            (new ReflectionMethod(LedgerCashProfileService::class, 'shouldBufferCurrentRequest'))->getFileName()
        );

        $this->assertNotFalse($source);
        $this->assertStringContainsString('/reports/pat_ledger.php', $source);
        $this->assertStringContainsString('form_csvexport', $source);
        $this->assertStringContainsString('enable_insurance', $source);
        $this->assertStringContainsString('userHasClinicRole', $source);
    }
}

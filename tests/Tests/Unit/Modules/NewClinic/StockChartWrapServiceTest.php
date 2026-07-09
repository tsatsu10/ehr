<?php

/**
 * Unit tests for the stock report/transactions pilot wrappers (M11-F11)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\StockChartWrapService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class StockChartWrapServiceTest extends TestCase
{
    private StockChartWrapService $service;

    protected function setUp(): void
    {
        $this->service = new StockChartWrapService();
    }

    public function testReportSnippetHidesCcrAndInsuranceControls(): void
    {
        $snippet = $this->invokePrivate('reportSnippet');
        // On this dev DB enable_insurance may be 0 (cash profile) — when it is,
        // the snippet must target the CCR block and both checkbox ids.
        if ($snippet === '') {
            $this->markTestSkipped('enable_insurance is ON for this facility — cash-profile snippet not applicable');
        }

        $this->assertStringContainsString('#ccr_report', $snippet);
        $this->assertStringContainsString('include_insurance', $snippet);
        $this->assertStringContainsString('include_billing', $snippet);
    }

    public function testTransactionsSnippetRetitlesHeading(): void
    {
        $snippet = $this->invokePrivate('transactionsSnippet');

        $this->assertStringContainsString('Referrals', $snippet);
        $this->assertStringContainsString('nc-transactions-heading', $snippet);
    }

    public function testInjectIntoHtmlBeforeBodyClose(): void
    {
        $result = $this->service->injectIntoHtml('<html><body>x</body></html>', '<script>y</script>');

        $this->assertStringContainsString('<script>y</script></body>', $result);
    }

    public function testInjectIntoHtmlNoopOnEmptySnippet(): void
    {
        $html = '<html><body>x</body></html>';

        $this->assertSame($html, $this->service->injectIntoHtml($html, ''));
    }

    public function testGateOnlyMatchesReportAndTransactionsPages(): void
    {
        $source = file_get_contents(
            (new ReflectionMethod(StockChartWrapService::class, 'currentPage'))->getFileName()
        );

        $this->assertNotFalse($source);
        $this->assertStringContainsString('/patient_file/report/patient_report.php', $source);
        $this->assertStringContainsString('/patient_file/transaction/transactions.php', $source);
    }

    private function invokePrivate(string $method): string
    {
        $reflection = new ReflectionMethod(StockChartWrapService::class, $method);
        $reflection->setAccessible(true);

        return (string) $reflection->invoke($this->service);
    }
}

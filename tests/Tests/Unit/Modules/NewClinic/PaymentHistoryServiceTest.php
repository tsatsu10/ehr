<?php

/**
 * Unit tests for Chart Depth payment history helpers (M11)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PaymentHistoryService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class PaymentHistoryServiceTest extends TestCase
{
    private PaymentHistoryService $service;

    protected function setUp(): void
    {
        $this->service = new PaymentHistoryService();
    }

    public function testBuildPaymentLabelCash(): void
    {
        $this->assertSame('Cash payment', $this->invokePrivate('buildPaymentLabel', ['cash', '', '']));
        $this->assertSame('Cash payment', $this->invokePrivate('buildPaymentLabel', ['', '', '']));
    }

    public function testBuildPaymentLabelMomoWithReference(): void
    {
        $this->assertSame(
            'MoMo · Ref: TXN-123',
            $this->invokePrivate('buildPaymentLabel', ['momo', 'TXN-123', ''])
        );
    }

    public function testBuildPaymentLabelMomoFallsBackToReceiptNote(): void
    {
        $this->assertSame(
            'MoMo · Ref: note-ref',
            $this->invokePrivate('buildPaymentLabel', ['mobile_money', '', 'note-ref'])
        );
    }

    public function testBuildPaymentLabelMomoWithoutReference(): void
    {
        $this->assertSame('MoMo', $this->invokePrivate('buildPaymentLabel', ['momo', '', '']));
    }

    public function testBuildPaymentLabelCard(): void
    {
        $this->assertSame(
            'Card payment',
            $this->invokePrivate('buildPaymentLabel', ['card', '', ''])
        );
    }

    public function testNormalizeFilterThisVisitWithoutVisitId(): void
    {
        $this->assertSame(
            'all_visits',
            $this->invokePrivate('normalizeFilter', ['this_visit', null])
        );
    }

    public function testNormalizeFilterDateRange(): void
    {
        $this->assertSame(
            'date_range',
            $this->invokePrivate('normalizeFilter', ['date_range', null])
        );
    }

    public function testNormalizeDateRejectsInvalid(): void
    {
        $this->assertNull($this->invokePrivate('normalizeDate', ['not-a-date']));
        $this->assertNull($this->invokePrivate('normalizeDate', ['']));
    }

    public function testNormalizeDateAcceptsIsoDate(): void
    {
        $this->assertSame(
            '2026-06-27',
            $this->invokePrivate('normalizeDate', ['2026-06-27'])
        );
    }

    public function testFilterTimelineByDateRange(): void
    {
        $timeline = [
            ['occurred_at' => '2026-06-01 10:00:00', 'type' => 'payment'],
            ['occurred_at' => '2026-06-15 10:00:00', 'type' => 'charge'],
            ['occurred_at' => '2026-07-01 10:00:00', 'type' => 'payment'],
        ];

        $filtered = $this->invokePrivate('filterTimelineByDate', [
            $timeline,
            '2026-06-10',
            '2026-06-20',
        ]);

        $this->assertCount(1, $filtered);
        $this->assertSame('charge', $filtered[0]['type']);
    }

    /**
     * @param array<int, mixed> $args
     */
    private function invokePrivate(string $method, array $args): mixed
    {
        $reflection = new ReflectionMethod(PaymentHistoryService::class, $method);
        $reflection->setAccessible(true);

        return $reflection->invoke($this->service, ...$args);
    }
}

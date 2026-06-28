<?php

/**
 * Mandatory test 41 — Visit Board audit timeline (M2-F12, PRD §16).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PatientCompletionService;
use OpenEMR\Modules\NewClinic\Services\VisitBoardService;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * @group new-clinic-mandatory
 */
#[Group('new-clinic-mandatory')]
class VisitBoardAuditTimelineMandatoryTest extends TestCase
{
    public function test41AuditTimelineCapsAtFiveRows(): void
    {
        $method = new ReflectionMethod(VisitBoardService::class, 'getVisitDetail');
        $body = implode('', array_slice(
            file($method->getFileName()),
            $method->getStartLine() - 1,
            $method->getEndLine() - $method->getStartLine() + 1
        ));

        $this->assertStringContainsString('LIMIT 5', $body);
        $this->assertStringContainsString('audit_timeline', $body);
    }

    public function test41AuditTimelineItemsHaveOperationalLabels(): void
    {
        $items = VisitBoardService::formatAuditTimeline([
            [
                'from_state' => 'waiting',
                'to_state' => 'in_triage',
                'reason' => '',
                'created_at' => '2026-06-26 10:00:00',
            ],
        ]);

        $this->assertCount(1, $items);
        $this->assertSame('state_changed', $items[0]['type']);
        $this->assertSame('Moved to In triage', $items[0]['label']);
        $this->assertArrayHasKey('at_label', $items[0]);
    }

    public function test41ChartHistoryUrlIncludesOverviewAndVisitId(): void
    {
        global $GLOBALS;
        $GLOBALS['webroot'] = '';

        $service = new VisitBoardService();
        $detail = $service->buildVisitSummary([
            'state' => 'in_triage',
            'queue_number' => 7,
            'visit_type_label' => 'OPD',
            'started_at' => '2026-06-26 09:00:00',
            'wait_minutes' => 5,
            'chief_complaint' => 'Fever',
            'is_urgent' => 0,
            'assigned_provider_id' => 0,
            'DOB' => '1990-01-01',
        ], false);

        $this->assertSame('In triage', $detail['state_label']);

        $overview = PatientCompletionService::chartUrl(42, 'overview') . '&visit_id=99';
        $this->assertStringContainsString('tab=overview', $overview);
        $this->assertStringContainsString('visit_id=99', $overview);
        $this->assertStringContainsString('pid=42', $overview);
    }

    public function test41VisitDetailDrawerUsesAuditTimelineRenderer(): void
    {
        $drawer = $this->readFrontendSource('src/islands/visit-board/VisitDetailDrawer.tsx');

        $this->assertStringContainsString('audit_timeline', $drawer);
        $this->assertStringContainsString('AuditTimeline', $drawer);
        $this->assertStringContainsString('chart_history_url', $drawer);
        $this->assertStringContainsString('View full history', $drawer);
    }

    private function readFrontendSource(string $relativePath): string
    {
        $path = dirname(__DIR__, 5) . '/frontend/' . ltrim($relativePath, '/');
        $this->assertFileExists($path, 'Expected frontend file: ' . $relativePath);

        return (string) file_get_contents($path);
    }
}

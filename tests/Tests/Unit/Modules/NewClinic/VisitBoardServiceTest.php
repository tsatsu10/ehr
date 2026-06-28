<?php

/**
 * VisitBoardService unit tests
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\VisitBoardService;
use PHPUnit\Framework\TestCase;

class VisitBoardServiceTest extends TestCase
{
    public function testStateLabelReturnsKnownLabels(): void
    {
        $this->assertSame('In triage', VisitBoardService::stateLabel('in_triage'));
        $this->assertSame('Ready to pay', VisitBoardService::stateLabel('ready_for_payment'));
    }

    public function testFormatAuditTimelineMapsStateChanges(): void
    {
        $items = VisitBoardService::formatAuditTimeline([
            [
                'from_state' => 'waiting',
                'to_state' => 'in_triage',
                'reason' => '',
                'created_at' => '2026-06-26 09:02:00',
            ],
            [
                'from_state' => 'waiting',
                'to_state' => 'ready_for_doctor',
                'reason' => '',
                'created_at' => '2026-06-26 09:05:00',
            ],
            [
                'from_state' => 'in_triage',
                'to_state' => 'cancelled',
                'reason' => 'Patient left',
                'created_at' => '2026-06-26 09:30:00',
            ],
        ]);

        $this->assertCount(3, $items);
        $this->assertSame('Moved to In triage', $items[0]['label']);
        $this->assertSame('From Waiting', $items[0]['subtitle']);
        $this->assertSame('09:02', $items[0]['at_label']);
        $this->assertSame('Skipped triage', $items[1]['label']);
        $this->assertSame('Visit cancelled', $items[2]['label']);
        $this->assertSame('Patient left', $items[2]['subtitle']);
    }

    public function testBuildVisitSummaryIncludesBadgesAndProviderHint(): void
    {
        $service = new VisitBoardService();
        $summary = $service->buildVisitSummary([
            'state' => 'in_triage',
            'queue_number' => 14,
            'visit_type_label' => 'OPD',
            'started_at' => '2026-06-26 09:02:00',
            'wait_minutes' => 18,
            'chief_complaint' => 'Headache',
            'is_urgent' => 1,
            'assigned_provider_id' => 0,
            'DOB' => '1991-03-12',
        ], true);

        $this->assertSame('In triage', $summary['state_label']);
        $this->assertSame(14, $summary['queue_number']);
        $this->assertSame('Unassigned', $summary['provider_hint']);
        $this->assertSame('09:02', $summary['started_at_label']);
        $this->assertSame('12 Mar 1991', $summary['dob_label']);
        $this->assertContains('urgent', $summary['badges']);
        $this->assertContains('skipped_triage', $summary['badges']);
    }
}

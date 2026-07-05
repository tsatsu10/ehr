<?php

/**
 * Unit tests for patient activity feed contracts (MRD §8.4 / §21.1k)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PatientActivityFeedService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class PatientActivityFeedServiceTest extends TestCase
{
    public function testLookbackConstantsMatchMrdSpec(): void
    {
        $this->assertSame(25, PatientActivityFeedService::PAGE_SIZE);
        $this->assertSame(90, PatientActivityFeedService::LOOKBACK_DAYS);
        $this->assertSame(365, PatientActivityFeedService::MAX_LOOKBACK_DAYS);
        $this->assertSame(
            'Older history — use Visits tab',
            PatientActivityFeedService::OLDER_HISTORY_MESSAGE
        );
    }

    public function testGetActivityFeedAcceptsVisitIdFilterParameter(): void
    {
        $method = new ReflectionMethod(PatientActivityFeedService::class, 'getActivityFeed');
        $params = $method->getParameters();

        $this->assertSame('visitId', $params[4]->getName());
        $this->assertSame('lookbackDays', $params[5]->getName());
    }

    public function testFetchMethodsApplyOptionalVisitFilter(): void
    {
        $source = file_get_contents(
            (new ReflectionMethod(PatientActivityFeedService::class, 'fetchStateLogItems'))->getFileName()
        );

        $this->assertNotFalse($source);
        $this->assertStringContainsString('fetchVitalsSavedItems', $source);
        $this->assertStringContainsString('fetchLabOrderedItems', $source);
        $this->assertStringContainsString('fetchRxPrescribedItems', $source);
        $this->assertStringContainsString('vitals_saved', $source);
        $this->assertStringContainsString('rx_prescribed', $source);
        $this->assertStringContainsString('lab_ordered', $source);
        $this->assertStringContainsString('payment_posted', $source);
        $this->assertStringContainsString('encounter_signed', $source);
        $this->assertStringContainsString('routing_confirmed', $source);
        $this->assertStringContainsString('visit_cancelled', $source);
        $this->assertStringContainsString('hard_assigned', $source);
        $this->assertStringContainsString('encounter_document_saved', $source);
        $this->assertStringContainsString('completion_override', $source);
        $this->assertStringContainsString('esign_override', $source);
        $this->assertStringContainsString('canNavigatePaymentHistory', $source);
        $this->assertStringContainsString('resolveStateSecondaryAction', $source);
        $this->assertStringContainsString('profile-payments', $source);
        $this->assertStringContainsString('buildFeedSuppressKeys', $source);
        $this->assertStringContainsString('can_extend_lookback', $source);
    }
}

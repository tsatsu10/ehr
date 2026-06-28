<?php

/**
 * Integration tests for Communications Hub service (requires local DB)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\CommunicationsHubService;
use PHPUnit\Framework\TestCase;

class CommunicationsHubServiceIntegrationTest extends TestCase
{
    public function testHubCountsShape(): void
    {
        global $GLOBALS;

        if (empty($_SESSION['authUserID']) || empty($_SESSION['authUser'])) {
            $this->markTestSkipped('No authenticated session for communications hub test');
        }

        $service = new CommunicationsHubService();
        $counts = $service->hubCounts(
            (string) $_SESSION['authUser'],
            (int) $_SESSION['authUserID']
        );

        $this->assertArrayHasKey('messages_active', $counts);
        $this->assertArrayHasKey('reminders_due_5d', $counts);
        $this->assertArrayHasKey('reminders_in_window', $counts);
        $this->assertArrayHasKey('envelope_total', $counts);
        $this->assertIsInt($counts['messages_active']);
        $this->assertIsInt($counts['reminders_due_5d']);
        $this->assertIsInt($counts['reminders_in_window']);
        $this->assertSame(
            $counts['messages_active'] + $counts['reminders_due_5d'],
            $counts['envelope_total']
        );
    }

    public function testListMessagesShape(): void
    {
        if (empty($_SESSION['authUser'])) {
            $this->markTestSkipped('No authenticated session for communications hub test');
        }

        $service = new CommunicationsHubService();
        $payload = $service->listMessages((string) $_SESSION['authUser'], [
            'begin' => 0,
            'limit' => 5,
        ]);

        $this->assertArrayHasKey('rows', $payload);
        $this->assertArrayHasKey('total', $payload);
        $this->assertArrayHasKey('begin', $payload);
        $this->assertArrayHasKey('limit', $payload);
        $this->assertIsArray($payload['rows']);
        $this->assertIsInt($payload['total']);
    }

    public function testListRemindersShape(): void
    {
        if (empty($_SESSION['authUserID'])) {
            $this->markTestSkipped('No authenticated session for communications hub test');
        }

        $service = new CommunicationsHubService();
        $payload = $service->listReminders((int) $_SESSION['authUserID'], 30);

        $this->assertArrayHasKey('rows', $payload);
        $this->assertArrayHasKey('total', $payload);
        $this->assertArrayHasKey('window_days', $payload);
        $this->assertIsArray($payload['rows']);
    }
}

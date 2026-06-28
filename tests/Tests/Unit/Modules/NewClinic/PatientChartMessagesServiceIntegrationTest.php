<?php

/**
 * Integration tests for patient chart messages payload (requires local DB)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\PatientChartMessagesService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class PatientChartMessagesServiceIntegrationTest extends TestCase
{
    private int $facilityId = 0;

    protected function setUp(): void
    {
        $this->facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
        if ($this->facilityId <= 0) {
            $this->markTestSkipped('No service-location facility configured');
        }
    }

    public function testGetMessagesPayloadShape(): void
    {
        $pid = $this->resolveAnyPatientPid();
        if ($pid <= 0) {
            $this->markTestSkipped('No patient in database');
        }

        $payload = (new PatientChartMessagesService())->getMessagesPayload($pid);

        $this->assertArrayHasKey('messages', $payload);
        $this->assertArrayHasKey('reminders', $payload);
        $this->assertArrayHasKey('message_total', $payload);
        $this->assertArrayHasKey('has_more', $payload);
        $this->assertArrayHasKey('editor_urls', $payload);
        $this->assertIsArray($payload['messages']);
        $this->assertIsArray($payload['reminders']);
        $this->assertArrayHasKey('pnotes', $payload['editor_urls']);
        $this->assertStringContainsString('set_pid=' . $pid, (string) $payload['editor_urls']['pnotes']);
    }

    private function resolveAnyPatientPid(): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT pid FROM patient_data ORDER BY pid DESC LIMIT 1',
            []
        );

        return is_array($row) ? (int) ($row['pid'] ?? 0) : 0;
    }
}

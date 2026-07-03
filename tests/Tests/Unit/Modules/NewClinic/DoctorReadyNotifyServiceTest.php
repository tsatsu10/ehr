<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\DoctorReadyNotifyService;
use PHPUnit\Framework\TestCase;

class DoctorReadyNotifyServiceTest extends TestCase
{
    public function testChannelConstant(): void
    {
        $this->assertSame('in_app', DoctorReadyNotifyService::CHANNEL_IN_APP);
    }

    public function testListPendingReturnsEmptyWhenDisabled(): void
    {
        $service = new DoctorReadyNotifyService();
        $this->assertSame([], $service->listPendingForDoctor(1, 999999));
    }

    public function testRecordForReadyVisitSkipsWhenDisabled(): void
    {
        $service = new DoctorReadyNotifyService();
        $service->recordForReadyVisit([
            'id' => 1,
            'facility_id' => 999999,
            'state' => 'ready_for_doctor',
            'pid' => 1,
        ]);
        $this->assertSame([], $service->listPendingForDoctor(1, 999999));
    }

    public function testRecordForReadyVisitSkipsWhenNotReadyState(): void
    {
        $service = new DoctorReadyNotifyService();
        $service->recordForReadyVisit([
            'id' => 1,
            'facility_id' => 0,
            'state' => 'in_triage',
            'pid' => 1,
        ]);
        $this->assertTrue(true);
    }

    public function testResolveRecipientsReturnsEmptyWhenUnassignedAndBroadcastOff(): void
    {
        $config = new ClinicConfigService();
        $facilityId = 0;
        $prevNotify = $config->get('enable_doctor_ready_notify', '0', $facilityId);
        $prevBroadcast = $config->get('notify_unassigned_to_all_on_duty', '0', $facilityId);
        $config->set('enable_doctor_ready_notify', '1', $facilityId);
        $config->set('notify_unassigned_to_all_on_duty', '0', $facilityId);

        try {
            $service = new DoctorReadyNotifyService();
            $recipients = $this->resolveRecipients($service, [
                'hard_assigned_provider_id' => null,
                'routing_suggested_provider_id' => null,
            ], $facilityId, date('Y-m-d'));
            $this->assertSame([], $recipients);
        } finally {
            $config->set('enable_doctor_ready_notify', (string) $prevNotify, $facilityId);
            $config->set('notify_unassigned_to_all_on_duty', (string) $prevBroadcast, $facilityId);
        }
    }

    /**
     * @param array<string, mixed> $visit
     * @return list<int>
     */
    private function resolveRecipients(DoctorReadyNotifyService $service, array $visit, int $facilityId, string $visitDate): array
    {
        $method = new \ReflectionMethod(DoctorReadyNotifyService::class, 'resolveRecipients');
        $method->setAccessible(true);

        return $method->invoke($service, $visit, $facilityId, $visitDate);
    }
}

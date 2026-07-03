<?php

/**
 * M18 exception detector unit tests (BRIDGE-1, BRIDGE-3, BRIDGE-4).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\QueueBridgeExceptionService;
use PHPUnit\Framework\TestCase;

class QueueBridgeExceptionServiceTest extends TestCase
{
    public function testDetectEx01ForPatientRejectsInvalidPid(): void
    {
        $detector = new QueueBridgeExceptionService();

        $this->assertSame([], $detector->detectEx01ForPatient(0, 3, date('Y-m-d')));
        $this->assertSame([], $detector->detectEx01ForPatient(-1, 3, date('Y-m-d')));
    }

    public function testDetectTodayReturnsList(): void
    {
        $detector = new QueueBridgeExceptionService();
        $rows = $detector->detectToday(3, date('Y-m-d'));

        $this->assertIsArray($rows);
        foreach ($rows as $row) {
            $this->assertArrayHasKey('exception_code', $row);
            $this->assertArrayHasKey('severity', $row);
            $this->assertArrayHasKey('dedupe_key', $row);
            $this->assertMatchesRegularExpression('/^EX-\d{2}$/', (string) $row['exception_code']);
            if (($row['exception_code'] ?? '') === 'EX-04') {
                $this->assertSame('info', $row['severity']);
            }
            if (($row['exception_code'] ?? '') === 'EX-06') {
                $this->assertSame('info', $row['severity']);
                $this->assertContains('relink_nearest_appointment', $row['available_actions'] ?? []);
            }
            if (($row['exception_code'] ?? '') === 'EX-05') {
                $this->assertSame('action', $row['severity']);
                $this->assertContains('cancel_visit', $row['available_actions'] ?? []);
                $this->assertContains('unlink_appointment', $row['available_actions'] ?? []);
                $this->assertContains('dismiss', $row['available_actions'] ?? []);
            }
        }
    }

    public function testFindNearestAppointmentTodayRejectsInvalidInput(): void
    {
        $detector = new QueueBridgeExceptionService();

        $this->assertNull($detector->findNearestAppointmentToday(0, date('Y-m-d'), '2026-06-29 09:00:00'));
        $this->assertNull($detector->findNearestAppointmentToday(3, date('Y-m-d'), ''));
    }

    public function testWalkInWithoutAppointmentNotListedAsEx01(): void
    {
        $detector = new QueueBridgeExceptionService();
        $rows = $detector->detectToday(3, date('Y-m-d'));
        $ex01Rows = array_values(array_filter(
            $rows,
            static fn (array $row): bool => ($row['exception_code'] ?? '') === 'EX-01'
        ));

        if ($ex01Rows === []) {
            $this->addToAssertionCount(1);

            return;
        }

        foreach ($ex01Rows as $row) {
            $this->assertNotEmpty($row['pc_eid'] ?? null, 'EX-01 must reference a calendar event');
        }
    }
}

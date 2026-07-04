<?php

/**
 * Shared helpers for V1.2-BILL depth smoke fixtures.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\CashierService;
use OpenEMR\Modules\NewClinic\Services\FeeScheduleAdminService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Services\PatientService;

const NC_BILL_DEPTH_CORRECT_LNAME = 'NC-BILLDEPTH-CORRECT';
const NC_BILL_DEPTH_REVERSE_LNAME = 'NC-BILLDEPTH-REVERSE';

function billDepthBootstrapActorSession(int $actorUserId): void
{
    $user = QueryUtils::querySingleRow('SELECT username FROM users WHERE id = ?', [$actorUserId]);
    $username = trim((string) ($user['username'] ?? ''));
    if ($username === '') {
        throw new RuntimeException('Bill depth actor user not found: ' . $actorUserId);
    }

    $_SESSION['authUser'] = $username;
    $_SESSION['authUserID'] = $actorUserId;
    $_SESSION['authProvider'] = $_SESSION['authProvider'] ?? 'Default';
}

/**
 * @return array<string, mixed>|null
 */
function billDepthFindPaidVisit(string $lname): ?array
{
    $row = QueryUtils::querySingleRow(
        "SELECT v.id AS visit_id, v.state, v.queue_number, v.row_version AS version,
                r.id AS receipt_id, r.receipt_number, r.reversed_at, r.created_at,
                p.pid, p.lname
         FROM patient_data p
         INNER JOIN new_visit v ON v.pid = p.pid
         INNER JOIN new_receipt r ON r.visit_id = v.id
         WHERE p.lname = ?
           AND v.state = 'completed'
           AND r.reversed_at IS NULL
         ORDER BY v.id DESC
         LIMIT 1",
        [$lname]
    );

    return is_array($row) ? $row : null;
}

/**
 * @return array<string, mixed>
 */
function billDepthSeedPaidVisit(string $lname, string $fname, int $facilityId, int $actorUserId): array
{
    $suffix = (string) time();
    $created = (new PatientService())->insert([
        'fname' => $fname,
        'lname' => $lname,
        'DOB' => '1993-08-20',
        'sex' => 'Female',
        'pubpid' => 'BD' . substr($suffix, -6),
        'phone_cell' => '0247333' . substr($suffix, -4),
    ]);
    if (!$created->isValid()) {
        throw new RuntimeException('Failed to create bill depth patient');
    }
    $pid = (int) ($created->getData()[0]['pid'] ?? 0);
    if ($pid <= 0) {
        throw new RuntimeException('Failed to create bill depth patient pid');
    }

    $visitType = QueryUtils::querySingleRow(
        'SELECT id FROM new_visit_type WHERE facility_id = ? AND is_active = 1 ORDER BY id ASC LIMIT 1',
        [$facilityId]
    );
    $visitTypeId = is_array($visitType) ? (int) ($visitType['id'] ?? 0) : 0;
    if ($visitTypeId <= 0) {
        throw new RuntimeException('No visit type for facility ' . $facilityId);
    }

    $queue = new VisitQueueService();
    $cashier = new CashierService();
    $visit = $queue->startVisit($pid, $visitTypeId, $actorUserId, $facilityId, 'E2E bill depth fixture');
    $visitId = (int) ($visit['id'] ?? 0);
    if ($visitId <= 0) {
        throw new RuntimeException('Failed to start bill depth visit');
    }

    $advance = static function (string $targetState) use ($queue, $visitId, $actorUserId): void {
        $current = $queue->getVisitForActor($visitId);
        if (($current['state'] ?? '') === $targetState) {
            return;
        }
        $queue->transition(
            $visitId,
            $targetState,
            $actorUserId,
            (int) ($current['row_version'] ?? 0),
            'bill_depth_fixture'
        );
    };

    $current = $queue->getVisitForActor($visitId);
    $state = (string) ($current['state'] ?? 'waiting');
    if ($state === 'waiting' || $state === 'in_triage') {
        $advance('ready_for_doctor');
        $advance('with_doctor');
        $advance('ready_for_payment');
    } elseif ($state === 'ready_for_doctor') {
        $advance('with_doctor');
        $advance('ready_for_payment');
    } elseif ($state === 'with_doctor') {
        $advance('ready_for_payment');
    } elseif ($state !== 'ready_for_payment') {
        throw new RuntimeException('Unexpected visit state for bill depth seed: ' . $state);
    }

    $fees = (new FeeScheduleAdminService())->listForDesk($facilityId);
    if ($fees === []) {
        throw new RuntimeException('No fee schedule lines for facility ' . $facilityId);
    }
    $feeId = (int) ($fees[0]['id'] ?? 0);
    $cashier->postCharges($visitId, [['fee_schedule_id' => $feeId, 'units' => 1]], $actorUserId);

    $current = $queue->getVisitForActor($visitId);
    $charges = $cashier->selectVisit($visitId, $actorUserId);
    $totalDue = (float) ($charges['charges_total'] ?? 0);
    if ($totalDue <= 0) {
        throw new RuntimeException('Bill depth visit has no charges');
    }

    billDepthBootstrapActorSession($actorUserId);

    $cashier->recordPayment(
        $visitId,
        $actorUserId,
        (int) ($current['row_version'] ?? 0),
        $totalDue,
        null,
        'E2E bill depth fixture'
    );

    $paid = billDepthFindPaidVisit($lname);
    if ($paid === null) {
        throw new RuntimeException('Bill depth paid visit not found after payment');
    }

    return $paid;
}

/**
 * @return array<string, mixed>
 */
function billDepthEnsurePaidVisit(string $lname, string $fname, int $facilityId, int $actorUserId): array
{
    $existing = billDepthFindPaidVisit($lname);
    if ($existing !== null) {
        return $existing;
    }

    return billDepthSeedPaidVisit($lname, $fname, $facilityId, $actorUserId);
}

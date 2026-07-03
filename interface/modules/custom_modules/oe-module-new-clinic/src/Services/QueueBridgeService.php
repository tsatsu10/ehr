<?php

/**
 * M18 Queue Bridge Hub — list, resolve, dismiss, EOD summary
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Services\AppointmentService;

class QueueBridgeService
{
    private const LIST_LIMIT = 50;

    private static bool $schemaEnsured = false;

    public function __construct(
        private readonly QueueBridgeAccessService $access = new QueueBridgeAccessService(),
        private readonly QueueBridgeExceptionService $detector = new QueueBridgeExceptionService(),
        private readonly VisitQueueService $visitQueue = new VisitQueueService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly SchedulingShellService $schedulingShell = new SchedulingShellService(),
        private readonly SchedulingRecallsService $schedulingRecalls = new SchedulingRecallsService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function listExceptions(int $facilityId, string $lens = 'action', int $page = 1): array
    {
        $snapshot = $this->compileTodaySnapshot($facilityId);
        $facilityId = $snapshot['facility_id'];
        $today = $snapshot['today'];
        $actionRows = $snapshot['action_rows'];
        $infoRows = $snapshot['info_rows'];
        $resolved = $snapshot['resolved_rows'];
        $links = $snapshot['links'];

        $rows = match ($lens) {
            'info' => $infoRows,
            'resolved' => $resolved,
            default => $actionRows,
        };
        $page = max(1, $page);
        $offset = ($page - 1) * self::LIST_LIMIT;
        $slice = array_slice($rows, $offset, self::LIST_LIMIT);

        return [
            'lens' => $lens,
            'snapshot_date' => $today,
            'counts' => [
                'action' => count($actionRows),
                'info' => count($infoRows),
                'resolved' => count($resolved),
            ],
            'rows' => $this->enrichRows($slice, $links),
            'page' => $page,
            'has_more' => count($rows) > $offset + count($slice),
            'can_resolve' => $this->access->canResolve(),
            'can_dismiss' => $this->access->canDismiss(),
            'links' => $links,
            'eod_block_enabled' => $snapshot['eod_block_enabled'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function resolve(
        string $exceptionCode,
        string $action,
        int $pid,
        int $facilityId,
        int $actorUserId,
        ?int $pcEid = null,
        ?int $visitId = null,
        ?string $apptDate = null,
        ?int $visitTypeId = null,
        ?string $cancelReason = null
    ): array {
        $this->access->assertHubAccess();
        if (!$this->access->canResolve()) {
            throw new \RuntimeException('Resolve permission denied', 403);
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $today = date('Y-m-d');
        $apptDate = $apptDate ?: $today;

        if ($action === 'start_visit_checkin') {
            if ($pcEid === null || $pcEid <= 0) {
                throw new \InvalidArgumentException('pc_eid required for check-in');
            }
            $result = $this->visitQueue->startVisitFromAppointment(
                $pid,
                $pcEid,
                $apptDate,
                $actorUserId,
                $visitTypeId,
                $facilityId
            );
            $this->schedulingRecalls->completeLinkedRecallOnCheckIn($pcEid, $pid, $actorUserId);
            $visitId = (int) ($result['visit']['id'] ?? 0);
            $this->writeSnapshot(
                $facilityId,
                $today,
                $exceptionCode,
                $pid,
                $pcEid,
                $visitId > 0 ? $visitId : null,
                'resolved',
                $actorUserId,
                'start_visit_checkin',
                null
            );
            $this->audit('queue_bridge.resolve', [
                'exception_code' => $exceptionCode,
                'action' => $action,
                'pid' => $pid,
                'pc_eid' => $pcEid,
                'visit_id' => $visitId,
                'facility_id' => $facilityId,
            ]);

            return ['visit' => $result['visit'], 'list' => $this->listExceptions($facilityId, 'action')];
        }

        if ($action === 'link_appointment') {
            if ($pcEid === null || $pcEid <= 0) {
                throw new \InvalidArgumentException('pc_eid required');
            }
            if ($visitId === null || $visitId <= 0) {
                throw new \InvalidArgumentException('visit_id required');
            }
            sqlStatement(
                "UPDATE new_visit SET pc_eid = ?, appt_date = ?, updated_at = NOW()
                 WHERE id = ? AND pid = ? AND facility_id = ?",
                [$pcEid, $apptDate, $visitId, $pid, $facilityId]
            );
        }

        if ($action === 'mark_arrived' || $action === 'link_appointment') {
            if ($pcEid === null || $pcEid <= 0) {
                throw new \InvalidArgumentException('pc_eid required');
            }
            $encounter = 0;
            if ($visitId !== null && $visitId > 0) {
                $visit = $this->visitQueue->getVisitForActor($visitId);
                $encounter = (int) ($visit['encounter'] ?? 0);
            }
            (new AppointmentService())->updateAppointmentStatus($pcEid, '@', $actorUserId, $encounter);
            $this->writeSnapshot(
                $facilityId,
                $today,
                $exceptionCode,
                $pid,
                $pcEid,
                $visitId,
                'resolved',
                $actorUserId,
                $action,
                null
            );
            $this->audit('queue_bridge.resolve', [
                'exception_code' => $exceptionCode,
                'action' => $action,
                'pid' => $pid,
                'pc_eid' => $pcEid,
                'visit_id' => $visitId,
                'facility_id' => $facilityId,
            ]);

            return ['list' => $this->listExceptions($facilityId, 'action')];
        }

        if ($action === 'cancel_visit') {
            if ($visitId === null || $visitId <= 0) {
                throw new \InvalidArgumentException('visit_id required');
            }
            $reason = trim((string) ($cancelReason ?? ''));
            if ($reason === '') {
                throw new \InvalidArgumentException('Cancel reason required');
            }
            $visit = $this->visitQueue->getVisitForActor($visitId);
            $this->visitQueue->cancelVisit(
                $visitId,
                $actorUserId,
                (int) ($visit['row_version'] ?? 0),
                $reason
            );
            $this->writeSnapshot(
                $facilityId,
                $today,
                $exceptionCode,
                $pid,
                $pcEid,
                $visitId,
                'resolved',
                $actorUserId,
                $action,
                null
            );
            $this->audit('queue_bridge.resolve', [
                'exception_code' => $exceptionCode,
                'action' => $action,
                'pid' => $pid,
                'pc_eid' => $pcEid,
                'visit_id' => $visitId,
                'facility_id' => $facilityId,
                'cancel_reason' => $reason,
            ]);

            return ['list' => $this->listExceptions($facilityId, 'action')];
        }

        if ($action === 'unlink_appointment') {
            if ($visitId === null || $visitId <= 0) {
                throw new \InvalidArgumentException('visit_id required');
            }
            sqlStatement(
                "UPDATE new_visit SET pc_eid = NULL, appt_date = NULL, updated_at = NOW()
                 WHERE id = ? AND pid = ? AND facility_id = ?",
                [$visitId, $pid, $facilityId]
            );
            $this->writeSnapshot(
                $facilityId,
                $today,
                $exceptionCode,
                $pid,
                $pcEid,
                $visitId,
                'resolved',
                $actorUserId,
                $action,
                null
            );
            $this->audit('queue_bridge.resolve', [
                'exception_code' => $exceptionCode,
                'action' => $action,
                'pid' => $pid,
                'pc_eid' => $pcEid,
                'visit_id' => $visitId,
                'facility_id' => $facilityId,
            ]);

            return ['list' => $this->listExceptions($facilityId, 'action')];
        }

        if ($action === 'relink_nearest_appointment') {
            if ($visitId === null || $visitId <= 0) {
                throw new \InvalidArgumentException('visit_id required');
            }
            $visit = $this->visitQueue->getVisitForActor($visitId);
            $startedAt = (string) ($visit['started_at'] ?? '');
            $nearest = $this->detector->findNearestAppointmentToday($pid, $today, $startedAt);
            if ($nearest === null) {
                throw new \InvalidArgumentException('No alternate appointment found for today');
            }
            $nearestEid = (int) ($nearest['pc_eid'] ?? 0);
            $nearestDate = (string) ($nearest['pc_eventDate'] ?? $today);
            if ($nearestEid <= 0) {
                throw new \InvalidArgumentException('Nearest appointment is invalid');
            }
            sqlStatement(
                "UPDATE new_visit SET pc_eid = ?, appt_date = ?, updated_at = NOW()
                 WHERE id = ? AND pid = ? AND facility_id = ?",
                [$nearestEid, $nearestDate, $visitId, $pid, $facilityId]
            );
            $this->writeSnapshot(
                $facilityId,
                $today,
                $exceptionCode,
                $pid,
                $nearestEid,
                $visitId,
                'resolved',
                $actorUserId,
                $action,
                null
            );
            $this->audit('queue_bridge.resolve', [
                'exception_code' => $exceptionCode,
                'action' => $action,
                'pid' => $pid,
                'pc_eid' => $nearestEid,
                'previous_pc_eid' => $pcEid,
                'visit_id' => $visitId,
                'facility_id' => $facilityId,
            ]);

            return ['list' => $this->listExceptions($facilityId, 'action')];
        }

        throw new \InvalidArgumentException('Unknown resolve action');
    }

    /**
     * @return array<string, mixed>
     */
    public function dismiss(
        string $exceptionCode,
        int $pid,
        int $facilityId,
        int $actorUserId,
        string $reason,
        ?int $pcEid = null,
        ?int $visitId = null
    ): array {
        $this->access->assertHubAccess();
        if (!$this->access->canDismissExceptionCode($exceptionCode)) {
            throw new \RuntimeException('Dismiss not allowed for this exception', 403);
        }
        if (trim($reason) === '') {
            throw new \InvalidArgumentException('Dismiss reason required');
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $today = date('Y-m-d');
        $this->writeSnapshot(
            $facilityId,
            $today,
            $exceptionCode,
            $pid,
            $pcEid,
            $visitId,
            'resolved',
            $actorUserId,
            'dismissed',
            $reason
        );
        $this->audit('queue_bridge.dismiss', [
            'exception_code' => $exceptionCode,
            'pid' => $pid,
            'pc_eid' => $pcEid,
            'visit_id' => $visitId,
            'facility_id' => $facilityId,
            'reason' => $reason,
        ]);

        return ['list' => $this->listExceptions($facilityId, 'action')];
    }

    /**
     * @return array<string, mixed>
     */
    public function eodSummary(int $facilityId): array
    {
        $snapshot = $this->schedulingFooterSnapshot($facilityId);

        return [
            'open_action_count' => (int) ($snapshot['open_action_count'] ?? 0),
            'open_info_count' => (int) ($snapshot['open_info_count'] ?? 0),
            'open_ex01_count' => (int) ($snapshot['open_ex01_count'] ?? 0),
            'eod_block_enabled' => (bool) ($snapshot['eod_block_enabled'] ?? false),
            'hub_url' => (string) ($snapshot['hub_url'] ?? ''),
        ];
    }

    /**
     * Single-pass counts for M7 scheduling footer (avoids repeated detectToday).
     *
     * @return array<string, mixed>
     */
    public function schedulingFooterSnapshot(int $facilityId): array
    {
        $compiled = $this->compileTodaySnapshot($facilityId);
        $byCode = ['EX-01' => 0, 'EX-02' => 0, 'EX-03' => 0, 'EX-05' => 0];
        foreach ($compiled['action_rows'] as $row) {
            $code = (string) ($row['exception_code'] ?? '');
            if (isset($byCode[$code])) {
                $byCode[$code]++;
            }
        }

        $webroot = (string) ($GLOBALS['webroot'] ?? '');

        return [
            'open_action_count' => count($compiled['action_rows']),
            'open_info_count' => count($compiled['info_rows']),
            'open_ex01_count' => $byCode['EX-01'],
            'eod_block_enabled' => $compiled['eod_block_enabled'],
            'by_code' => $byCode,
            'hub_url' => $webroot
                . '/interface/modules/custom_modules/oe-module-new-clinic/public/queue-bridge/index.php',
        ];
    }

    /**
     * @return array{filename: string, content: string}
     */
    public function exportEodCsv(int $facilityId): array
    {
        $compiled = $this->compileTodaySnapshot($facilityId);
        $today = $compiled['today'];
        $rows = array_merge(
            $compiled['action_rows'],
            $compiled['info_rows'],
            $compiled['resolved_rows']
        );

        $lines = ['exception_code,severity,pid,pc_eid,visit_id,patient_name,summary,resolve_action'];
        foreach ($rows as $row) {
            $lines[] = implode(',', array_map(
                static fn ($value): string => '"' . str_replace('"', '""', (string) $value) . '"',
                [
                    $row['exception_code'] ?? '',
                    $row['severity'] ?? '',
                    $row['pid'] ?? '',
                    $row['pc_eid'] ?? '',
                    $row['visit_id'] ?? '',
                    $row['patient_name'] ?? '',
                    $row['summary'] ?? '',
                    $row['resolve_action'] ?? ($row['detail'] ?? ''),
                ]
            ));
        }

        return [
            'filename' => 'queue-bridge-eod-' . $today . '.csv',
            'content' => implode("\n", $lines) . "\n",
        ];
    }

    /**
     * @return array{
     *   today: string,
     *   facility_id: int,
     *   action_rows: list<array<string, mixed>>,
     *   info_rows: list<array<string, mixed>>,
     *   resolved_rows: list<array<string, mixed>>,
     *   links: array<string, string>,
     *   eod_block_enabled: bool
     * }
     */
    private function compileTodaySnapshot(int $facilityId): array
    {
        $this->ensureTableExists();
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $today = date('Y-m-d');
        $detected = $this->detector->detectToday($facilityId, $today);
        $dismissed = $this->loadDismissedKeys($facilityId, $today);
        $resolved = $this->loadResolvedToday($facilityId, $today);

        $actionRows = [];
        $infoRows = [];
        foreach ($detected as $row) {
            $key = (string) ($row['dedupe_key'] ?? '');
            if ($key !== '' && isset($dismissed[$key])) {
                continue;
            }
            if (($row['severity'] ?? '') === 'info') {
                $infoRows[] = $row;
            } else {
                $actionRows[] = $row;
            }
        }

        $webroot = (string) ($GLOBALS['webroot'] ?? '');
        $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
        $integrationUrls = $this->schedulingShell->resolveIntegrationUrls($facilityId);

        return [
            'today' => $today,
            'facility_id' => $facilityId,
            'action_rows' => $actionRows,
            'info_rows' => $infoRows,
            'resolved_rows' => $resolved,
            'links' => [
                'visit_board_url' => $modulePublic . 'visit-board.php',
                'front_desk_url' => $modulePublic . 'front-desk.php',
                'flow_board_url' => $integrationUrls['flow_board_url'],
                'scheduling_url' => $integrationUrls['scheduling_url'],
                'reports_url' => $modulePublic . 'reports.php',
            ],
            'eod_block_enabled' => $this->config->getInt('queue_bridge_eod_block', 0, $facilityId) === 1,
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     * @param array<string, string> $links
     * @return list<array<string, mixed>>
     */
    private function enrichRows(array $rows, array $links): array
    {
        foreach ($rows as &$row) {
            $row['links'] = $links;
            $row['can_dismiss'] = $this->access->canDismissExceptionCode((string) ($row['exception_code'] ?? ''));
        }
        unset($row);

        return $rows;
    }

    /**
     * @return array<string, true>
     */
    private function loadDismissedKeys(int $facilityId, string $today): array
    {
        try {
            $records = QueryUtils::fetchRecords(
                "SELECT exception_code, pid, pc_eid, visit_id
                 FROM queue_bridge_exception_snapshot
                 WHERE facility_id = ? AND snapshot_date = ? AND resolve_action = 'dismissed'",
                [$facilityId, $today]
            ) ?: [];
        } catch (\Throwable) {
            return [];
        }

        $map = [];
        foreach ($records as $row) {
            $key = strtolower(
                (string) ($row['exception_code'] ?? '') . ':'
                . (int) ($row['pid'] ?? 0) . ':'
                . (int) ($row['pc_eid'] ?? 0) . ':'
                . (int) ($row['visit_id'] ?? 0)
            );
            $map[$key] = true;
        }

        return $map;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function loadResolvedToday(int $facilityId, string $today): array
    {
        try {
            $records = QueryUtils::fetchRecords(
                "SELECT s.exception_code, s.pid, s.pc_eid, s.visit_id, s.resolve_action,
                        s.dismiss_reason, s.resolved_at, pd.fname, pd.lname
                 FROM queue_bridge_exception_snapshot s
                 LEFT JOIN patient_data pd ON pd.pid = s.pid
                 WHERE s.facility_id = ? AND s.snapshot_date = ?
                   AND s.resolved_at IS NOT NULL
                 ORDER BY s.resolved_at DESC
                 LIMIT 50",
                [$facilityId, $today]
            ) ?: [];
        } catch (\Throwable) {
            return [];
        }

        $rows = [];
        foreach ($records as $row) {
            $fname = trim((string) ($row['fname'] ?? ''));
            $lname = trim((string) ($row['lname'] ?? ''));
            $rows[] = [
                'exception_code' => (string) ($row['exception_code'] ?? ''),
                'severity' => 'resolved',
                'pid' => (int) ($row['pid'] ?? 0),
                'pc_eid' => isset($row['pc_eid']) ? (int) $row['pc_eid'] : null,
                'visit_id' => isset($row['visit_id']) ? (int) $row['visit_id'] : null,
                'patient_name' => trim($fname . ' ' . $lname) ?: ('PID ' . (int) ($row['pid'] ?? 0)),
                'summary' => (string) ($row['resolve_action'] ?? 'resolved'),
                'detail' => (string) ($row['dismiss_reason'] ?? ''),
                'resolved_at' => (string) ($row['resolved_at'] ?? ''),
            ];
        }

        return $rows;
    }

    private function writeSnapshot(
        int $facilityId,
        string $today,
        string $exceptionCode,
        int $pid,
        ?int $pcEid,
        ?int $visitId,
        string $severity,
        int $actorUserId,
        string $resolveAction,
        ?string $dismissReason
    ): void {
        $this->ensureTableExists();
        sqlStatement(
            "INSERT INTO queue_bridge_exception_snapshot
             (facility_id, snapshot_date, exception_code, pid, pc_eid, visit_id, severity,
              detected_at, resolved_at, resolved_by, resolve_action, dismiss_reason)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)",
            [
                $facilityId,
                $today,
                $exceptionCode,
                $pid,
                $pcEid,
                $visitId,
                $severity,
                $actorUserId,
                $resolveAction,
                $dismissReason,
            ]
        );
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function audit(string $event, array $payload): void
    {
        EventAuditLogger::getInstance()->newEvent(
            'new_clinic_queue_bridge',
            $event,
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode($payload),
            0
        );
    }

    private function ensureTableExists(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        sqlStatement(
            "CREATE TABLE IF NOT EXISTS `queue_bridge_exception_snapshot` (
                `id` BIGINT NOT NULL AUTO_INCREMENT,
                `facility_id` INT NOT NULL,
                `snapshot_date` DATE NOT NULL,
                `exception_code` VARCHAR(16) NOT NULL,
                `pid` BIGINT NOT NULL,
                `pc_eid` INT NULL,
                `visit_id` BIGINT NULL,
                `severity` ENUM('action','info','resolved') NOT NULL,
                `detected_at` DATETIME NOT NULL,
                `resolved_at` DATETIME NULL,
                `resolved_by` BIGINT NULL,
                `resolve_action` VARCHAR(64) NULL,
                `dismiss_reason` TEXT NULL,
                PRIMARY KEY (`id`),
                KEY `idx_facility_date` (`facility_id`, `snapshot_date`),
                KEY `idx_pid_date` (`pid`, `snapshot_date`)
            ) ENGINE=InnoDB COMMENT='M18 queue bridge exception snapshots'"
        );
        self::$schemaEnsured = true;
    }
}

<?php

/**
 * M18 — queue bridge flags for Visit Board, Front Desk, Flow Board, M7 footer
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class QueueBridgeSurfaceService
{
    public function __construct(
        private readonly QueueBridgeAccessService $access = new QueueBridgeAccessService(),
        private readonly QueueBridgeService $bridge = new QueueBridgeService(),
        private readonly QueueBridgeExceptionService $detector = new QueueBridgeExceptionService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function isSurfaceEnabled(?int $facilityId = null): bool
    {
        return $this->access->isHubEnabled($facilityId);
    }

    /**
     * @return array<string, mixed>
     */
    public function hubUrlPayload(?int $facilityId = null): array
    {
        $webroot = (string) ($GLOBALS['webroot'] ?? '');

        return [
            'hub_url' => $webroot
                . '/interface/modules/custom_modules/oe-module-new-clinic/public/queue-bridge/index.php',
        ];
    }

    /**
     * Visit Board card badges keyed by visit_id (M18-F09 / M2-F14).
     *
     * @return array<int, array{code: string, label: string, hub_url: string}>
     */
    public function visitBadgeMap(int $facilityId): array
    {
        if (!$this->isSurfaceEnabled($facilityId)) {
            return [];
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $today = date('Y-m-d');
        $hubUrl = (string) ($this->hubUrlPayload()['hub_url'] ?? '');
        $map = [];

        foreach ($this->detector->detectExceptionCodes($facilityId, $today, ['EX-03', 'EX-04']) as $row) {
            $code = (string) ($row['exception_code'] ?? '');
            $visitId = (int) ($row['visit_id'] ?? 0);
            if ($visitId <= 0) {
                continue;
            }
            $map[$visitId] = [
                'code' => $code,
                'label' => $code === 'EX-04' ? 'Recurring info' : 'Appt not linked',
                'hub_url' => $hubUrl,
            ];
        }

        return $map;
    }

    /**
     * Front Desk preview flags (M18-F11a/b).
     *
     * @return array<string, mixed>
     */
    public function patientFlags(int $pid, ?int $facilityId = null): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId);
        if (!$this->isSurfaceEnabled($facilityId)) {
            return ['enabled' => false];
        }

        $hubUrl = (string) ($this->hubUrlPayload()['hub_url'] ?? '');
        $today = date('Y-m-d');
        $ex01Open = false;

        foreach ($this->detector->detectEx01ForPatient($pid, $facilityId, $today) as $row) {
            if (($row['exception_code'] ?? '') === 'EX-01') {
                $ex01Open = true;
                break;
            }
        }

        return [
            'enabled' => true,
            'hub_url' => $hubUrl,
            'ex01_open' => $ex01Open,
            'block_plain_start' => $ex01Open,
            'show_arrival_advisor' => true,
        ];
    }

    /**
     * Flow Board EX-01 chips (M18-F08 / S1-F10).
     *
     * @return list<array<string, mixed>>
     */
    public function flowBoardChips(int $facilityId): array
    {
        if (!$this->isSurfaceEnabled($facilityId)) {
            return [];
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $today = date('Y-m-d');
        $hubUrl = (string) ($this->hubUrlPayload()['hub_url'] ?? '');
        $chips = [];

        foreach ($this->detector->detectExceptionCodes($facilityId, $today, ['EX-01']) as $row) {
            $chips[] = [
                'pid' => (int) ($row['pid'] ?? 0),
                'pc_eid' => (int) ($row['pc_eid'] ?? 0),
                'label' => 'No clinical visit',
                'fix_url' => $hubUrl,
            ];
        }

        return $chips;
    }

    /**
     * Visit Board guided fix for EX-03 (M18-F13).
     *
     * @return array<string, mixed>|null
     */
    public function visitBoardAction(int $visitId, int $facilityId): ?array
    {
        if ($visitId <= 0 || !$this->isSurfaceEnabled($facilityId)) {
            return null;
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $today = date('Y-m-d');
        $hubUrl = (string) ($this->hubUrlPayload()['hub_url'] ?? '');
        $row = $this->detector->findTodayExceptionForVisit($visitId, $facilityId, 'EX-03', $today);
        if ($row === null) {
            return null;
        }

        return [
            'exception_code' => 'EX-03',
            'pid' => (int) ($row['pid'] ?? 0),
            'pc_eid' => (int) ($row['pc_eid'] ?? 0),
            'visit_id' => $visitId,
            'appt_date' => $today,
            'label' => 'Link appointment & mark arrived',
            'summary' => (string) ($row['summary'] ?? ''),
            'appt_time_label' => $row['appt_time_label'] ?? null,
            'can_resolve' => $this->access->canResolve(),
            'hub_url' => $hubUrl,
        ];
    }

    /**
     * M7 Scheduling tab footer embed (M18-F10).
     *
     * @return array<string, mixed>
     */
    public function schedulingFooter(int $facilityId): array
    {
        $hubUrl = (string) ($this->hubUrlPayload()['hub_url'] ?? '');
        if (!$this->isSurfaceEnabled($facilityId)) {
            return [
                'enabled' => false,
                'hub_url' => $hubUrl,
            ];
        }

        $summary = $this->bridge->schedulingFooterSnapshot($facilityId);

        return [
            'enabled' => true,
            'hub_url' => $hubUrl,
            'open_action_count' => (int) ($summary['open_action_count'] ?? 0),
            'open_info_count' => (int) ($summary['open_info_count'] ?? 0),
            'open_ex01_count' => (int) ($summary['open_ex01_count'] ?? 0),
            'eod_block_enabled' => (bool) ($summary['eod_block_enabled'] ?? false),
            'by_code' => (array) ($summary['by_code'] ?? []),
            'export_url' => ($GLOBALS['webroot'] ?? '')
                . '/interface/modules/custom_modules/oe-module-new-clinic/public/ajax.php?action=queue_bridge.eod_export',
        ];
    }
}

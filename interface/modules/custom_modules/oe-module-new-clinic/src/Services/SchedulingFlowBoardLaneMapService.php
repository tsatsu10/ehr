<?php

/**
 * S1 Flow Board admin lane mapping — apptstat → ordered lanes (PRD §10.3)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Services\AppointmentService;
use OpenEMR\Services\ListService;
use OpenEMR\Services\PatientTrackerService;

class SchedulingFlowBoardLaneMapService
{
    /** @var list<string> */
    public const DEFAULT_LANE_KEYS = ['booked', 'arrived', 'roomed', 'with_provider', 'checked_out'];

    /** @var array<string, string> */
    private const DEFAULT_LANE_LABELS = [
        'booked' => 'Booked',
        'arrived' => 'Arrived',
        'roomed' => 'Roomed',
        'with_provider' => 'With provider',
        'checked_out' => 'Checked out',
    ];

    public function __construct(
        private readonly SchedulingAccessService $access = new SchedulingAccessService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * Resolved lanes for Flow Board rendering (grouped apptstat codes).
     *
     * @return list<array<string, mixed>>
     */
    public function getResolvedLanes(int $facilityId): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $statuses = $this->loadApptStatOptions();
        $mapping = $this->loadMappingRows($facilityId);
        if ($mapping === []) {
            $mapping = $this->buildDefaultMapping($statuses);
        }

        $byLane = [];
        foreach ($statuses as $code => $meta) {
            $row = $mapping[$code] ?? null;
            if ($row === null) {
                continue;
            }
            $laneKey = (string) ($row['lane_key'] ?? $code);
            if (!isset($byLane[$laneKey])) {
                $label = trim((string) ($row['lane_label'] ?? ''));
                $byLane[$laneKey] = [
                    'lane_key' => $laneKey,
                    'label' => $label !== '' ? $label : (self::DEFAULT_LANE_LABELS[$laneKey] ?? $meta['label']),
                    'lane_seq' => (int) ($row['lane_seq'] ?? 0),
                    'always_show' => !empty($meta['is_check_in']) || !empty($meta['is_check_out']),
                    'status_codes' => [],
                    'representative_status' => $code,
                ];
            }
            $byLane[$laneKey]['status_codes'][] = $code;
            if ((int) ($row['status_seq'] ?? 0) === 0) {
                $byLane[$laneKey]['representative_status'] = $code;
            }
            if (!empty($meta['is_check_in'])) {
                $byLane[$laneKey]['representative_status'] = $code;
                $byLane[$laneKey]['always_show'] = true;
            }
            if (!empty($meta['is_check_out'])) {
                $byLane[$laneKey]['always_show'] = true;
            }
        }

        uasort($byLane, static fn (array $a, array $b): int => ($a['lane_seq'] ?? 0) <=> ($b['lane_seq'] ?? 0));

        $lanes = [];
        foreach ($byLane as $lane) {
            sort($lane['status_codes']);
            $lanes[] = $lane;
        }

        return $lanes;
    }

    /**
     * Admin editor payload.
     *
     * @return array<string, mixed>
     */
    public function getAdminConfig(int $facilityId): array
    {
        $this->access->assertHubAccess();
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $statuses = $this->loadApptStatOptions();
        $mapping = $this->loadMappingRows($facilityId);
        if ($mapping === []) {
            $mapping = $this->buildDefaultMapping($statuses);
        }

        $rows = [];
        foreach ($statuses as $code => $meta) {
            $map = $mapping[$code] ?? [
                'lane_key' => $code,
                'lane_label' => $meta['label'],
                'lane_seq' => (int) ($meta['seq'] ?? 0),
                'status_seq' => 0,
            ];
            $rows[] = [
                'apptstat_code' => $code,
                'apptstat_label' => $meta['label'],
                'is_check_in' => $meta['is_check_in'],
                'is_check_out' => $meta['is_check_out'],
                'lane_key' => (string) ($map['lane_key'] ?? $code),
                'lane_label' => (string) ($map['lane_label'] ?? ''),
                'lane_seq' => (int) ($map['lane_seq'] ?? 0),
                'status_seq' => (int) ($map['status_seq'] ?? 0),
            ];
        }

        return [
            'facility_id' => $facilityId,
            'default_lane_keys' => self::DEFAULT_LANE_KEYS,
            'default_lane_labels' => self::DEFAULT_LANE_LABELS,
            'rows' => $rows,
            'is_custom' => $this->loadMappingRows($facilityId) !== [],
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     * @return array<string, mixed>
     */
    public function saveAdminConfig(int $facilityId, array $rows): array
    {
        $this->access->assertHubAccess();
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Admin lane mapping write permission denied', 403);
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        QueryUtils::sqlStatementThrowException(
            'DELETE FROM new_clinic_flowboard_lane_map WHERE facility_id = ?',
            [$facilityId],
        );

        foreach ($rows as $row) {
            $code = trim((string) ($row['apptstat_code'] ?? ''));
            $laneKey = trim((string) ($row['lane_key'] ?? ''));
            if ($code === '' || $laneKey === '') {
                continue;
            }
            QueryUtils::sqlStatementThrowException(
                'INSERT INTO new_clinic_flowboard_lane_map
                 (facility_id, apptstat_code, lane_key, lane_label, lane_seq, status_seq)
                 VALUES (?, ?, ?, ?, ?, ?)',
                [
                    $facilityId,
                    $code,
                    $laneKey,
                    trim((string) ($row['lane_label'] ?? '')),
                    (int) ($row['lane_seq'] ?? 0),
                    (int) ($row['status_seq'] ?? 0),
                ],
            );
        }

        return $this->getAdminConfig($facilityId);
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function loadMappingRows(int $facilityId): array
    {
        $records = QueryUtils::fetchRecords(
            'SELECT apptstat_code, lane_key, lane_label, lane_seq, status_seq
             FROM new_clinic_flowboard_lane_map
             WHERE facility_id = ?
             ORDER BY lane_seq ASC, status_seq ASC',
            [$facilityId],
        ) ?: [];

        $map = [];
        foreach ($records as $row) {
            $code = (string) ($row['apptstat_code'] ?? '');
            if ($code === '') {
                continue;
            }
            $map[$code] = $row;
        }

        return $map;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function loadApptStatOptions(): array
    {
        $listService = new ListService();
        $options = $listService->getOptionsByListName('apptstat', ['activity' => 1]) ?: [];
        $statuses = [];
        foreach ($options as $option) {
            $code = (string) ($option['option_id'] ?? '');
            if ($code === '') {
                continue;
            }
            $settings = PatientTrackerService::collectApptStatusSettings($code);
            $alertMinutes = is_array($settings) ? (int) ($settings['time_alert'] ?? 0) : 0;
            $statuses[$code] = [
                'label' => (string) ($option['title'] ?? $code),
                'seq' => (int) ($option['seq'] ?? 0),
                'is_check_in' => AppointmentService::isCheckInStatus($code),
                'is_check_out' => AppointmentService::isCheckOutStatus($code),
                'alert_minutes' => $alertMinutes,
            ];
        }

        uasort($statuses, static fn (array $a, array $b): int => ($a['seq'] ?? 0) <=> ($b['seq'] ?? 0));

        return $statuses;
    }

    /**
     * @param array<string, array<string, mixed>> $statuses
     * @return array<string, array<string, mixed>>
     */
    private function buildDefaultMapping(array $statuses): array
    {
        $codes = array_keys($statuses);
        $checkInIdx = null;
        $checkOutIdx = null;
        foreach ($codes as $i => $code) {
            if (!empty($statuses[$code]['is_check_in'])) {
                $checkInIdx = $i;
            }
            if (!empty($statuses[$code]['is_check_out'])) {
                $checkOutIdx = $i;
            }
        }

        $mapping = [];
        $laneSeq = [
            'booked' => 10,
            'arrived' => 20,
            'roomed' => 30,
            'with_provider' => 40,
            'checked_out' => 50,
        ];

        foreach ($codes as $i => $code) {
            $meta = $statuses[$code];
            if (!empty($meta['is_check_out'])) {
                $laneKey = 'checked_out';
            } elseif (!empty($meta['is_check_in'])) {
                $laneKey = 'arrived';
            } elseif ($checkInIdx !== null && $i < $checkInIdx) {
                $laneKey = 'booked';
            } elseif ($checkOutIdx !== null && $checkInIdx !== null && $i > $checkInIdx && $i < $checkOutIdx) {
                $mid = (int) floor(($checkInIdx + $checkOutIdx) / 2);
                $laneKey = $i <= $mid ? 'roomed' : 'with_provider';
            } elseif ($checkInIdx !== null && $i > $checkInIdx) {
                $laneKey = 'with_provider';
            } else {
                $laneKey = 'booked';
            }

            $mapping[$code] = [
                'lane_key' => $laneKey,
                'lane_label' => self::DEFAULT_LANE_LABELS[$laneKey] ?? $meta['label'],
                'lane_seq' => $laneSeq[$laneKey] ?? 99,
                'status_seq' => (int) ($meta['seq'] ?? 0),
            ];
        }

        return $mapping;
    }
}

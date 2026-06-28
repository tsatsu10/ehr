<?php

/**
 * Lab routing chips for Doctor Desk (M4-F11) and encounter readiness checks
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class LabResultsReadinessService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function isLabRoleEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_lab_role', 0, $facilityId) === 1;
    }

    /**
     * @return array<string, mixed>
     */
    public function getEncounterRouting(int $pid, int $encounter, int $facilityId): array
    {
        if (!$this->isLabRoleEnabled($facilityId) || $pid <= 0 || $encounter <= 0) {
            return $this->emptyRouting();
        }

        $chips = $this->batchRoutingChipsForVisits([[
            'id' => 0,
            'pid' => $pid,
            'encounter' => $encounter,
            'facility_id' => $facilityId,
        ]], $facilityId);

        return $chips[0] ?? $this->emptyRouting();
    }

    /**
     * @param array<int, array<string, mixed>> $visitRows
     * @return array<int, array<string, mixed>> keyed by visit id
     */
    public function batchRoutingChipsForVisits(array $visitRows, int $defaultFacilityId): array
    {
        $visitRows = array_values(array_filter($visitRows, static function (array $row): bool {
            return (int) ($row['id'] ?? 0) >= 0
                && (int) ($row['pid'] ?? 0) > 0
                && (int) ($row['encounter'] ?? 0) > 0;
        }));

        if ($visitRows === []) {
            return [];
        }

        $facilityId = $defaultFacilityId;
        foreach ($visitRows as $row) {
            $rowFacility = (int) ($row['facility_id'] ?? 0);
            if ($rowFacility > 0) {
                $facilityId = $rowFacility;
                break;
            }
        }

        if (!$this->isLabRoleEnabled($facilityId)) {
            return [];
        }

        $visitIds = array_values(array_unique(array_map(
            static fn (array $row): int => (int) ($row['id'] ?? 0),
            array_filter($visitRows, static fn (array $row): bool => (int) ($row['id'] ?? 0) > 0)
        )));

        $labCounts = $this->batchLabOrderCounts($visitIds);
        $rxCounts = $this->batchRxCounts($visitIds);
        $readiness = $this->batchResultsReadyByVisit($visitIds);

        $byVisitId = [];
        foreach ($visitRows as $row) {
            $visitId = (int) ($row['id'] ?? 0);
            $labCount = $visitId > 0 ? (int) ($labCounts[$visitId] ?? 0) : $this->countLabOrders(
                (int) $row['pid'],
                (int) $row['encounter']
            );
            $rxCount = $visitId > 0 ? (int) ($rxCounts[$visitId] ?? 0) : $this->countRx(
                (int) $row['pid'],
                (int) $row['encounter']
            );
            $resultsReady = $visitId > 0
                ? !empty($readiness[$visitId])
                : $this->isResultsReady((int) $row['pid'], (int) $row['encounter']);
            $labIncomplete = $this->hasIncompleteLabOrders((int) $row['pid'], (int) $row['encounter']);

            $chips = [
                'lab_ordered' => $labCount > 0,
                'lab_order_incomplete' => $labIncomplete,
                'rx_pending' => $rxCount > 0,
                'results_ready' => $resultsReady && $labCount > 0,
                'lab_count' => $labCount,
                'rx_count' => $rxCount,
            ];

            if ($visitId > 0) {
                $byVisitId[$visitId] = $chips;
            } else {
                $byVisitId[0] = $chips;
            }
        }

        return $byVisitId;
    }

    public function isResultsReady(int $pid, int $encounter): bool
    {
        if ($pid <= 0 || $encounter <= 0) {
            return false;
        }

        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(DISTINCT pc.procedure_order_seq) AS total_lines,
                    COUNT(DISTINCT CASE WHEN pr.review_status = 'reviewed'
                        THEN pc.procedure_order_seq END) AS reviewed_lines
             FROM procedure_order po
             INNER JOIN procedure_order_code pc ON pc.procedure_order_id = po.procedure_order_id
             LEFT JOIN procedure_report pr ON pr.procedure_order_id = pc.procedure_order_id
                 AND pr.procedure_order_seq = pc.procedure_order_seq
             WHERE po.patient_id = ? AND po.encounter_id = ? AND po.activity = 1",
            [$pid, $encounter]
        );

        if (!is_array($row)) {
            return false;
        }

        $total = (int) ($row['total_lines'] ?? 0);
        $reviewed = (int) ($row['reviewed_lines'] ?? 0);

        return $total > 0 && $reviewed >= $total;
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyRouting(): array
    {
        return [
            'lab_ordered' => false,
            'lab_order_incomplete' => false,
            'rx_pending' => false,
            'results_ready' => false,
            'lab_count' => 0,
            'rx_count' => 0,
        ];
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, int>
     */
    private function batchLabOrderCounts(array $visitIds): array
    {
        $visitIds = array_values(array_unique(array_filter($visitIds, static fn (int $id): bool => $id > 0)));
        if ($visitIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($visitIds), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT v.id AS visit_id, COUNT(DISTINCT po.procedure_order_id) AS cnt
             FROM new_visit v
             INNER JOIN procedure_order po
                ON po.patient_id = v.pid AND po.encounter_id = v.encounter AND po.activity = 1
             WHERE v.id IN ($placeholders)
             GROUP BY v.id",
            $visitIds
        ) ?: [];

        $counts = [];
        foreach ($rows as $row) {
            $counts[(int) ($row['visit_id'] ?? 0)] = (int) ($row['cnt'] ?? 0);
        }

        return $counts;
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, int>
     */
    private function batchRxCounts(array $visitIds): array
    {
        $visitIds = array_values(array_unique(array_filter($visitIds, static fn (int $id): bool => $id > 0)));
        if ($visitIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($visitIds), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT v.id AS visit_id, COUNT(*) AS cnt
             FROM new_visit v
             INNER JOIN prescriptions rx
                ON rx.patient_id = v.pid AND rx.encounter = v.encounter AND rx.active = 1
             WHERE v.id IN ($placeholders)
             GROUP BY v.id",
            $visitIds
        ) ?: [];

        $counts = [];
        foreach ($rows as $row) {
            $counts[(int) ($row['visit_id'] ?? 0)] = (int) ($row['cnt'] ?? 0);
        }

        return $counts;
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, bool>
     */
    private function batchResultsReadyByVisit(array $visitIds): array
    {
        $visitIds = array_values(array_unique(array_filter($visitIds, static fn (int $id): bool => $id > 0)));
        if ($visitIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($visitIds), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT v.id AS visit_id,
                    COUNT(DISTINCT pc.procedure_order_seq) AS total_lines,
                    COUNT(DISTINCT CASE WHEN pr.review_status = 'reviewed'
                        THEN pc.procedure_order_seq END) AS reviewed_lines
             FROM new_visit v
             INNER JOIN procedure_order po
                ON po.patient_id = v.pid AND po.encounter_id = v.encounter AND po.activity = 1
             INNER JOIN procedure_order_code pc ON pc.procedure_order_id = po.procedure_order_id
             LEFT JOIN procedure_report pr ON pr.procedure_order_id = pc.procedure_order_id
                 AND pr.procedure_order_seq = pc.procedure_order_seq
             WHERE v.id IN ($placeholders)
             GROUP BY v.id",
            $visitIds
        ) ?: [];

        $ready = [];
        foreach ($rows as $row) {
            $visitId = (int) ($row['visit_id'] ?? 0);
            $total = (int) ($row['total_lines'] ?? 0);
            $reviewed = (int) ($row['reviewed_lines'] ?? 0);
            $ready[$visitId] = $total > 0 && $reviewed >= $total;
        }

        return $ready;
    }

    private function countLabOrders(int $pid, int $encounter): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS cnt FROM procedure_order
             WHERE patient_id = ? AND encounter_id = ? AND activity = 1',
            [$pid, $encounter]
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    private function countRx(int $pid, int $encounter): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS cnt FROM prescriptions
             WHERE patient_id = ? AND encounter = ? AND active = 1',
            [$pid, $encounter]
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    private function hasIncompleteLabOrders(int $pid, int $encounter): bool
    {
        if ($pid <= 0 || $encounter <= 0) {
            return false;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS cnt
             FROM procedure_order po
             WHERE po.patient_id = ? AND po.encounter_id = ? AND po.activity = 1
               AND NOT EXISTS (
                   SELECT 1 FROM procedure_order_code poc
                   WHERE poc.procedure_order_id = po.procedure_order_id
               )',
            [$pid, $encounter]
        );

        return is_array($row) && (int) ($row['cnt'] ?? 0) > 0;
    }
}

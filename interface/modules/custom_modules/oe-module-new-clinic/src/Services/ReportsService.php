<?php

/**
 * Daily Reports aggregation (M7)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ReportsService
{
    private const TERMINAL_STATES = ['completed', 'closed_unpaid', 'cancelled'];

    public function __construct(
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VisitRowEnricher $rowEnricher = new VisitRowEnricher(),
        private readonly EncounterSignService $signService = new EncounterSignService(),
        private readonly ReconciliationService $reconciliation = new ReconciliationService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly MoneyFormatService $moneyFormat = new MoneyFormatService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getDailyReport(int $facilityId, ?string $visitDate): array
    {
        $visitDate = self::normalizeVisitDate($visitDate);
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $this->visitScope->repairOrphanVisits($facilityId, $visitDate);

        $openVisits = $this->openVisits($facilityId, $visitDate);
        $unsignedVisits = $this->unsignedVisits($facilityId, $visitDate);

        return [
            'visit_date' => $visitDate,
            'facility_id' => $facilityId,
            'visits' => $this->visitSummary($facilityId, $visitDate),
            'cash' => $this->cashSummary($facilityId, $visitDate),
            'reconciliation' => $this->buildReconciliationSummary($facilityId, $visitDate),
            'open_visits' => $openVisits,
            'eod_open' => self::summarizeOpenVisits($openVisits),
            'unsigned_alerts' => self::summarizeUnsignedAlerts($unsignedVisits),
            'unpaid_visits' => $this->unpaidVisits($facilityId, $visitDate),
            'data_quality' => $this->dataQuality($facilityId, $visitDate),
            'unsigned_visits' => $unsignedVisits,
            'queue_bypass' => $this->queueBypassLog($facilityId, $visitDate),
            'last_updated' => date('c'),
            'currency' => $this->moneyFormat->getFormatPayload($facilityId),
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $openVisits
     * @return array<string, array{count: int, oldest_wait_minutes: int}>
     */
    public static function summarizeOpenVisits(array $openVisits): array
    {
        $summary = [];
        foreach ($openVisits as $visit) {
            $state = (string) ($visit['state'] ?? '');
            if ($state === '') {
                continue;
            }
            if (!isset($summary[$state])) {
                $summary[$state] = ['count' => 0, 'oldest_wait_minutes' => 0];
            }
            $summary[$state]['count']++;
            $wait = (int) ($visit['wait_minutes'] ?? 0);
            if ($wait > $summary[$state]['oldest_wait_minutes']) {
                $summary[$state]['oldest_wait_minutes'] = $wait;
            }
        }

        ksort($summary);

        return $summary;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function unpaidVisits(int $facilityId, string $visitDate): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                    vt.label AS visit_type_label,
                    (SELECT l.reason FROM new_visit_state_log l
                     WHERE l.visit_id = v.id AND l.to_state = 'closed_unpaid'
                     ORDER BY l.id DESC LIMIT 1) AS unpaid_reason,
                    (SELECT COALESCE(SUM(b.fee * GREATEST(b.units, 1)), 0)
                     FROM billing b
                     WHERE b.pid = v.pid AND b.encounter = v.encounter AND b.activity = 1) AS charges_total
             FROM new_visit v
             INNER JOIN patient_data pd ON pd.pid = v.pid
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             WHERE v.facility_id = ? AND v.visit_date = ? AND v.state = 'closed_unpaid'
             ORDER BY v.left_unpaid_at DESC, v.queue_number ASC",
            [$facilityId, $visitDate]
        ) ?: [];

        return array_map(function (array $row): array {
            $enriched = $this->rowEnricher->enrichVisitRow($row);

            return array_merge($enriched, [
                'unpaid_reason' => (string) ($row['unpaid_reason'] ?? ''),
                'charges_total' => round((float) ($row['charges_total'] ?? 0), 2),
            ]);
        }, $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function unsignedVisits(int $facilityId, string $visitDate): array
    {
        $states = EncounterSignService::UNSIGNED_REPORT_STATES;
        $placeholders = implode(',', array_fill(0, count($states), '?'));
        $params = array_merge([$facilityId, $visitDate], $states);

        $rows = QueryUtils::fetchRecords(
            "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                    vt.label AS visit_type_label,
                    u.fname AS provider_fname, u.lname AS provider_lname,
                    (SELECT l.created_at FROM new_visit_state_log l
                     WHERE l.visit_id = v.id AND l.from_state = 'with_doctor'
                     ORDER BY l.id DESC LIMIT 1) AS consult_ended_at
             FROM new_visit v
             INNER JOIN patient_data pd ON pd.pid = v.pid
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             LEFT JOIN users u ON u.id = v.assigned_provider_id
             WHERE v.facility_id = ? AND v.visit_date = ?
             AND v.state IN ($placeholders)
             AND v.encounter > 0
             ORDER BY v.is_urgent DESC, v.queue_number ASC",
            $params
        ) ?: [];

        $webroot = $GLOBALS['webroot'] ?? '';
        $unsigned = [];
        $signedMap = $this->signService->batchVisitDocumentationSigned($rows);

        foreach ($rows as $row) {
            $encounterId = (int) ($row['encounter'] ?? 0);
            if ($signedMap[$encounterId] ?? false) {
                continue;
            }

            $visitId = (int) ($row['id'] ?? 0);
            $enriched = $this->rowEnricher->enrichVisitRow($row, $visitId);
            $providerName = trim(($row['provider_fname'] ?? '') . ' ' . ($row['provider_lname'] ?? ''));
            $hoursUnsigned = self::hoursSinceTimestamp(
                (string) ($row['consult_ended_at'] ?? $row['started_at'] ?? '')
            );

            $unsigned[] = array_merge($enriched, [
                'provider_name' => $providerName !== '' ? $providerName : null,
                'hours_unsigned' => $hoursUnsigned,
                'encounter_url' => EncounterSignService::buildEncounterUrl(
                    $webroot,
                    (int) ($row['pid'] ?? 0),
                    $encounterId
                ),
                'service_profile' => (string) ($row['service_profile'] ?? 'full_opd'),
            ]);
        }

        usort($unsigned, static function (array $a, array $b): int {
            return ($b['hours_unsigned'] ?? 0) <=> ($a['hours_unsigned'] ?? 0);
        });

        return $unsigned;
    }

    /**
     * @param array<int, array<string, mixed>> $unsignedVisits
     * @return array<string, int>
     */
    public static function summarizeUnsignedAlerts(array $unsignedVisits): array
    {
        $alerts = [
            'with_doctor' => 0,
            'ready_for_payment' => 0,
        ];

        foreach ($unsignedVisits as $visit) {
            $state = (string) ($visit['state'] ?? '');
            if (isset($alerts[$state])) {
                $alerts[$state]++;
            }
        }

        return $alerts;
    }

    public static function hoursSinceTimestamp(string $timestamp): float
    {
        if ($timestamp === '') {
            return 0.0;
        }

        $parsed = strtotime($timestamp);
        if ($parsed === false) {
            return 0.0;
        }

        return round(max(0, time() - $parsed) / 3600, 1);
    }

    /**
     * @return array<string, mixed>
     */
    private function dataQuality(int $facilityId, string $visitDate): array
    {
        $registeredRow = QueryUtils::querySingleRow(
            "SELECT COUNT(DISTINCT pd.pid) AS cnt
             FROM patient_data pd
             INNER JOIN new_visit v ON v.pid = pd.pid
             WHERE DATE(pd.regdate) = ? AND v.facility_id = ? AND v.visit_date = ?",
            [$visitDate, $facilityId, $visitDate]
        );
        $registeredToday = (int) (is_array($registeredRow) ? ($registeredRow['cnt'] ?? 0) : 0);

        $bucketRows = QueryUtils::fetchRecords(
            "SELECT
                SUM(CASE WHEN COALESCE(pc.completion_score, 0) < 40 THEN 1 ELSE 0 END) AS under_40,
                SUM(CASE WHEN COALESCE(pc.completion_score, 0) BETWEEN 40 AND 69 THEN 1 ELSE 0 END) AS from_40_to_69,
                SUM(CASE WHEN COALESCE(pc.completion_score, 0) BETWEEN 70 AND 99 THEN 1 ELSE 0 END) AS from_70_to_99,
                SUM(CASE WHEN COALESCE(pc.completion_score, 0) = 100 THEN 1 ELSE 0 END) AS complete_100
             FROM new_visit v
             INNER JOIN patient_data pd ON pd.pid = v.pid
             LEFT JOIN new_patient_completion pc ON pc.pid = v.pid
             WHERE v.facility_id = ? AND v.visit_date = ?
             AND DATE(pd.regdate) = ?",
            [$facilityId, $visitDate, $visitDate]
        ) ?: [];
        $buckets = $bucketRows[0] ?? [];

        $thresholdRow = QueryUtils::querySingleRow(
            "SELECT config_value FROM new_clinic_config
             WHERE facility_id IN (0, ?) AND config_key = 'completion_required_for_billing'
             ORDER BY facility_id DESC LIMIT 1",
            [$facilityId]
        );
        $threshold = (int) (is_array($thresholdRow) ? ($thresholdRow['config_value'] ?? 70) : 70);

        $staleRows = QueryUtils::fetchRecords(
            "SELECT DISTINCT v.pid, pd.fname, pd.lname, pd.pubpid,
                    COALESCE(pc.completion_score, 0) AS completion_score
             FROM new_visit v
             INNER JOIN patient_data pd ON pd.pid = v.pid
             LEFT JOIN new_patient_completion pc ON pc.pid = v.pid
             WHERE v.facility_id = ? AND v.visit_date = ?
             AND COALESCE(pc.completion_score, 0) < ?
             ORDER BY completion_score ASC, pd.lname ASC
             LIMIT 25",
            [$facilityId, $visitDate, $threshold]
        ) ?: [];

        $dupRow = QueryUtils::querySingleRow(
            "SELECT COUNT(DISTINCT l.id) AS cnt FROM log l
             WHERE DATE(l.date) = ? AND l.event = 'new_patient' AND l.category = 'dup_override'
             AND (
                l.patient_id = 0
                OR EXISTS (
                    SELECT 1 FROM new_visit v
                    WHERE v.pid = l.patient_id AND v.facility_id = ? AND v.visit_date = ?
                )
             )",
            [$visitDate, $facilityId, $visitDate]
        );

        return [
            'patients_registered_today' => $registeredToday,
            'completion_buckets' => [
                'under_40' => (int) ($buckets['under_40'] ?? 0),
                'from_40_to_69' => (int) ($buckets['from_40_to_69'] ?? 0),
                'from_70_to_99' => (int) ($buckets['from_70_to_99'] ?? 0),
                'complete_100' => (int) ($buckets['complete_100'] ?? 0),
            ],
            'by_registering_user' => $this->completionByRegisteringUser($facilityId, $visitDate),
            'stale_incomplete' => array_map(static function (array $row): array {
                return [
                    'pid' => (int) ($row['pid'] ?? 0),
                    'display_name' => trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? '')),
                    'pubpid' => (string) ($row['pubpid'] ?? ''),
                    'completion_score' => (int) ($row['completion_score'] ?? 0),
                ];
            }, $staleRows),
            'dup_overrides_today' => (int) (is_array($dupRow) ? ($dupRow['cnt'] ?? 0) : 0),
            'billing_threshold' => $threshold,
        ];
    }

    /**
     * @return array<string, int>
     */
    private function visitSummary(int $facilityId, string $visitDate): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT state, COUNT(*) AS cnt FROM new_visit
             WHERE facility_id = ? AND visit_date = ?
             GROUP BY state",
            [$facilityId, $visitDate]
        ) ?: [];

        $byState = [];
        foreach ($rows as $row) {
            $byState[(string) $row['state']] = (int) ($row['cnt'] ?? 0);
        }

        $started = array_sum($byState) - ($byState['cancelled'] ?? 0);
        $cancelled = $byState['cancelled'] ?? 0;
        $completed = $byState['completed'] ?? 0;
        $closedUnpaid = $byState['closed_unpaid'] ?? 0;
        $stillOpen = 0;

        foreach ($byState as $state => $count) {
            if (!in_array($state, self::TERMINAL_STATES, true)) {
                $stillOpen += $count;
            }
        }

        return [
            'started' => $started,
            'completed' => $completed,
            'cancelled' => $cancelled,
            'closed_unpaid' => $closedUnpaid,
            'still_open' => $stillOpen,
            'by_state' => $byState,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function cashSummary(int $facilityId, string $visitDate): array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS receipt_count,
                    COALESCE(SUM(visit_paid.amount), 0) AS total_collected
             FROM (
                SELECT v.id, MAX(aa.pay_amount) AS amount
                FROM new_visit v
                INNER JOIN ar_activity aa ON aa.pid = v.pid AND aa.encounter = v.encounter
                WHERE v.facility_id = ? AND v.visit_date = ? AND v.state = 'completed'
                AND DATE(aa.post_time) = ? AND aa.pay_amount > 0
                GROUP BY v.id
             ) visit_paid",
            [$facilityId, $visitDate, $visitDate]
        );

        return [
            'receipt_count' => is_array($row) ? (int) ($row['receipt_count'] ?? 0) : 0,
            'total_collected' => round((float) (is_array($row) ? ($row['total_collected'] ?? 0) : 0), 2),
            'by_category' => $this->cashByCategory($facilityId, $visitDate),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function cashByCategory(int $facilityId, string $visitDate): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT COALESCE(fs.category, 'other') AS category_key,
                    COALESCE(SUM(b.fee * GREATEST(b.units, 1)), 0) AS amount
             FROM new_visit v
             INNER JOIN billing b ON b.pid = v.pid AND b.encounter = v.encounter AND b.activity = 1
             LEFT JOIN new_fee_schedule fs ON fs.id = (
                 SELECT fs2.id FROM new_fee_schedule fs2
                 WHERE fs2.billing_code = b.code AND fs2.code_type = b.code_type
                 AND fs2.facility_id IN (0, v.facility_id) AND fs2.is_active = 1
                 ORDER BY fs2.facility_id DESC, fs2.id ASC
                 LIMIT 1
             )
             WHERE v.facility_id = ? AND v.visit_date = ? AND v.state = 'completed'
             GROUP BY category_key
             ORDER BY amount DESC",
            [$facilityId, $visitDate]
        ) ?: [];

        $labels = FeeScheduleAdminService::CATEGORIES;

        return array_map(static function (array $row) use ($labels): array {
            $key = (string) ($row['category_key'] ?? 'other');

            return [
                'category' => $key,
                'label' => $labels[$key] ?? ucfirst($key),
                'amount' => round((float) ($row['amount'] ?? 0), 2),
            ];
        }, $rows);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildReconciliationSummary(int $facilityId, string $visitDate): array
    {
        $totals = $this->reconciliation->fetchTotals($facilityId, $visitDate);
        $tolerance = (float) ($this->config->get('reconciliation_tolerance', '0.01', $facilityId) ?? '0.01');
        $moduleTotal = (float) ($totals['module_total'] ?? 0);
        $coreTotal = (float) ($totals['core_total'] ?? 0);
        $delta = ReconciliationService::calculateDelta($moduleTotal, $coreTotal);
        $status = ReconciliationService::evaluateStatus($moduleTotal, $coreTotal, $tolerance);
        $latestRun = $this->reconciliation->getLatestRunForDate($facilityId, $visitDate);

        $payload = $this->moneyFormat->getFormatPayload($facilityId);

        return [
            'status' => $status,
            'module_total' => $moduleTotal,
            'core_total' => $coreTotal,
            'delta_amount' => $delta,
            'tolerance' => $tolerance,
            'currency_symbol' => (string) $payload['currency_symbol'],
            'currency_decimals' => (int) $payload['currency_decimals'],
            'currency_symbol_position' => (string) $payload['currency_symbol_position'],
            'latest_run' => $latestRun,
            'recent_runs' => $this->reconciliation->listRecentRuns($facilityId, 30),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function completionByRegisteringUser(int $facilityId, string $visitDate): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT reg.registrar_username,
                    COALESCE(u.fname, '') AS fname,
                    COALESCE(u.lname, '') AS lname,
                    COUNT(DISTINCT reg.pid) AS patients_registered,
                    SUM(CASE WHEN COALESCE(pc.completion_score, 0) < 40 THEN 1 ELSE 0 END) AS under_40,
                    SUM(CASE WHEN COALESCE(pc.completion_score, 0) BETWEEN 40 AND 69 THEN 1 ELSE 0 END) AS from_40_to_69,
                    SUM(CASE WHEN COALESCE(pc.completion_score, 0) BETWEEN 70 AND 99 THEN 1 ELSE 0 END) AS from_70_to_99,
                    SUM(CASE WHEN COALESCE(pc.completion_score, 0) = 100 THEN 1 ELSE 0 END) AS complete_100
             FROM (
                 SELECT pd.pid,
                        COALESCE(
                            (SELECT l.user FROM log l
                             WHERE l.patient_id = pd.pid
                             AND l.event IN ('new_patient', 'patient_record_add')
                             ORDER BY l.date ASC, l.id ASC
                             LIMIT 1),
                            ''
                        ) AS registrar_username
                 FROM patient_data pd
                 INNER JOIN new_visit v ON v.pid = pd.pid AND v.facility_id = ? AND v.visit_date = ?
                 WHERE DATE(pd.regdate) = ?
             ) reg
             LEFT JOIN new_patient_completion pc ON pc.pid = reg.pid
             LEFT JOIN users u ON u.username = reg.registrar_username
             GROUP BY reg.registrar_username, u.fname, u.lname
             ORDER BY patients_registered DESC, u.lname ASC, reg.registrar_username ASC",
            [$facilityId, $visitDate, $visitDate]
        ) ?: [];

        return array_map(static function (array $row): array {
            $name = trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));
            $username = (string) ($row['registrar_username'] ?? '');

            return [
                'registrar' => $name !== '' ? $name : ($username !== '' ? $username : 'Unknown'),
                'patients_registered' => (int) ($row['patients_registered'] ?? 0),
                'completion_buckets' => [
                    'under_40' => (int) ($row['under_40'] ?? 0),
                    'from_40_to_69' => (int) ($row['from_40_to_69'] ?? 0),
                    'from_70_to_99' => (int) ($row['from_70_to_99'] ?? 0),
                    'complete_100' => (int) ($row['complete_100'] ?? 0),
                ],
            ];
        }, $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function openVisits(int $facilityId, string $visitDate): array
    {
        $placeholders = implode(',', array_fill(0, count(self::TERMINAL_STATES), '?'));
        $params = array_merge([$facilityId, $visitDate], self::TERMINAL_STATES);

        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                WHERE v.facility_id = ? AND v.visit_date = ?
                AND v.state NOT IN ($placeholders)
                ORDER BY v.is_urgent DESC, v.started_at ASC";

        $rows = QueryUtils::fetchRecords($sql, $params) ?: [];
        $visitIds = array_map(fn (array $row) => (int) ($row['id'] ?? 0), $rows);
        $skippedMap = $this->rowEnricher->batchSkippedTriage($visitIds);

        return array_map(
            fn (array $row) => $this->rowEnricher->enrichVisitRow(
                $row,
                (int) ($row['id'] ?? 0),
                $skippedMap
            ),
            $rows
        );
    }

    public static function normalizeVisitDate(?string $visitDate): string
    {
        $visitDate = $visitDate ?? date('Y-m-d');
        $parsed = \DateTime::createFromFormat('Y-m-d', $visitDate);

        if (!$parsed || $parsed->format('Y-m-d') !== $visitDate) {
            throw new \InvalidArgumentException('Invalid visit date');
        }

        return $visitDate;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function queueBypassLog(int $facilityId, string $visitDate): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT l.id, l.visit_id, l.from_state, l.to_state, l.reason, l.created_at,
                    v.queue_number, pd.fname, pd.lname, pd.pubpid,
                    u.fname AS actor_fname, u.lname AS actor_lname
             FROM new_visit_state_log l
             INNER JOIN new_visit v ON v.id = l.visit_id
             INNER JOIN patient_data pd ON pd.pid = v.pid
             LEFT JOIN users u ON u.id = l.actor_user_id
             WHERE v.facility_id = ? AND v.visit_date = ?
             AND (l.reason LIKE 'skip_lab:%' OR l.reason LIKE 'skip_pharmacy:%')
             ORDER BY l.created_at DESC",
            [$facilityId, $visitDate]
        ) ?: [];

        return array_map(static function (array $row): array {
            $reason = (string) ($row['reason'] ?? '');
            $type = str_starts_with($reason, 'skip_pharmacy:') ? 'pharmacy' : 'lab';
            $actor = trim(($row['actor_fname'] ?? '') . ' ' . ($row['actor_lname'] ?? ''));

            return [
                'id' => (int) ($row['id'] ?? 0),
                'visit_id' => (int) ($row['visit_id'] ?? 0),
                'queue_number' => (int) ($row['queue_number'] ?? 0),
                'display_name' => trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? '')),
                'pubpid' => (string) ($row['pubpid'] ?? ''),
                'from_state' => (string) ($row['from_state'] ?? ''),
                'bypass_type' => $type,
                'reason' => preg_replace('/^skip_(lab|pharmacy):\s*/', '', $reason) ?? $reason,
                'actor_name' => $actor !== '' ? $actor : null,
                'created_at' => $row['created_at'] ?? null,
            ];
        }, $rows);
    }
}

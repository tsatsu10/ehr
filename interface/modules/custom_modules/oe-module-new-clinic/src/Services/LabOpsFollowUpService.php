<?php

/**
 * CP-4 — lab follow-up oversight views (native replacement for the stock
 * pending_orders.php / pending_followup.php reports).
 *
 *   - "Unresulted orders": procedure orders in the window with no report yet
 *     (ordered but never resulted — the thing the stock pending-orders report
 *     answers), age-bucketed like the outstanding-balances list.
 *   - "Abnormal, no follow-up": abnormal results whose patient has not been
 *     back (no later visit) since the report — the stock pending-followup gap.
 *
 * Bounded by design (R1–R8): facility-scoped through form_encounter, a
 * required date window (7/14/30 days, default 14), and hard LIMITs.
 * Gated by `enable_lab_followup_views` (default OFF) + the Lab Ops read ACL.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class LabOpsFollowUpService
{
    private const ROW_CAP = 100;
    private const WINDOWS = [7, 14, 30];

    public function __construct(
        private readonly LabOpsAccessService $access = new LabOpsAccessService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getFollowUp(int $facilityId, int $windowDays = 14): array
    {
        $this->access->assertHubAccess();
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        if ($this->config->getInt('enable_lab_followup_views', 0, $facilityId) !== 1) {
            throw new \RuntimeException('Lab follow-up views are not enabled', 403);
        }
        $windowDays = in_array($windowDays, self::WINDOWS, true) ? $windowDays : 14;
        $since = date('Y-m-d', strtotime('-' . $windowDays . ' days'));

        return [
            'facility_id' => $facilityId,
            'window_days' => $windowDays,
            'row_cap' => self::ROW_CAP,
            'unresulted' => $this->fetchUnresulted($facilityId, $since),
            'abnormal_no_followup' => $this->fetchAbnormalNoFollowUp($facilityId, $since),
            'generated_at' => date('c'),
        ];
    }

    /**
     * Orders in the window with no report at all (never resulted).
     *
     * @return array<int, array<string, mixed>>
     */
    private function fetchUnresulted(int $facilityId, string $since): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT po.procedure_order_id, po.date_ordered, po.order_priority, po.patient_id AS pid,
                    pd.fname, pd.lname, pd.pubpid,
                    (SELECT GROUP_CONCAT(pc.procedure_name SEPARATOR ', ')
                     FROM procedure_order_code pc
                     WHERE pc.procedure_order_id = po.procedure_order_id) AS tests,
                    DATEDIFF(CURDATE(), DATE(po.date_ordered)) AS age_days
             FROM procedure_order po
             INNER JOIN form_encounter fe ON fe.encounter = po.encounter_id AND fe.pid = po.patient_id
             INNER JOIN patient_data pd ON pd.pid = po.patient_id
             WHERE fe.facility_id = ?
             AND po.activity = 1
             AND po.date_ordered >= ?
             AND NOT EXISTS (
                 SELECT 1 FROM procedure_report pr WHERE pr.procedure_order_id = po.procedure_order_id
             )
             ORDER BY po.date_ordered ASC
             LIMIT " . self::ROW_CAP,
            [$facilityId, $since]
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapRow($row, [
            'order_id' => (int) ($row['procedure_order_id'] ?? 0),
            'date' => substr((string) ($row['date_ordered'] ?? ''), 0, 10),
            'priority' => (string) ($row['order_priority'] ?? ''),
            'detail' => (string) ($row['tests'] ?? ''),
        ]), $rows);
    }

    /**
     * Abnormal results in the window with no later visit for that patient.
     *
     * @return array<int, array<string, mixed>>
     */
    private function fetchAbnormalNoFollowUp(int $facilityId, string $since): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT po.procedure_order_id, po.patient_id AS pid, pr.date_report,
                    pd.fname, pd.lname, pd.pubpid,
                    GROUP_CONCAT(DISTINCT res.result_text SEPARATOR ', ') AS tests,
                    DATEDIFF(CURDATE(), DATE(pr.date_report)) AS age_days
             FROM procedure_result res
             INNER JOIN procedure_report pr ON pr.procedure_report_id = res.procedure_report_id
             INNER JOIN procedure_order po ON po.procedure_order_id = pr.procedure_order_id
             INNER JOIN form_encounter fe ON fe.encounter = po.encounter_id AND fe.pid = po.patient_id
             INNER JOIN patient_data pd ON pd.pid = po.patient_id
             WHERE fe.facility_id = ?
             AND pr.date_report >= ?
             AND res.abnormal NOT IN ('', 'no')
             AND NOT EXISTS (
                 SELECT 1 FROM new_visit nv
                 WHERE nv.pid = po.patient_id
                 AND nv.facility_id = ?
                 AND nv.visit_date > DATE(pr.date_report)
                 AND nv.state NOT IN ('cancelled')
             )
             GROUP BY po.procedure_order_id, po.patient_id, pr.date_report, pd.fname, pd.lname, pd.pubpid
             ORDER BY pr.date_report ASC
             LIMIT " . self::ROW_CAP,
            [$facilityId, $since, $facilityId]
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapRow($row, [
            'order_id' => (int) ($row['procedure_order_id'] ?? 0),
            'date' => substr((string) ($row['date_report'] ?? ''), 0, 10),
            'priority' => '',
            'detail' => (string) ($row['tests'] ?? ''),
        ]), $rows);
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, mixed> $extra
     * @return array<string, mixed>
     */
    private function mapRow(array $row, array $extra): array
    {
        $name = trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));
        $pid = (int) ($row['pid'] ?? 0);
        $webroot = $GLOBALS['webroot'] ?? '';

        return $extra + [
            'pid' => $pid,
            'patient_name' => $name,
            'pubpid' => (string) ($row['pubpid'] ?? ''),
            'age_days' => (int) ($row['age_days'] ?? 0),
            'age_bucket' => self::bucketLabel((int) ($row['age_days'] ?? 0)),
            'chart_url' => $webroot
                . '/interface/modules/custom_modules/oe-module-new-clinic/public/patient-chart.php?pid='
                . urlencode((string) $pid) . '&tab=clinical&anchor=clinical-labs',
        ];
    }

    public static function bucketLabel(int $ageDays): string
    {
        if ($ageDays <= 2) {
            return '0_2';
        }
        if ($ageDays <= 7) {
            return '3_7';
        }

        return '8_plus';
    }
}

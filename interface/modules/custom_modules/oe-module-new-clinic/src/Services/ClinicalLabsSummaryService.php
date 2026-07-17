<?php

/**
 * MRD Clinical labs strip (MRD §8.10.3 / M12 entry)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class ClinicalLabsSummaryService
{
    /** @var array<int, string> */
    private const TERMINAL_STATUSES = ['complete', 'completed', 'canceled', 'cancelled'];

    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly LabService $labService = new LabService(),
        private readonly ProcedureOrderDeepLinkService $procedureOrderLinks = new ProcedureOrderDeepLinkService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getClinicalStrip(int $pid, ?int $encounterId = null): array
    {
        $this->facilityScope->assertPatientAccessible($pid);

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $webroot = $GLOBALS['webroot'] ?? '';
        $encounterId = $this->resolveEncounterId($pid, $encounterId);

        if (!$this->isLabsStripEnabled($facilityId)) {
            return $this->hiddenStripPayload($webroot, $pid);
        }

        $orders = $encounterId > 0
            ? $this->labService->getLabOrdersForEncounter($pid, $encounterId)
            : [];
        $pendingCount = $this->countPendingOrders($orders);
        $lastResult = $this->resolveLastLabResult($pid);
        $hasTrends = $this->patientHasLabHistory($pid);
        $stripLabel = $this->buildStripLabel($pendingCount, $orders, $lastResult);
        $hidden = $pendingCount === 0
            && $lastResult === null
            && $orders === []
            && !$hasTrends;

        $canOpenLabOps = AclMain::aclCheckCore('new_clinic', 'new_lab')
            || AclMain::aclCheckCore('new_clinic', 'new_lab_lead')
            || AclMain::aclCheckCore('new_clinic', 'new_admin');

        $labOpsUrl = $webroot
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/lab-ops/index.php';

        $placeOrderUrl = null;
        if ($encounterId > 0) {
            try {
                $placeOrderUrl = $this->procedureOrderLinks->buildNewOrderUrlPreferNative(
                    $pid,
                    $encounterId,
                    'chart',
                    $this->procedureOrderLinks->buildPatientChartReturnUrl($pid),
                    $facilityId
                );
            } catch (\InvalidArgumentException) {
                $placeOrderUrl = null;
            }
        }

        return [
            'hidden' => $hidden,
            'encounter_id' => $encounterId > 0 ? $encounterId : null,
            'pending_count' => $pendingCount,
            'pending_warning' => $pendingCount > 0,
            'last_result' => $lastResult,
            'has_trends' => $hasTrends,
            'labs_strip_label' => $stripLabel,
            'can_open_lab_ops' => $canOpenLabOps,
            'lab_ops_url' => $canOpenLabOps ? $labOpsUrl : null,
            'view_trends_anchor' => 'clinical-labs',
            'place_order_url' => $placeOrderUrl,
            'pending_orders_url' => $this->procedureOrderLinks->buildPendingOrdersUrl($pid),
            'stock_orders_url' => $placeOrderUrl ?? $this->procedureOrderLinks->buildPendingOrdersUrl($pid),
        ];
    }

    private function isLabsStripEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_lab_role', 0, $facilityId) === 1
            && $this->config->getInt('enable_lab_ops', 0, $facilityId) === 1;
    }

    /**
     * @param array<int, array<string, mixed>> $orders
     */
    private function countPendingOrders(array $orders): int
    {
        $count = 0;
        foreach ($orders as $order) {
            $status = strtolower((string) ($order['status'] ?? 'pending'));
            if (!in_array($status, self::TERMINAL_STATUSES, true)) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveLastLabResult(int $pid): ?array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT pres.result, pres.result_text, pres.units, pres.date,
                    poc.procedure_name, poc.procedure_code, pr.date_report, pr.date_collected
             FROM procedure_result pres
             INNER JOIN procedure_report pr ON pr.procedure_report_id = pres.procedure_report_id
             INNER JOIN procedure_order po ON po.procedure_order_id = pr.procedure_order_id
             LEFT JOIN procedure_order_code poc
                ON poc.procedure_order_id = po.procedure_order_id
                AND poc.procedure_order_seq = pr.procedure_order_seq
             WHERE po.patient_id = ? AND po.activity = 1
               AND pres.result IS NOT NULL AND pres.result != ''
               AND pres.result NOT IN ('DNR', 'TNP')
             ORDER BY COALESCE(pr.date_report, pres.date, pr.date_collected) DESC,
                      pres.procedure_result_id DESC
             LIMIT 1",
            [$pid]
        );

        if (!is_array($row)) {
            return null;
        }

        $label = trim((string) ($row['procedure_name'] ?? ''));
        if ($label === '' && !empty($row['procedure_code'])) {
            $label = (string) $row['procedure_code'];
        }
        if ($label === '' && !empty($row['result_text'])) {
            $label = (string) $row['result_text'];
        }
        if ($label === '') {
            $label = 'Lab result';
        }

        $value = trim((string) ($row['result'] ?? ''));
        $units = trim((string) ($row['units'] ?? ''));
        if ($value !== '' && $units !== '') {
            $value .= ' ' . $units;
        }

        $at = $this->formatDate(
            (string) ($row['date_report'] ?? $row['date'] ?? $row['date_collected'] ?? '')
        );

        return [
            'label' => $label,
            'value' => $value !== '' ? $value : null,
            'at' => $at,
        ];
    }

    private function patientHasLabHistory(int $pid): bool
    {
        $orderRow = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS cnt FROM procedure_order WHERE patient_id = ? AND activity = 1',
            [$pid]
        );
        $orderCount = is_array($orderRow) ? (int) ($orderRow['cnt'] ?? 0) : 0;
        if ($orderCount > 1) {
            return true;
        }

        $resultRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM procedure_result pres
             INNER JOIN procedure_report pr ON pr.procedure_report_id = pres.procedure_report_id
             INNER JOIN procedure_order po ON po.procedure_order_id = pr.procedure_order_id
             WHERE po.patient_id = ? AND po.activity = 1",
            [$pid]
        );

        return is_array($resultRow) && (int) ($resultRow['cnt'] ?? 0) > 0;
    }

    /**
     * @param array<int, array<string, mixed>> $orders
     * @param array<string, mixed>|null $lastResult
     */
    private function buildStripLabel(int $pendingCount, array $orders, ?array $lastResult): string
    {
        if ($pendingCount > 0) {
            $suffix = $pendingCount === 1 ? 'test pending' : 'tests pending';

            return $pendingCount . ' ' . $suffix . " on today's visit";
        }

        if ($lastResult !== null) {
            $line = 'Last: ' . ($lastResult['label'] ?? 'Lab result');
            if (!empty($lastResult['value'])) {
                $line .= ' ' . $lastResult['value'];
            }
            if (!empty($lastResult['at'])) {
                $line .= ' (' . $lastResult['at'] . ')';
            }

            return $line;
        }

        if ($orders !== []) {
            return 'Tests ordered · awaiting results';
        }

        return 'No labs on file for this visit';
    }

    private function resolveEncounterId(int $pid, ?int $encounterId): int
    {
        return $this->visitScope->resolveActiveEncounterId($pid, $encounterId);
    }

    /**
     * @return array<string, mixed>
     */
    private function hiddenStripPayload(string $webroot, int $pid): array
    {
        return [
            'hidden' => true,
            'encounter_id' => null,
            'pending_count' => 0,
            'pending_warning' => false,
            'last_result' => null,
            'has_trends' => false,
            'labs_strip_label' => null,
            'can_open_lab_ops' => false,
            'lab_ops_url' => null,
            'view_trends_anchor' => 'clinical-labs',
            'place_order_url' => null,
            'pending_orders_url' => $this->procedureOrderLinks->buildPendingOrdersUrl($pid),
            'stock_orders_url' => $this->procedureOrderLinks->buildPendingOrdersUrl($pid),
        ];
    }

    private function formatDate(string $date): ?string
    {
        if ($date === '' || str_starts_with($date, '0000-00-00')) {
            return null;
        }

        try {
            return (new \DateTime($date))->format('j M Y');
        } catch (\Exception) {
            return null;
        }
    }
}

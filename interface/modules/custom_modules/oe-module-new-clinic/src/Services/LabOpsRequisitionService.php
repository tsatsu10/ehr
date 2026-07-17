<?php

/**
 * M12-F05 — send-out lab requisition print payload
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class LabOpsRequisitionService
{
    public function __construct(
        private readonly LabOpsAccessService $access = new LabOpsAccessService(),
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly MoneyFormatService $moneyFormat = new MoneyFormatService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function buildRequisition(int $procedureOrderId): array
    {
        $this->access->assertHubAccess();

        if ($procedureOrderId <= 0) {
            throw new \InvalidArgumentException('Procedure order id is required');
        }

        $order = QueryUtils::querySingleRow(
            "SELECT po.procedure_order_id, po.patient_id, po.encounter_id, po.date_ordered,
                    pd.fname, pd.lname, pd.pubpid, pd.DOB, pd.sex,
                    pp.name AS lab_name,
                    meta.fulfillment, meta.accession_no, meta.collected_at
             FROM procedure_order po
             INNER JOIN patient_data pd ON pd.pid = po.patient_id
             LEFT JOIN procedure_providers pp ON pp.ppid = po.lab_id
             LEFT JOIN new_lab_order_meta meta ON meta.procedure_order_id = po.procedure_order_id
             WHERE po.procedure_order_id = ? AND po.activity = 1",
            [$procedureOrderId]
        );

        if (!is_array($order) || empty($order['procedure_order_id'])) {
            throw new \RuntimeException('Lab order not found', 404);
        }

        $pid = (int) ($order['patient_id'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);

        $lines = QueryUtils::fetchRecords(
            'SELECT poc.procedure_order_title, poc.procedure_code, poc.procedure_order_seq,
                    s.specimen_type AS line_specimen
             FROM procedure_order_code poc
             LEFT JOIN new_lab_order_line_specimen s
                ON s.procedure_order_id = poc.procedure_order_id
                AND s.procedure_order_seq = poc.procedure_order_seq
             WHERE poc.procedure_order_id = ?
             ORDER BY poc.procedure_order_seq ASC',
            [$procedureOrderId]
        ) ?: [];
        $specimenTitles = $this->specimenTitleMap();

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $facility = $facilityId > 0
            ? (QueryUtils::querySingleRow('SELECT name, phone, street, city, state, postal_code FROM facility WHERE id = ?', [$facilityId]) ?: [])
            : [];

        $tests = [];
        $total = 0.0;
        foreach ($lines as $line) {
            $code = (string) ($line['procedure_code'] ?? '');
            $fee = $this->lookupFeeForCode($code, $facilityId);
            $amount = (float) ($fee['price_amount'] ?? 0);
            $total += $amount;
            $specimenId = (string) ($line['line_specimen'] ?? '');
            $tests[] = [
                'title' => (string) ($line['procedure_order_title'] ?? ''),
                'code' => $code,
                'specimen' => $specimenId !== '' ? ($specimenTitles[$specimenId] ?? $specimenId) : '',
                'price_display' => $fee['price_display'] ?? null,
                'price_amount' => $amount > 0 ? $amount : null,
            ];
        }

        global $GLOBALS;
        $clinicName = (string) ($facility['name'] ?? $GLOBALS['openemr_name'] ?? 'Clinic');

        return [
            'procedure_order_id' => $procedureOrderId,
            'clinic' => [
                'name' => $clinicName,
                'phone' => (string) ($facility['phone'] ?? ''),
                'address' => trim(implode(', ', array_filter([
                    (string) ($facility['street'] ?? ''),
                    (string) ($facility['city'] ?? ''),
                    (string) ($facility['state'] ?? ''),
                    (string) ($facility['postal_code'] ?? ''),
                ]))),
            ],
            'patient' => [
                'name' => trim(($order['fname'] ?? '') . ' ' . ($order['lname'] ?? '')),
                'pubpid' => (string) ($order['pubpid'] ?? ''),
                'dob' => (string) ($order['DOB'] ?? ''),
                'sex' => (string) ($order['sex'] ?? ''),
            ],
            'order' => [
                'date_ordered' => (string) ($order['date_ordered'] ?? ''),
                'lab_name' => (string) ($order['lab_name'] ?? 'External lab'),
                'fulfillment' => (string) ($order['fulfillment'] ?? 'send_out'),
                'accession_no' => (string) ($order['accession_no'] ?? '') ?: null,
            ],
            'tests' => $tests,
            'total_display' => $this->formatMoney($total, $facilityId),
            'currency_code' => (string) $this->config->get('currency_code', 'GHS', $facilityId),
        ];
    }

    /**
     * option_id => human title for the Specimen_Type list, so the requisition
     * prints "Blood specimen" rather than the stored SNOMED option id.
     *
     * @return array<string, string>
     */
    private function specimenTitleMap(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT option_id, title FROM list_options
             WHERE list_id = 'Specimen_Type' AND activity = 1",
            []
        ) ?: [];

        $map = [];
        foreach ($rows as $row) {
            $map[(string) ($row['option_id'] ?? '')] = (string) ($row['title'] ?? '');
        }

        return $map;
    }

    /**
     * @return array<string, mixed>
     */
    private function lookupFeeForCode(string $code, int $facilityId): array
    {
        if ($code === '') {
            return [];
        }

        $row = QueryUtils::querySingleRow(
            "SELECT price_amount, name FROM new_fee_schedule
             WHERE facility_id IN (0, ?) AND code = ? AND is_active = 1
             ORDER BY facility_id DESC LIMIT 1",
            [$facilityId, $code]
        );

        if (!is_array($row)) {
            return [];
        }

        $amount = (float) ($row['price_amount'] ?? 0);

        return [
            'price_amount' => $amount,
            'price_display' => $amount > 0 ? $this->formatMoney($amount, $facilityId) : null,
            'name' => (string) ($row['name'] ?? ''),
        ];
    }

    private function formatMoney(float $amount, int $facilityId): string
    {
        return $this->moneyFormat->formatMoney($amount, $facilityId);
    }
}

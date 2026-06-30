<?php

/**
 * O-PHARM-5 — controlled substances register (dispense + destruction log placeholder)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PharmOpsControlledRegisterService
{
    public function __construct(
        private readonly PharmOpsAccessService $access = new PharmOpsAccessService(),
    ) {
    }

    /**
     * @return array{from_date: string, to_date: string, rows: list<array<string, mixed>>, controlled_drug_count: int}
     */
    public function fetchRegister(string $fromDate, string $toDate): array
    {
        $this->access->assertHubAccess();

        $fromDate = $this->normalizeDate($fromDate, date('Y-m-01'));
        $toDate = $this->normalizeDate($toDate, date('Y-m-d'));

        if ($fromDate > $toDate) {
            throw new \InvalidArgumentException('From date must be on or before to date');
        }

        $controlledCount = (int) (sqlQuery(
            "SELECT COUNT(*) AS cnt FROM new_drug_meta WHERE is_controlled = 1"
        )['cnt'] ?? 0);

        $rows = QueryUtils::fetchRecords(
            "SELECT event_date, event_type, drug_name, quantity, lot_number, schedule_code,
                    patient_label, mrn, witness, destroy_method, destroy_notes, actor_name
             FROM (
                SELECT ds.sale_date AS event_date,
                       'dispensed' AS event_type,
                       d.name AS drug_name,
                       ds.quantity AS quantity,
                       ds.lot_number AS lot_number,
                       dm.controlled_schedule_code AS schedule_code,
                       CONCAT(pd.fname, ' ', pd.lname) AS patient_label,
                       pd.pubpid AS mrn,
                       NULL AS witness,
                       NULL AS destroy_method,
                       NULL AS destroy_notes,
                       CONCAT(u.fname, ' ', u.lname) AS actor_name
                FROM drug_sales ds
                INNER JOIN drugs d ON d.drug_id = ds.drug_id
                INNER JOIN new_drug_meta dm ON dm.drug_id = ds.drug_id AND dm.is_controlled = 1
                LEFT JOIN patient_data pd ON pd.pid = ds.pid
                LEFT JOIN users u ON u.username = ds.user
                WHERE ds.trans_type = 'sale'
                  AND ds.sale_date >= ?
                  AND ds.sale_date <= ?

                UNION ALL

                SELECT di.destroy_date AS event_date,
                       'destroyed' AS event_type,
                       d.name AS drug_name,
                       di.on_hand AS quantity,
                       di.lot_number AS lot_number,
                       dm.controlled_schedule_code AS schedule_code,
                       NULL AS patient_label,
                       NULL AS mrn,
                       di.destroy_witness AS witness,
                       di.destroy_method AS destroy_method,
                       di.destroy_notes AS destroy_notes,
                       NULL AS actor_name
                FROM drug_inventory di
                INNER JOIN drugs d ON d.drug_id = di.drug_id
                INNER JOIN new_drug_meta dm ON dm.drug_id = di.drug_id AND dm.is_controlled = 1
                WHERE di.destroy_date IS NOT NULL
                  AND di.destroy_date != ''
                  AND di.destroy_date NOT LIKE '0000-%'
                  AND di.destroy_date >= ?
                  AND di.destroy_date <= ?
             ) register_rows
             ORDER BY event_date DESC, drug_name ASC",
            [$fromDate, $toDate, $fromDate, $toDate]
        ) ?: [];

        return [
            'from_date' => $fromDate,
            'to_date' => $toDate,
            'controlled_drug_count' => $controlledCount,
            'rows' => array_map([$this, 'mapRow'], $rows),
        ];
    }

    /**
     * @param array<string, mixed> $raw
     * @return array<string, mixed>
     */
    private function mapRow(array $raw): array
    {
        $eventType = (string) ($raw['event_type'] ?? '');
        $patientLabel = trim((string) ($raw['patient_label'] ?? ''));

        return [
            'event_date' => (string) ($raw['event_date'] ?? ''),
            'event_type' => $eventType,
            'event_label' => $eventType === 'destroyed' ? 'Destroyed' : 'Dispensed',
            'drug_name' => trim((string) ($raw['drug_name'] ?? '')),
            'quantity' => (float) ($raw['quantity'] ?? 0),
            'lot_number' => trim((string) ($raw['lot_number'] ?? '')),
            'schedule_code' => trim((string) ($raw['schedule_code'] ?? '')) ?: null,
            'patient_label' => $patientLabel !== '' ? $patientLabel : null,
            'mrn' => trim((string) ($raw['mrn'] ?? '')) ?: null,
            'witness' => trim((string) ($raw['witness'] ?? '')) ?: null,
            'destroy_method' => trim((string) ($raw['destroy_method'] ?? '')) ?: null,
            'destroy_notes' => trim((string) ($raw['destroy_notes'] ?? '')) ?: null,
            'actor_name' => trim((string) ($raw['actor_name'] ?? '')) ?: null,
        ];
    }

    private function normalizeDate(string $value, string $fallback): string
    {
        $value = trim($value);
        if ($value !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return $value;
        }

        return $fallback;
    }
}

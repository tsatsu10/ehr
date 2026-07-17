<?php

/**
 * Native patient-wide Prescription History (closes "Open Rx list (core)" gap).
 *
 * Replaces the stock `controller.php?prescription&list` screen. View + print
 * only (no discontinue/edit here — editing stays limited to the one
 * prescription still tied to a visit currently `in_pharmacy`, via the
 * existing native rx-edit.php). Flag-gated by `enable_native_rx_history`
 * (default OFF) via {@see PrescriptionHistoryPolicy}.
 *
 * Per the PRD's own bind classification for this link (`NEW_CLINIC_V1_PRD.md`,
 * "Open Rx list (pid-scoped) | NONE"), this read is deliberately patient-scoped
 * only — it must NOT require an active pharmacy visit the way rx-edit.php does.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class PrescriptionHistoryService
{
    public const PAGE_SIZE_DEFAULT = 25;
    public const PAGE_SIZE_MAX = 100;

    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
    ) {
    }

    private function assertAccess(): void
    {
        if (
            !AclMain::aclCheckCore('new_clinic', 'new_pharmacy')
            && !AclMain::aclCheckCore('new_clinic', 'new_pharmacy_lead')
            && !AclMain::aclCheckCore('new_clinic', 'new_admin')
        ) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function getHistory(
        int $pid,
        int $page = 1,
        int $pageSize = self::PAGE_SIZE_DEFAULT,
        string $search = '',
        string $status = 'all',
    ): array {
        $this->assertAccess();

        if ($pid <= 0) {
            throw new \InvalidArgumentException('pid is required');
        }
        $this->facilityScope->assertPatientAccessible($pid);

        $page = max(1, $page);
        $pageSize = min(self::PAGE_SIZE_MAX, max(1, $pageSize));
        $offset = ($page - 1) * $pageSize;

        [$whereSql, $bind] = $this->buildFilter($pid, $search, $status);

        $totalRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS c FROM prescriptions rx WHERE {$whereSql}",
            $bind
        );
        $total = is_array($totalRow) ? (int) ($totalRow['c'] ?? 0) : 0;

        $rows = QueryUtils::fetchRecords(
            "SELECT rx.id, rx.drug, rx.dosage, rx.quantity, rx.route, rx.`interval`, rx.refills,
                    rx.start_date, rx.end_date, rx.filled_date, rx.active, rx.note,
                    rx.provider_id, rx.encounter, rx.date_added,
                    u.fname AS prov_fname, u.lname AS prov_lname,
                    nv.id AS visit_id, nv.state AS visit_state
             FROM prescriptions rx
             LEFT JOIN users u ON u.id = rx.provider_id
             LEFT JOIN new_visit nv ON nv.encounter = rx.encounter AND nv.pid = rx.patient_id
             WHERE {$whereSql}
             ORDER BY rx.date_added DESC, rx.id DESC
             LIMIT {$pageSize} OFFSET {$offset}",
            $bind
        ) ?: [];

        return [
            'rows' => array_map([$this, 'mapRow'], $rows),
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
            'patient_name' => $this->resolvePatientName($pid),
        ];
    }

    /**
     * @return array{0: string, 1: array<int, mixed>}
     */
    private function buildFilter(int $pid, string $search, string $status): array
    {
        $clauses = ['rx.patient_id = ?'];
        $bind = [$pid];

        $search = trim($search);
        if ($search !== '') {
            $clauses[] = 'rx.drug LIKE ?';
            $bind[] = '%' . $search . '%';
        }

        if ($status === 'active') {
            $clauses[] = 'rx.active = 1';
        } elseif ($status === 'discontinued') {
            $clauses[] = 'rx.active = 0';
        }
        // status === 'all' (or anything else) -> no extra clause, deliberately
        // includes both -- unlike getPrescriptionsForEncounter()'s hard active=1
        // filter, history must surface discontinued prescriptions too.

        return [implode(' AND ', $clauses), $bind];
    }

    /**
     * Pure status derivation (Active/Discontinued x Dispensed/Pending) --
     * kept as a standalone static method so it's directly unit-testable
     * without a DB.
     *
     * @param array<string, mixed> $row
     */
    public static function deriveStatus(array $row): string
    {
        $active = (int) ($row['active'] ?? 0) === 1;
        $filled = !empty($row['filled_date']) && $row['filled_date'] !== '0000-00-00';

        if (!$active) {
            // Discontinuation is definitive regardless of whether it was
            // filled beforehand.
            return 'discontinued';
        }

        return $filled ? 'dispensed' : 'pending';
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        $providerName = trim(($row['prov_fname'] ?? '') . ' ' . ($row['prov_lname'] ?? ''));
        $editable = ($row['visit_state'] ?? null) === 'in_pharmacy';

        return [
            'id' => (int) ($row['id'] ?? 0),
            'drug' => (string) ($row['drug'] ?? 'Medication'),
            'sig' => self::formatSig($row),
            'quantity' => (string) ($row['quantity'] ?? ''),
            'refills' => (int) ($row['refills'] ?? 0),
            'status' => self::deriveStatus($row),
            'start_date' => self::cleanDate($row['start_date'] ?? null),
            'end_date' => self::cleanDate($row['end_date'] ?? null),
            'date_added' => self::cleanDate($row['date_added'] ?? null),
            'provider_name' => $providerName !== '' ? $providerName : null,
            'encounter' => (int) ($row['encounter'] ?? 0),
            'editable' => $editable,
            'visit_id' => $editable ? (int) ($row['visit_id'] ?? 0) : null,
        ];
    }

    /**
     * @param array<string, mixed> $row
     */
    public static function formatSig(array $row): string
    {
        $parts = array_filter([
            trim((string) ($row['dosage'] ?? '')),
            trim((string) ($row['route'] ?? '')),
            is_numeric($row['interval'] ?? null) && (int) $row['interval'] > 0 ? 'q' . (int) $row['interval'] : '',
        ]);

        return implode(' ', $parts);
    }

    private static function cleanDate(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));
        if ($text === '' || str_starts_with($text, '0000-00-00')) {
            return null;
        }

        return $text;
    }

    private function resolvePatientName(int $pid): string
    {
        $row = QueryUtils::querySingleRow('SELECT fname, lname FROM patient_data WHERE pid = ?', [$pid]);
        if (!is_array($row)) {
            return '';
        }

        return trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? ''));
    }
}

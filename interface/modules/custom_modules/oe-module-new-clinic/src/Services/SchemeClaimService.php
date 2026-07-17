<?php

/**
 * CBILL-3 — insurance scheme claim register (manual). Owns the new_scheme_claim(+_line)
 * tables: scheme list, split math, claim create/list/status. The patient-pay collection
 * itself runs through CashierService (which owns the payment plumbing).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class SchemeClaimService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function isEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_insurance_scheme', 0, $facilityId) === 1;
    }

    /**
     * Active payers for the scheme picker (reuses core insurance_companies).
     *
     * @return array<int, array<string, mixed>>
     */
    public function getSchemes(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT id, name FROM insurance_companies
             WHERE inactive = 0 AND name IS NOT NULL AND name <> ''
             ORDER BY name ASC",
            []
        ) ?: [];

        return array_map(
            static fn (array $r): array => ['id' => (int) $r['id'], 'name' => (string) ($r['name'] ?? '')],
            $rows
        );
    }

    /**
     * @param array<int, array<string, mixed>> $lines each: source, source_id, description, amount, covered
     * @return array{patient_pay: float, scheme_owed: float}
     */
    public function splitTotals(array $lines): array
    {
        $patientPay = 0.0;
        $schemeOwed = 0.0;
        foreach ($lines as $line) {
            $amount = round((float) ($line['amount'] ?? 0), 2);
            if (!empty($line['covered'])) {
                $schemeOwed += $amount;
            } else {
                $patientPay += $amount;
            }
        }

        return ['patient_pay' => round($patientPay, 2), 'scheme_owed' => round($schemeOwed, 2)];
    }

    /**
     * Insert the claim + its coverage lines. Caller runs inside a transaction.
     *
     * @param array<string, mixed> $visit
     * @param array<int, array<string, mixed>> $lines
     */
    public function createClaim(array $visit, int $schemeId, string $membership, array $lines, int $actorUserId): int
    {
        $totals = $this->splitTotals($lines);
        $claimId = (int) QueryUtils::sqlInsert(
            "INSERT INTO new_scheme_claim
             (facility_id, visit_id, pid, encounter, insurance_company_id, scheme_name, membership_number, scheme_owed, patient_pay, status, actor_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'to_submit', ?)",
            [
                (int) ($visit['facility_id'] ?? 0),
                (int) ($visit['id'] ?? 0),
                (int) ($visit['pid'] ?? 0),
                (int) ($visit['encounter'] ?? 0),
                $schemeId,
                mb_substr($this->schemeName($schemeId), 0, 255),
                mb_substr(trim($membership), 0, 64),
                $totals['scheme_owed'],
                $totals['patient_pay'],
                $actorUserId,
            ]
        );

        foreach ($lines as $line) {
            QueryUtils::sqlInsert(
                "INSERT INTO new_scheme_claim_line (claim_id, source, source_id, description, amount, covered)
                 VALUES (?, ?, ?, ?, ?, ?)",
                [
                    $claimId,
                    ($line['source'] ?? 'billing') === 'drug' ? 'drug' : 'billing',
                    (int) ($line['source_id'] ?? 0),
                    mb_substr((string) ($line['description'] ?? ''), 0, 255),
                    round((float) ($line['amount'] ?? 0), 2),
                    !empty($line['covered']) ? 1 : 0,
                ]
            );
        }

        return $claimId;
    }

    public function schemeLabel(int $schemeId): string
    {
        return $this->schemeName($schemeId);
    }

    private function schemeName(int $schemeId): string
    {
        if ($schemeId <= 0) {
            return '';
        }
        $row = QueryUtils::querySingleRow("SELECT name FROM insurance_companies WHERE id = ?", [$schemeId]);

        return is_array($row) ? (string) ($row['name'] ?? '') : '';
    }

    /** @var array<int, string> */
    private const STATUSES = ['to_submit', 'submitted', 'settled', 'void', 'rejected'];

    /**
     * "Scheme claims to submit" list.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listClaims(
        int $facilityId,
        ?string $status = 'to_submit',
        int $limit = 50,
        int $offset = 0,
        int $insuranceCompanyId = 0,
        ?string $ageBucket = null,
    ): array {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $status = in_array($status, self::STATUSES, true) ? $status : 'to_submit';
        $limit = min(max($limit, 1), 200);
        $offset = max($offset, 0);
        $ageBucket = self::normalizeAgeBucket($ageBucket);

        $where = ' WHERE c.facility_id = ? AND c.status = ?';
        $bind = [$facilityId, $status];
        if ($insuranceCompanyId > 0) {
            $where .= ' AND c.insurance_company_id = ?';
            $bind[] = $insuranceCompanyId;
        }
        if ($ageBucket === '0_7') {
            $where .= ' AND DATEDIFF(CURDATE(), c.created_at) <= 7';
        } elseif ($ageBucket === '8_30') {
            $where .= ' AND DATEDIFF(CURDATE(), c.created_at) BETWEEN 8 AND 30';
        } elseif ($ageBucket === '31_plus') {
            $where .= ' AND DATEDIFF(CURDATE(), c.created_at) >= 31';
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT c.id, c.visit_id, c.pid, c.encounter, c.insurance_company_id, c.scheme_name,
                    c.membership_number, c.scheme_owed, c.patient_pay, c.status, c.rejection_note,
                    c.created_at, DATEDIFF(CURDATE(), c.created_at) AS age_days,
                    pd.fname, pd.lname, pd.pubpid
             FROM new_scheme_claim c
             INNER JOIN patient_data pd ON pd.pid = c.pid
             {$where}
             ORDER BY c.created_at DESC
             LIMIT " . (int) $limit . " OFFSET " . (int) $offset,
            $bind
        ) ?: [];

        return array_map(static function (array $r): array {
            $ageDays = (int) ($r['age_days'] ?? 0);

            return [
                'id' => (int) $r['id'],
                'visit_id' => (int) $r['visit_id'],
                'display_name' => trim(((string) ($r['fname'] ?? '')) . ' ' . ((string) ($r['lname'] ?? ''))),
                'pubpid' => (string) ($r['pubpid'] ?? ''),
                'insurance_company_id' => (int) ($r['insurance_company_id'] ?? 0),
                'scheme_name' => (string) ($r['scheme_name'] ?? ''),
                'membership_number' => (string) ($r['membership_number'] ?? ''),
                'scheme_owed' => round((float) ($r['scheme_owed'] ?? 0), 2),
                'patient_pay' => round((float) ($r['patient_pay'] ?? 0), 2),
                'status' => (string) ($r['status'] ?? ''),
                'rejection_note' => (string) ($r['rejection_note'] ?? ''),
                'created_at' => (string) ($r['created_at'] ?? ''),
                'age_days' => $ageDays,
                'age_bucket' => self::bucketForAge($ageDays),
            ];
        }, $rows);
    }

    private static function normalizeAgeBucket(?string $bucket): ?string
    {
        return in_array($bucket, ['0_7', '8_30', '31_plus'], true) ? $bucket : null;
    }

    private static function bucketForAge(int $ageDays): string
    {
        if ($ageDays <= 7) {
            return '0_7';
        }
        if ($ageDays <= 30) {
            return '8_30';
        }

        return '31_plus';
    }

    /**
     * CBILL-3c — CSV of the claims in a status (for manual submission to the scheme).
     */
    public function exportCsv(int $facilityId, ?string $status = 'to_submit'): string
    {
        $rows = $this->listClaims($facilityId, $status, 5000, 0);
        $out = fopen('php://temp', 'r+');
        fputcsv($out, ['Patient', 'MRN', 'Scheme', 'Membership', 'Scheme owes', 'Patient paid', 'Status', 'Created']);
        foreach ($rows as $row) {
            fputcsv($out, [
                (string) ($row['display_name'] ?? ''),
                (string) ($row['pubpid'] ?? ''),
                (string) ($row['scheme_name'] ?? ''),
                (string) ($row['membership_number'] ?? ''),
                number_format((float) ($row['scheme_owed'] ?? 0), 2, '.', ''),
                number_format((float) ($row['patient_pay'] ?? 0), 2, '.', ''),
                (string) ($row['status'] ?? ''),
                (string) ($row['created_at'] ?? ''),
            ]);
        }
        rewind($out);
        $csv = (string) stream_get_contents($out);
        fclose($out);

        return $csv;
    }

    /**
     * Manager transition: to_submit → submitted → settled (or void). CBILL-4d also permits
     * submitted → rejected (with a required free-text reason — NHIS/HMO rejections come back
     * with little structured detail in practice) → to_submit (correct and resubmit) or void.
     * Audited.
     *
     * @return array<string, mixed>
     */
    public function setClaimStatus(int $claimId, string $status, int $actorUserId, string $rejectionNote = ''): array
    {
        if (!AclMain::aclCheckCore('new_clinic', 'new_bill_ops_insurance')
            && !AclMain::aclCheckCore('new_clinic', 'new_bill_ops')) {
            throw new \RuntimeException('Forbidden', 403);
        }
        if (!in_array($status, ['to_submit', 'submitted', 'settled', 'void', 'rejected'], true)) {
            throw new \InvalidArgumentException('Invalid claim status');
        }
        $rejectionNote = trim($rejectionNote);
        if ($status === 'rejected' && $rejectionNote === '') {
            throw new \InvalidArgumentException('A reason is required to mark a claim rejected');
        }

        $stampCol = $status === 'submitted' ? 'submitted_at' : ($status === 'settled' ? 'settled_at' : null);
        // Resubmitting (rejected -> to_submit) or resolving (-> settled/void) clears the old
        // note; it only describes the rejection that is being corrected.
        $noteValue = $status === 'rejected' ? mb_substr($rejectionNote, 0, 2000) : null;
        $sql = "UPDATE new_scheme_claim SET status = ?, rejection_note = ?"
            . ($stampCol !== null ? ", `{$stampCol}` = NOW()" : '')
            . " WHERE id = ?";
        QueryUtils::sqlStatementThrowException($sql, [$status, $noteValue, $claimId]);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'scheme_claim.' . $status,
            $actorUserId,
            1,
            'claim_id=' . $claimId
        );

        return ['id' => $claimId, 'status' => $status];
    }
}

<?php

/**
 * CBILL-4c — additional patient payers beyond the primary. Registration
 * already captures one primary payer (new_patient_meta.insurance_type etc,
 * owned by PatientRegistrationService) — this service only ever adds a
 * secondary/tertiary payer on top of that, so existing single-payer data and
 * behaviour are untouched when this feature is off.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PatientPayerService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function isEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_insurance_scheme', 0, $facilityId) === 1
            && $this->config->getInt('enable_payer_billing', 0, $facilityId) === 1;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listForPatient(int $pid): array
    {
        if ($pid <= 0) {
            return [];
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT p.id, p.pid, p.rank, p.payer_type, p.insurance_company_id, p.membership_number,
                    p.expiry_date, ic.name AS scheme_name
             FROM new_patient_payer p
             LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
             WHERE p.pid = ?
             ORDER BY p.rank ASC",
            [$pid]
        ) ?: [];

        return array_map(static function (array $r): array {
            return [
                'id' => (int) $r['id'],
                'pid' => (int) $r['pid'],
                'rank' => (string) $r['rank'],
                'payer_type' => (string) $r['payer_type'],
                'insurance_company_id' => isset($r['insurance_company_id']) ? (int) $r['insurance_company_id'] : null,
                'scheme_name' => (string) ($r['scheme_name'] ?? ''),
                'membership_number' => (string) ($r['membership_number'] ?? ''),
                'expiry_date' => $r['expiry_date'] ?? null,
            ];
        }, $rows);
    }

    /**
     * @return array<string, mixed>
     */
    public function addPayer(
        int $pid,
        string $rank,
        string $payerType,
        ?int $insuranceCompanyId,
        string $membershipNumber,
        ?string $expiryDate,
    ): array {
        if ($pid <= 0) {
            throw new \InvalidArgumentException('A patient is required');
        }
        $rank = in_array($rank, ['secondary', 'tertiary'], true) ? $rank : 'secondary';
        $payerType = $payerType === 'private' ? 'private' : 'nhis';
        if ($payerType === 'private' && ($insuranceCompanyId === null || $insuranceCompanyId <= 0)) {
            throw new \InvalidArgumentException('A private payer needs an insurer');
        }
        $membershipNumber = trim($membershipNumber);
        if ($membershipNumber === '') {
            throw new \InvalidArgumentException('Membership number is required');
        }
        $expiryDate = $expiryDate !== null && trim($expiryDate) !== '' ? trim($expiryDate) : null;

        QueryUtils::sqlStatementThrowException(
            "INSERT INTO new_patient_payer (pid, `rank`, payer_type, insurance_company_id, membership_number, expiry_date)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                payer_type = VALUES(payer_type),
                insurance_company_id = VALUES(insurance_company_id),
                membership_number = VALUES(membership_number),
                expiry_date = VALUES(expiry_date)",
            [
                $pid,
                $rank,
                $payerType,
                $payerType === 'private' ? $insuranceCompanyId : null,
                mb_substr($membershipNumber, 0, 64),
                $expiryDate,
            ]
        );

        $rows = $this->listForPatient($pid);
        foreach ($rows as $row) {
            if ($row['rank'] === $rank) {
                return $row;
            }
        }

        throw new \RuntimeException('Could not save the payer');
    }

    public function removePayer(int $pid, int $id): void
    {
        QueryUtils::sqlStatementThrowException(
            "DELETE FROM new_patient_payer WHERE id = ? AND pid = ?",
            [$id, $pid]
        );
    }
}

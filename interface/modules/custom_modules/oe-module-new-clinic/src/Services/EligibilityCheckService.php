<?php

/**
 * CBILL-4b — manual insurance eligibility check log. Staff perform the check
 * themselves (e.g. Ghana NHIA's *842# USSD code, a phone call to a private
 * scheme, a portal lookup) and log the result here. This service never calls
 * out to any external system — it only records what a human already did.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class EligibilityCheckService
{
    /** @var array<int, string> */
    private const METHODS = ['ussd', 'phone', 'portal', 'card', 'other'];

    /** @var array<int, string> */
    private const RESULTS = ['eligible', 'not_eligible', 'unknown'];

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
     * @return array<string, mixed>
     */
    public function logCheck(
        int $pid,
        ?int $visitId,
        int $insuranceCompanyId,
        string $membershipNumber,
        string $method,
        string $result,
        string $referenceCode,
        string $note,
        int $actorUserId,
    ): array {
        if ($pid <= 0) {
            throw new \InvalidArgumentException('A patient is required');
        }
        $method = in_array($method, self::METHODS, true) ? $method : 'other';
        $result = in_array($result, self::RESULTS, true) ? $result : 'unknown';

        $id = (int) QueryUtils::sqlInsert(
            "INSERT INTO new_insurance_eligibility_check
                (pid, visit_id, insurance_company_id, membership_number, method, result, reference_code, note, actor_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $pid,
                $visitId !== null && $visitId > 0 ? $visitId : null,
                $insuranceCompanyId > 0 ? $insuranceCompanyId : 0,
                mb_substr(trim($membershipNumber), 0, 64),
                $method,
                $result,
                mb_substr(trim($referenceCode), 0, 64),
                mb_substr(trim($note), 0, 255),
                $actorUserId,
            ]
        );

        $row = QueryUtils::querySingleRow(
            "SELECT id, pid, visit_id, insurance_company_id, membership_number, method, result,
                    reference_code, note, checked_at
             FROM new_insurance_eligibility_check WHERE id = ?",
            [$id]
        );

        return $this->mapRow(is_array($row) ? $row : []);
    }

    /**
     * The most recent check per payer on record for this patient — used to render the
     * banner badge at front desk and cashier.
     *
     * @return array<int, array<string, mixed>>
     */
    public function latestForPatient(int $pid): array
    {
        if ($pid <= 0) {
            return [];
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT c.id, c.pid, c.visit_id, c.insurance_company_id, c.membership_number,
                    c.method, c.result, c.reference_code, c.note, c.checked_at
             FROM new_insurance_eligibility_check c
             INNER JOIN (
                 SELECT insurance_company_id, MAX(checked_at) AS max_checked_at
                 FROM new_insurance_eligibility_check
                 WHERE pid = ?
                 GROUP BY insurance_company_id
             ) latest ON latest.insurance_company_id = c.insurance_company_id
                      AND latest.max_checked_at = c.checked_at
             WHERE c.pid = ?
             ORDER BY c.checked_at DESC",
            [$pid, $pid]
        ) ?: [];

        return array_map(fn (array $r): array => $this->mapRow($r), $rows);
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        $schemeId = (int) ($row['insurance_company_id'] ?? 0);

        return [
            'id' => (int) ($row['id'] ?? 0),
            'pid' => (int) ($row['pid'] ?? 0),
            'visit_id' => isset($row['visit_id']) ? (int) $row['visit_id'] : null,
            'insurance_company_id' => $schemeId,
            'scheme_name' => $schemeId > 0 ? $this->schemeName($schemeId) : '',
            'membership_number' => (string) ($row['membership_number'] ?? ''),
            'method' => (string) ($row['method'] ?? 'other'),
            'result' => (string) ($row['result'] ?? 'unknown'),
            'reference_code' => (string) ($row['reference_code'] ?? ''),
            'note' => (string) ($row['note'] ?? ''),
            'checked_at' => (string) ($row['checked_at'] ?? ''),
        ];
    }

    private function schemeName(int $schemeId): string
    {
        $row = QueryUtils::querySingleRow("SELECT name FROM insurance_companies WHERE id = ?", [$schemeId]);

        return is_array($row) ? (string) ($row['name'] ?? '') : '';
    }
}

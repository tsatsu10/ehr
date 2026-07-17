<?php

/**
 * CBILL-4a — per-payer price overrides (e.g. NHIS G-DRG tariff). Owns the
 * new_payer_price table: admin CRUD for a payer's price list, and the one
 * lookup the cashier scheme-split actually calls (resolvePrice), which always
 * returns a usable amount — the override if one exists, otherwise the
 * clinic's normal price. Never a claims/tariff-import engine — a clinic types
 * or edits entries as it learns them.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PayerPriceService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
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
    public function listOverrides(int $facilityId, int $insuranceCompanyId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $rows = QueryUtils::fetchRecords(
            "SELECT id, insurance_company_id, item_code, item_name, price_amount, updated_at
             FROM new_payer_price
             WHERE facility_id = ? AND insurance_company_id = ?
             ORDER BY item_name ASC, item_code ASC",
            [$facilityId, $insuranceCompanyId]
        ) ?: [];

        return array_map(static function (array $r): array {
            return [
                'id' => (int) $r['id'],
                'insurance_company_id' => (int) $r['insurance_company_id'],
                'item_code' => (string) ($r['item_code'] ?? ''),
                'item_name' => (string) ($r['item_name'] ?? ''),
                'price_amount' => round((float) ($r['price_amount'] ?? 0), 2),
                'updated_at' => (string) ($r['updated_at'] ?? ''),
            ];
        }, $rows);
    }

    /**
     * Add or edit a payer's price for one item. Facility + payer + item code together are
     * unique, so a save with a matching triple updates the existing row.
     *
     * @return array<string, mixed>
     */
    public function upsertOverride(
        int $facilityId,
        int $insuranceCompanyId,
        string $itemCode,
        string $itemName,
        float $priceAmount,
        int $actorUserId,
    ): array {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $itemCode = trim($itemCode);
        if ($insuranceCompanyId <= 0) {
            throw new \InvalidArgumentException('A payer is required');
        }
        if ($itemCode === '') {
            throw new \InvalidArgumentException('An item code is required');
        }
        if ($priceAmount < 0) {
            throw new \InvalidArgumentException('Price cannot be negative');
        }

        QueryUtils::sqlStatementThrowException(
            "INSERT INTO new_payer_price
                (facility_id, insurance_company_id, item_code, item_name, price_amount, actor_user_id)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                item_name = VALUES(item_name),
                price_amount = VALUES(price_amount),
                actor_user_id = VALUES(actor_user_id)",
            [
                $facilityId,
                $insuranceCompanyId,
                mb_substr($itemCode, 0, 64),
                mb_substr(trim($itemName), 0, 255),
                round($priceAmount, 2),
                $actorUserId,
            ]
        );

        $row = QueryUtils::querySingleRow(
            "SELECT id, insurance_company_id, item_code, item_name, price_amount, updated_at
             FROM new_payer_price
             WHERE facility_id = ? AND insurance_company_id = ? AND item_code = ?",
            [$facilityId, $insuranceCompanyId, mb_substr($itemCode, 0, 64)]
        );

        if (!is_array($row)) {
            throw new \RuntimeException('Could not save the price override');
        }

        return [
            'id' => (int) $row['id'],
            'insurance_company_id' => (int) $row['insurance_company_id'],
            'item_code' => (string) $row['item_code'],
            'item_name' => (string) $row['item_name'],
            'price_amount' => round((float) $row['price_amount'], 2),
            'updated_at' => (string) $row['updated_at'],
        ];
    }

    public function deleteOverride(int $facilityId, int $id): void
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        QueryUtils::sqlStatementThrowException(
            "DELETE FROM new_payer_price WHERE id = ? AND facility_id = ?",
            [$id, $facilityId]
        );
    }

    /**
     * The one lookup the cashier split actually calls. Always returns a usable line total —
     * the payer's override (unit price × units) when one exists, otherwise the fallback
     * (cash) total unchanged. Never throws on a missing override; that is the normal case.
     */
    public function resolveLineAmount(
        int $facilityId,
        int $insuranceCompanyId,
        string $itemCode,
        int $units,
        float $fallbackTotalAmount,
    ): float {
        if ($insuranceCompanyId <= 0 || trim($itemCode) === '') {
            return $fallbackTotalAmount;
        }

        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $row = QueryUtils::querySingleRow(
            "SELECT price_amount FROM new_payer_price
             WHERE facility_id = ? AND insurance_company_id = ? AND item_code = ?",
            [$facilityId, $insuranceCompanyId, mb_substr(trim($itemCode), 0, 64)]
        );

        if (!is_array($row)) {
            return $fallbackTotalAmount;
        }

        $units = max($units, 1);

        return round((float) ($row['price_amount'] ?? 0) * $units, 2);
    }
}

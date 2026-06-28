<?php

/**
 * Post lab test charges to encounter billing when doctor quick-orders (M12 §16.2)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Billing\BillingUtilities;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class LabOrderChargeService
{
    /** @var array<int, string> OPD starter panel order codes (samples/opd_lab_panel_starter.csv) */
    public const STARTER_PANEL_CODES = [
        'MAL_RDT',
        'HB',
        'UA_DIP',
        'GLU_F',
        'CBC',
        'HCG',
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function isAutoBillEnabled(int $facilityId): bool
    {
        return $this->config->getInt('lab_auto_bill_on_order', 1, $facilityId) === 1;
    }

    /**
     * @param array<int, string> $procedureCodes
     * @return array<int, array<string, mixed>>
     */
    public function resolveFeeLinesForCodes(int $facilityId, array $procedureCodes): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $procedureCodes = array_values(array_unique(array_filter(array_map(
            static fn ($code): string => mb_substr(trim((string) $code), 0, 32),
            $procedureCodes
        ), static fn (string $code): bool => $code !== '')));

        if ($procedureCodes === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($procedureCodes), '?'));
        $bind = array_merge([$facilityId], $procedureCodes);
        $rows = QueryUtils::fetchRecords(
            "SELECT id, code, name, price_amount, code_type, billing_code
             FROM new_fee_schedule
             WHERE facility_id = ? AND is_active = 1 AND code IN ({$placeholders})
             ORDER BY sort_order ASC, name ASC",
            $bind
        ) ?: [];

        return array_map(static function (array $row): array {
            return [
                'fee_schedule_id' => (int) ($row['id'] ?? 0),
                'procedure_code' => (string) ($row['code'] ?? ''),
                'name' => (string) ($row['name'] ?? ''),
                'price_amount' => round((float) ($row['price_amount'] ?? 0), 2),
                'code_type' => (string) ($row['code_type'] ?? ''),
                'billing_code' => (string) ($row['billing_code'] ?? ''),
            ];
        }, $rows);
    }

    /**
     * @param array<int, string> $procedureCodes
     * @return array<string, mixed>
     */
    public function postChargesForProcedureCodes(
        int $pid,
        int $encounter,
        int $providerId,
        int $facilityId,
        array $procedureCodes,
        int $actorUserId
    ): array {
        if (!$this->isAutoBillEnabled($facilityId)) {
            return [
                'posted_count' => 0,
                'skipped_count' => 0,
                'unmapped_codes' => [],
                'charges_total' => 0.0,
                'auto_bill_enabled' => false,
                'currency_symbol' => (string) $this->config->get('currency_symbol', 'GH₵', $facilityId),
            ];
        }

        $feeLines = $this->resolveFeeLinesForCodes($facilityId, $procedureCodes);
        $mappedCodes = array_map(static fn (array $line): string => $line['procedure_code'], $feeLines);
        $requested = array_values(array_unique(array_filter(array_map(
            static fn ($code): string => mb_substr(trim((string) $code), 0, 32),
            $procedureCodes
        ), static fn (string $code): bool => $code !== '')));
        $unmapped = array_values(array_diff($requested, $mappedCodes));

        $posted = 0;
        $skipped = 0;
        $total = 0.0;

        require_once dirname(__DIR__, 6) . '/library/sql.inc.php';
        sqlBeginTrans();
        $committed = false;
        try {
            foreach ($feeLines as $line) {
                if ($this->encounterHasBillingCode($pid, $encounter, (string) $line['billing_code'])) {
                    $skipped++;
                    continue;
                }

                $unitPrice = (float) $line['price_amount'];
                $this->insertBillingLine(
                    $pid,
                    $encounter,
                    $providerId,
                    (string) $line['code_type'],
                    (string) $line['billing_code'],
                    (string) $line['name'],
                    1,
                    $unitPrice
                );
                $posted++;
                $total += $unitPrice;
            }
            sqlCommitTrans(true);
            $committed = true;
        } catch (\Throwable $e) {
            if (!$committed) {
                sqlCommitTrans(false);
            }
            throw $e;
        }

        if ($posted > 0) {
            EventAuditLogger::getInstance()->newEvent(
                'new_clinic',
                'lab_ops.order_charges_posted',
                $actorUserId,
                1,
                'pid=' . $pid
                . ' encounter=' . $encounter
                . ' posted=' . $posted
            );
        }

        return [
            'posted_count' => $posted,
            'skipped_count' => $skipped,
            'unmapped_codes' => $unmapped,
            'charges_total' => round($total, 2),
            'auto_bill_enabled' => true,
            'currency_symbol' => (string) $this->config->get('currency_symbol', 'GH₵', $facilityId),
        ];
    }

    private function encounterHasBillingCode(int $pid, int $encounter, string $billingCode): bool
    {
        if ($billingCode === '') {
            return false;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT id FROM billing
             WHERE pid = ? AND encounter = ? AND code = ? AND activity = 1
             LIMIT 1',
            [$pid, $encounter, $billingCode]
        );

        return is_array($row) && !empty($row['id']);
    }

    private function insertBillingLine(
        int $pid,
        int $encounter,
        int $providerId,
        string $codeType,
        string $billingCode,
        string $description,
        int $units,
        float $unitPrice
    ): void {
        $lineFee = round($unitPrice * $units, 2);
        $codeText = $description !== '' ? $description : $billingCode;

        BillingUtilities::addBilling(
            $encounter,
            $codeType,
            $billingCode,
            $codeText,
            $pid,
            '1',
            $providerId,
            '',
            (string) $units,
            (string) $lineFee,
            '',
            '',
            0,
            '',
            '',
            '',
            ''
        );
    }
}

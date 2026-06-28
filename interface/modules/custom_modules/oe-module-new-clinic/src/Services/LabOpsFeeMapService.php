<?php

/**
 * M12-F06 step 4 — map procedure_type order codes to new_fee_schedule
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class LabOpsFeeMapService
{
    /** @var array<string, array{name: string, price: float}> */
    private const STARTER_DEFAULTS = [
        'MAL_RDT' => ['name' => 'Malaria RDT (Rapid)', 'price' => 15.00],
        'HB' => ['name' => 'Haemoglobin (Hb)', 'price' => 20.00],
        'UA_DIP' => ['name' => 'Urinalysis (dipstick)', 'price' => 15.00],
        'GLU_F' => ['name' => 'Blood glucose (fasting)', 'price' => 15.00],
        'CBC' => ['name' => 'Full blood count (FBC)', 'price' => 45.00],
        'HCG' => ['name' => 'Pregnancy test (urine)', 'price' => 15.00],
    ];

    public function __construct(
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly FeeScheduleAdminService $feeSchedule = new FeeScheduleAdminService(),
    ) {
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listUnmapped(int $facilityId, int $providerId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        if ($providerId <= 0) {
            return [];
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT pt.procedure_type_id, pt.name, pt.procedure_code
             FROM procedure_type pt
             LEFT JOIN new_fee_schedule fs
                ON fs.code = pt.procedure_code AND fs.facility_id = ? AND fs.is_active = 1
             WHERE pt.lab_id = ? AND pt.procedure_type = 'ord' AND pt.activity = 1
               AND fs.id IS NULL
             ORDER BY pt.name ASC",
            [$facilityId, $providerId]
        ) ?: [];

        return array_map(function (array $row): array {
            $code = (string) ($row['procedure_code'] ?? '');
            $defaults = self::STARTER_DEFAULTS[$code] ?? null;

            return [
                'procedure_type_id' => (int) ($row['procedure_type_id'] ?? 0),
                'procedure_code' => $code,
                'name' => (string) ($row['name'] ?? ''),
                'suggested_price' => $defaults['price'] ?? 0.0,
                'suggested_name' => $defaults['name'] ?? (string) ($row['name'] ?? ''),
            ];
        }, $rows);
    }

    public function countUnmapped(int $facilityId, int $providerId): int
    {
        return count($this->listUnmapped($facilityId, $providerId));
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<string, mixed>
     */
    public function saveMappings(int $facilityId, array $rows, int $actorUserId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $saved = 0;
        $errors = [];

        foreach ($rows as $index => $row) {
            if (!is_array($row)) {
                continue;
            }

            $code = mb_substr(trim((string) ($row['procedure_code'] ?? $row['code'] ?? '')), 0, 32);
            if ($code === '') {
                $errors[] = 'Row ' . ($index + 1) . ': code is required';
                continue;
            }

            $name = mb_substr(trim((string) ($row['name'] ?? $code)), 0, 128);
            $price = round((float) ($row['price_amount'] ?? $row['price'] ?? 0), 2);
            if ($price < 0) {
                $errors[] = $code . ': price cannot be negative';
                continue;
            }

            try {
                $codeType = $this->resolveFeeCodeType();
                $this->ensureBillingCode($code, $name, $codeType);
                $this->feeSchedule->save($facilityId, [
                    'code' => $code,
                    'name' => $name,
                    'category' => 'lab',
                    'price_amount' => $price,
                    'code_type' => $codeType,
                    'billing_code' => $code,
                    'sort_order' => 100 + $saved,
                ], $actorUserId);
                $saved++;
            } catch (\Throwable $e) {
                $errors[] = $code . ': ' . $e->getMessage();
            }
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'lab_ops.fee_mapped',
            $actorUserId,
            1,
            'facility_id=' . $facilityId . ' saved=' . $saved
        );

        return [
            'saved' => $saved,
            'errors' => $errors,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function applyStarterDefaults(int $facilityId, int $providerId, int $actorUserId): array
    {
        $unmapped = $this->listUnmapped($facilityId, $providerId);
        $rows = [];
        foreach ($unmapped as $test) {
            $rows[] = [
                'procedure_code' => $test['procedure_code'],
                'name' => $test['suggested_name'],
                'price_amount' => $test['suggested_price'],
            ];
        }

        return $this->saveMappings($facilityId, $rows, $actorUserId);
    }

    private function resolveFeeCodeType(): string
    {
        foreach (['CUSTOM', 'HCPCS', 'CPT4'] as $candidate) {
            $row = QueryUtils::querySingleRow(
                "SELECT ct_key FROM code_types
                 WHERE ct_key = ? AND ct_active = 1 AND ct_fee = 1
                 LIMIT 1",
                [$candidate]
            );
            if (is_array($row) && !empty($row['ct_key'])) {
                return (string) $row['ct_key'];
            }
        }

        throw new \RuntimeException('No billable code type available for lab fee mapping');
    }

    private function ensureBillingCode(string $code, string $description, string $codeType): void
    {
        $existing = QueryUtils::querySingleRow(
            "SELECT c.id
             FROM codes c
             INNER JOIN code_types ct ON ct.ct_id = c.code_type
             WHERE ct.ct_key = ? AND c.code = ? AND c.active = 1",
            [$codeType, $code]
        );

        if (!empty($existing['id'])) {
            return;
        }

        $typeRow = QueryUtils::querySingleRow(
            'SELECT ct_id FROM code_types WHERE ct_key = ? LIMIT 1',
            [$codeType]
        );
        if (empty($typeRow['ct_id'])) {
            throw new \RuntimeException('Code type ' . $codeType . ' is not configured in OpenEMR');
        }

        QueryUtils::sqlInsert(
            'INSERT INTO codes (code_type, code, modifier, active, code_text)
             VALUES (?, ?, "", 1, ?)',
            [(int) $typeRow['ct_id'], $code, mb_substr($description, 0, 255)]
        );
    }
}

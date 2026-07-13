<?php

/**
 * Fee schedule CRUD for Clinic Setup (M6-F01)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Modules\NewClinic\Support\Sanitize;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class FeeScheduleAdminService
{
    /** @var array<string, string> Reporting groups for cashier breakdown (M7-F03). */
    public const CATEGORIES = [
        'consult' => 'Consultation / visit',
        'lab' => 'Laboratory',
        'pharmacy' => 'Pharmacy / dispensing',
        'procedure' => 'Procedure',
        'vaccine' => 'Immunization',
        'supplies' => 'Supplies / consumables',
        'admin' => 'Registration / admin',
        'other' => 'Other',
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * Form metadata: categories, starter templates, billable OpenEMR code types.
     *
     * @return array<string, mixed>
     */
    public function getFormMeta(): array
    {
        $codeTypes = $this->listBillableCodeTypes();

        return [
            'categories' => $this->categoryOptions(),
            'templates' => $this->getTemplates(),
            'billing_code_types' => $codeTypes,
            'default_code_type' => $codeTypes[0]['ct_key'] ?? 'CPT4',
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listBillableCodeTypes(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT ct_key, ct_id, ct_label
             FROM code_types
             WHERE ct_active = 1 AND ct_fee = 1 AND ct_nofs = 0
             ORDER BY ct_seq ASC, ct_key ASC"
        ) ?: [];

        return array_map(static function (array $row): array {
            return [
                'ct_key' => (string) ($row['ct_key'] ?? ''),
                'ct_id' => (int) ($row['ct_id'] ?? 0),
                'label' => (string) ($row['ct_label'] ?? $row['ct_key'] ?? ''),
            ];
        }, $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function searchBillingCodes(string $codeType, string $query = '', int $limit = 30): array
    {
        if (!$this->isBillableCodeType($codeType)) {
            return [];
        }

        $limit = max(1, min($limit, 50));
        $query = Sanitize::searchToken($query);
        $like = '%' . $query . '%';

        if ($query === '') {
            $rows = QueryUtils::fetchRecords(
                "SELECT c.code, c.code_text, c.fee
                 FROM codes c
                 INNER JOIN code_types ct ON ct.ct_id = c.code_type
                 WHERE ct.ct_key = ? AND c.active = 1
                 ORDER BY c.code ASC
                 LIMIT " . $limit,
                [$codeType]
            ) ?: [];
        } else {
            $rows = QueryUtils::fetchRecords(
                "SELECT c.code, c.code_text, c.fee
                 FROM codes c
                 INNER JOIN code_types ct ON ct.ct_id = c.code_type
                 WHERE ct.ct_key = ? AND c.active = 1
                 AND (c.code LIKE ? OR c.code_text LIKE ?)
                 ORDER BY c.code ASC
                 LIMIT " . $limit,
                [$codeType, $like, $like]
            ) ?: [];
        }

        return array_map(static function (array $row): array {
            return [
                'code' => (string) ($row['code'] ?? ''),
                'name' => (string) ($row['code_text'] ?? ''),
                'fee' => round((float) ($row['fee'] ?? 0), 2),
            ];
        }, $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getTemplates(): array
    {
        $defaultType = $this->getDefaultCodeType();

        return [
            [
                'id' => 'opd_consult',
                'label' => 'OPD consultation',
                'hint' => 'Standard outpatient doctor visit',
                'code' => 'OPD_CONSULT',
                'name' => 'OPD consultation',
                'category' => 'consult',
                'code_type' => $defaultType,
                'billing_code' => 'OPD_CONSULT',
                'price_amount' => 50.00,
                'sort_order' => 10,
            ],
            [
                'id' => 'new_patient_reg',
                'label' => 'New patient registration',
                'hint' => 'One-time registration or file-opening fee',
                'code' => 'NEW_REG',
                'name' => 'New patient registration',
                'category' => 'admin',
                'code_type' => $defaultType,
                'billing_code' => 'NEW_REG',
                'price_amount' => 20.00,
                'sort_order' => 20,
            ],
            [
                'id' => 'lab_panel_basic',
                'label' => 'Basic lab panel',
                'hint' => 'Starter lab bundle — map billing code to your lab codes',
                'code' => 'LAB_BASIC',
                'name' => 'Basic laboratory panel',
                'category' => 'lab',
                'code_type' => $defaultType,
                'billing_code' => 'LAB_BASIC',
                'price_amount' => 80.00,
                'sort_order' => 30,
            ],
            [
                'id' => 'injection_im',
                'label' => 'Injection (IM)',
                'hint' => 'Intramuscular injection procedure',
                'code' => 'INJ_IM',
                'name' => 'Injection — intramuscular',
                'category' => 'procedure',
                'code_type' => $defaultType,
                'billing_code' => 'INJ_IM',
                'price_amount' => 25.00,
                'sort_order' => 40,
            ],
        ];
    }

    public function isBillableCodeType(string $codeType): bool
    {
        if ($codeType === '') {
            return false;
        }

        foreach ($this->listBillableCodeTypes() as $type) {
            if ($type['ct_key'] === $codeType) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function categoryOptions(): array
    {
        $options = [];
        foreach (self::CATEGORIES as $key => $label) {
            $options[] = ['value' => $key, 'label' => $label];
        }

        return $options;
    }

    private function getDefaultCodeType(): string
    {
        $types = $this->listBillableCodeTypes();
        if (empty($types)) {
            return 'CPT4';
        }

        foreach ($types as $type) {
            if ($type['ct_key'] === 'CUSTOM') {
                return 'CUSTOM';
            }
        }

        return (string) $types[0]['ct_key'];
    }

    /**
     * @return array<string, mixed>
     */
    private function adminPayload(int $facilityId): array
    {
        return array_merge(
            ['facility_id' => $facilityId, 'fee_schedule' => $this->listForAdmin($facilityId)],
            $this->getFormMeta()
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listForAdmin(int $facilityId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);

        $rows = QueryUtils::fetchRecords(
            "SELECT id, facility_id, code, name, category, price_amount, code_type, billing_code,
                    is_active, sort_order, updated_at
             FROM new_fee_schedule
             WHERE facility_id IN (0, ?)
             ORDER BY is_active DESC, sort_order ASC, name ASC",
            [$facilityId]
        ) ?: [];

        return array_map(function (array $row): array {
            return $this->normalizeRow($row);
        }, $rows);
    }

    /**
     * Active fee lines for cashier pickers and hints.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listForDesk(int $facilityId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);

        $rows = QueryUtils::fetchRecords(
            "SELECT id, code, name, category, price_amount, code_type, billing_code, sort_order
             FROM new_fee_schedule
             WHERE is_active = 1 AND (facility_id = 0 OR facility_id = ?)
             ORDER BY sort_order ASC, name ASC",
            [$facilityId]
        ) ?: [];

        return array_map(static function (array $row): array {
            return [
                'id' => (int) ($row['id'] ?? 0),
                'code' => (string) ($row['code'] ?? ''),
                'name' => (string) ($row['name'] ?? ''),
                'category' => (string) ($row['category'] ?? ''),
                'price_amount' => round((float) ($row['price_amount'] ?? 0), 2),
                'code_type' => (string) ($row['code_type'] ?? ''),
                'billing_code' => (string) ($row['billing_code'] ?? ''),
            ];
        }, $rows);
    }

    /**
     * @param array<int, int> $feeIds
     * @return array<int, array<string, mixed>>
     */
    public function getByIds(array $feeIds, int $facilityId): array
    {
        $feeIds = array_values(array_unique(array_filter(array_map('intval', $feeIds))));
        if (empty($feeIds)) {
            return [];
        }

        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $placeholders = implode(',', array_fill(0, count($feeIds), '?'));
        $params = array_merge($feeIds, [$facilityId]);

        $rows = QueryUtils::fetchRecords(
            "SELECT id, code, name, category, price_amount, code_type, billing_code, sort_order
             FROM new_fee_schedule
             WHERE id IN ($placeholders) AND is_active = 1 AND (facility_id = 0 OR facility_id = ?)
             ORDER BY sort_order ASC, name ASC",
            $params
        ) ?: [];

        return array_map(static function (array $row): array {
            return [
                'id' => (int) ($row['id'] ?? 0),
                'code' => (string) ($row['code'] ?? ''),
                'name' => (string) ($row['name'] ?? ''),
                'category' => (string) ($row['category'] ?? ''),
                'price_amount' => round((float) ($row['price_amount'] ?? 0), 2),
                'code_type' => (string) ($row['code_type'] ?? ''),
                'billing_code' => (string) ($row['billing_code'] ?? ''),
            ];
        }, $rows);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getActiveFeeForDesk(int $feeId, int $facilityId): ?array
    {
        $rows = $this->getByIds([$feeId], $facilityId);

        return $rows[0] ?? null;
    }

    /**
     * Suggested fee lines from visit type hints (M6-F23 / M5-F14).
     *
     * @return array<int, array<string, mixed>>
     */
    public function resolveVisitTypeSuggestions(int $visitTypeId, int $facilityId): array
    {
        if ($visitTypeId <= 0) {
            return [];
        }

        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $row = QueryUtils::querySingleRow(
            "SELECT cashier_fee_hint_ids, default_fee_schedule_id
             FROM new_visit_type
             WHERE id = ? AND is_active = 1 AND (facility_id = 0 OR facility_id = ?)",
            [$visitTypeId, $facilityId]
        );
        if (empty($row)) {
            return [];
        }

        $ids = [];
        $defaultId = (int) ($row['default_fee_schedule_id'] ?? 0);
        if ($defaultId > 0) {
            $ids[] = $defaultId;
        }

        $rawHints = $row['cashier_fee_hint_ids'] ?? null;
        if (is_string($rawHints) && $rawHints !== '') {
            $decoded = json_decode($rawHints, true);
            if (is_array($decoded)) {
                foreach ($decoded as $hintId) {
                    $ids[] = (int) $hintId;
                }
            }
        }

        $fees = $this->getByIds($ids, $facilityId);

        return array_map(static function (array $fee): array {
            $fee['is_suggested'] = true;

            return $fee;
        }, $fees);
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function save(int $facilityId, array $input, int $actorUserId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $feeId = (int) ($input['id'] ?? 0);
        $code = mb_substr(trim((string) ($input['code'] ?? '')), 0, 32);
        $name = mb_substr(trim((string) ($input['name'] ?? '')), 0, 128);
        $category = mb_substr(trim((string) ($input['category'] ?? '')), 0, 64);
        $codeType = mb_substr(trim((string) ($input['code_type'] ?? '')), 0, 32);
        $billingCode = mb_substr(trim((string) ($input['billing_code'] ?? '')), 0, 32);
        $priceAmount = round((float) ($input['price_amount'] ?? 0), 2);
        $sortOrder = (int) ($input['sort_order'] ?? 0);
        $targetFacilityId = $feeId > 0
            ? $this->resolveEditableFacilityId($feeId, $facilityId)
            : $facilityId;

        if ($code === '') {
            throw new \InvalidArgumentException('Fee code is required');
        }
        if ($name === '') {
            throw new \InvalidArgumentException('Fee description is required');
        }
        if ($billingCode === '') {
            throw new \InvalidArgumentException('Billing code is required');
        }
        $this->assertValidCodeType($codeType);
        if ($priceAmount < 0) {
            throw new \InvalidArgumentException('Price cannot be negative');
        }

        $this->assertBillingCodeExists($codeType, $billingCode);
        $this->assertCodeUnique($code, $targetFacilityId, $feeId);

        if ($feeId > 0) {
            $existing = $this->getFeeRow($feeId);
            if (empty($existing)) {
                throw new \InvalidArgumentException('Fee line not found');
            }

            sqlStatement(
                "UPDATE new_fee_schedule
                 SET code = ?, name = ?, category = ?, price_amount = ?, code_type = ?,
                     billing_code = ?, sort_order = ?, is_active = 1
                 WHERE id = ?",
                [$code, $name, $category !== '' ? $category : null, $priceAmount, $codeType, $billingCode, $sortOrder, $feeId]
            );
            $savedId = $feeId;
            $action = 'updated';
        } else {
            $savedId = (int) QueryUtils::sqlInsert(
                "INSERT INTO new_fee_schedule
                 (facility_id, code, name, category, price_amount, code_type, billing_code, sort_order, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
                [
                    $targetFacilityId,
                    $code,
                    $name,
                    $category !== '' ? $category : null,
                    $priceAmount,
                    $codeType,
                    $billingCode,
                    $sortOrder,
                ]
            );
            $action = 'created';
        }

        EventAuditLogger::getInstance()->newEvent(
            'fee_schedule',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            1,
            $action . ' id=' . $savedId . ' facility_id=' . $targetFacilityId . ' code=' . $code . ' uid=' . $actorUserId
        );

        return $this->adminPayload($facilityId);
    }

    /**
     * @return array<string, mixed>
     */
    public function archive(int $facilityId, int $feeId, int $actorUserId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $this->resolveEditableFacilityId($feeId, $facilityId);

        $row = $this->getFeeRow($feeId);
        if (empty($row) || (int) ($row['is_active'] ?? 0) !== 1) {
            throw new \InvalidArgumentException('Fee line not found or already archived');
        }

        sqlStatement(
            "UPDATE new_fee_schedule SET is_active = 0 WHERE id = ?",
            [$feeId]
        );

        EventAuditLogger::getInstance()->newEvent(
            'fee_schedule',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            1,
            'archived id=' . $feeId . ' uid=' . $actorUserId
        );

        return $this->adminPayload($facilityId);
    }

    /**
     * Import fee lines from CSV (code,name,category,price_amount,code_type,billing_code[,sort_order]).
     *
     * @return array<string, mixed>
     */
    public function importCsv(int $facilityId, string $csvContent, int $actorUserId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $csvContent = trim($csvContent);
        if ($csvContent === '') {
            throw new \InvalidArgumentException('CSV content is required');
        }

        $lines = preg_split('/\R/', $csvContent) ?: [];
        $imported = 0;
        $skipped = 0;
        $errors = [];

        foreach ($lines as $index => $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            if ($index === 0 && stripos($line, 'code,') === 0) {
                continue;
            }

            $parts = str_getcsv($line);
            if (count($parts) < 6) {
                $errors[] = 'Line ' . ($index + 1) . ': expected at least 6 columns';
                $skipped++;
                continue;
            }

            try {
                $this->save($facilityId, [
                    'code' => $parts[0],
                    'name' => $parts[1],
                    'category' => $parts[2],
                    'price_amount' => $parts[3],
                    'code_type' => $parts[4],
                    'billing_code' => $parts[5],
                    'sort_order' => $parts[6] ?? 0,
                ], $actorUserId);
                $imported++;
            } catch (\Throwable $e) {
                $errors[] = 'Line ' . ($index + 1) . ': ' . $e->getMessage();
                $skipped++;
            }
        }

        if ($imported === 0 && $skipped > 0) {
            throw new \InvalidArgumentException('Import failed: ' . implode('; ', array_slice($errors, 0, 3)));
        }

        $payload = $this->adminPayload($facilityId);
        $payload['import_summary'] = [
            'imported' => $imported,
            'skipped' => $skipped,
            'errors' => array_slice($errors, 0, 10),
        ];

        return $payload;
    }

    /** Bulk-price adjustment modes. */
    public const BULK_MODES = ['increase_percent', 'decrease_percent', 'increase_amount', 'decrease_amount', 'set'];

    /**
     * Bulk price adjustment across active fee lines (optionally one category).
     * A cash clinic re-prices often ("raise all consults 10%"); doing it row by
     * row is error-prone. `dryRun` returns the exact diff without writing (preview
     * for a ConfirmModal); otherwise it applies the changes and audits.
     *
     * @param array{mode?: string, value?: mixed, category?: string, round_whole?: mixed} $input
     * @return array<string, mixed>
     */
    public function bulkPriceUpdate(int $facilityId, array $input, int $actorUserId, bool $dryRun): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);

        $mode = trim((string) ($input['mode'] ?? ''));
        if (!in_array($mode, self::BULK_MODES, true)) {
            throw new \InvalidArgumentException('Choose how to change prices');
        }
        $value = round((float) ($input['value'] ?? 0), 2);
        if ($value < 0) {
            throw new \InvalidArgumentException('Value cannot be negative');
        }
        if ($mode === 'decrease_percent' && $value > 100) {
            throw new \InvalidArgumentException('A percentage decrease cannot exceed 100%');
        }
        $category = mb_substr(trim((string) ($input['category'] ?? '')), 0, 64);
        if ($category !== '' && !self::isValidCategory($category)) {
            throw new \InvalidArgumentException('Unknown category filter');
        }
        $roundWhole = !empty($input['round_whole']);

        // Scope to the actor's own facility only. A specific facility's admin must
        // NOT bulk-mutate the shared facility-0 "All facilities" template that other
        // facilities inherit; facility 0 is in scope only when the actor IS facility 0
        // (single-clinic / global admin). Per-row Edit still allows touching a global row.
        if ($facilityId === 0) {
            $scopeClause = 'facility_id = 0';
            $params = [];
        } else {
            $scopeClause = 'facility_id = ?';
            $params = [$facilityId];
        }
        $sql = "SELECT id, facility_id, code, name, category, price_amount
                FROM new_fee_schedule
                WHERE is_active = 1 AND " . $scopeClause;
        if ($category !== '') {
            $sql .= ' AND category = ?';
            $params[] = $category;
        }
        $sql .= ' ORDER BY sort_order ASC, name ASC';
        $rows = QueryUtils::fetchRecords($sql, $params) ?: [];

        $changes = [];
        foreach ($rows as $row) {
            $old = round((float) ($row['price_amount'] ?? 0), 2);
            $new = $this->applyPriceMode($old, $mode, $value);
            if ($roundWhole) {
                $new = round($new);
            }
            $new = round(max(0.0, $new), 2);
            if ($new !== $old) {
                $rowCategory = (string) ($row['category'] ?? '');
                $changes[] = [
                    'id' => (int) ($row['id'] ?? 0),
                    'code' => (string) ($row['code'] ?? ''),
                    'name' => (string) ($row['name'] ?? ''),
                    'category_label' => self::CATEGORIES[$rowCategory] ?? ($rowCategory !== '' ? $rowCategory : '—'),
                    'old_price' => $old,
                    'new_price' => $new,
                    'scope_label' => (int) ($row['facility_id'] ?? 0) === 0 ? 'All facilities' : 'This facility',
                ];
            }
        }

        if ($dryRun) {
            return [
                'dry_run' => true,
                'changes' => $changes,
                'change_count' => count($changes),
                'total_matched' => count($rows),
            ];
        }

        foreach ($changes as $change) {
            sqlStatement(
                "UPDATE new_fee_schedule SET price_amount = ? WHERE id = ? AND is_active = 1",
                [$change['new_price'], $change['id']]
            );
        }

        EventAuditLogger::getInstance()->newEvent(
            'fee_schedule.bulk_price',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            1,
            'bulk_price mode=' . $mode . ' value=' . $value . ' category=' . ($category !== '' ? $category : 'all')
                . ' changed=' . count($changes) . ' uid=' . $actorUserId
        );

        $payload = $this->adminPayload($facilityId);
        $payload['bulk_summary'] = [
            'changed' => count($changes),
            'total_matched' => count($rows),
            'mode' => $mode,
            'value' => $value,
            'category' => $category,
        ];

        return $payload;
    }

    private function applyPriceMode(float $old, string $mode, float $value): float
    {
        return match ($mode) {
            'increase_percent' => $old * (1 + ($value / 100)),
            'decrease_percent' => $old * (1 - ($value / 100)),
            'increase_amount' => $old + $value,
            'decrease_amount' => $old - $value,
            'set' => $value,
            default => $old,
        };
    }

    public static function isValidCategory(string $category): bool
    {
        return $category === '' || isset(self::CATEGORIES[$category]);
    }

    private function assertValidCodeType(string $codeType): void
    {
        if (!$this->isBillableCodeType($codeType)) {
            throw new \InvalidArgumentException('Invalid billing code type — choose a billable OpenEMR code type');
        }
    }

    private function assertBillingCodeExists(string $codeType, string $billingCode): void
    {
        $row = QueryUtils::querySingleRow(
            "SELECT c.code
             FROM codes c
             INNER JOIN code_types ct ON ct.ct_id = c.code_type
             WHERE ct.ct_key = ? AND c.code = ? AND c.active = 1",
            [$codeType, $billingCode]
        );
        if (empty($row)) {
            throw new \InvalidArgumentException(
                'Billing code not found in OpenEMR — add it under Administration → Codes before saving'
            );
        }
    }

    private function assertCodeUnique(string $code, int $facilityId, int $excludeId): void
    {
        $row = QueryUtils::querySingleRow(
            "SELECT id FROM new_fee_schedule
             WHERE code = ? AND facility_id = ? AND is_active = 1 AND id != ?",
            [$code, $facilityId, $excludeId]
        );
        if (!empty($row)) {
            throw new \InvalidArgumentException('An active fee with this code already exists');
        }
    }

    private function resolveEditableFacilityId(int $feeId, int $facilityId): int
    {
        $row = $this->getFeeRow($feeId);
        if (empty($row)) {
            throw new \InvalidArgumentException('Fee line not found');
        }

        $feeFacilityId = (int) ($row['facility_id'] ?? 0);
        if ($feeFacilityId !== 0 && $feeFacilityId !== $facilityId) {
            throw new \InvalidArgumentException('Fee line belongs to another facility');
        }

        return $feeFacilityId;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function getFeeRow(int $feeId): ?array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT * FROM new_fee_schedule WHERE id = ?",
            [$feeId]
        );

        return empty($row) ? null : $row;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function normalizeRow(array $row): array
    {
        $category = (string) ($row['category'] ?? '');

        return [
            'id' => (int) ($row['id'] ?? 0),
            'facility_id' => (int) ($row['facility_id'] ?? 0),
            'code' => (string) ($row['code'] ?? ''),
            'name' => (string) ($row['name'] ?? ''),
            'category' => $category,
            'category_label' => self::CATEGORIES[$category] ?? ($category !== '' ? $category : ''),
            'price_amount' => round((float) ($row['price_amount'] ?? 0), 2),
            'code_type' => (string) ($row['code_type'] ?? ''),
            'billing_code' => (string) ($row['billing_code'] ?? ''),
            'is_active' => (int) ($row['is_active'] ?? 0) === 1,
            'sort_order' => (int) ($row['sort_order'] ?? 0),
            'updated_at' => (string) ($row['updated_at'] ?? ''),
            'scope_label' => (int) ($row['facility_id'] ?? 0) === 0 ? 'All facilities' : 'This facility',
        ];
    }
}

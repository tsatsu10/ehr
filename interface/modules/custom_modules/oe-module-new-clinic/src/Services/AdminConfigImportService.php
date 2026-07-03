<?php

/**
 * M15-F13 — Facility-scoped M6 config JSON import (NG7 branch prep)
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

class AdminConfigImportService
{
    /** @var list<string> */
    private const EXCLUDED_SETTING_KEYS = [
        'admin_hub_setup_complete',
    ];

    public function __construct(
        private readonly FeeScheduleAdminService $feeSchedule = new FeeScheduleAdminService(),
        private readonly VisitTypeAdminService $visitTypes = new VisitTypeAdminService(),
    ) {
    }

    public function canImport(): bool
    {
        if (!AclMain::aclCheckCore('admin', 'super')) {
            return false;
        }

        return AclMain::aclCheckCore('new_clinic', 'new_admin')
            || AclMain::aclCheckCore('new_clinic', 'new_admin_hub_system');
    }

    public function blockedReason(): ?string
    {
        if ($this->canImport()) {
            return null;
        }

        return 'Config import requires OpenEMR administrator (super) access.';
    }

    /**
     * @return array<string, mixed>
     */
    public function getImportMeta(): array
    {
        return [
            'can_import' => $this->canImport(),
            'import_blocked_reason' => $this->blockedReason(),
            'import_format' => AdminConfigExportService::EXPORT_FORMAT,
            'import_version' => AdminConfigExportService::EXPORT_VERSION,
        ];
    }

    /**
     * @param array<string, mixed> $snapshot
     * @return array<string, mixed>
     */
    public function previewImport(int $targetFacilityId, array $snapshot): array
    {
        return $this->importFeesAndVisitTypes($targetFacilityId, $snapshot, 0, true);
    }

    /**
     * @param array<string, mixed> $snapshot
     * @return array<string, mixed>
     */
    public function importAndAudit(int $targetFacilityId, array $snapshot, int $actorUserId): array
    {
        if (!$this->canImport()) {
            throw new \RuntimeException(
                $this->blockedReason() ?? 'Config import is not allowed',
                403
            );
        }

        $result = $this->importFeesAndVisitTypes($targetFacilityId, $snapshot, $actorUserId, false);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic_config',
            'admin_hub.config_import',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode([
                'facility_id' => $targetFacilityId,
                'actor_user_id' => $actorUserId,
                'export_format' => AdminConfigExportService::EXPORT_FORMAT,
                'dry_run' => false,
                'fees_imported' => $result['summary']['fees_imported'] ?? 0,
                'visit_types_imported' => $result['summary']['visit_types_imported'] ?? 0,
                'settings_planned' => $result['summary']['settings_planned'] ?? 0,
            ]),
            0
        );

        return $result;
    }

    /**
     * @param array<string, mixed> $snapshot
     * @return array<string, mixed>
     */
    public function importFeesAndVisitTypes(
        int $targetFacilityId,
        array $snapshot,
        int $actorUserId,
        bool $dryRun
    ): array {
        if (!$this->canImport()) {
            throw new \RuntimeException(
                $this->blockedReason() ?? 'Config import is not allowed',
                403
            );
        }

        $errors = $this->validateSnapshot($snapshot);
        if ($errors !== []) {
            throw new \InvalidArgumentException(implode(' ', $errors));
        }

        $feeLines = is_array($snapshot['fee_schedule'] ?? null) ? $snapshot['fee_schedule'] : [];
        $visitTypeLines = is_array($snapshot['visit_types'] ?? null) ? $snapshot['visit_types'] : [];
        $settings = is_array($snapshot['settings'] ?? null) ? $snapshot['settings'] : [];

        $missingBillingCodes = $this->findMissingBillingCodes($feeLines);
        $warnings = [];
        if ($missingBillingCodes !== []) {
            $warnings[] = 'Missing billing codes on this site: ' . implode(', ', $missingBillingCodes);
        }

        $summary = [
            'fees_imported' => 0,
            'fees_skipped' => 0,
            'visit_types_imported' => 0,
            'visit_types_skipped' => 0,
            'settings_planned' => $this->countImportableSettings($settings),
            'dry_run' => $dryRun,
        ];
        $feeErrors = [];
        $visitErrors = [];

        if ($dryRun) {
            $summary['fees_planned'] = count($feeLines);
            $summary['visit_types_planned'] = count($visitTypeLines);

            return [
                'dry_run' => true,
                'summary' => $summary,
                'warnings' => $warnings,
                'errors' => $errors,
                'settings' => $this->filterImportableSettings($settings),
            ];
        }

        $feeIdMap = [];
        foreach ($feeLines as $line) {
            if (!is_array($line)) {
                continue;
            }
            if ((int) ($line['is_active'] ?? 1) !== 1) {
                $summary['fees_skipped']++;
                continue;
            }
            try {
                $existingId = $this->findActiveFeeIdByCode(
                    (string) ($line['code'] ?? ''),
                    $targetFacilityId
                );
                $saved = $this->feeSchedule->save($targetFacilityId, [
                    'id' => $existingId ?? 0,
                    'code' => (string) ($line['code'] ?? ''),
                    'name' => (string) ($line['name'] ?? ''),
                    'category' => (string) ($line['category'] ?? ''),
                    'price_amount' => (float) ($line['price_amount'] ?? 0),
                    'code_type' => (string) ($line['code_type'] ?? ''),
                    'billing_code' => (string) ($line['billing_code'] ?? ''),
                    'sort_order' => (int) ($line['sort_order'] ?? 0),
                ], $actorUserId);
                $summary['fees_imported']++;
                $exportedId = (int) ($line['id'] ?? 0);
                if ($exportedId > 0) {
                    foreach ($saved['fee_schedule'] ?? [] as $savedRow) {
                        if (
                            is_array($savedRow)
                            && (string) ($savedRow['code'] ?? '') === (string) ($line['code'] ?? '')
                        ) {
                            $feeIdMap[$exportedId] = (int) ($savedRow['id'] ?? 0);
                            break;
                        }
                    }
                }
            } catch (\Throwable $e) {
                $summary['fees_skipped']++;
                $feeErrors[] = (string) ($line['code'] ?? '?') . ': ' . $e->getMessage();
            }
        }

        foreach ($visitTypeLines as $line) {
            if (!is_array($line)) {
                continue;
            }
            if ((int) ($line['is_active'] ?? 1) !== 1) {
                $summary['visit_types_skipped']++;
                continue;
            }
            $hintIds = [];
            foreach ((array) ($line['cashier_fee_hint_ids'] ?? []) as $oldFeeId) {
                $mapped = $feeIdMap[(int) $oldFeeId] ?? 0;
                if ($mapped > 0) {
                    $hintIds[] = $mapped;
                }
            }
            try {
                $existingId = $this->findVisitTypeIdByLabel(
                    (string) ($line['label'] ?? ''),
                    (string) ($line['service_profile'] ?? 'full_opd'),
                    $targetFacilityId
                );
                $this->visitTypes->save($targetFacilityId, [
                    'id' => $existingId ?? 0,
                    'label' => (string) ($line['label'] ?? ''),
                    'pc_catid' => (int) ($line['pc_catid'] ?? 0),
                    'service_profile' => (string) ($line['service_profile'] ?? 'full_opd'),
                    'referral_required' => !empty($line['referral_required']),
                    'cashier_fee_hint_ids' => $hintIds,
                    'is_default' => !empty($line['is_default']),
                ], $actorUserId);
                $summary['visit_types_imported']++;
            } catch (\Throwable $e) {
                $summary['visit_types_skipped']++;
                $visitErrors[] = (string) ($line['label'] ?? '?') . ': ' . $e->getMessage();
            }
        }

        return [
            'dry_run' => false,
            'summary' => $summary,
            'warnings' => $warnings,
            'fee_errors' => $feeErrors,
            'visit_type_errors' => $visitErrors,
            'settings' => $this->filterImportableSettings($settings),
        ];
    }

    /**
     * @param array<string, mixed> $settings
     * @return array<string, mixed>
     */
    public function filterImportableSettings(array $settings): array
    {
        $filtered = [];
        foreach ($settings as $key => $value) {
            $key = (string) $key;
            if (!array_key_exists($key, ClinicAdminService::editableSettingsMeta())) {
                continue;
            }
            if (in_array($key, self::EXCLUDED_SETTING_KEYS, true)) {
                continue;
            }
            $filtered[$key] = $value;
        }

        return $filtered;
    }

    /**
     * @param array<string, mixed> $settings
     */
    private function countImportableSettings(array $settings): int
    {
        return count($this->filterImportableSettings($settings));
    }

    /**
     * @param array<string, mixed> $snapshot
     * @return list<string>
     */
    private function validateSnapshot(array $snapshot): array
    {
        $errors = [];
        if (($snapshot['export_format'] ?? '') !== AdminConfigExportService::EXPORT_FORMAT) {
            $errors[] = 'Unsupported export_format.';
        }
        if ((int) ($snapshot['export_version'] ?? 0) !== AdminConfigExportService::EXPORT_VERSION) {
            $errors[] = 'Unsupported export_version.';
        }
        if (!is_array($snapshot['settings'] ?? null)) {
            $errors[] = 'settings must be an object.';
        }
        if (!is_array($snapshot['fee_schedule'] ?? null)) {
            $errors[] = 'fee_schedule must be an array.';
        }
        if (!is_array($snapshot['visit_types'] ?? null)) {
            $errors[] = 'visit_types must be an array.';
        }

        return $errors;
    }

    /**
     * @param list<array<string, mixed>> $feeLines
     * @return list<string>
     */
    private function findMissingBillingCodes(array $feeLines): array
    {
        $missing = [];
        foreach ($feeLines as $line) {
            if (!is_array($line) || (int) ($line['is_active'] ?? 1) !== 1) {
                continue;
            }
            $codeType = trim((string) ($line['code_type'] ?? ''));
            $billingCode = trim((string) ($line['billing_code'] ?? ''));
            if ($codeType === '' || $billingCode === '') {
                continue;
            }
            $row = QueryUtils::querySingleRow(
                'SELECT id FROM codes WHERE code_type = ? AND code = ? AND active = 1 LIMIT 1',
                [$codeType, $billingCode]
            );
            if (!is_array($row) || empty($row['id'])) {
                $missing[] = $codeType . ':' . $billingCode;
            }
        }

        return array_values(array_unique($missing));
    }

    private function findActiveFeeIdByCode(string $code, int $facilityId): ?int
    {
        $code = trim($code);
        if ($code === '') {
            return null;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT id FROM new_fee_schedule
             WHERE code = ? AND is_active = 1 AND facility_id IN (0, ?)
             ORDER BY facility_id DESC
             LIMIT 1',
            [$code, $facilityId]
        );

        return is_array($row) && !empty($row['id']) ? (int) $row['id'] : null;
    }

    private function findVisitTypeIdByLabel(string $label, string $profile, int $facilityId): ?int
    {
        $label = trim($label);
        if ($label === '') {
            return null;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT id FROM new_visit_type
             WHERE label = ? AND service_profile = ? AND is_active = 1 AND facility_id IN (0, ?)
             ORDER BY facility_id DESC
             LIMIT 1',
            [$label, $profile, $facilityId]
        );

        return is_array($row) && !empty($row['id']) ? (int) $row['id'] : null;
    }
}

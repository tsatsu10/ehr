<?php

/**
 * Visit type CRUD for Clinic Setup (M6-F02)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class VisitTypeAdminService
{
    /** @var array<int, string> */
    public const SERVICE_PROFILES = ['full_opd', 'lab_direct', 'pharmacy_walkin'];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getAdminPayload(int $facilityId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $defaultId = (int) ($this->config->get('default_visit_type_id', '0', $facilityId) ?? '0');

        return [
            'facility_id' => $facilityId,
            'visit_types' => $this->listForAdmin($facilityId, $defaultId),
            'calendar_categories' => $this->listCalendarCategories(),
            'default_visit_type_id' => $defaultId,
            'service_profiles' => self::SERVICE_PROFILES,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listForAdmin(int $facilityId, ?int $defaultId = null): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        if ($defaultId === null) {
            $defaultId = (int) ($this->config->get('default_visit_type_id', '0', $facilityId) ?? '0');
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT id, facility_id, label, pc_catid, service_profile, referral_required,
                    cashier_fee_hint_ids, is_active
             FROM new_visit_type
             WHERE facility_id IN (0, ?)
             ORDER BY is_active DESC, facility_id DESC, label ASC",
            [$facilityId]
        ) ?: [];

        return array_map(function (array $row) use ($defaultId): array {
            return $this->normalizeRow($row, $defaultId);
        }, $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listCalendarCategories(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT pc_catid, pc_catname
             FROM openemr_postcalendar_categories
             WHERE pc_active = 1
             ORDER BY pc_seq ASC, pc_catname ASC"
        ) ?: [];

        return array_map(static function (array $row): array {
            return [
                'pc_catid' => (int) ($row['pc_catid'] ?? 0),
                'name' => (string) ($row['pc_catname'] ?? ''),
            ];
        }, $rows);
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function save(int $facilityId, array $input, int $actorUserId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $visitTypeId = (int) ($input['id'] ?? 0);
        $label = mb_substr(trim((string) ($input['label'] ?? '')), 0, 128);
        $pcCatid = (int) ($input['pc_catid'] ?? 0);
        $serviceProfile = (string) ($input['service_profile'] ?? 'full_opd');
        $referralRequired = !empty($input['referral_required']) ? 1 : 0;
        $setDefault = !empty($input['is_default']);
        $feeHintIds = $this->normalizeFeeHintIds($input['cashier_fee_hint_ids'] ?? [], $facilityId);
        $feeHintsJson = json_encode($feeHintIds);
        $targetFacilityId = $visitTypeId > 0
            ? $this->resolveEditableFacilityId($visitTypeId, $facilityId)
            : $facilityId;

        if ($label === '') {
            throw new \InvalidArgumentException('Visit type name is required');
        }

        $this->assertValidServiceProfile($serviceProfile);
        $this->assertCalendarCategoryExists($pcCatid);
        $this->assertProfileAllowedForClinic($serviceProfile, $targetFacilityId);

        if ($visitTypeId > 0) {
            $existing = $this->getVisitTypeRow($visitTypeId);
            if (empty($existing)) {
                throw new \InvalidArgumentException('Visit type not found');
            }

            sqlStatement(
                "UPDATE new_visit_type
                 SET label = ?, pc_catid = ?, service_profile = ?, referral_required = ?,
                     cashier_fee_hint_ids = ?, is_active = 1
                 WHERE id = ?",
                [$label, $pcCatid, $serviceProfile, $referralRequired, $feeHintsJson, $visitTypeId]
            );
            $savedId = $visitTypeId;
            $action = 'updated';
        } else {
            $savedId = (int) QueryUtils::sqlInsert(
                "INSERT INTO new_visit_type
                 (facility_id, label, pc_catid, service_profile, referral_required, cashier_fee_hint_ids, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, 1)",
                [$targetFacilityId, $label, $pcCatid, $serviceProfile, $referralRequired, $feeHintsJson]
            );
            $action = 'created';
        }

        if ($setDefault) {
            $this->config->set('default_visit_type_id', (string) $savedId, $facilityId);
            if ($facilityId > 0) {
                $this->config->clearGlobalOverrides(['default_visit_type_id']);
            }
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'visit_type',
            $actorUserId,
            1,
            $action . ' id=' . $savedId . ' facility_id=' . $targetFacilityId
        );

        return $this->getAdminPayload($facilityId);
    }

    /**
     * @return array<string, mixed>
     */
    public function archive(int $facilityId, int $visitTypeId, int $actorUserId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $this->resolveEditableFacilityId($visitTypeId, $facilityId);

        $row = $this->getVisitTypeRow($visitTypeId);
        if (empty($row) || (int) ($row['is_active'] ?? 0) !== 1) {
            throw new \InvalidArgumentException('Visit type not found or already archived');
        }

        if ((string) ($row['service_profile'] ?? '') === 'full_opd') {
            $opdRow = QueryUtils::querySingleRow(
                "SELECT COUNT(*) AS cnt FROM new_visit_type
                 WHERE is_active = 1 AND service_profile = 'full_opd'
                 AND facility_id IN (0, ?) AND id != ?",
                [$facilityId, $visitTypeId]
            );
            $activeOpd = is_array($opdRow) ? (int) ($opdRow['cnt'] ?? 0) : 0;
            if ($activeOpd < 1) {
                throw new \InvalidArgumentException('Cannot archive the only active OPD visit type');
            }
        }

        $defaultId = (int) ($this->config->get('default_visit_type_id', '0', $facilityId) ?? '0');
        if ($defaultId === $visitTypeId) {
            throw new \InvalidArgumentException('Unset default visit type before archiving');
        }

        sqlStatement(
            "UPDATE new_visit_type SET is_active = 0 WHERE id = ?",
            [$visitTypeId]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'visit_type',
            $actorUserId,
            1,
            'archived id=' . $visitTypeId
        );

        return $this->getAdminPayload($facilityId);
    }

    /**
     * Active visit types for desk dropdowns with desk-toggle filtering.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listForDesk(int $facilityId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $defaultId = (int) ($this->config->get('default_visit_type_id', '0', $facilityId) ?? '0');

        $rows = QueryUtils::fetchRecords(
            "SELECT id, label, service_profile, pc_catid, facility_id
             FROM new_visit_type
             WHERE is_active = 1 AND (facility_id = 0 OR facility_id = ?)
             ORDER BY label ASC",
            [$facilityId]
        ) ?: [];

        $enableLab = $this->config->getInt('enable_lab_role', 0, $facilityId) === 1;
        $enablePharmacy = $this->config->getInt('enable_pharmacy_role', 0, $facilityId) === 1;

        $filtered = [];
        foreach ($rows as $row) {
            $profile = (string) ($row['service_profile'] ?? 'full_opd');
            if ($profile === 'lab_direct' && !$enableLab) {
                continue;
            }
            if ($profile === 'pharmacy_walkin' && !$enablePharmacy) {
                continue;
            }
            $filtered[] = [
                'id' => (int) ($row['id'] ?? 0),
                'label' => (string) ($row['label'] ?? ''),
                'service_profile' => $profile,
                'pc_catid' => (int) ($row['pc_catid'] ?? 0),
                'is_default' => $defaultId > 0 && (int) ($row['id'] ?? 0) === $defaultId,
            ];
        }

        return $filtered;
    }

    public static function isValidServiceProfile(string $profile): bool
    {
        return in_array($profile, self::SERVICE_PROFILES, true);
    }

    private function assertValidServiceProfile(string $profile): void
    {
        if (!self::isValidServiceProfile($profile)) {
            throw new \InvalidArgumentException('Invalid service profile');
        }
    }

    private function assertCalendarCategoryExists(int $pcCatid): void
    {
        if ($pcCatid <= 0) {
            throw new \InvalidArgumentException('Calendar category is required');
        }

        $row = QueryUtils::querySingleRow(
            "SELECT pc_catid FROM openemr_postcalendar_categories WHERE pc_catid = ? AND pc_active = 1",
            [$pcCatid]
        );
        if (empty($row)) {
            throw new \InvalidArgumentException('Invalid calendar category');
        }
    }

    private function assertProfileAllowedForClinic(string $profile, int $facilityId): void
    {
        if ($profile === 'lab_direct' && $this->config->getInt('enable_lab_role', 0, $facilityId) !== 1) {
            throw new \InvalidArgumentException('Enable lab desk before adding a lab-direct visit type');
        }
        if ($profile === 'pharmacy_walkin' && $this->config->getInt('enable_pharmacy_role', 0, $facilityId) !== 1) {
            throw new \InvalidArgumentException('Enable pharmacy desk before adding a pharmacy walk-in type');
        }
    }

    private function resolveEditableFacilityId(int $visitTypeId, int $facilityId): int
    {
        $row = $this->getVisitTypeRow($visitTypeId);
        if (empty($row)) {
            throw new \InvalidArgumentException('Visit type not found');
        }

        $typeFacilityId = (int) ($row['facility_id'] ?? 0);
        if ($typeFacilityId !== 0 && $typeFacilityId !== $facilityId) {
            throw new \InvalidArgumentException('Visit type belongs to another facility');
        }

        return $typeFacilityId;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function getVisitTypeRow(int $visitTypeId): ?array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT * FROM new_visit_type WHERE id = ?",
            [$visitTypeId]
        );

        return empty($row) ? null : $row;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function normalizeRow(array $row, int $defaultId): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'facility_id' => (int) ($row['facility_id'] ?? 0),
            'label' => (string) ($row['label'] ?? ''),
            'pc_catid' => (int) ($row['pc_catid'] ?? 0),
            'service_profile' => (string) ($row['service_profile'] ?? 'full_opd'),
            'referral_required' => (int) ($row['referral_required'] ?? 0) === 1,
            'cashier_fee_hint_ids' => $this->decodeFeeHintIds($row['cashier_fee_hint_ids'] ?? null),
            'is_active' => (int) ($row['is_active'] ?? 0) === 1,
            'is_default' => $defaultId > 0 && (int) ($row['id'] ?? 0) === $defaultId,
            'scope_label' => (int) ($row['facility_id'] ?? 0) === 0 ? 'All facilities' : 'This facility',
        ];
    }

    /**
     * @return array<int, int>
     */
    private function decodeFeeHintIds(mixed $raw): array
    {
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return array_values(array_unique(array_filter(array_map('intval', $decoded), static fn (int $id): bool => $id > 0)));
            }
        }

        return [];
    }

    /**
     * @param mixed $raw
     * @return array<int, int>
     */
    private function normalizeFeeHintIds(mixed $raw, int $facilityId): array
    {
        if (!is_array($raw)) {
            return [];
        }

        $ids = array_values(array_unique(array_filter(array_map('intval', $raw), static fn (int $id): bool => $id > 0)));
        foreach ($ids as $feeId) {
            $fee = QueryUtils::querySingleRow(
                "SELECT id FROM new_fee_schedule
                 WHERE id = ? AND is_active = 1 AND (facility_id = 0 OR facility_id = ?)",
                [$feeId, $facilityId]
            );
            if (empty($fee)) {
                throw new \InvalidArgumentException('Invalid cashier fee hint');
            }
        }

        return $ids;
    }
}

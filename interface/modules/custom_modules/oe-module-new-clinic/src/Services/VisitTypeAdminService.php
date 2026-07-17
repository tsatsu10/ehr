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

    /** @var array<string, string> */
    private const SERVICE_PROFILE_HINTS = [
        'full_opd' => 'Standard OPD — triage, doctor, and cashier path',
        'lab_direct' => 'Lab-only — skips doctor and pharmacy',
        'pharmacy_walkin' => 'Pharmacy walk-in — OTC or external Rx only',
    ];

    /** @var array<int, string> per-request cache of facility id → display name */
    private array $facilityNameCache = [];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /** Human label for a row's scope: the facility's own name, or "All facilities" for a global (0) row. */
    private function scopeLabelFor(int $facilityId): string
    {
        if ($facilityId === 0) {
            return 'All facilities';
        }
        if (!isset($this->facilityNameCache[$facilityId])) {
            $row = QueryUtils::querySingleRow("SELECT name FROM facility WHERE id = ?", [$facilityId]);
            $name = is_array($row) ? trim((string) ($row['name'] ?? '')) : '';
            $this->facilityNameCache[$facilityId] = $name !== '' ? $name : ('Facility ' . $facilityId);
        }
        return $this->facilityNameCache[$facilityId];
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
     * Every booked calendar appointment still needs a legacy pc_catid FK
     * (openemr_postcalendar_events schema) — but New Clinic no longer asks
     * admins to manage that table directly. Visit types are the single
     * admin-facing list (Clinic Setup); this resolves one shared, always-
     * valid "appointment" category for new visit types to point at,
     * bootstrapping it if the category table is empty (fresh install).
     */
    private function resolveBookingCategoryId(): int
    {
        $row = QueryUtils::querySingleRow(
            "SELECT pc_catid FROM openemr_postcalendar_categories
             WHERE pc_active = 1 AND pc_cattype = 0
             ORDER BY pc_seq ASC, pc_catid ASC LIMIT 1"
        );
        $catId = is_array($row) ? (int) ($row['pc_catid'] ?? 0) : 0;
        if ($catId > 0) {
            return $catId;
        }

        $nextSeq = (int) (QueryUtils::querySingleRow(
            'SELECT COALESCE(MAX(pc_seq), 0) + 1 AS next_seq FROM openemr_postcalendar_categories'
        )['next_seq'] ?? 1);

        return (int) QueryUtils::sqlInsert(
            "INSERT INTO openemr_postcalendar_categories (pc_catname, pc_cattype, pc_active, pc_seq)
             VALUES ('Office Visit', 0, 1, ?)",
            [$nextSeq]
        );
    }

    /**
     * Visit-type lookup for the calendar booking sheet — same visibility
     * rule (active + facility scope + desk-toggle filtering) as
     * listForDesk(), so a client can never book a service-profile that's
     * been disabled or archived since the page loaded.
     *
     * @return array{id: int, label: string, pc_catid: int}|null
     */
    public function getVisitTypeForBooking(int $visitTypeId, int $facilityId): ?array
    {
        foreach ($this->listForDesk($facilityId) as $vt) {
            if ((int) $vt['id'] === $visitTypeId) {
                return ['id' => (int) $vt['id'], 'label' => (string) $vt['label'], 'pc_catid' => (int) $vt['pc_catid']];
            }
        }

        return null;
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
        $this->assertProfileAllowedForClinic($serviceProfile, $targetFacilityId);

        if ($visitTypeId > 0) {
            $existing = $this->getVisitTypeRow($visitTypeId);
            if (empty($existing)) {
                throw new \InvalidArgumentException('Visit type not found');
            }
            $pcCatid = (int) ($existing['pc_catid'] ?? 0);
            if ($pcCatid <= 0) {
                $pcCatid = $this->resolveBookingCategoryId();
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
                [$targetFacilityId, $label, $this->resolveBookingCategoryId(), $serviceProfile, $referralRequired, $feeHintsJson]
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
            "SELECT id, label, service_profile, pc_catid, facility_id, referral_required
             FROM new_visit_type
             WHERE is_active = 1 AND (facility_id = 0 OR facility_id = ?)
             ORDER BY label ASC",
            [$facilityId]
        ) ?: [];

        // A facility can override a global (facility_id = 0) visit type by
        // adding its own with the same name — e.g. every pilot clinic ships
        // global "Lab-only (direct)" / "Pharmacy walk-in" defaults, and a
        // clinic customizing them ends up with both rows in the table. Desk
        // dropdowns must show that name ONCE (the facility-specific one
        // wins); the admin table intentionally still lists both so the
        // override is visible and manageable.
        $facilityLabels = [];
        foreach ($rows as $row) {
            if ((int) ($row['facility_id'] ?? 0) !== 0) {
                $facilityLabels[mb_strtolower(trim((string) ($row['label'] ?? '')))] = true;
            }
        }

        $enableAncillary = $this->config->getInt('enable_ancillary_services', 0, $facilityId) === 1;
        $enableLab = $this->config->getInt('enable_lab_role', 0, $facilityId) === 1;
        $enablePharmacy = $this->config->getInt('enable_pharmacy_role', 0, $facilityId) === 1;

        $filtered = [];
        foreach ($rows as $row) {
            $isGlobalDefault = (int) ($row['facility_id'] ?? 0) === 0;
            $labelKey = mb_strtolower(trim((string) ($row['label'] ?? '')));
            if ($isGlobalDefault && $labelKey !== '' && isset($facilityLabels[$labelKey])) {
                continue;
            }

            $profile = (string) ($row['service_profile'] ?? 'full_opd');
            if ($profile !== 'full_opd' && !$enableAncillary) {
                continue;
            }
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
                'referral_required' => (int) ($row['referral_required'] ?? 0) === 1,
                'allows_referral_upload' => $profile === 'lab_direct',
                'service_profile_hint' => self::SERVICE_PROFILE_HINTS[$profile] ?? null,
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

    private function assertProfileAllowedForClinic(string $profile, int $facilityId): void
    {
        if ($profile !== 'full_opd' && $this->config->getInt('enable_ancillary_services', 0, $facilityId) !== 1) {
            throw new \InvalidArgumentException('Enable ancillary walk-in services before adding lab-direct or pharmacy walk-in types');
        }
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
            'scope_label' => $this->scopeLabelFor((int) ($row['facility_id'] ?? 0)),
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

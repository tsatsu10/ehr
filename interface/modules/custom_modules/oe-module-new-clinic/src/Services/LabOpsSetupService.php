<?php

/**
 * M12-F06 — lab setup wizard (provider + starter panel)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class LabOpsSetupService
{
    public const MODEL_IN_HOUSE = 'in_house';

    public const MODEL_SEND_OUT_ONLY = 'send_out_only';

    public const MODEL_HYBRID = 'hybrid';

    /** @var array<int, string> */
    public const SETUP_MODELS = [
        self::MODEL_IN_HOUSE,
        self::MODEL_SEND_OUT_ONLY,
        self::MODEL_HYBRID,
    ];

    public function __construct(
        private readonly LabOpsAccessService $access = new LabOpsAccessService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly LabOpsPanelImportService $panelImport = new LabOpsPanelImportService(),
        private readonly LabOpsFeeMapService $feeMap = new LabOpsFeeMapService(),
    ) {
    }

    public static function normalizeSetupModel(string $model): string
    {
        $model = strtolower(trim($model));
        if (!in_array($model, self::SETUP_MODELS, true)) {
            throw new \InvalidArgumentException('Invalid lab setup model');
        }

        return $model;
    }

    /**
     * @return array<string, mixed>
     */
    public function getSetupStatus(): array
    {
        $this->access->assertHubAccess();

        $facilityId = $this->resolveFacilityId();
        $setupModel = self::normalizeSetupModel(
            (string) $this->config->get('lab_setup_model', self::MODEL_IN_HOUSE, $facilityId)
        );
        $inHouse = $this->loadProviderStatus(
            (int) $this->config->get('lab_inhouse_provider_id', '0', $facilityId)
        );
        $sendOut = $this->loadProviderStatus(
            (int) $this->config->get('lab_sendout_provider_id', '0', $facilityId)
        );

        $catalogProviderId = $inHouse['provider_id'] ?? 0;
        $unmappedFeeCount = $catalogProviderId > 0
            ? $this->feeMap->countUnmapped($facilityId, $catalogProviderId)
            : 0;
        $testCount = (int) ($inHouse['test_count'] ?? 0);

        return [
            'facility_id' => $facilityId,
            'setup_model' => $setupModel,
            'setup_model_label' => $this->setupModelLabel($setupModel),
            'needs_inhouse_provider' => $this->needsInHouseProvider($setupModel),
            'needs_sendout_provider' => $this->needsSendOutProvider($setupModel),
            'provider_id' => $inHouse['provider_id'],
            'provider_name' => $inHouse['provider_name'],
            'sendout_provider_id' => $sendOut['provider_id'],
            'sendout_provider_name' => $sendOut['provider_name'],
            'test_count' => $testCount,
            'has_starter_panel' => $testCount >= 5,
            'unmapped_fee_count' => $unmappedFeeCount,
            'fees_mapped' => $testCount > 0 && $unmappedFeeCount === 0,
            'can_manage_catalog' => $this->access->canManageCatalog(),
            'starter_csv_available' => is_readable(
                dirname(__DIR__, 6) . '/Documentation/NewClinic/samples/opd_lab_panel_starter.csv'
            ),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function setSetupModel(string $model, int $actorUserId): array
    {
        $this->assertCatalogAccess();
        $normalized = self::normalizeSetupModel($model);
        $facilityId = $this->resolveFacilityId();
        $this->config->set('lab_setup_model', $normalized, $facilityId);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'lab_ops.setup_model_set',
            $actorUserId,
            1,
            'model=' . $normalized . ' facility_id=' . $facilityId
        );

        return [
            'setup_model' => $normalized,
            'setup_status' => $this->getSetupStatus(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function createInHouseProvider(string $clinicName, int $actorUserId): array
    {
        $this->assertCatalogAccess();

        $name = trim($clinicName);
        if ($name === '') {
            $name = (string) ($GLOBALS['openemr_name'] ?? 'Clinic');
        }
        $providerLabel = mb_substr($name . ' Lab', 0, 255);
        $providerId = $this->findOrCreateProvider($providerLabel, 'inhouse');

        $facilityId = $this->resolveFacilityId();
        $this->config->set('lab_inhouse_provider_id', (string) $providerId, $facilityId);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'lab_ops.provider_created',
            $actorUserId,
            1,
            'provider_id=' . $providerId . ' kind=in_house'
        );

        return [
            'provider_id' => $providerId,
            'provider_name' => $providerLabel,
            'setup_status' => $this->getSetupStatus(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function createSendOutProvider(string $labName, int $actorUserId): array
    {
        $this->assertCatalogAccess();

        $name = trim($labName);
        if ($name === '') {
            $name = 'External reference lab';
        }
        $providerLabel = mb_substr($name, 0, 255);
        $providerId = $this->findOrCreateProvider($providerLabel, 'external');

        $facilityId = $this->resolveFacilityId();
        $this->config->set('lab_sendout_provider_id', (string) $providerId, $facilityId);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'lab_ops.provider_created',
            $actorUserId,
            1,
            'provider_id=' . $providerId . ' kind=send_out'
        );

        return [
            'sendout_provider_id' => $providerId,
            'sendout_provider_name' => $providerLabel,
            'setup_status' => $this->getSetupStatus(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function importStarterPanel(?int $providerId, int $actorUserId): array
    {
        $this->assertCatalogAccess();

        $facilityId = $this->resolveFacilityId();
        if ($providerId === null || $providerId <= 0) {
            $providerId = (int) $this->config->get('lab_inhouse_provider_id', '0', $facilityId);
        }
        if ($providerId <= 0) {
            throw new \InvalidArgumentException('Create an in-house lab provider first');
        }

        $imported = $this->panelImport->importStarterPack($providerId, $actorUserId);

        $feeResult = $this->feeMap->applyStarterDefaults($facilityId, $providerId, $actorUserId);

        return array_merge($imported, [
            'provider_id' => $providerId,
            'fee_mapping' => $feeResult,
            'setup_status' => $this->getSetupStatus(),
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listUnmappedFees(?int $providerId = null): array
    {
        $this->assertCatalogAccess();
        $facilityId = $this->resolveFacilityId();
        if ($providerId === null || $providerId <= 0) {
            $providerId = (int) $this->config->get('lab_inhouse_provider_id', '0', $facilityId);
        }
        if ($providerId <= 0) {
            return [];
        }

        return $this->feeMap->listUnmapped($facilityId, $providerId);
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<string, mixed>
     */
    public function saveFeeMappings(array $rows, int $actorUserId): array
    {
        $this->assertCatalogAccess();
        $facilityId = $this->resolveFacilityId();

        return array_merge(
            $this->feeMap->saveMappings($facilityId, $rows, $actorUserId),
            ['setup_status' => $this->getSetupStatus()]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function applyStarterFeeDefaults(?int $providerId, int $actorUserId): array
    {
        $this->assertCatalogAccess();
        $facilityId = $this->resolveFacilityId();
        if ($providerId === null || $providerId <= 0) {
            $providerId = (int) $this->config->get('lab_inhouse_provider_id', '0', $facilityId);
        }
        if ($providerId <= 0) {
            throw new \InvalidArgumentException('Create an in-house lab provider first');
        }

        return array_merge(
            $this->feeMap->applyStarterDefaults($facilityId, $providerId, $actorUserId),
            ['setup_status' => $this->getSetupStatus()]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function importPanelCsv(?int $providerId, string $csvContent, int $actorUserId): array
    {
        $this->assertCatalogAccess();

        $facilityId = $this->resolveFacilityId();
        if ($providerId === null || $providerId <= 0) {
            $providerId = (int) $this->config->get('lab_inhouse_provider_id', '0', $facilityId);
        }
        if ($providerId <= 0) {
            throw new \InvalidArgumentException('Create an in-house lab provider first');
        }

        if (trim($csvContent) === '') {
            throw new \InvalidArgumentException('CSV content is required');
        }

        $imported = $this->panelImport->importCsvContent($providerId, $csvContent, $actorUserId);

        return array_merge($imported, [
            'provider_id' => $providerId,
            'setup_status' => $this->getSetupStatus(),
        ]);
    }

    private function resolveFacilityId(): int
    {
        return $this->visitScope->resolveDeskFacilityId();
    }

    private function needsInHouseProvider(string $setupModel): bool
    {
        return $setupModel !== self::MODEL_SEND_OUT_ONLY;
    }

    private function needsSendOutProvider(string $setupModel): bool
    {
        return $setupModel === self::MODEL_SEND_OUT_ONLY || $setupModel === self::MODEL_HYBRID;
    }

    private function setupModelLabel(string $setupModel): string
    {
        return match ($setupModel) {
            self::MODEL_SEND_OUT_ONLY => 'Send-out only',
            self::MODEL_HYBRID => 'Hybrid (in-house + send-out)',
            default => 'In-house bench',
        };
    }

    /**
     * @return array{provider_id: ?int, provider_name: ?string, test_count: int}
     */
    private function loadProviderStatus(int $providerId): array
    {
        if ($providerId <= 0) {
            return [
                'provider_id' => null,
                'provider_name' => null,
                'test_count' => 0,
            ];
        }

        $provider = QueryUtils::querySingleRow(
            'SELECT ppid, name FROM procedure_providers WHERE ppid = ?',
            [$providerId]
        );
        if (!is_array($provider)) {
            return [
                'provider_id' => null,
                'provider_name' => null,
                'test_count' => 0,
            ];
        }

        $countRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM procedure_type
             WHERE lab_id = ? AND procedure_type = 'ord' AND activity = 1",
            [$providerId]
        );

        return [
            'provider_id' => (int) ($provider['ppid'] ?? 0),
            'provider_name' => (string) ($provider['name'] ?? ''),
            'test_count' => is_array($countRow) ? (int) ($countRow['cnt'] ?? 0) : 0,
        ];
    }

    private function findOrCreateProvider(string $providerLabel, string $type): int
    {
        $existing = QueryUtils::querySingleRow(
            'SELECT ppid FROM procedure_providers WHERE name = ? AND type = ? ORDER BY ppid DESC LIMIT 1',
            [$providerLabel, $type]
        );
        if (is_array($existing) && !empty($existing['ppid'])) {
            return (int) $existing['ppid'];
        }

        return (int) QueryUtils::sqlInsert(
            "INSERT INTO procedure_providers (name, npi, protocol, type, active)
             VALUES (?, '', 'DL', ?, 1)",
            [$providerLabel, $type]
        );
    }

    private function assertCatalogAccess(): void
    {
        $this->access->assertCatalogAccess();
    }
}

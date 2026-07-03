<?php

/**
 * M15-F13 — Facility-scoped M6 config JSON export (NG7 branch prep)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Modules\NewClinic\ModuleAssetVersion;
use OpenEMR\Services\VersionService;

class AdminConfigExportService
{
    public const EXPORT_FORMAT = 'new_clinic_m6_config';

    public const EXPORT_VERSION = 1;

    /** @var list<string> Site-specific M15 state omitted from branch templates. */
    private const EXCLUDED_SETTING_KEYS = [
        'admin_hub_setup_complete',
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitTypeAdminService $visitTypes = new VisitTypeAdminService(),
        private readonly FeeScheduleAdminService $feeSchedule = new FeeScheduleAdminService(),
    ) {
    }

    public function canExport(): bool
    {
        if (!AclMain::aclCheckCore('admin', 'super')) {
            return false;
        }

        return AclMain::aclCheckCore('new_clinic', 'new_admin')
            || AclMain::aclCheckCore('new_clinic', 'new_admin_hub_system');
    }

    public function blockedReason(): ?string
    {
        if ($this->canExport()) {
            return null;
        }

        return 'Config export requires OpenEMR administrator (super) access.';
    }

    /**
     * @return array<string, mixed>
     */
    public function getExportMeta(): array
    {
        return [
            'can_export' => $this->canExport(),
            'blocked_reason' => $this->blockedReason(),
            'export_format' => self::EXPORT_FORMAT,
            'export_version' => self::EXPORT_VERSION,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function buildSnapshot(int $facilityId, string $facilityLabel): array
    {
        if (!$this->canExport()) {
            throw new \RuntimeException(
                $this->blockedReason() ?? 'Config export is not allowed',
                403
            );
        }

        $defaultVisitTypeId = (int) ($this->config->get('default_visit_type_id', '0', $facilityId) ?? '0');

        return [
            'export_format' => self::EXPORT_FORMAT,
            'export_version' => self::EXPORT_VERSION,
            'exported_at' => date('c'),
            'facility_id' => $facilityId,
            'facility_label' => $facilityLabel,
            'module_version' => ModuleAssetVersion::VERSION,
            'openemr_version' => (new VersionService())->asString(),
            'settings' => $this->collectSettings($facilityId),
            'default_visit_type_id' => $defaultVisitTypeId,
            'visit_types' => $this->visitTypes->listForAdmin($facilityId, $defaultVisitTypeId),
            'fee_schedule' => $this->feeSchedule->listForAdmin($facilityId),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function exportAndAudit(int $facilityId, string $facilityLabel, int $actorUserId): array
    {
        $snapshot = $this->buildSnapshot($facilityId, $facilityLabel);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic_config',
            'admin_hub.config_export',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode([
                'facility_id' => $facilityId,
                'actor_user_id' => $actorUserId,
                'export_format' => self::EXPORT_FORMAT,
                'export_version' => self::EXPORT_VERSION,
                'setting_count' => count($snapshot['settings'] ?? []),
                'visit_type_count' => count($snapshot['visit_types'] ?? []),
                'fee_line_count' => count($snapshot['fee_schedule'] ?? []),
            ]),
            0
        );

        return $snapshot;
    }

    /**
     * @return array<string, bool|int|string>
     */
    private function collectSettings(int $facilityId): array
    {
        $settings = [];

        foreach (ClinicAdminService::editableSettingsMeta() as $key => $meta) {
            if (in_array($key, self::EXCLUDED_SETTING_KEYS, true)) {
                continue;
            }

            $default = $meta['default'];
            $raw = $this->config->get($key, $default, $facilityId) ?? $default;
            if ($meta['type'] === 'bool') {
                $settings[$key] = (int) $raw === 1;
            } elseif (
                $meta['type'] === 'string'
                || $meta['type'] === 'currency_code'
                || $meta['type'] === 'currency_symbol'
                || $meta['type'] === 'currency_position'
            ) {
                $settings[$key] = (string) $raw;
            } else {
                $settings[$key] = (int) $raw;
            }
        }

        return $settings;
    }
}

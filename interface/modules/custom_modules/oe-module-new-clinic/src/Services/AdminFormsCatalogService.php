<?php

/**
 * M15-F07 — Registered forms catalog (enable/disable with clinic guardrails)
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

class AdminFormsCatalogService
{
    /** @var list<string> */
    private const FEE_SHEET_FORMDIRS = [
        'fee_sheet',
        'misc_billing_options',
        'prior_auth',
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly ClinicalDocCatalogService $catalog = new ClinicalDocCatalogService(),
        private readonly AdminFormBundleService $bundle = new AdminFormBundleService(),
    ) {
    }

    public function canEditRegistry(): bool
    {
        return AclMain::aclCheckCore('admin', 'forms');
    }

    /**
     * @return array<string, mixed>
     */
    public function getCatalog(?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId < 0) {
            $facilityId = 0;
        }

        $webroot = $GLOBALS['webroot'] ?? '';
        $bundleFormdirs = $this->bundleFormdirs($facilityId);
        $rows = QueryUtils::fetchRecords(
            'SELECT id, name, directory, state, category, priority, nickname, sql_run
             FROM registry
             WHERE patient_encounter = 1
             ORDER BY priority, name'
        ) ?: [];

        $items = [];
        foreach ($rows as $row) {
            $directory = strtolower(trim((string) ($row['directory'] ?? '')));
            if ($directory === '') {
                continue;
            }

            $guard = $this->disableGuard($directory, $facilityId);
            $items[] = [
                'id' => (int) ($row['id'] ?? 0),
                'name' => trim((string) ($row['name'] ?? $directory)),
                'directory' => (string) ($row['directory'] ?? ''),
                'category' => trim((string) ($row['category'] ?? '')),
                'priority' => (int) ($row['priority'] ?? 0),
                'nickname' => trim((string) ($row['nickname'] ?? '')),
                'enabled' => (int) ($row['state'] ?? 0) === 1,
                'sql_run' => (int) ($row['sql_run'] ?? 0) === 1,
                'bundle_required' => in_array($directory, $bundleFormdirs, true)
                    || $this->matchesBundleFormdir($directory, $bundleFormdirs),
                'disable_blocked' => $guard['blocked'],
                'disable_block_reason' => $guard['reason'],
                'enable_warning' => $this->enableWarning($directory),
            ];
        }

        usort($items, static function (array $a, array $b): int {
            if ($a['bundle_required'] !== $b['bundle_required']) {
                return $a['bundle_required'] ? -1 : 1;
            }

            return strcasecmp((string) $a['name'], (string) $b['name']);
        });

        return [
            'items' => $items,
            'can_edit' => $this->canEditRegistry(),
            'forms_admin_url' => $webroot . '/interface/forms_admin/forms_admin.php',
            'layout_editor_url' => $webroot . '/interface/super/edit_layout.php',
            'list_editor_url' => $webroot . '/interface/super/edit_list.php',
            'bundle_formdirs' => $bundleFormdirs,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function setEnabled(int $registryId, bool $enabled, int $facilityId, int $actorUserId): array
    {
        if (!$this->canEditRegistry()) {
            throw new \RuntimeException('Forms registry edit requires admin/forms ACL', 403);
        }

        if ($registryId <= 0) {
            throw new \InvalidArgumentException('registry_id required');
        }

        $row = QueryUtils::querySingleRow(
            'SELECT id, directory, state FROM registry WHERE id = ? AND patient_encounter = 1 LIMIT 1',
            [$registryId]
        );
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Unknown registry form');
        }

        $directory = strtolower(trim((string) ($row['directory'] ?? '')));
        $warning = null;

        if (!$enabled) {
            $guard = $this->disableGuard($directory, $facilityId);
            if ($guard['blocked']) {
                throw new \InvalidArgumentException($guard['reason'] ?? 'This form cannot be disabled');
            }
        } else {
            $warning = $this->enableWarning($directory);
        }

        QueryUtils::sqlStatementThrowException(
            'UPDATE registry SET state = ?, date = NOW() WHERE id = ?',
            [$enabled ? 1 : 0, $registryId]
        );

        $this->catalog->clearAllowedFormdirsCache();

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic_config',
            'admin_forms_catalog_set_state',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode([
                'registry_id' => $registryId,
                'directory' => $directory,
                'enabled' => $enabled,
                'facility_id' => $facilityId,
                'actor_user_id' => $actorUserId,
            ]),
            0
        );

        return [
            'registry_id' => $registryId,
            'directory' => $directory,
            'enabled' => $enabled,
            'warning' => $warning,
            'catalog' => $this->getCatalog($facilityId),
        ];
    }

    /**
     * @return list<string>
     */
    private function bundleFormdirs(int $facilityId): array
    {
        $formdirs = [];
        $board = $this->bundle->getBoard($facilityId);
        foreach ($board['rows'] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $configured = strtolower(trim((string) ($row['configured_formdir'] ?? $row['formdir'] ?? '')));
            $resolved = strtolower(trim((string) ($row['formdir'] ?? '')));
            if ($configured !== '') {
                $formdirs[] = $configured;
            }
            if ($resolved !== '') {
                $formdirs[] = $resolved;
            }
        }

        return array_values(array_unique($formdirs));
    }

    /**
     * @param list<string> $bundleFormdirs
     */
    private function matchesBundleFormdir(string $directory, array $bundleFormdirs): bool
    {
        $resolved = strtolower($this->catalog->resolveRegistryDirectory($directory));
        foreach ($bundleFormdirs as $bundleDir) {
            if ($directory === $bundleDir || $resolved === $bundleDir) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array{blocked: bool, reason: ?string}
     */
    private function disableGuard(string $directory, int $facilityId): array
    {
        $directory = strtolower(trim($directory));
        $resolved = strtolower($this->catalog->resolveRegistryDirectory($directory));

        if (
            $directory === 'vitals'
            && $this->config->getInt('enable_triage', 1, $facilityId) === 1
        ) {
            return [
                'blocked' => true,
                'reason' => 'Cannot disable vitals while triage is enabled (M3-F05).',
            ];
        }

        $consultNote = strtolower(trim((string) ($this->config->get('consult_note_formdir', 'soap', $facilityId) ?? 'soap')));
        if ($consultNote === '') {
            $consultNote = 'soap';
        }
        $consultResolved = strtolower($this->catalog->resolveRegistryDirectory($consultNote));
        if ($directory === $consultNote || $resolved === $consultResolved || $directory === $consultResolved) {
            return [
                'blocked' => true,
                'reason' => 'Cannot disable the consult note form while doctor workflow and payment gates are active.',
            ];
        }

        return ['blocked' => false, 'reason' => null];
    }

    private function enableWarning(string $directory): ?string
    {
        $directory = strtolower(trim($directory));
        if (in_array($directory, self::FEE_SHEET_FORMDIRS, true)) {
            return 'Fee sheet forms are hidden for clinic roles — use Cashier Desk (M5) or Bill Ops (M14) instead.';
        }

        return null;
    }
}

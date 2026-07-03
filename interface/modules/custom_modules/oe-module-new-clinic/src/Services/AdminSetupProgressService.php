<?php

/**
 * M15-F11 — Setup wizard progress (checklist + score)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class AdminSetupProgressService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly CashClinicProfileService $cashProfile = new CashClinicProfileService(),
        private readonly FeeScheduleAdminService $feeSchedule = new FeeScheduleAdminService(),
        private readonly VisitTypeAdminService $visitTypes = new VisitTypeAdminService(),
        private readonly ReconciliationService $reconciliation = new ReconciliationService(),
        private readonly AdminHealthService $health = new AdminHealthService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getProgress(int $facilityId): array
    {
        if ($facilityId < 0) {
            $facilityId = 0;
        }

        $manual = $this->manualCompletions($facilityId);
        $items = $this->buildItems($facilityId, $manual);
        $score = 0;
        foreach ($items as $item) {
            if (!empty($item['completed'])) {
                $score += (int) ($item['weight'] ?? 0);
            }
        }

        $setupComplete = $this->config->getInt('admin_hub_setup_complete', 0, $facilityId) === 1;

        return [
            'setup_complete' => $setupComplete,
            'score_percent' => min(100, $score),
            'items' => $items,
            'can_mark_complete' => $score >= 70 && !$setupComplete,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function markItemComplete(string $checklistKey, int $facilityId, int $actorUserId): array
    {
        $checklistKey = strtolower(trim($checklistKey));
        if ($checklistKey === '') {
            throw new \InvalidArgumentException('checklist_key required');
        }

        if (!in_array($checklistKey, $this->manualKeys(), true)) {
            throw new \InvalidArgumentException('This checklist item cannot be marked manually');
        }

        QueryUtils::sqlStatementThrowException(
            'INSERT INTO admin_hub_setup_progress (facility_id, checklist_key, completed_at, completed_by)
             VALUES (?, ?, NOW(), ?)
             ON DUPLICATE KEY UPDATE completed_at = NOW(), completed_by = VALUES(completed_by)',
            [$facilityId, $checklistKey, $actorUserId]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic_config',
            'admin_hub.setup_progress',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode([
                'facility_id' => $facilityId,
                'checklist_key' => $checklistKey,
                'actor_user_id' => $actorUserId,
            ]),
            0
        );

        return $this->getProgress($facilityId);
    }

    /**
     * @return array<string, mixed>
     */
    public function markSetupComplete(int $facilityId, int $actorUserId): array
    {
        $progress = $this->getProgress($facilityId);
        if ((int) ($progress['score_percent'] ?? 0) < 70) {
            throw new \InvalidArgumentException('Complete at least 70% of setup checklist before marking done');
        }

        $this->config->set('admin_hub_setup_complete', '1', $facilityId);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic_config',
            'admin_hub.setup_complete',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode([
                'facility_id' => $facilityId,
                'actor_user_id' => $actorUserId,
                'score_percent' => $progress['score_percent'] ?? 0,
            ]),
            0
        );

        return $this->getProgress($facilityId);
    }

    /**
     * @param array<string, string> $manual
     * @return list<array<string, mixed>>
     */
    private function buildItems(int $facilityId, array $manual): array
    {
        $cashApplied = (bool) ($this->cashProfile->getProfileStatus($facilityId)['applied'] ?? false);
        $feeCount = count(array_filter(
            $this->feeSchedule->listForAdmin($facilityId),
            static fn (array $row): bool => !empty($row['is_active'])
        ));
        $visitTypeCount = count(array_filter(
            $this->visitTypes->listForAdmin(
                $facilityId,
                (int) ($this->config->get('default_visit_type_id', '0', $facilityId) ?? '0')
            ),
            static fn (array $row): bool => (int) ($row['pc_catid'] ?? 0) > 0
        ));
        $reconcileRun = $this->reconciliation->getLatestRun($facilityId);
        $health = $this->health->getHealthStatus($facilityId);
        $backupOk = false;
        foreach ($health['chips'] ?? [] as $chip) {
            if (($chip['key'] ?? '') === 'backup' && ($chip['status'] ?? '') === 'ok') {
                $backupOk = true;
                break;
            }
        }

        $defs = [
            [
                'key' => 'cash_profile',
                'label' => 'Cash clinic profile applied',
                'weight' => 10,
                'completed' => $cashApplied,
                'manual' => false,
                'hint' => 'Clinic tab → Apply cash clinic profile',
            ],
            [
                'key' => 'fee_lines',
                'label' => 'At least 3 active fee lines',
                'weight' => 10,
                'completed' => $feeCount >= 3,
                'manual' => false,
                'hint' => 'Fees tab → add starter schedule',
            ],
            [
                'key' => 'visit_types',
                'label' => 'Visit type linked to calendar',
                'weight' => 10,
                'completed' => $visitTypeCount >= 1,
                'manual' => false,
                'hint' => 'Visit types tab → map pc_catid',
            ],
            [
                'key' => 'staff_accounts',
                'label' => 'Staff accounts (owner + reception + doctor)',
                'weight' => 15,
                'completed' => isset($manual['staff_accounts']),
                'manual' => true,
                'hint' => 'People → create three role templates',
            ],
            [
                'key' => 'acl_installed',
                'label' => 'New Clinic ACL installed',
                'weight' => 10,
                'completed' => isset($manual['acl_installed']),
                'manual' => true,
                'hint' => 'Module Manager §17.4 step 4',
            ],
            [
                'key' => 'cron_configured',
                'label' => 'Cron / nightly jobs configured',
                'weight' => 10,
                'completed' => isset($manual['cron_configured'])
                    || (
                        $this->config->getInt('enable_scheduled_integration', 1, $facilityId) === 1
                        && $this->config->getInt('reconciliation_enabled', 1, $facilityId) === 1
                    ),
                'manual' => true,
                'hint' => 'Clinic tab → reconciliation schedule + host crontab',
            ],
            [
                'key' => 'reconciliation_test',
                'label' => 'Reconciliation test run',
                'weight' => 10,
                'completed' => is_array($reconcileRun) && !empty($reconcileRun['run_date']),
                'manual' => false,
                'hint' => 'System tab → Run reconcile now',
            ],
            [
                'key' => 'backup_test',
                'label' => 'Backup test run',
                'weight' => 10,
                'completed' => $backupOk,
                'manual' => false,
                'hint' => 'System tab → Run backup',
            ],
            [
                'key' => 'worksheet_recorded',
                'label' => 'Pilot worksheet Q4–Q9 recorded',
                'weight' => 10,
                'completed' => isset($manual['worksheet_recorded']),
                'manual' => true,
                'hint' => 'PRD §24.4 worksheet',
            ],
            [
                'key' => 'g12_drill',
                'label' => 'G12 safety drill signed (week 1)',
                'weight' => 5,
                'completed' => isset($manual['g12_drill']),
                'manual' => true,
                'hint' => 'Training log §17.2',
            ],
        ];

        return $defs;
    }

    /**
     * @return list<string>
     */
    private function manualKeys(): array
    {
        return [
            'staff_accounts',
            'acl_installed',
            'cron_configured',
            'worksheet_recorded',
            'g12_drill',
        ];
    }

    /**
     * @return array<string, string>
     */
    private function manualCompletions(int $facilityId): array
    {
        try {
            $rows = QueryUtils::fetchRecords(
                'SELECT checklist_key, completed_at FROM admin_hub_setup_progress WHERE facility_id = ?',
                [$facilityId]
            ) ?: [];
        } catch (\Throwable) {
            return [];
        }

        $map = [];
        foreach ($rows as $row) {
            $key = strtolower(trim((string) ($row['checklist_key'] ?? '')));
            if ($key !== '') {
                $map[$key] = (string) ($row['completed_at'] ?? '');
            }
        }

        return $map;
    }
}

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
use OpenEMR\Modules\NewClinic\AclVersion;

class AdminSetupProgressService
{
    /** Minimum weighted score before "Mark setup complete" is allowed. */
    public const COMPLETE_THRESHOLD = 70;

    /** Log the missing-progress-table warning at most once per request. */
    private static bool $manualTableWarned = false;

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
     * @param array<string, mixed>|null $health Pre-computed health status to reuse.
     *        getHealthStatus() runs a COUNT over the multi-million-row `log` table
     *        (~0.5-1s); the settings payload already computes it, so pass it in to
     *        avoid running that scan a second time on the same request.
     * @return array<string, mixed>
     */
    public function getProgress(int $facilityId, ?array $health = null): array
    {
        if ($facilityId < 0) {
            $facilityId = 0;
        }

        $manual = $this->manualCompletions($facilityId);
        $items = $this->buildItems($facilityId, $manual, $health);
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
            'score_threshold' => self::COMPLETE_THRESHOLD,
            'items' => $items,
            'can_mark_complete' => $score >= self::COMPLETE_THRESHOLD && !$setupComplete,
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
            throw new \InvalidArgumentException(xl('This step checks itself automatically and cannot be ticked by hand.'));
        }

        QueryUtils::sqlStatementThrowException(
            'INSERT INTO admin_hub_setup_progress (facility_id, checklist_key, completed_at, completed_by)
             VALUES (?, ?, NOW(), ?)
             ON DUPLICATE KEY UPDATE completed_at = NOW(), completed_by = VALUES(completed_by)',
            [$facilityId, $checklistKey, $actorUserId]
        );

        $this->audit('admin_hub.setup_progress', [
            'facility_id' => $facilityId,
            'checklist_key' => $checklistKey,
            'actor_user_id' => $actorUserId,
        ]);

        return $this->getProgress($facilityId);
    }

    /**
     * Undo a mistaken manual tick.
     *
     * @return array<string, mixed>
     */
    public function unmarkItem(string $checklistKey, int $facilityId, int $actorUserId): array
    {
        $checklistKey = strtolower(trim($checklistKey));
        if ($checklistKey === '') {
            throw new \InvalidArgumentException('checklist_key required');
        }

        if (!in_array($checklistKey, $this->manualKeys(), true)) {
            throw new \InvalidArgumentException(xl('This step checks itself automatically and cannot be unticked by hand.'));
        }

        QueryUtils::sqlStatementThrowException(
            'DELETE FROM admin_hub_setup_progress WHERE facility_id = ? AND checklist_key = ?',
            [$facilityId, $checklistKey]
        );

        $this->audit('admin_hub.setup_unmark', [
            'facility_id' => $facilityId,
            'checklist_key' => $checklistKey,
            'actor_user_id' => $actorUserId,
        ]);

        return $this->getProgress($facilityId);
    }

    /**
     * @return array<string, mixed>
     */
    public function markSetupComplete(int $facilityId, int $actorUserId): array
    {
        $progress = $this->getProgress($facilityId);
        if ((int) ($progress['score_percent'] ?? 0) < self::COMPLETE_THRESHOLD) {
            throw new \InvalidArgumentException(xl('Finish at least 70% of the checklist before marking setup complete.'));
        }

        $this->config->set('admin_hub_setup_complete', '1', $facilityId);

        $this->audit('admin_hub.setup_complete', [
            'facility_id' => $facilityId,
            'actor_user_id' => $actorUserId,
            'score_percent' => $progress['score_percent'] ?? 0,
        ]);

        return $this->getProgress($facilityId);
    }

    /**
     * Flip a completed setup back to in-progress (nothing else changes —
     * every tick and auto-check keeps its state).
     *
     * @return array<string, mixed>
     */
    public function reopenSetup(int $facilityId, int $actorUserId): array
    {
        $this->config->set('admin_hub_setup_complete', '0', $facilityId);

        $this->audit('admin_hub.setup_reopen', [
            'facility_id' => $facilityId,
            'actor_user_id' => $actorUserId,
        ]);

        return $this->getProgress($facilityId);
    }

    /**
     * @param array<string, mixed> $manual
     * @param array<string, mixed>|null $health Reuse a pre-computed health status when available.
     * @return array<int, array<string, mixed>>
     */
    private function buildItems(int $facilityId, array $manual, ?array $health = null): array
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
        $health ??= $this->health->getHealthStatus($facilityId);
        // H3(i) — "tested" must mean tested: the health chip alone can be "ok" off
        // a self-reported "Mark backup complete" click with no artifact at all
        // (H3). The checklist gate instead requires a real native backup that has
        // actually been decrypted and read back as a database dump at least once.
        $backupOk = (bool) ($health['backup_verified_native_run'] ?? false);
        // A real signal, not a config-flag guess: the health cron chip is only
        // "ok" when a scheduled reconciliation run actually completed recently.
        // (The old check keyed off two flags that BOTH default to on, so every
        // fresh install showed cron "configured" with no crontab at all.)
        $cronOk = $this->healthChipOk($health, 'cron');

        return [
            [
                'key' => 'cash_profile',
                'label' => xl('Cash clinic profile applied'),
                'weight' => 10,
                'completed' => $cashApplied,
                'manual' => false,
                'hint' => xl('Open the Clinic tab and press the Apply cash clinic profile button.'),
                'link_tab' => 'clinic',
            ],
            [
                'key' => 'fee_lines',
                'label' => xl('Prices set for at least 3 services'),
                'weight' => 10,
                'completed' => $feeCount >= 3,
                'manual' => false,
                'hint' => xl('Open the Fees tab and add prices for your consultation and common services.'),
                'link_tab' => 'fees',
            ],
            [
                'key' => 'visit_types',
                'label' => xl('At least one visit type ready for booking'),
                'weight' => 10,
                'completed' => $visitTypeCount >= 1,
                'manual' => false,
                'hint' => xl('Open the Visit types tab and check a visit type is linked to the calendar.'),
                'link_tab' => 'types',
            ],
            [
                'key' => 'staff_accounts',
                'label' => xl('Staff sign-ins created (admin, reception, doctor, cashier)'),
                'weight' => 15,
                'completed' => isset($manual['staff_accounts']) || $this->staffAccountsReady(),
                'manual' => true,
                'ticked' => isset($manual['staff_accounts']),
                'hint' => xl('Open People & access and create a sign-in for each role. One person can hold more than one role.'),
                'link_tab' => 'people',
            ],
            [
                'key' => 'acl_installed',
                'label' => xl('Access permissions installed'),
                'weight' => 10,
                'completed' => isset($manual['acl_installed']) || $this->aclInstalled(),
                'manual' => true,
                'ticked' => isset($manual['acl_installed']),
                'hint' => xl('Run the access-control install step from the module install guide, or ask the person who set up the server.'),
                'link_tab' => null,
            ],
            [
                'key' => 'cron_configured',
                'label' => xl('Nightly background jobs running'),
                'weight' => 10,
                'completed' => isset($manual['cron_configured']) || $cronOk,
                'manual' => true,
                'ticked' => isset($manual['cron_configured']),
                'hint' => xl('Ask the person who set up the server to schedule the OpenEMR background service AND the New Clinic job worker (scripts/run-jobs.php) — see the "Schedule automatic backups" runbook below for the exact command. This ticks itself after the first overnight run — pressing Run reconcile now does not count, because a manual run does not prove the schedule works.'),
                'link_tab' => null,
            ],
            [
                'key' => 'reconciliation_test',
                'label' => xl('End-of-day cash check tested'),
                'weight' => 10,
                'completed' => is_array($reconcileRun) && !empty($reconcileRun['run_date']),
                'manual' => false,
                'hint' => xl('Press Run reconcile now in System health below.'),
                'link_tab' => 'system',
            ],
            [
                'key' => 'backup_test',
                'label' => xl('Backup tested (verified restorable)'),
                'weight' => 10,
                'completed' => $backupOk,
                'manual' => false,
                'hint' => xl('Turn on native encrypted backup, press Run backup, then press Verify latest backup in System health below. Marking a backup complete by hand does not count — this needs a real file that has actually been checked.'),
                'link_tab' => 'system',
            ],
            [
                'key' => 'worksheet_recorded',
                'label' => xl('Go-live worksheet recorded'),
                'weight' => 10,
                'completed' => isset($manual['worksheet_recorded']),
                'manual' => true,
                'ticked' => isset($manual['worksheet_recorded']),
                'hint' => xl('Record the go-live answers with your trainer — the runbook below walks through it.'),
                'link_tab' => null,
                'link_anchor' => 'nc-admin-runbooks',
            ],
            [
                'key' => 'g12_drill',
                'label' => xl('Wrong-patient safety drill done'),
                'weight' => 5,
                'completed' => isset($manual['g12_drill']),
                'manual' => true,
                'ticked' => isset($manual['g12_drill']),
                'hint' => xl('Walk the team through the wrong-patient check during the first week — the drill runbook below has the steps.'),
                'link_tab' => null,
                'link_anchor' => 'nc-admin-runbooks',
            ],
        ];
    }

    /** True when the given health chip reports "ok". */
    private function healthChipOk(array $health, string $chipKey): bool
    {
        foreach ($health['chips'] ?? [] as $chip) {
            if (($chip['key'] ?? '') === $chipKey) {
                return ($chip['status'] ?? '') === 'ok';
            }
        }

        return false;
    }

    /** True when the module's ACL schema is installed at the current version. */
    private function aclInstalled(): bool
    {
        try {
            $row = QueryUtils::querySingleRow(
                "SELECT acl_version FROM modules WHERE mod_directory = 'oe-module-new-clinic' LIMIT 1",
                []
            );
        } catch (\Throwable) {
            return false;
        }

        return AclVersion::isSatisfiedBy(is_array($row) ? (string) ($row['acl_version'] ?? '') : '');
    }

    /**
     * True when each core role group (admin, reception, doctor, cashier) has
     * at least one active member. Cashier is core because this is a cash
     * clinic — nobody can take payment without it. One person holding several
     * groups (solo operator, D-STAFF-1) satisfies this.
     */
    private function staffAccountsReady(): bool
    {
        try {
            $rows = QueryUtils::fetchRecords(
                "SELECT g.value AS group_key, COUNT(DISTINCT u.id) AS n
                 FROM gacl_aro_groups g
                 INNER JOIN gacl_groups_aro_map m ON m.group_id = g.id
                 INNER JOIN gacl_aro a ON a.id = m.aro_id AND a.section_value = 'users'
                 INNER JOIN users u ON u.username = a.value AND u.active = 1
                 WHERE g.value IN ('new_admin', 'new_reception', 'new_doctor', 'new_cashier')
                 GROUP BY g.value",
                []
            ) ?: [];
        } catch (\Throwable) {
            return false;
        }

        $present = [];
        foreach ($rows as $row) {
            if ((int) ($row['n'] ?? 0) > 0) {
                $present[(string) $row['group_key']] = true;
            }
        }

        return isset(
            $present['new_admin'],
            $present['new_reception'],
            $present['new_doctor'],
            $present['new_cashier']
        );
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
        } catch (\Throwable $e) {
            // A missing/broken progress table must not be invisible — the old
            // blanket catch made every manual item look permanently un-done
            // with no signal anywhere.
            if (!self::$manualTableWarned) {
                self::$manualTableWarned = true;
                error_log('New Clinic setup checklist: could not read admin_hub_setup_progress — ' . $e->getMessage());
            }

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

    /** @param array<string, mixed> $detail */
    private function audit(string $action, array $detail): void
    {
        EventAuditLogger::getInstance()->newEvent(
            'new_clinic_config',
            $action,
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode($detail),
            0
        );
    }
}

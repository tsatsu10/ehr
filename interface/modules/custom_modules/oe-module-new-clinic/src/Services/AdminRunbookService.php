<?php

/**
 * M15-F10 — Day-2 admin runbooks (RB-01–RB-21)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class AdminRunbookService
{
    /**
     * @return array<string, mixed>
     */
    public function getCatalog(): array
    {
        $webroot = (string) ($GLOBALS['webroot'] ?? '');
        $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
        $adminHub = $modulePublic . 'admin.php';
        $peopleLegacy = $modulePublic . 'admin-people-legacy.php';

        $cards = [
            $this->card(
                'RB-01',
                'Day 2',
                'Verify backup ran',
                'System',
                'Open System health, run or confirm backup, copy off-site.',
                $adminHub . '?tab=system'
            ),
            $this->card(
                'RB-02',
                'Day 2',
                'Reconcile yesterday',
                'Clinic / M7',
                'Run reconciliation from System health or Clinic tab.',
                $adminHub . '?tab=system'
            ),
            $this->card(
                'RB-03',
                'Day 2',
                'Review open visits EOD',
                'M7',
                'Check Daily Reports open-visits widget before close.',
                $modulePublic . 'reports.php'
            ),
            $this->card(
                'RB-04',
                'Week 1',
                'Wrong-patient drill refresh',
                'Training',
                'Repeat PRD §17.2.2 wrong-patient drill with reception.',
                null
            ),
            $this->card(
                'RB-05',
                'Any',
                'Add new receptionist',
                'People',
                'Create user with Reception template — People → Add staff.',
                $adminHub . '?tab=people&sub=staff'
            ),
            $this->card(
                'RB-06',
                'Any',
                'Doctor locum account',
                'People',
                'Doctor template + license field; land on Doctor Desk.',
                $adminHub . '?tab=people&sub=staff'
            ),
            $this->card(
                'RB-07',
                'Any',
                'Deactivate leaving staff',
                'People',
                'Disable login; do not delete audit history.',
                $adminHub . '?tab=people&sub=staff'
            ),
            $this->card(
                'RB-08',
                'Any',
                'Reset forgotten password',
                'People',
                'Use Reset password on the Staff tab — require manager approval.',
                $adminHub . '?tab=people&sub=staff&view=reset-password'
            ),
            $this->card(
                'RB-09',
                'Monthly',
                'Update fee prices',
                'Fees',
                'Export backup, edit default prices, spot-check at Cashier.',
                $adminHub . '?tab=fees'
            ),
            $this->card(
                'RB-10',
                'Any',
                'Add new fee line / service',
                'Fees',
                'Add code in Fees tab; verify receipt preview.',
                $adminHub . '?tab=fees'
            ),
            $this->card(
                'RB-11',
                'Any',
                'Unlock signed clinical note',
                'Forms',
                'Documentation correction only — use core unlock + re-sign.',
                $adminHub . '?tab=forms'
            ),
            $this->card(
                'RB-12',
                'Any',
                'Merge duplicate patients',
                'Advanced',
                'Use stock duplicate patient merge tool.',
                $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/admin-merge-legacy.php'
            ),
            $this->card(
                'RB-13',
                'Post-pilot',
                'Enable lab ops hub',
                'Clinic',
                'Turn on lab role + Lab Ops; run M12 setup wizard.',
                $adminHub . '?tab=clinic'
            ),
            $this->card(
                'RB-14',
                'Post-pilot',
                'Enable pharmacy ops',
                'Clinic',
                'Turn on pharmacy role + Pharm Ops; run receive stock setup.',
                $adminHub . '?tab=clinic'
            ),
            $this->card(
                'RB-15',
                'Post-pilot',
                'Enable billing back office',
                'Clinic',
                'Enable Bill Ops after pilot; train on corrections.',
                $adminHub . '?tab=clinic'
            ),
            $this->card(
                'RB-16',
                'Quarterly',
                'Review override audit',
                'M7',
                'Audit completion overrides and E-Sign exceptions.',
                $modulePublic . 'reports.php'
            ),
            $this->card(
                'RB-17',
                'Quarterly',
                'Review user access',
                'People',
                'Confirm each active user still needs their desk ACLs.',
                $adminHub . '?tab=people&sub=access'
            ),
            $this->card(
                'RB-18',
                'Yearly',
                'Renew SSL / certificates',
                'System',
                'Renew HTTPS cert before expiry; test login.',
                $adminHub . '?tab=system'
            ),
            $this->card(
                'RB-19',
                'Any',
                'Restore from backup',
                'System',
                'Disaster recovery — do NOT use the stock backup screen (it does not know about '
                . 'this module\'s encrypted archives). Follow '
                . 'Documentation/NewClinic/NEW_CLINIC_BACKUP_RESTORE_RUNBOOK.md: decrypt with '
                . 'scripts/backup-decrypt.php + your recovery-key bundle, restore into a SCRATCH '
                . 'database first, verify, then cut over.',
                $adminHub . '?tab=system'
            ),
            $this->card(
                'RB-20',
                'Module upgrade',
                'Run Upgrade SQL',
                'Module Manager',
                'After module update, run SQL upgrade from Module Manager.',
                $webroot . '/interface/modules/zend_modules/public/Installer'
            ),
            $this->card(
                'RB-21',
                'Go-live',
                'Record the go-live worksheet',
                'Training',
                'With your trainer, walk the opening-week questions: who covers each desk, '
                . 'daily cash float and till-close routine, what to do when the internet or '
                . 'power drops, and who to call for support. Write the answers down, then '
                . 'tick "Go-live worksheet recorded" on the Setup checklist.',
                $adminHub . '?tab=setup'
            ),
            $this->card(
                'RB-22',
                'Go-live',
                'Schedule automatic backups',
                'System',
                'A logged-in browser tab is NOT enough on a desk-only clinic (New Clinic desks '
                . 'skip the legacy tab shell the heartbeat needs). After setting "Automatic backup '
                . 'frequency" in System health, schedule the job worker to actually run it — '
                . 'preferred, runs backups plus the module\'s other background jobs: '
                . 'Windows Task Scheduler (daily) → Program "C:\\xampp\\php\\php.exe", Arguments '
                . '"C:\\xampp\\htdocs\\openemr\\interface\\modules\\custom_modules\\oe-module-new-clinic\\'
                . 'scripts\\run-jobs.php --max-seconds=55"; Linux cron → '
                . '"* * * * * php /path/to/oe-module-new-clinic/scripts/run-jobs.php --max-seconds=55". '
                . 'Backup-only alternative: scripts/backup-scheduled.php on the same schedulers. '
                . 'Confirm it is really firing: System health shows "Last scheduled attempt" under '
                . 'Backup & logs — if that never appears, the task is not actually running.',
                $adminHub . '?tab=system'
            ),
        ];

        return [
            'cards' => $cards,
            'source' => 'ADMIN_CONFIGURATION §14',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function card(
        string $id,
        string $when,
        string $task,
        string $lens,
        string $summary,
        ?string $deepLink
    ): array {
        return [
            'id' => $id,
            'when' => $when,
            'task' => $task,
            'lens' => $lens,
            'summary' => $summary,
            'deep_link' => $deepLink,
            'search_text' => strtolower($id . ' ' . $when . ' ' . $task . ' ' . $lens . ' ' . $summary),
        ];
    }
}

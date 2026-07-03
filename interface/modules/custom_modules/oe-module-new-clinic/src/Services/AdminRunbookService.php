<?php

/**
 * M15-F10 — Day-2 admin runbooks (RB-01–RB-20)
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
        $adminHub = $modulePublic . 'admin-hub/';

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
                'Create user, assign Reception template — not Administrators.',
                $webroot . '/interface/usergroup/usergroup_admin.php'
            ),
            $this->card(
                'RB-06',
                'Any',
                'Doctor locum account',
                'People',
                'Doctor template + license field; land on Doctor Desk.',
                $webroot . '/interface/usergroup/usergroup_admin.php'
            ),
            $this->card(
                'RB-07',
                'Any',
                'Deactivate leaving staff',
                'People',
                'Disable login; do not delete audit history.',
                $webroot . '/interface/usergroup/usergroup_admin.php'
            ),
            $this->card(
                'RB-08',
                'Any',
                'Reset forgotten password',
                'People',
                'Use stock user admin — require manager approval.',
                $webroot . '/interface/usergroup/usergroup_admin_add.php'
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
                $webroot . '/interface/patient_file/merge_patients.php'
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
                $webroot . '/interface/usergroup/usergroup_admin.php'
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
                'Disaster recovery — restore DB + sites folder on staging first.',
                $webroot . '/interface/main/backup.php'
            ),
            $this->card(
                'RB-20',
                'Module upgrade',
                'Run Upgrade SQL',
                'Module Manager',
                'After module update, run SQL upgrade from Module Manager.',
                $webroot . '/interface/modules/zend_modules/public/Installer'
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

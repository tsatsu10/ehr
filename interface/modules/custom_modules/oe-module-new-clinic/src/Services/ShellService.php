<?php

/**
 * T1 shell context for New Clinic pages
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Bootstrap;

class ShellService
{
    /** @var array<string, array{id: string, label: string, path: string, acos: array<int, string>, config?: string}> */
    private const NAV_ITEMS = [
        [
            'id' => 'clinicfd',
            'label' => 'Front Desk',
            'path' => 'front-desk.php',
            'acos' => ['new_reception'],
        ],
        [
            'id' => 'clinictg',
            'label' => 'Triage',
            'path' => 'triage.php',
            'acos' => ['new_nurse'],
            'config' => 'enable_triage',
        ],
        [
            'id' => 'clinicdr',
            'label' => 'Doctor',
            'path' => 'doctor.php',
            'acos' => ['new_doctor'],
        ],
        [
            'id' => 'clinicl',
            'label' => 'Lab',
            'path' => 'lab.php',
            'acos' => ['new_lab'],
            'config' => 'enable_lab_role',
        ],
        [
            'id' => 'cliniclabops',
            'label' => 'Lab Ops',
            'path' => 'lab-ops/index.php',
            'acos' => ['new_lab_ops', 'new_lab', 'new_lab_lead', 'new_doctor', 'new_admin'],
            'config' => 'enable_lab_ops',
        ],
        [
            'id' => 'clinicph',
            'label' => 'Pharmacy',
            'path' => 'pharmacy.php',
            'acos' => ['new_pharmacy'],
            'config' => 'enable_pharmacy_role',
        ],
        [
            'id' => 'cliniccs',
            'label' => 'Cashier',
            'path' => 'cashier.php',
            'acos' => ['new_cashier'],
        ],
        [
            'id' => 'clinicvb',
            'label' => 'Visit Board',
            'path' => 'visit-board.php',
            'acos' => [
                'new_reception', 'new_nurse', 'new_doctor', 'new_lab',
                'new_pharmacy', 'new_cashier', 'new_admin', 'reports',
            ],
        ],
        [
            'id' => 'clinicrp',
            'label' => 'Reports',
            'path' => 'reports.php',
            'acos' => ['reports'],
        ],
        [
            'id' => 'clinicad',
            'label' => 'Clinic Setup',
            'path' => 'admin.php',
            'acos' => ['new_admin'],
        ],
        [
            'id' => 'clinicmsg',
            'label' => 'Messages',
            'path' => 'communications.php',
            'acos' => [],
            'core_acl' => ['patients', 'notes'],
            'config' => 'communications_hub_enable',
        ],
        [
            'id' => 'clinicreg',
            'label' => 'Registry',
            'path' => 'patient-registry.php',
            'acos' => ['new_registry', 'new_doctor', 'new_nurse', 'new_admin'],
            'config' => 'enable_patient_registry',
        ],
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly SessionRoleService $sessionRole = new SessionRoleService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function buildContext(string $pageAco, ?string $activeNavId = null): array
    {
        global $GLOBALS;

        $sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
        $facilityId = $this->visitScope->resolveDeskFacilityId($sessionFacility);
        $activeRole = $this->sessionRole->getActiveRole($pageAco);
        $roleMeta = SessionRoleService::ROLE_META[$activeRole] ?? SessionRoleService::ROLE_META['new_reception'];
        $userId = (int) ($_SESSION['authUserID'] ?? 0);
        $user = $userId > 0
            ? (QueryUtils::querySingleRow(
                'SELECT fname, lname, username FROM users WHERE id = ?',
                [$userId]
            ) ?: [])
            : [];

        $publicBase = $GLOBALS['webroot'] . Bootstrap::MODULE_INSTALLATION_PATH . '/public/';

        return [
            'shell' => [
                'brand' => $this->buildBrand($facilityId),
                'user' => [
                    'first_name' => (string) ($user['fname'] ?? ''),
                    'last_name' => (string) ($user['lname'] ?? ''),
                    'username' => (string) ($user['username'] ?? ''),
                    'initials' => $this->initials(
                        (string) ($user['fname'] ?? ''),
                        (string) ($user['lname'] ?? '')
                    ),
                ],
                'role' => [
                    'aco' => $activeRole,
                    'label' => xlt($roleMeta['label']),
                    'desk_label' => xlt($roleMeta['desk_label']),
                    'accent' => $roleMeta['accent'],
                    'available' => $this->sessionRole->listAvailableRoles(),
                ],
                'nav' => $this->buildNav($publicBase, $activeNavId ?? $this->acoToNavId($pageAco)),
                'queue_stats' => $this->buildQueueStats($facilityId),
                'today_label' => $this->formatTodayLabel(),
                'logout_url' => $GLOBALS['webroot'] . '/interface/logout.php',
                'profile_url' => $GLOBALS['webroot'] . '/interface/usergroup/user_info.php',
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildBrand(int $facilityId): array
    {
        global $GLOBALS;

        $clinicName = (string) ($GLOBALS['openemr_name'] ?? 'Clinic');
        $facilityName = '';
        if ($facilityId > 0) {
            $facility = QueryUtils::querySingleRow(
                'SELECT name FROM facility WHERE id = ?',
                [$facilityId]
            );
            $facilityName = is_array($facility) ? (string) ($facility['name'] ?? '') : '';
        }

        $logoPath = $this->config->get('clinic_logo_path', null, $facilityId);
        $logoUrl = null;
        if (!empty($logoPath)) {
            $logoUrl = $GLOBALS['webroot'] . '/' . ltrim((string) $logoPath, '/');
        }

        return [
            'clinic_name' => $clinicName,
            'facility_name' => $facilityName,
            'show_facility' => !empty($GLOBALS['login_into_facility']) && $facilityName !== '',
            'logo_url' => $logoUrl,
            'initials' => $this->initialsFromWords($clinicName),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildNav(string $publicBase, string $activeNavId): array
    {
        $items = [];
        foreach (self::NAV_ITEMS as $item) {
            if (!empty($item['config'])) {
                $defaultOn = $item['config'] === 'enable_triage';
                if (!$this->config->isEnabled($item['config'], $defaultOn ? 1 : 0)) {
                    continue;
                }
            }

            if (!empty($item['core_acl'])) {
                if (!AclMain::aclCheckCore($item['core_acl'][0], $item['core_acl'][1])) {
                    continue;
                }
            } elseif (!$this->userHasAnyAco($item['acos'])) {
                continue;
            }

            $items[] = [
                'id' => $item['id'],
                'label' => xlt($item['label']),
                'url' => $publicBase . $item['path'],
                'active' => $item['id'] === $activeNavId,
            ];
        }

        return $items;
    }

    /**
     * @param array<int, string> $acos
     */
    private function userHasAnyAco(array $acos): bool
    {
        foreach ($acos as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildQueueStats(int $facilityId): array
    {
        $counts = $this->queueService->getCounts($facilityId);
        $stats = [
            ['key' => 'waiting', 'label' => xlt('Waiting'), 'count' => $counts['waiting'] ?? 0],
            ['key' => 'triage', 'label' => xlt('Triage'), 'count' => $counts['triage'] ?? 0],
            ['key' => 'doctor', 'label' => xlt('Doctor'), 'count' => $counts['doctor'] ?? 0],
            ['key' => 'payment', 'label' => xlt('Pay'), 'count' => $counts['payment'] ?? 0],
            ['key' => 'done', 'label' => xlt('Done'), 'count' => $counts['done'] ?? 0],
        ];

        if ($this->config->isEnabled('enable_lab_role', 0)) {
            array_splice($stats, 3, 0, [[
                'key' => 'lab',
                'label' => xlt('Lab'),
                'count' => $counts['lab'] ?? 0,
            ]]);
        }

        if ($this->config->isEnabled('enable_pharmacy_role', 0)) {
            $insertAt = $this->config->isEnabled('enable_lab_role', 0) ? 4 : 3;
            array_splice($stats, $insertAt, 0, [[
                'key' => 'pharmacy',
                'label' => xlt('Pharm'),
                'count' => $counts['pharmacy'] ?? 0,
            ]]);
        }

        return $stats;
    }

    private function acoToNavId(string $aco): string
    {
        $meta = SessionRoleService::ROLE_META[$aco] ?? null;
        if (!empty($meta['nav_id'])) {
            return (string) $meta['nav_id'];
        }

        return 'clinicfd';
    }

    private function formatTodayLabel(): string
    {
        return date('D d M Y') . ' · ' . date('H:i');
    }

    private function initials(string $first, string $last): string
    {
        $a = mb_substr(trim($first), 0, 1);
        $b = mb_substr(trim($last), 0, 1);
        $out = strtoupper($a . $b);

        return $out !== '' ? $out : '?';
    }

    private function initialsFromWords(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        if (count($parts) === 0) {
            return 'C';
        }
        if (count($parts) === 1) {
            return strtoupper(mb_substr($parts[0], 0, 2));
        }

        return strtoupper(mb_substr($parts[0], 0, 1) . mb_substr($parts[1], 0, 1));
    }
}

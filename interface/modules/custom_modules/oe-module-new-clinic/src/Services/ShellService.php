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
use OpenEMR\Modules\NewClinic\Services\PersonalizedDeskLabelService;

class ShellService
{
    /** @var array<string, array{id: string, label: string, path: string, acos: array<int, string>, group: string, icon: string, badge_key?: string, config?: string, core_acl?: array<int, string>}> */
    private const NAV_ITEMS = [
        [
            'id' => 'clinicfd',
            'label' => 'Front Desk',
            'path' => 'front-desk.php',
            'acos' => ['new_reception'],
            'group' => 'desks',
            'icon' => 'fa-user-clock',
            'badge_key' => 'waiting',
        ],
        [
            'id' => 'clinictg',
            'label' => 'Triage',
            'path' => 'triage.php',
            'acos' => ['new_nurse'],
            'group' => 'desks',
            'icon' => 'fa-heartbeat',
            'badge_key' => 'triage',
            'config' => 'enable_triage',
        ],
        [
            'id' => 'clinicdr',
            'label' => 'Doctor',
            'path' => 'doctor.php',
            'acos' => ['new_doctor'],
            'group' => 'desks',
            'icon' => 'fa-stethoscope',
            'badge_key' => 'doctor',
        ],
        [
            'id' => 'clinicl',
            'label' => 'Lab',
            'path' => 'lab.php',
            'acos' => ['new_lab'],
            'group' => 'desks',
            'icon' => 'fa-flask',
            'badge_key' => 'lab',
            'config' => 'enable_lab_role',
        ],
        [
            'id' => 'clinicph',
            'label' => 'Pharmacy',
            'path' => 'pharmacy.php',
            'acos' => ['new_pharmacy'],
            'group' => 'desks',
            'icon' => 'fa-pills',
            'badge_key' => 'pharmacy',
            'config' => 'enable_pharmacy_role',
        ],
        [
            'id' => 'cliniccs',
            'label' => 'Cashier',
            'path' => 'cashier.php',
            'acos' => ['new_cashier'],
            'group' => 'desks',
            'icon' => 'fa-cash-register',
            'badge_key' => 'payment',
        ],
        [
            'id' => 'cliniclabops',
            'label' => 'Lab Ops',
            'path' => 'lab-ops/index.php',
            'acos' => ['new_lab_ops', 'new_lab', 'new_lab_lead', 'new_doctor', 'new_admin'],
            'group' => 'operations',
            'icon' => 'fa-vials',
            'config' => 'enable_lab_ops',
        ],
        [
            'id' => 'clinicpharmops',
            'label' => 'Pharm Ops',
            'path' => 'pharm-ops/index.php',
            'acos' => ['new_pharm_ops', 'new_pharmacy', 'new_pharmacy_lead', 'new_admin'],
            'group' => 'operations',
            'icon' => 'fa-prescription-bottle-alt',
            'config' => 'enable_pharm_ops',
        ],
        [
            'id' => 'clinicbillops',
            'label' => 'Billing',
            'path' => 'bill-ops/index.php',
            'acos' => [
                'new_bill_ops',
                'new_bill_ops_correct',
                'new_bill_ops_payment',
                'new_bill_ops_close',
                'new_bill_ops_outstanding',
                'new_bill_ops_insurance',
                'new_admin',
            ],
            'group' => 'operations',
            'icon' => 'fa-file-invoice-dollar',
            'config' => 'enable_bill_ops',
        ],
        [
            'id' => 'clinicvb',
            'label' => 'Visit Board',
            'path' => 'visit-board.php',
            'acos' => [
                'new_reception', 'new_nurse', 'new_doctor', 'new_lab',
                'new_pharmacy', 'new_cashier', 'new_admin', 'reports',
            ],
            'group' => 'operations',
            'icon' => 'fa-th-large',
        ],
        [
            'id' => 'clinicscheduling',
            'label' => 'Scheduling',
            'path' => 'scheduling/index.php',
            'acos' => ['new_reception', 'new_reception_lead', 'new_nurse', 'new_admin'],
            'group' => 'operations',
            'icon' => 'fa-calendar-alt',
            'requires_scheduled_integration' => true,
        ],
        [
            'id' => 'clinicrephub',
            'label' => 'Reporting',
            'path' => 'report-hub/index.php',
            'acos' => [
                'new_reports_hub',
                'new_reports_clinical',
                'new_reports_pharmacy',
                'new_reports_financial',
                'new_reports_public_health',
                'new_reports_audit',
                'reports',
                'new_admin',
            ],
            'group' => 'hubs',
            'icon' => 'fa-chart-line',
            'config' => 'enable_report_hub',
        ],
        [
            'id' => 'clinicqueuebridge',
            'label' => 'Queue Bridge',
            'path' => 'queue-bridge/index.php',
            'acos' => [
                'new_queue_bridge',
                'new_reception_lead',
                'new_admin',
            ],
            'group' => 'hubs',
            'icon' => 'fa-random',
            'config' => 'enable_queue_bridge',
        ],
        [
            'id' => 'clinicrp',
            'label' => 'Reports',
            'path' => 'reports.php',
            'acos' => ['reports'],
            'group' => 'hubs',
            'icon' => 'fa-chart-bar',
        ],
        [
            'id' => 'clinicad',
            'label' => 'Clinic Setup',
            'path' => 'admin.php',
            'acos' => ['new_admin'],
            'group' => 'hubs',
            'icon' => 'fa-cog',
        ],
        [
            'id' => 'clinicmsg',
            'label' => 'Messages',
            'path' => 'communications.php',
            'acos' => [],
            'core_acl' => ['patients', 'notes'],
            'group' => 'hubs',
            'icon' => 'fa-envelope',
        ],
        [
            'id' => 'clinicnotes',
            'label' => 'Office Notes',
            'path' => 'office-notes.php',
            'acos' => [],
            'core_acl' => ['encounters', 'notes'],
            'group' => 'hubs',
            'icon' => 'fa-sticky-note',
        ],
        [
            'id' => 'clinicreg',
            'label' => 'Registry',
            'path' => 'patient-registry.php',
            'acos' => ['new_registry', 'new_doctor', 'new_nurse', 'new_admin'],
            'group' => 'hubs',
            'icon' => 'fa-users',
        ],
    ];

    /** @var array<string, string> */
    private const NAV_DESK_ACCENTS = [
        'clinicfd' => 'reception',
        'clinictg' => 'nurse',
        'clinicdr' => 'doctor',
        'clinicl' => 'lab',
        'clinicph' => 'pharmacy',
        'cliniccs' => 'cashier',
        'clinicad' => 'admin',
    ];

    /** @var array<string, string> */
    private const NAV_GROUP_LABELS = [
        'desks' => 'Desks',
        'operations' => 'Operations',
        'hubs' => 'Hubs',
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly SessionRoleService $sessionRole = new SessionRoleService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ScheduledIntegrationService $scheduledIntegration = new ScheduledIntegrationService(),
        private readonly PersonalizedDeskLabelService $deskLabels = new PersonalizedDeskLabelService(),
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
        $counts = $this->queueService->getCounts($facilityId);
        $activeNavId = $activeNavId ?? $this->acoToNavId($pageAco);

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
                    'desk_label' => $this->deskLabels->ownedDeskLabelForAco(
                        $activeRole,
                        (string) ($user['fname'] ?? ''),
                        (string) ($user['username'] ?? '')
                    ),
                    'accent' => $roleMeta['accent'],
                    'available' => $this->buildAvailableRoles(
                        $activeRole,
                        (string) ($user['fname'] ?? ''),
                        (string) ($user['username'] ?? '')
                    ),
                ],
                'nav_groups' => $this->buildNavGroups($publicBase, $activeNavId, $counts),
                'queue_stats' => $this->buildQueueStats($facilityId, $counts),
                'queue_active_total' => $this->sumActiveQueueCounts($counts),
                'today_label' => $this->formatTodayLabel(),
                'logout_url' => $GLOBALS['webroot'] . '/interface/logout.php',
                'profile_url' => $publicBase . 'my-profile.php',
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
     * @param array<string, int> $counts
     * @return array<int, array<string, mixed>>
     */
    private function buildNavGroups(string $publicBase, string $activeNavId, array $counts): array
    {
        /** @var array<string, array<int, array<string, mixed>>> $grouped */
        $grouped = [];
        $deskFacilityId = $this->visitScope->resolveDeskFacilityId();

        foreach (self::NAV_ITEMS as $item) {
            if ($item['id'] === 'clinicrp' && $this->config->isEnabled('enable_report_hub', 0, $deskFacilityId)) {
                continue;
            }

            if (!empty($item['config'])) {
                $defaultOn = $item['config'] === 'enable_triage';
                if (!$this->config->isEnabled($item['config'], $defaultOn ? 1 : 0, $deskFacilityId)) {
                    continue;
                }
            }

            if (!empty($item['requires_scheduled_integration'])
                && !$this->scheduledIntegration->isEnabled($deskFacilityId)) {
                continue;
            }

            if (!empty($item['core_acl'])) {
                if (!AclMain::aclCheckCore($item['core_acl'][0], $item['core_acl'][1])) {
                    continue;
                }
            } elseif (!$this->userHasAnyAco($item['acos'])) {
                continue;
            }

            $badgeKey = $item['badge_key'] ?? null;
            $badgeCount = $badgeKey !== null ? (int) ($counts[$badgeKey] ?? 0) : null;
            $groupKey = $item['group'];

            $grouped[$groupKey][] = [
                'id' => $item['id'],
                'label' => xlt($item['label']),
                'url' => $this->resolveNavUrl($publicBase, $item['path']),
                'active' => $item['id'] === $activeNavId,
                'icon' => $item['icon'],
                'badge_key' => $badgeKey,
                'badge_count' => $badgeCount,
                'accent' => self::NAV_DESK_ACCENTS[$item['id']] ?? null,
            ];
        }

        $groups = [];
        foreach (self::NAV_GROUP_LABELS as $key => $label) {
            if (empty($grouped[$key])) {
                continue;
            }

            $groups[] = [
                'key' => $key,
                'label' => xlt($label),
                'items' => $grouped[$key],
            ];
        }

        return $groups;
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
     * @param array<string, int>|null $counts
     * @return array<int, array<string, mixed>>
     */
    private function buildQueueStats(int $facilityId, ?array $counts = null): array
    {
        $counts = $counts ?? $this->queueService->getCounts($facilityId);
        $stats = [
            ['key' => 'waiting', 'label' => xlt('Waiting'), 'short_label' => xlt('Wait'), 'count' => $counts['waiting'] ?? 0],
            ['key' => 'triage', 'label' => xlt('Triage'), 'short_label' => xlt('Tri'), 'count' => $counts['triage'] ?? 0],
            ['key' => 'doctor', 'label' => xlt('Doctor'), 'short_label' => xlt('Dr'), 'count' => $counts['doctor'] ?? 0],
            ['key' => 'payment', 'label' => xlt('Pay'), 'short_label' => xlt('Pay'), 'count' => $counts['payment'] ?? 0],
            ['key' => 'done', 'label' => xlt('Done'), 'short_label' => xlt('Done'), 'count' => $counts['done'] ?? 0],
        ];

        if ($this->config->isEnabled('enable_lab_role', 0)) {
            array_splice($stats, 3, 0, [[
                'key' => 'lab',
                'label' => xlt('Lab'),
                'short_label' => xlt('Lab'),
                'count' => $counts['lab'] ?? 0,
            ]]);
        }

        if ($this->config->isEnabled('enable_pharmacy_role', 0)) {
            $insertAt = $this->config->isEnabled('enable_lab_role', 0) ? 4 : 3;
            array_splice($stats, $insertAt, 0, [[
                'key' => 'pharmacy',
                'label' => xlt('Pharm'),
                'short_label' => xlt('Rx'),
                'count' => $counts['pharmacy'] ?? 0,
            ]]);
        }

        return $stats;
    }

    /**
     * @param array<string, int> $counts
     */
    private function sumActiveQueueCounts(array $counts): int
    {
        $total = 0;
        foreach (['waiting', 'triage', 'doctor', 'lab', 'pharmacy', 'payment'] as $key) {
            $total += (int) ($counts[$key] ?? 0);
        }

        return $total;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildAvailableRoles(string $activeRole, string $fname, string $username): array
    {
        $roles = [];
        foreach ($this->sessionRole->listAvailableRoles() as $role) {
            $aco = (string) ($role['aco'] ?? '');
            if ($aco === '') {
                continue;
            }

            $roles[] = [
                'aco' => $aco,
                'label' => xlt((string) ($role['label'] ?? $aco)),
                'desk_label' => $this->deskLabels->ownedDeskLabelForAco($aco, $fname, $username),
                'icon' => (string) ($role['icon'] ?? 'fa-user'),
                'accent' => (string) ($role['accent'] ?? 'admin'),
                'is_active' => $aco === $activeRole,
            ];
        }

        return $roles;
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

    /**
     * Resolve the URL for a sidebar nav item.
     *
     * Simple desk pages (.php with no subdirectory) get a clean /clinic/{slug} URL.
     * Sub-directory items (lab-ops/index.php etc.) keep the full module path so their
     * own internal routing is not disturbed.
     */
    private function resolveNavUrl(string $publicBase, string $path): string
    {
        if (str_contains($path, '/')) {
            return $publicBase . $path;
        }

        return ($GLOBALS['webroot'] ?? '') . '/clinic/' . basename($path, '.php');
    }
}

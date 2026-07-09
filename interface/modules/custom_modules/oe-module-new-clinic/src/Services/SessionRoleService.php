<?php

/**
 * Active clinic role session (T1 shared-device safety)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Modules\NewClinic\Bootstrap;

class SessionRoleService
{
    private const SESSION_KEY = 'new_clinic_active_role';

    /** @var array<string, array{label: string, desk_label: string, nav_id: string, path: string, accent: string, icon: string}> */
    public const ROLE_META = [
        'new_reception' => [
            'label' => 'Reception',
            'desk_label' => 'Reception desk',
            'nav_id' => 'clinicfd',
            'path' => 'front-desk.php',
            'accent' => 'reception',
            'icon' => 'fa-user-clock',
        ],
        'new_nurse' => [
            'label' => 'Nurse',
            'desk_label' => 'Triage',
            'nav_id' => 'clinictg',
            'path' => 'triage.php',
            'accent' => 'nurse',
            'icon' => 'fa-heartbeat',
        ],
        'new_doctor' => [
            'label' => 'Doctor',
            'desk_label' => 'Doctor desk',
            'nav_id' => 'clinicdr',
            'path' => 'doctor.php',
            'accent' => 'doctor',
            'icon' => 'fa-stethoscope',
        ],
        'new_lab' => [
            'label' => 'Lab',
            'desk_label' => 'Lab desk',
            'nav_id' => 'clinicl',
            'path' => 'lab.php',
            'accent' => 'lab',
            'icon' => 'fa-flask',
        ],
        'new_pharmacy' => [
            'label' => 'Pharmacy',
            'desk_label' => 'Pharmacy desk',
            'nav_id' => 'clinicph',
            'path' => 'pharmacy.php',
            'accent' => 'pharmacy',
            'icon' => 'fa-pills',
        ],
        'new_cashier' => [
            'label' => 'Cashier',
            'desk_label' => 'Cashier',
            'nav_id' => 'cliniccs',
            'path' => 'cashier.php',
            'accent' => 'cashier',
            'icon' => 'fa-cash-register',
        ],
        'new_admin' => [
            'label' => 'Admin',
            'desk_label' => 'Clinic setup',
            'nav_id' => 'clinicad',
            'path' => 'admin.php',
            'accent' => 'admin',
            'icon' => 'fa-cog',
        ],
        'reports' => [
            'label' => 'Reports',
            'desk_label' => 'Daily reports',
            'nav_id' => 'clinicrp',
            'path' => 'reports.php',
            'accent' => 'admin',
            'icon' => 'fa-chart-bar',
        ],
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function getActiveRole(?string $pageAco = null): string
    {
        if ($pageAco !== null && $this->hasRole($pageAco) && $this->isRoleNavEnabled($pageAco)) {
            $_SESSION[self::SESSION_KEY] = $pageAco;

            return $pageAco;
        }

        $stored = $_SESSION[self::SESSION_KEY] ?? null;
        if (is_string($stored) && $this->hasRole($stored) && $this->isRoleNavEnabled($stored)) {
            return $stored;
        }

        $first = $this->getFirstAvailableRole();
        if ($first !== null) {
            $_SESSION[self::SESSION_KEY] = $first;
        }

        return $first ?? 'new_reception';
    }

    /**
     * Stored role for this session without side effects (role picker
     * "last used" marker — must not auto-select, PRD §4.3.1).
     */
    public function getStoredRole(): ?string
    {
        $stored = $_SESSION[self::SESSION_KEY] ?? null;
        if (is_string($stored) && $this->hasRole($stored) && $this->isRoleNavEnabled($stored)) {
            return $stored;
        }

        return null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listAvailableRoles(): array
    {
        $roles = [];
        foreach (self::ROLE_META as $aco => $meta) {
            if (!$this->hasRole($aco) || !$this->isRoleNavEnabled($aco)) {
                continue;
            }

            $roles[] = array_merge(['aco' => $aco], $meta);
        }

        return $roles;
    }

    /**
     * @return array{redirect_url: string, role: string}
     */
    public function switchRole(string $role, int $actorUserId): array
    {
        if (!isset(self::ROLE_META[$role])) {
            throw new \InvalidArgumentException('Unknown role');
        }

        if (!$this->hasRole($role) || !$this->isRoleNavEnabled($role)) {
            throw new \InvalidArgumentException('Role not permitted');
        }

        $_SESSION[self::SESSION_KEY] = $role;

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'role_switched',
            $actorUserId,
            1,
            'role=' . $role
        );

        $base = Bootstrap::MODULE_INSTALLATION_PATH . '/public/';
        $path = self::ROLE_META[$role]['path'];

        return [
            'role' => $role,
            'redirect_url' => $GLOBALS['webroot'] . $base . $path,
        ];
    }

    public function hasRole(string $aco): bool
    {
        return AclMain::aclCheckCore('new_clinic', $aco);
    }

    private function getFirstAvailableRole(): ?string
    {
        foreach (array_keys(self::ROLE_META) as $aco) {
            if ($this->hasRole($aco) && $this->isRoleNavEnabled($aco)) {
                return $aco;
            }
        }

        return null;
    }

    private function isRoleNavEnabled(string $aco): bool
    {
        return match ($aco) {
            'new_nurse' => $this->config->isEnabled('enable_triage', 1),
            'new_lab' => $this->config->isEnabled('enable_lab_role', 0),
            'new_pharmacy' => $this->config->isEnabled('enable_pharmacy_role', 0),
            default => true,
        };
    }
}

<?php

/**
 * Patient horizontal nav restrictions (T1-F06 + M11-F09)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Menu\PatientMenuEvent;

class PatientMenuRestrictService
{
    /** @var array<int, string> */
    private const MRD_NAV_HIDE = [
        'dashboard',
        'history',
        'sdoc',
    ];

    /** @var array<int, string> */
    private const NEW_CLINIC_DESK_ACLS = [
        'new_reception',
        'new_nurse',
        'new_doctor',
        'new_lab',
        'new_pharmacy',
        'new_cashier',
        'new_admin',
        'reports',
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function applyPatientMenuRestrictions(PatientMenuEvent $event): PatientMenuEvent
    {
        if (!$this->currentUserHasNewClinicRole()) {
            return $event;
        }

        $hiddenIds = $this->resolveHiddenPatientMenuIds();
        if ($hiddenIds === []) {
            return $event;
        }

        $event->setMenu($this->filterPatientMenu($event->getMenu(), $hiddenIds));

        return $event;
    }

    /**
     * @return array<int, string>
     */
    public function resolveHiddenPatientMenuIds(?int $facilityId = null): array
    {
        if (!$this->currentUserHasNewClinicRole()) {
            return [];
        }

        $facilityId = $facilityId ?? $this->visitScope->resolveDefaultFacilityId();
        $hidden = self::MRD_NAV_HIDE;

        if ($this->config->getInt('enable_chart_depth', 0, $facilityId) !== 1) {
            return $hidden;
        }

        if ($this->config->getInt('enable_chart_depth_finance', 0, $facilityId) === 1) {
            $hidden[] = 'ledger';
        }
        if ($this->config->getInt('enable_chart_depth_export', 0, $facilityId) === 1) {
            $hidden[] = 'report';
        }
        if ($this->config->getInt('enable_chart_depth_referral', 0, $facilityId) === 1) {
            $hidden[] = 'transactions';
        }

        return array_values(array_unique($hidden));
    }

    /**
     * @param array<int, object> $menu
     * @param array<int, string> $hiddenIds
     * @return array<int, object>
     */
    public function filterPatientMenu(array $menu, array $hiddenIds): array
    {
        if ($hiddenIds === []) {
            return $menu;
        }

        $filtered = [];
        foreach ($menu as $item) {
            $menuId = (string) ($item->menu_id ?? '');
            if ($menuId !== '' && in_array($menuId, $hiddenIds, true)) {
                continue;
            }

            if (!empty($item->children) && is_array($item->children)) {
                $item->children = $this->filterPatientMenu($item->children, $hiddenIds);
            }

            $filtered[] = $item;
        }

        return $filtered;
    }

    private function currentUserHasNewClinicRole(): bool
    {
        foreach (self::NEW_CLINIC_DESK_ACLS as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return true;
            }
        }

        return false;
    }
}

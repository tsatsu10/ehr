<?php

/**
 * Main menu restrictions (M10 REG-5 — hide legacy Finder for reception)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Menu\MenuEvent;

class MainMenuRestrictService
{
    /** @var array<int, string> Clinical roles that retain legacy Finder (D-CTX-10) */
    private const CLINICAL_FINDER_ACLS = [
        'new_doctor',
        'new_nurse',
        'new_admin',
        'new_registry',
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function applyMainMenuRestrictions(MenuEvent $event): MenuEvent
    {
        $menu = $event->getMenu();

        if ($this->shouldHideFinderForCurrentUser()) {
            $menu = $this->filterMainMenu($menu, ['fin0']);
        }

        if ($this->shouldHideStockLabMenusForCurrentUser()) {
            $menu = $this->filterMainMenu($menu, ['orp1', 'orr1', 'orb0', 'ore0', 'orc0']);
            $menu = $this->filterMainMenuByUrl($menu, [
                '/interface/orders/pending_orders.php',
                '/interface/orders/pending_followup.php',
                '/interface/orders/load_compendium.php',
            ]);
        }

        $event->setMenu($menu);

        return $event;
    }

    public function shouldHideFinderForCurrentUser(?int $facilityId = null): bool
    {
        if (!AclMain::aclCheckCore('new_clinic', 'new_reception')) {
            return false;
        }

        if ($this->currentUserHasClinicalFinderAccess()) {
            return false;
        }

        $facilityId = $facilityId ?? $this->visitScope->resolveDefaultFacilityId();

        return $this->config->isEnabled('enable_patient_registry', 0, $facilityId);
    }

    public function shouldHideStockLabMenusForCurrentUser(?int $facilityId = null): bool
    {
        if (AclMain::aclCheckCore('new_clinic', 'new_admin') || AclMain::aclCheckCore('admin', 'super')) {
            return false;
        }

        if (
            !AclMain::aclCheckCore('new_clinic', 'new_lab')
            && !AclMain::aclCheckCore('new_clinic', 'new_lab_lead')
        ) {
            return false;
        }

        $facilityId = $facilityId ?? $this->visitScope->resolveDefaultFacilityId();

        return $this->config->isEnabled('enable_lab_ops', 0, $facilityId);
    }

    /**
     * @param array<int, object> $menu
     * @param array<int, string> $hiddenUrls
     * @return array<int, object>
     */
    public function filterMainMenuByUrl(array $menu, array $hiddenUrls): array
    {
        if ($hiddenUrls === []) {
            return $menu;
        }

        $filtered = [];
        foreach ($menu as $item) {
            $url = (string) ($item->url ?? '');
            if ($url !== '' && in_array($url, $hiddenUrls, true)) {
                continue;
            }

            if (!empty($item->children) && is_array($item->children)) {
                $item->children = $this->filterMainMenuByUrl($item->children, $hiddenUrls);
            }

            $filtered[] = $item;
        }

        return $filtered;
    }

    /**
     * @param array<int, object> $menu
     * @param array<int, string> $hiddenIds
     * @return array<int, object>
     */
    public function filterMainMenu(array $menu, array $hiddenIds): array
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
                $item->children = $this->filterMainMenu($item->children, $hiddenIds);
            }

            $filtered[] = $item;
        }

        return $filtered;
    }

    private function currentUserHasClinicalFinderAccess(): bool
    {
        foreach (self::CLINICAL_FINDER_ACLS as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return true;
            }
        }

        return false;
    }
}

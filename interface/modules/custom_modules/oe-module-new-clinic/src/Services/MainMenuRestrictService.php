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
    /** @var array<int, string> Stock Fees children hidden when M14 hub is ON (M14-F06) */
    public const STOCK_FEES_MENU_IDS = [
        'cod2', 'cod1', 'pay1', 'bil1', 'bil0', 'npa0', 'eob', 'edi0', 'biltrk0',
    ];

    /** @var array<int, string> Top-level Inventory menu hidden when M13 hub is ON (M13-F13) */
    public const STOCK_PHARM_MENU_IDS = [
        'invimg',
    ];

    /** @var array<int, string> Top-level Reports menu hidden when M16 hub is ON (M16-F07) */
    public const STOCK_REPORTS_MENU_IDS = [
        'repimg',
    ];

    /** @var array<int, string> Visit Forms submenu labels hidden when M17 hub is ON (M17-F07) */
    public const STOCK_VISIT_FORMS_LABELS = [
        'Visit Forms',
    ];

    /**
     * Stock + translated Visit Forms labels for menu cutover (i18n-safe).
     *
     * @return array<int, string>
     */
    public static function visitFormsHiddenLabels(): array
    {
        return array_values(array_unique(array_merge(
            self::STOCK_VISIT_FORMS_LABELS,
            [xl('Visit Forms')]
        )));
    }

    /** @var array<int, string> Stock inventory report URLs hidden when M13 hub is ON (M13-F13) */
    public const STOCK_PHARM_MENU_URLS = [
        '/interface/drugs/drug_inventory.php',
        '/interface/reports/destroyed_drugs_report.php',
        '/interface/reports/inventory_list.php',
        '/interface/reports/inventory_activity.php',
        '/interface/reports/inventory_transactions.php',
    ];

    /** @var array<int, string> Clinic desk ACLs — users with any of these get Fees cutover */
    private const CLINIC_DESK_ACLS = [
        'new_reception', 'new_nurse', 'new_doctor', 'new_lab',
        'new_pharmacy', 'new_cashier',
    ];

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

        if ($this->shouldHideStockFeesMenusForCurrentUser()) {
            $menu = $this->filterMainMenu($menu, self::STOCK_FEES_MENU_IDS);
        }

        if ($this->shouldHideStockPharmMenusForCurrentUser()) {
            $menu = $this->filterMainMenu($menu, self::STOCK_PHARM_MENU_IDS);
            $menu = $this->filterMainMenuByUrl($menu, self::STOCK_PHARM_MENU_URLS);
        }

        if ($this->shouldHideStockReportsMenusForCurrentUser()) {
            $menu = $this->filterMainMenu($menu, self::STOCK_REPORTS_MENU_IDS);
        }

        if ($this->shouldHideStockVisitFormsMenusForCurrentUser()) {
            $menu = $this->filterMainMenuByLabel($menu, self::visitFormsHiddenLabels());
        }

        $menu = $this->pruneEmptyMenuBranches($menu);

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

    public function shouldHideStockFeesMenusForCurrentUser(?int $facilityId = null): bool
    {
        if (AclMain::aclCheckCore('new_clinic', 'new_admin') || AclMain::aclCheckCore('admin', 'super')) {
            return false;
        }

        if (!$this->currentUserHasClinicDeskAcl()) {
            return false;
        }

        $facilityId = $facilityId ?? $this->visitScope->resolveDefaultFacilityId();

        return $this->config->isEnabled('enable_bill_ops', 0, $facilityId);
    }

    public function shouldHideStockPharmMenusForCurrentUser(?int $facilityId = null): bool
    {
        if (AclMain::aclCheckCore('new_clinic', 'new_admin') || AclMain::aclCheckCore('admin', 'super')) {
            return false;
        }

        if (
            !AclMain::aclCheckCore('new_clinic', 'new_pharmacy')
            && !AclMain::aclCheckCore('new_clinic', 'new_pharmacy_lead')
            && !AclMain::aclCheckCore('new_clinic', 'new_pharm_ops')
        ) {
            return false;
        }

        $facilityId = $facilityId ?? $this->visitScope->resolveDefaultFacilityId();

        return $this->config->isEnabled('enable_pharm_ops', 0, $facilityId);
    }

    public function shouldHideStockReportsMenusForCurrentUser(?int $facilityId = null): bool
    {
        if (AclMain::aclCheckCore('new_clinic', 'new_admin') || AclMain::aclCheckCore('admin', 'super')) {
            return false;
        }

        if (!$this->currentUserHasClinicDeskAcl() && !AclMain::aclCheckCore('new_clinic', 'reports')) {
            return false;
        }

        $facilityId = $facilityId ?? $this->visitScope->resolveDefaultFacilityId();

        return $this->config->isEnabled('enable_report_hub', 0, $facilityId);
    }

    public function shouldHideStockVisitFormsMenusForCurrentUser(?int $facilityId = null): bool
    {
        if (AclMain::aclCheckCore('new_clinic', 'new_admin') || AclMain::aclCheckCore('admin', 'super')) {
            return false;
        }

        if (!$this->currentUserHasClinicDeskAcl()) {
            return false;
        }

        $facilityId = $facilityId ?? $this->visitScope->resolveDefaultFacilityId();

        return $this->config->isEnabled('enable_clinical_doc_hub', 0, $facilityId);
    }

    /**
     * @param array<int, object> $menu
     * @param array<int, string> $hiddenLabels
     * @return array<int, object>
     */
    public function filterMainMenuByLabel(array $menu, array $hiddenLabels): array
    {
        if ($hiddenLabels === []) {
            return $menu;
        }

        $filtered = [];
        foreach ($menu as $item) {
            $label = (string) ($item->label ?? '');
            if ($label !== '' && in_array($label, $hiddenLabels, true)) {
                continue;
            }

            if (!empty($item->children) && is_array($item->children)) {
                $item->children = $this->filterMainMenuByLabel($item->children, $hiddenLabels);
            }

            $filtered[] = $item;
        }

        return $filtered;
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

    /**
     * Remove menu nodes that have no URL and no remaining children (e.g. empty Reports → Inventory).
     *
     * @param array<int, object> $menu
     * @return array<int, object>
     */
    public function pruneEmptyMenuBranches(array $menu): array
    {
        $pruned = [];
        foreach ($menu as $item) {
            if (!empty($item->children) && is_array($item->children)) {
                $item->children = $this->pruneEmptyMenuBranches($item->children);
            }

            $hasUrl = (string) ($item->url ?? '') !== '';
            $hasChildren = !empty($item->children) && is_array($item->children) && count($item->children) > 0;
            if (!$hasUrl && !$hasChildren) {
                continue;
            }

            $pruned[] = $item;
        }

        return $pruned;
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

    private function currentUserHasClinicDeskAcl(): bool
    {
        foreach (self::CLINIC_DESK_ACLS as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return true;
            }
        }

        return false;
    }
}

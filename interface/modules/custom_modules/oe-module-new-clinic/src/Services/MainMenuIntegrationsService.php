<?php

/**
 * Main menu integrations — Communications hub URL, global search config (M10/COM)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Menu\MenuEvent;
use OpenEMR\Modules\NewClinic\Bootstrap;

class MainMenuIntegrationsService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly MainMenuRestrictService $menuRestrict = new MainMenuRestrictService(),
    ) {
    }

    public function applyMenuIntegrations(MenuEvent $event): MenuEvent
    {
        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $menu = $event->getMenu();

        if ($this->config->isEnabled('communications_hub_enable', 0, $facilityId)
            && AclMain::aclCheckCore('patients', 'notes')) {
            $hubUrl = Bootstrap::MODULE_INSTALLATION_PATH . '/public/top-redirect.php?dest='
                . rawurlencode('communications.php');
            $this->rewriteMenuUrlById($menu, 'msg0', $hubUrl);
        }

        $event->setMenu($menu);

        return $event;
    }

    /**
     * @return array{redirect: bool, front_desk_url: string}
     */
    public function globalSearchRedirectConfig(?int $facilityId = null): array
    {
        $facilityId = $facilityId ?? $this->visitScope->resolveDefaultFacilityId();
        $redirect = $this->config->isEnabled('registry_redirect_global_search', 0, $facilityId)
            && $this->config->isEnabled('enable_patient_registry', 0, $facilityId)
            && $this->menuRestrict->shouldHideFinderForCurrentUser($facilityId);

        $frontDeskUrl = ($GLOBALS['webroot'] ?? '')
            . Bootstrap::MODULE_INSTALLATION_PATH
            . '/public/top-redirect.php?dest='
            . rawurlencode('front-desk.php');

        return [
            'redirect' => $redirect,
            'front_desk_url' => $frontDeskUrl,
        ];
    }

    /**
     * @param array<int, object> $menu
     */
    private function rewriteMenuUrlById(array &$menu, string $menuId, string $url): void
    {
        foreach ($menu as $item) {
            if ((string) ($item->menu_id ?? '') === $menuId) {
                $item->url = $url;
            }
            if (!empty($item->children) && is_array($item->children)) {
                $this->rewriteMenuUrlById($item->children, $menuId, $url);
            }
        }
    }
}

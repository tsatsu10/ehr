<?php

/**
 * Shared page bootstrap for New Clinic public screens
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Twig\TwigContainer;
use OpenEMR\Core\Header;
use OpenEMR\Core\Kernel;
use OpenEMR\Modules\NewClinic\ModuleAssetVersion;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\MoneyFormatService;
use OpenEMR\Modules\NewClinic\Services\OpenEmrProductRegistrationDismissService;
use OpenEMR\Modules\NewClinic\Services\PageAccessService;
use OpenEMR\Modules\NewClinic\Services\PersonalizedDeskLabelService;
use OpenEMR\Modules\NewClinic\Services\SessionRoleService;
use OpenEMR\Modules\NewClinic\Services\ShellService;
use OpenEMR\Modules\NewClinic\Services\ViteManifestService;
use OpenEMR\Modules\NewClinic\Services\StaffAdminService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

class PageController
{
    public function render(string $template, string $title, string $aco, array $context = []): void
    {
        if (empty($_SESSION['authUserID'])) {
            authLoginScreen();
        }

        if (!AclMain::aclCheckCore('new_clinic', $aco)) {
            http_response_code(403);
            echo xlt('Access denied');
            exit;
        }

        $this->emitPage($template, $title, $aco, $context);
    }

    /**
     * Desk page with a personalized title (e.g. "Doctor Ada's desk").
     *
     * @param array<string, mixed> $context
     */
    public function renderDesk(string $template, string $aco, array $context = []): void
    {
        $title = (new PersonalizedDeskLabelService())->ownedDeskLabelForSessionUser($aco);
        $this->render($template, $title, $aco, $context);
    }

    /**
     * Render for users with core patients/notes ACL (Communications Hub).
     */
    public function renderForCoreNotesAcl(string $template, string $title, array $context = []): void
    {
        if (empty($_SESSION['authUserID'])) {
            authLoginScreen();
        }

        if (!AclMain::aclCheckCore('patients', 'notes')) {
            http_response_code(403);
            echo xlt('Access denied');
            exit;
        }

        $shellAco = $this->resolveShellAcoForNotesUser();
        $this->emitPage($template, $title, $shellAco, $context);
    }

    /**
     * Render for any authenticated OpenEMR user (e.g. My profile).
     *
     * @param array<string, mixed> $context
     */
    public function renderForAuthenticatedUser(string $template, string $title, array $context = []): void
    {
        if (empty($_SESSION['authUserID'])) {
            authLoginScreen();
        }

        $shellAco = (new SessionRoleService())->getActiveRole(null);
        $this->emitPage($template, $title, $shellAco, $context);
    }

    /**
     * @param array<string, mixed> $context
     */
    private function emitPage(string $template, string $title, string $shellAco, array $context): void
    {
        // SEC-5: a staff member given a temporary password must change it before
        // reaching any desk. The my-profile page is exempt (it hosts the change
        // form); once changed, MyProfileService clears the requirement.
        $islandEntry = is_string($context['island_entry'] ?? null) ? $context['island_entry'] : '';
        if (
            !in_array($islandEntry, ['my-profile', 'role-picker'], true)
            && StaffAdminService::passwordChangeRequired((int) ($_SESSION['authUserID'] ?? 0))
        ) {
            $webroot = $GLOBALS['webroot'] ?? '';
            header(
                'Location: ' . $webroot
                . '/interface/modules/custom_modules/oe-module-new-clinic/public/my-profile.php?force_password=1'
            );
            exit;
        }

        ob_start();
        Header::setupHeader(['common']);
        $headerHtml = ob_get_clean();

        $kernel = new Kernel();
        $twig = (new TwigContainer(
            dirname(__DIR__, 2) . '/templates',
            $kernel
        ))->getTwig();

        $visitScope = new VisitScopeService();
        $sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
        $deskFacilityId = $visitScope->resolveDeskFacilityId($sessionFacility);
        $deskFacilityFallback = !empty($_SESSION['nc_desk_facility_fallback']);
        if ($deskFacilityFallback) {
            unset($_SESSION['nc_desk_facility_fallback']);
        }

        (new OpenEmrProductRegistrationDismissService())->dismissIfPrompting($deskFacilityId);

        $deskConfig = new ClinicConfigService();
        $moneyFormat = new MoneyFormatService();

        // When a page declares its island entry, resolve the full CSS set
        // (own + shared-chunk) from the Vite manifest so no styles are dropped.
        $islandCss = [];
        $islandJs = null;
        if (!empty($context['island_entry']) && is_string($context['island_entry'])) {
            $islandCss = (new ViteManifestService())->cssFilesForIsland($context['island_entry']);
            $islandJs = !empty($context['island_js']) && is_string($context['island_js'])
                ? $context['island_js']
                : $context['island_entry'];
        }

        echo $twig->render($template, array_merge([
            'island_css' => $islandCss,
            'island_js' => $islandJs,
            'page_title' => $title,
            'header_html' => $headerHtml,
            'ajax_url' => $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public/ajax.php',
            'webroot' => $GLOBALS['webroot'],
            'assets_url' => $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public/assets',
            'module_url' => $GLOBALS['webroot'] . '/interface/modules/custom_modules/oe-module-new-clinic/public',
            'csrf_token' => CsrfUtils::collectCsrfToken(),
            'asset_version' => ModuleAssetVersion::VERSION,
            'desk_facility_id' => $deskFacilityId,
            'desk_facility_fallback' => $deskFacilityFallback,
            'enable_shared_device_session_warning' => $deskConfig->isEnabled(
                'enable_shared_device_session_warning',
                0,
                $deskFacilityId
            ),
            'queue_poll_ms' => $deskConfig->resolveQueuePollIntervalMs($deskFacilityId),
            'currency_format' => $moneyFormat->getFormatPayload($deskFacilityId),
        ], (new ShellService())->buildContext($shellAco, $context['shell_nav_id'] ?? null), $context));
    }

    private function resolveShellAcoForNotesUser(): string
    {
        $deskAcos = [
            'new_reception', 'new_nurse', 'new_doctor', 'new_lab',
            'new_pharmacy', 'new_cashier', 'new_admin', 'reports',
        ];
        foreach ($deskAcos as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return $aco;
            }
        }

        return 'new_reception';
    }

    /**
     * @param array<int, string> $acos
     */
    public function renderForAnyClinicRole(string $template, string $title, array $acos, array $context = []): void
    {
        if (empty($_SESSION['authUserID'])) {
            authLoginScreen();
        }

        $allowedAco = null;
        foreach ($acos as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                $allowedAco = $aco;
                break;
            }
        }

        if ($allowedAco === null) {
            http_response_code(403);
            echo xlt('Access denied');
            exit;
        }

        $this->render($template, $title, $allowedAco, $context);
    }

    /**
     * Render when access is granted by feature ACLs (chart depth, etc.), not desk roles only.
     *
     * @param array<int, string> $featureAcos Ordered ACL identifiers; first match wins for shell context.
     */
    public function renderForAnyAcl(string $template, string $title, array $featureAcos, array $context = []): void
    {
        if (empty($_SESSION['authUserID'])) {
            authLoginScreen();
        }

        $pageAccess = new PageAccessService();
        $allowedAco = $pageAccess->resolveFirstGrantedAco($featureAcos);
        if ($allowedAco === null) {
            http_response_code(403);
            echo xlt('Access denied');
            exit;
        }

        $shellAco = $pageAccess->resolveShellAco($allowedAco);
        $this->render($template, $title, $shellAco, $context);
    }
}

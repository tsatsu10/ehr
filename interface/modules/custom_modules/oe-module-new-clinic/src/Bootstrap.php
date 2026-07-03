<?php

/**
 * New Clinic module bootstrap
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic;

use OpenEMR\Common\Logging\SystemLogger;
use OpenEMR\Common\Twig\TwigContainer;
use OpenEMR\Core\Kernel;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Events\Core\TwigEnvironmentEvent;
use OpenEMR\Events\Main\Tabs\RenderEvent;
use OpenEMR\Menu\MenuEvent;
use OpenEMR\Menu\PatientMenuEvent;
use OpenEMR\Modules\NewClinic\Services\EncounterIdentityStripService;
use OpenEMR\Modules\NewClinic\Services\HistoryEditorWrapService;
use OpenEMR\Modules\NewClinic\Services\LegacyChartContextService;
use OpenEMR\Modules\NewClinic\Services\DeepLinkRestoreSessionService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeFlowBoardService;
use OpenEMR\Modules\NewClinic\GlobalConfig;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\MainMenuIntegrationsService;
use OpenEMR\Modules\NewClinic\Services\MainMenuRestrictService;
use OpenEMR\Modules\NewClinic\Services\PatientMenuRestrictService;
use OpenEMR\Modules\NewClinic\Services\ScheduledIntegrationService;
use stdClass;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Twig\Error\LoaderError;
use Twig\Loader\FilesystemLoader;

class Bootstrap
{
    public const MODULE_INSTALLATION_PATH = '/interface/modules/custom_modules/oe-module-new-clinic';
    public const MODULE_NAME = 'oe-module-new-clinic';

    private readonly string $moduleDirectoryName;
    private readonly string $modulePath;
    private readonly SystemLogger $logger;
    private readonly GlobalConfig $globalsConfig;
    private $twig;

    public function __construct(
        private readonly EventDispatcherInterface $eventDispatcher,
        ?Kernel $kernel = null
    ) {
        global $GLOBALS;

        if (empty($kernel)) {
            $kernel = new Kernel();
        }

        $this->moduleDirectoryName = basename(dirname(__DIR__));
        $this->modulePath = dirname(__DIR__);
        $this->logger = new SystemLogger();
        $this->globalsConfig = new GlobalConfig($GLOBALS);

        $twigContainer = new TwigContainer($this->getTemplatePath(), $kernel);
        $this->twig = $twigContainer->getTwig();
    }

    public function subscribeToEvents(): void
    {
        $this->registerTemplateEvents();
        $this->registerEncounterIdentityStrip();
        $this->registerHistoryEditorWrap();
        $this->registerLegacyChartContextStrip();
        $this->registerQueueBridgeFlowBoard();
        $this->registerDeepLinkRestoreSession();

        if (!$this->globalsConfig->isModuleActive()) {
            return;
        }

        $this->registerMenuItems();
        $this->registerMainMenuIntegrations();
        $this->registerMainMenuRestrictions();
        $this->registerPatientMenuRestrictions();
        $this->registerGlobalSearchRedirect();
    }

    public function getTemplatePath(): string
    {
        return $this->modulePath . DIRECTORY_SEPARATOR . 'templates';
    }

    public function getPublicPath(): string
    {
        return OEGlobalsBag::getInstance()->get('web_root') . self::MODULE_INSTALLATION_PATH . '/public';
    }

    private function registerTemplateEvents(): void
    {
        $this->eventDispatcher->addListener(
            TwigEnvironmentEvent::EVENT_CREATED,
            $this->addTemplateLoader(...)
        );
    }

    private function registerEncounterIdentityStrip(): void
    {
        (new \OpenEMR\Modules\NewClinic\Support\EncounterIdentityStripInjector(
            new EncounterIdentityStripService($this->twig)
        ))->startIfNeeded();
    }

    private function registerHistoryEditorWrap(): void
    {
        (new \OpenEMR\Modules\NewClinic\Support\HistoryEditorWrapInjector(
            new HistoryEditorWrapService($this->twig)
        ))->startIfNeeded();
    }

    private function registerLegacyChartContextStrip(): void
    {
        (new \OpenEMR\Modules\NewClinic\Support\LegacyChartContextInjector(
            new LegacyChartContextService($this->twig)
        ))->startIfNeeded();
    }

    private function registerQueueBridgeFlowBoard(): void
    {
        (new \OpenEMR\Modules\NewClinic\Support\QueueBridgeFlowBoardInjector(
            new QueueBridgeFlowBoardService()
        ))->startIfNeeded();
    }

    private function registerDeepLinkRestoreSession(): void
    {
        (new \OpenEMR\Modules\NewClinic\Support\DeepLinkRestoreSessionInjector(
            new DeepLinkRestoreSessionService()
        ))->startIfNeeded();
    }

    public function addTemplateLoader(TwigEnvironmentEvent $event): void
    {
        try {
            $twig = $event->getTwigEnvironment();
            if ($twig === $this->twig) {
                return;
            }
            $loader = $twig->getLoader();
            if ($loader instanceof FilesystemLoader) {
                $loader->prependPath($this->getTemplatePath());
            }
        } catch (LoaderError $error) {
            $this->logger->errorLogCaller('NewClinic: template loader failed', [
                'message' => $error->getMessage(),
            ]);
        }
    }

    private function registerMenuItems(): void
    {
        $this->eventDispatcher->addListener(MenuEvent::MENU_UPDATE, $this->addClinicMenu(...));
    }

    public function addClinicMenu(MenuEvent $event): MenuEvent
    {
        $menu = $event->getMenu();
        $base = self::MODULE_INSTALLATION_PATH . '/public/';
        $topRedirectBase = $base . 'top-redirect.php?dest=';

        $clinicMenu = new stdClass();
        $clinicMenu->requirement = 0;
        $clinicMenu->target = 'clinic0';
        $clinicMenu->menu_id = 'clinic0';
        $clinicMenu->label = xlt('Clinic');
        $clinicMenu->icon = 'fa-hospital';
        $clinicMenu->children = [];
        $clinicMenu->acl_req = [];
        $clinicMenu->global_req = [];

        $deskAclOr = static fn (string $aco): array => ['new_clinic', $aco];

        $items = [
            ['id' => 'clinicfd', 'label' => 'Front Desk', 'url' => $base . 'front-desk.php', 'acl' => $deskAclOr('new_reception')],
            [
                'id' => 'clinicscheduling',
                'label' => 'Scheduling & Flow',
                'url' => $base . 'scheduling/index.php',
                'direct' => true,
                'acl' => [
                    $deskAclOr('new_reception'),
                    $deskAclOr('new_reception_lead'),
                    $deskAclOr('new_nurse'),
                    $deskAclOr('new_admin'),
                ],
                'config' => 'enable_scheduling_redesign',
            ],
            ['id' => 'clinicvb', 'label' => 'Visit Board', 'url' => $base . 'visit-board.php', 'acl' => [
                $deskAclOr('new_reception'),
                $deskAclOr('new_nurse'),
                $deskAclOr('new_doctor'),
                $deskAclOr('new_lab'),
                $deskAclOr('new_pharmacy'),
                $deskAclOr('new_cashier'),
                $deskAclOr('new_admin'),
                $deskAclOr('reports'),
            ]],
            ['id' => 'clinictg', 'label' => 'Triage', 'url' => $base . 'triage.php', 'acl' => $deskAclOr('new_nurse'), 'config' => 'enable_triage'],
            ['id' => 'clinicdr', 'label' => 'Doctor Desk', 'url' => $base . 'doctor.php', 'acl' => $deskAclOr('new_doctor')],
            ['id' => 'clinicl', 'label' => 'Lab Desk', 'url' => $base . 'lab.php', 'acl' => $deskAclOr('new_lab'), 'config' => 'enable_lab_role'],
            ['id' => 'clinicph', 'label' => 'Pharmacy Desk', 'url' => $base . 'pharmacy.php', 'acl' => $deskAclOr('new_pharmacy'), 'config' => 'enable_pharmacy_role'],
            ['id' => 'cliniccs', 'label' => 'Cashier', 'url' => $base . 'cashier.php', 'acl' => $deskAclOr('new_cashier')],
            [
                'id' => 'cliniclabops',
                'label' => 'Lab Ops',
                'url' => $base . 'lab-ops/index.php',
                'direct' => true,
                'acl' => [
                    $deskAclOr('new_lab_ops'),
                    $deskAclOr('new_lab'),
                    $deskAclOr('new_admin'),
                ],
                'config' => 'enable_lab_ops',
            ],
            [
                'id' => 'clinicpharmops',
                'label' => 'Pharm Ops',
                'url' => $base . 'pharm-ops/index.php',
                'direct' => true,
                'acl' => [
                    $deskAclOr('new_pharm_ops'),
                    $deskAclOr('new_pharmacy'),
                    $deskAclOr('new_admin'),
                ],
                'config' => 'enable_pharm_ops',
            ],
            [
                'id' => 'clinicbillops',
                'label' => 'Billing',
                'url' => $base . 'bill-ops/index.php',
                'direct' => true,
                'acl' => [
                    $deskAclOr('new_bill_ops'),
                    $deskAclOr('new_admin'),
                ],
                'config' => 'enable_bill_ops',
            ],
            [
                'id' => 'clinicrephub',
                'label' => 'Reporting',
                'url' => $base . 'report-hub/index.php',
                'direct' => true,
                'acl' => [
                    $deskAclOr('new_reports_hub'),
                    $deskAclOr('reports'),
                    $deskAclOr('new_admin'),
                ],
                'config' => 'enable_report_hub',
            ],
            [
                'id' => 'clinicqueuebridge',
                'label' => 'Queue Bridge',
                'url' => $base . 'queue-bridge/index.php',
                'direct' => true,
                'acl' => [
                    $deskAclOr('new_queue_bridge'),
                    $deskAclOr('new_reception_lead'),
                    $deskAclOr('new_admin'),
                ],
                'config' => 'enable_queue_bridge',
            ],
            [
                'id' => 'clinicdochub',
                'label' => 'Documentation',
                'url' => $base . 'clinical-doc/index.php',
                'direct' => true,
                'acl' => [
                    $deskAclOr('new_clinical_doc_hub'),
                    $deskAclOr('new_doctor'),
                    $deskAclOr('new_nurse'),
                    $deskAclOr('new_admin'),
                ],
                'config' => 'enable_clinical_doc_hub',
            ],
            ['id' => 'clinicad', 'label' => 'Clinic Setup', 'url' => $base . 'admin.php', 'acl' => $deskAclOr('new_admin')],
            ['id' => 'clinicrp', 'label' => 'Daily Reports', 'url' => $base . 'reports.php', 'acl' => $deskAclOr('reports')],
            ['id' => 'clinicmsg', 'label' => 'Messages', 'url' => $base . 'communications.php', 'acl' => ['patients', 'notes'], 'config' => 'communications_hub_enable'],
            ['id' => 'clinicreg', 'label' => 'Patient Registry', 'url' => $base . 'patient-registry.php', 'acl' => [
                $deskAclOr('new_registry'),
                $deskAclOr('new_doctor'),
                $deskAclOr('new_nurse'),
                $deskAclOr('new_admin'),
            ], 'config' => 'enable_patient_registry'],
        ];

        $config = new ClinicConfigService();
        $webroot = (string) ($GLOBALS['webroot'] ?? '');
        $scheduledIntegration = new ScheduledIntegrationService();

        foreach ($items as $item) {
            if ($item['id'] === 'clinicrp' && $config->isEnabled('enable_report_hub', 0)) {
                continue;
            }

            if (!empty($item['config'])) {
                $defaultOn = $item['config'] === 'enable_triage';
                if (!$config->isEnabled($item['config'], $defaultOn ? 1 : 0)) {
                    continue;
                }
                if ($item['config'] === 'enable_scheduling_redesign' && !$scheduledIntegration->isEnabled(0)) {
                    continue;
                }
                if ($item['config'] === 'enable_queue_bridge' && !$scheduledIntegration->isEnabled(0)) {
                    continue;
                }
            }

            $child = new stdClass();
            $child->requirement = 0;
            $child->target = 'clinic0';
            $child->menu_id = $item['id'];
            $child->label = xlt($item['label']);
            $child->url = !empty($item['direct'])
                ? $webroot . $item['url']
                : $topRedirectBase . rawurlencode(basename($item['url']));
            $child->children = [];
            $child->acl_req = $item['acl'];
            $child->global_req = [];
            $clinicMenu->children[] = $child;
        }

        $menu[] = $clinicMenu;
        $event->setMenu($menu);

        return $event;
    }

    private function registerMainMenuIntegrations(): void
    {
        $this->eventDispatcher->addListener(
            MenuEvent::MENU_UPDATE,
            $this->applyMainMenuIntegrations(...)
        );
    }

    public function applyMainMenuIntegrations(MenuEvent $event): MenuEvent
    {
        return (new MainMenuIntegrationsService())->applyMenuIntegrations($event);
    }

    private function registerGlobalSearchRedirect(): void
    {
        $this->eventDispatcher->addListener(
            RenderEvent::EVENT_BODY_RENDER_POST,
            $this->renderGlobalSearchRedirect(...)
        );
    }

    public function renderGlobalSearchRedirect(): void
    {
        $config = (new MainMenuIntegrationsService())->globalSearchRedirectConfig();
        if (empty($config['redirect'])) {
            return;
        }

        $frontDeskUrl = $config['front_desk_url'];
        ?>
        <script>
        (function () {
            var frontDeskUrl = <?php echo json_encode($frontDeskUrl, JSON_THROW_ON_ERROR); ?>;
            var originalFinder = window.viewPtFinder;
            window.viewPtFinder = function (myMessage, searchAnyType, data, event) {
                event.stopImmediatePropagation();
                event.preventDefault();
                var srchBox = document.getElementById('anySearchBox');
                if (!srchBox) {
                    return;
                }
                var q = srchBox.value.trim();
                var url = frontDeskUrl;
                if (q.length > 0) {
                    url += (url.indexOf('?') >= 0 ? '&' : '?') + 'q=' + encodeURIComponent(q);
                }
                if (typeof navigateTab === 'function') {
                    navigateTab(url, 'ncfd', function () {
                        if (typeof activateTabByName === 'function') {
                            activateTabByName('ncfd', true);
                        }
                    });
                } else {
                    top.location = url;
                }
                srchBox.blur();
            };
        }());
        </script>
        <?php
    }

    private function registerMainMenuRestrictions(): void
    {
        $this->eventDispatcher->addListener(
            MenuEvent::MENU_RESTRICT,
            $this->restrictMainMenu(...)
        );
    }

    public function restrictMainMenu(MenuEvent $event): MenuEvent
    {
        return (new MainMenuRestrictService())->applyMainMenuRestrictions($event);
    }

    private function registerPatientMenuRestrictions(): void
    {
        $this->eventDispatcher->addListener(
            PatientMenuEvent::MENU_RESTRICT,
            $this->restrictPatientMenu(...)
        );
    }

    public function restrictPatientMenu(PatientMenuEvent $event): PatientMenuEvent
    {
        return (new PatientMenuRestrictService())->applyPatientMenuRestrictions($event);
    }
}

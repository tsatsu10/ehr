<?php

/**
 * Server-side encounter identity strip for core shortcut pages (T1-F17)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Twig\TwigContainer;
use OpenEMR\Modules\NewClinic\Bootstrap;
use OpenEMR\Modules\NewClinic\GlobalConfig;
use Twig\Environment;

class EncounterIdentityStripService
{
    public const SESSION_KEY = 'new_clinic_identity_strip';

    /** @var list<string> */
    private const BUFFER_SCRIPT_SUFFIXES = [
        '/patient_file/encounter/encounter_top.php',
        '/patient_file/summary/labdata.php',
        '/orders/orders_results.php',
        '/drugs/drug_inventory.php',
    ];

    /** @var array<string, list<string>> */
    private const STRIP_SHORTCUTS = [
        'doctor' => ['encounter', 'lab', 'rx'],
        'lab' => ['orders', 'results'],
        'pharmacy' => ['dispense', 'rx_edit'],
    ];

    /** @var array<string, string> */
    private const DESK_LABELS = [
        'doctor' => 'Doctor Desk',
        'lab' => 'Lab Desk',
        'pharmacy' => 'Pharmacy Desk',
    ];

    /** @var array<string, string> */
    private const DESK_BACK_FILES = [
        'doctor' => 'doctor.php',
        'lab' => 'lab.php',
        'pharmacy' => 'pharmacy.php',
    ];

    public function __construct(
        private readonly ?Environment $twig = null,
        private readonly ?VisitQueueService $visitQueueService = null,
    ) {
    }

    public function markFromShortcut(int $visitId, string $desk, string $shortcut): void
    {
        $desk = strtolower(trim($desk));
        $shortcut = strtolower(trim($shortcut));

        if (!$this->shortcutShowsStrip($desk, $shortcut)) {
            $this->clearContext();

            return;
        }

        $prefix = ($GLOBALS['webroot'] ?? '')
            . Bootstrap::MODULE_INSTALLATION_PATH
            . '/public/';

        $_SESSION[self::SESSION_KEY] = [
            'visit_id' => $visitId,
            'desk' => $desk,
            'back_url' => $prefix . (self::DESK_BACK_FILES[$desk] ?? 'doctor.php'),
            'desk_label' => self::DESK_LABELS[$desk] ?? xl('Desk'),
            'shortcut' => $shortcut,
            'marked_at' => time(),
        ];
    }

    public function clearContext(): void
    {
        unset($_SESSION[self::SESSION_KEY]);
    }

    public function shortcutShowsStrip(string $desk, string $shortcut): bool
    {
        return in_array($shortcut, self::STRIP_SHORTCUTS[$desk] ?? [], true);
    }

    public function shouldBufferCurrentRequest(): bool
    {
        if (!$this->isModuleActive() || !$this->hasActiveContext()) {
            return false;
        }

        return $this->matchesBufferedScript($this->currentScriptName());
    }

    public function shouldRenderForCurrentRequest(): bool
    {
        if (!$this->isModuleActive() || !$this->hasActiveContext()) {
            return false;
        }

        return $this->buildViewModel() !== null;
    }

    public function renderHtml(): string
    {
        $viewModel = $this->buildViewModel();
        if ($viewModel === null) {
            return '';
        }

        $viewModel['asset_css_url'] = ($GLOBALS['webroot'] ?? '')
            . Bootstrap::MODULE_INSTALLATION_PATH
            . '/public/assets/css/new-clinic.css?v='
            . urlencode(\OpenEMR\Modules\NewClinic\ModuleAssetVersion::VERSION);

        return $this->twig()->render('partials/encounter-identity-strip.twig', $viewModel);
    }

    public function injectIntoHtml(string $html, string $stripHtml): string
    {
        if ($stripHtml === '') {
            return $html;
        }

        if (stripos($html, 'id="encounter-identity-strip"') !== false) {
            return $html;
        }

        $replaced = preg_replace('/<body([^>]*)>/i', '<body$1>' . $stripHtml, $html, 1);
        if (is_string($replaced) && $replaced !== $html) {
            return $replaced;
        }

        return $stripHtml . $html;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function buildViewModel(): ?array
    {
        $context = $this->getContext();
        if ($context === null) {
            return null;
        }

        $visitId = (int) ($context['visit_id'] ?? 0);
        $boundVisitId = (int) ($_SESSION['new_clinic_visit_id'] ?? 0);
        if ($visitId <= 0 || $boundVisitId !== $visitId) {
            return null;
        }

        if (!$this->requestMatchesAllowlist()) {
            return null;
        }

        try {
            $visit = $this->queue()->getVisitForActor($visitId);
        } catch (\InvalidArgumentException) {
            return null;
        }

        $sessionPid = (int) ($_SESSION['pid'] ?? 0);
        $sessionEncounter = (int) ($_SESSION['encounter'] ?? 0);
        $visitPid = (int) ($visit['pid'] ?? 0);
        $visitEncounter = (int) ($visit['encounter'] ?? 0);

        if ($sessionPid !== $visitPid || $sessionEncounter <= 0 || $sessionEncounter !== $visitEncounter) {
            return null;
        }

        $patient = QueryUtils::querySingleRow(
            "SELECT fname, lname, pubpid FROM patient_data WHERE pid = ?",
            [$visitPid]
        );
        if (empty($patient)) {
            return null;
        }

        $displayName = trim((string) ($patient['fname'] ?? '') . ' ' . (string) ($patient['lname'] ?? ''));
        if ($displayName === '') {
            $displayName = xl('Patient');
        }

        $deskLabel = (string) ($context['desk_label'] ?? xl('Desk'));

        return [
            'patient_name' => $displayName,
            'mrn' => (string) ($patient['pubpid'] ?? $visitPid),
            'queue_number' => (int) ($visit['queue_number'] ?? 0),
            'encounter' => $visitEncounter,
            'back_url' => (string) ($context['back_url'] ?? ''),
            'back_label' => xl('Back to') . ' ' . $deskLabel,
        ];
    }

    private function hasActiveContext(): bool
    {
        return $this->getContext() !== null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function getContext(): ?array
    {
        $context = $_SESSION[self::SESSION_KEY] ?? null;
        if (!is_array($context)) {
            return null;
        }

        if ((int) ($context['visit_id'] ?? 0) <= 0) {
            return null;
        }

        return $context;
    }

    private function requestMatchesAllowlist(): bool
    {
        $script = $this->currentScriptName();
        if ($this->matchesBufferedScript($script)) {
            return true;
        }

        if ($this->isPrescriptionController($script)) {
            return true;
        }

        return false;
    }

    private function matchesBufferedScript(string $script): bool
    {
        foreach (self::BUFFER_SCRIPT_SUFFIXES as $suffix) {
            if (str_ends_with($script, $suffix)) {
                return true;
            }
        }

        return false;
    }

    private function isPrescriptionController(string $script): bool
    {
        if (!str_ends_with($script, '/controller.php')) {
            return false;
        }

        return isset($_GET['prescription']);
    }

    private function currentScriptName(): string
    {
        $script = (string) ($_SERVER['SCRIPT_NAME'] ?? '');

        return str_replace('\\', '/', $script);
    }

    private function isModuleActive(): bool
    {
        global $GLOBALS;

        return (new GlobalConfig($GLOBALS))->isModuleActive();
    }

    private function queue(): VisitQueueService
    {
        return $this->visitQueueService ?? new VisitQueueService();
    }

    private function twig(): Environment
    {
        if ($this->twig !== null) {
            return $this->twig;
        }

        global $GLOBALS;
        $moduleRoot = dirname(__DIR__, 2);
        $twigContainer = new TwigContainer($moduleRoot . DIRECTORY_SEPARATOR . 'templates', $GLOBALS['kernel']);

        return $twigContainer->getTwig();
    }
}

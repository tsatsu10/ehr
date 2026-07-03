<?php

/**
 * T1 shell on stock History editor (T1-F20b / V1.1-HIST-WRAP)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Twig\TwigContainer;
use OpenEMR\Modules\NewClinic\Bootstrap;
use OpenEMR\Modules\NewClinic\GlobalConfig;
use OpenEMR\Modules\NewClinic\Support\ActivePatientPidResolver;
use OpenEMR\Modules\NewClinic\Support\HistoryEditorWrapGate;
use Twig\Environment;

class HistoryEditorWrapService
{
    public const RETURN_CLINICAL_BACKGROUND = 'clinical-background';

  /** @var array<string, array{tab: string, anchor: string}> */
    private const RETURN_TARGETS = [
        self::RETURN_CLINICAL_BACKGROUND => [
            'tab' => 'clinical',
            'anchor' => 'clinical-background',
        ],
    ];

    private const EDITOR_SUFFIX = HistoryEditorWrapGate::EDITOR_SUFFIX;

    public function __construct(
        private readonly ?Environment $twig = null,
        private readonly ?ClinicConfigService $config = new ClinicConfigService(),
        private readonly ?VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ?ShellService $shellService = new ShellService(),
        private readonly ?LegacyChartContextService $legacyStrip = null,
    ) {
    }

    public function shouldBufferCurrentRequest(): bool
    {
        if (!$this->isWrapEnabled() || !$this->userHasClinicRole()) {
            return false;
        }

        if ($this->resolveActivePid() <= 0) {
            return false;
        }

        return $this->requestMatchesEditor();
    }

    public function shouldWrapBufferedHtml(string $html): bool
    {
        if (!$this->shouldBufferCurrentRequest()) {
            return false;
        }

        if (stripos($html, 'id="oe-nc-history-editor-wrap"') !== false) {
            return false;
        }

        return stripos($html, 'name=\'history_form\'') !== false
            || stripos($html, 'name="history_form"') !== false;
    }

    public function renderWrapHtml(): string
    {
        $pid = $this->resolveActivePid();
        if ($pid <= 0) {
            return '';
        }

        $viewModel = $this->buildViewModel($pid);
        if ($viewModel === null) {
            return '';
        }

        $legacyStrip = '';
        if ($this->legacyStripEnabled()) {
            $legacyStrip = $this->legacyStrip()->renderHtml();
        }

        $viewModel['legacy_strip_html'] = $legacyStrip;
        $viewModel['asset_css_url'] = ($GLOBALS['webroot'] ?? '')
            . Bootstrap::MODULE_INSTALLATION_PATH
            . '/public/assets/css/history-editor-wrap.css?v='
            . urlencode(\OpenEMR\Modules\NewClinic\ModuleAssetVersion::VERSION);

        return $this->twig()->render('partials/history-editor-wrap.twig', $viewModel);
    }

    public function injectIntoHtml(string $html, string $wrapHtml): string
    {
        if ($wrapHtml === '') {
            return $html;
        }

        $backUrl = $this->resolveBackToChartUrl($this->resolveActivePid());
        if ($backUrl !== null) {
            $backButton = '<a class="btn btn-secondary oe-nc-history-editor-wrap__back"'
                . ' href="' . htmlspecialchars($backUrl, ENT_QUOTES, 'UTF-8') . '"'
                . ' target="_top">'
                . htmlspecialchars(xl('Back to chart'), ENT_QUOTES, 'UTF-8')
                . '</a>';
            $html = preg_replace(
                '/(<div class="btn-group">\s*)/',
                '$1' . $backButton . "\n                    ",
                $html,
                1
            ) ?? $html;
        }

        $html = preg_replace(
            '/<body([^>]*)>/i',
            '<body$1 class="oe-nc-history-editor-wrap">',
            $html,
            1
        ) ?? $html;

        if (preg_match('/<body([^>]*)>/i', $html, $matches, PREG_OFFSET_CAPTURE)) {
            $insertAt = $matches[0][1] + strlen($matches[0][0]);
            $html = substr($html, 0, $insertAt) . $wrapHtml . substr($html, $insertAt);
        } else {
            $html = $wrapHtml . $html;
        }

        return $html;
    }

    public function appendReturnParam(string $editorUrl, int $pid): string
    {
        if (!$this->isWrapEnabledForPid($pid)) {
            return $editorUrl;
        }

        $separator = str_contains($editorUrl, '?') ? '&' : '?';

        return $editorUrl . $separator . 'return=' . urlencode(self::RETURN_CLINICAL_BACKGROUND);
    }

    public function resolveBackToChartUrl(int $pid): ?string
    {
        if ($pid <= 0) {
            return null;
        }

        $returnKey = $this->sanitizeReturnKey((string) ($_GET['return'] ?? $_REQUEST['return'] ?? ''));
        if ($returnKey === null) {
            $returnKey = self::RETURN_CLINICAL_BACKGROUND;
        }

        $target = self::RETURN_TARGETS[$returnKey] ?? null;
        if ($target === null) {
            return null;
        }

        $webroot = (string) ($GLOBALS['webroot'] ?? '');

        return $webroot
            . Bootstrap::MODULE_INSTALLATION_PATH
            . '/public/patient-chart.php?pid='
            . urlencode((string) $pid)
            . '&tab='
            . urlencode($target['tab'])
            . '#'
            . $target['anchor'];
    }

    public function displacesLegacyStripOnCurrentRequest(): bool
    {
        return HistoryEditorWrapGate::displacesLegacyStrip($this->config, $this->visitScope);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function buildViewModel(int $pid): ?array
    {
        $shell = $this->shellService->buildContext('new_doctor', 'clinicchart');
        $brand = $shell['shell']['brand'] ?? [];
        $role = $shell['shell']['role'] ?? [];
        $backUrl = $this->resolveBackToChartUrl($pid);

        return [
            'clinic_name' => (string) ($brand['clinic_name'] ?? xl('Clinic')),
            'role_label' => (string) ($role['label'] ?? ''),
            'today_label' => (string) ($shell['shell']['today_label'] ?? ''),
            'page_title' => xl('Edit background history'),
            'breadcrumb_chart' => xl('Chart'),
            'breadcrumb_clinical' => xl('Clinical'),
            'breadcrumb_edit' => xl('Edit background'),
            'back_url' => $backUrl,
            'back_label' => xl('Back to chart'),
            'pid' => $pid,
        ];
    }

    private function resolveActivePid(): int
    {
        return ActivePatientPidResolver::resolve();
    }

    private function isWrapEnabled(): bool
    {
        if (!$this->isModuleActive()) {
            return false;
        }

        $facilityId = $this->visitScope->resolveDefaultFacilityId();

        return $this->config->getInt('enable_history_editor_wrap', 0, $facilityId) === 1;
    }

    private function isWrapEnabledForPid(int $pid): bool
    {
        return $this->isWrapEnabled();
    }

    private function legacyStripEnabled(): bool
    {
        $facilityId = $this->visitScope->resolveDefaultFacilityId();

        return $this->config->getInt('enable_legacy_patient_context_overlay', 0, $facilityId) === 1;
    }

    private function userHasClinicRole(): bool
    {
        foreach (AjaxActionPolicy::CHART_READ_ACLS as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return true;
            }
        }

        return false;
    }

    private function requestMatchesEditor(): bool
    {
        return HistoryEditorWrapGate::requestMatchesEditor();
    }

    private function currentScriptName(): string
    {
        return HistoryEditorWrapGate::currentScriptName();
    }

    private function sanitizeReturnKey(string $raw): ?string
    {
        $raw = strtolower(trim($raw));
        if ($raw === '') {
            return null;
        }

        if (!preg_match('/^[a-z0-9_-]+$/', $raw)) {
            return null;
        }

        return array_key_exists($raw, self::RETURN_TARGETS) ? $raw : null;
    }

    private function isModuleActive(): bool
    {
        global $GLOBALS;

        return (new GlobalConfig($GLOBALS))->isModuleActive();
    }

    private function legacyStrip(): LegacyChartContextService
    {
        return $this->legacyStrip ?? new LegacyChartContextService($this->twig);
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

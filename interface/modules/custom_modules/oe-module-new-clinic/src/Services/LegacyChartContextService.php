<?php

/**
 * Legacy patient context overlay on stock patient_file pages (T1-F18)
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
use OpenEMR\Modules\NewClinic\Support\RequestScriptName;
use Twig\Environment;

class LegacyChartContextService
{
    /** @var list<string> */
    private const ALLOWLIST_SUFFIXES = [
        '/patient_file/summary/demographics.php',
        '/patient_file/summary/stats_full.php',
        '/patient_file/summary/labdata.php',
        '/patient_file/summary/pnotes_full.php',
        '/patient_file/summary/disclosure_full.php',
        '/patient_file/summary/stats.php',
        '/patient_file/summary/documents.php',
        '/patient_file/history/history.php',
        '/patient_file/history/history_full.php',
        '/patient_file/history/history_sdoh_widget.php',
        '/patient_file/report/patient_report.php',
        '/patient_file/transaction/transactions.php',
        '/patient_file/transaction/add_transaction.php',
        '/patient_file/reminder/patient_reminders.php',
        '/reports/pat_ledger.php',
        '/reports/external_data.php',
        '/easipro/pro.php',
        '/controller.php',
        '/interface/forms/load_form.php',
        '/interface/forms/view_form.php',
    ];

    /** @var array<string, string> */
    private const VISIT_STATE_LABELS = [
        'waiting' => 'Waiting',
        'in_triage' => 'In triage',
        'ready_for_doctor' => 'Ready for doctor',
        'with_doctor' => 'With doctor',
        'ready_for_lab' => 'Ready for lab',
        'in_lab' => 'In lab',
        'lab_complete' => 'Lab complete',
        'ready_for_pharmacy' => 'Ready for pharmacy',
        'in_pharmacy' => 'In pharmacy',
        'pharmacy_complete' => 'Pharmacy complete',
        'ready_for_payment' => 'Ready to pay',
    ];

    public function __construct(
        private readonly ?Environment $twig = null,
        private readonly ?PatientContextService $patientContext = null,
        private readonly ?ClinicConfigService $config = new ClinicConfigService(),
        private readonly ?VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function shouldBufferCurrentRequest(): bool
    {
        if (!$this->isOverlayEnabled() || !$this->userHasClinicRole()) {
            return false;
        }

        if ($this->isEmbeddedChartFragment()) {
            return false;
        }

        if ($this->resolveActivePid() <= 0) {
            return false;
        }

        return $this->requestMatchesAllowlist();
    }

    public function shouldRenderForBufferedHtml(string $html): bool
    {
        if (!$this->shouldBufferCurrentRequest()) {
            return false;
        }

        if (stripos($html, 'id="legacy-patient-context-strip"') !== false) {
            return false;
        }

        if (stripos($html, 'id="encounter-identity-strip"') !== false) {
            return false;
        }

        if (stripos($html, 'id="nc-patient-context-banner"') !== false) {
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
            . '/public/assets/css/legacy-chart-strip.css?v='
            . urlencode(\OpenEMR\Modules\NewClinic\ModuleAssetVersion::VERSION);

        return $this->twig()->render('partials/legacy-patient-context-strip.twig', $viewModel);
    }

    public function injectIntoHtml(string $html, string $stripHtml): string
    {
        if ($stripHtml === '') {
            return $html;
        }

        if (preg_match('/<body([^>]*)>/i', $html, $matches, PREG_OFFSET_CAPTURE)) {
            $insertAt = $matches[0][1] + strlen($matches[0][0]);
            return substr($html, 0, $insertAt) . $stripHtml . substr($html, $insertAt);
        }

        return $stripHtml . $html;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function buildViewModel(): ?array
    {
        $pid = $this->resolveActivePid();
        if ($pid <= 0) {
            return null;
        }

        try {
            $actorUserId = (int) ($_SESSION['authUserID'] ?? 0);
            $preview = $this->context()->previewPayload($pid, $actorUserId, 'legacy_chart');
        } catch (\Throwable) {
            return null;
        }

        $patientRow = \OpenEMR\Common\Database\QueryUtils::querySingleRow(
            'SELECT DOB FROM patient_data WHERE pid = ?',
            [$pid]
        );
        $dob = is_array($patientRow) ? (string) ($patientRow['DOB'] ?? '') : '';
        $identity = $preview['identity'] ?? [];
        $identity['dob'] = $dob;
        $activeVisit = $preview['active_visit'] ?? null;
        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        if (is_array($activeVisit) && !empty($activeVisit['visit_id'])) {
            $visitRow = \OpenEMR\Common\Database\QueryUtils::querySingleRow(
                'SELECT facility_id FROM new_visit WHERE id = ?',
                [(int) $activeVisit['visit_id']]
            );
            $visitFacility = is_array($visitRow) ? (int) ($visitRow['facility_id'] ?? 0) : 0;
            if ($visitFacility > 0 && $facilityId > 0 && $visitFacility !== $facilityId) {
                $activeVisit = null;
            }
        }

        $dobLabel = $this->formatDobLabel($identity);
        $stateLabel = null;
        $queueNumber = null;
        if (is_array($activeVisit) && !empty($activeVisit['state'])) {
            $stateLabel = xl(self::VISIT_STATE_LABELS[(string) $activeVisit['state']] ?? (string) $activeVisit['state']);
            $queueNumber = (int) ($activeVisit['queue_number'] ?? 0);
        }

        $safety = $preview['safety'] ?? [];
        $allergyChips = [];
        if ($this->config->getInt('enable_legacy_strip_clinical_chips', 0, $facilityId) === 1) {
            $allergyChips = array_slice((array) ($safety['allergies_severe'] ?? []), 0, 2);
        }

        return [
            'display_name' => (string) ($identity['display_name'] ?? xl('Patient')),
            'initials' => $this->initials((string) ($identity['display_name'] ?? '')),
            'sex' => (string) ($identity['sex'] ?? ''),
            'age_years' => $identity['age_years'] ?? null,
            'mrn' => (string) ($identity['pubpid'] ?? $pid),
            'dob_label' => $dobLabel,
            'dob_estimated' => !empty($identity['dob_estimated']),
            'visit_state_label' => $stateLabel,
            'queue_number' => $queueNumber,
            'allergy_chips' => $allergyChips,
            'show_desk_return' => $this->config->getInt('enable_legacy_strip_desk_return', 1, $facilityId) === 1,
            'module_chart_url' => ($GLOBALS['webroot'] ?? '')
                . Bootstrap::MODULE_INSTALLATION_PATH
                . '/public/patient-chart.php?pid=' . urlencode((string) $pid),
            'enable_chart_depth' => $this->config->getInt('enable_chart_depth', 0, $facilityId) === 1,
            'pid' => $pid,
            'webroot' => (string) ($GLOBALS['webroot'] ?? ''),
        ];
    }

    private function resolveActivePid(): int
    {
        return ActivePatientPidResolver::resolve();
    }

    private function isEmbeddedChartFragment(): bool
    {
        return !empty($_POST['embeddedScreen']) || !empty($_REQUEST['embeddedScreen']);
    }

    private function isOverlayEnabled(): bool
    {
        if (!$this->isModuleActive()) {
            return false;
        }

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

    private function requestMatchesAllowlist(): bool
    {
        $script = RequestScriptName::current();
        if (str_contains($script, '/oe-module-new-clinic/')) {
            return false;
        }

        if (str_ends_with($script, '/main/finder/dynamic_finder.php')) {
            return false;
        }

        if (!empty($_REQUEST['pdf']) || !empty($_REQUEST['export'])) {
            return false;
        }

        if (str_ends_with($script, '/controller.php') && !isset($_GET['prescription'])) {
            return false;
        }

        foreach (self::ALLOWLIST_SUFFIXES as $suffix) {
            if (str_ends_with($script, $suffix)) {
                return true;
            }
        }

        return false;
    }

    private function isModuleActive(): bool
    {
        global $GLOBALS;

        return (new GlobalConfig($GLOBALS))->isModuleActive();
    }

    private function context(): PatientContextService
    {
        return $this->patientContext ?? new PatientContextService();
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

    private function initials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        if (count($parts) === 0 || $parts[0] === '') {
            return '?';
        }
        if (count($parts) === 1) {
            return strtoupper(substr($parts[0], 0, 2));
        }

        return strtoupper(substr($parts[0], 0, 1) . substr($parts[count($parts) - 1], 0, 1));
    }

    private function formatDobLabel(array $identity): ?string
    {
        $dob = (string) ($identity['dob'] ?? '');
        if ($dob === '' || $dob === '0000-00-00') {
            return null;
        }

        try {
            return (new \DateTime($dob))->format('j M Y');
        } catch (\Exception) {
            return null;
        }
    }
}

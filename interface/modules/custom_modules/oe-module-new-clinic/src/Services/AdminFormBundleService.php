<?php

/**
 * M15-F06 — Clinic form bundle status board (install + E-Sign health)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class AdminFormBundleService
{
    /** @var array<int, list<array<string, mixed>>> per-request cache of the (tiny, config-derived) spec list per facility */
    private array $formSpecsCache = [];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly ClinicalDocCatalogService $catalog = new ClinicalDocCatalogService(),
        private readonly ClinicalDocHubLinkService $hubLinks = new ClinicalDocHubLinkService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getBoard(?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId < 0) {
            $facilityId = 0;
        }

        $webroot = $GLOBALS['webroot'] ?? '';
        $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
        $rows = [];
        $missingCount = 0;
        $esignIssues = 0;

        foreach ($this->formSpecs($facilityId) as $spec) {
            $configured = strtolower(trim((string) $spec['formdir']));
            $resolved = $this->catalog->resolveRegistryDirectory($configured);
            $installed = $this->catalog->isFormInstalledAndActive($resolved);
            $esignOk = $installed && $this->isEsignReady($resolved);
            $esignDetail = $this->esignDetail($resolved, $installed, $esignOk);
            if (!$installed) {
                $missingCount++;
            } elseif (!$esignOk) {
                $esignIssues++;
            }

            $rows[] = [
                'key' => $spec['key'],
                'title' => $spec['title'],
                'formdir' => $resolved,
                'configured_formdir' => $configured,
                'required_for' => $spec['required_for'],
                'installed' => $installed,
                'esign_ok' => $esignOk,
                'esign_detail' => $esignDetail,
                'status_label' => $this->statusLabel($installed, $esignOk, $esignDetail),
                'pack_key' => $spec['pack_key'],
                'can_import' => $spec['pack_key'] !== null && !$installed,
                'import_hint' => $spec['import_hint'] ?? null,
            ];
        }

        return [
            'rows' => $rows,
            'esign_globally_enabled' => $this->isEsignGloballyEnabled(),
            'missing_count' => $missingCount,
            'esign_issue_count' => $esignIssues,
            'forms_admin_url' => $webroot . '/interface/forms_admin/forms_admin.php',
            'layout_editor_url' => $webroot . '/interface/super/edit_layout.php',
            'doctor_desk_url' => $modulePublic . 'doctor.php',
            'clinical_doc_hub_enabled' => $this->hubLinks->isHubEnabled($facilityId),
            'clinical_doc_hub_url' => $modulePublic . 'clinical-doc/',
            'test_esign_help' => 'Open Doctor Desk with a test visit, add the form from Clinical Documentation Hub, then sign with your login password.',
        ];
    }

    /**
     * @return list<array{key: string, title: string, formdir: string, required_for: string, pack_key: ?string, import_hint: ?string}>
     */
    private function formSpecs(int $facilityId): array
    {
        if (isset($this->formSpecsCache[$facilityId])) {
            return $this->formSpecsCache[$facilityId];
        }

        $consult = strtolower(trim((string) ($this->config->get('consult_note_formdir', 'soap', $facilityId) ?? 'soap')));
        if ($consult === '') {
            $consult = 'soap';
        }

        return $this->formSpecsCache[$facilityId] = [
            [
                'key' => 'consult_note',
                'title' => 'Consult note',
                'formdir' => $consult,
                'required_for' => 'M4 Complete consult / M5 payment',
                'pack_key' => null,
                'import_hint' => null,
            ],
            [
                'key' => 'vitals',
                'title' => 'Vitals',
                'formdir' => 'vitals',
                'required_for' => 'M3 triage',
                'pack_key' => null,
                'import_hint' => 'Core packaged form — enable in Forms Administration if disabled.',
            ],
            [
                'key' => 'lab_intake',
                'title' => 'Lab intake',
                'formdir' => (string) ($this->config->get('lab_intake_formdir', 'lab_intake', $facilityId) ?? 'lab_intake'),
                'required_for' => 'M8 Lab complete (lab-direct profile)',
                'pack_key' => ClinicalDocAncillaryLbfService::PACK_LAB_INTAKE,
                'import_hint' => 'Run ancillary LBF import (PRD §17.3 step 8).',
            ],
            [
                'key' => 'pharmacy_service',
                'title' => 'Pharmacy service note',
                'formdir' => (string) ($this->config->get('pharmacy_service_formdir', 'pharmacy_service', $facilityId) ?? 'pharmacy_service'),
                'required_for' => 'M9 Pharmacy complete (walk-in profile)',
                'pack_key' => ClinicalDocAncillaryLbfService::PACK_PHARMACY_SERVICE,
                'import_hint' => 'Run ancillary LBF import (PRD §17.3 step 8).',
            ],
        ];
    }

    private function isEsignGloballyEnabled(): bool
    {
        return !empty($GLOBALS['esign_individual']) || !empty($GLOBALS['esign_all']);
    }

    private function isEsignReady(string $formdir): bool
    {
        if (!$this->isEsignGloballyEnabled()) {
            return false;
        }

        $resolved = strtolower(trim($formdir));
        if ($this->isLbfFormdir($resolved)) {
            return $this->lbfLayoutReady($resolved);
        }

        $interfaceRoot = $GLOBALS['fileroot'] . '/interface/forms/' . $resolved;
        if (!is_dir($interfaceRoot)) {
            return false;
        }

        $hasEntryPoint = is_file($interfaceRoot . '/new.php')
            || is_file($interfaceRoot . '/view.php');
        if (!$hasEntryPoint) {
            return false;
        }

        return $this->registrySupportsEsign($resolved);
    }

    private function esignDetail(string $formdir, bool $installed, bool $esignOk): string
    {
        if (!$installed) {
            return 'Form is not registered and active.';
        }
        if ($esignOk) {
            return 'E-Sign globals on and form layout/files are ready.';
        }
        if (!$this->isEsignGloballyEnabled()) {
            return 'Enable E-Sign in Globals → Features.';
        }
        if ($this->isLbfFormdir($formdir)) {
            return 'LBF layout fields missing — run the ancillary LBF import.';
        }

        return 'Registry row or form PHP entry points missing for E-Sign.';
    }

    private function isLbfFormdir(string $formdir): bool
    {
        if (str_starts_with($formdir, 'lbf')) {
            return true;
        }

        foreach ($this->lbfFormIdCandidates($formdir) as $candidate) {
            if ($this->layoutFieldCount($candidate) > 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return list<string>
     */
    private function lbfFormIdCandidates(string $formdir): array
    {
        $formdir = strtolower(trim($formdir));
        if ($formdir === '') {
            return [];
        }

        if (str_starts_with($formdir, 'lbf')) {
            return [$formdir];
        }

        return [$formdir, 'lbf' . $formdir, 'LBF' . $formdir];
    }

    private function lbfLayoutReady(string $formdir): bool
    {
        foreach ($this->lbfFormIdCandidates($formdir) as $candidate) {
            if ($this->layoutFieldCount($candidate) > 0) {
                return true;
            }
        }

        return false;
    }

    private function layoutFieldCount(string $formId): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS cnt FROM layout_options WHERE form_id = ? AND uor > 0',
            [$formId]
        );

        return (int) ($row['cnt'] ?? 0);
    }

    private function registrySupportsEsign(string $formdir): bool
    {
        if (!function_exists('getRegistryEntryByDirectory')) {
            require_once $GLOBALS['fileroot'] . '/library/registry.inc.php';
        }

        $entry = getRegistryEntryByDirectory($formdir, 'aco_spec');
        if (!is_array($entry) || empty($entry['aco_spec'])) {
            return $this->lbfLayoutReady($formdir);
        }

        return true;
    }

    private function statusLabel(bool $installed, bool $esignOk, string $esignDetail): string
    {
        if (!$installed) {
            return 'Missing — not installed or disabled in registry';
        }
        if (!$esignOk) {
            return 'Installed — E-Sign not ready (' . $esignDetail . ')';
        }

        return 'Installed, E-Sign OK';
    }

    /**
     * D-FORM-9 — per-formdir health for M17 catalog enrichment.
     *
     * @return array{installed: bool, esign_ok: bool, status_label: string}|null
     */
    public function getFormHealth(string $formdir, ?int $facilityId = null): ?array
    {
        if ($facilityId === null || $facilityId < 0) {
            $facilityId = 0;
        }

        $needle = strtolower($this->catalog->resolveRegistryDirectory($formdir));
        foreach ($this->formSpecs($facilityId) as $spec) {
            $configured = strtolower(trim((string) $spec['formdir']));
            $resolved = strtolower($this->catalog->resolveRegistryDirectory($configured));
            if ($needle !== $configured && $needle !== $resolved) {
                continue;
            }

            $installed = $this->catalog->isFormInstalledAndActive($resolved);
            $esignOk = $installed && $this->isEsignReady($resolved);
            $esignDetail = $this->esignDetail($resolved, $installed, $esignOk);

            return [
                'installed' => $installed,
                'esign_ok' => $esignOk,
                'esign_detail' => $esignDetail,
                'status_label' => $this->statusLabel($installed, $esignOk, $esignDetail),
            ];
        }

        return null;
    }
}

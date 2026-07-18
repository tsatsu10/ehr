<?php

/**
 * M17 Clinical Documentation Hub — curated form catalog per lens
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class ClinicalDocCatalogService
{
    public const DEFAULT_BUNDLE_KEY = 'ghana_opd_v1';
    public const REFERRAL_HOSPITAL_BUNDLE_KEY = 'referral_hospital_v1';

    /** @var array<int, string> */
    private const BILLING_EXCLUDED = [
        'fee_sheet',
        'misc_billing_options',
        'prior_auth',
        'newpatient',
        'newGroupEncounter',
        'group_attendance',
    ];

    /** @var array<string, list<array{formdir: string, title: string, description: string, kind: string, primary?: bool}>> */
    private const BUNDLE_GHANA_OPD = [
        'consult' => [
            ['formdir' => 'soap', 'title' => 'Consult note', 'description' => 'Main visit story — CC, exam, plan.', 'kind' => 'form', 'primary' => true],
            ['formdir' => 'ghana_opd_consult', 'title' => 'Ghana OPD consult', 'description' => 'Structured OPD template (LBF pack).', 'kind' => 'form'],
            ['formdir' => 'clinical_notes', 'title' => 'Clinical Notes', 'description' => 'Multi-section structured note.', 'kind' => 'form'],
            ['formdir' => 'clinic_note', 'title' => 'Clinic Note', 'description' => 'Short free-text note.', 'kind' => 'form'],
            ['formdir' => 'dictation', 'title' => 'Dictation', 'description' => 'Audio/transcription workflow.', 'kind' => 'form'],
            ['formdir' => 'transfer_summary', 'title' => 'Transfer summary', 'description' => 'Referral narrative.', 'kind' => 'form'],
            ['formdir' => 'nc_certificate', 'title' => 'Medical certificate', 'description' => 'Excuse duty / school note with a verify number.', 'kind' => 'form'],
        ],
        'screening' => [
            ['formdir' => 'phq9', 'title' => 'PHQ-9', 'description' => 'Depression screen.', 'kind' => 'form'],
            ['formdir' => 'gad7', 'title' => 'GAD-7', 'description' => 'Anxiety screen.', 'kind' => 'form'],
        ],
        'nursing' => [
            ['formdir' => 'vitals', 'title' => 'Vitals', 'description' => 'BP, temperature, SpO₂, etc.', 'kind' => 'form'],
            ['formdir' => 'clinical_instructions', 'title' => 'Clinical instructions', 'description' => 'Patient education notes.', 'kind' => 'form'],
            ['formdir' => 'lab_intake', 'title' => 'Lab intake', 'description' => 'Lab-direct visit intake and attestation.', 'kind' => 'form'],
            ['formdir' => 'pharmacy_service', 'title' => 'Pharmacy service note', 'description' => 'Pharmacy walk-in service attestation.', 'kind' => 'form'],
        ],
        'orders' => [
            ['formdir' => 'procedure_order', 'title' => 'Lab orders', 'description' => 'Order labs and imaging.', 'kind' => 'form'],
            ['formdir' => 'rx', 'title' => 'Prescriptions', 'description' => 'Core Rx editor.', 'kind' => 'rx'],
            ['formdir' => 'requisition', 'title' => 'Lab requisition', 'description' => 'Send-out paper requisition.', 'kind' => 'form'],
            ['formdir' => 'note', 'title' => 'Work/school note', 'description' => 'Excuse letter.', 'kind' => 'form'],
        ],
        'specialty' => [
            ['formdir' => 'nc_eye_exam', 'title' => 'Eye exam', 'description' => 'Primary-care eye exam — acuity, pupils, IOP, fundus.', 'kind' => 'form'],
            ['formdir' => 'eye_mag', 'title' => 'Eye exam', 'description' => 'Ophthalmology exam.', 'kind' => 'form'],
            ['formdir' => 'bronchitis', 'title' => 'Bronchitis form', 'description' => 'Acute illness template.', 'kind' => 'form'],
            ['formdir' => 'ankleinjury', 'title' => 'Ankle evaluation', 'description' => 'Orthopedic injury template.', 'kind' => 'form'],
            ['formdir' => 'painmap', 'title' => 'Pain map', 'description' => 'Graphic pain diagram.', 'kind' => 'form'],
            ['formdir' => 'CAMOS', 'title' => 'CAMOS', 'description' => 'Legacy structured note.', 'kind' => 'form'],
        ],
    ];

    /** @var array<string, list<array{formdir: string, title: string, description: string, kind: string, primary?: bool}>> */
    private const BUNDLE_REFERRAL_HOSPITAL = [
        'consult' => [
            ['formdir' => 'referral_opd_consult', 'title' => 'Referral hospital consult', 'description' => 'Extended structured consult for referral centers (LBF pack).', 'kind' => 'form', 'primary' => true],
            ['formdir' => 'soap', 'title' => 'SOAP note', 'description' => 'Legacy four-section note.', 'kind' => 'form'],
            ['formdir' => 'clinical_notes', 'title' => 'Clinical Notes', 'description' => 'Multi-section structured note.', 'kind' => 'form'],
            ['formdir' => 'clinic_note', 'title' => 'Clinic Note', 'description' => 'Short free-text note.', 'kind' => 'form'],
            ['formdir' => 'dictation', 'title' => 'Dictation', 'description' => 'Audio/transcription workflow.', 'kind' => 'form'],
            ['formdir' => 'transfer_summary', 'title' => 'Transfer summary', 'description' => 'Referral narrative.', 'kind' => 'form'],
            ['formdir' => 'nc_certificate', 'title' => 'Medical certificate', 'description' => 'Excuse duty / school note with a verify number.', 'kind' => 'form'],
        ],
        'screening' => [
            ['formdir' => 'phq9', 'title' => 'PHQ-9', 'description' => 'Depression screen.', 'kind' => 'form'],
            ['formdir' => 'gad7', 'title' => 'GAD-7', 'description' => 'Anxiety screen.', 'kind' => 'form'],
        ],
        'nursing' => [
            ['formdir' => 'vitals', 'title' => 'Vitals', 'description' => 'BP, temperature, SpO₂, etc.', 'kind' => 'form'],
            ['formdir' => 'clinical_instructions', 'title' => 'Clinical instructions', 'description' => 'Patient education notes.', 'kind' => 'form'],
            ['formdir' => 'lab_intake', 'title' => 'Lab intake', 'description' => 'Lab-direct visit intake and attestation.', 'kind' => 'form'],
            ['formdir' => 'pharmacy_service', 'title' => 'Pharmacy service note', 'description' => 'Pharmacy walk-in service attestation.', 'kind' => 'form'],
        ],
        'orders' => [
            ['formdir' => 'procedure_order', 'title' => 'Lab orders', 'description' => 'Order labs and imaging.', 'kind' => 'form'],
            ['formdir' => 'rx', 'title' => 'Prescriptions', 'description' => 'Core Rx editor.', 'kind' => 'rx'],
            ['formdir' => 'requisition', 'title' => 'Lab requisition', 'description' => 'Send-out paper requisition.', 'kind' => 'form'],
            ['formdir' => 'note', 'title' => 'Work/school note', 'description' => 'Excuse letter.', 'kind' => 'form'],
        ],
        'specialty' => [
            ['formdir' => 'nc_eye_exam', 'title' => 'Eye exam', 'description' => 'Primary-care eye exam — acuity, pupils, IOP, fundus.', 'kind' => 'form'],
            ['formdir' => 'eye_mag', 'title' => 'Eye exam', 'description' => 'Ophthalmology exam.', 'kind' => 'form'],
            ['formdir' => 'bronchitis', 'title' => 'Bronchitis form', 'description' => 'Acute illness template.', 'kind' => 'form'],
            ['formdir' => 'ankleinjury', 'title' => 'Ankle evaluation', 'description' => 'Orthopedic injury template.', 'kind' => 'form'],
            ['formdir' => 'painmap', 'title' => 'Pain map', 'description' => 'Graphic pain diagram.', 'kind' => 'form'],
            ['formdir' => 'CAMOS', 'title' => 'CAMOS', 'description' => 'Legacy structured note.', 'kind' => 'form'],
        ],
    ];

    /** @var array<string, array<string, list<array{formdir: string, title: string, description: string, kind: string, primary?: bool}>>> */
    private const BUNDLES = [
        'ghana_opd_v1' => self::BUNDLE_GHANA_OPD,
        self::REFERRAL_HOSPITAL_BUNDLE_KEY => self::BUNDLE_REFERRAL_HOSPITAL,
    ];

    /** @var array<string, list<string>>|null */
    private ?array $allowedFormdirsCache = null;

    /**
     * cardsForLens() rebuilds every card from scratch (a registry/LBF lookup per formdir,
     * uncached) — cheap per call today since `registry` is a small, slowly-growing form
     * catalog, not transactional data, but getCatalog(null, ...) (the full, unscoped catalog
     * used by e.g. buildAddableForms()) iterates every lens and rebuilds cards for lenses
     * that a lens-scoped getCatalog() call already built moments earlier in the same request.
     * Memoized per (lens, facility) for the life of this instance; cleared alongside
     * allowedFormdirsCache since both are derived from the same underlying catalog data.
     *
     * @var array<string, list<array<string, mixed>>>
     */
    private array $cardsForLensCache = [];

    /** @var array<string, string> raw formdir => resolved canonical directory, see resolveRegistryDirectory(). */
    private array $resolveRegistryDirectoryCache = [];

    /**
     * Per-request snapshots of the two small, slowly-changing form-metadata tables the
     * card builder consults per formdir. Before this, resolveRegistryDirectory()/
     * isRegistryFormActive()/canViewRegistryForm() each fired 1-3 point queries PER
     * formdir PER lens — getCatalog() alone ran ~256 queries and getVisitSummary ~648.
     * Loading each table once (both are tiny) and matching in PHP collapses that to two.
     *
     * @var array<string, array{directory: string, state: int, aco_spec: string}>|null  lower(directory) => row
     */
    private ?array $registryByDirectory = null;
    /** @var array<string, true>|null  set of active LBF grp_form_id (grp_group_id='', grp_activity=1). */
    private ?array $activeLbfFormIds = null;
    /** @var array<string, string>|null  lower(formdir) => display name (registry + active LBF). */
    private ?array $bridgeableRegistryFormsCache = null;

    private ?ClinicalDocAccessService $access = null;
    private ?ClinicConfigService $config = null;
    private ?VisitScopeService $visitScope = null;
    private ?EncounterNoteEnginePolicy $enginePolicy = null;
    private ?ScreeningInstrumentCatalog $screeningCatalog = null;

    public function __construct(
        ?ClinicalDocAccessService $access = null,
        ?ClinicConfigService $config = null,
        ?VisitScopeService $visitScope = null,
        ?EncounterNoteEnginePolicy $enginePolicy = null,
    ) {
        $this->access = $access;
        $this->config = $config;
        $this->visitScope = $visitScope;
        $this->enginePolicy = $enginePolicy;
    }

    private function getAccess(): ClinicalDocAccessService
    {
        if ($this->access === null) {
            $this->access = new ClinicalDocAccessService();
        }

        return $this->access;
    }

    private function getConfig(): ClinicConfigService
    {
        if ($this->config === null) {
            $this->config = new ClinicConfigService();
        }

        return $this->config;
    }

    private function getScreeningCatalog(): ScreeningInstrumentCatalog
    {
        if ($this->screeningCatalog === null) {
            $this->screeningCatalog = new ScreeningInstrumentCatalog();
        }

        return $this->screeningCatalog;
    }

    /**
     * A built-in native screener (PHQ-9 / GAD-7). These are the default screening
     * cards (no feature flag) and show as virtual cards — not in the OpenEMR
     * registry. The $facilityId parameter is kept for call-site compatibility.
     */
    public function isNativeScreeningFormdir(string $formdir, ?int $facilityId = null): bool
    {
        return $this->getScreeningCatalog()->isInstrument($formdir);
    }

    private function getVisitScope(): VisitScopeService
    {
        if ($this->visitScope === null) {
            $this->visitScope = new VisitScopeService();
        }

        return $this->visitScope;
    }

    private function getEnginePolicy(): EncounterNoteEnginePolicy
    {
        if ($this->enginePolicy === null) {
            $this->enginePolicy = new EncounterNoteEnginePolicy(
                $this->getConfig(),
                $this->getVisitScope()
            );
        }

        return $this->enginePolicy;
    }

    public static function normalizeBundleKey(string $key): string
    {
        $trimmed = trim($key);

        return isset(self::BUNDLES[$trimmed]) ? $trimmed : self::DEFAULT_BUNDLE_KEY;
    }

    public function resolveBundleKey(?int $facilityId = null): string
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->getVisitScope()->resolveDeskFacilityId();
        }

        $raw = trim((string) ($this->getConfig()->get(
            'clinical_doc_bundle',
            self::DEFAULT_BUNDLE_KEY,
            $facilityId
        ) ?? self::DEFAULT_BUNDLE_KEY));

        return self::normalizeBundleKey($raw);
    }

    /**
     * @return array<string, mixed>
     */
    public function getCatalog(?string $lens = null, ?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->getVisitScope()->resolveDeskFacilityId();
        }

        $allowedLenses = $this->getAccess()->allowedLenses($facilityId);
        if ($lens !== null && $lens !== '') {
            $this->getAccess()->assertLensAccess($lens);
            $allowedLenses = in_array($lens, $allowedLenses, true) ? [$lens] : [];
        }

        $cards = [];
        foreach ($allowedLenses as $lensId) {
            $cards = array_merge($cards, $this->cardsForLens($lensId, $facilityId));
        }

        return [
            'lenses' => $allowedLenses,
            'cards' => $cards,
            'bundle_key' => $this->resolveBundleKey($facilityId),
            'consult_note_formdir' => $this->consultNoteFormdir($facilityId),
            'show_us_quality' => $this->getAccess()->showUsQualityWidgets($facilityId),
        ];
    }

    /**
     * M4-F42 — up to three pinned bundle favorites for Doctor Desk quick drawer.
     *
     * @return list<array<string, mixed>>
     */
    public function getFavoritePinCards(?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->getVisitScope()->resolveDeskFacilityId();
        }

        $primaryFormdir = $this->consultNoteFormdir($facilityId);
        $pinSpecs = [
            [
                'formdir' => $primaryFormdir,
                'lens' => 'consult',
                'title' => 'Consult note',
                'description' => 'Main visit story — CC, exam, plan.',
                'primary' => true,
            ],
            [
                'formdir' => 'vitals',
                'lens' => 'nursing',
                'title' => 'Vitals',
                'description' => 'BP, temperature, SpO₂, etc.',
            ],
            [
                'formdir' => 'procedure_order',
                'lens' => 'orders',
                'title' => 'Lab orders',
                'description' => 'Order labs and imaging.',
            ],
        ];

        $cards = [];
        $pin = 1;
        foreach ($pinSpecs as $spec) {
            if (!$this->getAccess()->canAccessLens($spec['lens'], $facilityId)) {
                continue;
            }

            $def = [
                'formdir' => $spec['formdir'],
                'title' => $spec['title'],
                'description' => $spec['description'],
                'kind' => 'form',
                'primary' => !empty($spec['primary']),
            ];
            $card = $this->buildCard($def, $spec['lens'], $facilityId);
            if ($card === null) {
                continue;
            }

            $card['pin'] = $pin++;
            $cards[] = $card;
            if ($pin > 3) {
                break;
            }
        }

        return $cards;
    }

    /**
     * @return list<string>
     */
    public function allowedFormdirs(?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->getVisitScope()->resolveDeskFacilityId();
        }

        $cacheKey = (string) $facilityId;
        if ($this->allowedFormdirsCache !== null && isset($this->allowedFormdirsCache[$cacheKey])) {
            return $this->allowedFormdirsCache[$cacheKey];
        }

        $catalog = $this->getCatalog(null, $facilityId);
        $formdirs = [];
        foreach ($catalog['cards'] as $card) {
            if (!is_array($card)) {
                continue;
            }
            $formdir = trim((string) ($card['formdir'] ?? ''));
            if ($formdir !== '' && $formdir !== 'rx') {
                $formdirs[] = $this->resolveRegistryDirectory($formdir);
            }
        }

        $formdirs = array_values(array_unique($formdirs));
        $this->allowedFormdirsCache ??= [];
        $this->allowedFormdirsCache[$cacheKey] = $formdirs;

        return $formdirs;
    }

    public function isAllowedFormdir(string $formdir, ?int $facilityId = null): bool
    {
        $formdir = strtolower(trim($formdir));
        if ($formdir === '' || $this->isBillingExcludedFormdir($formdir)) {
            return false;
        }

        if ($this->getEnginePolicy()->isNativeFormdir($formdir) && $this->getEnginePolicy()->isNativeEngineEnabled($facilityId)) {
            return true;
        }

        if ($this->isNativeScreeningFormdir($formdir, $facilityId)) {
            return true;
        }

        foreach ($this->allowedFormdirs($facilityId) as $allowed) {
            if (strcasecmp($allowed, $formdir) === 0) {
                return true;
            }
        }

        return false;
    }

    public function resolveSourceLensForFormdir(string $formdir, ?int $facilityId = null): ?string
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->getVisitScope()->resolveDeskFacilityId();
        }

        $formdir = strtolower(trim($formdir));
        if ($formdir === '' || $formdir === 'rx') {
            return $formdir === 'rx' ? 'orders' : null;
        }

        if ($this->getEnginePolicy()->isNativeFormdir($formdir) && $this->getEnginePolicy()->isNativeEngineEnabled($facilityId)) {
            return 'consult';
        }

        // Existing legacy consult notes stay on the Consult lens even when the
        // native engine filters the legacy primary out of the catalog defs.
        $legacyPrimary = strtolower(trim((string) ($this->getConfig()->get('consult_note_formdir', 'soap', $facilityId) ?? 'soap')));
        if ($legacyPrimary !== '' && $formdir === $legacyPrimary) {
            return 'consult';
        }

        foreach ($this->bundleLensIds($facilityId) as $lensId) {
            foreach ($this->lensDefinitions($lensId, $facilityId) as $def) {
                if (strcasecmp($def['formdir'], $formdir) === 0) {
                    return $lensId;
                }
            }
        }

        return null;
    }

    public function resolveRegistryDirectory(string $formdir): string
    {
        $formdir = strtolower(trim($formdir));
        if ($formdir === '') {
            return '';
        }

        // Pure function (same input -> same output for the life of a request) but called
        // heavily and uncached from two places: once per card while building a lens, and
        // again — plus once per bundle-spec candidate — inside
        // AdminFormBundleService::getFormHealth() for every card's bundle-health check. That
        // second path alone can fire 1-3 queries per (card, spec) pair with zero caching.
        if (isset($this->resolveRegistryDirectoryCache[$formdir])) {
            return $this->resolveRegistryDirectoryCache[$formdir];
        }

        if ($this->getEnginePolicy()->isNativeFormdir($formdir)) {
            return $this->resolveRegistryDirectoryCache[$formdir] = EncounterNoteService::NATIVE_FORMDIR;
        }

        $registry = $this->registryByDirectory();
        $entry = $registry[strtolower($formdir)] ?? null;
        if ($entry !== null && $entry['state'] === 1) {
            return $this->resolveRegistryDirectoryCache[$formdir] = $entry['directory'];
        }

        $lbf = $this->activeLbfFormIds();
        foreach ($this->lbfFormIdCandidates($formdir) as $candidate) {
            if (isset($lbf[$candidate])) {
                return $this->resolveRegistryDirectoryCache[$formdir] = $candidate;
            }
        }

        return $this->resolveRegistryDirectoryCache[$formdir] = $formdir;
    }

    /**
     * @return array<string, array{directory: string, state: int, aco_spec: string}>
     */
    private function registryByDirectory(): array
    {
        if ($this->registryByDirectory === null) {
            $rows = QueryUtils::fetchRecords('SELECT directory, state, aco_spec FROM registry') ?: [];
            $map = [];
            foreach ($rows as $row) {
                $dir = (string) ($row['directory'] ?? '');
                if ($dir === '') {
                    continue;
                }
                $map[strtolower($dir)] = [
                    'directory' => $dir,
                    'state' => (int) ($row['state'] ?? 0),
                    'aco_spec' => trim((string) ($row['aco_spec'] ?? '')),
                ];
            }
            $this->registryByDirectory = $map;
        }

        return $this->registryByDirectory;
    }

    /**
     * @return array<string, true>
     */
    private function activeLbfFormIds(): array
    {
        if ($this->activeLbfFormIds === null) {
            $rows = QueryUtils::fetchRecords(
                "SELECT grp_form_id FROM layout_group_properties
                 WHERE grp_group_id = '' AND grp_activity = 1"
            ) ?: [];
            $set = [];
            foreach ($rows as $row) {
                $set[(string) ($row['grp_form_id'] ?? '')] = true;
            }
            $this->activeLbfFormIds = $set;
        }

        return $this->activeLbfFormIds;
    }

    public function clearAllowedFormdirsCache(): void
    {
        $this->allowedFormdirsCache = null;
        $this->cardsForLensCache = [];
        $this->resolveRegistryDirectoryCache = [];
        $this->registryByDirectory = null;
        $this->activeLbfFormIds = null;
        $this->bridgeableRegistryFormsCache = null;
    }

    public function isFormInstalledAndActive(string $formdir): bool
    {
        return $this->isRegistryFormActive($this->resolveRegistryDirectory($formdir));
    }

    /**
     * Case-insensitive BILLING_EXCLUDED check — registry directories are mixed-case
     * (`newGroupEncounter`) while callers pass lowercased formdirs.
     */
    private function isBillingExcludedFormdir(string $formdir): bool
    {
        foreach (self::BILLING_EXCLUDED as $excluded) {
            if (strcasecmp($excluded, $formdir) === 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Forms whose editors are visit-keyed native surfaces with no stock page —
     * they open from the day's queue only, never in encounter-only mode.
     */
    public function isQueueOnlyFormdir(string $formdir, ?int $facilityId = null): bool
    {
        $formdir = strtolower(trim($formdir));

        return in_array($formdir, ['rx', EncounterNoteEnginePolicy::NATIVE_FORMDIR, 'nc_certificate', 'nc_eye_exam'], true)
            || $this->isNativeScreeningFormdir($formdir, $facilityId);
    }

    /**
     * All installed, active, bridgeable registry forms — stock-encounter parity for
     * the hub's Add form list and the "other forms on this encounter" cards:
     * lower(directory) => display name. Billing/encounter-admin forms and the
     * module's own nc_* forms (managed by the catalog) are excluded.
     *
     * @return array<string, string>
     */
    public function listBridgeableRegistryForms(): array
    {
        if ($this->bridgeableRegistryFormsCache !== null) {
            return $this->bridgeableRegistryFormsCache;
        }

        $rows = QueryUtils::fetchRecords(
            'SELECT directory, name FROM registry WHERE state = 1 ORDER BY name, directory'
        ) ?: [];

        $out = [];
        foreach ($rows as $row) {
            $dir = strtolower(trim((string) ($row['directory'] ?? '')));
            if (
                $dir === ''
                || isset($out[$dir])
                || str_starts_with($dir, 'nc_')
                || $this->isBillingExcludedFormdir($dir)
            ) {
                continue;
            }
            $name = trim((string) ($row['name'] ?? ''));
            $out[$dir] = $name !== '' ? $name : $dir;
        }

        // Active LBF forms (clinic-authored layouts) — the stock Add menu offers these
        // too, and they open through the same bridge. DEM/HIS core layouts are excluded
        // by the LBF prefix.
        $lbfRows = QueryUtils::fetchRecords(
            "SELECT grp_form_id, grp_title FROM layout_group_properties
             WHERE grp_group_id = '' AND grp_activity = 1 AND LOWER(grp_form_id) LIKE 'lbf%'
             ORDER BY grp_title, grp_form_id"
        ) ?: [];
        foreach ($lbfRows as $row) {
            $dir = strtolower(trim((string) ($row['grp_form_id'] ?? '')));
            if ($dir === '' || isset($out[$dir])) {
                continue;
            }
            $name = trim((string) ($row['grp_title'] ?? ''));
            $out[$dir] = $name !== '' ? $name : $dir;
        }

        return $this->bridgeableRegistryFormsCache = $out;
    }

    /**
     * Bridge/encounter-mode rule: any installed, active registry form except the
     * billing/encounter-admin set may render through the clinical-form-bridge —
     * parity with the stock encounter screen, which offers the full registry.
     * Per-form ACL (AclMain::aclCheckForm) is still enforced by the bridge.
     */
    public function isBridgeableFormdir(string $formdir): bool
    {
        $formdir = strtolower(trim($this->resolveRegistryDirectory($formdir)));
        if ($formdir === '' || $this->isBillingExcludedFormdir($formdir)) {
            return false;
        }

        return $this->isRegistryFormActive($formdir);
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

        return [$formdir, 'lbf' . $formdir];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function cardsForLens(string $lens, int $facilityId): array
    {
        $cacheKey = $lens . '|' . $facilityId;
        if (isset($this->cardsForLensCache[$cacheKey])) {
            return $this->cardsForLensCache[$cacheKey];
        }

        if ($lens === 'visit') {
            return $this->cardsForLensCache[$cacheKey] = $this->visitLensCards($facilityId);
        }

        $defs = $this->lensDefinitions($lens, $facilityId);
        $cards = [];
        foreach ($defs as $def) {
            $card = $this->buildCard($def, $lens, $facilityId);
            if ($card !== null) {
                $cards[] = $card;
            }
        }

        return $this->cardsForLensCache[$cacheKey] = $cards;
    }

    /**
     * @return list<array{formdir: string, title: string, description: string, kind: string, primary?: bool}>
     */
    private function lensDefinitions(string $lens, int $facilityId): array
    {
        $bundleKey = $this->resolveBundleKey($facilityId);
        $bundle = self::BUNDLES[$bundleKey];
        $defs = $bundle[$lens] ?? [];
        if ($lens === 'specialty') {
            $defs = $this->filterSpecialtyPack($defs, $facilityId);
        }
        if ($lens === 'consult') {
            $defs = $this->applyNativeConsultLens($defs, $facilityId);
            $defs = $this->applyConsultPrimary($defs, $facilityId);
        }

        return $defs;
    }

    /**
     * @return list<string>
     */
    private function bundleLensIds(int $facilityId): array
    {
        $bundleKey = $this->resolveBundleKey($facilityId);
        $bundle = self::BUNDLES[$bundleKey];

        return array_keys($bundle);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function visitLensCards(int $facilityId): array
    {
        $cards = [];
        $seen = [];
        foreach (['consult', 'nursing', 'orders'] as $sourceLens) {
            if (!$this->getAccess()->canAccessLens($sourceLens, $facilityId)) {
                continue;
            }
            foreach ($this->cardsForLens($sourceLens, $facilityId) as $card) {
                $include = !empty($card['primary']) || $sourceLens === 'orders';
                $formdirLower = strtolower((string) ($card['formdir'] ?? ''));
                if (!$include && (str_contains($formdirLower, 'lab_intake') || str_contains($formdirLower, 'pharmacy_service'))) {
                    $include = true;
                }
                // The medical certificate is an everyday doctor document — it
                // belongs on the This-visit tab, not buried in consult "More".
                if ($formdirLower === 'nc_certificate') {
                    $include = true;
                    $card['more'] = false;
                }
                if (!$include) {
                    continue;
                }
                $formdirKey = strtolower((string) ($card['formdir'] ?? ''));
                if ($formdirKey === '' || isset($seen[$formdirKey])) {
                    continue;
                }
                $seen[$formdirKey] = true;
                $card['lens'] = 'visit';
                $card['source_lens'] = $sourceLens;
                $cards[] = $card;
            }
        }

        return $cards;
    }

    /**
     * @param list<array{formdir: string, title: string, description: string, kind: string, primary?: bool}> $defs
     * @return list<array{formdir: string, title: string, description: string, kind: string, primary?: bool}>
     */
    private function applyConsultPrimary(array $defs, int $facilityId): array
    {
        $primary = $this->consultNoteFormdir($facilityId);
        $primarySet = false;
        foreach ($defs as $index => $def) {
            if (strcasecmp($def['formdir'], $primary) === 0) {
                $defs[$index]['primary'] = true;
                $primarySet = true;
            } elseif (!empty($def['primary'])) {
                $defs[$index]['primary'] = false;
            }
        }
        if (!$primarySet && $defs !== []) {
            $defs[0]['primary'] = true;
        }

        return $defs;
    }

    /**
     * @param list<array{formdir: string, title: string, description: string, kind: string, primary?: bool}> $defs
     * @return list<array{formdir: string, title: string, description: string, kind: string, primary?: bool}>
     */
    private function filterSpecialtyPack(array $defs, int $facilityId): array
    {
        $raw = trim((string) ($this->getConfig()->get('clinical_doc_specialty_pack', '[]', $facilityId) ?? '[]'));
        $enabled = json_decode($raw, true);
        $enabled = is_array($enabled)
            ? array_map(static fn ($v): string => strtolower(trim((string) $v)), $enabled)
            : [];

        return array_values(array_filter(
            $defs,
            static function (array $def) use ($enabled): bool {
                $formdir = strtolower($def['formdir']);
                // The native eye exam carries its OWN flag (checked in buildCard);
                // requiring pack membership on top would be a redundant third gate.
                if ($formdir === 'nc_eye_exam') {
                    return true;
                }

                return in_array($formdir, $enabled, true);
            }
        ));
    }

    /**
     * @param array{formdir: string, title: string, description: string, kind: string, primary?: bool} $def
     * @return array<string, mixed>|null
     */
    private function buildCard(array $def, string $lens, int $facilityId): ?array
    {
        $canonical = $this->resolveRegistryDirectory($def['formdir']);
        $formdir = strtolower(trim($canonical));
        $kind = $def['kind'];
        if ($kind === 'form') {
            // The certificate card is flag-gated (its registry row always exists
            // for encounter-summary rendering, so the registry check alone would
            // show it with the flag off).
            if ($formdir === 'nc_certificate'
                && !$this->getConfig()->isEnabled('enable_native_certificate', 0, $facilityId)) {
                return null;
            }
            if ($formdir === 'nc_eye_exam'
                && !$this->getConfig()->isEnabled('enable_native_eye_exam', 0, $facilityId)) {
                return null;
            }
            if ($this->getEnginePolicy()->isNativeFormdir($formdir) && $this->getEnginePolicy()->isNativeEngineEnabled($facilityId)) {
                // Virtual native consult card — not in OpenEMR registry.
            } elseif ($this->isNativeScreeningFormdir($formdir, $facilityId)) {
                // Virtual native screening card (PHQ-9 / GAD-7) — not registered;
                // status + score are read from form_nc_screening at enrich time.
            } elseif (!$this->isRegistryFormActive($formdir)) {
                return null;
            } elseif (!$this->canViewRegistryForm($canonical)) {
                return null;
            }
        }

        return [
            'id' => $lens . '_' . $formdir,
            'lens' => $lens,
            'source_lens' => $lens,
            'formdir' => $canonical,
            'kind' => $kind,
            'title' => $def['title'],
            'description' => $def['description'],
            'primary' => !empty($def['primary']),
            'more' => $lens === 'consult' && empty($def['primary']),
        ];
    }

    private function consultNoteFormdir(int $facilityId): string
    {
        return $this->getEnginePolicy()->effectiveConsultFormdir($facilityId);
    }

    /**
     * @param list<array{formdir: string, title: string, description: string, kind: string, primary?: bool}> $defs
     * @return list<array{formdir: string, title: string, description: string, kind: string, primary?: bool}>
     */
    private function applyNativeConsultLens(array $defs, int $facilityId): array
    {
        if (!$this->getEnginePolicy()->isNativeEngineEnabled($facilityId)) {
            return $defs;
        }

        $legacyPrimary = strtolower(trim((string) ($this->getConfig()->get('consult_note_formdir', 'soap', $facilityId) ?? 'soap')));
        $filtered = array_values(array_filter(
            $defs,
            static fn (array $def): bool => strcasecmp($def['formdir'], EncounterNoteService::NATIVE_FORMDIR) !== 0
                && strcasecmp($def['formdir'], $legacyPrimary) !== 0
        ));

        array_unshift($filtered, [
            'formdir' => EncounterNoteService::NATIVE_FORMDIR,
            'title' => 'Consultation note',
            'description' => 'Structured consult — CC, HPI, vitals, exam, assessment & plan.',
            'kind' => 'form',
            'primary' => true,
        ]);

        return $filtered;
    }

    private function canViewRegistryForm(string $canonical): bool
    {
        $entry = $this->registryByDirectory()[strtolower($canonical)] ?? null;
        $acoSpec = $entry !== null ? $entry['aco_spec'] : '';
        if ($acoSpec === '') {
            $lbf = $this->activeLbfFormIds();
            foreach ($this->lbfFormIdCandidates($canonical) as $candidate) {
                if (isset($lbf[$candidate])) {
                    return true;
                }
            }

            return false;
        }

        return AclMain::aclCheckAcoSpec($acoSpec);
    }

    private function isRegistryFormActive(string $formdir): bool
    {
        if ($this->isBillingExcludedFormdir($formdir)) {
            return false;
        }

        $entry = $this->registryByDirectory()[strtolower($formdir)] ?? null;
        if ($entry !== null && $entry['state'] === 1) {
            return true;
        }

        $lbf = $this->activeLbfFormIds();
        foreach ($this->lbfFormIdCandidates($formdir) as $candidate) {
            if (isset($lbf[$candidate])) {
                return true;
            }
        }

        return false;
    }
}

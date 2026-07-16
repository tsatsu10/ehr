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
        ],
        'screening' => [
            ['formdir' => 'phq9', 'title' => 'PHQ-9', 'description' => 'Depression screen.', 'kind' => 'form'],
            ['formdir' => 'gad7', 'title' => 'GAD-7', 'description' => 'Anxiety screen.', 'kind' => 'form'],
            ['formdir' => 'questionnaire_assessments', 'title' => 'Questionnaires', 'description' => 'LForms / FHIR questionnaires.', 'kind' => 'form'],
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
        ],
        'screening' => [
            ['formdir' => 'phq9', 'title' => 'PHQ-9', 'description' => 'Depression screen.', 'kind' => 'form'],
            ['formdir' => 'gad7', 'title' => 'GAD-7', 'description' => 'Anxiety screen.', 'kind' => 'form'],
            ['formdir' => 'questionnaire_assessments', 'title' => 'Questionnaires', 'description' => 'LForms / FHIR questionnaires.', 'kind' => 'form'],
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

    private ?ClinicalDocAccessService $access = null;
    private ?ClinicConfigService $config = null;
    private ?VisitScopeService $visitScope = null;
    private ?EncounterNoteEnginePolicy $enginePolicy = null;

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
        if ($formdir === '' || in_array($formdir, self::BILLING_EXCLUDED, true)) {
            return false;
        }

        if ($this->getEnginePolicy()->isNativeFormdir($formdir) && $this->getEnginePolicy()->isNativeEngineEnabled($facilityId)) {
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

        $row = QueryUtils::querySingleRow(
            'SELECT directory FROM registry WHERE LOWER(directory) = ? AND state = 1 LIMIT 1',
            [$formdir]
        );

        if (is_array($row)) {
            return $this->resolveRegistryDirectoryCache[$formdir] = (string) ($row['directory'] ?? $formdir);
        }

        foreach ($this->lbfFormIdCandidates($formdir) as $candidate) {
            $lbfRow = QueryUtils::querySingleRow(
                "SELECT grp_form_id FROM layout_group_properties
                 WHERE grp_form_id = ? AND grp_group_id = '' AND grp_activity = 1 LIMIT 1",
                [$candidate]
            );
            if (is_array($lbfRow)) {
                return $this->resolveRegistryDirectoryCache[$formdir] = (string) ($lbfRow['grp_form_id'] ?? $candidate);
            }
        }

        return $this->resolveRegistryDirectoryCache[$formdir] = $formdir;
    }

    public function clearAllowedFormdirsCache(): void
    {
        $this->allowedFormdirsCache = null;
        $this->cardsForLensCache = [];
        $this->resolveRegistryDirectoryCache = [];
    }

    public function isFormInstalledAndActive(string $formdir): bool
    {
        return $this->isRegistryFormActive($this->resolveRegistryDirectory($formdir));
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
        if (!is_array($enabled) || $enabled === []) {
            return [];
        }
        $enabled = array_map(static fn ($v): string => strtolower(trim((string) $v)), $enabled);

        return array_values(array_filter(
            $defs,
            static fn (array $def): bool => in_array(strtolower($def['formdir']), $enabled, true)
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
            if ($this->getEnginePolicy()->isNativeFormdir($formdir) && $this->getEnginePolicy()->isNativeEngineEnabled($facilityId)) {
                // Virtual native consult card — not in OpenEMR registry.
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
        if (!function_exists('getRegistryEntryByDirectory')) {
            require_once $GLOBALS['fileroot'] . '/library/registry.inc.php';
        }

        $entry = getRegistryEntryByDirectory($canonical, 'aco_spec');
        if (!is_array($entry) || empty($entry['aco_spec'])) {
            foreach ($this->lbfFormIdCandidates($canonical) as $candidate) {
                $lbfRow = QueryUtils::querySingleRow(
                    "SELECT grp_form_id FROM layout_group_properties
                     WHERE grp_form_id = ? AND grp_group_id = '' AND grp_activity = 1 LIMIT 1",
                    [$candidate]
                );
                if (is_array($lbfRow)) {
                    return true;
                }
            }

            return false;
        }

        return AclMain::aclCheckAcoSpec($entry['aco_spec']);
    }

    private function isRegistryFormActive(string $formdir): bool
    {
        if (in_array($formdir, self::BILLING_EXCLUDED, true)) {
            return false;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT state FROM registry WHERE LOWER(directory) = ? LIMIT 1',
            [strtolower($formdir)]
        );

        if (is_array($row) && (int) ($row['state'] ?? 0) === 1) {
            return true;
        }

        foreach ($this->lbfFormIdCandidates($formdir) as $candidate) {
            $lbfRow = QueryUtils::querySingleRow(
                "SELECT grp_form_id FROM layout_group_properties
                 WHERE grp_form_id = ? AND grp_group_id = '' AND grp_activity = 1 LIMIT 1",
                [$candidate]
            );
            if (is_array($lbfRow)) {
                return true;
            }
        }

        return false;
    }
}

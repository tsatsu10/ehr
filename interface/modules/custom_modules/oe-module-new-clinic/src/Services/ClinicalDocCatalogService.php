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
    ];

    /** @var array<string, list<string>>|null */
    private ?array $allowedFormdirsCache = null;

    public function __construct(
        private readonly ClinicalDocAccessService $access = new ClinicalDocAccessService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getCatalog(?string $lens = null, ?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        $allowedLenses = $this->access->allowedLenses($facilityId);
        if ($lens !== null && $lens !== '') {
            $this->access->assertLensAccess($lens);
            $allowedLenses = in_array($lens, $allowedLenses, true) ? [$lens] : [];
        }

        $cards = [];
        foreach ($allowedLenses as $lensId) {
            $cards = array_merge($cards, $this->cardsForLens($lensId, $facilityId));
        }

        return [
            'lenses' => $allowedLenses,
            'cards' => $cards,
            'consult_note_formdir' => $this->consultNoteFormdir($facilityId),
            'show_us_quality' => $this->access->showUsQualityWidgets($facilityId),
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
            $facilityId = $this->visitScope->resolveDeskFacilityId();
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
            if (!$this->access->canAccessLens($spec['lens'], $facilityId)) {
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
            $facilityId = $this->visitScope->resolveDeskFacilityId();
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
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        $formdir = strtolower(trim($formdir));
        if ($formdir === '' || $formdir === 'rx') {
            return $formdir === 'rx' ? 'orders' : null;
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

        $row = QueryUtils::querySingleRow(
            'SELECT directory FROM registry WHERE LOWER(directory) = ? AND state = 1 LIMIT 1',
            [$formdir]
        );

        if (is_array($row)) {
            return (string) ($row['directory'] ?? $formdir);
        }

        foreach ($this->lbfFormIdCandidates($formdir) as $candidate) {
            $lbfRow = QueryUtils::querySingleRow(
                "SELECT grp_form_id FROM layout_group_properties
                 WHERE grp_form_id = ? AND grp_group_id = '' AND grp_activity = 1 LIMIT 1",
                [$candidate]
            );
            if (is_array($lbfRow)) {
                return (string) ($lbfRow['grp_form_id'] ?? $candidate);
            }
        }

        return $formdir;
    }

    public function clearAllowedFormdirsCache(): void
    {
        $this->allowedFormdirsCache = null;
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
        if ($lens === 'visit') {
            return $this->visitLensCards($facilityId);
        }

        $defs = $this->lensDefinitions($lens, $facilityId);
        $cards = [];
        foreach ($defs as $def) {
            $card = $this->buildCard($def, $lens, $facilityId);
            if ($card !== null) {
                $cards[] = $card;
            }
        }

        return $cards;
    }

    /**
     * @return list<array{formdir: string, title: string, description: string, kind: string, primary?: bool}>
     */
    private function lensDefinitions(string $lens, int $facilityId): array
    {
        $bundleKey = $this->config->get('clinical_doc_bundle', 'ghana_opd_v1', $facilityId) ?? 'ghana_opd_v1';
        $bundle = self::BUNDLES[$bundleKey] ?? self::BUNDLE_GHANA_OPD;
        $defs = $bundle[$lens] ?? [];
        if ($lens === 'specialty') {
            $defs = $this->filterSpecialtyPack($defs, $facilityId);
        }
        if ($lens === 'consult') {
            $defs = $this->applyConsultPrimary($defs, $facilityId);
        }

        return $defs;
    }

    /**
     * @return list<string>
     */
    private function bundleLensIds(int $facilityId): array
    {
        $bundleKey = $this->config->get('clinical_doc_bundle', 'ghana_opd_v1', $facilityId) ?? 'ghana_opd_v1';
        $bundle = self::BUNDLES[$bundleKey] ?? self::BUNDLE_GHANA_OPD;

        return array_keys($bundle);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function visitLensCards(int $facilityId): array
    {
        $cards = [];
        foreach (['consult', 'nursing', 'orders'] as $sourceLens) {
            if (!$this->access->canAccessLens($sourceLens, $facilityId)) {
                continue;
            }
            foreach ($this->cardsForLens($sourceLens, $facilityId) as $card) {
                if (!empty($card['primary']) || $sourceLens === 'orders') {
                    $card['lens'] = 'visit';
                    $card['source_lens'] = $sourceLens;
                    $cards[] = $card;
                }
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
        $raw = trim((string) ($this->config->get('clinical_doc_specialty_pack', '[]', $facilityId) ?? '[]'));
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
            if (!$this->isRegistryFormActive($formdir)) {
                return null;
            }
            if (!AclMain::aclCheckForm($canonical)) {
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
        $formdir = strtolower(trim((string) ($this->config->get('consult_note_formdir', 'soap', $facilityId) ?? 'soap')));

        return $formdir !== '' ? $formdir : 'soap';
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

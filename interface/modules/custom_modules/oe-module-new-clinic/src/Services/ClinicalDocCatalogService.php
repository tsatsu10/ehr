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
        ];
    }

    /**
     * @return list<string>
     */
    public function allowedFormdirs(?int $facilityId = null): array
    {
        $catalog = $this->getCatalog(null, $facilityId);
        $formdirs = [];
        foreach ($catalog['cards'] as $card) {
            if (!is_array($card)) {
                continue;
            }
            $formdir = trim((string) ($card['formdir'] ?? ''));
            if ($formdir !== '' && $formdir !== 'rx') {
                $formdirs[] = $formdir;
            }
        }

        return array_values(array_unique($formdirs));
    }

    public function isAllowedFormdir(string $formdir, ?int $facilityId = null): bool
    {
        $formdir = strtolower(trim($formdir));
        if ($formdir === '' || in_array($formdir, self::BILLING_EXCLUDED, true)) {
            return false;
        }

        return in_array($formdir, $this->allowedFormdirs($facilityId), true);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function cardsForLens(string $lens, int $facilityId): array
    {
        if ($lens === 'visit') {
            return $this->visitLensCards($facilityId);
        }

        $bundleKey = $this->config->get('clinical_doc_bundle', 'ghana_opd_v1', $facilityId) ?? 'ghana_opd_v1';
        $defs = $bundleKey === 'ghana_opd_v1' ? (self::BUNDLE_GHANA_OPD[$lens] ?? []) : (self::BUNDLE_GHANA_OPD[$lens] ?? []);
        if ($lens === 'specialty') {
            $defs = $this->filterSpecialtyPack($defs, $facilityId);
        }
        if ($lens === 'consult') {
            $defs = $this->applyConsultPrimary($defs, $facilityId);
        }

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
     * @return list<array<string, mixed>>
     */
    private function visitLensCards(int $facilityId): array
    {
        $cards = [];
        foreach (['consult', 'nursing', 'orders'] as $sourceLens) {
            foreach ($this->cardsForLens($sourceLens, $facilityId) as $card) {
                if (!empty($card['primary']) || $sourceLens === 'orders') {
                    $card['lens'] = 'visit';
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
            if ($def['formdir'] === $primary) {
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
        $formdir = strtolower(trim($def['formdir']));
        $kind = $def['kind'];
        if ($kind === 'form') {
            if (!$this->isRegistryFormActive($formdir)) {
                return null;
            }
            if (!AclMain::aclCheckForm($formdir)) {
                return null;
            }
        }

        return [
            'id' => $lens . '_' . $formdir,
            'lens' => $lens,
            'formdir' => $formdir,
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
            'SELECT state FROM registry WHERE directory = ? LIMIT 1',
            [$formdir]
        );

        return is_array($row) && (int) ($row['state'] ?? 0) === 1;
    }
}

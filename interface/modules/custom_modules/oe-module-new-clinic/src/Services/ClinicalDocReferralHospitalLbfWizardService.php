<?php

/**
 * V1.2-DOC-HLF-1 — Referral hospital consult LBF layout pack installer
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class ClinicalDocReferralHospitalLbfWizardService
{
    public const PACK_KEY = 'referral_opd_consult';
    public const LBF_FORM_ID = 'LBFreferral_opd_consult';

    /** @var list<array{group_id: string, title: string}> */
    private const GROUPS = [
        ['group_id' => '1', 'title' => 'Referral header'],
        ['group_id' => '2', 'title' => 'Source of information'],
        ['group_id' => '3', 'title' => 'Chief complaint & HPI'],
        ['group_id' => '4', 'title' => 'Review of systems'],
        ['group_id' => '5', 'title' => 'Examination'],
        ['group_id' => '6', 'title' => 'Data reviewed'],
        ['group_id' => '7', 'title' => 'Assessment & plan'],
        ['group_id' => '8', 'title' => 'Follow-up & attestation'],
    ];

    /** @var list<array{field_id: string, group_id: string, title: string, seq: int, data_type: int, uor: int}> */
    private const FIELDS = [
        ['field_id' => 'requesting_clinician', 'group_id' => '1', 'title' => 'Requesting clinician', 'seq' => 1, 'data_type' => 1, 'uor' => 2],
        ['field_id' => 'requesting_service', 'group_id' => '1', 'title' => 'Requesting service / department', 'seq' => 2, 'data_type' => 1, 'uor' => 2],
        ['field_id' => 'clinical_question', 'group_id' => '1', 'title' => 'Clinical question / reason for referral', 'seq' => 3, 'data_type' => 3, 'uor' => 2],
        ['field_id' => 'urgency', 'group_id' => '1', 'title' => 'Urgency (routine / urgent / emergent)', 'seq' => 4, 'data_type' => 1, 'uor' => 1],
        ['field_id' => 'source_of_information', 'group_id' => '2', 'title' => 'Source of information', 'seq' => 1, 'data_type' => 3, 'uor' => 2],
        ['field_id' => 'chief_complaint', 'group_id' => '3', 'title' => 'Chief complaint', 'seq' => 1, 'data_type' => 1, 'uor' => 2],
        ['field_id' => 'hpi_narrative', 'group_id' => '3', 'title' => 'History of present illness', 'seq' => 2, 'data_type' => 3, 'uor' => 2],
        ['field_id' => 'hpi_onset', 'group_id' => '3', 'title' => 'Onset / duration', 'seq' => 3, 'data_type' => 1, 'uor' => 1],
        ['field_id' => 'ros_pertinent', 'group_id' => '4', 'title' => 'Pertinent review of systems', 'seq' => 1, 'data_type' => 3, 'uor' => 1],
        ['field_id' => 'pe_general', 'group_id' => '5', 'title' => 'Physical examination', 'seq' => 1, 'data_type' => 3, 'uor' => 2],
        ['field_id' => 'vitals_summary', 'group_id' => '5', 'title' => 'Vitals summary (from triage)', 'seq' => 2, 'data_type' => 3, 'uor' => 1],
        ['field_id' => 'pe_specialty', 'group_id' => '5', 'title' => 'Specialty / focused examination', 'seq' => 3, 'data_type' => 3, 'uor' => 1],
        ['field_id' => 'labs_reviewed', 'group_id' => '6', 'title' => 'Labs reviewed this visit', 'seq' => 1, 'data_type' => 3, 'uor' => 1],
        ['field_id' => 'imaging_reviewed', 'group_id' => '6', 'title' => 'Imaging reviewed this visit', 'seq' => 2, 'data_type' => 3, 'uor' => 1],
        ['field_id' => 'problems_assessment', 'group_id' => '7', 'title' => 'Problems & assessment', 'seq' => 1, 'data_type' => 3, 'uor' => 2],
        ['field_id' => 'differential', 'group_id' => '7', 'title' => 'Differential diagnosis', 'seq' => 2, 'data_type' => 3, 'uor' => 1],
        ['field_id' => 'plan_items', 'group_id' => '7', 'title' => 'Numbered plan / recommendations', 'seq' => 3, 'data_type' => 3, 'uor' => 2],
        ['field_id' => 'follow_up_instructions', 'group_id' => '8', 'title' => 'Follow-up instructions', 'seq' => 1, 'data_type' => 3, 'uor' => 2],
        ['field_id' => 'attestation_note', 'group_id' => '8', 'title' => 'Supervisor attestation (when applicable)', 'seq' => 2, 'data_type' => 3, 'uor' => 1],
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly ClinicalDocCatalogService $catalog = new ClinicalDocCatalogService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getPackStatus(?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId < 0) {
            $facilityId = 0;
        }

        $installed = $this->isPackInstalled();
        $consultNote = strtolower(trim((string) ($this->config->get('consult_note_formdir', 'soap', $facilityId) ?? 'soap')));

        return [
            'pack_key' => self::PACK_KEY,
            'form_id' => self::LBF_FORM_ID,
            'installed' => $installed,
            'consult_note_formdir' => $consultNote,
            'is_primary_consult_note' => strcasecmp($consultNote, self::LBF_FORM_ID) === 0
                || strcasecmp($consultNote, self::PACK_KEY) === 0,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function importPack(int $facilityId, int $actorUserId, bool $setAsConsultNote = false): array
    {
        if ($facilityId < 0) {
            $facilityId = 0;
        }

        $alreadyInstalled = $this->isPackInstalled();
        if (!$alreadyInstalled) {
            $this->insertLayoutPack();
        }

        $consultSet = false;
        if ($setAsConsultNote) {
            $this->config->set('consult_note_formdir', self::LBF_FORM_ID, $facilityId);
            $consultSet = true;
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic_config',
            'clinical_doc_lbf_import',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode([
                'pack_key' => self::PACK_KEY,
                'form_id' => self::LBF_FORM_ID,
                'facility_id' => $facilityId,
                'already_installed' => $alreadyInstalled,
                'set_as_consult_note' => $consultSet,
            ]),
            0
        );

        return array_merge($this->getPackStatus($facilityId), [
            'imported' => !$alreadyInstalled,
            'set_as_consult_note' => $consultSet,
        ]);
    }

    public function isPackInstalled(): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT grp_form_id FROM layout_group_properties
             WHERE grp_form_id = ? AND grp_group_id = '' AND grp_activity = 1 LIMIT 1",
            [self::LBF_FORM_ID]
        );

        return is_array($row);
    }

    private function insertLayoutPack(): void
    {
        QueryUtils::sqlInsert(
            "INSERT INTO layout_group_properties
                (grp_form_id, grp_group_id, grp_title, grp_subtitle, grp_mapping, grp_seq, grp_activity, grp_repeats, grp_issue_type)
             VALUES (?, '', ?, '', 'Clinical', 10, 1, 0, '')",
            [self::LBF_FORM_ID, 'Referral Hospital Consult']
        );

        foreach (self::GROUPS as $group) {
            QueryUtils::sqlInsert(
                "INSERT INTO layout_group_properties
                    (grp_form_id, grp_group_id, grp_title, grp_subtitle, grp_mapping, grp_seq, grp_activity, grp_repeats, grp_issue_type)
                 VALUES (?, ?, ?, '', '', ?, 1, 0, '')",
                [
                    self::LBF_FORM_ID,
                    $group['group_id'],
                    $group['title'],
                    (int) $group['group_id'],
                ]
            );
        }

        foreach (self::FIELDS as $field) {
            QueryUtils::sqlInsert(
                "INSERT INTO layout_options
                    (form_id, field_id, group_id, title, seq, data_type, uor, fld_length, max_length, list_id, titlecols, datacols, default_value, edit_options, description, source, conditions)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, '', 1, 3, '', '', '', 'F', '')",
                [
                    self::LBF_FORM_ID,
                    $field['field_id'],
                    $field['group_id'],
                    $field['title'],
                    $field['seq'],
                    $field['data_type'],
                    $field['uor'],
                ]
            );
        }

        $this->catalog->clearAllowedFormdirsCache();
    }
}

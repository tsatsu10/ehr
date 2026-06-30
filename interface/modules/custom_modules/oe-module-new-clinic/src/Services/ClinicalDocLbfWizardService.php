<?php

/**
 * M17-F08 — Ghana OPD consult LBF layout pack installer
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class ClinicalDocLbfWizardService
{
    public const PACK_KEY = 'ghana_opd_consult';
    public const LBF_FORM_ID = 'LBFghana_opd_consult';

    /** @var list<array{group_id: string, title: string}> */
    private const GROUPS = [
        ['group_id' => '1', 'title' => 'Presenting complaint & history'],
        ['group_id' => '2', 'title' => 'Examination'],
        ['group_id' => '3', 'title' => 'Assessment & plan'],
        ['group_id' => '4', 'title' => 'Follow-up & quick codes'],
    ];

    /** @var list<array{field_id: string, group_id: string, title: string, seq: int, data_type: int, uor: int}> */
    private const FIELDS = [
        ['field_id' => 'presenting_complaint', 'group_id' => '1', 'title' => 'Presenting complaint', 'seq' => 1, 'data_type' => 3, 'uor' => 2],
        ['field_id' => 'history', 'group_id' => '1', 'title' => 'History of presenting complaint', 'seq' => 2, 'data_type' => 3, 'uor' => 1],
        ['field_id' => 'past_history', 'group_id' => '1', 'title' => 'Past medical / surgical history', 'seq' => 3, 'data_type' => 3, 'uor' => 1],
        ['field_id' => 'examination', 'group_id' => '2', 'title' => 'Physical examination', 'seq' => 1, 'data_type' => 3, 'uor' => 2],
        ['field_id' => 'vitals_summary', 'group_id' => '2', 'title' => 'Vitals summary (from triage)', 'seq' => 2, 'data_type' => 3, 'uor' => 1],
        ['field_id' => 'assessment', 'group_id' => '3', 'title' => 'Assessment / diagnosis', 'seq' => 1, 'data_type' => 3, 'uor' => 2],
        ['field_id' => 'plan', 'group_id' => '3', 'title' => 'Plan', 'seq' => 2, 'data_type' => 3, 'uor' => 2],
        ['field_id' => 'follow_up', 'group_id' => '4', 'title' => 'Follow-up instructions', 'seq' => 1, 'data_type' => 3, 'uor' => 1],
        ['field_id' => 'malaria_code', 'group_id' => '4', 'title' => 'Malaria quick code', 'seq' => 2, 'data_type' => 2, 'uor' => 1],
        ['field_id' => 'htn_code', 'group_id' => '4', 'title' => 'HTN quick code', 'seq' => 3, 'data_type' => 2, 'uor' => 1],
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
            [self::LBF_FORM_ID, 'Ghana OPD Consult']
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

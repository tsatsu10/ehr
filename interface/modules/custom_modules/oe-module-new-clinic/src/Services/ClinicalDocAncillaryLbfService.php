<?php

/**
 * M17 — Ancillary LBF layout packs (lab_intake, pharmacy_service) — PRD §17.3 step 8
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class ClinicalDocAncillaryLbfService
{
    public const PACK_LAB_INTAKE = 'lab_intake';
    public const PACK_PHARMACY_SERVICE = 'pharmacy_service';

    /** @var array<string, array{form_id: string, title: string, groups: list<array{group_id: string, title: string}>, fields: list<array{field_id: string, group_id: string, title: string, seq: int, data_type: int, uor: int}>}> */
    private const PACK_DEFS = [
        self::PACK_LAB_INTAKE => [
            'form_id' => 'LBFlab_intake',
            'title' => 'Lab intake',
            'groups' => [
                ['group_id' => '1', 'title' => 'Request'],
                ['group_id' => '2', 'title' => 'Specimen & routing'],
            ],
            'fields' => [
                ['field_id' => 'reason_for_test', 'group_id' => '1', 'title' => 'Reason for test', 'seq' => 1, 'data_type' => 3, 'uor' => 2],
                ['field_id' => 'tests_requested', 'group_id' => '1', 'title' => 'Tests requested', 'seq' => 2, 'data_type' => 3, 'uor' => 2],
                ['field_id' => 'clinical_notes', 'group_id' => '1', 'title' => 'Clinical notes', 'seq' => 3, 'data_type' => 3, 'uor' => 1],
                ['field_id' => 'specimen_type', 'group_id' => '2', 'title' => 'Specimen type', 'seq' => 1, 'data_type' => 2, 'uor' => 1],
                ['field_id' => 'fasting', 'group_id' => '2', 'title' => 'Fasting required', 'seq' => 2, 'data_type' => 1, 'uor' => 1],
                ['field_id' => 'lab_instructions', 'group_id' => '2', 'title' => 'Lab instructions', 'seq' => 3, 'data_type' => 3, 'uor' => 1],
            ],
        ],
        self::PACK_PHARMACY_SERVICE => [
            'form_id' => 'LBFpharmacy_service',
            'title' => 'Pharmacy service note',
            'groups' => [
                ['group_id' => '1', 'title' => 'Visit reason'],
                ['group_id' => '2', 'title' => 'Service & counseling'],
                ['group_id' => '3', 'title' => 'External paper Rx'],
            ],
            'fields' => [
                ['field_id' => 'reason_for_visit', 'group_id' => '1', 'title' => 'Reason for visit', 'seq' => 1, 'data_type' => 3, 'uor' => 2],
                ['field_id' => 'medications_requested', 'group_id' => '1', 'title' => 'Medications requested', 'seq' => 2, 'data_type' => 3, 'uor' => 2],
                ['field_id' => 'allergies_reviewed', 'group_id' => '2', 'title' => 'Allergies reviewed', 'seq' => 1, 'data_type' => 1, 'uor' => 1],
                ['field_id' => 'counseling_notes', 'group_id' => '2', 'title' => 'Counseling notes', 'seq' => 2, 'data_type' => 3, 'uor' => 1],
                ['field_id' => 'pharmacist_attestation', 'group_id' => '2', 'title' => 'Pharmacist attestation', 'seq' => 3, 'data_type' => 3, 'uor' => 2],
                ['field_id' => 'external_prescriber_name', 'group_id' => '3', 'title' => 'External prescriber name', 'seq' => 1, 'data_type' => 2, 'uor' => 2],
                ['field_id' => 'external_prescriber_reg_id', 'group_id' => '3', 'title' => 'Prescriber registration / ID', 'seq' => 2, 'data_type' => 2, 'uor' => 2],
                ['field_id' => 'external_rx_date', 'group_id' => '3', 'title' => 'Rx date', 'seq' => 3, 'data_type' => 4, 'uor' => 2],
            ],
        ],
    ];

    public function __construct(
        private readonly ClinicalDocCatalogService $catalog = new ClinicalDocCatalogService(),
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function getAllPackStatus(?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId < 0) {
            $facilityId = 0;
        }

        $statuses = [];
        foreach (array_keys(self::PACK_DEFS) as $packKey) {
            $statuses[] = $this->getPackStatus($packKey, $facilityId);
        }

        return $statuses;
    }

    /**
     * @return array<string, mixed>
     */
    public function getPackStatus(string $packKey, ?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId < 0) {
            $facilityId = 0;
        }

        $def = $this->packDef($packKey);

        return [
            'pack_key' => $packKey,
            'form_id' => $def['form_id'],
            'title' => $def['title'],
            'installed' => $this->isPackInstalled($packKey),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function importPack(string $packKey, int $facilityId, int $actorUserId): array
    {
        if ($facilityId < 0) {
            $facilityId = 0;
        }

        $def = $this->packDef($packKey);
        $alreadyInstalled = $this->isPackInstalled($packKey);
        if (!$alreadyInstalled) {
            $this->insertLayoutPack($packKey);
        } elseif ($packKey === self::PACK_PHARMACY_SERVICE) {
            $this->patchPharmacyServiceExternalRxFields();
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic_config',
            'clinical_doc_ancillary_lbf_import',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode([
                'pack_key' => $packKey,
                'form_id' => $def['form_id'],
                'facility_id' => $facilityId,
                'already_installed' => $alreadyInstalled,
            ]),
            0
        );

        return array_merge($this->getPackStatus($packKey, $facilityId), [
            'imported' => !$alreadyInstalled,
        ]);
    }

    public function isPackInstalled(string $packKey): bool
    {
        $def = $this->packDef($packKey);
        $row = QueryUtils::querySingleRow(
            "SELECT grp_form_id FROM layout_group_properties
             WHERE grp_form_id = ? AND grp_group_id = '' AND grp_activity = 1 LIMIT 1",
            [$def['form_id']]
        );

        return is_array($row);
    }

    /**
     * @return array{form_id: string, title: string, groups: list<array{group_id: string, title: string}>, fields: list<array{field_id: string, group_id: string, title: string, seq: int, data_type: int, uor: int}>}
     */
    private function packDef(string $packKey): array
    {
        $packKey = strtolower(trim($packKey));
        if (!isset(self::PACK_DEFS[$packKey])) {
            throw new \InvalidArgumentException('Unknown ancillary LBF pack: ' . $packKey);
        }

        return self::PACK_DEFS[$packKey];
    }

    private function insertLayoutPack(string $packKey): void
    {
        $def = $this->packDef($packKey);
        $formId = $def['form_id'];

        QueryUtils::sqlInsert(
            "INSERT INTO layout_group_properties
                (grp_form_id, grp_group_id, grp_title, grp_subtitle, grp_mapping, grp_seq, grp_activity, grp_repeats, grp_issue_type)
             VALUES (?, '', ?, '', 'Clinical', 10, 1, 0, '')",
            [$formId, $def['title']]
        );

        foreach ($def['groups'] as $group) {
            QueryUtils::sqlInsert(
                "INSERT INTO layout_group_properties
                    (grp_form_id, grp_group_id, grp_title, grp_subtitle, grp_mapping, grp_seq, grp_activity, grp_repeats, grp_issue_type)
                 VALUES (?, ?, ?, '', '', ?, 1, 0, '')",
                [
                    $formId,
                    $group['group_id'],
                    $group['title'],
                    (int) $group['group_id'],
                ]
            );
        }

        foreach ($def['fields'] as $field) {
            QueryUtils::sqlInsert(
                "INSERT INTO layout_options
                    (form_id, field_id, group_id, title, seq, data_type, uor, fld_length, max_length, list_id, titlecols, datacols, default_value, edit_options, description, source, conditions)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, '', 1, 3, '', '', '', 'F', '')",
                [
                    $formId,
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

    private function patchPharmacyServiceExternalRxFields(): void
    {
        $def = $this->packDef(self::PACK_PHARMACY_SERVICE);
        $formId = $def['form_id'];

        $existing = QueryUtils::querySingleRow(
            "SELECT field_id FROM layout_options
             WHERE form_id = ? AND field_id = 'external_prescriber_name' LIMIT 1",
            [$formId]
        );
        if (is_array($existing)) {
            return;
        }

        $group = ['group_id' => '3', 'title' => 'External paper Rx'];
        $groupRow = QueryUtils::querySingleRow(
            "SELECT grp_group_id FROM layout_group_properties
             WHERE grp_form_id = ? AND grp_group_id = ? LIMIT 1",
            [$formId, $group['group_id']]
        );
        if (!is_array($groupRow)) {
            QueryUtils::sqlInsert(
                "INSERT INTO layout_group_properties
                    (grp_form_id, grp_group_id, grp_title, grp_subtitle, grp_mapping, grp_seq, grp_activity, grp_repeats, grp_issue_type)
                 VALUES (?, ?, ?, '', '', ?, 1, 0, '')",
                [
                    $formId,
                    $group['group_id'],
                    $group['title'],
                    (int) $group['group_id'],
                ]
            );
        }

        foreach ($def['fields'] as $field) {
            if ($field['group_id'] !== '3') {
                continue;
            }
            QueryUtils::sqlInsert(
                "INSERT INTO layout_options
                    (form_id, field_id, group_id, title, seq, data_type, uor, fld_length, max_length, list_id, titlecols, datacols, default_value, edit_options, description, source, conditions)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, '', 1, 3, '', '', '', 'F', '')",
                [
                    $formId,
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

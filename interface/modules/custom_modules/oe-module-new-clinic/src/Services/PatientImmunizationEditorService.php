<?php

/**
 * Native immunization editor for the MRD Clinical tab (D-IMM-1).
 *
 * Replaces the stock immunizations.php edit path with a native drawer using a Ghana EPI
 * vaccine set. Writes the canonical `immunizations` table with a plain INSERT/UPDATE (no
 * stock `REPLACE INTO`, which carries the documented PDF-back re-add bug). The EPI vaccines
 * are seeded into the `immunizations` list_options (option_ids 500+) so the existing chart
 * read (PatientChartClinicalService::buildImmunizationsSection) resolves their names.
 *
 * Behind `enable_native_immunization_editor` (PRD §5.6, default OFF); the stock form stays the
 * fallback. Edit ACL mirrors stock immunizations.php (`patients` / `med`).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class PatientImmunizationEditorService
{
    /**
     * Ghana EPI vaccine set: list_options option_id => label. Kept in sync with the
     * `immunizations` list seed in install.sql. Option ids 500+ avoid the stock 1–35.
     */
    public const EPI_VACCINES = [
        '500' => 'BCG',
        '501' => 'OPV 0 (birth)',
        '502' => 'OPV 1',
        '503' => 'OPV 2',
        '504' => 'OPV 3',
        '505' => 'IPV',
        '506' => 'Pentavalent 1 (DTP-HepB-Hib)',
        '507' => 'Pentavalent 2',
        '508' => 'Pentavalent 3',
        '509' => 'PCV 1',
        '510' => 'PCV 2',
        '511' => 'PCV 3',
        '512' => 'Rotavirus 1',
        '513' => 'Rotavirus 2',
        '514' => 'Measles-Rubella 1',
        '515' => 'Measles-Rubella 2',
        '516' => 'Yellow Fever',
        '517' => 'Meningococcal A',
        '518' => 'Vitamin A',
        '519' => 'Td / TT (tetanus)',
        // Beyond routine childhood EPI — vaccines a Ghana/West Africa clinic gives across all ages.
        '520' => 'COVID-19',
        '521' => 'Malaria (RTS,S / R21)',
        '522' => 'HPV',
        '523' => 'Hepatitis B (adult)',
        '524' => 'Influenza (flu)',
        '525' => 'Rabies (post-exposure)',
        '526' => 'Typhoid conjugate',
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function isEnabled(?int $facilityId = null): bool
    {
        return $this->config->isEnabled('enable_native_immunization_editor', 0, $facilityId);
    }

    /**
     * Vaccine options for the drawer dropdown.
     *
     * @return array<int, array{id: string, label: string}>
     */
    public function vaccineOptions(): array
    {
        $out = [];
        foreach (self::EPI_VACCINES as $id => $label) {
            $out[] = ['id' => $id, 'label' => $label];
        }
        return $out;
    }

    /**
     * Load one shot's editable fields, scoped to the patient.
     *
     * @return array<string, mixed>
     */
    public function getShot(int $pid, int $id): array
    {
        if ($pid <= 0 || $id <= 0) {
            throw new \InvalidArgumentException('Invalid immunization reference', 400);
        }
        $row = QueryUtils::querySingleRow(
            "SELECT id, immunization_id, administered_date, lot_number, note, information_source
             FROM immunizations WHERE id = ? AND patient_id = ? AND added_erroneously = 0",
            [$id, $pid]
        );
        if (empty($row)) {
            throw new \InvalidArgumentException('Immunization not found', 404);
        }

        return [
            'id' => (int) $row['id'],
            'vaccine_id' => trim((string) ($row['immunization_id'] ?? '')),
            'administered_date' => $this->dateOnly($row['administered_date'] ?? null),
            'lot_number' => (string) ($row['lot_number'] ?? ''),
            'note' => (string) ($row['note'] ?? ''),
            'given_elsewhere' => ($row['information_source'] ?? '') === 'other_provider',
        ];
    }

    /**
     * Create or update an immunization. Returns the saved id.
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function saveShot(int $pid, array $input, int $actorUserId): array
    {
        if (!$this->isEnabled()) {
            throw new \RuntimeException('Native immunization editor is not enabled', 403);
        }
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Invalid patient', 400);
        }
        if (!AclMain::aclCheckCore('patients', 'med', '', ['write', 'addonly'])) {
            throw new \RuntimeException('You do not have permission to edit immunizations', 403);
        }

        $vaccineId = trim((string) ($input['vaccine_id'] ?? ''));
        if (!$this->isValidVaccine($vaccineId)) {
            throw new \InvalidArgumentException('Choose a vaccine');
        }
        $date = $this->normalizeDate($input['administered_date'] ?? null);
        if ($date === null) {
            throw new \InvalidArgumentException('Enter the date the vaccine was given');
        }
        $lot = mb_substr(trim((string) ($input['lot_number'] ?? '')), 0, 100);
        $note = mb_substr(trim((string) ($input['note'] ?? '')), 0, 2000);
        $source = !empty($input['given_elsewhere']) ? 'other_provider' : 'new_immunization_record';
        $id = (int) ($input['id'] ?? 0);

        if ($id > 0) {
            $owner = QueryUtils::querySingleRow(
                "SELECT id FROM immunizations WHERE id = ? AND patient_id = ?",
                [$id, $pid]
            );
            if (empty($owner)) {
                throw new \InvalidArgumentException('Immunization not found for this patient', 404);
            }
            QueryUtils::sqlStatementThrowException(
                "UPDATE immunizations SET immunization_id = ?, administered_date = ?, lot_number = ?,
                        note = ?, information_source = ?, updated_by = ?, update_date = NOW()
                 WHERE id = ?",
                [$vaccineId, $date, $lot, $note, $source, $actorUserId, $id]
            );
            $savedId = $id;
            $action = 'updated';
        } else {
            $savedId = (int) QueryUtils::sqlInsert(
                "INSERT INTO immunizations
                    (patient_id, immunization_id, administered_date, lot_number, note,
                     information_source, added_erroneously, created_by, administered_by_id,
                     create_date, update_date)
                 VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW())",
                [$pid, $vaccineId, $date, $lot, $note, $source, $actorUserId, $actorUserId]
            );
            $action = 'created';
        }

        EventAuditLogger::getInstance()->newEvent(
            'chart.immunization_edit',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            1,
            $action . ' immunization id=' . $savedId . ' vaccine=' . $vaccineId . ' pid=' . $pid . ' uid=' . $actorUserId,
            $pid
        );

        return ['id' => $savedId, 'status' => 'ok'];
    }

    /** Accept EPI keys, or any other active option already in the immunizations list (for edits). */
    private function isValidVaccine(string $vaccineId): bool
    {
        if ($vaccineId === '' || !ctype_digit($vaccineId)) {
            return false;
        }
        if (isset(self::EPI_VACCINES[$vaccineId])) {
            return true;
        }
        $exists = QueryUtils::querySingleRow(
            "SELECT option_id FROM list_options WHERE list_id = 'immunizations' AND option_id = ? AND activity = 1",
            [$vaccineId]
        );
        return !empty($exists);
    }

    private function normalizeDate(mixed $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            throw new \InvalidArgumentException('Dates must be YYYY-MM-DD');
        }
        return $value;
    }

    private function dateOnly(mixed $value): string
    {
        $value = trim((string) $value);
        if ($value === '' || str_starts_with($value, '0000')) {
            return '';
        }
        return substr($value, 0, 10);
    }
}

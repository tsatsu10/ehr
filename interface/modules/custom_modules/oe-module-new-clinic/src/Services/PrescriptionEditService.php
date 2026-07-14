<?php

/**
 * Native Add/Edit Prescription form (Pharmacy Desk "Add Rx", closes W-PHARM-RX).
 *
 * Replaces the stock `controller.php?prescription&edit` screen for the
 * Pharmacy Desk's "Add Rx" shortcut. Flag-gated by `enable_native_rx_edit`
 * (default OFF) via {@see PrescriptionEditPolicy} — flag off keeps the
 * existing 100% stock bridge (PharmacyShortcutService).
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
use OpenEMR\Common\Uuid\UuidRegistry;
use OpenEMR\Modules\NewClinic\Support\Sanitize;

class PrescriptionEditService
{
    public const SEARCH_LIMIT = 15;

    public function __construct(
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    private function assertAccess(): void
    {
        if (
            !AclMain::aclCheckCore('new_clinic', 'new_pharmacy')
            && !AclMain::aclCheckCore('new_clinic', 'new_pharmacy_lead')
            && !AclMain::aclCheckCore('new_clinic', 'new_admin')
        ) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    /**
     * PharmacyShortcutService::preflight() already requires 'in_pharmacy'
     * before it ever builds the redirect to this page, so under normal
     * navigation visit_id is guaranteed to be at that state -- but a stale
     * tab or bookmarked rx-edit.php URL can still present an old visit_id
     * that has since moved on (or never reached pharmacy at all). Without
     * this check, that would silently attach a new prescription to the
     * wrong encounter instead of the one currently at the pharmacy desk.
     *
     * @param array<string, mixed> $visit
     */
    private function assertVisitInPharmacy(array $visit): void
    {
        if (($visit['state'] ?? '') !== 'in_pharmacy') {
            throw new \InvalidArgumentException('Visit is not in active pharmacy work');
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function getFormData(int $visitId, int $prescriptionId = 0): array
    {
        $this->assertAccess();

        $visit = $this->queueService->getVisitForActor($visitId);
        $this->assertVisitInPharmacy($visit);
        $pid = (int) ($visit['pid'] ?? 0);
        $encounter = (int) ($visit['encounter'] ?? 0);
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Visit has no patient');
        }
        $this->facilityScope->assertPatientAccessible($pid);

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        if ($facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        $existing = $prescriptionId > 0 ? $this->loadPrescription($prescriptionId, $pid, $encounter) : null;

        return [
            'visit_id' => $visitId,
            'pid' => $pid,
            'encounter' => $encounter,
            'facility_id' => $facilityId,
            'patient_name' => $this->resolvePatientName($pid),
            'allergies' => $this->loadAllergies($pid),
            'existing_prescriptions' => $this->loadActivePrescriptions($pid, $encounter),
            'route_options' => $this->fetchListOptions('drug_route'),
            'interval_options' => $this->fetchListOptions('drug_interval'),
            'form_options' => $this->fetchListOptions('drug_form'),
            'currency_symbol' => (string) $this->config->get('currency_symbol', 'GH₵', $facilityId),
            'prescription' => $existing,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function searchDrugs(int $visitId, string $query): array
    {
        $this->assertAccess();

        $query = Sanitize::searchToken($query);
        if (mb_strlen($query) < 2) {
            return [];
        }

        // Derive pid from the visit server-side (never trust a client-supplied
        // pid for scoping) -- otherwise an arbitrary pid would let a caller
        // probe another, possibly inaccessible, patient's allergy list via the
        // allergy_match flag on each result row.
        $visit = $this->queueService->getVisitForActor($visitId);
        $pid = (int) ($visit['pid'] ?? 0);
        if ($pid > 0) {
            $this->facilityScope->assertPatientAccessible($pid);
        }

        $allergies = $pid > 0 ? $this->loadAllergies($pid) : [];

        $rows = QueryUtils::fetchRecords(
            "SELECT d.drug_id, d.name, d.form, d.size, d.unit, d.route
             FROM drugs d
             WHERE d.active = 1 AND d.name LIKE ?
             ORDER BY d.name ASC
             LIMIT " . self::SEARCH_LIMIT,
            ['%' . $query . '%']
        ) ?: [];

        return array_map(function (array $row) use ($allergies): array {
            $name = (string) ($row['name'] ?? '');

            return [
                'drug_id' => (int) ($row['drug_id'] ?? 0),
                'name' => $name,
                'display_name' => $this->formatDrugDisplayName($row),
                'form' => (string) ($row['form'] ?? ''),
                'route' => (string) ($row['route'] ?? ''),
                'allergy_match' => PharmOpsSafetyService::hasDrugAllergyWarning($name, $allergies),
            ];
        }, $rows);
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function savePrescription(array $input, int $actorUserId): array
    {
        $this->assertAccess();

        $visitId = (int) ($input['visit_id'] ?? 0);
        $visit = $this->queueService->getVisitForActor($visitId);
        $this->assertVisitInPharmacy($visit);
        $pid = (int) ($visit['pid'] ?? 0);
        $encounter = (int) ($visit['encounter'] ?? 0);
        if ($pid <= 0 || $encounter <= 0) {
            throw new \InvalidArgumentException('Visit has no encounter for prescribing');
        }
        $this->facilityScope->assertPatientAccessible($pid);

        $drugName = trim((string) ($input['drug_name'] ?? ''));
        if ($drugName === '') {
            throw new \InvalidArgumentException('A medication name is required');
        }

        // Mirrors PharmOpsDispenseService::confirmDispense()'s server-side gate --
        // the frontend disables Save while an allergy warning is unacknowledged,
        // but that alone is a client-side-only guard; a direct API call must be
        // rejected the same way a direct dispense-confirm call already is.
        $allergies = $this->loadAllergies($pid);
        if (PharmOpsSafetyService::hasDrugAllergyWarning($drugName, $allergies) && empty($input['allergy_acknowledged'])) {
            throw new \InvalidArgumentException('Acknowledge allergy warning before saving');
        }

        $drugId = (int) ($input['drug_id'] ?? 0);
        $dosage = mb_substr(trim((string) ($input['dosage'] ?? '')), 0, 100);
        $quantity = mb_substr(trim((string) ($input['quantity'] ?? '')), 0, 25);
        if ($quantity === '') {
            $quantity = '1';
        }
        $route = mb_substr(trim((string) ($input['route'] ?? '')), 0, 20);
        $interval = mb_substr(trim((string) ($input['interval'] ?? '')), 0, 20);
        $refills = max(0, (int) ($input['refills'] ?? 0));
        $note = mb_substr(trim((string) ($input['note'] ?? '')), 0, 255);
        $sig = mb_substr(trim((string) ($input['sig'] ?? '')), 0, 255);
        $prn = !empty($input['prn']);
        $startDate = $this->normalizeDate($input['start_date'] ?? null) ?? date('Y-m-d');
        $endDate = $this->normalizeDate($input['end_date'] ?? null);

        $prescriptionId = (int) ($input['prescription_id'] ?? 0);
        $providerId = $this->resolveProviderId($pid, $encounter, $actorUserId);

        if ($prescriptionId > 0) {
            $this->assertPrescriptionBelongsToVisit($prescriptionId, $pid, $encounter);
            QueryUtils::sqlStatementThrowException(
                'UPDATE prescriptions
                 SET drug = ?, drug_id = ?, dosage = ?, quantity = ?, route = ?, `interval` = ?,
                     refills = ?, note = ?, drug_dosage_instructions = ?, prn = ?,
                     start_date = ?, end_date = ?, date_modified = NOW(), updated_by = ?
                 WHERE id = ?',
                [
                    $drugName, $drugId, $dosage, $quantity, $route !== '' ? $route : null,
                    $interval !== '' ? $interval : null, $refills, $note,
                    $sig !== '' ? $sig : $dosage, $prn ? 1 : 0,
                    $startDate, $endDate, $actorUserId, $prescriptionId,
                ]
            );
            $action = 'updated';
        } else {
            $uuid = UuidRegistry::getRegistryForTable('prescriptions')->createUuid();
            $now = date('Y-m-d H:i:s');
            $user = (string) ($_SESSION['authUser'] ?? '');
            $prescriptionId = (int) QueryUtils::sqlInsert(
                'INSERT INTO prescriptions (
                    uuid, patient_id, provider_id, encounter, date_added, date_modified,
                    start_date, end_date, drug, drug_id, dosage, quantity, route, `interval`,
                    refills, active, user, txDate, drug_dosage_instructions, prn,
                    usage_category, usage_category_title, request_intent, request_intent_title,
                    note, created_by, updated_by
                 ) VALUES (
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, 1, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?
                 )',
                [
                    $uuid, $pid, $providerId, $encounter, $now, $now,
                    $startDate, $endDate, $drugName, $drugId, $dosage, $quantity,
                    $route !== '' ? $route : null, $interval !== '' ? $interval : null,
                    $refills, $user, date('Y-m-d'), $sig !== '' ? $sig : $dosage, $prn ? 1 : 0,
                    'outpatient', 'Home/Community', 'order', 'Order',
                    $note, $actorUserId, $actorUserId,
                ]
            );
            $action = 'created';
        }

        UuidRegistry::createMissingUuidsForTables(['prescriptions']);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy.rx_' . $action,
            $actorUserId,
            1,
            'prescription_id=' . $prescriptionId . ' visit_id=' . $visitId . ' drug=' . $drugName
        );

        return [
            'prescription_id' => $prescriptionId,
            'action' => $action,
            'existing_prescriptions' => $this->loadActivePrescriptions($pid, $encounter),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function loadPrescription(int $prescriptionId, int $pid, int $encounter): ?array
    {
        $row = QueryUtils::querySingleRow(
            'SELECT id, drug, drug_id, dosage, quantity, route, `interval`, refills, note,
                    drug_dosage_instructions, prn, start_date, end_date
             FROM prescriptions
             WHERE id = ? AND patient_id = ? AND encounter = ? AND active = 1',
            [$prescriptionId, $pid, $encounter]
        );

        if (!is_array($row)) {
            return null;
        }

        return [
            'prescription_id' => (int) $row['id'],
            'drug_name' => (string) ($row['drug'] ?? ''),
            'drug_id' => (int) ($row['drug_id'] ?? 0),
            'dosage' => (string) ($row['dosage'] ?? ''),
            'quantity' => (string) ($row['quantity'] ?? ''),
            'route' => (string) ($row['route'] ?? ''),
            'interval' => (string) ($row['interval'] ?? ''),
            'refills' => (int) ($row['refills'] ?? 0),
            'note' => (string) ($row['note'] ?? ''),
            'sig' => (string) ($row['drug_dosage_instructions'] ?? ''),
            'prn' => (int) ($row['prn'] ?? 0) === 1,
            'start_date' => $this->cleanDate($row['start_date'] ?? null),
            'end_date' => $this->cleanDate($row['end_date'] ?? null),
        ];
    }

    /**
     * Scoped to the visit's own encounter, not just the patient -- a prescription
     * from a different (e.g. older) encounter for the same patient must never be
     * silently rewritten by this visit's Add Rx form.
     */
    private function assertPrescriptionBelongsToVisit(int $prescriptionId, int $pid, int $encounter): void
    {
        $row = QueryUtils::querySingleRow(
            'SELECT id FROM prescriptions WHERE id = ? AND patient_id = ? AND encounter = ?',
            [$prescriptionId, $pid, $encounter]
        );
        if (!is_array($row) || empty($row['id'])) {
            throw new \InvalidArgumentException('Prescription does not belong to this visit');
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadActivePrescriptions(int $pid, int $encounter): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT id, drug, dosage, quantity, route, `interval`, refills, prn, start_date, end_date
             FROM prescriptions
             WHERE patient_id = ? AND encounter = ? AND active = 1
             ORDER BY date_added DESC',
            [$pid, $encounter]
        ) ?: [];

        return array_map(fn (array $row): array => [
            'prescription_id' => (int) $row['id'],
            'drug_name' => (string) ($row['drug'] ?? ''),
            'dosage' => (string) ($row['dosage'] ?? ''),
            'quantity' => (string) ($row['quantity'] ?? ''),
            'route' => (string) ($row['route'] ?? ''),
            'interval' => (string) ($row['interval'] ?? ''),
            'refills' => (int) ($row['refills'] ?? 0),
            'prn' => (int) ($row['prn'] ?? 0) === 1,
            'start_date' => $this->cleanDate($row['start_date'] ?? null),
            'end_date' => $this->cleanDate($row['end_date'] ?? null),
        ], $rows);
    }

    /**
     * @return list<string>
     */
    private function loadAllergies(int $pid): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT title FROM lists WHERE pid = ? AND type = 'allergy' AND activity = 1 ORDER BY id ASC",
            [$pid]
        ) ?: [];

        $titles = [];
        foreach ($rows as $row) {
            $title = trim((string) ($row['title'] ?? ''));
            if ($title !== '' && !PharmOpsSafetyService::isNkdaTitle($title)) {
                $titles[] = $title;
            }
        }

        return $titles;
    }

    private function resolvePatientName(int $pid): string
    {
        $row = QueryUtils::querySingleRow('SELECT fname, lname FROM patient_data WHERE pid = ?', [$pid]);
        if (!is_array($row)) {
            return '';
        }

        return trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? ''));
    }

    private function resolveProviderId(int $pid, int $encounter, int $actorUserId): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT provider_id FROM form_encounter WHERE pid = ? AND encounter = ?',
            [$pid, $encounter]
        );
        $providerId = is_array($row) ? (int) ($row['provider_id'] ?? 0) : 0;

        return $providerId > 0 ? $providerId : $actorUserId;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchListOptions(string $listId): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT option_id, title FROM list_options
             WHERE list_id = ? AND activity = 1 ORDER BY seq, title',
            [$listId]
        ) ?: [];

        return array_map(
            static fn (array $r): array => [
                'id' => (string) ($r['option_id'] ?? ''),
                'title' => (string) ($r['title'] ?? ''),
            ],
            $rows
        );
    }

    private function formatDrugDisplayName(array $row): string
    {
        $name = trim((string) ($row['name'] ?? 'Medication'));
        $strength = trim((string) ($row['size'] ?? ''));
        $unit = trim((string) ($row['unit'] ?? ''));
        $form = trim((string) ($row['form'] ?? ''));
        $parts = array_filter([$name, trim($strength . $unit), $form]);

        return implode(' ', $parts);
    }

    private function normalizeDate(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));
        if ($text === '') {
            return null;
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $text)) {
            throw new \InvalidArgumentException('Invalid date: ' . $text);
        }

        return $text;
    }

    private function cleanDate(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));
        if ($text === '' || str_starts_with($text, '0000-00-00')) {
            return null;
        }

        return $text;
    }
}

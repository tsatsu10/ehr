<?php

/**
 * M13-F10 / M4-F38 / M9-F20 — Print Rx pack (community pharmacy PDF)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class PharmOpsRxPrintService
{
    public function __construct(
        private readonly PharmOpsAccessService $access = new PharmOpsAccessService(),
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function preparePrint(int $prescriptionId, int $actorUserId): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId();
        $this->access->assertRxPrintAccess($facilityId);

        $payload = $this->buildPrintPayload($prescriptionId, $facilityId);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy_ops.rx_printed',
            $actorUserId,
            1,
            'prescription_id=' . $prescriptionId
                . ' encounter_id=' . (int) ($payload['encounter_id'] ?? 0)
                . ' pid=' . (int) ($payload['patient']['pid'] ?? 0)
        );

        $webroot = $GLOBALS['webroot'] ?? '';

        return [
            'prescription_id' => $prescriptionId,
            'print_url' => $webroot
                . '/interface/modules/custom_modules/oe-module-new-clinic/public/rx-print.php?prescription_id='
                . urlencode((string) $prescriptionId),
            'patient_label' => (string) ($payload['patient']['display_name'] ?? ''),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function buildPrintPayload(int $prescriptionId, ?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        $this->access->assertRxPrintAccess($facilityId);

        $row = $this->loadPrescriptionRow($prescriptionId);
        $pid = (int) ($row['patient_id'] ?? 0);
        $encounterId = (int) ($row['encounter'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);
        $this->facilityScope->assertEncounterAtDeskFacility($encounterId, $pid, $facilityId);

        $patient = $this->mapPatientBlock($row);
        $drug = $this->mapDrugBlock($row);
        $prescriber = $this->mapPrescriberBlock($row);
        $clinic = $this->mapClinicBlock($row, $facilityId);
        $currencySymbol = (string) $this->config->get('currency_symbol', 'GH₵', $facilityId);

        return [
            'prescription_id' => $prescriptionId,
            'encounter_id' => (int) ($row['encounter'] ?? 0),
            'patient' => $patient,
            'drug' => $drug,
            'prescriber' => $prescriber,
            'clinic' => $clinic,
            'currency_symbol' => $currencySymbol,
            'printed_at' => date('Y-m-d H:i'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function loadPrescriptionRow(int $prescriptionId): array
    {
        if ($prescriptionId <= 0) {
            throw new \InvalidArgumentException('Prescription is required');
        }

        $row = QueryUtils::querySingleRow(
            "SELECT rx.id, rx.patient_id, rx.encounter, rx.drug, rx.drug_id, rx.dosage, rx.quantity,
                    rx.route, rx.`interval`, rx.refills, rx.note, rx.start_date, rx.end_date,
                    rx.drug_dosage_instructions, rx.provider_id,
                    pd.fname, pd.lname, pd.pubpid, pd.DOB, pd.sex,
                    fe.facility_id, fe.date AS encounter_date,
                    u.fname AS prov_fname, u.lname AS prov_lname, u.npi AS prov_npi,
                    f.name AS facility_name, f.phone AS facility_phone,
                    f.street AS facility_street, f.city AS facility_city, f.state AS facility_state
             FROM prescriptions rx
             INNER JOIN patient_data pd ON pd.pid = rx.patient_id
             LEFT JOIN form_encounter fe ON fe.encounter = rx.encounter AND fe.pid = rx.patient_id
             LEFT JOIN users u ON u.id = COALESCE(NULLIF(rx.provider_id, 0), fe.provider_id)
             LEFT JOIN facility f ON f.id = COALESCE(NULLIF(fe.facility_id, 0), 0)
             WHERE rx.id = ? AND rx.active = 1
             LIMIT 1",
            [$prescriptionId]
        );

        if (!is_array($row)) {
            throw new \InvalidArgumentException('Prescription not found');
        }

        return $row;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapPatientBlock(array $row): array
    {
        $fname = trim((string) ($row['fname'] ?? ''));
        $lname = trim((string) ($row['lname'] ?? ''));
        $displayName = trim($fname . ' ' . $lname);
        if ($displayName === '') {
            $displayName = 'Patient';
        }

        $dob = trim((string) ($row['DOB'] ?? ''));
        $sex = trim((string) ($row['sex'] ?? ''));

        return [
            'pid' => (int) ($row['patient_id'] ?? 0),
            'display_name' => $displayName,
            'mrn' => (string) ($row['pubpid'] ?? ''),
            'age_display' => self::formatAgeDisplay($dob),
            'sex_display' => self::formatSexLabel($sex),
            'dob' => $dob !== '' && !str_starts_with($dob, '0000') ? $dob : null,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapDrugBlock(array $row): array
    {
        $generic = trim((string) ($row['drug'] ?? 'Medication'));
        $instructions = trim((string) ($row['drug_dosage_instructions'] ?? ''));
        $sig = $instructions !== ''
            ? $instructions
            : self::formatSig(
                (string) ($row['dosage'] ?? ''),
                (string) ($row['route'] ?? ''),
                $row['interval'] ?? null
            );

        return [
            'generic_name' => $generic,
            'display_name' => $generic,
            'sig' => $sig,
            'quantity' => trim((string) ($row['quantity'] ?? '')),
            'refills' => (int) ($row['refills'] ?? 0),
            'start_date' => self::formatDisplayDate((string) ($row['start_date'] ?? '')),
            'end_date' => self::formatDisplayDate((string) ($row['end_date'] ?? '')),
            'note' => trim((string) ($row['note'] ?? '')),
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapPrescriberBlock(array $row): array
    {
        $fname = trim((string) ($row['prov_fname'] ?? ''));
        $lname = trim((string) ($row['prov_lname'] ?? ''));
        $name = trim($fname . ' ' . $lname);

        return [
            'display_name' => $name !== '' ? $name : 'Prescriber',
            'reg_number' => trim((string) ($row['prov_npi'] ?? '')),
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapClinicBlock(array $row, int $facilityId): array
    {
        $name = trim((string) ($row['facility_name'] ?? ''));
        if ($name === '') {
            $name = trim((string) ($GLOBALS['openemr_name'] ?? 'Clinic'));
        }

        $street = trim((string) ($row['facility_street'] ?? ''));
        $city = trim((string) ($row['facility_city'] ?? ''));
        $state = trim((string) ($row['facility_state'] ?? ''));
        $addressParts = array_filter([$street, $city, $state]);

        return [
            'name' => $name,
            'phone' => trim((string) ($row['facility_phone'] ?? '')),
            'address' => implode(', ', $addressParts),
            'facility_id' => (int) ($row['facility_id'] ?? $facilityId),
        ];
    }

    public static function formatSig(string $dosage, string $route, mixed $interval): string
    {
        $parts = array_filter([
            trim($dosage),
            trim($route),
            is_numeric($interval) && (int) $interval > 0 ? 'q' . (int) $interval : '',
        ]);

        return implode(' ', $parts);
    }

    public static function formatAgeDisplay(string $dob): ?string
    {
        $dob = trim($dob);
        if ($dob === '' || str_starts_with($dob, '0000')) {
            return null;
        }

        $birth = strtotime($dob);
        if ($birth === false) {
            return null;
        }

        $now = time();
        $years = (int) floor(($now - $birth) / (365.25 * 24 * 60 * 60));
        if ($years < 0) {
            return null;
        }

        return $years . 'y';
    }

    public static function formatSexLabel(string $sex): ?string
    {
        $sex = strtolower(trim($sex));
        if ($sex === 'male' || $sex === 'm') {
            return 'Male';
        }
        if ($sex === 'female' || $sex === 'f') {
            return 'Female';
        }

        return $sex !== '' ? ucfirst($sex) : null;
    }

    private static function formatDisplayDate(string $value): ?string
    {
        $value = trim($value);
        if ($value === '' || str_starts_with($value, '0000')) {
            return null;
        }

        $ts = strtotime($value);

        return $ts === false ? $value : date('d M Y', $ts);
    }
}

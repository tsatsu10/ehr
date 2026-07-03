<?php

/**
 * M13-F15 — Post-dispense patient label (wrap stock label flow)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class PharmOpsDispenseLabelService
{
    public function __construct(
        private readonly PharmOpsAccessService $access = new PharmOpsAccessService(),
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function preparePrint(int $saleId, int $actorUserId): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId();
        $this->access->assertDispenseLabelAccess($facilityId);

        $payload = $this->buildPrintPayload($saleId, $facilityId);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy_ops.dispense_label_printed',
            $actorUserId,
            1,
            'sale_id=' . $saleId
                . ' prescription_id=' . (int) ($payload['prescription_id'] ?? 0)
                . ' pid=' . (int) ($payload['patient']['pid'] ?? 0)
        );

        $webroot = $GLOBALS['webroot'] ?? '';

        return [
            'sale_id' => $saleId,
            'print_url' => $webroot
                . '/interface/modules/custom_modules/oe-module-new-clinic/public/dispense-label.php?sale_id='
                . urlencode((string) $saleId),
            'patient_label' => (string) ($payload['patient']['display_name'] ?? ''),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function buildPrintPayload(int $saleId, ?int $facilityId = null): array
    {
        if ($saleId <= 0) {
            throw new \InvalidArgumentException('Sale id is required');
        }

        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        $this->access->assertDispenseLabelAccess($facilityId);

        $row = $this->loadSaleRow($saleId);
        $pid = (int) ($row['pid'] ?? 0);
        $encounterId = (int) ($row['encounter'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);
        $this->facilityScope->assertEncounterAtDeskFacility($encounterId, $pid, $facilityId);

        return [
            'sale_id' => $saleId,
            'prescription_id' => (int) ($row['prescription_id'] ?? 0) ?: null,
            'patient' => $this->mapPatientBlock($row),
            'drug' => $this->mapDrugBlock($row),
            'lot' => $this->mapLotBlock($row),
            'prescriber' => $this->mapPrescriberBlock($row),
            'clinic' => $this->mapClinicBlock($row, $facilityId),
            'counseling' => [
                'english' => 'Take as directed. Finish all doses even if you feel better.',
                'twi' => 'Fa den sɛ wɔkyerɛkyerɛ wo. Di nyinaa wɔ bere a wɔde ama wo.',
            ],
            'dispensed_at' => self::formatDisplayDate((string) ($row['sale_date'] ?? date('Y-m-d'))),
            'printed_at' => date('Y-m-d H:i'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function loadSaleRow(int $saleId): array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT s.sale_id, s.pid, s.quantity, s.prescription_id, s.sale_date, s.encounter,
                    i.manufacturer, i.lot_number, i.expiration,
                    d.name AS drug_catalog_name, d.ndc_number, d.form, d.size, d.unit,
                    rx.drug, rx.dosage, rx.route, rx.`interval`, rx.drug_dosage_instructions,
                    rx.provider_id, rx.date_modified,
                    pd.fname, pd.lname, pd.pubpid,
                    u.fname AS prov_fname, u.lname AS prov_lname,
                    fe.facility_id,
                    f.name AS facility_name, f.phone AS facility_phone,
                    f.street AS facility_street, f.city AS facility_city, f.state AS facility_state
             FROM drug_sales s
             INNER JOIN patient_data pd ON pd.pid = s.pid
             LEFT JOIN drug_inventory i ON i.inventory_id = s.inventory_id
             LEFT JOIN drugs d ON d.drug_id = s.drug_id
             LEFT JOIN prescriptions rx ON rx.id = s.prescription_id AND rx.active = 1
             LEFT JOIN form_encounter fe ON fe.encounter = s.encounter AND fe.pid = s.pid
             LEFT JOIN users u ON u.id = COALESCE(NULLIF(rx.provider_id, 0), fe.provider_id)
             LEFT JOIN facility f ON f.id = COALESCE(NULLIF(fe.facility_id, 0), 0)
             WHERE s.sale_id = ?
             LIMIT 1",
            [$saleId]
        );

        if (!is_array($row)) {
            throw new \InvalidArgumentException('Dispense sale not found');
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

        return [
            'pid' => (int) ($row['pid'] ?? 0),
            'display_name' => $displayName !== '' ? $displayName : 'Patient',
            'mrn' => (string) ($row['pubpid'] ?? ''),
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapDrugBlock(array $row): array
    {
        $generic = trim((string) ($row['drug'] ?? ''));
        if ($generic === '') {
            $generic = trim((string) ($row['drug_catalog_name'] ?? 'Medication'));
        }

        $instructions = trim((string) ($row['drug_dosage_instructions'] ?? ''));
        $sig = $instructions !== ''
            ? $instructions
            : PharmOpsRxPrintService::formatSig(
                (string) ($row['dosage'] ?? ''),
                (string) ($row['route'] ?? ''),
                $row['interval'] ?? null
            );

        $size = trim((string) ($row['size'] ?? ''));
        $form = trim((string) ($row['form'] ?? ''));

        return [
            'display_name' => $generic,
            'sig' => $sig,
            'quantity' => (float) ($row['quantity'] ?? 0),
            'size' => $size !== '' ? $size : null,
            'form' => $form !== '' ? $form : null,
            'ndc' => trim((string) ($row['ndc_number'] ?? '')) ?: null,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapLotBlock(array $row): array
    {
        $expiration = trim((string) ($row['expiration'] ?? ''));

        return [
            'lot_number' => trim((string) ($row['lot_number'] ?? '')) ?: null,
            'expiration' => $expiration !== '' && !str_starts_with($expiration, '0000')
                ? self::formatDisplayDate($expiration)
                : null,
            'manufacturer' => trim((string) ($row['manufacturer'] ?? '')) ?: null,
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
            'display_name' => $name !== '' ? $name : null,
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

    public static function formatDisplayDate(string $value): ?string
    {
        $value = trim($value);
        if ($value === '' || str_starts_with($value, '0000')) {
            return null;
        }

        $ts = strtotime($value);

        return $ts === false ? $value : date('d M Y', $ts);
    }
}

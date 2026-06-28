<?php

/**
 * MRD Clinical meds strip (MRD §8.10.5 / M13 entry)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class ClinicalMedsSummaryService
{
    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly PharmacyService $pharmacyService = new PharmacyService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getClinicalStrip(int $pid, ?int $encounterId = null): array
    {
        $this->facilityScope->assertPatientAccessible($pid);

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $webroot = $GLOBALS['webroot'] ?? '';
        $encounterId = $this->resolveEncounterId($pid, $encounterId);

        if (!$this->isMedsStripEnabled($facilityId)) {
            return $this->hiddenStripPayload($webroot, $pid);
        }

        $prescriptions = $encounterId > 0
            ? $this->pharmacyService->getPrescriptionsForEncounter($pid, $encounterId)
            : [];
        $undispensedCount = $this->countUndispensed($prescriptions);
        $lastDispense = $this->resolveLastDispense($pid);
        $hasHistory = $this->patientHasMedicationHistory($pid);
        $stripLabel = $this->buildStripLabel($undispensedCount, $prescriptions, $lastDispense);
        $hidden = $undispensedCount === 0
            && $lastDispense === null
            && $prescriptions === []
            && !$hasHistory;

        $canOpenPharmOps = AclMain::aclCheckCore('new_clinic', 'new_pharmacy')
            || AclMain::aclCheckCore('new_clinic', 'new_pharmacy_lead')
            || AclMain::aclCheckCore('new_clinic', 'new_admin');

        $pharmOpsUrl = $webroot
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/pharmacy.php';

        return [
            'hidden' => $hidden,
            'encounter_id' => $encounterId > 0 ? $encounterId : null,
            'undispensed_count' => $undispensedCount,
            'undispensed_warning' => $undispensedCount > 0,
            'last_dispense' => $lastDispense,
            'has_history' => $hasHistory,
            'meds_strip_label' => $stripLabel,
            'can_open_pharm_ops' => $canOpenPharmOps,
            'pharm_ops_url' => $canOpenPharmOps ? $pharmOpsUrl : null,
            'view_meds_anchor' => 'clinical-meds',
            'stock_rx_url' => $this->pharmacyService->rxListUrl($pid),
        ];
    }

    private function isMedsStripEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_pharmacy_role', 0, $facilityId) === 1
            && $this->config->getInt('enable_pharm_ops', 0, $facilityId) === 1;
    }

    /**
     * @param array<int, array<string, mixed>> $prescriptions
     */
    private function countUndispensed(array $prescriptions): int
    {
        $count = 0;
        foreach ($prescriptions as $rx) {
            if (($rx['status'] ?? '') === 'to_dispense') {
                $count++;
            }
        }

        return $count;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveLastDispense(int $pid): ?array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT drug, dosage, quantity, filled_date, start_date
             FROM prescriptions
             WHERE patient_id = ? AND active = 1
               AND filled_date IS NOT NULL AND filled_date != '' AND filled_date != '0000-00-00'
             ORDER BY filled_date DESC, id DESC
             LIMIT 1",
            [$pid]
        );

        if (!is_array($row)) {
            return null;
        }

        $label = trim((string) ($row['drug'] ?? 'Medication'));
        $dosage = trim((string) ($row['dosage'] ?? ''));
        if ($dosage !== '') {
            $label .= ' ' . $dosage;
        }

        $at = $this->formatDate((string) ($row['filled_date'] ?? $row['start_date'] ?? ''));

        return [
            'label' => $label,
            'quantity' => trim((string) ($row['quantity'] ?? '')),
            'at' => $at,
        ];
    }

    private function patientHasMedicationHistory(int $pid): bool
    {
        $row = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS cnt FROM prescriptions WHERE patient_id = ? AND active = 1',
            [$pid]
        );

        return is_array($row) && (int) ($row['cnt'] ?? 0) > 0;
    }

    /**
     * @param array<int, array<string, mixed>> $prescriptions
     * @param array<string, mixed>|null $lastDispense
     */
    private function buildStripLabel(int $undispensedCount, array $prescriptions, ?array $lastDispense): string
    {
        if ($undispensedCount > 0) {
            return $undispensedCount === 1
                ? '1 Rx pending dispense on today\'s visit'
                : $undispensedCount . ' Rx pending dispense on today\'s visit';
        }

        if ($lastDispense !== null) {
            $line = 'Last: ' . ($lastDispense['label'] ?? 'Medication');
            if (!empty($lastDispense['at'])) {
                $line .= ' (' . $lastDispense['at'] . ')';
            }

            return $line;
        }

        if ($prescriptions !== []) {
            return 'Prescriptions on file for this visit';
        }

        return 'No medications on file for this visit';
    }

    private function resolveEncounterId(int $pid, ?int $encounterId): int
    {
        return $this->visitScope->resolveActiveEncounterId($pid, $encounterId);
    }

    /**
     * @return array<string, mixed>
     */
    private function hiddenStripPayload(string $webroot, int $pid): array
    {
        return [
            'hidden' => true,
            'encounter_id' => null,
            'undispensed_count' => 0,
            'undispensed_warning' => false,
            'last_dispense' => null,
            'has_history' => false,
            'meds_strip_label' => null,
            'can_open_pharm_ops' => false,
            'pharm_ops_url' => null,
            'view_meds_anchor' => 'clinical-meds',
            'stock_rx_url' => $this->pharmacyService->rxListUrl($pid),
        ];
    }

    private function formatDate(string $date): ?string
    {
        if ($date === '' || str_starts_with($date, '0000-00-00')) {
            return null;
        }

        try {
            return (new \DateTime($date))->format('j M Y');
        } catch (\Exception) {
            return null;
        }
    }
}

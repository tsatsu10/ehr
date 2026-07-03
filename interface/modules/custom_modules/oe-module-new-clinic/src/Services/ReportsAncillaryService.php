<?php

/**
 * M7-F18 ancillary services outcomes report (V1.1-ANC)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ReportsAncillaryService
{
    /** @var array<int, string> */
    public const PHARMACY_OUTCOMES = [
        'otc_dispensed',
        'external_rx_dispensed',
        'rx_required_refer_to_opd',
        'rx_required_no_doctor_available',
        'rx_required_patient_declined',
    ];

    /** @var array<int, string> */
    public const SERVICE_PROFILES = ['full_opd', 'lab_direct', 'pharmacy_walkin'];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
    ) {
    }

    public function isEnabled(int $facilityId): bool
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);

        return $this->config->getInt('enable_ancillary_services', 0, $facilityId) === 1;
    }

    /**
     * @return array<string, mixed>
     */
    public function getReport(int $facilityId, ?string $startDate = null, ?string $endDate = null): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        [$startDate, $endDate] = $this->normalizeDateRange($startDate, $endDate);

        if (!$this->isEnabled($facilityId)) {
            return [
                'enabled' => false,
                'start_date' => $startDate,
                'end_date' => $endDate,
            ];
        }

        $referWindowHours = $this->referWindowHours($facilityId);

        return [
            'enabled' => true,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'refer_window_hours' => $referWindowHours,
            'by_service_profile' => $this->countByServiceProfile($facilityId, $startDate, $endDate),
            'pharmacy_outcomes' => $this->countPharmacyOutcomes($facilityId, $startDate, $endDate),
            'lab_direct_without_referral' => $this->countLabDirectWithoutReferral($facilityId, $startDate, $endDate),
            'pharmacy_to_opd_chains' => $this->countPharmacyToOpdChains($facilityId, $startDate, $endDate, $referWindowHours),
            'wrong_visit_type_cancels' => $this->countWrongVisitTypeCancels($facilityId, $startDate, $endDate),
        ];
    }

    /**
     * @return array{filename: string, content: string, row_count: int}
     */
    public function exportCsv(int $facilityId, ?string $startDate = null, ?string $endDate = null): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        [$startDate, $endDate] = $this->normalizeDateRange($startDate, $endDate);

        if (!$this->isEnabled($facilityId)) {
            throw new \RuntimeException('Ancillary services reporting is not enabled for this clinic');
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT nv.id, nv.visit_date, nv.queue_number, nv.service_profile, nv.state,
                    nv.pharmacy_outcome, nv.referral_document_id, nv.referred_to_visit_id,
                    nv.cancel_reason, pat.fname, pat.lname, pat.pubpid
             FROM new_visit nv
             INNER JOIN patient_data pat ON pat.pid = nv.pid
             WHERE nv.facility_id = ?
               AND nv.visit_date BETWEEN ? AND ?
               AND (
                    nv.service_profile IN ('lab_direct', 'pharmacy_walkin')
                    OR nv.pharmacy_outcome IS NOT NULL
                    OR (nv.state = 'cancelled' AND nv.cancel_reason LIKE '%wrong_visit_type%')
               )
             ORDER BY nv.visit_date ASC, nv.queue_number ASC, nv.id ASC",
            [$facilityId, $startDate, $endDate]
        ) ?: [];

        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            throw new \RuntimeException('Could not open CSV buffer');
        }

        fputcsv($handle, [
            'visit_id',
            'visit_date',
            'queue_number',
            'pubpid',
            'patient_name',
            'service_profile',
            'state',
            'pharmacy_outcome',
            'referral_document_id',
            'referred_to_visit_id',
            'cancel_reason',
        ]);

        foreach ($rows as $row) {
            $fname = (string) ($row['fname'] ?? '');
            $lname = (string) ($row['lname'] ?? '');
            fputcsv($handle, [
                (int) ($row['id'] ?? 0),
                (string) ($row['visit_date'] ?? ''),
                (int) ($row['queue_number'] ?? 0),
                (string) ($row['pubpid'] ?? ''),
                trim($fname . ' ' . $lname),
                (string) ($row['service_profile'] ?? ''),
                (string) ($row['state'] ?? ''),
                (string) ($row['pharmacy_outcome'] ?? ''),
                $row['referral_document_id'] !== null ? (int) $row['referral_document_id'] : '',
                $row['referred_to_visit_id'] !== null ? (int) $row['referred_to_visit_id'] : '',
                (string) ($row['cancel_reason'] ?? ''),
            ]);
        }

        rewind($handle);
        $content = (string) stream_get_contents($handle);
        fclose($handle);

        return [
            'filename' => sprintf('ancillary-services-%s-to-%s.csv', $startDate, $endDate),
            'content' => $content,
            'row_count' => count($rows),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function countByServiceProfile(int $facilityId, string $startDate, string $endDate): array
    {
        $counts = array_fill_keys(self::SERVICE_PROFILES, 0);
        $rows = QueryUtils::fetchRecords(
            "SELECT service_profile, COUNT(*) AS cnt
             FROM new_visit
             WHERE facility_id = ?
               AND visit_date BETWEEN ? AND ?
               AND state NOT IN ('cancelled')
             GROUP BY service_profile",
            [$facilityId, $startDate, $endDate]
        ) ?: [];

        foreach ($rows as $row) {
            $profile = (string) ($row['service_profile'] ?? '');
            if (isset($counts[$profile])) {
                $counts[$profile] = (int) ($row['cnt'] ?? 0);
            }
        }

        return $counts;
    }

    /**
     * @return array<string, int>
     */
    private function countPharmacyOutcomes(int $facilityId, string $startDate, string $endDate): array
    {
        $counts = array_fill_keys(self::PHARMACY_OUTCOMES, 0);
        $counts['other'] = 0;
        $counts['unset'] = 0;

        $rows = QueryUtils::fetchRecords(
            "SELECT pharmacy_outcome, COUNT(*) AS cnt
             FROM new_visit
             WHERE facility_id = ?
               AND visit_date BETWEEN ? AND ?
               AND service_profile = 'pharmacy_walkin'
               AND state NOT IN ('cancelled')
             GROUP BY pharmacy_outcome",
            [$facilityId, $startDate, $endDate]
        ) ?: [];

        foreach ($rows as $row) {
            $outcome = (string) ($row['pharmacy_outcome'] ?? '');
            $count = (int) ($row['cnt'] ?? 0);
            if ($outcome === '') {
                $counts['unset'] += $count;
                continue;
            }
            if (isset($counts[$outcome])) {
                $counts[$outcome] = $count;
                continue;
            }
            $counts['other'] += $count;
        }

        return $counts;
    }

    private function countLabDirectWithoutReferral(int $facilityId, string $startDate, string $endDate): int
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM new_visit
             WHERE facility_id = ?
               AND visit_date BETWEEN ? AND ?
               AND service_profile = 'lab_direct'
               AND state NOT IN ('cancelled')
               AND (referral_document_id IS NULL OR referral_document_id = 0)",
            [$facilityId, $startDate, $endDate]
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    private function countPharmacyToOpdChains(
        int $facilityId,
        string $startDate,
        string $endDate,
        int $referWindowHours
    ): int {
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM new_visit pharm
             INNER JOIN new_visit opd ON opd.id = pharm.referred_to_visit_id
             WHERE pharm.facility_id = ?
               AND pharm.visit_date BETWEEN ? AND ?
               AND pharm.service_profile = 'pharmacy_walkin'
               AND pharm.referred_to_visit_id IS NOT NULL
               AND opd.service_profile = 'full_opd'
               AND opd.visit_date = pharm.visit_date
               AND TIMESTAMPDIFF(
                    HOUR,
                    COALESCE(pharm.started_at, pharm.created_at),
                    COALESCE(opd.started_at, opd.created_at)
               ) BETWEEN 0 AND ?",
            [$facilityId, $startDate, $endDate, $referWindowHours]
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    private function countWrongVisitTypeCancels(int $facilityId, string $startDate, string $endDate): int
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM new_visit
             WHERE facility_id = ?
               AND visit_date BETWEEN ? AND ?
               AND state = 'cancelled'
               AND cancel_reason LIKE '%wrong_visit_type%'",
            [$facilityId, $startDate, $endDate]
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function normalizeDateRange(?string $startDate, ?string $endDate): array
    {
        $today = $this->clinicDate->today();
        $startDate = $this->normalizeDate($startDate) ?? $today;
        $endDate = $this->normalizeDate($endDate) ?? $startDate;

        if ($endDate < $startDate) {
            throw new \InvalidArgumentException('end_date must be on or after start_date');
        }

        return [$startDate, $endDate];
    }

    private function normalizeDate(?string $date): ?string
    {
        if ($date === null || $date === '') {
            return null;
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new \InvalidArgumentException('Invalid date format');
        }

        return $date;
    }

    private function referWindowHours(int $facilityId): int
    {
        $hours = $this->config->getInt('ancillary_refer_window_hours', 4, $facilityId);

        return max(1, min(24, $hours));
    }
}

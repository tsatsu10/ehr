<?php

/**
 * M16 Reporting Operations Hub — curated report card catalog
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class ReportHubCatalogService
{
    public function __construct(
        private readonly ReportHubAccessService $access = new ReportHubAccessService(),
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

        $allowed = $this->access->allowedLenses();
        if ($lens !== null && $lens !== '') {
            $this->access->assertLensAccess($lens);
            $allowed = in_array($lens, $allowed, true) ? [$lens] : [];
        }

        $cards = [];
        foreach ($allowed as $lensId) {
            $cards = array_merge($cards, $this->cardsForLens($lensId, $facilityId));
        }

        return [
            'lenses' => $allowed,
            'cards' => $cards,
            'show_us_quality' => $this->access->showUsQualityReports(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function cardsForLens(string $lens, int $facilityId): array
    {
        return match ($lens) {
            'clinical' => $this->clinicalCards(),
            'pharmacy' => $this->pharmacyCards($facilityId),
            'financial' => $this->financialCards($facilityId),
            'public_health' => $this->publicHealthCards(),
            'audit' => $this->auditCards(),
            default => [],
        };
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function clinicalCards(): array
    {
        return [
            $this->stockCard(
                'clinical_immunizations',
                'clinical',
                'Immunizations given',
                'Vaccines administered in a date range — export for district EPI review.',
                'immunization_report.php'
            ),
            $this->stockCard(
                'clinical_cohort',
                'clinical',
                'Clinical cohort',
                'Diagnosis, medication, and age filters for surveillance extracts.',
                'clinical_reports.php'
            ),
            $this->stockCard(
                'clinical_prescriptions',
                'clinical',
                'Prescriptions',
                'Prescriptions written in a date range.',
                'prescriptions_report.php'
            ),
            $this->stockCard(
                'clinical_referrals',
                'clinical',
                'Referrals',
                'Referral letters and transactions aggregate.',
                'referrals_report.php'
            ),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function pharmacyCards(int $facilityId): array
    {
        if (!$this->access->isPharmacyLensEnabled($facilityId)) {
            return [];
        }

        $cards = [
            $this->stockCard(
                'pharm_destroyed',
                'pharmacy',
                'Destroyed medicines register',
                'Lots marked destroyed with witness and method — pharmacy council inspections.',
                'destroyed_drugs_report.php'
            ),
            $this->stockCard(
                'pharm_inventory_activity',
                'pharmacy',
                'Inventory activity',
                'Stock movements and adjustments across warehouses.',
                'inventory_activity.php'
            ),
            $this->stockCard(
                'pharm_inventory_transactions',
                'pharmacy',
                'Inventory transactions',
                'Detailed purchase, sale, and adjustment ledger.',
                'inventory_transactions.php'
            ),
        ];

        if ($this->config->getInt('enable_pharm_ops', 0, $facilityId) === 1) {
            $cards[] = [
                'id' => 'pharm_ops_hub',
                'lens' => 'pharmacy',
                'title' => 'Pharmacy Operations bench reports',
                'blurb' => 'In-hub inventory embed for daily bench work (M13).',
                'url' => '/interface/modules/custom_modules/oe-module-new-clinic/public/pharm-ops/index.php?tab=reports',
                'kind' => 'module',
            ];
        }

        return $cards;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function financialCards(int $facilityId): array
    {
        $cards = [
            $this->stockCard(
                'fin_receipts_by_method',
                'financial',
                'Receipts by payment method',
                'Cash and other methods collected in a date range.',
                'receipts_by_method_report.php'
            ),
            $this->stockCard(
                'fin_sales_by_item',
                'financial',
                'Sales by item',
                'Fee and product revenue breakdown.',
                'sales_by_item.php'
            ),
        ];

        if ($this->access->isBillOpsLinked($facilityId)) {
            $cards[] = [
                'id' => 'fin_bill_ops_close',
                'lens' => 'financial',
                'title' => 'Billing back office close day',
                'blurb' => 'Daysheet and close-of-day tools in Billing Back Office (M14).',
                'url' => '/interface/modules/custom_modules/oe-module-new-clinic/public/bill-ops/index.php?tab=close',
                'kind' => 'module',
            ];
        }

        return $cards;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function publicHealthCards(): array
    {
        return [
            [
                'id' => 'ph_opd_attendance',
                'lens' => 'public_health',
                'title' => 'OPD attendance template',
                'blurb' => 'Monthly outpatient attendance worksheet aligned to common district returns (Ghana v1 pack).',
                'url' => '',
                'kind' => 'placeholder',
                'note' => 'Manual CSV template — DHIMS2 export ships in V2.2 (NG8).',
            ],
            $this->stockCard(
                'ph_encounters',
                'public_health',
                'Encounters by period',
                'Visit counts for surveillance — compare with M7 operational throughput, do not sum with appointments.',
                'encounters_report.php'
            ),
            $this->stockCard(
                'ph_appointments',
                'public_health',
                'Appointments funnel',
                'Scheduled visits orthogonal to module queue counts (M7-F16).',
                'appointments_report.php'
            ),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function auditCards(): array
    {
        $cards = [
            $this->stockCard(
                'audit_tamper',
                'audit',
                'Audit log tamper check',
                'Integrity review of core audit trail.',
                'audit_log_tamper_report.php'
            ),
            [
                'id' => 'audit_m7_overrides',
                'lens' => 'audit',
                'title' => 'Operational override log',
                'blurb' => 'Billing skips, dup overrides, and queue bypasses from Daily Reports.',
                'url' => '/interface/modules/custom_modules/oe-module-new-clinic/public/reports.php?tab=overrides',
                'kind' => 'module',
            ],
        ];

        if ($this->access->showUsQualityReports()) {
            $cards[] = $this->stockCard(
                'audit_cqm',
                'audit',
                'Clinical quality measures (US)',
                'Certification reports — hidden unless US quality flag is ON.',
                'cqm.php'
            );
            $cards[] = $this->stockCard(
                'audit_amc',
                'audit',
                'Automated measure compliance (US)',
                'MU/AMC tracking — Advanced only.',
                'amc_full_report.php'
            );
        }

        return $cards;
    }

    /**
     * @return array<string, mixed>
     */
    private function stockCard(string $id, string $lens, string $title, string $blurb, string $script): array
    {
        return [
            'id' => $id,
            'lens' => $lens,
            'title' => $title,
            'blurb' => $blurb,
            'url' => '/interface/reports/' . ltrim($script, '/'),
            'kind' => 'stock',
        ];
    }
}

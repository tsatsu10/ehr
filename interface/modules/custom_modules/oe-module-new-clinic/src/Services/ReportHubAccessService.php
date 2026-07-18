<?php

/**
 * M16 Reporting Operations Hub — feature gate and ACL helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;

class ReportHubAccessService
{
    /** @var array<int, string> */
    public const HUB_READ_ACLS = [
        'new_reports_hub',
        'new_reports_clinical',
        'new_reports_pharmacy',
        'new_reports_financial',
        'new_reports_public_health',
        'new_reports_audit',
        'reports',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const TODAY_ACLS = [
        'reports',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const CLINICAL_ACLS = [
        'new_reports_clinical',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const PHARMACY_ACLS = [
        'new_reports_pharmacy',
        'new_pharmacy_lead',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const FINANCIAL_ACLS = [
        'new_reports_financial',
        'new_cashier_lead',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const PUBLIC_HEALTH_ACLS = [
        'new_reports_public_health',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const AUDIT_ACLS = [
        'new_reports_audit',
        'new_admin',
    ];

    /**
     * Unfiled documents lens (GAP-A / A2 clinic-wide half) — visible to the
     * roles that actually triage scanned intake docs. The underlying
     * documents.* ajax actions separately enforce core patients/docs
     * (satisfied by Clinicians group membership for every New Clinic role —
     * see acl_setup.php); this list only controls whether the *tab* shows.
     */
    public const UNFILED_DOCUMENTS_ACLS = [
        'new_reception',
        'new_admin',
    ];

    /** @var callable|null */
    private $aclChecker;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        ?callable $aclChecker = null,
    ) {
        $this->aclChecker = $aclChecker;
    }

    public function isHubEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->config->getInt('enable_report_hub', 0, $facilityId) === 1;
    }

    public function assertHubEnabled(?int $facilityId = null): void
    {
        if (!$this->isHubEnabled($facilityId)) {
            throw new \RuntimeException('Reporting Operations Hub is not enabled for this clinic', 403);
        }
    }

    public function canReadHub(): bool
    {
        return $this->hasAnyAcl(self::HUB_READ_ACLS);
    }

    public function canViewToday(): bool
    {
        return $this->hasAnyAcl(self::TODAY_ACLS);
    }

    public function canViewClinical(): bool
    {
        return $this->hasAnyAcl(self::CLINICAL_ACLS);
    }

    public function canViewPharmacy(): bool
    {
        return $this->hasAnyAcl(self::PHARMACY_ACLS);
    }

    public function canViewFinancial(): bool
    {
        return $this->hasAnyAcl(self::FINANCIAL_ACLS);
    }

    public function canViewPublicHealth(): bool
    {
        return $this->hasAnyAcl(self::PUBLIC_HEALTH_ACLS);
    }

    public function canViewAudit(): bool
    {
        return $this->hasAnyAcl(self::AUDIT_ACLS);
    }

    public function canViewUnfiledDocuments(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->config->getInt('enable_documents_native', 0, $facilityId) === 1
            && $this->hasAnyAcl(self::UNFILED_DOCUMENTS_ACLS);
    }

    public function showUsQualityReports(): bool
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId();

        return $this->config->getInt('report_hub_show_us_quality', 0, $facilityId) === 1;
    }

    public function isPharmacyLensEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->config->getInt('enable_pharmacy_role', 0, $facilityId) === 1
            || $this->config->getInt('enable_pharm_ops', 0, $facilityId) === 1;
    }

    public function isBillOpsLinked(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->config->getInt('enable_bill_ops', 0, $facilityId) === 1;
    }

    public function isBillOpsOutstandingEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->isBillOpsLinked($facilityId)
            && $this->config->getInt('enable_bill_ops_outstanding', 0, $facilityId) === 1;
    }

    public function isPatientRegistryEnabled(?int $facilityId = null): bool
    {
        return true;
    }

    public function isAncillaryServicesEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->config->getInt('enable_ancillary_services', 0, $facilityId) === 1;
    }

    public function assertHubAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->canReadHub()) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function assertLensAccess(string $lens): void
    {
        $this->assertHubAccess();
        $allowed = match ($lens) {
            'today' => $this->canViewToday(),
            'clinical' => $this->canViewClinical(),
            'pharmacy' => $this->canViewPharmacy(),
            'financial' => $this->canViewFinancial(),
            'public_health' => $this->canViewPublicHealth(),
            'audit' => $this->canViewAudit(),
            'unfiled_documents' => $this->canViewUnfiledDocuments(),
            default => false,
        };
        if (!$allowed) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    /**
     * @return list<string>
     */
    public function allowedLenses(): array
    {
        $lenses = [];
        if ($this->canViewToday()) {
            $lenses[] = 'today';
        }
        if ($this->canViewClinical()) {
            $lenses[] = 'clinical';
        }
        if ($this->canViewPharmacy()) {
            $lenses[] = 'pharmacy';
        }
        if ($this->canViewFinancial()) {
            $lenses[] = 'financial';
        }
        if ($this->canViewPublicHealth()) {
            $lenses[] = 'public_health';
        }
        if ($this->canViewAudit()) {
            $lenses[] = 'audit';
        }
        if ($this->canViewUnfiledDocuments()) {
            $lenses[] = 'unfiled_documents';
        }

        return $lenses;
    }

    /**
     * @param array<int, string> $acos
     */
    private function hasAnyAcl(array $acos): bool
    {
        foreach ($acos as $aco) {
            if ($this->hasAcl($aco)) {
                return true;
            }
        }

        return false;
    }

    private function hasAcl(string $aco): bool
    {
        if ($this->aclChecker !== null) {
            return ($this->aclChecker)('new_clinic', $aco);
        }

        // Per-request memo (SCALE-1.3). AclMain::aclCheckCore hits gacl_* with 2 queries per
        // call and does not cache; the catalog checks the same handful of ACOs once per lens
        // entry — measured 245 gacl queries (~2.6 s) on one reports.catalog request. A user's
        // ACL cannot change mid-request, so caching per ACO is safe. Static (not instance)
        // because the catalog builds fresh service instances per lens.
        static $memo = [];
        if (!array_key_exists($aco, $memo)) {
            $memo[$aco] = AclMain::aclCheckCore('new_clinic', $aco);
        }

        return $memo[$aco];
    }
}

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
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->config->getInt('enable_patient_registry', 0, $facilityId) === 1;
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

        return AclMain::aclCheckCore('new_clinic', $aco);
    }
}

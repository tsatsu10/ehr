<?php

/**
 * M17 Clinical Documentation Hub — feature gate and ACL helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;

class ClinicalDocAccessService
{
    /** @var array<int, string> */
    public const HUB_READ_ACLS = [
        'new_clinical_doc_hub',
        'new_doctor',
        'new_nurse',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const VISIT_ACLS = [
        'new_clinical_doc_hub',
        'new_doctor',
        'new_nurse',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const CONSULT_ACLS = [
        'new_clinical_doc_consult',
        'new_doctor',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const SCREENING_ACLS = [
        'new_clinical_doc_screening',
        'new_doctor',
        'new_nurse_lead',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const NURSING_ACLS = [
        'new_clinical_doc_nursing',
        'new_nurse',
        'new_nurse_lead',
        'new_doctor',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const ORDERS_ACLS = [
        'new_clinical_doc_orders',
        'new_doctor',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const SPECIALTY_ACLS = [
        'new_clinical_doc_specialty',
        'new_doctor',
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

        return $this->config->getInt('enable_clinical_doc_hub', 0, $facilityId) === 1;
    }

    public function assertHubEnabled(?int $facilityId = null): void
    {
        if (!$this->isHubEnabled($facilityId)) {
            throw new \RuntimeException('Clinical Documentation Hub is not enabled for this clinic', 403);
        }
    }

    public function canReadHub(): bool
    {
        return $this->hasAnyAcl(self::HUB_READ_ACLS);
    }

    public function canViewVisit(): bool
    {
        return $this->hasAnyAcl(self::VISIT_ACLS);
    }

    public function canViewConsult(): bool
    {
        return $this->hasAnyAcl(self::CONSULT_ACLS);
    }

    public function canViewScreening(): bool
    {
        return $this->hasAnyAcl(self::SCREENING_ACLS);
    }

    public function canViewNursing(): bool
    {
        return $this->hasAnyAcl(self::NURSING_ACLS);
    }

    public function canViewOrders(): bool
    {
        return $this->hasAnyAcl(self::ORDERS_ACLS);
    }

    public function canViewSpecialty(): bool
    {
        return $this->hasAnyAcl(self::SPECIALTY_ACLS);
    }

    public function showScreeningLens(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->config->getInt('clinical_doc_show_screening', 0, $facilityId) === 1;
    }

    public function showSpecialtyLens(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->config->getInt('clinical_doc_show_specialty', 0, $facilityId) === 1;
    }

    public function showUsQualityWidgets(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->config->getInt('clinical_doc_show_us_quality', 0, $facilityId) === 1;
    }

    public function canAccessLens(string $lens, ?int $facilityId = null): bool
    {
        return match ($lens) {
            'visit' => $this->canViewVisit(),
            'consult' => $this->canViewConsult(),
            'screening' => $this->canViewScreening() && $this->showScreeningLens($facilityId),
            'nursing' => $this->canViewNursing(),
            'orders' => $this->canViewOrders(),
            'specialty' => $this->canViewSpecialty() && $this->showSpecialtyLens($facilityId),
            default => false,
        };
    }

    public function canWriteAnyLens(?int $facilityId = null): bool
    {
        foreach ($this->allowedLenses($facilityId) as $lens) {
            if ($lens !== 'visit') {
                return true;
            }
        }

        return false;
    }

    public function assertWriteAccess(): void
    {
        $this->assertHubAccess();
        if (!$this->canWriteAnyLens()) {
            throw new \RuntimeException('Forbidden', 403);
        }
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
            'visit' => $this->canViewVisit(),
            'consult' => $this->canViewConsult(),
            'screening' => $this->canViewScreening() && $this->showScreeningLens(),
            'nursing' => $this->canViewNursing(),
            'orders' => $this->canViewOrders(),
            'specialty' => $this->canViewSpecialty() && $this->showSpecialtyLens(),
            default => false,
        };
        if (!$allowed) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    /**
     * @return list<string>
     */
    public function allowedLenses(?int $facilityId = null): array
    {
        $lenses = [];
        if ($this->canViewVisit()) {
            $lenses[] = 'visit';
        }
        if ($this->canViewConsult()) {
            $lenses[] = 'consult';
        }
        if ($this->canViewScreening() && $this->showScreeningLens($facilityId)) {
            $lenses[] = 'screening';
        }
        if ($this->canViewNursing()) {
            $lenses[] = 'nursing';
        }
        if ($this->canViewOrders()) {
            $lenses[] = 'orders';
        }
        if ($this->canViewSpecialty() && $this->showSpecialtyLens($facilityId)) {
            $lenses[] = 'specialty';
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

<?php

/**
 * M13 Pharmacy Operations Hub — feature gate and ACL helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;

class PharmOpsAccessService
{
    /** @var array<int, string> */
    public const HUB_READ_ACLS = [
        'new_pharm_ops',
        'new_pharmacy',
        'new_pharmacy_lead',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const DISPENSE_ACLS = [
        'new_pharm_ops_dispense',
        'new_pharmacy',
        'new_pharmacy_lead',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const RECEIVE_ACLS = [
        'new_pharm_ops_receive',
        'new_pharmacy_lead',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const CATALOG_ACLS = [
        'new_pharm_ops_catalog',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const DESTROY_ACLS = [
        'new_pharm_ops_destroy',
        'new_pharmacy_lead',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const RX_PRINT_ACLS = [
        'new_doctor',
        'new_pharmacy',
        'new_pharm_ops',
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

    public function isInhousePharmacyEnabled(): bool
    {
        return !empty($GLOBALS['inhouse_pharmacy']);
    }

    public function isHubEnabled(?int $facilityId = null): bool
    {
        if (!$this->isInhousePharmacyEnabled()) {
            return false;
        }

        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->config->getInt('enable_pharmacy_role', 0, $facilityId) === 1
            && $this->config->getInt('enable_pharm_ops', 0, $facilityId) === 1;
    }

    public function assertHubEnabled(?int $facilityId = null): void
    {
        if (!$this->isInhousePharmacyEnabled()) {
            throw new \RuntimeException('Pharmacy Operations requires in-house pharmacy to be enabled', 403);
        }

        if (!$this->isHubEnabled($facilityId)) {
            throw new \RuntimeException('Pharmacy Operations Hub is not enabled for this clinic', 403);
        }
    }

    public function canReadHub(): bool
    {
        return $this->hasAnyAcl(self::HUB_READ_ACLS);
    }

    public function canDispense(): bool
    {
        return $this->hasAnyAcl(self::DISPENSE_ACLS);
    }

    public function canReceive(): bool
    {
        return $this->hasAnyAcl(self::RECEIVE_ACLS);
    }

    public function canManageCatalog(): bool
    {
        return $this->hasAnyAcl(self::CATALOG_ACLS);
    }

    public function canDestroy(): bool
    {
        if ($this->hasAnyAcl(self::DESTROY_ACLS)) {
            return true;
        }

        if ($this->aclChecker !== null) {
            return ($this->aclChecker)('inventory', 'destruction');
        }

        return AclMain::aclCheckCore('inventory', 'destruction');
    }

    public function isRxPrintEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->config->getInt('enable_rx_print', 0, $facilityId) === 1;
    }

    public function canPrintRx(): bool
    {
        return $this->hasAnyAcl(self::RX_PRINT_ACLS);
    }

    public function assertRxPrintAccess(?int $facilityId = null): void
    {
        if (!$this->isRxPrintEnabled($facilityId)) {
            throw new \RuntimeException('Print Rx is not enabled for this clinic', 403);
        }

        if (!$this->canPrintRx()) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function isDispenseLabelEnabled(?int $facilityId = null): bool
    {
        if (!$this->isHubEnabled($facilityId)) {
            return false;
        }

        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->config->getInt('enable_dispense_label', 0, $facilityId) === 1;
    }

    public function canPrintDispenseLabel(): bool
    {
        return $this->canDispense();
    }

    public function assertDispenseLabelAccess(?int $facilityId = null): void
    {
        $this->assertHubEnabled($facilityId);

        if (!$this->isDispenseLabelEnabled($facilityId)) {
            throw new \RuntimeException('Dispense labels are not enabled for this clinic', 403);
        }

        if (!$this->canPrintDispenseLabel()) {
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

    public function assertDispenseAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->canDispense()) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function assertReceiveAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->canReceive()) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function assertCatalogAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->canManageCatalog()) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function assertDestroyAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->canDestroy()) {
            throw new \RuntimeException('Forbidden', 403);
        }
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

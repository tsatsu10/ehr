<?php

/**
 * M12 Lab Operations Hub — feature gate and ACL helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;

class LabOpsAccessService
{
    /** @var array<int, string> */
    public const HUB_READ_ACLS = [
        'new_lab_ops',
        'new_lab',
        'new_lab_lead',
        'new_doctor',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const ENTER_ACLS = [
        'new_lab_ops_enter',
        'new_lab',
        'new_lab_lead',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const RELEASE_ACLS = [
        'new_lab_ops_release',
        'new_lab_lead',
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

        return $this->config->getInt('enable_lab_role', 0, $facilityId) === 1
            && $this->config->getInt('enable_lab_ops', 0, $facilityId) === 1;
    }

    public function assertHubEnabled(?int $facilityId = null): void
    {
        if (!$this->isHubEnabled($facilityId)) {
            throw new \RuntimeException('Lab Operations Hub is not enabled for this clinic', 403);
        }
    }

    public function canReadHub(): bool
    {
        return $this->hasAnyAcl(self::HUB_READ_ACLS);
    }

    public function canEnterResults(): bool
    {
        return $this->hasAnyAcl(self::ENTER_ACLS);
    }

    public function canReleaseResults(): bool
    {
        return $this->hasAnyAcl(self::RELEASE_ACLS);
    }

    public function assertHubAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->canReadHub()) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function assertEnterAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->canEnterResults()) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function assertReleaseAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->canReleaseResults()) {
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

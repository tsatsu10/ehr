<?php

/**
 * S1 Scheduling & Flow — feature gate and ACL helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;

class SchedulingAccessService
{
    /** @var array<int, string> */
    public const HUB_READ_ACLS = [
        'new_reception',
        'new_reception_lead',
        'new_nurse',
        'new_admin',
    ];

    /** @var callable|null */
    private $aclChecker;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly ScheduledIntegrationService $scheduledIntegration = new ScheduledIntegrationService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        ?callable $aclChecker = null,
    ) {
        $this->aclChecker = $aclChecker;
    }

    public function isHubEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId < 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        if (!$this->scheduledIntegration->isEnabled($facilityId)) {
            return false;
        }

        return $this->config->getInt('enable_scheduling_redesign', 0, $facilityId) === 1;
    }

    public function assertHubEnabled(?int $facilityId = null): void
    {
        if (!$this->isHubEnabled($facilityId)) {
            throw new \RuntimeException('Scheduling & Flow is not enabled for this clinic', 403);
        }
    }

    public function assertHubAccess(?int $facilityId = null): void
    {
        $this->assertHubEnabled($facilityId);
        if (!$this->hasAnyAcl(self::HUB_READ_ACLS)) {
            throw new \RuntimeException('Scheduling access denied', 403);
        }
    }

    public function canBookAppointment(): bool
    {
        return $this->hasCoreAcl('patients', 'appt');
    }

    /**
     * @param list<string> $acos
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
            return (bool) call_user_func($this->aclChecker, $aco);
        }

        return AclMain::aclCheckCore('new_clinic', $aco);
    }

    private function hasCoreAcl(string $section, string $aco): bool
    {
        if ($this->aclChecker !== null) {
            return (bool) call_user_func($this->aclChecker, $section . ':' . $aco);
        }

        return AclMain::aclCheckCore($section, $aco);
    }
}

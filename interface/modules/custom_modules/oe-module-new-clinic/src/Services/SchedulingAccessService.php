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
        private readonly ScheduledIntegrationService $scheduledIntegration = new ScheduledIntegrationService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        ?callable $aclChecker = null,
    ) {
        $this->aclChecker = $aclChecker;
    }

    /**
     * The S1 redesign is the permanent scheduling surface — the only remaining
     * gate is whether scheduled integration (appointments) is on at all.
     */
    public function isHubEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId < 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->scheduledIntegration->isEnabled($facilityId);
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
     * Non-throwing form of assertHubAccess — for entry points (e.g. the patient
     * chart "Flag for follow-up" button) that must render only when the user
     * would actually be allowed to reach the recall hub.
     */
    public function canAccessHub(?int $facilityId = null): bool
    {
        return $this->isHubEnabled($facilityId) && $this->hasAnyAcl(self::HUB_READ_ACLS);
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

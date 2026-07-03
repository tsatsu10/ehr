<?php

/**
 * M18 Queue Bridge Hub — feature gate and ACL helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;

class QueueBridgeAccessService
{
  /** @var array<int, string> */
    public const HUB_READ_ACLS = [
        'new_queue_bridge',
        'new_reception_lead',
        'new_admin',
    ];

  /** @var array<int, string> */
    public const RESOLVE_ACLS = [
        'new_queue_bridge_resolve',
        'new_reception_lead',
        'new_admin',
    ];

  /** @var array<int, string> */
    public const DISMISS_ACLS = [
        'new_queue_bridge_dismiss',
        'new_reception_lead',
        'new_admin',
    ];

  /** @var callable|null */
    private $aclChecker;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ScheduledIntegrationService $scheduledIntegration = new ScheduledIntegrationService(),
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

        return $this->config->getInt('enable_queue_bridge', 0, $facilityId) === 1;
    }

    public function assertHubEnabled(?int $facilityId = null): void
    {
        if (!$this->isHubEnabled($facilityId)) {
            throw new \RuntimeException('Queue Bridge Hub is not enabled for this clinic', 403);
        }
    }

    public function assertHubAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->hasAnyAcl(self::HUB_READ_ACLS)) {
            throw new \RuntimeException('Queue Bridge access denied', 403);
        }
    }

    public function canResolve(): bool
    {
        return $this->hasAnyAcl(self::RESOLVE_ACLS);
    }

    public function canDismiss(): bool
    {
        return $this->hasAnyAcl(self::DISMISS_ACLS);
    }

    public function canDismissExceptionCode(string $code): bool
    {
        if (!$this->canDismiss()) {
            return false;
        }

        if ($this->hasAcl('new_admin')) {
            return in_array($code, ['EX-03', 'EX-04', 'EX-05', 'EX-07'], true);
        }

        if ($this->hasAcl('new_reception_lead')) {
            return in_array($code, ['EX-03', 'EX-07'], true);
        }

        return false;
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
}

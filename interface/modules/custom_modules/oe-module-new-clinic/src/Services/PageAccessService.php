<?php

/**
 * Page access resolution for feature ACLs vs desk shell context (chart depth, etc.)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;

class PageAccessService
{
    /** @var callable|null */
    private $aclChecker;

    public function __construct(
        private readonly ?SessionRoleService $sessionRole = null,
        ?callable $aclChecker = null,
    ) {
        $this->aclChecker = $aclChecker;
    }

    /**
     * @param array<int, string> $acos
     */
    public function resolveFirstGrantedAco(array $acos): ?string
    {
        foreach ($acos as $aco) {
            if ($this->hasAcl($aco)) {
                return $aco;
            }
        }

        return null;
    }

    public function resolveShellAco(string $featureAco): string
    {
        if (isset(SessionRoleService::ROLE_META[$featureAco])) {
            return $featureAco;
        }

        $sessionRole = $this->sessionRole ?? new SessionRoleService();
        $active = $sessionRole->getActiveRole(null);
        if ($active !== '' && $this->hasAcl($active)) {
            return $active;
        }

        return $featureAco;
    }

    private function hasAcl(string $aco): bool
    {
        if ($this->aclChecker !== null) {
            return ($this->aclChecker)('new_clinic', $aco);
        }

        return AclMain::aclCheckCore('new_clinic', $aco);
    }
}

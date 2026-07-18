<?php

/**
 * Personalize desk names with the signed-in user (shared-device clarity).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PersonalizedDeskLabelService
{
    /** @var array<string, string> Sidebar nav id → short role noun */
    private const NAV_ROLE_LABEL = [
        'clinicfd' => 'Reception',
        'clinictg' => 'Nurse',
        'clinicdr' => 'Doctor',
        'clinicl' => 'Lab',
        'clinicph' => 'Pharmacy',
        'cliniccs' => 'Cashier',
        'clinicad' => 'Admin',
    ];

    public function ownerDisplayName(string $fname, string $username): string
    {
        $first = trim($fname);
        if ($first !== '') {
            return $first;
        }

        return trim($username);
    }

    public function ownedDeskLabel(string $roleLabel, string $ownerName): string
    {
        $roleLabel = trim($roleLabel);
        $ownerName = trim($ownerName);
        if ($roleLabel === '' || $ownerName === '') {
            return $roleLabel;
        }

        // The apostrophe must never go through xl() — it converts ' to a backtick
        // (translation.inc.php's "safe apostrophe" pass), which mangled every
        // personalized desk title ("Admin Tsatsu`s desk"). Keep the possessive
        // outside the translated format string.
        return sprintf(xl('%s %s%s desk'), $roleLabel, $ownerName, "'s");
    }

    public function ownedDeskLabelForAco(string $aco, string $fname, string $username): string
    {
        $meta = SessionRoleService::ROLE_META[$aco] ?? null;
        $roleLabel = $meta !== null ? (string) ($meta['label'] ?? '') : $aco;

        return $this->ownedDeskLabel(xlt($roleLabel), $this->ownerDisplayName($fname, $username));
    }

    public function ownedDeskLabelForNavId(string $navId, string $fname, string $username): string
    {
        $roleLabel = self::NAV_ROLE_LABEL[$navId] ?? '';
        if ($roleLabel === '') {
            return '';
        }

        return $this->ownedDeskLabel(xlt($roleLabel), $this->ownerDisplayName($fname, $username));
    }

    public function ownedDeskLabelForSessionUser(string $aco): string
    {
        $userId = (int) ($_SESSION['authUserID'] ?? 0);
        if ($userId <= 0) {
            $meta = SessionRoleService::ROLE_META[$aco] ?? null;

            return $meta !== null ? xlt((string) ($meta['desk_label'] ?? $aco)) : $aco;
        }

        $user = QueryUtils::querySingleRow(
            'SELECT fname, username FROM users WHERE id = ?',
            [$userId]
        ) ?: [];

        return $this->ownedDeskLabelForAco(
            $aco,
            (string) ($user['fname'] ?? ''),
            (string) ($user['username'] ?? '')
        );
    }
}

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

        // Two translation passes touch this string: xl() here, then Twig's
        // |xlt filter again on the composed page title (base.html.twig — it
        // doesn't know this value is already personalized, not a raw
        // constant). Both passes rewrite a straight ASCII apostrophe to a
        // backtick ("Admin Tsatsu`s desk"). A curly apostrophe (U+2019) is
        // outside that regex's reach — and is the typographically correct
        // character for a possessive anyway — so it survives both passes.
        return sprintf(xl('%s %s%s desk'), $roleLabel, $ownerName, "\u{2019}s");
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

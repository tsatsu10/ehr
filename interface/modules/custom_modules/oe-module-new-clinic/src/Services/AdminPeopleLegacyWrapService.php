<?php

/**
 * T1 shell host for stock People / ACL admin pages (M15 People lens).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;

class AdminPeopleLegacyWrapService
{
    /** @var array<string, array{title: string, sub: string, path: string, acl: string, advanced?: bool}> */
    private const VIEWS = [
        'users' => [
            'title' => 'Manage users',
            'sub' => 'staff',
            'path' => '/interface/usergroup/usergroup_admin.php',
            'acl' => 'users',
        ],
        'user_add' => [
            'title' => 'Add user',
            'sub' => 'staff',
            'path' => '/interface/usergroup/usergroup_admin_add.php',
            'acl' => 'users',
        ],
        'user_edit' => [
            'title' => 'Edit user',
            'sub' => 'staff',
            'path' => '/interface/usergroup/usergroup_admin.php',
            'acl' => 'users',
        ],
        'acl' => [
            'title' => 'ACL editor',
            'sub' => 'access',
            'path' => '/interface/usergroup/adminacl.php',
            'acl' => 'acl',
        ],
        'acl_admin' => [
            'title' => 'ACL admin (GACL)',
            'sub' => 'access',
            'path' => '/gacl/admin/acl_admin.php',
            'acl' => 'acl',
            'advanced' => true,
        ],
        'facility_user' => [
            'title' => 'Facility user information',
            'sub' => 'facilities',
            'path' => '/interface/usergroup/facility_user.php',
            'acl' => 'users',
        ],
        'help_acl' => [
            'title' => 'ACL help',
            'sub' => 'help',
            'path' => '/Documentation/help_files/adminacl_help.php',
            'acl' => 'acl',
        ],
    ];

    public function assertViewAllowed(string $view): array
    {
        $meta = self::VIEWS[$view] ?? null;
        if ($meta === null) {
            throw new \InvalidArgumentException('Unknown people legacy view', 400);
        }

        $aco = (string) ($meta['acl'] ?? 'users');
        if (!AclMain::aclCheckCore('admin', $aco) && !AclMain::aclCheckCore('new_clinic', 'new_admin')) {
            throw new \RuntimeException('Forbidden', 403);
        }

        return $meta;
    }

    /**
     * @param array<string, scalar|null> $params
     */
    public function buildIframeSrc(string $view, array $params = []): string
    {
        $meta = $this->assertViewAllowed($view);
        $webroot = rtrim((string) ($GLOBALS['webroot'] ?? ''), '/');
        $path = (string) $meta['path'];
        $query = [];

        if ($view === 'user_edit') {
            $userId = (int) ($params['user_id'] ?? $params['id'] ?? 0);
            if ($userId > 0) {
                $query['id'] = (string) $userId;
            }
        }

        $src = $webroot . $path;
        if ($query !== []) {
            $src .= '?' . http_build_query($query);
        }

        return $src;
    }

    /**
     * @return array<string, array{title: string, sub: string, advanced?: bool}>
     */
    public static function actionCatalog(): array
    {
        $catalog = [];
        foreach (self::VIEWS as $key => $meta) {
            $catalog[$key] = [
                'title' => (string) $meta['title'],
                'sub' => (string) $meta['sub'],
                'advanced' => !empty($meta['advanced']),
            ];
        }

        return $catalog;
    }

    public static function adminReturnUrl(string $sub = 'staff'): string
    {
        $webroot = rtrim((string) ($GLOBALS['webroot'] ?? ''), '/');
        $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/admin.php';

        return $modulePublic . '?tab=people&sub=' . rawurlencode($sub);
    }
}

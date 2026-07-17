<?php

/**
 * Canonical New Clinic ACL schema version (modules.acl_version).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic;

class AclVersion
{
    public const VERSION = '0.2.10';

    public static function isSatisfiedBy(?string $installedVersion): bool
    {
        $installedVersion = (string) $installedVersion;

        return $installedVersion !== '' && version_compare($installedVersion, self::VERSION, '>=');
    }
}

<?php

/**
 * Module lifecycle helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ModuleService
{
    public static function getModuleState($modId): bool
    {
        $sql = "SELECT `mod_active` FROM `modules` WHERE `mod_id` = ? OR `mod_directory` = ?";
        $flag = QueryUtils::querySingleRow($sql, [$modId, $modId]);

        return !empty($flag['mod_active']);
    }
}

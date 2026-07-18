<?php

/**
 * Normalized current-request script name, shared by the stock-page injectors.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Support;

class RequestScriptName
{
    public static function current(): string
    {
        return str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    }
}

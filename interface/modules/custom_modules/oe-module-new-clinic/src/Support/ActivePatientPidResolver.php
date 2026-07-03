<?php

/**
 * Resolve active patient id from session, query string, or global (legacy chart injectors).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Support;

class ActivePatientPidResolver
{
    public static function resolve(): int
    {
        $pid = (int) ($_SESSION['pid'] ?? 0);
        if ($pid > 0) {
            return $pid;
        }

        if (!empty($_GET['set_pid'])) {
            $fromGet = (int) $_GET['set_pid'];
            if ($fromGet > 0) {
                if (function_exists('setpid')) {
                    setpid($fromGet);
                } else {
                    $_SESSION['pid'] = $fromGet;
                }

                return $fromGet;
            }
        }

        global $pid;

        return (int) ($pid ?? 0);
    }
}

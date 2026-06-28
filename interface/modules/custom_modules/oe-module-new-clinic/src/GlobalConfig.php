<?php

/**
 * New Clinic global configuration reader
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic;

class GlobalConfig
{
    public const GLOBAL_MODULE_ACTIVE = 'new_clinic_module_active';

    public function __construct(private array $globalsArray)
    {
    }

    public function isModuleActive(): bool
    {
        $value = $this->globalsArray[self::GLOBAL_MODULE_ACTIVE] ?? '1';

        return (string) $value === '1';
    }
}

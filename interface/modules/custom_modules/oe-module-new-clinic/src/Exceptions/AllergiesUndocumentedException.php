<?php

/**
 * Pharmacy walk-in dispense blocked — allergies not documented (M9-F11)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Exceptions;

use RuntimeException;

class AllergiesUndocumentedException extends RuntimeException
{
    public function __construct(string $message = 'Document allergies or None known before pharmacy dispense')
    {
        parent::__construct($message);
    }
}

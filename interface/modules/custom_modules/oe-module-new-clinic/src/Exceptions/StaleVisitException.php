<?php

/**
 * Optimistic lock conflict on visit transition
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Exceptions;

use RuntimeException;

class StaleVisitException extends RuntimeException
{
    public function __construct(int $visitId)
    {
        parent::__construct('Visit was updated by another user, refresh to continue (visit ' . $visitId . ')');
    }
}

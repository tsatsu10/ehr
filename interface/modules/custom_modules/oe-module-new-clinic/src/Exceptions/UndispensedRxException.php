<?php

/**
 * Pharmacy complete blocked — undispensed Rx on in-house encounter (M9-F21)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Exceptions;

use RuntimeException;

class UndispensedRxException extends RuntimeException
{
    public function __construct(
        string $message,
        private readonly int $undispensedCount = 1,
    ) {
        parent::__construct($message);
    }

    public function getUndispensedCount(): int
    {
        return $this->undispensedCount;
    }
}

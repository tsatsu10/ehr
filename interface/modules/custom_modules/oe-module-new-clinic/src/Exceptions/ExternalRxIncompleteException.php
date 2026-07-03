<?php

/**
 * Pharmacy walk-in external Rx blocked — prescriber metadata incomplete (M9-F15)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Exceptions;

use RuntimeException;

class ExternalRxIncompleteException extends RuntimeException
{
    /**
     * @param list<string> $missing
     * @param array<string, string> $fieldErrors
     */
    public function __construct(
        string $message,
        private readonly array $missing = [],
        private readonly array $fieldErrors = [],
    ) {
        parent::__construct($message);
    }

    /**
     * @return list<string>
     */
    public function getMissing(): array
    {
        return $this->missing;
    }

    /**
     * @return array<string, string>
     */
    public function getFieldErrors(): array
    {
        return $this->fieldErrors;
    }
}

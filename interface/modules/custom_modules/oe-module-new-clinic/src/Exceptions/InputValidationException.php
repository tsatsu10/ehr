<?php

/**
 * Field-level input validation failure for identity/profile write actions
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Exceptions;

class InputValidationException extends \InvalidArgumentException
{
    /**
     * @param array<string, string> $fieldErrors field key => human message
     */
    public function __construct(
        private readonly array $fieldErrors,
        string $message = 'Please correct the highlighted fields',
    ) {
        parent::__construct($message);
    }

    /**
     * @return array<string, string>
     */
    public function getFieldErrors(): array
    {
        return $this->fieldErrors;
    }
}

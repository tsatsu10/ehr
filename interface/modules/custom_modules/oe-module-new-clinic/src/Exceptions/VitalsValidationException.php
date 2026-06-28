<?php

/**
 * Triage vitals validation failure with per-field messages
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Exceptions;

class VitalsValidationException extends \InvalidArgumentException
{
    /**
     * @param array<int, string> $messages
     * @param array<string, string> $fieldErrors
     * @param array<string, string> $fieldWarnings
     */
    public function __construct(
        array $messages,
        private readonly array $fieldErrors = [],
        private readonly array $fieldWarnings = [],
    ) {
        parent::__construct($messages !== [] ? implode('; ', $messages) : 'Vitals validation failed');
    }

    /**
     * @return array<string, string>
     */
    public function getFieldErrors(): array
    {
        return $this->fieldErrors;
    }

    /**
     * @return array<string, string>
     */
    public function getFieldWarnings(): array
    {
        return $this->fieldWarnings;
    }
}

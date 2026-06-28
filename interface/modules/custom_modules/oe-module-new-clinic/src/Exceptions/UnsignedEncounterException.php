<?php

/**
 * Clinical documentation not E-Signed at a workflow gate
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Exceptions;

use RuntimeException;

class UnsignedEncounterException extends RuntimeException
{
    public function __construct(
        string $message,
        private readonly string $reasonCode = 'unsigned_encounter',
        private readonly ?string $encounterUrl = null,
    ) {
        parent::__construct($message);
    }

    public function getReasonCode(): string
    {
        return $this->reasonCode;
    }

    public function getEncounterUrl(): ?string
    {
        return $this->encounterUrl;
    }
}

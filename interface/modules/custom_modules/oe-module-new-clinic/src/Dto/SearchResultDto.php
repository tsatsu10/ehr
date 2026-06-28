<?php

/**
 * Patient search response envelope
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Dto;

class SearchResultDto
{
    /**
     * @param list<array<string, mixed>> $patients
     */
    public function __construct(
        public readonly array $patients,
        public readonly int $totalScored,
        public readonly int $serverTimingMs,
    ) {
    }

    public function toArray(): array
    {
        return [
            'patients' => $this->patients,
            'total_scored' => $this->totalScored,
            'server_timing_ms' => $this->serverTimingMs,
        ];
    }
}

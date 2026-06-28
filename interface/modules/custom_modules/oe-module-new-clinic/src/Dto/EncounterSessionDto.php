<?php

/**
 * Encounter session binding payload (M0-F22)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Dto;

class EncounterSessionDto
{
    public function __construct(
        public readonly int $visitId,
        public readonly int $pid,
        public readonly int $encounter,
        public readonly string $state,
    ) {
    }

    public function toArray(): array
    {
        return [
            'visit_id' => $this->visitId,
            'pid' => $this->pid,
            'encounter' => $this->encounter,
            'state' => $this->state,
        ];
    }
}

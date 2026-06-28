<?php

/**
 * Tier-1 patient context read model (M0-F20)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Dto;

class PatientPreviewDto
{
    public function __construct(
        public readonly int $pid,
        public readonly string $displayName,
        public readonly ?string $mrn,
        public readonly int $completionScore,
        public readonly bool $allergiesUndocumented,
        public readonly ?int $activeVisitId,
        public readonly ?string $activeVisitState,
        public readonly ?int $queueNumber,
        public readonly ?string $chiefComplaint,
    ) {
    }

    public function toArray(): array
    {
        return [
            'pid' => $this->pid,
            'display_name' => $this->displayName,
            'mrn' => $this->mrn,
            'completion_score' => $this->completionScore,
            'allergies_undocumented' => $this->allergiesUndocumented,
            'active_visit_id' => $this->activeVisitId,
            'active_visit_state' => $this->activeVisitState,
            'queue_number' => $this->queueNumber,
            'chief_complaint' => $this->chiefComplaint,
        ];
    }
}

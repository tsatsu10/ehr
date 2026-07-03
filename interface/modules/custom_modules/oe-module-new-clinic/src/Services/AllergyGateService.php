<?php

/**
 * M9-F11 — allergy documentation gate for pharmacy walk-in dispense
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Modules\NewClinic\Exceptions\AllergiesUndocumentedException;

class AllergyGateService
{
    public function __construct(
        private readonly PatientCompletionService $completion = new PatientCompletionService(),
    ) {
    }

    public function isDocumented(int $pid): bool
    {
        return $this->completion->hasAllergyDocumentationForPatient($pid);
    }

    public function assertDocumented(int $pid): void
    {
        if (!$this->isDocumented($pid)) {
            throw new AllergiesUndocumentedException();
        }
    }
}

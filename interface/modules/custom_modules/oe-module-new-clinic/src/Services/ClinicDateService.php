<?php

/**
 * Canonical clinic calendar date
 *
 * today() is the canonical date for inserting new visits and for
 * reports that need a calendar boundary.
 *
 * Queue queries must NOT use a date filter at all — they filter by
 * state (active vs terminal). A visit belongs in the queue as long
 * as it is not completed / closed_unpaid / cancelled, regardless of
 * which calendar day it was opened.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class ClinicDateService
{
    /**
     * The canonical clinic date for inserting new visits and for
     * date-bounded reports. Uses PHP timezone.
     */
    public function today(): string
    {
        return date('Y-m-d');
    }
}

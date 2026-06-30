<?php

/**
 * M13 Pharmacy Operations — match prescriptions to today's clinic visit
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class PharmOpsVisitMatch
{
    /**
     * Subquery returning new_visit.id for the best visit on $visitDate for rx.patient_id.
     * Binds: one visit_date parameter.
     */
    public static function todayVisitSubquerySql(): string
    {
        return "(
                  SELECT nv2.id
                  FROM new_visit nv2
                  WHERE nv2.pid = rx.patient_id
                    AND nv2.visit_date = ?
                    AND (
                      (COALESCE(rx.encounter, 0) > 0 AND nv2.encounter = rx.encounter)
                      OR COALESCE(rx.encounter, 0) = 0
                    )
                  ORDER BY
                    CASE
                      WHEN COALESCE(rx.encounter, 0) > 0 AND nv2.encounter = rx.encounter THEN 0
                      ELSE 1
                    END,
                    nv2.is_urgent DESC,
                    nv2.queue_number ASC,
                    nv2.id DESC
                  LIMIT 1
              )";
    }
}

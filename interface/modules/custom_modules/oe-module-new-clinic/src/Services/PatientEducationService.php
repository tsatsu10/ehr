<?php

/**
 * Patient education resources (GAP-B B3, closes G7).
 *
 * Thin read of the stock `external_patient_education` list — a clinic-configurable
 * set of education websites, each with a `[%]` search-term placeholder in its URL
 * (`list_options.notes`). Clinics point these at whatever handout sources fit
 * their setting (local health authorities, WHO, MedlinePlus…); the Doctor Desk
 * quick action opens the chosen resource with the search term injected.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PatientEducationService
{
    /**
     * @return array<int, array{title: string, url: string}>
     */
    public function getResources(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT title, notes FROM list_options
             WHERE list_id = 'external_patient_education' AND activity = 1
             ORDER BY seq, title",
            []
        ) ?: [];

        $resources = [];
        foreach ($rows as $row) {
            $title = trim((string) ($row['title'] ?? ''));
            $url = trim((string) ($row['notes'] ?? ''));
            if ($title !== '' && $url !== '') {
                $resources[] = ['title' => $title, 'url' => $url];
            }
        }

        return $resources;
    }
}

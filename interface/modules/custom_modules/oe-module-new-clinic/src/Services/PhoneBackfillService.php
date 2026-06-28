<?php

/**
 * Backfill phone_normalized on patient_data
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PhoneBackfillService
{
    public function __construct(
        private readonly PhoneNormalizer $normalizer = new PhoneNormalizer()
    ) {
    }

    public function runBatch(int $limit = 1000): int
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT pid, phone_cell, phone_home FROM patient_data
             WHERE (phone_normalized IS NULL OR phone_normalized = '')
             AND (phone_cell IS NOT NULL AND phone_cell != '' OR phone_home IS NOT NULL AND phone_home != '')
             LIMIT ?",
            [$limit]
        ) ?: [];

        $updated = 0;
        foreach ($rows as $row) {
            $raw = (string) (($row['phone_cell'] ?? '') ?: ($row['phone_home'] ?? ''));
            $normalized = $this->normalizer->normalize($raw);
            sqlStatement(
                "UPDATE patient_data SET phone_normalized = ? WHERE pid = ?",
                [$normalized, (int) $row['pid']]
            );
            $updated++;
        }

        return $updated;
    }
}

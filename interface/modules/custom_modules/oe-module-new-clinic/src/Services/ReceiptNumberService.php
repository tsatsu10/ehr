<?php

/**
 * Atomic per-facility-day receipt number allocation (M5.3 counter).
 *
 * Extracted from CashierService (CP-2) so checkout and the deposits/other-
 * payments flow share ONE counter — two allocators against new_receipt_counter
 * would risk duplicate receipt numbers.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ReceiptNumberService
{
    public function __construct(
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function allocate(int $facilityId): string
    {
        if ($facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDefaultFacilityId();
        }

        $counterDate = date('Y-m-d');
        sqlStatement(
            "INSERT INTO new_receipt_counter (facility_id, counter_date, last_seq)
             VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE last_seq = last_seq + 1",
            [$facilityId, $counterDate]
        );

        $row = QueryUtils::querySingleRow(
            "SELECT last_seq FROM new_receipt_counter WHERE facility_id = ? AND counter_date = ?",
            [$facilityId, $counterDate]
        );
        $seq = is_array($row) ? (int) ($row['last_seq'] ?? 1) : 1;

        return sprintf('%d-%s-%04d', $facilityId, date('Ymd'), $seq);
    }
}

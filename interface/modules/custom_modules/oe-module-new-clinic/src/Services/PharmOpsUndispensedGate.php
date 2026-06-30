<?php

/**
 * M9-F21 — pharmacy complete gate when undispensed Rx remain (D-PHARM-5)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Modules\NewClinic\Exceptions\UndispensedRxException;

final class PharmOpsUndispensedGate
{
    public const MIN_OVERRIDE_REASON_LENGTH = 10;

    public static function isOverrideAllowed(?string $reason, bool $hasOverrideAcl): bool
    {
        if (!$hasOverrideAcl) {
            return false;
        }

        $reason = trim((string) $reason);

        return $reason !== '' && mb_strlen($reason) >= self::MIN_OVERRIDE_REASON_LENGTH;
    }

    public static function buildBlockMessage(int $undispensedCount): string
    {
        return $undispensedCount === 1
            ? '1 prescription on this visit has not been dispensed'
            : $undispensedCount . ' prescriptions on this visit have not been dispensed';
    }

    /**
     * @throws UndispensedRxException
     */
    public static function assertResolved(
        bool $inhousePharmacyEnabled,
        int $undispensedCount,
        ?string $overrideReason,
        bool $hasOverrideAcl,
    ): void {
        if (!$inhousePharmacyEnabled || $undispensedCount <= 0) {
            return;
        }

        if (self::isOverrideAllowed($overrideReason, $hasOverrideAcl)) {
            return;
        }

        throw new UndispensedRxException(self::buildBlockMessage($undispensedCount), $undispensedCount);
    }

    public static function dispenseAuditEvent(string $dispenseStatus): string
    {
        return $dispenseStatus === 'partial'
            ? 'pharmacy_ops.partial_dispensed'
            : 'pharmacy_ops.dispensed';
    }
}

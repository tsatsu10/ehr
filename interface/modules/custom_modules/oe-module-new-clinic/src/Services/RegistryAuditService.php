<?php

/**
 * Patient Registry audit events (M10 §17)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Logging\EventAuditLogger;

class RegistryAuditService
{
    public function logSearch(string $filterSummary, int $total, int $userId): void
    {
        EventAuditLogger::getInstance()->newEvent(
            'new_registry',
            $_SESSION['authUser'] ?? '',
            $_SESSION['authProvider'] ?? '',
            1,
            'search user_id=' . $userId . ' total=' . $total . ' filters=' . $filterSummary
        );
    }

    public function logExport(string $filterSummary, int $rowCount, int $userId): void
    {
        EventAuditLogger::getInstance()->newEvent(
            'new_registry',
            $_SESSION['authUser'] ?? '',
            $_SESSION['authProvider'] ?? '',
            1,
            'export user_id=' . $userId . ' rows=' . $rowCount . ' filters=' . $filterSummary
        );
    }
}

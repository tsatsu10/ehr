<?php

/**
 * Gate for scheduled integration surfaces (M6-F14 / PRD §6.7.1)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class ScheduledIntegrationService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function isEnabled(?int $facilityId = null): bool
    {
        if ($this->config->getInt('enable_scheduled_integration', 1, $facilityId) !== 1) {
            return false;
        }

        global $GLOBALS;

        return empty($GLOBALS['disable_calendar']);
    }
}

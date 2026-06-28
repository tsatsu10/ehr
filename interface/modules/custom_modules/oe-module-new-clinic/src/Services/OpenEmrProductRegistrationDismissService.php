<?php

/**
 * Suppress OpenEMR product-registration modal for clinic deployments.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Services\ProductRegistrationService;
use OpenEMR\Services\VersionService;

class OpenEmrProductRegistrationDismissService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function dismissIfPrompting(int $facilityId = 0): void
    {
        if ($this->config->getInt('auto_dismiss_product_registration', 1, $facilityId) !== 1) {
            return;
        }

        if (!empty($_SESSION['nc_product_reg_dismissed'])) {
            return;
        }

        $status = (new ProductRegistrationService())->getProductDialogStatus();
        if (empty($status['allowRegisterDialog'])) {
            $_SESSION['nc_product_reg_dismissed'] = 1;

            return;
        }

        $version = (new VersionService())->asString();
        $row = QueryUtils::querySingleRow('SELECT id FROM product_registration WHERE id > 0 LIMIT 1');
        if (is_array($row) && !empty($row['id'])) {
            sqlStatement(
                'UPDATE product_registration SET email = NULL, opt_out = 1, telemetry_disabled = 0, last_ask_version = ? WHERE id = ?',
                [$version, (int) $row['id']]
            );
        } else {
            sqlStatement(
                'INSERT INTO product_registration (email, opt_out, telemetry_disabled, last_ask_version) VALUES (NULL, 1, 0, ?)',
                [$version]
            );
        }

        $_SESSION['nc_product_reg_dismissed'] = 1;

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            'product_registration_dismiss',
            'Auto-dismissed OpenEMR product registration prompt (New Clinic)',
            0
        );
    }
}

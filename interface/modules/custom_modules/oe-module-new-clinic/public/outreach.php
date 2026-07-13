<?php

/**
 * Outreach — batch SMS/email campaigns (React island, GAP-B / B1).
 *
 * Smart-vs-legacy: when `enable_outreach` is OFF (default), redirect to the stock
 * Batch Communication Tool. The legacy screen stays reachable until this
 * replacement passes parity sign-off.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$webroot = $GLOBALS['webroot'] ?? '';

if ($config->getInt('enable_outreach', 0, $facilityId) !== 1) {
    header('Location: ' . $webroot . '/interface/batchcom/batchcom.php', true, 302);
    exit;
}

(new PageController())->renderForAnyAcl('outreach.html.twig', 'Outreach', ['new_admin'], [
    'island_entry' => 'outreach',
    'shell_nav_id' => 'clinicadmin',
    'webroot' => $webroot,
    'legacy_url' => $webroot . '/interface/batchcom/batchcom.php',
]);

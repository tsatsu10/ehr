<?php

/**
 * Communications Hub — staff messages and dated reminders (COM Phase 1)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\PageController;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$visitScope = new VisitScopeService();
$sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;
$facilityId = $visitScope->resolveDeskFacilityId($sessionFacility);

if (!$config->isEnabled('communications_hub_enable', 0, $facilityId)) {
    $webroot = $GLOBALS['webroot'] ?? '';
    header('Location: ' . $webroot . '/interface/main/messages/messages.php?form_active=1', true, 302);
    exit;
}

$webroot = $GLOBALS['webroot'] ?? '';
$moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';

(new PageController())->renderForCoreNotesAcl('communications.html.twig', 'Communications', [
    'shell_nav_id' => 'clinicmsg',
    'module_url' => $moduleUrl,
    'can_view_all_users' => AclMain::aclCheckCore('admin', 'super'),
    'reminder_add_url' => $webroot . '/interface/main/dated_reminders/dated_reminders_add.php',
    'reminder_log_url' => $webroot . '/interface/main/dated_reminders/dated_reminders_log.php',
    'legacy_compose_url' => $webroot . '/interface/main/messages/messages.php?form_active=1',
    'initial_lens' => in_array((string) ($_GET['lens'] ?? ''), ['messages', 'reminders'], true)
        ? (string) $_GET['lens']
        : 'messages',
]);

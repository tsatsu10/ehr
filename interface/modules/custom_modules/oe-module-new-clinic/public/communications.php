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
use OpenEMR\Modules\NewClinic\Services\CommHubUserSettingsService;

$config = new ClinicConfigService();
$webroot = $GLOBALS['webroot'] ?? '';
$moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$reactCommunicationsHub = $config->get('enable_react_communications_hub', '1') === '1';

$composeLaunch = null;
if (($_GET['task'] ?? '') === 'addnew') {
    $attachId = (int) ($_GET['attach'] ?? 0);
    $attachType = (int) ($_GET['gptype'] ?? 0);
    $jobId = trim((string) ($_GET['jobId'] ?? ''));
    $seedPid = max(0, (int) ($_GET['pid'] ?? 0));
    $attachment = null;
    if ($attachId > 0 && $attachType > 0) {
        $attachment = [
            'attachment_id' => $attachId,
            'attachment_type' => $attachType,
            'job_id' => $jobId !== '' ? $jobId : null,
        ];
    }
    $composeLaunch = [
        'open_compose' => true,
        'attachment' => $attachment,
        'pid' => $seedPid > 0 ? $seedPid : null,
    ];
}

$canViewAllUsers = AclMain::aclCheckCore('admin', 'super');
$lensFromQuery = in_array((string) ($_GET['lens'] ?? ''), ['messages', 'reminders'], true)
    ? (string) $_GET['lens']
    : null;
$preferences = (new CommHubUserSettingsService())->getPreferences($lensFromQuery, $canViewAllUsers);

(new PageController())->renderForCoreNotesAcl('communications.html.twig', 'Communications', [
    'island_entry' => 'communications-hub',
    'shell_nav_id' => 'clinicmsg',
    'module_url' => $moduleUrl,
    'can_view_all_users' => $canViewAllUsers,
    'initial_lens' => $preferences['lens'],
    'preferences' => $preferences,
    'compose_launch' => $composeLaunch,
    'enable_react_communications_hub' => $reactCommunicationsHub,
]);

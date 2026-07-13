<?php

/**
 * OpenEMR background-service function for scheduled backups (GAP-C C6 follow-up).
 *
 * Registered in the `background_services` table. The logged-in UI heartbeat
 * (`library/ajax/execute_background_services.php`) calls this on its interval —
 * so scheduled backups run **without any OS cron / Task Scheduler**, as long as
 * someone has OpenEMR open. The `running` lock + shutdown reset are handled by
 * the framework; this function just delegates and no-ops unless native backup is
 * on AND a backup is due (per `backup_frequency_days`).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Modules\NewClinic\Services\AdminBackupService;

if (!function_exists('nc_scheduled_backup_service')) {
    function nc_scheduled_backup_service(): void
    {
        // A backup can take a while; don't let the web time limit kill it midway.
        @set_time_limit(0);

        if (!class_exists(AdminBackupService::class)) {
            // Module not autoloaded in this context — nothing to do, don't fatal the heartbeat.
            return;
        }

        try {
            $svc = new AdminBackupService();
            $svc->runScheduledBackup(0);
            // Separate site-files backup (design §3b) — its own due-check; no-ops
            // unless `backup_include_site_files` is on and the files backup is due.
            $svc->runScheduledFilesBackup(0);
        } catch (\Throwable $e) {
            error_log('nc_scheduled_backup_service failed: ' . $e->getMessage());
        }
    }
}

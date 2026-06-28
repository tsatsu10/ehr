<?php

/**
 * Inject restoreSession on stock pages opened outside tabs/main.php (New Clinic deep links)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Modules\NewClinic\GlobalConfig;

class DeepLinkRestoreSessionService
{
    /** @var list<string> */
    public const RESTORE_SESSION_SCRIPT_SUFFIXES = [
        '/patient_file/encounter/encounter_top.php',
        '/patient_file/summary/labdata.php',
        '/patient_file/summary/demographics.php',
        '/patient_file/summary/stats_full.php',
        '/patient_file/summary/pnotes_full.php',
        '/patient_file/summary/pnotes_full_add.php',
        '/patient_file/summary/disclosure_full.php',
        '/patient_file/summary/stats.php',
        '/patient_file/summary/documents.php',
        '/patient_file/history/history.php',
        '/patient_file/history/history_full.php',
        '/patient_file/history/history_sdoh_widget.php',
        '/patient_file/report/patient_report.php',
        '/patient_file/report/custom_report.php',
        '/patient_file/transaction/transactions.php',
        '/patient_file/transaction/add_transaction.php',
        '/patient_file/reminder/patient_reminders.php',
        '/patient_file/summary/immunizations.php',
        '/patient_file/summary/add_edit_issue.php',
        '/reports/pat_ledger.php',
        '/reports/external_data.php',
        '/easipro/pro.php',
        '/orders/orders_results.php',
        '/drugs/drug_inventory.php',
    ];

    public function shouldBufferCurrentRequest(): bool
    {
        if (!$this->isModuleActive()) {
            return false;
        }

        return $this->requestMatchesAllowlist();
    }

    public function htmlAlreadyHasRestoreSession(string $html): bool
    {
        return stripos($html, 'function restoreSession') !== false
            || stripos($html, 'oemr_session_name') !== false;
    }

    public function buildRestoreSessionScriptTag(): string
    {
        global $srcdir;

        ob_start();
        require $srcdir . '/restoreSession.php';
        $js = ob_get_clean();
        if (!is_string($js) || trim($js) === '') {
            return '';
        }

        return "<script>\n" . $js . "\n</script>\n";
    }

    public function injectIntoHtml(string $html): string
    {
        if ($html === '' || $this->htmlAlreadyHasRestoreSession($html)) {
            return $html;
        }

        $script = $this->buildRestoreSessionScriptTag();
        if ($script === '') {
            return $html;
        }

        if (preg_match('/<head([^>]*)>/i', $html, $matches, PREG_OFFSET_CAPTURE)) {
            $insertAt = $matches[0][1] + strlen($matches[0][0]);

            return substr($html, 0, $insertAt) . $script . substr($html, $insertAt);
        }

        return $script . $html;
    }

    private function requestMatchesAllowlist(): bool
    {
        $script = $this->currentScriptName();
        if ($script === '') {
            return false;
        }

        if (str_contains($script, '/oe-module-new-clinic/')) {
            return false;
        }

        if (str_ends_with($script, '/main/finder/dynamic_finder.php')) {
            return false;
        }

        if (!empty($_REQUEST['pdf']) || !empty($_REQUEST['export'])) {
            return false;
        }

        if ($this->isPrescriptionController($script)) {
            return true;
        }

        foreach (self::RESTORE_SESSION_SCRIPT_SUFFIXES as $suffix) {
            if (str_ends_with($script, $suffix)) {
                return true;
            }
        }

        return false;
    }

    private function isPrescriptionController(string $script): bool
    {
        if (!str_ends_with($script, '/controller.php')) {
            return false;
        }

        return isset($_GET['prescription']);
    }

    private function currentScriptName(): string
    {
        return str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    }

    private function isModuleActive(): bool
    {
        global $GLOBALS;

        return (new GlobalConfig($GLOBALS))->isModuleActive();
    }
}

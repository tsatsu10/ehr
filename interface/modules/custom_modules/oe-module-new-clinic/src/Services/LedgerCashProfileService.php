<?php

/**
 * Cash-profile wrapper for stock Patient Ledger (M11-F11 / FIN-1)
 *
 * Hides payer / insurance vocabulary on `reports/pat_ledger.php` when the
 * clinic runs with `enable_insurance` = 0 — the wrapper half of M11-F11
 * that the T1-F18 identity strip does not cover.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\GlobalConfig;
use OpenEMR\Modules\NewClinic\Support\RequestScriptName;

class LedgerCashProfileService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function shouldBufferCurrentRequest(): bool
    {
        $script = RequestScriptName::current();
        if (!str_ends_with($script, '/reports/pat_ledger.php')) {
            return false;
        }

        // CSV export output must stay untouched.
        if (!empty($_REQUEST['form_csvexport'])) {
            return false;
        }

        if (!$this->isModuleActive()) {
            return false;
        }

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        if ($this->config->getInt('enable_insurance', 0, $facilityId) === 1) {
            return false;
        }

        return $this->userHasClinicRole();
    }

    /**
     * Snippet that strips payer vocabulary from the rendered ledger:
     * data cells built as "{date}&nbsp;/&nbsp;{payer}" keep only the date
     * portion, and the "Billed Date / Payor" header keeps only "Billed Date".
     */
    public function renderSnippet(): string
    {
        return <<<'HTML'
<script id="nc-ledger-cash-profile">
(function () {
    function stripPayer() {
        var results = document.getElementById('report_results');
        if (!results) {
            return;
        }
        var nbspSep = String.fromCharCode(160) + '/' + String.fromCharCode(160);
        var plainSep = ' / ';
        var cells = results.querySelectorAll('td');
        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i];
            if (cell.children.length > 0) {
                continue;
            }
            var text = cell.textContent || '';
            if (text.indexOf(nbspSep) !== -1) {
                cell.textContent = text.split(nbspSep)[0];
            } else if (text.indexOf(plainSep) !== -1 && cell.classList.contains('font-weight-bold')) {
                cell.textContent = text.split(plainSep)[0];
            }
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', stripPayer);
    } else {
        stripPayer();
    }
})();
</script>
HTML;
    }

    public function injectIntoHtml(string $html, string $snippet): string
    {
        if ($snippet === '') {
            return $html;
        }

        $pos = stripos($html, '</body>');
        if ($pos !== false) {
            return substr($html, 0, $pos) . $snippet . substr($html, $pos);
        }

        return $html . $snippet;
    }

    private function userHasClinicRole(): bool
    {
        foreach (AjaxActionPolicy::CHART_READ_ACLS as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return true;
            }
        }

        return false;
    }

    private function isModuleActive(): bool
    {
        global $GLOBALS;

        return (new GlobalConfig($GLOBALS))->isModuleActive();
    }
}

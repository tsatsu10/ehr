<?php

/**
 * Pilot wrappers for stock chart pages (M11-F11 report + transactions halves)
 *
 * EXP-1 — `patient_report.php`: hide the CCR/CCD block and the insurance /
 * billing checkboxes when the clinic runs cash-only (`enable_insurance` = 0).
 * REF-1 — `transactions.php`: retitle the page "Referrals & letters".
 *
 * The T1-F18 identity strip is injected separately; this service only covers
 * the page-content adjustments those spec halves assign to the wrapper.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\GlobalConfig;
use OpenEMR\Modules\NewClinic\Support\HistoryEditorWrapGate;

class StockChartWrapService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function shouldBufferCurrentRequest(): bool
    {
        if ($this->currentPage() === null) {
            return false;
        }

        if (!$this->isModuleActive()) {
            return false;
        }

        return $this->userHasClinicRole();
    }

    public function renderSnippet(): string
    {
        return match ($this->currentPage()) {
            'report' => $this->reportSnippet(),
            'transactions' => $this->transactionsSnippet(),
            default => '',
        };
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

    private function currentPage(): ?string
    {
        $script = HistoryEditorWrapGate::currentScriptName();
        if (str_ends_with($script, '/patient_file/report/patient_report.php')) {
            return 'report';
        }
        if (str_ends_with($script, '/patient_file/transaction/transactions.php')) {
            return 'transactions';
        }

        return null;
    }

    /**
     * EXP-1 — cash-profile trims on the stock Patient Report builder.
     * No-op snippet when insurance is enabled for this clinic.
     */
    private function reportSnippet(): string
    {
        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        if ($this->config->getInt('enable_insurance', 0, $facilityId) === 1) {
            return '';
        }

        return <<<'HTML'
<style id="nc-report-cash-profile-css">
#ccr_report { display: none !important; }
</style>
<script id="nc-report-cash-profile">
(function () {
    function trim() {
        ['include_insurance', 'include_billing'].forEach(function (id) {
            var box = document.getElementById(id);
            if (!box) {
                return;
            }
            box.checked = false;
            var wrap = box.closest('label') || box.closest('div') || box.parentElement;
            if (wrap) {
                wrap.style.display = 'none';
            }
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', trim);
    } else {
        trim();
    }
})();
</script>
HTML;
    }

    /**
     * REF-1 — task-named heading on the stock Transactions page.
     */
    private function transactionsSnippet(): string
    {
        $label = json_encode(xl('Referrals & letters'));

        return <<<HTML
<script id="nc-transactions-heading">
(function () {
    function retitle() {
        var label = {$label};
        var headings = document.querySelectorAll('h1, h2, h3');
        for (var i = 0; i < headings.length; i++) {
            if (/transactions/i.test(headings[i].textContent || '')) {
                headings[i].textContent = label;
                break;
            }
        }
        if (/transactions/i.test(document.title || '')) {
            document.title = label;
        }
    }
    // D-REF-3 — referral rows (title=LBTref in the edit link, not the display
    // label) sort to the top of the stock list; relative order preserved.
    function sortReferralsFirst() {
        var anchors = document.querySelectorAll('a[href*="add_transaction.php"][href*="title=LBTref"]');
        var rows = [];
        for (var i = 0; i < anchors.length; i++) {
            var tr = anchors[i].closest('tr');
            if (tr && tr.parentElement && rows.indexOf(tr) === -1) {
                rows.push(tr);
            }
        }
        for (var j = rows.length - 1; j >= 0; j--) {
            var body = rows[j].parentElement;
            if (body && body.firstElementChild !== rows[j]) {
                body.insertBefore(rows[j], body.firstElementChild);
            }
        }
    }
    function apply() {
        retitle();
        sortReferralsFirst();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply);
    } else {
        apply();
    }
})();
</script>
HTML;
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

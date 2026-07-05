<?php

/**
 * Flow Board (patient_tracker) queue bridge chip injection (M18-F08)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Csrf\CsrfUtils;

class QueueBridgeFlowBoardService
{
    public function __construct(
        private readonly QueueBridgeSurfaceService $surface = new QueueBridgeSurfaceService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly SchedulingAccessService $schedulingAccess = new SchedulingAccessService(),
    ) {
    }

    public function shouldBufferCurrentRequest(): bool
    {
        if (!$this->surface->isSurfaceEnabled()) {
            return false;
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId();
        if ($this->schedulingAccess->isHubEnabled($facilityId)) {
            return false;
        }

        $script = (string) ($_SERVER['SCRIPT_NAME'] ?? '');

        return str_contains($script, '/patient_tracker/patient_tracker.php');
    }

    public function injectIntoHtml(string $html): string
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId();
        $chips = $this->surface->flowBoardChips($facilityId);
        if ($chips === []) {
            return $html;
        }

        $ajaxUrl = ($GLOBALS['webroot'] ?? '')
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/ajax.php';
        $csrf = CsrfUtils::collectCsrfToken();
        $payload = json_encode([
            'chips' => $chips,
            'ajaxUrl' => $ajaxUrl,
            'csrfToken' => $csrf,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);

        $script = <<<HTML
<script>
(function () {
  var cfg = {$payload};
  function applyChips() {
    (cfg.chips || []).forEach(function (chip) {
      var rows = document.querySelectorAll('tr[data-pid="' + chip.pid + '"][data-apptstatus="@"]');
      rows.forEach(function (row, index) {
        if (index > 0) return;
        if (row.querySelector('.nc-flowbridge-chip')) return;
        var cell = row.querySelector('td.detail.text-center[name="kiosk_hide"] a')
          || row.querySelector('td.detail.text-center a');
        if (!cell || !cell.parentElement) return;
        var wrap = document.createElement('span');
        wrap.className = 'nc-flowbridge-chip nc-badge nc-badge-warning ml-1';
        wrap.innerHTML = 'No clinical visit <a href="' + chip.fix_url + '" class="text-dark ml-1"><u>Fix</u></a>';
        cell.parentElement.appendChild(wrap);
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyChips);
  } else {
    applyChips();
  }
})();
</script>
HTML;

        if (stripos($html, '</body>') !== false) {
            return str_ireplace('</body>', $script . "\n</body>", $html);
        }

        return $html . $script;
    }
}

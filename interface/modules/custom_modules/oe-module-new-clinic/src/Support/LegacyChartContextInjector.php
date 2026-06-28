<?php

/**
 * Output-buffer injection for legacy patient context strip (T1-F18)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Support;

use OpenEMR\Modules\NewClinic\Services\LegacyChartContextService;

class LegacyChartContextInjector
{
    private static bool $bufferStarted = false;

    public function __construct(
        private readonly LegacyChartContextService $stripService,
    ) {
    }

    public function startIfNeeded(): void
    {
        if (self::$bufferStarted || !$this->stripService->shouldBufferCurrentRequest()) {
            return;
        }

        self::$bufferStarted = true;
        ob_start();
        register_shutdown_function($this->injectOnShutdown(...));
    }

    public function injectOnShutdown(): void
    {
        if (!self::$bufferStarted) {
            return;
        }

        $html = ob_get_clean();
        if (!is_string($html) || $html === '') {
            return;
        }

        if (!$this->stripService->shouldRenderForBufferedHtml($html)) {
            echo $html;

            return;
        }

        $strip = $this->stripService->renderHtml();
        echo $this->stripService->injectIntoHtml($html, $strip);
    }
}

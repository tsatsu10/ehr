<?php

/**
 * Output-buffer injection for History editor T1 wrap (T1-F20b)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Support;

use OpenEMR\Modules\NewClinic\Services\HistoryEditorWrapService;

class HistoryEditorWrapInjector
{
    private static bool $bufferStarted = false;

    public function __construct(
        private readonly HistoryEditorWrapService $wrapService,
    ) {
    }

    public function startIfNeeded(): void
    {
        if (self::$bufferStarted || !$this->wrapService->shouldBufferCurrentRequest()) {
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

        if (!$this->wrapService->shouldWrapBufferedHtml($html)) {
            echo $html;

            return;
        }

        $wrap = $this->wrapService->renderWrapHtml();
        echo $this->wrapService->injectIntoHtml($html, $wrap);
    }
}

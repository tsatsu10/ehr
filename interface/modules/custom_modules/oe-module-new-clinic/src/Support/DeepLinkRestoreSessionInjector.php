<?php

/**
 * Output-buffer injection for restoreSession on stock deep-link pages
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Support;

use OpenEMR\Modules\NewClinic\Services\DeepLinkRestoreSessionService;

class DeepLinkRestoreSessionInjector
{
    private static bool $bufferStarted = false;

    public function __construct(
        private readonly DeepLinkRestoreSessionService $service,
    ) {
    }

    public function startIfNeeded(): void
    {
        if (self::$bufferStarted || !$this->service->shouldBufferCurrentRequest()) {
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

        echo $this->service->injectIntoHtml($html);
    }
}

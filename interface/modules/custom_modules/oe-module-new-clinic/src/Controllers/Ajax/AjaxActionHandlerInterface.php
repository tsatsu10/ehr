<?php

/**
 * Per-domain ajax action handler (AUDIT-10b+).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax;

interface AjaxActionHandlerInterface
{
    public function supports(string $action): bool;

    public function handle(string $action, string $method, int $userId): void;
}

<?php

/**
 * Request gate for history editor T1 wrap (shared by HIST-WRAP + legacy context strip).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Support;

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

class HistoryEditorWrapGate
{
    public const EDITOR_SUFFIX = '/patient_file/history/history_full.php';

    public static function displacesLegacyStrip(
        ClinicConfigService $config,
        VisitScopeService $visitScope,
    ): bool {
        $facilityId = $visitScope->resolveDefaultFacilityId();

        return $config->getInt('enable_history_editor_wrap', 0, $facilityId) === 1
            && self::requestMatchesEditor();
    }

    public static function requestMatchesEditor(): bool
    {
        $script = self::currentScriptName();
        if (str_contains($script, '/oe-module-new-clinic/')) {
            return false;
        }

        return str_ends_with($script, self::EDITOR_SUFFIX);
    }

    public static function currentScriptName(): string
    {
        return str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    }
}

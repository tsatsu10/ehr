<?php

/**
 * Session locale resolution for the New Clinic shell (GAP-D D1, i18n foundation).
 *
 * Resolves the signed-in user's core language preference — the same
 * `$_SESSION['language_choice']` lang_id that core `xl()` translates by —
 * into a two-letter `lang_languages.lang_code`, and (when a dictionary file
 * ships for that locale) a versioned URL to the module's static dictionary
 * at `public/assets/i18n/<code>.json`. Both are stamped on the `#nc-t1`
 * shell root so React islands can translate via `@core/i18n`'s `t()`.
 *
 * English (lang_id 1 / no session choice) yields no dictionary URL: `t()`
 * is a pass-through, matching core xl()'s English-as-source model. A
 * non-English locale with no dictionary file also yields no URL — islands
 * fail open to English rather than fetching a 404.
 *
 * No constructor dependencies (crash-pattern rule: never eager-construct
 * service trees).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\ModuleAssetVersion;

class ShellLocaleService
{
    /**
     * Two-letter language code for the session user. Falls back to 'en'
     * for a missing/default session choice, an unknown lang_id, or a
     * malformed code (lang_code is char(2) but defensive anyway).
     */
    public function getLangCode(): string
    {
        $langId = (int) ($_SESSION['language_choice'] ?? 1);
        if ($langId <= 1) {
            return 'en';
        }

        $row = QueryUtils::fetchRecords(
            'SELECT lang_code FROM lang_languages WHERE lang_id = ?',
            [$langId]
        ) ?: [];
        $code = strtolower(trim((string) ($row[0]['lang_code'] ?? '')));

        return preg_match('/^[a-z]{2}$/', $code) === 1 ? $code : 'en';
    }

    /**
     * Versioned URL of the locale's island dictionary, or '' when the
     * locale is English or no dictionary file ships for it.
     *
     * @param string|null $assetsDir override of the on-disk assets dir (tests)
     */
    public function getDictionaryUrl(string $langCode, ?string $assetsDir = null): string
    {
        if ($langCode === 'en' || preg_match('/^[a-z]{2}$/', $langCode) !== 1) {
            return '';
        }

        $dir = $assetsDir ?? dirname(__DIR__, 2) . '/public/assets';
        if (!is_file($dir . '/i18n/' . $langCode . '.json')) {
            return '';
        }

        return ($GLOBALS['webroot'] ?? '')
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/assets/i18n/'
            . $langCode . '.json?v=' . ModuleAssetVersion::VERSION;
    }
}

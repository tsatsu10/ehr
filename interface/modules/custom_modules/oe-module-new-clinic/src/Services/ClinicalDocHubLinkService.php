<?php

/**
 * M17 Clinical Documentation Hub — deep links from MRD and desks
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ClinicalDocHubLinkService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public static function buildHubUrl(int $visitId, string $tab = 'visit'): string
    {
        $modulePublic = ($GLOBALS['webroot'] ?? '')
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/';

        return $modulePublic
            . 'clinical-doc/index.php?visit_id='
            . urlencode((string) $visitId)
            . '&tab='
            . urlencode($tab);
    }

    /** Encounter-only hub link — stock/historical encounters with no queue visit row. */
    public static function buildHubEncounterUrl(int $encounterId, string $tab = 'visit'): string
    {
        $modulePublic = ($GLOBALS['webroot'] ?? '')
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/';

        return $modulePublic
            . 'clinical-doc/index.php?encounter_id='
            . urlencode((string) $encounterId)
            . '&tab='
            . urlencode($tab);
    }

    /** Permanent surface since 2026-07-18 — `enable_clinical_doc_hub` retired (PRD §5.6 amendment). */
    public function isHubEnabled(?int $facilityId = null): bool
    {
        return true;
    }

    public function resolveVisitIdForEncounter(int $pid, int $encounterId): ?int
    {
        if ($pid <= 0 || $encounterId <= 0) {
            return null;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT id FROM new_visit WHERE pid = ? AND encounter = ? ORDER BY id DESC LIMIT 1',
            [$pid, $encounterId]
        );

        if (!is_array($row)) {
            return null;
        }

        $visitId = (int) ($row['id'] ?? 0);

        return $visitId > 0 ? $visitId : null;
    }

    public function buildDocumentationUrl(int $pid, int $encounterId, ?int $facilityId = null): ?string
    {
        if ($encounterId <= 0) {
            return null;
        }

        $visitId = $this->resolveVisitIdForEncounter($pid, $encounterId);
        if ($visitId !== null) {
            return self::buildHubUrl($visitId);
        }

        // No queue visit for this encounter — the hub's encounter-only mode covers it.
        return self::buildHubEncounterUrl($encounterId);
    }
}

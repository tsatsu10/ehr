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

    public function isHubEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId < 0) {
            $facilityId = 0;
        }

        return $this->config->getInt('enable_clinical_doc_hub', 0, $facilityId) === 1;
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

        $webroot = $GLOBALS['webroot'] ?? '';
        $visitId = $this->resolveVisitIdForEncounter($pid, $encounterId);
        if ($visitId !== null) {
            $visit = [
                'id' => $visitId,
                'pid' => $pid,
                'encounter' => $encounterId,
                'facility_id' => $facilityId ?? 0,
            ];
            $openUrl = (new EncounterSignService())->buildOpenUrlForVisit($visit, [
                'return_to' => 'hub',
                'tab' => 'consult',
            ]);
            if ($this->isHubEnabled($facilityId)) {
                return self::buildHubUrl($visitId);
            }

            return $openUrl;
        }

        return EncounterSignService::buildEncounterUrl($webroot, $pid, $encounterId);
    }
}

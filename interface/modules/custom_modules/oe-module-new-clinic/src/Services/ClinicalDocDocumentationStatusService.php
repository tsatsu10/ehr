<?php

/**
 * M17 / M4-F40 — unsigned required documentation forms for active visit
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ClinicalDocDocumentationStatusService
{
    public function __construct(
        private readonly ClinicalDocHubLinkService $hubLinks = new ClinicalDocHubLinkService(),
        private readonly ClinicalDocCatalogService $catalog = new ClinicalDocCatalogService(),
        private readonly EncounterSignService $signService = new EncounterSignService(),
        private readonly EncounterNoteService $encounterNote = new EncounterNoteService(),
    ) {
    }

    /**
     * @param array<string, mixed> $visit
     * @return array<string, mixed>
     */
    public function getStatusForVisit(array $visit, ?int $facilityId = null): array
    {
        $visitId = (int) ($visit['id'] ?? 0);
        $pid = (int) ($visit['pid'] ?? 0);
        $encounterId = (int) ($visit['encounter'] ?? 0);
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = (int) ($visit['facility_id'] ?? 0);
        }

        $hubEnabled = $this->hubLinks->isHubEnabled($facilityId);
        $unsignedRequired = [];
        if ($encounterId > 0) {
            foreach ($this->signService->getRequiredDocumentationSpecs($visit, $facilityId) as $spec) {
                $formdir = $this->catalog->resolveRegistryDirectory($spec['formdir']);
                if ($this->signService->isFormdirSignedOnEncounter($encounterId, $pid, $formdir)) {
                    continue;
                }
                $unsignedRequired[] = [
                    'formdir' => $formdir,
                    'title' => $this->resolveFormTitle($formdir, $spec['title']),
                    'started' => $this->isFormdirStartedOnEncounter($encounterId, $pid, $formdir),
                ];
            }
        }

        return [
            'hub_enabled' => $hubEnabled,
            'encounter_signed' => empty($unsignedRequired),
            'unsigned_required' => $unsignedRequired,
            'documentation_hub_url' => $hubEnabled && $visitId > 0
                ? ClinicalDocHubLinkService::buildHubUrl($visitId)
                : null,
            'encounter_note_preview' => $visitId > 0
                ? $this->encounterNote->buildNotePreview($visitId, $facilityId)
                : null,
        ];
    }

    private function resolveFormTitle(string $formdir, string $fallback): string
    {
        if (strcasecmp($formdir, EncounterNoteService::NATIVE_FORMDIR) === 0) {
            return 'Consultation note';
        }

        $row = QueryUtils::querySingleRow(
            'SELECT name FROM registry WHERE LOWER(directory) = ? LIMIT 1',
            [strtolower($formdir)]
        );
        if (is_array($row)) {
            $name = trim((string) ($row['name'] ?? ''));
            if ($name !== '') {
                return $name;
            }
        }

        $lbfRow = QueryUtils::querySingleRow(
            "SELECT grp_title FROM layout_group_properties
             WHERE grp_form_id = ? AND grp_group_id = '' AND grp_activity = 1 LIMIT 1",
            [$formdir]
        );
        if (is_array($lbfRow)) {
            $title = trim((string) ($lbfRow['grp_title'] ?? ''));
            if ($title !== '') {
                return $title;
            }
        }

        return $fallback;
    }

    private function isFormdirStartedOnEncounter(int $encounterId, int $pid, string $formdir): bool
    {
        $row = QueryUtils::querySingleRow(
            'SELECT id FROM forms
             WHERE encounter = ? AND pid = ? AND deleted = 0 AND LOWER(formdir) = ?
             LIMIT 1',
            [$encounterId, $pid, strtolower($formdir)]
        );

        return is_array($row);
    }
}

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
    /**
     * @param bool $includeNotePreview Building the native-note preview is a non-trivial
     *        extra read; callers that only need the required-forms status (e.g. the
     *        Clinical Doc hub's sign overview) pass false to skip it.
     */
    public function getStatusForVisit(array $visit, ?int $facilityId = null, bool $includeNotePreview = true): array
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
            $resolved = [];
            foreach ($this->signService->getRequiredDocumentationSpecs($visit, $facilityId) as $spec) {
                $resolved[] = [
                    'formdir' => $this->catalog->resolveRegistryDirectory($spec['formdir']),
                    'title' => (string) ($spec['title'] ?? ''),
                ];
            }
            if ($resolved !== []) {
                // Batch both checks over the required-forms set instead of two point
                // queries each: signed via the authoritative EncounterSignService batch
                // (keeps the e-sign check as the single source of truth), started via
                // one encounter-forms load.
                $signedFormdirs = $this->signService->getSignedFormdirsOnEncounter(
                    $encounterId,
                    $pid,
                    array_column($resolved, 'formdir')
                );
                $startedFormMap = $this->loadEncounterFormMap($encounterId, $pid);
                foreach ($resolved as $row) {
                    $formdir = $row['formdir'];
                    if (isset($signedFormdirs[strtolower($formdir)])) {
                        continue;
                    }
                    $unsignedRequired[] = [
                        'formdir' => $formdir,
                        'title' => $this->resolveFormTitle($formdir, $row['title']),
                        'started' => isset($startedFormMap[strtolower($formdir)]),
                    ];
                }
            }
        }

        return [
            'hub_enabled' => $hubEnabled,
            'encounter_signed' => empty($unsignedRequired),
            'unsigned_required' => $unsignedRequired,
            'documentation_hub_url' => $hubEnabled && $visitId > 0
                ? ClinicalDocHubLinkService::buildHubUrl($visitId)
                : null,
            'encounter_note_preview' => ($includeNotePreview && $visitId > 0)
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

    /**
     * lower(formdir) => a (non-deleted) forms row exists on the encounter, in one query.
     * Used only for the non-compliance "started?" flag; the "signed?" check goes through
     * EncounterSignService.
     *
     * @return array<string, true>
     */
    private function loadEncounterFormMap(int $encounterId, int $pid): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT DISTINCT LOWER(formdir) AS fd FROM forms
             WHERE encounter = ? AND pid = ? AND deleted = 0',
            [$encounterId, $pid]
        ) ?: [];

        $map = [];
        foreach ($rows as $row) {
            $fd = (string) ($row['fd'] ?? '');
            if ($fd !== '') {
                $map[$fd] = true;
            }
        }

        return $map;
    }
}

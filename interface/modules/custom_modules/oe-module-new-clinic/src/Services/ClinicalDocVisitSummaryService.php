<?php

/**
 * M17 Clinical Documentation Hub — visit summary and sign status
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ClinicalDocVisitSummaryService
{
    public function __construct(
        private readonly ClinicalDocAccessService $access = new ClinicalDocAccessService(),
        private readonly ClinicalDocCatalogService $catalog = new ClinicalDocCatalogService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly EncounterSignService $signService = new EncounterSignService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ClinicalDocDocumentationStatusService $docStatus = new ClinicalDocDocumentationStatusService(),
        private readonly LabPanelOrderService $labPanelOrder = new LabPanelOrderService(),
        private readonly AdminFormBundleService $formBundle = new AdminFormBundleService(),
        private readonly EncounterNoteService $encounterNote = new EncounterNoteService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getVisitSummary(int $visitId, int $actorUserId, ?string $lens = null): array
    {
        $this->access->assertHubAccess();
        if ($lens !== null && $lens !== '') {
            $this->access->assertLensAccess($lens);
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        $encounterId = (int) ($visit['encounter'] ?? 0);
        if ($encounterId <= 0) {
            throw new \RuntimeException('No encounter on visit', 409);
        }

        $pid = (int) ($visit['pid'] ?? 0);
        $patient = QueryUtils::querySingleRow(
            'SELECT fname, lname, pubpid, DOB FROM patient_data WHERE pid = ?',
            [$pid]
        ) ?: [];

        $facilityId = (int) ($visit['facility_id'] ?? $this->visitScope->resolveDeskFacilityId());
        $catalog = $this->catalog->getCatalog($lens, $facilityId);
        $instances = $this->loadFormInstances($encounterId, $pid);
        $cards = $this->enrichCardsWithBundleHealth(
            $this->enrichCardsWithNotePreview(
                $this->mergeCardsWithInstances($catalog['cards'], $instances),
                $visitId,
                $facilityId
            ),
            $facilityId
        );

        $encounterSigned = $this->signService->isEncounterDocumentationSigned($encounterId);
        $webroot = $GLOBALS['webroot'] ?? '';
        $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';

        $payload = [
            'visit' => [
                'id' => $visitId,
                'queue_number' => (int) ($visit['queue_number'] ?? 0),
                'state' => (string) ($visit['state'] ?? ''),
                'encounter' => $encounterId,
                'pid' => $pid,
                'assigned_provider_id' => (int) ($visit['assigned_provider_id'] ?? 0),
                'service_profile' => (string) ($visit['service_profile'] ?? 'full_opd'),
            ],
            'patient' => [
                'display_name' => $this->displayName($patient),
                'pubpid' => (string) ($patient['pubpid'] ?? $pid),
                'dob' => (string) ($patient['DOB'] ?? ''),
            ],
            'sign_status' => [
                'encounter_signed' => $encounterSigned,
                'require_esign_before_complete_consult' => $this->config->getInt(
                    'require_esign_before_complete_consult',
                    0,
                    $facilityId
                ) === 1,
            ],
            'lenses' => $this->access->allowedLenses($facilityId),
            'cards' => $cards,
            'consult_note_formdir' => (string) ($catalog['consult_note_formdir'] ?? 'soap'),
            'show_us_quality' => (bool) ($catalog['show_us_quality'] ?? false),
            'lab_panel_order_enabled' => $this->labPanelOrder->isFeatureEnabled($facilityId),
            'doctor_desk_url' => $modulePublic . 'doctor.php',
            'advanced_encounter_url' => EncounterSignService::buildEncounterUrl($webroot, $pid, $encounterId),
        ];

        if ($lens === 'visit') {
            $payload['sign_overview'] = $this->buildSignOverview($visit, $cards, $facilityId, $encounterSigned);
            $payload['addable_forms'] = $this->buildAddableForms($encounterId, $pid, $facilityId);
        }

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    public function getSignStatus(int $visitId): array
    {
        $this->access->assertHubAccess();
        $visit = $this->queueService->getVisitForActor($visitId);
        $encounterId = (int) ($visit['encounter'] ?? 0);
        if ($encounterId <= 0) {
            throw new \RuntimeException('No encounter on visit', 409);
        }

        return [
            'encounter_signed' => $this->signService->isEncounterDocumentationSigned($encounterId),
            'visit_id' => $visitId,
            'encounter' => $encounterId,
        ];
    }

    /**
     * M4-F42 — three-pin bundle favorites for Doctor Desk drawer.
     *
     * @return array<string, mixed>
     */
    public function getFavorites(int $visitId, int $actorUserId): array
    {
        $this->access->assertHubAccess();
        $visit = $this->queueService->getVisitForActor($visitId);
        $encounterId = (int) ($visit['encounter'] ?? 0);
        if ($encounterId <= 0) {
            throw new \RuntimeException('No encounter on visit', 409);
        }

        $facilityId = (int) ($visit['facility_id'] ?? $this->visitScope->resolveDeskFacilityId());
        $pid = (int) ($visit['pid'] ?? 0);
        $pinCards = $this->catalog->getFavoritePinCards($facilityId);
        $instances = $this->loadFormInstances($encounterId, $pid);

        return [
            'visit_id' => $visitId,
            'favorites' => $this->mergeCardsWithInstances($pinCards, $instances),
            'documentation_hub_url' => ClinicalDocHubLinkService::buildHubUrl($visitId),
        ];
    }

    /**
     * @param list<array<string, mixed>> $cards
     * @param array<string, array<string, mixed>> $instances
     * @return list<array<string, mixed>>
     */
    private function mergeCardsWithInstances(array $cards, array $instances): array
    {
        $merged = [];
        foreach ($cards as $card) {
            $formdir = (string) ($card['formdir'] ?? '');
            $instance = $instances[$formdir] ?? null;
            $merged[] = array_merge($card, [
                'started' => $instance !== null,
                'form_id' => $instance['form_id'] ?? null,
                'forms_row_id' => $instance['forms_row_id'] ?? null,
                'last_saved_at' => $instance['last_saved_at'] ?? null,
                'last_saved_by' => $instance['last_saved_by'] ?? null,
                'signed' => (bool) ($instance['signed'] ?? false),
            ]);
        }

        return $merged;
    }

    /**
     * @param list<array<string, mixed>> $cards
     * @return list<array<string, mixed>>
     */
    private function enrichCardsWithBundleHealth(array $cards, int $facilityId): array
    {
        $enriched = [];
        foreach ($cards as $card) {
            $formdir = (string) ($card['formdir'] ?? '');
            $health = $this->formBundle->getFormHealth($formdir, $facilityId);
            if ($health !== null) {
                $card['bundle_health'] = $health;
            }
            $enriched[] = $card;
        }

        return $enriched;
    }

    /**
     * V1.2-DOC-HLF-4 — CC snippet, problem counts, validate-ready for native consult card.
     *
     * @param list<array<string, mixed>> $cards
     * @return list<array<string, mixed>>
     */
    private function enrichCardsWithNotePreview(array $cards, int $visitId, int $facilityId): array
    {
        $preview = null;
        $enriched = [];
        foreach ($cards as $card) {
            if (strcasecmp((string) ($card['formdir'] ?? ''), EncounterNoteService::NATIVE_FORMDIR) === 0) {
                $preview ??= $this->encounterNote->buildNotePreview($visitId, $facilityId);
                if (!empty($preview['native_enabled'])) {
                    $card['note_preview'] = $preview;
                }
            }
            $enriched[] = $card;
        }

        return $enriched;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function loadFormInstances(int $encounterId, int $pid): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT id, form_id, formdir, date, user
             FROM forms
             WHERE encounter = ? AND pid = ? AND deleted = 0
             ORDER BY date DESC',
            [$encounterId, $pid]
        ) ?: [];

        $formRowIds = array_map(static fn (array $row): int => (int) ($row['id'] ?? 0), $rows);
        $signedMap = $this->batchFormSignedMap($formRowIds);

        $instances = [];
        foreach ($rows as $row) {
            $formdir = strtolower(trim((string) ($row['formdir'] ?? '')));
            if ($formdir === '' || isset($instances[$formdir])) {
                continue;
            }
            $formsRowId = (int) ($row['id'] ?? 0);
            $instances[$formdir] = [
                'forms_row_id' => $formsRowId,
                'form_id' => (int) ($row['form_id'] ?? 0),
                'last_saved_at' => $this->formatFormDate($row['date'] ?? null),
                'last_saved_by' => trim((string) ($row['user'] ?? '')),
                'signed' => !empty($signedMap[$formsRowId]),
            ];
        }

        return $instances;
    }

    /**
     * @param array<int, int> $formIds
     * @return array<int, bool>
     */
    private function batchFormSignedMap(array $formIds): array
    {
        $formIds = array_values(array_unique(array_filter(
            array_map('intval', $formIds),
            static fn (int $id): bool => $id > 0
        )));

        if ($formIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($formIds), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT tid AS form_row_id FROM esign_signatures
             WHERE tid IN ($placeholders) AND `table` = 'forms' AND is_lock = 1",
            $formIds
        ) ?: [];

        $map = [];
        foreach ($rows as $row) {
            $map[(int) ($row['form_row_id'] ?? 0)] = true;
        }

        return $map;
    }

    /**
     * @param array<string, mixed> $patient
     */
    private function displayName(array $patient): string
    {
        $name = trim((string) ($patient['fname'] ?? '') . ' ' . (string) ($patient['lname'] ?? ''));

        return $name !== '' ? $name : 'Patient';
    }

    private function formatFormDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $ts = strtotime((string) $value);

        return $ts !== false ? date('Y-m-d H:i', $ts) : (string) $value;
    }

    /**
     * M17-F02 — encounter + per-required-form sign summary for This visit tab.
     *
     * @param array<string, mixed> $visit
     * @param list<array<string, mixed>> $cards
     * @return array<string, mixed>
     */
    private function buildSignOverview(array $visit, array $cards, int $facilityId, bool $encounterSigned): array
    {
        $docStatus = $this->docStatus->getStatusForVisit($visit, $facilityId);
        $started = 0;
        $signed = 0;
        $unsigned = 0;
        foreach ($cards as $card) {
            if (empty($card['started'])) {
                continue;
            }
            $started++;
            if (!empty($card['signed'])) {
                $signed++;
            } else {
                $unsigned++;
            }
        }

        return [
            'encounter_signed' => $encounterSigned,
            'started_count' => $started,
            'signed_count' => $signed,
            'unsigned_count' => $unsigned,
            'required_forms' => $docStatus['unsigned_required'] ?? [],
        ];
    }

    /**
     * M17-F02 — bundle-limited forms not yet started on this encounter.
     *
     * @return list<array<string, mixed>>
     */
    private function buildAddableForms(int $encounterId, int $pid, int $facilityId): array
    {
        $fullCatalog = $this->catalog->getCatalog(null, $facilityId);
        $instances = $this->loadFormInstances($encounterId, $pid);
        $allCards = $this->mergeCardsWithInstances($fullCatalog['cards'], $instances);

        return array_values(array_filter(
            $allCards,
            static fn (array $card): bool => empty($card['started'])
        ));
    }
}

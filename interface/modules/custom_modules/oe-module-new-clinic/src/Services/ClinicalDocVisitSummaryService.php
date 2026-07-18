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
    public function getVisitSummary(int $visitId, int $actorUserId, ?string $lens = null, int $encounterIdParam = 0): array
    {
        $this->access->assertHubAccess();
        if ($lens !== null && $lens !== '') {
            $this->access->assertLensAccess($lens);
        }

        $visit = $this->resolveVisitContext($visitId, $encounterIdParam);
        $visitId = $visitId > 0 ? $visitId : (int) ($visit['id'] ?? 0);
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
            $this->enrichCardsWithScreeningStatus(
                $this->enrichCardsWithNotePreview(
                    $this->mergeCardsWithInstances($catalog['cards'], $instances),
                    $visitId,
                    $facilityId
                ),
                $encounterId,
                $pid,
                $facilityId
            ),
            $facilityId
        );
        if ($lens === null || $lens === 'visit') {
            $cards = $this->appendUncataloguedInstanceCards($cards, $instances);
        }

        $encounterSigned = $this->signService->isVisitDocumentationSigned($visit, $facilityId);
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
                // Encounter-only mode: a stock/historical encounter with no queue row —
                // queue affordances (FSM actions, native note authoring) switch off.
                'encounter_only' => $visitId <= 0,
                'encounter_date' => (string) ($visit['encounter_date'] ?? ''),
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
        ];

        if ($lens === 'visit') {
            $payload['sign_overview'] = $visitId > 0
                ? $this->buildSignOverview($visit, $cards, $facilityId, $encounterSigned)
                : $this->buildSignOverviewFromCards($cards, $encounterSigned);
            // Reuse the form instances already loaded above instead of re-querying.
            $payload['addable_forms'] = $this->buildAddableForms($encounterId, $pid, $facilityId, $instances);
            if ($visitId <= 0) {
                // Encounter-only mode: don't offer queue-only native editors the
                // server would refuse (they open from the day's visit queue).
                $payload['addable_forms'] = array_values(array_filter(
                    $payload['addable_forms'],
                    fn (array $card): bool => !$this->catalog->isQueueOnlyFormdir(
                        (string) ($card['formdir'] ?? ''),
                        $facilityId
                    )
                ));
            }
        }

        return $payload;
    }

    /**
     * Resolve the documentation context. Live path: a `new_visit` id. Encounter path
     * (stock or historical encounters with no queue row): reuse the visit when one
     * exists for that encounter, else synthesize a visit-shaped array from
     * `form_encounter` after a facility-scope access check — id stays 0 so
     * queue-only affordances switch off downstream.
     *
     * @return array<string, mixed>
     */
    private function resolveVisitContext(int $visitId, int $encounterIdParam): array
    {
        if ($visitId > 0) {
            return $this->queueService->getVisitForActor($visitId);
        }

        if ($encounterIdParam <= 0) {
            throw new \InvalidArgumentException('visit_id or encounter_id is required', 400);
        }

        $row = QueryUtils::querySingleRow(
            'SELECT id FROM new_visit WHERE encounter = ? ORDER BY id DESC LIMIT 1',
            [$encounterIdParam]
        );
        if (!empty($row['id'])) {
            return $this->queueService->getVisitForActor((int) $row['id']);
        }

        $enc = QueryUtils::querySingleRow(
            'SELECT encounter, pid, facility_id, provider_id, date FROM form_encounter WHERE encounter = ? LIMIT 1',
            [$encounterIdParam]
        );
        if (!is_array($enc) || (int) ($enc['pid'] ?? 0) <= 0) {
            throw new \RuntimeException('Encounter not found', 404);
        }

        (new FacilityScopeService())->assertPatientAccessible((int) $enc['pid']);

        return [
            'id' => 0,
            'pid' => (int) $enc['pid'],
            'encounter' => $encounterIdParam,
            'facility_id' => (int) ($enc['facility_id'] ?? 0),
            'state' => '',
            'queue_number' => 0,
            'assigned_provider_id' => (int) ($enc['provider_id'] ?? 0),
            'service_profile' => 'full_opd',
            'encounter_date' => substr((string) ($enc['date'] ?? ''), 0, 10),
        ];
    }

    /**
     * Encounter-only sign overview — card counts without the queue-keyed
     * documentation-status service (which needs a live visit row).
     *
     * @param list<array<string, mixed>> $cards
     * @return array<string, mixed>
     */
    private function buildSignOverviewFromCards(array $cards, bool $encounterSigned): array
    {
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
            'required_forms' => [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getSignStatus(int $visitId, int $encounterIdParam = 0): array
    {
        $this->access->assertHubAccess();
        $visit = $this->resolveVisitContext($visitId, $encounterIdParam);
        $encounterId = (int) ($visit['encounter'] ?? 0);
        if ($encounterId <= 0) {
            throw new \RuntimeException('No encounter on visit', 409);
        }

        return [
            'encounter_signed' => $this->signService->isVisitDocumentationSigned($visit),
            'visit_id' => $visitId > 0 ? $visitId : (int) ($visit['id'] ?? 0),
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
    /**
     * Enrich native screening cards (PHQ-9 / GAD-7) with their saved score/status
     * from form_nc_screening — these are virtual cards with no `forms` row, so
     * mergeCardsWithInstances leaves them unstarted. Native screening is the
     * default (no flag). Instantiated at request time (not in the constructor) to
     * avoid eager service trees.
     *
     * @param array<int, array<string, mixed>> $cards
     * @return array<int, array<string, mixed>>
     */
    private function enrichCardsWithScreeningStatus(array $cards, int $encounterId, int $pid, int $facilityId): array
    {
        $statuses = (new ScreeningAssessmentService())->getEncounterStatuses($pid, $encounterId);
        if (empty($statuses)) {
            return $cards;
        }

        $catalog = new ScreeningInstrumentCatalog();
        foreach ($cards as &$card) {
            $formdir = strtolower((string) ($card['formdir'] ?? ''));
            if (!isset($statuses[$formdir])) {
                continue;
            }
            $status = $statuses[$formdir];
            $def = $catalog->getInstrument($formdir) ?? [];
            $label = '';
            foreach (($def['bands'] ?? []) as $band) {
                if ($status['total'] >= $band['min'] && $status['total'] <= $band['max']) {
                    $label = $band['label'];
                    break;
                }
            }
            $card['started'] = true;
            $card['last_saved_at'] = $status['last_saved_at'];
            $card['score_total'] = $status['total'];
            $card['score_max'] = (int) ($def['max_score'] ?? 0);
            $card['score_severity'] = $status['severity'];
            $card['score_label'] = $label;
            $card['screening_flags'] = $status['flags'];
        }
        unset($card);

        return $cards;
    }

    private function mergeCardsWithInstances(array $cards, array $instances): array
    {
        $merged = [];
        foreach ($cards as $card) {
            $formdir = (string) ($card['formdir'] ?? '');
            $instance = $instances[$formdir] ?? null;
            $all = is_array($instance['instances'] ?? null) ? $instance['instances'] : [];
            $merged[] = array_merge($card, [
                'started' => $instance !== null,
                'form_id' => $instance['form_id'] ?? null,
                'forms_row_id' => $instance['forms_row_id'] ?? null,
                'last_saved_at' => $instance['last_saved_at'] ?? null,
                'last_saved_by' => $instance['last_saved_by'] ?? null,
                'signed' => (bool) ($instance['signed'] ?? false),
                'instances' => count($all) > 1 ? $all : null,
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
        // Native note authoring is visit-keyed — no preview in encounter-only mode.
        if ($visitId <= 0) {
            return $cards;
        }

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
            if ($formdir === '') {
                continue;
            }
            $formsRowId = (int) ($row['id'] ?? 0);
            $entry = [
                'forms_row_id' => $formsRowId,
                'form_id' => (int) ($row['form_id'] ?? 0),
                'last_saved_at' => $this->formatFormDate($row['date'] ?? null),
                'last_saved_by' => trim((string) ($row['user'] ?? '')),
                'signed' => !empty($signedMap[$formsRowId]),
            ];
            if (!isset($instances[$formdir])) {
                // Rows are date DESC — the first entry per formdir is the latest and
                // keeps driving the card; every entry lands in 'instances' so repeated
                // forms (two vitals, two ROS…) stay reachable like on the stock screen.
                $instances[$formdir] = $entry;
                $instances[$formdir]['instances'] = [$entry];
            } else {
                $instances[$formdir]['instances'][] = $entry;
            }
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
        // Only unsigned_required is read below; skip the extra native-note preview build.
        $docStatus = $this->docStatus->getStatusForVisit($visit, $facilityId, false);
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
     * Stock-encounter parity: forms already on the encounter that the curated
     * catalog doesn't cover (long-tail registry / LBF forms, historical stock
     * entries) still show as cards on the Visit lens under "More note types".
     *
     * @param list<array<string, mixed>> $cards
     * @param array<string, array<string, mixed>> $instances
     * @return list<array<string, mixed>>
     */
    private function appendUncataloguedInstanceCards(array $cards, array $instances): array
    {
        $covered = [];
        foreach ($cards as $card) {
            $covered[strtolower((string) ($card['formdir'] ?? ''))] = true;
        }

        $names = $this->catalog->listBridgeableRegistryForms();
        foreach ($instances as $formdir => $instance) {
            $formdir = strtolower((string) $formdir);
            if (isset($covered[$formdir]) || !$this->catalog->isBridgeableFormdir($formdir)) {
                continue;
            }
            $all = is_array($instance['instances'] ?? null) ? $instance['instances'] : [];
            $cards[] = [
                'id' => 'other_' . $formdir,
                'lens' => 'visit',
                'formdir' => $formdir,
                'title' => $names[$formdir] ?? $formdir,
                'description' => 'Form on this encounter — opens the standard editor.',
                'kind' => 'stock',
                'more' => true,
                'started' => true,
                'form_id' => $instance['form_id'] ?? null,
                'forms_row_id' => $instance['forms_row_id'] ?? null,
                'last_saved_at' => $instance['last_saved_at'] ?? null,
                'last_saved_by' => $instance['last_saved_by'] ?? null,
                'signed' => (bool) ($instance['signed'] ?? false),
                'instances' => count($all) > 1 ? $all : null,
            ];
        }

        return $cards;
    }

    /**
     * M17-F02 — forms not yet started on this encounter: the curated bundle first,
     * then every other installed registry form (stock-encounter parity — the stock
     * Add menu offers the full registry; the long tail opens via the bridge).
     *
     * @param array<string, array<string, mixed>>|null $instances Reuse pre-loaded instances when available.
     * @return list<array<string, mixed>>
     */
    private function buildAddableForms(int $encounterId, int $pid, int $facilityId, ?array $instances = null): array
    {
        $fullCatalog = $this->catalog->getCatalog(null, $facilityId);
        $instances ??= $this->loadFormInstances($encounterId, $pid);
        $allCards = $this->mergeCardsWithInstances($fullCatalog['cards'], $instances);

        $covered = [];
        foreach ($allCards as $card) {
            $covered[strtolower((string) ($card['formdir'] ?? ''))] = true;
        }
        foreach ($this->catalog->listBridgeableRegistryForms() as $formdir => $name) {
            if (isset($covered[$formdir])) {
                continue;
            }
            $allCards[] = [
                'id' => 'reg_' . $formdir,
                'lens' => 'visit',
                'formdir' => $formdir,
                'title' => $name,
                'description' => 'Installed form — opens the standard editor.',
                'kind' => 'stock',
                'started' => isset($instances[$formdir]),
                'form_id' => $instances[$formdir]['form_id'] ?? null,
            ];
        }

        // Catalog cards repeat across lenses (e.g. procedure_order on Orders and the
        // bundle lens) — offer each formdir once.
        $seen = [];
        $deduped = [];
        foreach ($allCards as $card) {
            $formdir = strtolower((string) ($card['formdir'] ?? ''));
            if ($formdir !== '' && isset($seen[$formdir])) {
                continue;
            }
            $seen[$formdir] = true;
            $deduped[] = $card;
        }

        return array_values(array_filter(
            $deduped,
            static fn (array $card): bool => empty($card['started'])
        ));
    }
}

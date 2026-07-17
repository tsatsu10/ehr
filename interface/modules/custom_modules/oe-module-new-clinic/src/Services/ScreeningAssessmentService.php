<?php

/**
 * Native screening assessment editor — read/write service (PHQ-9 / GAD-7).
 *
 * Backs the native React screener drawer on the Clinical Documentation Screening
 * lens. Loads an instrument definition (from ScreeningInstrumentCatalog) plus any
 * saved answers for the visit, and saves answers to the module-owned
 * `form_nc_screening` table after re-scoring server-side (the client's score is
 * never trusted). Edit-in-place: one active row per (encounter, instrument).
 *
 * Storage is module-native (not FHIR — deliberate non-goal): the score surfaces on
 * New Clinic surfaces (hub card + chart), not the stock encounter summary. Access
 * is the clinical-doc write ACL plus the same active-clinical-state / provider
 * guard the native Clinical Instructions editor uses. Lazy getters only.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Services\FormService;

class ScreeningAssessmentService
{
    /** The module-owned encounter form directory that renders the score on the
     *  stock encounter summary (interface/forms/nc_screening/report.php). */
    private const FORMDIR = 'nc_screening';

    /** States in which a clinician may record a screener on a visit. */
    private const CLINICAL_STATES = [
        'awaiting_triage', 'in_triage', 'with_doctor',
        'ready_for_lab', 'in_lab', 'ready_for_pharmacy', 'in_pharmacy',
    ];

    public function __construct(
        private readonly ClinicalDocAccessService $access = new ClinicalDocAccessService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly ScreeningInstrumentCatalog $catalog = new ScreeningInstrumentCatalog(),
    ) {
    }

    /**
     * Bootstrap payload: instrument definition + any saved answers for the visit.
     *
     * @return array<string, mixed>
     */
    public function getAssessment(int $visitId, string $instrument, int $actorUserId): array
    {
        $this->access->assertWriteAccess();
        $instrument = strtolower(trim($instrument));

        $def = $this->catalog->getInstrument($instrument);
        if ($def === null) {
            throw new \InvalidArgumentException('Unknown screening instrument');
        }

        $visit = $this->resolveClinicalVisit($visitId, $actorUserId);
        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);

        $existing = $this->loadLatest($pid, $encounter, $instrument);

        return [
            'enabled' => true,
            'visit_id' => $visitId,
            'instrument' => $def,
            'answers' => $existing['answers'] ?? new \stdClass(),
            'saved' => $existing !== null,
            'locked' => $this->isSigned($encounter, $pid),
        ];
    }

    /**
     * Save (create or update) the encounter's screener.
     *
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function saveAssessment(array $body, int $actorUserId): array
    {
        $this->access->assertWriteAccess();

        $instrument = strtolower(trim((string) ($body['instrument'] ?? '')));
        if (!$this->catalog->isInstrument($instrument)) {
            throw new \InvalidArgumentException('Unknown screening instrument');
        }

        $visitId = (int) ($body['visit_id'] ?? 0);
        $visit = $this->resolveClinicalVisit($visitId, $actorUserId);
        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);
        if ($encounter <= 0) {
            throw new \InvalidArgumentException('Visit has no encounter yet');
        }
        // E-sign is compliance, never optional.
        if ($this->isSigned($encounter, $pid)) {
            throw new \RuntimeException('This screening is signed — unlock the encounter to amend it', 409);
        }

        $answers = $this->normaliseAnswers($body['answers'] ?? []);
        $result = $this->catalog->score($instrument, $answers);
        if (!$result['complete']) {
            throw new \InvalidArgumentException('Answer every question before saving');
        }

        $answersJson = json_encode($answers, JSON_THROW_ON_ERROR);
        $flags = implode(',', $result['flags']);

        $existing = $this->loadLatest($pid, $encounter, $instrument);
        $rowId = (int) ($existing['id'] ?? 0);

        if ($rowId > 0) {
            QueryUtils::sqlStatementThrowException(
                'UPDATE form_nc_screening
                 SET answers = ?, total_score = ?, severity = ?, flags = ?, date = NOW(), user = ?
                 WHERE id = ?',
                [$answersJson, $result['total'], $result['severity'], $flags, $_SESSION['authUser'] ?? '', $rowId]
            );
            QueryUtils::sqlStatementThrowException(
                "UPDATE forms SET date = NOW() WHERE form_id = ? AND encounter = ? AND pid = ? AND formdir = ?",
                [$rowId, $encounter, $pid, self::FORMDIR]
            );
        } else {
            $rowId = (int) QueryUtils::sqlInsert(
                'INSERT INTO form_nc_screening
                    (date, pid, encounter, user, authorized, activity, instrument, answers, total_score, severity, flags)
                 VALUES (NOW(), ?, ?, ?, 1, 1, ?, ?, ?, ?, ?)',
                [$pid, $encounter, $_SESSION['authUser'] ?? '', $instrument, $answersJson, $result['total'], $result['severity'], $flags]
            );
            // Register the encounter-form row so the score renders on the stock
            // encounter summary. Only on insert — edit-in-place keeps the same row.
            $title = strtoupper($instrument);
            (new FormService())->addForm($encounter, $title, $rowId, self::FORMDIR, $pid, '1');
        }

        return [
            'saved' => true,
            'id' => $rowId,
            'total' => $result['total'],
            'severity' => $result['severity'],
            'interpretation' => $result['interpretation'],
            'flags' => $result['flags'],
        ];
    }

    /**
     * Per-instrument latest status for card enrichment (hub screening lens).
     *
     * @return array<string, array{started: bool, total: int, severity: string, last_saved_at: ?string, flags: array<int, string>}>
     */
    public function getEncounterStatuses(int $pid, int $encounter): array
    {
        if ($encounter <= 0) {
            return [];
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT instrument, total_score, severity, flags, date
             FROM form_nc_screening
             WHERE encounter = ? AND pid = ? AND activity = 1
             ORDER BY date DESC",
            [$encounter, $pid]
        ) ?: [];

        $out = [];
        foreach ($rows as $row) {
            $instrument = (string) $row['instrument'];
            if (isset($out[$instrument])) {
                continue; // first (latest) wins
            }
            $out[$instrument] = [
                'started' => true,
                'total' => (int) $row['total_score'],
                'severity' => (string) $row['severity'],
                'last_saved_at' => $row['date'] ?? null,
                'flags' => array_values(array_filter(explode(',', (string) $row['flags']))),
            ];
        }

        return $out;
    }

    /**
     * Latest active screener row of this instrument on the encounter.
     *
     * @return array{id: int, answers: array<string, int>}|null
     */
    private function loadLatest(int $pid, int $encounter, string $instrument): ?array
    {
        if ($encounter <= 0) {
            return null;
        }

        $row = QueryUtils::fetchRecords(
            "SELECT id, answers
             FROM form_nc_screening
             WHERE encounter = ? AND pid = ? AND instrument = ? AND activity = 1
             ORDER BY date DESC
             LIMIT 1",
            [$encounter, $pid, $instrument]
        );

        if (empty($row[0])) {
            return null;
        }

        $answers = json_decode((string) ($row[0]['answers'] ?? '{}'), true);

        return [
            'id' => (int) $row[0]['id'],
            'answers' => is_array($answers) ? $answers : [],
        ];
    }

    /** Instantiated at call time (not in the constructor) — crash-pattern rule. */
    private function isSigned(int $encounter, int $pid): bool
    {
        if ($encounter <= 0) {
            return false;
        }

        return (new EncounterSignService())->isFormdirSignedOnEncounter($encounter, $pid, self::FORMDIR);
    }

    /**
     * @param mixed $raw
     * @return array<string, int>
     */
    private function normaliseAnswers($raw): array
    {
        if (!is_array($raw)) {
            throw new \InvalidArgumentException('answers must be an object');
        }

        $out = [];
        foreach ($raw as $key => $value) {
            $out[(string) $key] = (int) $value;
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveClinicalVisit(int $visitId, int $actorUserId): array
    {
        if ($visitId <= 0) {
            throw new \InvalidArgumentException('visit_id is required');
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        $state = (string) ($visit['state'] ?? '');
        if (!in_array($state, self::CLINICAL_STATES, true)) {
            throw new \InvalidArgumentException('Visit is not in an active clinical state');
        }
        if ($state === 'with_doctor' && (int) ($visit['assigned_provider_id'] ?? 0) !== $actorUserId) {
            throw new \InvalidArgumentException('Visit is assigned to another provider');
        }

        return $visit;
    }
}

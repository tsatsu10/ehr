<?php

/**
 * Front Desk unified patient search (M1a)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Modules\NewClinic\Support\Sanitize;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Dto\SearchResultDto;

class PatientSearchService
{
    private const SCORE_POOL = 25;

    public function __construct(
        private readonly PhoneNormalizer $phoneNormalizer = new PhoneNormalizer(),
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly AppointmentTodayService $appointmentToday = new AppointmentTodayService(),
        private readonly RecallDueService $recallDue = new RecallDueService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function normalizeQuery(string $q): string
    {
        // SCALE-4.1: length cap + control-char strip before the LIKE scans.
        return Sanitize::searchToken(preg_replace('/\s+/', ' ', $q) ?? '');
    }

    public function search(string $q, int $limit = 8, ?int $actorUserId = null): SearchResultDto
    {
        $started = microtime(true);
        $query = $this->normalizeQuery($q);

        if (strlen($query) < 2) {
            throw new \InvalidArgumentException('Query must be at least 2 characters');
        }

        $limit = max(1, min($limit, self::SCORE_POOL));
        $candidates = $this->fetchCandidates($query);
        $scored = [];

        foreach ($candidates as $row) {
            $score = $this->scoreRow($row, $query);
            if ($score > 0) {
                $row['match_score'] = $score;
                $scored[] = $row;
            }
        }

        usort($scored, function (array $a, array $b): int {
            if ($a['match_score'] !== $b['match_score']) {
                return $b['match_score'] <=> $a['match_score'];
            }
            $aDate = $a['last_visit_date'] ?? '';
            $bDate = $b['last_visit_date'] ?? '';
            if ($aDate !== $bDate) {
                return strcmp((string) $bDate, (string) $aDate);
            }
            $nameCmp = strcmp((string) ($a['lname'] ?? ''), (string) ($b['lname'] ?? ''));
            if ($nameCmp !== 0) {
                return $nameCmp;
            }
            $fnameCmp = strcmp((string) ($a['fname'] ?? ''), (string) ($b['fname'] ?? ''));
            if ($fnameCmp !== 0) {
                return $fnameCmp;
            }

            return ((int) ($a['pid'] ?? 0)) <=> ((int) ($b['pid'] ?? 0));
        });

        $pool = array_slice($scored, 0, self::SCORE_POOL);
        $topRows = array_slice($pool, 0, $limit);

        // SCALE-1.5 — batch the per-row lookups (active visit + appointment + recall
        // chips) into one query each, keyed by pid, instead of 3–4 queries per row.
        $pids = array_map(static fn (array $row) => (int) $row['pid'], $topRows);
        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $activeVisits = $this->batchActiveVisits($pids);
        $appointmentChips = $this->appointmentToday->chipsForPatients($pids, $facilityId);
        $recallChips = $this->recallDue->chipsForPatients($pids, $facilityId);

        $patients = array_map(
            fn (array $row) => $this->mapResultRow($row, $activeVisits, $appointmentChips, $recallChips),
            $topRows
        );

        $elapsed = (int) round((microtime(true) - $started) * 1000);

        return new SearchResultDto($patients, count($pool), $elapsed);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fetchCandidates(string $query): array
    {
        $filter = $this->facilityScope->getPatientFilterClause('pd');
        $bind = [];
        $conditions = [];

        $tokens = array_values(array_filter(
            explode(' ', $query),
            fn (string $t) => strlen($t) >= 2
        ));

        if (!empty($tokens)) {
            foreach ($tokens as $token) {
                $tokenLike = '%' . $token . '%';
                $conditions[] = '(pd.lname LIKE ? OR pd.fname LIKE ? OR pd.mname LIKE ?)';
                array_push($bind, $tokenLike, $tokenLike, $tokenLike);
                $conditions[] = 'SOUNDEX(pd.lname) = SOUNDEX(?)';
                $bind[] = $token;
            }
        } else {
            $like = '%' . $query . '%';
            $conditions[] = '(pd.lname LIKE ? OR pd.fname LIKE ? OR pd.mname LIKE ?)';
            array_push($bind, $like, $like, $like);
        }

        $where = '(' . implode(' OR ', $conditions) . ')' . $filter['sql'];
        $bind = array_merge($bind, $filter['bind']);

        $sql = "SELECT pd.pid, pd.fname, pd.mname, pd.lname, pd.sex, pd.DOB, pd.pubpid,
                       pd.phone_cell, pd.phone_normalized,
                       npc.completion_score, npm.dob_estimated,
                       (SELECT MAX(fe.date) FROM form_encounter fe WHERE fe.pid = pd.pid) AS last_visit_date
                FROM patient_data pd
                LEFT JOIN new_patient_completion npc ON npc.pid = pd.pid
                LEFT JOIN new_patient_meta npm ON npm.pid = pd.pid
                WHERE {$where}
                LIMIT 50";

        return QueryUtils::fetchRecords($sql, $bind) ?: [];
    }

    private function scoreRow(array $row, string $query): int
    {
        $score = 0;

        $tokens = array_values(array_filter(explode(' ', $this->normalizeQuery($query)), fn ($t) => strlen($t) >= 2));
        $fname = strtolower((string) ($row['fname'] ?? ''));
        $lname = strtolower((string) ($row['lname'] ?? ''));

        foreach ($tokens as $token) {
            $tokenLower = strtolower($token);
            if (str_starts_with($lname, $tokenLower)) {
                $score += 35;
            }
            if (str_starts_with($fname, $tokenLower)) {
                $score += 30;
            }
            if ($this->soundexMatch($lname, $tokenLower)) {
                $score += 10;
            }
            if (!empty($tokens[0]) && $this->soundexMatch($lname, strtolower($tokens[0])) && str_starts_with($fname, strtolower($tokens[0]))) {
                $score += 40;
            }
        }

        if (!empty($tokens) && $this->containsAllTokens($lname . ' ' . $fname, $tokens)) {
            $score += 20;
        }

        return $score;
    }

    /**
     * @param list<string> $tokens
     */
    private function containsAllTokens(string $haystack, array $tokens): bool
    {
        $haystack = strtolower($haystack);
        foreach ($tokens as $token) {
            if (!str_contains($haystack, strtolower($token))) {
                return false;
            }
        }

        return true;
    }

    private function soundexMatch(string $left, string $right): bool
    {
        if ($left === '' || $right === '') {
            return false;
        }

        return soundex($left) === soundex($right);
    }

    /**
     * Latest active visit per pid, in one query (SCALE-1.5). Mirrors the old
     * per-row query: newest (highest id) active visit for each patient.
     *
     * @param list<int> $pids
     * @return array<int, array<string, mixed>> pid => visit row
     */
    private function batchActiveVisits(array $pids): array
    {
        $pids = array_values(array_unique(array_filter($pids, static fn (int $p) => $p > 0)));
        if (empty($pids)) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($pids), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT v.pid, v.id AS visit_id, v.state, v.queue_number, v.chief_complaint,
                    vt.label AS visit_type_label
             FROM new_visit v
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             WHERE v.pid IN ($placeholders)
             AND v.state NOT IN ('completed', 'closed_unpaid', 'cancelled')
             ORDER BY v.id DESC",
            $pids
        ) ?: [];

        $map = [];
        foreach ($rows as $row) {
            $pid = (int) ($row['pid'] ?? 0);
            if (!isset($map[$pid])) { // first per pid = highest id = latest, matching the old LIMIT 1
                $map[$pid] = $row;
            }
        }

        return $map;
    }

    /**
     * @param array<string, mixed> $row
     * @param array<int, array<string, mixed>> $activeVisits pid => visit row
     * @param array<int, array<string, mixed>|null> $appointmentChips pid => chip
     * @param array<int, array<string, mixed>|null> $recallChips pid => chip
     * @return array<string, mixed>
     */
    private function mapResultRow(array $row, array $activeVisits, array $appointmentChips, array $recallChips): array
    {
        $pid = (int) $row['pid'];
        $phoneNorm = (string) ($row['phone_normalized'] ?? '');
        if ($phoneNorm === '' && !empty($row['phone_cell'])) {
            $phoneNorm = $this->phoneNormalizer->normalize((string) $row['phone_cell']);
        }

        $completionScore = (int) ($row['completion_score'] ?? 0);
        $activeVisit = $activeVisits[$pid] ?? null;
        $appointmentChip = $appointmentChips[$pid] ?? null;
        $recallChip = $recallChips[$pid] ?? null;

        $displayName = trim(($row['lname'] ?? '') . ', ' . ($row['fname'] ?? ''));
        $displayName = trim($displayName, ', ');

        return [
            'pid' => $pid,
            'display_name' => $displayName,
            'sex' => $row['sex'] ?? '',
            'age_years' => $this->ageYears($row['DOB'] ?? null),
            'dob_estimated' => !empty($row['dob_estimated']),
            'phone_masked' => $this->phoneNormalizer->mask($phoneNorm),
            'pubpid' => $row['pubpid'] ?? '',
            'completion_score' => $completionScore,
            'completion_status' => $completionScore >= 70 ? 'complete' : 'incomplete',
            'last_visit_date' => $row['last_visit_date'] ?? null,
            'last_visit_label' => $this->formatVisitDate($row['last_visit_date'] ?? null),
            'match_score' => (int) ($row['match_score'] ?? 0),
            'active_visit' => empty($activeVisit['visit_id']) ? null : [
                'visit_id' => (int) $activeVisit['visit_id'],
                'state' => $activeVisit['state'],
                'queue_number' => (int) $activeVisit['queue_number'],
                'visit_type_label' => $activeVisit['visit_type_label'] ?? '',
                'chief_complaint' => $activeVisit['chief_complaint'] !== ''
                    ? ($activeVisit['chief_complaint'] ?? null)
                    : null,
            ],
            'chips' => [
                'appointment_today' => $appointmentChip,
                'recall_due' => $recallChip,
            ],
        ];
    }

    private function ageYears(?string $dob): ?int
    {
        if (empty($dob) || $dob === '0000-00-00') {
            return null;
        }

        try {
            $birth = new \DateTime($dob);
            $now = new \DateTime('today');

            return (int) $birth->diff($now)->y;
        } catch (\Exception) {
            return null;
        }
    }

    private function formatVisitDate(?string $date): ?string
    {
        if (empty($date) || $date === '0000-00-00') {
            return null;
        }

        try {
            return (new \DateTime($date))->format('j M');
        } catch (\Exception) {
            return null;
        }
    }
}

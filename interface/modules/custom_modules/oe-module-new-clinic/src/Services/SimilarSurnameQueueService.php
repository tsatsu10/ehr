<?php

/**
 * Similar surname collision chips on today's queue (M0-F35 / V1.1-OPS)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class SimilarSurnameQueueService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    /**
     * @param list<array<string, mixed>> $visits
     * @return list<array<string, mixed>>
     */
    public function annotateVisits(array $visits, int $facilityId): array
    {
        if (!$this->isEnabled($facilityId) || $visits === []) {
            return $visits;
        }

        $counts = $this->normalizedSurnameCounts($visits);

        return array_map(
            fn (array $visit) => $this->applyFlag($visit, $counts),
            $visits
        );
    }

    /**
     * @param array<string, mixed> $board
     * @return array<string, mixed>
     */
    public function annotateBoard(array $board, int $facilityId): array
    {
        if (!$this->isEnabled($facilityId)) {
            return $board;
        }

        $columns = $board['columns'] ?? null;
        if (!is_array($columns) || $columns === []) {
            return $board;
        }

        $all = [];
        foreach ($columns as $cards) {
            if (is_array($cards)) {
                $all = array_merge($all, $cards);
            }
        }

        $counts = $this->normalizedSurnameCounts($all);
        foreach ($columns as $key => $cards) {
            if (!is_array($cards)) {
                continue;
            }
            $board['columns'][$key] = array_map(
                fn (array $visit) => $this->applyFlag($visit, $counts),
                $cards
            );
        }

        return $board;
    }

    public function normalizeSurname(string $lastName): string
    {
        $trimmed = trim($lastName);
        if ($trimmed === '') {
            return '';
        }

        $collapsed = preg_replace('/\s+/u', '', $trimmed);
        if (!is_string($collapsed) || $collapsed === '') {
            return '';
        }

        return mb_strtolower($collapsed, 'UTF-8');
    }

    private function isEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_similar_surname_queue_warning', 0, $facilityId) === 1;
    }

    /**
     * @param list<array<string, mixed>> $visits
     * @return array<string, int>
     */
    private function normalizedSurnameCounts(array $visits): array
    {
        $counts = [];
        foreach ($visits as $visit) {
            $key = $this->normalizeSurname((string) ($visit['lname'] ?? ''));
            if ($key === '') {
                continue;
            }
            $counts[$key] = ($counts[$key] ?? 0) + 1;
        }

        return $counts;
    }

    /**
     * @param array<string, int> $counts
     * @param array<string, mixed> $visit
     * @return array<string, mixed>
     */
    private function applyFlag(array $visit, array $counts): array
    {
        $key = $this->normalizeSurname((string) ($visit['lname'] ?? ''));
        $visit['similar_surname_today'] = $key !== '' && ($counts[$key] ?? 0) > 1;

        return $visit;
    }
}

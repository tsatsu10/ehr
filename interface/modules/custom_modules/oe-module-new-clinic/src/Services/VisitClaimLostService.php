<?php

/**
 * Passive queue poll — claim_lost annotations (M0-F36 / G12)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Support\VisitTransitionConflictResolver;

class VisitClaimLostService
{
    public function __construct(
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VisitRowEnricher $rowEnricher = new VisitRowEnricher(),
    ) {
    }

    /**
     * @param array<string, mixed> $queuePayload
     * @param list<array{visit_id?: int, from_state?: string}> $watchList
     *
     * @return array<string, mixed>
     */
    public function enrichQueueResponse(array $queuePayload, array $watchList, int $actorUserId): array
    {
        $cards = [];
        foreach ($watchList as $item) {
            if (!is_array($item)) {
                continue;
            }
            $visitId = (int) ($item['visit_id'] ?? 0);
            $fromState = trim((string) ($item['from_state'] ?? ''));
            if ($visitId <= 0 || $fromState === '') {
                continue;
            }

            try {
                $visit = $this->queueService->getVisitForActor($visitId);
            } catch (\InvalidArgumentException) {
                continue;
            }

            if (!$this->isClaimLost($visit, $fromState, $actorUserId)) {
                continue;
            }

            $cards[] = $this->buildClaimLostCard($visit, $fromState);
        }

        $queuePayload['claim_lost_cards'] = $cards;

        return $queuePayload;
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function isClaimLost(array $visit, string $fromState, int $actorUserId): bool
    {
        $state = (string) ($visit['state'] ?? '');
        if ($state === $fromState) {
            return false;
        }

        $assigned = (int) ($visit['assigned_provider_id'] ?? 0);

        if (isset(VisitTransitionConflictResolver::CLAIM_HELD_STATES[$state])) {
            $meta = VisitTransitionConflictResolver::CLAIM_HELD_STATES[$state];
            if ($meta['from'] === $fromState) {
                if ($assigned === $actorUserId) {
                    return false;
                }

                return $assigned > 0 || $state !== $fromState;
            }
        }

        return $state !== $fromState;
    }

    /**
     * @param array<string, mixed> $visit
     *
     * @return array<string, mixed>
     */
    private function buildClaimLostCard(array $visit, string $fromState): array
    {
        $state = (string) ($visit['state'] ?? '');
        $visitId = (int) ($visit['id'] ?? 0);
        $meta = VisitTransitionConflictResolver::claimMetaForState($state);
        $roleLabel = $meta['role'] ?? 'Staff';
        $taker = $this->lookupClaimActor($visitId, $state, (int) ($visit['assigned_provider_id'] ?? 0));

        $row = QueryUtils::querySingleRow(
            "SELECT pd.fname, pd.lname, pd.pubpid
             FROM patient_data pd
             WHERE pd.pid = ?",
            [(int) ($visit['pid'] ?? 0)]
        );

        $enriched = $this->rowEnricher->enrichVisitRow(array_merge($visit, $row ?: []));

        $enriched['claim_lost'] = true;
        $enriched['claim_lost_from_state'] = $fromState;
        $enriched['claim_lost_by'] = [
            'user_id' => $taker['user_id'],
            'display_name' => $taker['display_name'],
            'role_label' => $roleLabel,
        ];
        $enriched['claim_lost_at'] = $this->lookupClaimTimestamp($visitId, $state)
            ?? (string) ($visit['updated_at'] ?? date('c'));

        return $enriched;
    }

    /**
     * @return array{user_id: int, display_name: string}
     */
    private function lookupClaimActor(int $visitId, string $toState, int $assignedProviderId): array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT l.actor_user_id, u.fname, u.lname
             FROM new_visit_state_log l
             LEFT JOIN users u ON u.id = l.actor_user_id
             WHERE l.visit_id = ? AND l.to_state = ?
             ORDER BY l.id DESC
             LIMIT 1",
            [$visitId, $toState]
        );

        if (!empty($row)) {
            $name = trim((string) ($row['fname'] ?? '') . ' ' . (string) ($row['lname'] ?? ''));
            if ($name !== '') {
                return [
                    'user_id' => (int) ($row['actor_user_id'] ?? 0),
                    'display_name' => $name,
                ];
            }
        }

        if ($assignedProviderId > 0) {
            $provider = QueryUtils::querySingleRow(
                "SELECT fname, lname FROM users WHERE id = ?",
                [$assignedProviderId]
            );
            if (!empty($provider)) {
                $name = trim((string) ($provider['fname'] ?? '') . ' ' . (string) ($provider['lname'] ?? ''));
                if ($name !== '') {
                    return [
                        'user_id' => $assignedProviderId,
                        'display_name' => $name,
                    ];
                }
            }
        }

        return ['user_id' => 0, 'display_name' => 'Another user'];
    }

    private function lookupClaimTimestamp(int $visitId, string $toState): ?string
    {
        $row = QueryUtils::querySingleRow(
            "SELECT created_at FROM new_visit_state_log
             WHERE visit_id = ? AND to_state = ?
             ORDER BY id DESC LIMIT 1",
            [$visitId, $toState]
        );

        if (empty($row['created_at'])) {
            return null;
        }

        return (string) $row['created_at'];
    }
}

<?php

/**
 * Pure classification for optimistic visit transition conflicts (G12 / §16.1.1).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Support;

class VisitTransitionConflictResolver
{
    public const OUTCOME_CLAIM_LOSS = 'claim_loss';

    public const OUTCOME_STALE_VISIT = 'stale_visit';

    /** @var array<string, array{from: string, kind: string, role: string}> */
    public const CLAIM_HELD_STATES = [
        'in_triage' => ['from' => 'waiting', 'kind' => 'start_triage', 'role' => 'Nurse'],
        'with_doctor' => ['from' => 'ready_for_doctor', 'kind' => 'take_patient', 'role' => 'Doctor'],
        'in_lab' => ['from' => 'ready_for_lab', 'kind' => 'take_lab', 'role' => 'Lab'],
        'in_pharmacy' => ['from' => 'ready_for_pharmacy', 'kind' => 'take_pharmacy', 'role' => 'Pharmacy'],
    ];

    /**
     * @return self::OUTCOME_*|null null when the update failure is not a recognized conflict
     */
    public static function classify(
        string $fromState,
        string $intendedNewState,
        string $currentState,
        int $expectedVersion,
        int $currentVersion
    ): ?string {
        if (
            isset(self::CLAIM_HELD_STATES[$currentState])
            && self::CLAIM_HELD_STATES[$currentState]['from'] === $fromState
            && $currentState === $intendedNewState
        ) {
            return self::OUTCOME_CLAIM_LOSS;
        }

        if ($currentState === $fromState && $currentVersion !== $expectedVersion) {
            return self::OUTCOME_STALE_VISIT;
        }

        if ($currentState !== $fromState) {
            return self::OUTCOME_STALE_VISIT;
        }

        return self::OUTCOME_STALE_VISIT;
    }

    /**
     * @return array{from: string, kind: string, role: string}|null
     */
    public static function claimMetaForState(string $currentState): ?array
    {
        return self::CLAIM_HELD_STATES[$currentState] ?? null;
    }
}

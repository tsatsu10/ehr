<?php

/**
 * Visit queue FSM constants and transition rules
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class VisitFsm
{
    public const TERMINAL_STATES = [
        'completed',
        'closed_unpaid',
        'cancelled',
    ];

    /** @var array<int, string> States that may reverse to with_doctor (§6.4a) */
    public const REOPEN_SOURCE_STATES = [
        'ready_for_lab',
        'ready_for_pharmacy',
        'ready_for_payment',
        'lab_complete',
        'pharmacy_complete',
    ];

    private const TRANSITIONS = [
        'waiting' => ['in_triage', 'ready_for_doctor', 'cancelled'],
        'in_triage' => ['ready_for_doctor', 'cancelled'],
        'ready_for_doctor' => ['with_doctor', 'cancelled'],
        'with_doctor' => ['ready_for_lab', 'ready_for_pharmacy', 'ready_for_payment', 'cancelled'],
        'ready_for_lab' => ['in_lab', 'ready_for_payment', 'cancelled'],
        'in_lab' => ['lab_complete', 'ready_for_payment', 'cancelled'],
        'lab_complete' => ['ready_for_pharmacy', 'ready_for_payment'],
        'ready_for_pharmacy' => ['in_pharmacy', 'ready_for_payment', 'cancelled'],
        'in_pharmacy' => ['pharmacy_complete', 'ready_for_payment', 'cancelled'],
        'pharmacy_complete' => ['ready_for_payment'],
        'ready_for_payment' => ['completed', 'closed_unpaid', 'cancelled'],
    ];

    public static function canTransition(string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    /** @var array<int, string> Valid reverse-transition targets from REOPEN_SOURCE_STATES */
    private const REOPEN_TARGETS = ['with_doctor', 'ready_for_doctor'];

    public static function canReverseTransition(string $from, string $to): bool
    {
        return in_array($to, self::REOPEN_TARGETS, true)
            && in_array($from, self::REOPEN_SOURCE_STATES, true);
    }

    public static function isTerminal(string $state): bool
    {
        return in_array($state, self::TERMINAL_STATES, true);
    }
}

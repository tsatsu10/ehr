<?php

/**
 * Unit tests for New Clinic visit FSM
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\VisitFsm;
use PHPUnit\Framework\TestCase;

class VisitFsmTest extends TestCase
{
    public function testWaitingCanStartTriageOrSkipToDoctor(): void
    {
        $this->assertTrue(VisitFsm::canTransition('waiting', 'in_triage'));
        $this->assertTrue(VisitFsm::canTransition('waiting', 'ready_for_doctor'));
        $this->assertTrue(VisitFsm::canTransition('waiting', 'cancelled'));
    }

    public function testInTriageCanSendToDoctor(): void
    {
        $this->assertTrue(VisitFsm::canTransition('in_triage', 'ready_for_doctor'));
        $this->assertFalse(VisitFsm::canTransition('in_triage', 'with_doctor'));
    }

    public function testTerminalStatesAreTerminal(): void
    {
        foreach (VisitFsm::TERMINAL_STATES as $state) {
            $this->assertTrue(VisitFsm::isTerminal($state));
        }

        $this->assertFalse(VisitFsm::isTerminal('waiting'));
    }

    public function testTriageHappyPathTransitions(): void
    {
        $this->assertTrue(VisitFsm::canTransition('waiting', 'in_triage'));
        $this->assertTrue(VisitFsm::canTransition('in_triage', 'ready_for_doctor'));
    }

    public function testInvalidTransitionRejected(): void
    {
        $this->assertFalse(VisitFsm::canTransition('completed', 'waiting'));
        $this->assertFalse(VisitFsm::canTransition('ready_for_doctor', 'waiting'));
    }

    public function testReverseTransitionReopensConsultFromPayment(): void
    {
        $this->assertTrue(VisitFsm::canReverseTransition('ready_for_payment', 'with_doctor'));
        $this->assertTrue(VisitFsm::canReverseTransition('ready_for_lab', 'with_doctor'));
        $this->assertTrue(VisitFsm::canReverseTransition('lab_complete', 'with_doctor'));
    }

    public function testReverseTransitionBlockedFromTerminalStates(): void
    {
        $this->assertFalse(VisitFsm::canReverseTransition('completed', 'with_doctor'));
        $this->assertFalse(VisitFsm::canReverseTransition('cancelled', 'with_doctor'));
        $this->assertFalse(VisitFsm::canReverseTransition('with_doctor', 'ready_for_payment'));
    }
}

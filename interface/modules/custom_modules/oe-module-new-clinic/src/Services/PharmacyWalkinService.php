<?php

/**
 * M9-F07–F12 — pharmacy walk-in triage outcomes (V1.1-ANC)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Modules\NewClinic\Exceptions\AllergiesUndocumentedException;

class PharmacyWalkinService
{
    /** @var array<int, string> */
    public const DISPENSE_OUTCOMES = ['otc_dispensed', 'external_rx_dispensed'];

    /** @var array<int, string> */
    public const NON_DISPENSE_OUTCOMES = [
        'rx_required_refer_to_opd',
        'rx_required_no_doctor_available',
        'rx_required_patient_declined',
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly EncounterSignService $signService = new EncounterSignService(),
        private readonly DoctorRosterService $roster = new DoctorRosterService(),
        private readonly AllergyGateService $allergyGate = new AllergyGateService(),
        private readonly VisitRowEnricher $rowEnricher = new VisitRowEnricher(),
        private readonly ExternalRxValidationService $externalRx = new ExternalRxValidationService(),
    ) {
    }

    public function isWalkinVisit(array $visit): bool
    {
        return (string) ($visit['service_profile'] ?? '') === 'pharmacy_walkin';
    }

    public function isAncillaryEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_ancillary_services', 0, $facilityId) === 1;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function triagePayload(array $visit, int $facilityId, int $pid): ?array
    {
        if (!$this->isWalkinVisit($visit) || !$this->isAncillaryEnabled($facilityId)) {
            return null;
        }

        $doctorAvailable = $this->isDoctorAvailable($facilityId);
        $encounterId = (int) ($visit['encounter'] ?? 0);

        return [
            'enabled' => true,
            'doctor_available' => $doctorAvailable,
            'roster_enabled' => $this->roster->isEnabled($facilityId),
            'allergies_undocumented' => !$this->allergyGate->isDocumented($pid),
            'dispense_outcomes' => self::DISPENSE_OUTCOMES,
            'non_dispense_outcomes' => self::NON_DISPENSE_OUTCOMES,
            'can_dispense' => $this->canWalkinDispense(),
            'can_refer_to_opd' => $doctorAvailable && $this->canReferToOpd(),
            'can_close_without_dispense' => $this->canReferToOpd(),
            'can_record_no_doctor' => !$doctorAvailable && $this->roster->isEnabled($facilityId),
            'external_rx' => $this->externalRx->deskStatus($pid, $encounterId, $facilityId, $visit),
        ];
    }

    public function assertDispenseOutcome(string $outcome): void
    {
        if (!in_array($outcome, self::DISPENSE_OUTCOMES, true)) {
            throw new \InvalidArgumentException('Invalid dispense outcome for pharmacy walk-in');
        }
    }

    public function assertNonDispenseOutcome(string $outcome): void
    {
        if (!in_array($outcome, self::NON_DISPENSE_OUTCOMES, true)) {
            throw new \InvalidArgumentException('Invalid non-dispense outcome for pharmacy walk-in');
        }
    }

    public function assertDoctorAvailabilityForOutcome(string $outcome, int $facilityId): void
    {
        $available = $this->isDoctorAvailable($facilityId);
        if ($outcome === 'rx_required_refer_to_opd' && !$available) {
            throw new \InvalidArgumentException('No doctor on duty — use no-doctor available outcome instead');
        }
        if ($outcome === 'rx_required_no_doctor_available' && $available) {
            throw new \InvalidArgumentException('A doctor is on duty — refer patient to OPD instead');
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function closeWithoutDispense(
        int $visitId,
        string $outcome,
        int $actorUserId,
        int $expectedVersion,
        ?string $esignOverrideReason = null,
    ): array {
        $this->assertNonDispenseOutcome($outcome);
        if (!$this->canReferToOpd()) {
            throw new \RuntimeException('Forbidden', 403);
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        if (!$this->isWalkinVisit($visit)) {
            throw new \InvalidArgumentException('Visit is not a pharmacy walk-in');
        }
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        if (!$this->isAncillaryEnabled($facilityId)) {
            throw new \RuntimeException('Ancillary services are not enabled', 403);
        }

        $this->assertDoctorAvailabilityForOutcome($outcome, $facilityId);
        $this->assertPharmacyQueueState($visit);

        $this->signService->assertProfileSigned($visitId, $esignOverrideReason);
        $this->queueService->setPharmacyOutcome($visitId, $outcome);

        $terminalKey = $outcome === 'rx_required_patient_declined'
            ? 'pharmacy_declined_terminal_state'
            : 'pharmacy_refer_to_opd_terminal_state';
        $terminalMode = $this->resolveTerminalMode($terminalKey, $facilityId);
        $updated = $this->finalizeTerminal(
            $visit,
            $actorUserId,
            $expectedVersion,
            $terminalMode,
            'pharmacy_walkin:' . $outcome
        );

        $this->auditOutcome($visitId, $actorUserId, $outcome, null);

        return [
            'visit' => $this->rowEnricher->enrichVisitRow($updated),
            'pharmacy_outcome' => $outcome,
            'terminal_state' => (string) ($updated['state'] ?? ''),
        ];
    }

    public function assertDispenseAllowed(int $pid, string $outcome): void
    {
        if (!$this->canWalkinDispense()) {
            throw new \RuntimeException('Forbidden', 403);
        }
        $this->assertDispenseOutcome($outcome);
        try {
            $this->allergyGate->assertDocumented($pid);
        } catch (AllergiesUndocumentedException $e) {
            throw $e;
        }
    }

    public function persistDispenseOutcome(int $visitId, string $outcome, int $actorUserId): void
    {
        $this->assertDispenseOutcome($outcome);
        $this->queueService->setPharmacyOutcome($visitId, $outcome);
        $this->auditOutcome($visitId, $actorUserId, $outcome, null);
    }

    public function isDoctorAvailable(int $facilityId): bool
    {
        if (!$this->roster->isEnabled($facilityId)) {
            return true;
        }

        foreach ($this->roster->listDoctors($facilityId, (new ClinicDateService())->today()) as $doctor) {
            if (!empty($doctor['taking_patients'])) {
                return true;
            }
        }

        return false;
    }

    private function canWalkinDispense(): bool
    {
        return AclMain::aclCheckCore('new_clinic', 'new_pharmacy_walkin_dispense')
            || AclMain::aclCheckCore('new_clinic', 'new_pharmacy_lead')
            || AclMain::aclCheckCore('new_clinic', 'new_admin');
    }

    private function canReferToOpd(): bool
    {
        return AclMain::aclCheckCore('new_clinic', 'new_pharmacy_refer_to_opd')
            || AclMain::aclCheckCore('new_clinic', 'new_pharmacy_lead')
            || AclMain::aclCheckCore('new_clinic', 'new_admin');
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function assertPharmacyQueueState(array $visit): void
    {
        if (!in_array((string) ($visit['state'] ?? ''), ['ready_for_pharmacy', 'in_pharmacy'], true)) {
            throw new \InvalidArgumentException('Visit is not on the pharmacy queue');
        }
    }

    private function resolveTerminalMode(string $configKey, int $facilityId): string
    {
        $mode = (string) ($this->config->get($configKey, 'cancelled', $facilityId) ?? 'cancelled');
        if (!in_array($mode, ['cancelled', 'closed_no_charge'], true)) {
            return 'cancelled';
        }

        return $mode;
    }

    /**
     * @param array<string, mixed> $visit
     * @return array<string, mixed>
     */
    private function finalizeTerminal(
        array $visit,
        int $actorUserId,
        int $expectedVersion,
        string $terminalMode,
        string $logReason,
    ): array {
        $visitId = (int) ($visit['id'] ?? 0);
        $state = (string) ($visit['state'] ?? '');
        $version = $expectedVersion;

        if ($terminalMode === 'cancelled') {
            return $this->queueService->transition($visitId, 'cancelled', $actorUserId, $version, $logReason);
        }

        if ($state === 'in_pharmacy') {
            $visit = $this->queueService->transition($visitId, 'ready_for_payment', $actorUserId, $version, $logReason);
            $version = (int) ($visit['row_version'] ?? 0);
        } elseif ($state === 'ready_for_pharmacy') {
            $visit = $this->queueService->transition($visitId, 'ready_for_payment', $actorUserId, $version, $logReason);
            $version = (int) ($visit['row_version'] ?? 0);
        }

        $visit = $this->queueService->transition($visitId, 'completed', $actorUserId, $version, $logReason);
        sqlStatement(
            "UPDATE new_visit SET closed_no_charge = 1, completed_at = NOW() WHERE id = ?",
            [$visitId]
        );

        return $this->queueService->getVisitById($visitId) ?? $visit;
    }

    private function auditOutcome(int $visitId, int $actorUserId, string $outcome, ?int $referredToVisitId): void
    {
        $payload = 'visit_id=' . $visitId . ' outcome=' . $outcome;
        if ($referredToVisitId !== null && $referredToVisitId > 0) {
            $payload .= ' referred_to_visit_id=' . $referredToVisitId;
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy_outcome',
            $actorUserId,
            1,
            $payload
        );
    }
}

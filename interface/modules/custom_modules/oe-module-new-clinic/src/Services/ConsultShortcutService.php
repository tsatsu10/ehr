<?php

/**
 * Doctor Desk consult shortcut preflight (M4-F18–F20)
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
use OpenEMR\Modules\NewClinic\Exceptions\EncounterSessionMismatchException;

class ConsultShortcutService
{
    private const ALLOWED_SHORTCUTS = ['encounter', 'encounter_hub', 'lab', 'rx', 'chart'];

    public function __construct(
        private readonly EncounterSessionService $encounterSession = new EncounterSessionService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly ProcedureOrderDeepLinkService $procedureOrderLinks = new ProcedureOrderDeepLinkService(),
        private readonly EncounterIdentityStripService $identityStrip = new EncounterIdentityStripService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly PatientCompletionService $completionService = new PatientCompletionService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly EncounterNoteService $encounterNote = new EncounterNoteService(),
    ) {
    }

    /**
     * @return array{redirect_url: string, shortcut: string}
     */
    public function preflight(
        int $visitId,
        string $shortcut,
        int $actorUserId,
        ?string $rxAllergyOverrideReason = null,
    ): array
    {
        $shortcut = strtolower(trim($shortcut));
        if (!in_array($shortcut, self::ALLOWED_SHORTCUTS, true)) {
            throw new \InvalidArgumentException('Unknown shortcut');
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'with_doctor') {
            throw new \InvalidArgumentException('Visit is not in active consult');
        }

        if ((int) ($visit['assigned_provider_id'] ?? 0) !== $actorUserId) {
            throw new \InvalidArgumentException('Visit is assigned to another provider');
        }

        $this->encounterSession->bindForVisit($visitId, $actorUserId);

        try {
            $this->encounterSession->assertBound($visitId);
        } catch (EncounterSessionMismatchException $e) {
            throw $e;
        }

        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);
        $facilityId = $this->visitScope->resolveDeskFacilityId((int) ($visit['facility_id'] ?? 0));

        if (
            $shortcut === 'rx'
            && $this->config->getInt('require_allergies_for_rx', 0, $facilityId) === 1
            && !$this->completionService->hasAllergyDocumentationForPatient($pid)
        ) {
            $this->assertRxAllergyOverrideAllowed($pid, $visitId, $shortcut, $facilityId, $rxAllergyOverrideReason);
        }

        $modulePublic = ($GLOBALS['webroot'] ?? '') . '/interface/modules/custom_modules/oe-module-new-clinic/public/';

        $redirectUrl = match ($shortcut) {
            'encounter' => $this->resolveEncounterShortcutUrl($visit),
            'encounter_hub' => $modulePublic . 'clinical-doc/index.php?visit_id=' . urlencode((string) $visitId) . '&tab=visit',
            // Full lab form: native proc-order island when the facility has it
            // enabled, else the stock procedure_order form via the bridge.
            // Policies reuse the injected config so they honour the same
            // facility scope (and stay unit-testable via the config mock).
            'lab' => (new ProcedureOrderEnginePolicy($this->config))->isNativeProcOrderEnabled($facilityId)
                ? $modulePublic . 'proc-order.php?visit_id=' . urlencode((string) $visitId) . '&return_to=doctor'
                : $this->procedureOrderLinks->buildNewOrderUrl(
                    $pid,
                    $encounter,
                    $modulePublic . 'doctor.php'
                ),
            // Full Rx form: native rx-edit island when enabled, else the stock
            // prescription editor.
            'rx' => (new PrescriptionEditPolicy($this->config))->isNativeRxEditEnabled($facilityId)
                ? $modulePublic . 'rx-edit.php?visit_id=' . urlencode((string) $visitId) . '&return_to=doctor'
                : ($GLOBALS['webroot'] ?? '') . '/controller.php?prescription&edit&id=&pid=' . urlencode((string) $pid),
            'chart' => PatientCompletionService::chartUrl($pid, 'profile'),
        };

        $this->identityStrip->markFromShortcut($visitId, 'doctor', $shortcut);

        return [
            'redirect_url' => $redirectUrl,
            'shortcut' => $shortcut,
        ];
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function resolveEncounterShortcutUrl(array $visit): string
    {
        return $this->encounterNote->buildOpenUrlForVisit($visit, [
            'return_to' => 'doctor',
            'tab' => 'consult',
        ]);
    }

    private function assertRxAllergyOverrideAllowed(
        int $pid,
        int $visitId,
        string $shortcut,
        int $facilityId,
        ?string $rxAllergyOverrideReason,
    ): void {
        $reason = trim((string) ($rxAllergyOverrideReason ?? ''));
        if ($reason === '') {
            throw new AllergiesUndocumentedException(
                'Document allergies (or mark None known) before prescribing.'
            );
        }

        if (!AclMain::aclCheckCore('new_clinic', 'new_rx_undocumented_allergy_override')) {
            throw new AllergiesUndocumentedException(
                'Document allergies (or mark None known) before prescribing.'
            );
        }

        if (
            $this->config->getInt('require_override_reason', 0, $facilityId) === 1
            && mb_strlen($reason) < 10
        ) {
            throw new \InvalidArgumentException('Override reason must be at least 10 characters');
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_visit',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            'rx_undocumented_allergy_override',
            'pid=' . $pid . ';visit_id=' . $visitId . ';' . json_encode([
                'shortcut' => $shortcut,
                'override_reason' => mb_substr($reason, 0, 200),
            ]),
            $pid
        );
    }
}

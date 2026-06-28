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

use OpenEMR\Modules\NewClinic\Exceptions\EncounterSessionMismatchException;

class ConsultShortcutService
{
    private const ALLOWED_SHORTCUTS = ['encounter', 'lab', 'rx', 'chart'];

    public function __construct(
        private readonly EncounterSessionService $encounterSession = new EncounterSessionService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly ProcedureOrderDeepLinkService $procedureOrderLinks = new ProcedureOrderDeepLinkService(),
        private readonly EncounterIdentityStripService $identityStrip = new EncounterIdentityStripService(),
    ) {
    }

    /**
     * @return array{redirect_url: string, shortcut: string}
     */
    public function preflight(int $visitId, string $shortcut, int $actorUserId): array
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
        $modulePublic = ($GLOBALS['webroot'] ?? '') . '/interface/modules/custom_modules/oe-module-new-clinic/public/';

        $redirectUrl = match ($shortcut) {
            'encounter' => ($GLOBALS['webroot'] ?? '') . '/interface/patient_file/encounter/encounter_top.php',
            'lab' => $this->procedureOrderLinks->buildNewOrderUrl(
                $pid,
                $encounter,
                $modulePublic . 'doctor.php'
            ),
            'rx' => ($GLOBALS['webroot'] ?? '') . '/controller.php?prescription&edit&id=&pid=' . urlencode((string) $pid),
            'chart' => PatientCompletionService::chartUrl($pid, 'profile'),
        };

        $this->identityStrip->markFromShortcut($visitId, 'doctor', $shortcut);

        return [
            'redirect_url' => $redirectUrl,
            'shortcut' => $shortcut,
        ];
    }
}

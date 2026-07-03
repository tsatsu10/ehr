<?php

/**
 * Lab Desk shortcut preflight (M8-F10)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;

class LabShortcutService
{
    private const ALLOWED_SHORTCUTS = ['orders', 'results'];

    public function __construct(
        private readonly EncounterSessionService $encounterSession = new EncounterSessionService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly ProcedureOrderDeepLinkService $procedureOrderLinks = new ProcedureOrderDeepLinkService(),
        private readonly EncounterIdentityStripService $identityStrip = new EncounterIdentityStripService(),
        private readonly LabDirectService $labDirectService = new LabDirectService(),
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
        if ($visit['state'] !== 'in_lab') {
            throw new \InvalidArgumentException('Visit is not in active lab work');
        }

        $this->assertActorMayUseLab($visit, $actorUserId);
        $this->encounterSession->bindForVisit($visitId, $actorUserId);

        if ($shortcut === 'orders' && $this->labDirectService->isLabDirectVisit($visit)) {
            $this->labDirectService->assertCanCreateOrders();
        }

        $this->encounterSession->assertBound($visitId);

        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);
        $modulePublic = ($GLOBALS['webroot'] ?? '') . '/interface/modules/custom_modules/oe-module-new-clinic/public/';

        $redirectUrl = match ($shortcut) {
            'orders' => $this->procedureOrderLinks->buildNewOrderUrl(
                $pid,
                $encounter,
                $modulePublic . 'lab.php'
            ),
            'results' => ($GLOBALS['webroot'] ?? '') . '/interface/patient_file/summary/labdata.php?set_pid=' . urlencode((string) $pid),
        };

        $this->identityStrip->markFromShortcut($visitId, 'lab', $shortcut);

        return [
            'redirect_url' => $redirectUrl,
            'shortcut' => $shortcut,
        ];
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function assertActorMayUseLab(array $visit, int $actorUserId): void
    {
        $assigned = (int) ($visit['assigned_provider_id'] ?? 0);
        if ($assigned > 0 && $assigned !== $actorUserId) {
            if (!AclMain::aclCheckCore('new_clinic', 'new_admin')) {
                throw new \InvalidArgumentException('Visit is assigned to another lab tech');
            }
        }
    }
}

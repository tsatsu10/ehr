<?php

/**
 * Pharmacy Desk shortcut preflight (M9)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;

class PharmacyShortcutService
{
    private const ALLOWED_SHORTCUTS = ['dispense', 'rx_edit'];

    public function __construct(
        private readonly EncounterSessionService $encounterSession = new EncounterSessionService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
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
        if ($visit['state'] !== 'in_pharmacy') {
            throw new \InvalidArgumentException('Visit is not in active pharmacy work');
        }

        $this->assertActorMayUsePharmacy($visit, $actorUserId);
        $this->encounterSession->bindForVisit($visitId, $actorUserId);
        $this->encounterSession->assertBound($visitId);

        $pid = (int) $visit['pid'];
        $webroot = $GLOBALS['webroot'] ?? '';

        $redirectUrl = match ($shortcut) {
            'dispense' => $webroot . '/interface/patient_file/encounter/encounter_top.php',
            'rx_edit' => $webroot . '/controller.php?prescription&edit&id=&pid=' . urlencode((string) $pid),
        };

        $this->identityStrip->markFromShortcut($visitId, 'pharmacy', $shortcut);

        return [
            'redirect_url' => $redirectUrl,
            'shortcut' => $shortcut,
        ];
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function assertActorMayUsePharmacy(array $visit, int $actorUserId): void
    {
        $assigned = (int) ($visit['assigned_provider_id'] ?? 0);
        if ($assigned > 0 && $assigned !== $actorUserId) {
            if (!AclMain::aclCheckCore('new_clinic', 'new_admin')) {
                throw new \InvalidArgumentException('Visit is assigned to another pharmacist');
            }
        }
    }
}

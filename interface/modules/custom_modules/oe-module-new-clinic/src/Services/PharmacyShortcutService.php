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
        private readonly PrescriptionEditPolicy $rxEditPolicy = new PrescriptionEditPolicy(),
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
        $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';

        $redirectUrl = match ($shortcut) {
            // Stock has no dedicated "dispense" route -- dispensing an existing
            // Rx is a modal action (interface/drugs/dispense_drug.php) reachable
            // only from that Rx's own edit screen, which is reached from the
            // patient's prescription list. This used to point at the generic
            // encounter shell (encounter_top.php), which has no prescription or
            // dispense content at all -- a genuine dead end.
            'dispense' => $webroot . '/controller.php?prescription&list&id=' . urlencode((string) $pid),
            'rx_edit' => $this->rxEditPolicy->isNativeRxEditEnabled((int) ($visit['facility_id'] ?? 0))
                ? $modulePublic . 'rx-edit.php?visit_id=' . urlencode((string) $visitId) . '&return_to=pharmacy'
                : $webroot . '/controller.php?prescription&edit&id=&pid=' . urlencode((string) $pid),
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

<?php

/**
 * M17 Clinical Documentation Hub — form open preflight + audit
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Exceptions\EncounterSessionMismatchException;

class ClinicalDocFormOpenService
{
    public function __construct(
        private readonly ClinicalDocAccessService $access = new ClinicalDocAccessService(),
        private readonly ClinicalDocCatalogService $catalog = new ClinicalDocCatalogService(),
        private readonly ConsultShortcutService $shortcuts = new ConsultShortcutService(),
        private readonly EncounterSessionService $encounterSession = new EncounterSessionService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly ProcedureOrderDeepLinkService $procedureOrderLinks = new ProcedureOrderDeepLinkService(),
        private readonly EncounterIdentityStripService $identityStrip = new EncounterIdentityStripService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @param array<string, mixed> $body
     * @return array{redirect_url: string, formdir: string, action: string}
     */
    public function openForm(array $body, int $actorUserId): array
    {
        $this->access->assertHubAccess();

        $visitId = (int) ($body['visit_id'] ?? 0);
        $formdir = strtolower(trim((string) ($body['formdir'] ?? '')));
        $action = strtolower(trim((string) ($body['action'] ?? 'new')));
        $formId = (int) ($body['form_id'] ?? 0);
        $lens = trim((string) ($body['lens'] ?? 'visit'));

        if ($visitId <= 0 || $formdir === '') {
            throw new \InvalidArgumentException('visit_id and formdir are required');
        }

        if (!in_array($action, ['new', 'edit'], true)) {
            throw new \InvalidArgumentException('Invalid action');
        }

        if ($lens !== '') {
            $this->access->assertLensAccess($lens);
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        $this->assertClinicalVisitState($visit, $actorUserId);

        $facilityId = (int) ($visit['facility_id'] ?? $this->visitScope->resolveDeskFacilityId());
        if ($formdir === 'rx') {
            return $this->openRx($visitId, $visit, $actorUserId, $lens);
        }

        if (!$this->catalog->isAllowedFormdir($formdir, $facilityId)) {
            throw new \InvalidArgumentException('Form is not in the clinical documentation catalog');
        }

        $this->encounterSession->bindForVisit($visitId, $actorUserId);
        try {
            $this->encounterSession->assertBound($visitId);
        } catch (EncounterSessionMismatchException $e) {
            throw $e;
        }

        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);
        if ($encounter <= 0) {
            throw new \RuntimeException('No encounter on visit', 409);
        }

        $webroot = $GLOBALS['webroot'] ?? '';
        $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
        $returnUrl = $modulePublic . 'clinical-doc/index.php?visit_id=' . urlencode((string) $visitId)
            . '&tab=' . urlencode($lens !== '' ? $lens : 'visit');

        $query = [
            'pid' => (string) $pid,
            'encounter' => (string) $encounter,
            'formname' => $formdir,
            'return' => $returnUrl,
        ];
        if ($action === 'edit' && $formId > 0) {
            $query['form_id'] = (string) $formId;
        }

        $redirectUrl = $modulePublic . 'clinical-form-bridge.php?' . http_build_query($query);

        $this->identityStrip->markFromShortcut($visitId, 'doctor', 'form:' . $formdir);
        if (isset($_SESSION[EncounterIdentityStripService::SESSION_KEY]) && is_array($_SESSION[EncounterIdentityStripService::SESSION_KEY])) {
            $_SESSION[EncounterIdentityStripService::SESSION_KEY]['back_url'] = $returnUrl;
            $_SESSION[EncounterIdentityStripService::SESSION_KEY]['desk_label'] = xl('Documentation');
        }
        $this->recordFormOpen($facilityId, $visitId, $encounter, $formdir, $formId > 0 ? $formId : null, $actorUserId, 'open');

        return [
            'redirect_url' => $redirectUrl,
            'formdir' => $formdir,
            'action' => $action,
        ];
    }

    /**
     * @param array<string, mixed> $visit
     * @return array{redirect_url: string, formdir: string, action: string}
     */
    private function openRx(int $visitId, array $visit, int $actorUserId, string $lens): array
    {
        $this->access->assertLensAccess('orders');
        $preflight = $this->shortcuts->preflight($visitId, 'rx', $actorUserId);

        return [
            'redirect_url' => $preflight['redirect_url'],
            'formdir' => 'rx',
            'action' => 'new',
        ];
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function assertClinicalVisitState(array $visit, int $actorUserId): void
    {
        $state = (string) ($visit['state'] ?? '');
        $clinicalStates = [
            'awaiting_triage', 'in_triage', 'with_doctor',
            'ready_for_lab', 'in_lab', 'ready_for_pharmacy', 'in_pharmacy',
        ];
        if (!in_array($state, $clinicalStates, true)) {
            throw new \InvalidArgumentException('Visit is not in an active clinical state');
        }

        if ($state === 'with_doctor' && (int) ($visit['assigned_provider_id'] ?? 0) !== $actorUserId) {
            throw new \InvalidArgumentException('Visit is assigned to another provider');
        }
    }

    private function recordFormOpen(
        int $facilityId,
        int $visitId,
        int $encounter,
        string $formdir,
        ?int $formId,
        int $actorUserId,
        string $action,
    ): void {
        if (!$this->tableExists()) {
            return;
        }

        QueryUtils::sqlInsert(
            'INSERT INTO clinical_doc_form_open
                (facility_id, visit_id, encounter, formdir, form_id, actor_user_id, opened_at, action)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)',
            [
                $facilityId,
                $visitId,
                $encounter,
                $formdir,
                $formId,
                $actorUserId,
                $action,
            ]
        );
    }

    private function tableExists(): bool
    {
        $row = QueryUtils::querySingleRow(
            "SHOW TABLES LIKE 'clinical_doc_form_open'"
        );

        return !empty($row);
    }
}

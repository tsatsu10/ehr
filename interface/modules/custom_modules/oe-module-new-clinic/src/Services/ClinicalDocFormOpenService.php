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
use OpenEMR\Common\Logging\EventAuditLogger;
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
        private readonly EncounterNoteService $encounterNote = new EncounterNoteService(),
        private readonly ProcedureOrderEnginePolicy $procOrderPolicy = new ProcedureOrderEnginePolicy(),
    ) {
    }

    /**
     * @param array<string, mixed> $body
     * @return array{redirect_url: string, formdir: string, action: string}
     */
    public function openForm(array $body, int $actorUserId): array
    {
        $this->access->assertWriteAccess();

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

        $visit = $this->queueService->getVisitForActor($visitId);
        $this->assertClinicalVisitState($visit, $actorUserId);

        $facilityId = (int) ($visit['facility_id'] ?? $this->visitScope->resolveDeskFacilityId());
        if ($formdir === 'rx') {
            return $this->openRx($visitId, $actorUserId);
        }

        $canonicalFormdir = $this->catalog->resolveRegistryDirectory($formdir);
        $sourceLens = $this->catalog->resolveSourceLensForFormdir($canonicalFormdir, $facilityId);
        if ($sourceLens === null) {
            throw new \InvalidArgumentException('Form is not in the clinical documentation catalog');
        }

        $this->access->assertLensAccess($sourceLens);

        if (!$this->catalog->isAllowedFormdir($canonicalFormdir, $facilityId)) {
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

        if ($action === 'edit' && $formId > 0) {
            $this->assertFormInstanceOnEncounter($formId, $encounter, $pid, $canonicalFormdir);
        }

        if ($this->procOrderPolicy->shouldOpenNativeProcOrder($canonicalFormdir, $facilityId)) {
            $webroot = $GLOBALS['webroot'] ?? '';
            $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
            $returnTo = strtolower(trim((string) ($body['return_to'] ?? 'hub')));
            $returnTab = $lens !== '' ? $lens : 'visit';
            $query = [
                'visit_id' => (string) $visitId,
                'return_to' => $returnTo,
                'tab' => $returnTab,
            ];
            if ($action === 'edit' && $formId > 0) {
                $query['form_id'] = (string) $formId;
            }
            $redirectUrl = $modulePublic . 'proc-order.php?' . http_build_query($query);
            $returnUrl = $returnTo === 'doctor'
                ? $modulePublic . 'doctor.php'
                : $modulePublic . 'clinical-doc/index.php?visit_id=' . urlencode((string) $visitId)
                    . '&tab=' . urlencode($returnTab);
            $this->identityStrip->markFromShortcut($visitId, 'doctor', 'form:procedure_order');
            if (isset($_SESSION[EncounterIdentityStripService::SESSION_KEY]) && is_array($_SESSION[EncounterIdentityStripService::SESSION_KEY])) {
                $_SESSION[EncounterIdentityStripService::SESSION_KEY]['back_url'] = $returnUrl;
                $_SESSION[EncounterIdentityStripService::SESSION_KEY]['desk_label'] = $returnTo === 'doctor'
                    ? xl('Doctor Desk')
                    : $this->deskLabelForLens($sourceLens);
            }
            $this->recordFormOpen($facilityId, $visitId, $encounter, 'procedure_order', $formId > 0 ? $formId : null, $actorUserId, 'open');

            return [
                'redirect_url' => $redirectUrl,
                'formdir' => 'procedure_order',
                'action' => $action,
            ];
        }

        if ($this->encounterNote->shouldOpenNativeForm($canonicalFormdir, $facilityId)) {
            $webroot = $GLOBALS['webroot'] ?? '';
            $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
            $returnTo = strtolower(trim((string) ($body['return_to'] ?? 'hub')));
            $returnTab = $lens !== '' ? $lens : 'visit';
            $focus = strtolower(trim((string) ($body['focus'] ?? '')));
            $returnUrl = $returnTo === 'doctor'
                ? $modulePublic . 'doctor.php'
                : $modulePublic . 'clinical-doc/index.php?visit_id=' . urlencode((string) $visitId)
                    . '&tab=' . urlencode($returnTab);
            $redirectUrl = $this->encounterNote->buildPageUrl($visitId, array_filter([
                'return_to' => $returnTo,
                'tab' => $returnTab,
                'form_id' => ($action === 'edit' && $formId > 0) ? (string) $formId : null,
                'focus' => $focus === 'sign' ? 'sign' : null,
            ]));
            $this->markIdentityStripForNativeOpen($visitId, $returnTo, $sourceLens, $returnUrl);
            $this->recordFormOpen(
                $facilityId,
                $visitId,
                $encounter,
                EncounterNoteService::NATIVE_FORMDIR,
                $formId > 0 ? $formId : null,
                $actorUserId,
                'open'
            );

            return [
                'redirect_url' => $redirectUrl,
                'formdir' => EncounterNoteService::NATIVE_FORMDIR,
                'action' => $action,
            ];
        }

        // Native Clinical Instructions editor is the default (no flag) — funnel
        // every caller (hub card, Add form, Doctor Desk favorites, any deep link)
        // to the hub with the drawer auto-opened. The in-hub island also
        // intercepts client-side for a no-reload drawer; this server route covers
        // the callers that navigate instead.
        if ($canonicalFormdir === 'clinical_instructions') {
            $webroot = $GLOBALS['webroot'] ?? '';
            $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
            $returnTab = $sourceLens !== '' ? $sourceLens : 'nursing';
            $redirectUrl = $modulePublic . 'clinical-doc/index.php?'
                . http_build_query([
                    'visit_id' => (string) $visitId,
                    'tab' => $returnTab,
                    'open_form' => 'clinical_instructions',
                ]);
            $this->recordFormOpen($facilityId, $visitId, $encounter, 'clinical_instructions', $formId > 0 ? $formId : null, $actorUserId, 'open');

            return [
                'redirect_url' => $redirectUrl,
                'formdir' => 'clinical_instructions',
                'action' => $action,
            ];
        }

        // Primary-care eye exam (flag-gated) — funnel to the hub Specialty lens.
        if ($canonicalFormdir === 'nc_eye_exam') {
            $webroot = $GLOBALS['webroot'] ?? '';
            $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
            $redirectUrl = $modulePublic . 'clinical-doc/index.php?'
                . http_build_query([
                    'visit_id' => (string) $visitId,
                    'tab' => 'specialty',
                    'open_form' => 'nc_eye_exam',
                ]);
            $this->recordFormOpen($facilityId, $visitId, $encounter, 'nc_eye_exam', $formId > 0 ? $formId : null, $actorUserId, 'open');

            return [
                'redirect_url' => $redirectUrl,
                'formdir' => 'nc_eye_exam',
                'action' => $action,
            ];
        }

        // Medical certificate (flag-gated) — funnel to the hub with the drawer
        // auto-opened; there is no stock fallback page for this formdir.
        if ($canonicalFormdir === 'nc_certificate') {
            $webroot = $GLOBALS['webroot'] ?? '';
            $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
            $redirectUrl = $modulePublic . 'clinical-doc/index.php?'
                . http_build_query([
                    'visit_id' => (string) $visitId,
                    'tab' => 'visit',
                    'open_form' => 'nc_certificate',
                ]);
            $this->recordFormOpen($facilityId, $visitId, $encounter, 'nc_certificate', $formId > 0 ? $formId : null, $actorUserId, 'open');

            return [
                'redirect_url' => $redirectUrl,
                'formdir' => 'nc_certificate',
                'action' => $action,
            ];
        }

        // Native vitals editor is the default (no flag) — funnel every caller to
        // the hub with the vitals drawer auto-opened, same as instructions.
        if ($canonicalFormdir === 'vitals') {
            $webroot = $GLOBALS['webroot'] ?? '';
            $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
            $returnTab = $sourceLens !== '' ? $sourceLens : 'nursing';
            $redirectUrl = $modulePublic . 'clinical-doc/index.php?'
                . http_build_query([
                    'visit_id' => (string) $visitId,
                    'tab' => $returnTab,
                    'open_form' => 'vitals',
                ]);
            $this->recordFormOpen($facilityId, $visitId, $encounter, 'vitals', $formId > 0 ? $formId : null, $actorUserId, 'open');

            return [
                'redirect_url' => $redirectUrl,
                'formdir' => 'vitals',
                'action' => $action,
            ];
        }

        // Native screening questionnaires (PHQ-9 / GAD-7) are the default (no
        // flag). Funnel every caller to the hub Screening lens with the screener
        // drawer auto-opened — the in-hub island also intercepts client-side, this
        // route covers deep-links / favorites / any stale-bundle fallback so the
        // card never lands on the (non-existent) stock form directory.
        if ($this->catalog->isNativeScreeningFormdir($canonicalFormdir, $facilityId)) {
            $webroot = $GLOBALS['webroot'] ?? '';
            $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
            $redirectUrl = $modulePublic . 'clinical-doc/index.php?'
                . http_build_query([
                    'visit_id' => (string) $visitId,
                    'tab' => 'screening',
                    'open_form' => $canonicalFormdir,
                ]);
            $this->recordFormOpen($facilityId, $visitId, $encounter, $canonicalFormdir, null, $actorUserId, 'open');

            return [
                'redirect_url' => $redirectUrl,
                'formdir' => $canonicalFormdir,
                'action' => $action,
            ];
        }

        $webroot = $GLOBALS['webroot'] ?? '';
        $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
        $returnTo = strtolower(trim((string) ($body['return_to'] ?? 'hub')));
        $returnTab = $lens !== '' ? $lens : 'visit';
        $returnUrl = $returnTo === 'doctor'
            ? $modulePublic . 'doctor.php'
            : $modulePublic . 'clinical-doc/index.php?visit_id=' . urlencode((string) $visitId)
                . '&tab=' . urlencode($returnTab);

        $query = [
            'pid' => (string) $pid,
            'encounter' => (string) $encounter,
            'formname' => $canonicalFormdir,
            'return' => $returnUrl,
        ];
        if ($action === 'edit' && $formId > 0) {
            $query['form_id'] = (string) $formId;
        }

        $redirectUrl = $modulePublic . 'clinical-form-bridge.php?' . http_build_query($query);

        $this->identityStrip->markFromShortcut($visitId, 'doctor', 'form:' . strtolower($canonicalFormdir));
        if (isset($_SESSION[EncounterIdentityStripService::SESSION_KEY]) && is_array($_SESSION[EncounterIdentityStripService::SESSION_KEY])) {
            $_SESSION[EncounterIdentityStripService::SESSION_KEY]['back_url'] = $returnUrl;
            $_SESSION[EncounterIdentityStripService::SESSION_KEY]['desk_label'] = $returnTo === 'doctor'
                ? xl('Doctor Desk')
                : $this->deskLabelForLens($sourceLens);
        }
        $this->recordFormOpen($facilityId, $visitId, $encounter, strtolower($canonicalFormdir), $formId > 0 ? $formId : null, $actorUserId, 'open');

        return [
            'redirect_url' => $redirectUrl,
            'formdir' => strtolower($canonicalFormdir),
            'action' => $action,
        ];
    }

    /**
     * @return array{redirect_url: string, formdir: string, action: string}
     */
    private function openRx(int $visitId, int $actorUserId): array
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

    private function assertFormInstanceOnEncounter(int $formId, int $encounter, int $pid, string $formdir): void
    {
        $row = QueryUtils::querySingleRow(
            'SELECT id FROM forms
             WHERE form_id = ? AND encounter = ? AND pid = ? AND deleted = 0 AND LOWER(formdir) = ?
             LIMIT 1',
            [$formId, $encounter, $pid, strtolower($formdir)]
        );

        if (!is_array($row)) {
            throw new \InvalidArgumentException('Form instance is not on this visit');
        }
    }

    private function deskLabelForLens(string $lens): string
    {
        return match ($lens) {
            'nursing' => xl('Nursing documentation'),
            'consult' => xl('Consult documentation'),
            'orders' => xl('Orders'),
            'screening' => xl('Screening'),
            'specialty' => xl('Specialty'),
            default => xl('Documentation'),
        };
    }

    private function markIdentityStripForNativeOpen(
        int $visitId,
        string $returnTo,
        string $sourceLens,
        string $returnUrl,
    ): void {
        $this->identityStrip->markFromShortcut($visitId, 'doctor', 'form:' . EncounterNoteService::NATIVE_FORMDIR);
        if (isset($_SESSION[EncounterIdentityStripService::SESSION_KEY]) && is_array($_SESSION[EncounterIdentityStripService::SESSION_KEY])) {
            $_SESSION[EncounterIdentityStripService::SESSION_KEY]['back_url'] = $returnUrl;
            $_SESSION[EncounterIdentityStripService::SESSION_KEY]['desk_label'] = $returnTo === 'doctor'
                ? xl('Doctor Desk')
                : $this->deskLabelForLens($sourceLens);
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

        EventAuditLogger::getInstance()->newEvent(
            'new_visit',
            'clinical_doc_form_opened',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode([
                'visit_id' => $visitId,
                'encounter_id' => $encounter,
                'facility_id' => $facilityId,
                'formdir' => $formdir,
                'form_id' => $formId,
                'action' => $action,
            ]),
            0
        );
    }
}

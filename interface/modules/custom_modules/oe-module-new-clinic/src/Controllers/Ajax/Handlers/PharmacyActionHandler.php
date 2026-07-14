<?php

/**
 * pharmacy.* ajax actions (AUDIT-10e).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\EncounterSessionService;
use OpenEMR\Modules\NewClinic\Services\PharmacyService;
use OpenEMR\Modules\NewClinic\Services\PharmacyShortcutService;
use OpenEMR\Modules\NewClinic\Services\PrescriptionEditService;

final class PharmacyActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'pharmacy.queue',
        'pharmacy.select',
        'pharmacy.take',
        'pharmacy.complete',
        'pharmacy.walkin_close',
        'pharmacy.skip_to_payment',
        'pharmacy.shortcut_preflight',
        'pharmacy.restore_session',
        'pharmacy.rx_form_data',
        'pharmacy.rx_search_drugs',
        'pharmacy.rx_save',
    ];

    public function __construct(
        private readonly AjaxController $host,
    ) {
    }

    public function supports(string $action): bool
    {
        return in_array($action, self::ACTIONS, true);
    }

    public function handle(string $action, string $method, int $userId): void
    {
        switch ($action) {
            case 'pharmacy.queue':
                $facilityId = $this->host->resolveRequestFacilityId();
                $queue = $this->host->svc(PharmacyService::class)->getPharmacyQueue(
                    $facilityId,
                    $this->host->validDay($_REQUEST['visit_date'] ?? '', date('Y-m-d')),
                    $userId
                );
                $queue = $this->host->enrichQueuePayload($queue, $userId, $facilityId);
                $this->host->respondQueue($queue); // SCALE-1.8 delta poll
                break;
            case 'pharmacy.select':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $payload = $this->host->svc(PharmacyService::class)->selectVisit(
                    (int) ($body['visit_id'] ?? 0),
                    $userId
                );
                $this->host->respond(true, 'ok', $payload);
                break;
            case 'pharmacy.take':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $payload = $this->host->svc(PharmacyService::class)->takePatient(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0)
                );
                $this->host->respond(true, 'Patient taken', $payload);
                break;
            case 'pharmacy.complete':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(PharmacyService::class)->completePharmacy(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    $this->host->esignOverrideReason($body),
                    $this->host->undispensedOverrideReason($body),
                    isset($body['pharmacy_outcome']) ? (string) $body['pharmacy_outcome'] : null,
                    $this->host->externalRxOverrideReason($body),
                );
                $this->host->respond(true, 'Pharmacy completed', $result);
                break;
            case 'pharmacy.walkin_close':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(PharmacyService::class)->closeWalkinWithoutDispense(
                    (int) ($body['visit_id'] ?? 0),
                    (string) ($body['pharmacy_outcome'] ?? ''),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    $this->host->esignOverrideReason($body),
                );
                $this->host->respond(true, 'Pharmacy walk-in closed', $result);
                break;
            case 'pharmacy.skip_to_payment':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(PharmacyService::class)->skipToPayment(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    (string) ($body['reason'] ?? '')
                );
                $this->host->respond(true, 'Skipped to payment', $result);
                break;
            case 'pharmacy.shortcut_preflight':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $preflight = $this->host->svc(PharmacyShortcutService::class)->preflight(
                    (int) ($body['visit_id'] ?? 0),
                    (string) ($body['shortcut'] ?? ''),
                    $userId
                );
                $this->host->respond(true, 'ok', $preflight);
                break;
            case 'pharmacy.restore_session':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $session = $this->host->svc(EncounterSessionService::class)->bindForVisitWithDeskAcl(
                    (int) ($body['visit_id'] ?? 0),
                    $userId
                );
                $this->host->respond(true, 'Session restored', ['session' => $session->toArray()]);
                break;
            case 'pharmacy.rx_form_data':
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                $prescriptionId = (int) ($_REQUEST['prescription_id'] ?? 0);
                $formData = $this->host->svc(PrescriptionEditService::class)->getFormData($visitId, $prescriptionId);
                $this->host->respond(true, 'ok', $formData);
                break;
            case 'pharmacy.rx_search_drugs':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $query = (string) ($_REQUEST['query'] ?? '');
                $rows = $this->host->svc(PrescriptionEditService::class)->searchDrugs($pid, $query);
                $this->host->respond(true, 'ok', ['rows' => $rows]);
                break;
            case 'pharmacy.rx_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $saved = $this->host->svc(PrescriptionEditService::class)->savePrescription($body, $userId);
                $this->host->respond(true, 'ok', $saved);
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}

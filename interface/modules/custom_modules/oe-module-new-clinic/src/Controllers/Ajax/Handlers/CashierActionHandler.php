<?php

/**
 * cashier.* ajax actions (AUDIT-10e).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\CashierOtherPaymentService;
use OpenEMR\Modules\NewClinic\Services\CashierService;
use OpenEMR\Modules\NewClinic\Services\EligibilityCheckService;
use OpenEMR\Modules\NewClinic\Services\SchemeClaimService;

final class CashierActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'cashier.queue',
        'cashier.select',
        'cashier.resolve_patient',
        'cashier.charges.post',
        'cashier.pay',
        'cashier.pay_partial',
        'cashier.scheme.list',
        'cashier.scheme.pay',
        'cashier.other_payment.context',
        'cashier.other_payment.post',
        'cashier.mark_unpaid',
        'cashier.close_zero',
        'cashier.eligibility_check',
        'cashier.eligibility_status',
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
            case 'cashier.queue':
                $facilityId = $this->host->resolveRequestFacilityId();
                $queue = $this->host->svc(CashierService::class)->getCashierQueue(
                    $facilityId,
                    $this->host->validDay($_REQUEST['visit_date'] ?? '', date('Y-m-d')),
                    $userId
                );
                $queue = $this->host->enrichQueuePayload($queue, $userId, $facilityId);
                $this->host->respondQueue($queue); // SCALE-1.8 delta poll
                break;
            case 'cashier.select':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $payload = $this->host->svc(CashierService::class)->selectVisit(
                    (int) ($body['visit_id'] ?? 0),
                    $userId
                );
                $this->host->respond(true, 'ok', $payload);
                break;
            case 'cashier.other_payment.context':
                $context = $this->host->svc(CashierOtherPaymentService::class)->getContext(
                    (int) ($_REQUEST['pid'] ?? 0)
                );
                $this->host->respond(true, 'ok', $context);
                break;
            case 'cashier.other_payment.post':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $posted = $this->host->svc(CashierOtherPaymentService::class)->post($body, $userId);
                $this->host->respond(true, 'ok', $posted);
                break;
            case 'cashier.resolve_patient':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $facilityId = $this->host->resolveRequestFacilityId();
                $payload = $this->host->svc(CashierService::class)->resolvePatientCheckout(
                    (int) ($body['pid'] ?? 0),
                    $facilityId,
                    $userId
                );
                $this->host->respond(true, 'ok', $payload);
                break;
            case 'cashier.charges.post':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $payload = $this->host->svc(CashierService::class)->postCharges(
                    (int) ($body['visit_id'] ?? 0),
                    (array) ($body['lines'] ?? []),
                    $userId
                );
                $this->host->respond(true, 'Charges posted', $payload);
                break;
            case 'cashier.pay':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(CashierService::class)->recordPayment(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    (float) ($body['amount_received'] ?? 0),
                    isset($body['receipt_note']) ? (string) $body['receipt_note'] : null,
                    $this->host->esignOverrideReason($body),
                    isset($body['completion_override_reason'])
                        ? (string) $body['completion_override_reason']
                        : null,
                    isset($body['client_request_id']) ? (string) $body['client_request_id'] : null,
                    isset($body['payment_method']) ? (string) $body['payment_method'] : 'cash',
                    isset($body['momo_reference']) ? (string) $body['momo_reference'] : null,
                );
                $this->host->respond(true, 'Payment recorded', $result);
                break;
            case 'cashier.pay_partial':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(CashierService::class)->recordPartialPayment(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    (float) ($body['amount_received'] ?? 0),
                    (string) ($body['reason'] ?? ''),
                    $this->host->esignOverrideReason($body),
                    isset($body['client_request_id']) ? (string) $body['client_request_id'] : null,
                    isset($body['payment_method']) ? (string) $body['payment_method'] : 'cash',
                    isset($body['momo_reference']) ? (string) $body['momo_reference'] : null,
                );
                $this->host->respond(true, 'Partial payment recorded', $result);
                break;
            case 'cashier.scheme.list':
                $this->host->respond(true, 'ok', [
                    'schemes' => $this->host->svc(SchemeClaimService::class)->getSchemes(),
                ]);
                break;
            case 'cashier.scheme.pay':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(CashierService::class)->recordSchemePayment(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    (int) ($body['scheme_id'] ?? 0),
                    (string) ($body['membership_number'] ?? ''),
                    (array) ($body['coverage_lines'] ?? []),
                    (float) ($body['amount_received'] ?? 0),
                    $this->host->esignOverrideReason($body),
                    isset($body['client_request_id']) ? (string) $body['client_request_id'] : null,
                    isset($body['payment_method']) ? (string) $body['payment_method'] : 'cash',
                    isset($body['momo_reference']) ? (string) $body['momo_reference'] : null,
                );
                $this->host->respond(true, 'Scheme payment recorded', $result);
                break;
            case 'cashier.mark_unpaid':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(CashierService::class)->markClosedUnpaid(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    (string) ($body['reason'] ?? '')
                );
                $this->host->respond(true, 'Marked left unpaid', $result);
                break;
            case 'cashier.close_zero':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(CashierService::class)->closeWithoutCharge(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    (string) ($body['reason'] ?? '')
                );
                $this->host->respond(true, 'Visit closed without charge', $result);
                break;
            case 'cashier.eligibility_check':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $logged = $this->host->svc(EligibilityCheckService::class)->logCheck(
                    (int) ($body['pid'] ?? 0),
                    isset($body['visit_id']) ? (int) $body['visit_id'] : null,
                    (int) ($body['insurance_company_id'] ?? 0),
                    (string) ($body['membership_number'] ?? ''),
                    (string) ($body['method'] ?? 'other'),
                    (string) ($body['result'] ?? 'unknown'),
                    (string) ($body['reference_code'] ?? ''),
                    (string) ($body['note'] ?? ''),
                    $userId
                );
                $this->host->respond(true, 'Eligibility check logged', $logged);
                break;
            case 'cashier.eligibility_status':
                $params = $this->host->readRequestParams($method);
                $checks = $this->host->svc(EligibilityCheckService::class)->latestForPatient(
                    (int) ($params['pid'] ?? 0)
                );
                $this->host->respond(true, 'ok', ['checks' => $checks]);
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}

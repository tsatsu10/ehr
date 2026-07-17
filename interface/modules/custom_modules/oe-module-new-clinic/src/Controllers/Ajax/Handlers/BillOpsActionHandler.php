<?php

/**
 * bill_ops.* ajax actions — M13 Billing Ops hub (AUDIT-10r).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\BillOpsChargeCorrectionService;
use OpenEMR\Modules\NewClinic\Services\BillOpsDaysheetService;
use OpenEMR\Modules\NewClinic\Services\BillOpsOutstandingService;
use OpenEMR\Modules\NewClinic\Services\BillOpsPaymentsSearchService;
use OpenEMR\Modules\NewClinic\Services\PaymentHistoryService;
use OpenEMR\Modules\NewClinic\Services\PayerPriceService;
use OpenEMR\Modules\NewClinic\Services\SchemeClaimService;

final class BillOpsActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'bill_ops.visit_charges',
        'bill_ops.charge_correct',
        'bill_ops.payments_search',
        'bill_ops.payment_reverse',
        'bill_ops.receipt_reprint',
        'bill_ops.daysheet',
        'bill_ops.daysheet_export',
        'bill_ops.momo_save',
        'bill_ops.outstanding_list',
        'bill_ops.scheme_claims',
        'bill_ops.scheme_claims_export',
        'bill_ops.scheme_claim_status',
        'bill_ops.payer_prices',
        'bill_ops.payer_price_upsert',
        'bill_ops.payer_price_delete',
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
            case 'bill_ops.visit_charges':
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                if ($method === 'POST') {
                    $body = $this->host->readRequestParams($method);
                    $visitId = (int) ($body['visit_id'] ?? $visitId);
                }
                $charges = $this->host->svc(BillOpsChargeCorrectionService::class)->getVisitCharges($visitId, $userId);
                $this->host->respond(true, 'ok', $charges);
                break;
            case 'bill_ops.charge_correct':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $corrected = $this->host->svc(BillOpsChargeCorrectionService::class)->applyCorrection(
                    (int) ($body['visit_id'] ?? 0),
                    is_array($body['add'] ?? null) ? $body['add'] : [],
                    is_array($body['remove'] ?? null) ? array_map('intval', $body['remove']) : [],
                    (string) ($body['reason'] ?? ''),
                    $userId
                );
                $this->host->respond(true, 'ok', $corrected);
                break;
            case 'bill_ops.payments_search':
                $params = $this->host->readRequestParams($method);
                $search = $this->host->svc(BillOpsPaymentsSearchService::class)->search(
                    (string) ($params['q'] ?? ''),
                    isset($params['date_from']) ? (string) $params['date_from'] : null,
                    isset($params['date_to']) ? (string) $params['date_to'] : null,
                    (int) ($params['offset'] ?? 0),
                    (int) ($params['limit'] ?? BillOpsPaymentsSearchService::PAGE_SIZE)
                );
                $this->host->respond(true, 'ok', $search);
                break;
            case 'bill_ops.payment_reverse':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $reversed = $this->host->svc(BillOpsPaymentsSearchService::class)->reverse(
                    (int) ($body['payment_id'] ?? $body['receipt_id'] ?? 0),
                    (string) ($body['reason'] ?? ''),
                    $userId
                );
                $this->host->respond(true, 'ok', $reversed);
                break;
            case 'bill_ops.receipt_reprint':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $pid = (int) ($body['pid'] ?? 0);
                $receiptId = (int) ($body['receipt_id'] ?? 0);
                $payload = $this->host->svc(PaymentHistoryService::class)->getReceiptReprintForBillOps($receiptId, $pid, $userId);
                $this->host->respond(true, 'ok', $payload);
                break;
            case 'bill_ops.daysheet':
                $params = $this->host->readRequestParams($method);
                $daysheet = $this->host->svc(BillOpsDaysheetService::class)->getDaysheet(
                    (int) ($params['facility_id'] ?? 0),
                    $this->host->validDay($params['date'] ?? '')
                );
                $this->host->respond(true, 'ok', $daysheet);
                break;
            case 'bill_ops.daysheet_export':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $exported = $this->host->svc(BillOpsDaysheetService::class)->recordExport(
                    (int) ($body['facility_id'] ?? 0),
                    $this->host->validDay($body['date'] ?? ''),
                    $userId
                );
                $this->host->respond(true, 'ok', $exported);
                break;
            case 'bill_ops.momo_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $savedMomo = $this->host->svc(BillOpsDaysheetService::class)->saveMomoTally(
                    (int) ($body['facility_id'] ?? 0),
                    $this->host->validDay($body['date'] ?? ''),
                    (float) ($body['amount'] ?? 0),
                    (string) ($body['note'] ?? ''),
                    $userId
                );
                $this->host->respond(true, 'ok', $savedMomo);
                break;
            case 'bill_ops.outstanding_list':
                $params = $this->host->readRequestParams($method);
                $list = $this->host->svc(BillOpsOutstandingService::class)->listOutstanding(
                    isset($params['bucket']) ? (string) $params['bucket'] : null,
                    (int) ($params['offset'] ?? 0),
                    (int) ($params['limit'] ?? BillOpsOutstandingService::PAGE_SIZE)
                );
                $this->host->respond(true, 'ok', $list);
                break;
            case 'bill_ops.scheme_claims':
                $params = $this->host->readRequestParams($method);
                $facilityId = $this->host->resolveRequestFacilityId();
                $svc = $this->host->svc(SchemeClaimService::class);
                $enabled = $svc->isEnabled($facilityId);
                $status = isset($params['status']) ? (string) $params['status'] : 'to_submit';
                $this->host->respond(true, 'ok', [
                    'enabled' => $enabled,
                    'status' => $status,
                    'schemes' => $enabled ? $svc->getSchemes() : [],
                    'rows' => $enabled
                        ? $svc->listClaims(
                            $facilityId,
                            $status,
                            (int) ($params['limit'] ?? 50),
                            (int) ($params['offset'] ?? 0),
                            (int) ($params['insurance_company_id'] ?? 0),
                            isset($params['age_bucket']) ? (string) $params['age_bucket'] : null
                        )
                        : [],
                ]);
                break;
            case 'bill_ops.scheme_claims_export':
                $params = $this->host->readRequestParams($method);
                $facilityId = $this->host->resolveRequestFacilityId();
                $svc = $this->host->svc(SchemeClaimService::class);
                if (!$svc->isEnabled($facilityId)) {
                    $this->host->respond(false, 'Insurance scheme-split is not enabled', ['code' => 'forbidden'], 403);
                }
                $status = isset($params['status']) ? (string) $params['status'] : 'to_submit';
                $this->host->respondCsv(
                    'scheme-claims-' . preg_replace('/[^a-z_]/', '', $status) . '.csv',
                    $svc->exportCsv($facilityId, $status)
                );
                break;
            case 'bill_ops.scheme_claim_status':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(SchemeClaimService::class)->setClaimStatus(
                    (int) ($body['claim_id'] ?? 0),
                    (string) ($body['status'] ?? ''),
                    $userId,
                    (string) ($body['rejection_note'] ?? '')
                );
                $this->host->respond(true, 'Claim updated', $result);
                break;
            case 'bill_ops.payer_prices':
                $params = $this->host->readRequestParams($method);
                $facilityId = $this->host->resolveRequestFacilityId();
                $svc = $this->host->svc(PayerPriceService::class);
                $this->host->respond(true, 'ok', [
                    'enabled' => $svc->isEnabled($facilityId),
                    'schemes' => $this->host->svc(SchemeClaimService::class)->getSchemes(),
                    'insurance_company_id' => (int) ($params['insurance_company_id'] ?? 0),
                    'rows' => (int) ($params['insurance_company_id'] ?? 0) > 0
                        ? $svc->listOverrides($facilityId, (int) $params['insurance_company_id'])
                        : [],
                ]);
                break;
            case 'bill_ops.payer_price_upsert':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $saved = $this->host->svc(PayerPriceService::class)->upsertOverride(
                    $this->host->resolveRequestFacilityId(),
                    (int) ($body['insurance_company_id'] ?? 0),
                    (string) ($body['item_code'] ?? ''),
                    (string) ($body['item_name'] ?? ''),
                    (float) ($body['price_amount'] ?? 0),
                    $userId
                );
                $this->host->respond(true, 'Price saved', $saved);
                break;
            case 'bill_ops.payer_price_delete':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $this->host->svc(PayerPriceService::class)->deleteOverride(
                    $this->host->resolveRequestFacilityId(),
                    (int) ($body['id'] ?? 0)
                );
                $this->host->respond(true, 'Price removed', []);
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}

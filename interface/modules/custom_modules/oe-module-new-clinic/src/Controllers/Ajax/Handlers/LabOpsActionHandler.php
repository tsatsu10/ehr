<?php

/**
 * lab_ops.* ajax actions — M11 Lab Ops hub (AUDIT-10p).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\LabOpsOrderMetaService;
use OpenEMR\Modules\NewClinic\Services\LabOpsResultService;
use OpenEMR\Modules\NewClinic\Services\LabOpsSetupService;
use OpenEMR\Modules\NewClinic\Services\LabOpsWorklistService;
use OpenEMR\Modules\NewClinic\Services\LabQcRuleService;
use OpenEMR\Modules\NewClinic\Services\LabResultValidationService;

final class LabOpsActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'lab_ops.worklist',
        'lab_ops.result_get',
        'lab_ops.result_save',
        'lab_ops.result_release',
        'lab_ops.result_amend',
        'lab_ops.specimen_collect',
        'lab_ops.specimen_reject',
        'lab_ops.setup_status',
        'lab_ops.setup_model',
        'lab_ops.provider_create',
        'lab_ops.sendout_provider_create',
        'lab_ops.panel_import',
        'lab_ops.fee_map_list',
        'lab_ops.fee_map_save',
        'lab_ops.mark_send_out',
        'lab_ops.qc_rules_list',
        'lab_ops.qc_rule_save',
        'lab_ops.qc_rule_reset',
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
            case 'lab_ops.worklist':
                $body = $this->host->readRequestParams($method);
                $worklist = $this->host->svc(LabOpsWorklistService::class)->worklist([
                    'tab' => $body['tab'] ?? LabOpsWorklistService::TAB_PENDING,
                    'date' => $this->host->validDay($body['date'] ?? ''),
                    'facility_id' => $body['facility_id'] ?? 0,
                    'fulfillment' => $body['fulfillment'] ?? 'all',
                    'urgent_first' => $body['urgent_first'] ?? true,
                ], $userId);
                $this->host->respond(true, 'ok', $worklist);
                break;
            case 'lab_ops.result_get':
                $orderId = (int) ($_REQUEST['procedure_order_id'] ?? 0);
                if ($method === 'POST') {
                    $body = $this->host->readRequestParams($method);
                    $orderId = (int) ($body['procedure_order_id'] ?? $orderId);
                }
                $form = $this->host->svc(LabOpsResultService::class)->getEntryForm($orderId);
                $this->host->respond(true, 'ok', $form);
                break;
            case 'lab_ops.result_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $saved = $this->host->svc(LabOpsResultService::class)->saveEntry(
                    (int) ($body['procedure_order_id'] ?? 0),
                    $body,
                    $userId
                );
                $this->host->respond(true, 'ok', $saved);
                break;
            case 'lab_ops.result_release':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $notification = is_array($body['critical_notification'] ?? null)
                    ? $body['critical_notification']
                    : null;
                $released = $this->host->svc(LabOpsResultService::class)->releaseReport(
                    (int) ($body['procedure_report_id'] ?? 0),
                    $userId,
                    $notification
                );
                $this->host->respond(true, 'ok', $released);
                break;
            case 'lab_ops.result_amend':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $amended = $this->host->svc(LabOpsResultService::class)->amendReleasedOrder(
                        (int) ($body['procedure_order_id'] ?? 0),
                        (string) ($body['reason'] ?? ''),
                        $userId
                    );
                    $this->host->respond(true, 'Amendment started', $amended);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid'], 400);
                }
                break;
            case 'lab_ops.specimen_collect':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $collected = $this->host->svc(LabOpsOrderMetaService::class)->collectSpecimen(
                    (int) ($body['procedure_order_id'] ?? 0),
                    isset($body['accession_no']) ? (string) $body['accession_no'] : null,
                    $userId
                );
                $this->host->respond(true, 'ok', $collected);
                break;
            case 'lab_ops.specimen_reject':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $rejected = $this->host->svc(LabOpsOrderMetaService::class)->rejectSpecimen(
                        (int) ($body['procedure_order_id'] ?? 0),
                        (string) ($body['reason'] ?? ''),
                        isset($body['note']) ? (string) $body['note'] : null,
                        $userId
                    );
                    $this->host->respond(true, 'Specimen rejected', $rejected);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid'], 400);
                }
                break;
            case 'lab_ops.setup_status':
                $status = $this->host->svc(LabOpsSetupService::class)->getSetupStatus();
                $this->host->respond(true, 'ok', $status);
                break;
            case 'lab_ops.setup_model':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $modelResult = $this->host->svc(LabOpsSetupService::class)->setSetupModel(
                    (string) ($body['setup_model'] ?? ''),
                    $userId
                );
                $this->host->respond(true, 'ok', $modelResult);
                break;
            case 'lab_ops.provider_create':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $providerResult = $this->host->svc(LabOpsSetupService::class)->createInHouseProvider(
                    isset($body['clinic_name']) ? (string) $body['clinic_name'] : '',
                    $userId
                );
                $this->host->respond(true, 'ok', $providerResult);
                break;
            case 'lab_ops.sendout_provider_create':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $sendOutResult = $this->host->svc(LabOpsSetupService::class)->createSendOutProvider(
                    (string) ($body['lab_name'] ?? ''),
                    $userId
                );
                $this->host->respond(true, 'ok', $sendOutResult);
                break;
            case 'lab_ops.panel_import':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $providerId = $this->host->parseOptionalPositiveInt($body['provider_id'] ?? null);
                if (!empty($body['use_starter'])) {
                    $importResult = $this->host->svc(LabOpsSetupService::class)->importStarterPanel(
                        $providerId > 0 ? $providerId : null,
                        $userId
                    );
                } else {
                    $importResult = $this->host->svc(LabOpsSetupService::class)->importPanelCsv(
                        $providerId > 0 ? $providerId : null,
                        (string) ($body['csv'] ?? ''),
                        $userId
                    );
                }
                $this->host->respond(true, 'ok', $importResult);
                break;
            case 'lab_ops.fee_map_list':
                $providerId = $this->host->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null);
                $unmapped = $this->host->svc(LabOpsSetupService::class)->listUnmappedFees(
                    $providerId > 0 ? $providerId : null
                );
                $this->host->respond(true, 'ok', ['rows' => $unmapped]);
                break;
            case 'lab_ops.fee_map_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                if (!empty($body['use_starter_defaults'])) {
                    $providerId = $this->host->parseOptionalPositiveInt($body['provider_id'] ?? null);
                    $feeResult = $this->host->svc(LabOpsSetupService::class)->applyStarterFeeDefaults(
                        $providerId > 0 ? $providerId : null,
                        $userId
                    );
                } else {
                    $rows = is_array($body['rows'] ?? null) ? $body['rows'] : [];
                    $feeResult = $this->host->svc(LabOpsSetupService::class)->saveFeeMappings($rows, $userId);
                }
                $this->host->respond(true, 'ok', $feeResult);
                break;
            case 'lab_ops.qc_rules_list':
                $defaults = $this->host->svc(LabResultValidationService::class)->numericDefaults();
                $qcRows = $this->host->svc(LabQcRuleService::class)->listForEditor($defaults);
                $this->host->respond(true, 'ok', ['rows' => $qcRows]);
                break;
            case 'lab_ops.qc_rule_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $qcSaved = $this->host->svc(LabQcRuleService::class)->saveRule(
                        (string) ($body['procedure_code'] ?? ''),
                        is_array($body['fields'] ?? null) ? $body['fields'] : [],
                        $userId
                    );
                    $this->host->respond(true, 'Range saved', $qcSaved);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid'], 400);
                }
                break;
            case 'lab_ops.qc_rule_reset':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $qcReset = $this->host->svc(LabQcRuleService::class)->resetRule(
                    (string) ($body['procedure_code'] ?? ''),
                    $userId
                );
                $this->host->respond(true, 'Range reset to default', $qcReset);
                break;
            case 'lab_ops.mark_send_out':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $sendOut = $this->host->svc(LabOpsOrderMetaService::class)->markAsSendOut(
                    (int) ($body['procedure_order_id'] ?? 0),
                    $userId
                );
                $this->host->respond(true, 'ok', $sendOut);
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}

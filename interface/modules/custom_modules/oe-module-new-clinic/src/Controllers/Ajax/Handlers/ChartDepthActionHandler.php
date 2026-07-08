<?php

/**
 * mrd.* and chart_depth.* ajax actions (AUDIT-10g).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\ClinicalExportService;
use OpenEMR\Modules\NewClinic\Services\ClinicalLabsSummaryService;
use OpenEMR\Modules\NewClinic\Services\ClinicalMedsSummaryService;
use OpenEMR\Modules\NewClinic\Services\PaymentHistoryService;
use OpenEMR\Modules\NewClinic\Services\ProfilePaymentsSummaryService;
use OpenEMR\Modules\NewClinic\Services\ReferralCorrespondenceService;

final class ChartDepthActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'mrd.profile_payments_summary',
        'chart_depth.payments_list',
        'chart_depth.receipt_reprint',
        'mrd.clinical_referrals_strip',
        'mrd.clinical_labs_summary',
        'mrd.clinical_meds_summary',
        'chart_depth.export_builder',
        'chart_depth.export_generate',
        'chart_depth.referrals_list',
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
            case 'mrd.profile_payments_summary':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('mrd.profile_payments_summary', $pid);
                $this->host->assertPatientChartPid($pid);
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                $summary = $this->host->svc(ProfilePaymentsSummaryService::class)->getSummary(
                    $pid,
                    $visitId > 0 ? $visitId : null
                );
                $this->host->respond(true, 'ok', $summary);
                break;
            case 'chart_depth.payments_list':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->assertPatientChartPid($pid);
                $this->host->authorizeDeferredHandler('chart_depth.payments_list', $pid);
                $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                $limit = (int) ($_REQUEST['limit'] ?? PaymentHistoryService::PAGE_SIZE);
                $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                $filter = (string) ($_REQUEST['filter'] ?? '');
                if ($filter === '' && $visitId > 0) {
                    $filter = 'this_visit';
                }
                $list = $this->host->svc(PaymentHistoryService::class)->getPaymentsList(
                    $pid,
                    $offset,
                    $limit,
                    $visitId > 0 ? $visitId : null,
                    $filter !== '' ? $filter : 'all_visits',
                    trim((string) ($_REQUEST['date_from'] ?? '')) ?: null,
                    trim((string) ($_REQUEST['date_to'] ?? '')) ?: null,
                );
                $this->host->respond(true, 'ok', $list);
                break;
            case 'chart_depth.receipt_reprint':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $pid = (int) ($body['pid'] ?? 0);
                $receiptId = (int) ($body['receipt_id'] ?? 0);
                $this->host->authorizeDeferredHandler('chart_depth.receipt_reprint', $pid);
                $payload = $this->host->svc(PaymentHistoryService::class)->getReceiptReprintPayload($receiptId, $pid, $userId);
                $this->host->respond(true, 'ok', $payload);
                break;
            case 'mrd.clinical_referrals_strip':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('mrd.clinical_referrals_strip', $pid);
                $this->host->assertPatientChartPid($pid);
                $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                $strip = $this->host->svc(ReferralCorrespondenceService::class)->getClinicalStrip(
                    $pid,
                    $encounterId > 0 ? $encounterId : null
                );
                $this->host->respond(true, 'ok', $strip);
                break;
            case 'mrd.clinical_labs_summary':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('mrd.clinical_labs_summary', $pid);
                $this->host->assertPatientChartPid($pid);
                $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                $strip = $this->host->svc(ClinicalLabsSummaryService::class)->getClinicalStrip(
                    $pid,
                    $encounterId > 0 ? $encounterId : null
                );
                $this->host->respond(true, 'ok', $strip);
                break;
            case 'mrd.clinical_meds_summary':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('mrd.clinical_meds_summary', $pid);
                $this->host->assertPatientChartPid($pid);
                $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                $strip = $this->host->svc(ClinicalMedsSummaryService::class)->getClinicalStrip(
                    $pid,
                    $encounterId > 0 ? $encounterId : null
                );
                $this->host->respond(true, 'ok', $strip);
                break;
            case 'chart_depth.export_builder':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('chart_depth.export_builder', $pid);
                $preset = trim((string) ($_REQUEST['preset'] ?? ''));
                $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                $payload = $this->host->svc(ClinicalExportService::class)->getBuilderPayload(
                    $pid,
                    $preset !== '' ? $preset : null,
                    $encounterId > 0 ? $encounterId : null
                );
                $this->host->respond(true, 'ok', $payload);
                break;
            case 'chart_depth.export_generate':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $pid = (int) ($body['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('chart_depth.export_generate', $pid);
                $this->host->assertPatientChartPid($pid);
                $preset = trim((string) ($body['preset'] ?? ClinicalExportService::PRESET_VISIT_SUMMARY));
                $encounterId = (int) ($body['encounter_id'] ?? 0);
                $includes = is_array($body['include'] ?? null) ? $body['include'] : [];
                $normalizedIncludes = [];
                foreach ($includes as $key => $value) {
                    $normalizedIncludes[(string) $key] = !empty($value);
                }
                $result = $this->host->svc(ClinicalExportService::class)->preparePdfExport(
                    $pid,
                    $preset,
                    $encounterId > 0 ? $encounterId : null,
                    $normalizedIncludes,
                    $userId
                );
                $this->host->respond(true, 'ok', $result);
                break;
            case 'chart_depth.referrals_list':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('chart_depth.referrals_list', $pid);
                $offset = max(0, (int) ($_REQUEST['offset'] ?? 0));
                $limit = (int) ($_REQUEST['limit'] ?? ReferralCorrespondenceService::PAGE_SIZE);
                $encounterId = (int) ($_REQUEST['encounter_id'] ?? 0);
                $list = $this->host->svc(ReferralCorrespondenceService::class)->getReferralsList(
                    $pid,
                    $offset,
                    $limit,
                    $encounterId > 0 ? $encounterId : null
                );
                $this->host->respond(true, 'ok', $list);
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}

<?php

/**
 * reports.* ajax actions (AUDIT-10j).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\ReconciliationService;
use OpenEMR\Modules\NewClinic\Services\ReportHubAccessService;
use OpenEMR\Modules\NewClinic\Services\ReportHubCatalogService;
use OpenEMR\Modules\NewClinic\Services\ReportHubExportService;
use OpenEMR\Modules\NewClinic\Services\ReportsAncillaryService;
use OpenEMR\Modules\NewClinic\Services\ReportsDocumentationIntegrityService;
use OpenEMR\Modules\NewClinic\Services\ReportsSchedulingService;
use OpenEMR\Modules\NewClinic\Services\ReportsService;

final class ReportsActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'reports.daily',
        'reports.scheduling',
        'reports.ancillary',
        'reports.ancillary_export',
        'reports.documentation_integrity',
        'reports.documentation_integrity_export',
        'reports.reconciliation',
        'reports.hub_summary',
        'reports.catalog',
        'reports.run',
        'reports.export',
        'reports.export_status',
        'reports.export_download',
        'reports.export_run'
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
                case 'reports.daily':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    $report = $this->host->svc(ReportsService::class)->getDailyReport(
                        $facilityId,
                        $this->host->validDay($_REQUEST['visit_date'] ?? '', date('Y-m-d'))
                    );
                    $this->host->respond(true, 'ok', $report);
                    break;
                case 'reports.scheduling':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    $visitDate = $this->host->validDay($_REQUEST['visit_date'] ?? '', date('Y-m-d'));
                    $this->host->respond(true, 'ok', $this->host->svc(ReportsSchedulingService::class)->getReport($facilityId, $visitDate));
                    break;
                case 'reports.ancillary':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    $startDate = $this->host->validDay($_REQUEST['start_date'] ?? $_REQUEST['visit_date'] ?? '', date('Y-m-d'));
                    $endDate = $this->host->validDay($_REQUEST['end_date'] ?? '', $startDate);
                    try {
                        $this->host->respond(true, 'ok', $this->host->svc(ReportsAncillaryService::class)->getReport($facilityId, $startDate, $endDate));
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_date'], 400);
                    }
                    break;
                case 'reports.ancillary_export':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    $startDate = $this->host->validDay($_REQUEST['start_date'] ?? $_REQUEST['visit_date'] ?? '', date('Y-m-d'));
                    $endDate = $this->host->validDay($_REQUEST['end_date'] ?? '', $startDate);
                    try {
                        $export = $this->host->svc(ReportsAncillaryService::class)->exportCsv($facilityId, $startDate, $endDate);
                        $this->host->respondCsv($export['filename'], $export['content']);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_date'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
                    }
                    break;
                case 'reports.documentation_integrity':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    $startDate = $this->host->validDay($_REQUEST['start_date'] ?? $_REQUEST['visit_date'] ?? '', date('Y-m-d'));
                    $endDate = $this->host->validDay($_REQUEST['end_date'] ?? '', $startDate);
                    try {
                        $this->host->respond(true, 'ok', $this->host->svc(ReportsDocumentationIntegrityService::class)->getReport(
                            $facilityId,
                            $startDate,
                            $endDate
                        ));
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_date'], 400);
                    }
                    break;
                case 'reports.documentation_integrity_export':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    $startDate = $this->host->validDay($_REQUEST['start_date'] ?? $_REQUEST['visit_date'] ?? '', date('Y-m-d'));
                    $endDate = $this->host->validDay($_REQUEST['end_date'] ?? '', $startDate);
                    try {
                        $export = $this->host->svc(ReportsDocumentationIntegrityService::class)->exportCsv($facilityId, $startDate, $endDate);
                        $this->host->respondCsv($export['filename'], $export['content']);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_date'], 400);
                    }
                    break;
                case 'reports.reconciliation':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    $runDate = $this->host->validDay($_REQUEST['run_date'] ?? '', date('Y-m-d'));
                    $this->host->respond(true, 'ok', [
                        'latest_run' => $this->host->svc(ReconciliationService::class)->getLatestRun($facilityId),
                        'totals' => $this->host->svc(ReconciliationService::class)->fetchTotals($facilityId, $runDate),
                    ]);
                    break;
                case 'reports.hub_summary':
                    $this->host->svc(ReportHubAccessService::class)->assertHubAccess();
                    $facilityId = $this->host->resolveRequestFacilityId();
                    $visitDate = $this->host->validDay($_REQUEST['visit_date'] ?? '', date('Y-m-d'));
                    // Lightweight: 3 figures without recomputing the whole daily report
                    // (the embedded Daily Reports lens already runs the full report).
                    $this->host->respond(
                        true,
                        'ok',
                        $this->host->svc(ReportsService::class)->getHubSummary($facilityId, $visitDate)
                    );
                    break;
                case 'reports.catalog':
                    $this->host->svc(ReportHubAccessService::class)->assertHubAccess();
                    $facilityId = $this->host->resolveRequestFacilityId();
                    $lens = isset($_REQUEST['lens']) ? (string) $_REQUEST['lens'] : null;
                    if ($lens === '') {
                        $lens = null;
                    }
                    $this->host->respond(true, 'ok', $this->host->svc(ReportHubCatalogService::class)->getCatalog($lens, $facilityId));
                    break;
                case 'reports.run':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $preview = $this->host->svc(ReportHubExportService::class)->runReportPreview($body, $userId);
                        $this->host->respond(true, 'ok', $preview);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'reports.export':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $export = $this->host->svc(ReportHubExportService::class)->requestExport($body, $userId);
                        if (($export['mode'] ?? '') === 'sync') {
                            $this->host->respondCsv((string) $export['filename'], (string) $export['content']);
                        }
                        $this->host->respond(true, 'ok', $export);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'reports.export_status':
                    $this->host->requireReportHubExportAcl();
                    $jobId = (int) ($_REQUEST['job_id'] ?? 0);
                    try {
                        $status = $this->host->svc(ReportHubExportService::class)->pollExportStatus($jobId, $userId);
                        $this->host->respond(true, 'ok', $status);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'export_status'], (int) ($e->getCode() ?: 400));
                    }
                    break;
                case 'reports.export_download':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $jobId = (int) ($body['job_id'] ?? 0);
                    try {
                        $download = $this->host->svc(ReportHubExportService::class)->readExportDownload($jobId, $userId);
                        $this->host->respondCsv($download['filename'], $download['content']);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'export_download'], (int) ($e->getCode() ?: 400));
                    }
                    break;
                case 'reports.export_run':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $recorded = $this->host->svc(ReportHubExportService::class)->recordExportRun($body, $userId);
                    $this->host->respond(true, 'ok', $recorded);
                    break;

            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}

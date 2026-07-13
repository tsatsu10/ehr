<?php

/**
 * cohort.* ajax actions — M10 Patient Registry (AUDIT-10o).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\CohortSavedFilterService;
use OpenEMR\Modules\NewClinic\Services\ExportJobService;
use OpenEMR\Modules\NewClinic\Services\PatientCohortSearchService;
use OpenEMR\Modules\NewClinic\Services\RegistryAuditService;

final class CohortActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'cohort.presets',
        'cohort.search',
        'cohort.export',
        'cohort.export_status',
        'cohort.export_download',
        'cohort.saved_filter',
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
            case 'cohort.presets':
                $this->host->svc(PatientCohortSearchService::class)->assertRegistryAccess();
                $this->host->respond(true, 'ok', $this->host->svc(PatientCohortSearchService::class)->presets());
                break;
            case 'cohort.search':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(PatientCohortSearchService::class)->search($body);
                $this->host->svc(RegistryAuditService::class)->logSearch(
                    (string) ($result['meta']['filter_summary'] ?? ''),
                    (int) ($result['total'] ?? 0),
                    $userId
                );
                $this->host->respond(true, 'ok', $result);
                break;
            case 'cohort.export':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                try {
                    $export = $this->host->svc(PatientCohortSearchService::class)->requestExport($body, $userId);
                    $filters = is_array($body['filters'] ?? null) ? $body['filters'] : [];
                    if (($export['mode'] ?? '') === 'async') {
                        // SCALE-2.2 — large cohort deferred to the worker. Audit the
                        // request now (estimate); the file is built off the request path.
                        $this->host->svc(RegistryAuditService::class)->logExport(
                            $this->host->svc(PatientCohortSearchService::class)->explainCriteria($filters),
                            (int) ($export['row_count_estimate'] ?? 0),
                            $userId
                        );
                        $this->host->respond(true, 'Export queued', [
                            'mode' => 'async',
                            'job_id' => (int) $export['job_id'],
                            'row_count_estimate' => (int) ($export['row_count_estimate'] ?? 0),
                        ]);
                        break;
                    }
                    $this->host->svc(RegistryAuditService::class)->logExport(
                        $this->host->svc(PatientCohortSearchService::class)->explainCriteria($filters),
                        (int) $export['row_count'],
                        $userId
                    );
                    $this->host->respondCsv($export['filename'], $export['content']);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'export_limit'], 400);
                }
                break;
            case 'cohort.export_status':
                $jobId = (int) ($_REQUEST['job_id'] ?? 0);
                $this->host->svc(PatientCohortSearchService::class)->assertExportAccess();
                $status = $this->host->svc(ExportJobService::class)->pollStatus($jobId, $userId);
                $this->host->respond(true, 'ok', $status);
                break;
            case 'cohort.export_download':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $this->host->svc(PatientCohortSearchService::class)->assertExportAccess();
                $file = $this->host->svc(ExportJobService::class)->download((int) ($body['job_id'] ?? 0), $userId);
                $this->host->respondCsv($file['filename'], $file['content']);
                break;
            case 'cohort.saved_filter':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $operation = strtolower(trim((string) ($body['operation'] ?? 'save')));
                if ($operation === 'delete') {
                    $this->host->svc(CohortSavedFilterService::class)->delete(
                        $userId,
                        (int) ($body['id'] ?? 0)
                    );
                    $this->host->respond(true, 'ok', ['deleted' => true]);
                    break;
                }
                $saved = $this->host->svc(CohortSavedFilterService::class)->save($userId, $body);
                $this->host->respond(true, 'ok', $saved);
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}

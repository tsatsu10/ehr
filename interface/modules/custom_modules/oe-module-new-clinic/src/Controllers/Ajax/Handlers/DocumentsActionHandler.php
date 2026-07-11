<?php

/**
 * documents.* ajax actions — per-patient Documents tab + clinic-wide unfiled
 * inbox (GAP-A / A2, closes G2).
 *
 * Authorization (core patients/docs) is enforced in AjaxController::authorizeAction
 * via the 'patients_docs_acl' policy type before this handler runs. Every
 * per-patient action re-scopes to the patient (facility access); unfiled_list
 * is clinic-wide by design (it lists foreign_id = 0 rows, so there's no
 * patient to scope to) and assign_patient re-scopes to its *target* patient.
 * Writes re-check CSRF, and the upload action reads a multipart body
 * ($_POST + $_FILES) rather than JSON.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\DocumentsService;

final class DocumentsActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'documents.list',
        'documents.categories',
        'documents.upload',
        'documents.recategorize',
        'documents.delete',
        'documents.unfiled_list',
        'documents.assign_patient',
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
            case 'documents.list':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->assertPatientChartPid($pid);
                $offset = (int) ($_REQUEST['offset'] ?? 0);
                $this->host->respond(
                    true,
                    'ok',
                    $this->host->svc(DocumentsService::class)->list($pid, $offset)
                );
                break;

            case 'documents.categories':
                $this->host->respond(
                    true,
                    'ok',
                    ['categories' => $this->host->svc(DocumentsService::class)->categories()]
                );
                break;

            case 'documents.upload':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $this->host->verifyCsrf($_POST);
                $pid = (int) ($_POST['pid'] ?? 0);
                $this->host->assertPatientChartPid($pid);
                if (empty($_FILES['file']) || !is_array($_FILES['file'])) {
                    $this->host->respond(false, 'A file is required', ['code' => 'validation'], 400);
                }
                $categoryId = (int) ($_POST['category_id'] ?? 0);
                $result = $this->host->svc(DocumentsService::class)->upload(
                    $pid,
                    $categoryId,
                    $_FILES['file'],
                    $userId
                );
                $this->host->respond(true, 'Document uploaded', $result);
                break;

            case 'documents.recategorize':
                $body = $this->requirePostBody($method);
                $pid = (int) ($body['pid'] ?? 0);
                $this->host->assertPatientChartPid($pid);
                $this->host->svc(DocumentsService::class)->recategorize(
                    $pid,
                    (int) ($body['id'] ?? 0),
                    (int) ($body['category_id'] ?? 0)
                );
                $this->host->respond(true, 'Document moved');
                break;

            case 'documents.delete':
                $body = $this->requirePostBody($method);
                $pid = (int) ($body['pid'] ?? 0);
                $this->host->assertPatientChartPid($pid);
                $this->host->svc(DocumentsService::class)->delete(
                    $pid,
                    (int) ($body['id'] ?? 0)
                );
                $this->host->respond(true, 'Document deleted');
                break;

            case 'documents.unfiled_list':
                $offset = (int) ($_REQUEST['offset'] ?? 0);
                $this->host->respond(
                    true,
                    'ok',
                    $this->host->svc(DocumentsService::class)->unfiledList($offset)
                );
                break;

            case 'documents.assign_patient':
                $body = $this->requirePostBody($method);
                $targetPid = (int) ($body['pid'] ?? 0);
                $this->host->assertPatientChartPid($targetPid);
                $this->host->svc(DocumentsService::class)->assignPatient(
                    (int) ($body['id'] ?? 0),
                    $targetPid
                );
                $this->host->respond(true, 'Document assigned');
                break;

            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function requirePostBody(string $method): array
    {
        if ($method !== 'POST') {
            $this->host->respond(false, 'POST required', [], 405);
        }
        $body = $this->host->readJsonBody();
        $this->host->verifyCsrf($body);

        return $body;
    }
}

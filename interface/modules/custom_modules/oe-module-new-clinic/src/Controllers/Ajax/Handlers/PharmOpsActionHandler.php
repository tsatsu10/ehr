<?php

/**
 * pharm_ops.* ajax actions — M12 Pharmacy Ops hub (AUDIT-10q).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\PharmCatalogAdminService;
use OpenEMR\Modules\NewClinic\Services\PharmDrugMetaService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsDestroyService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsDispenseLabelService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsDispenseService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsOtcSaleService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsReceiveService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsReportsService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsRxPrintService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsSetupService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsWorklistService;

final class PharmOpsActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'pharm_ops.worklist',
        'pharm_ops.dispense_get',
        'pharm_ops.dispense_confirm',
        'pharm_ops.otc_drugs_search',
        'pharm_ops.otc_sale_get',
        'pharm_ops.otc_sale_confirm',
        'pharm_ops.receive_get',
        'pharm_ops.receive_save',
        'pharm_ops.setup_status',
        'pharm_ops.reports_embed',
        'pharm_ops.controlled_catalog',
        'pharm_ops.controlled_catalog_save',
        'pharm_ops.catalog_list',
        'pharm_ops.catalog_save',
        'pharm_ops.destroy_get',
        'pharm_ops.destroy_confirm',
        'pharm_ops.rx_print_pdf',
        'pharm_ops.dispense_label_pdf',
        'pharm_ops.warehouse_create',
        'pharm_ops.formulary_import',
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
            case 'pharm_ops.worklist':
                $body = $this->host->readRequestParams($method);
                $pharmWorklist = $this->host->svc(PharmOpsWorklistService::class)->worklist([
                    'tab' => $body['tab'] ?? PharmOpsWorklistService::TAB_PENDING_DISPENSE,
                    'date' => $body['date'] ?? '',
                    'facility_id' => $body['facility_id'] ?? 0,
                    'filters' => is_array($body['filters'] ?? null) ? $body['filters'] : [],
                    'urgent_first' => $body['urgent_first'] ?? true,
                ], $userId);
                $this->host->respond(true, 'ok', $pharmWorklist);
                break;
            case 'pharm_ops.dispense_get':
                $body = $this->host->readRequestParams($method);
                $prescriptionId = (int) ($body['prescription_id'] ?? $_REQUEST['prescription_id'] ?? 0);
                $form = $this->host->svc(PharmOpsDispenseService::class)->getDispenseForm($prescriptionId);
                $this->host->respond(true, 'ok', $form);
                break;
            case 'pharm_ops.dispense_confirm':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $confirmed = $this->host->svc(PharmOpsDispenseService::class)->confirmDispense(
                    (int) ($body['prescription_id'] ?? 0),
                    $body,
                    $userId
                );
                $this->host->respond(true, 'ok', $confirmed);
                break;
            case 'pharm_ops.otc_drugs_search':
                $body = $this->host->readRequestParams($method);
                $drugSearch = $this->host->svc(PharmOpsOtcSaleService::class)->searchDrugs(
                    (string) ($body['q'] ?? $_REQUEST['q'] ?? ''),
                    (int) ($body['limit'] ?? 20)
                );
                $this->host->respond(true, 'ok', $drugSearch);
                break;
            case 'pharm_ops.otc_sale_get':
                $body = $this->host->readRequestParams($method);
                $otcForm = $this->host->svc(PharmOpsOtcSaleService::class)->getSaleForm(
                    (int) ($body['pid'] ?? 0),
                    (int) ($body['drug_id'] ?? 0),
                    isset($body['encounter_id']) ? (int) $body['encounter_id'] : null
                );
                $this->host->respond(true, 'ok', $otcForm);
                break;
            case 'pharm_ops.otc_sale_confirm':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $otcSale = $this->host->svc(PharmOpsOtcSaleService::class)->confirmSale($body, $userId);
                $this->host->respond(true, 'ok', $otcSale);
                break;
            case 'pharm_ops.receive_get':
                $body = $this->host->readRequestParams($method);
                $receiveForm = $this->host->svc(PharmOpsReceiveService::class)->getReceiveForm(
                    isset($body['drug_id']) ? (int) $body['drug_id'] : null
                );
                $this->host->respond(true, 'ok', $receiveForm);
                break;
            case 'pharm_ops.receive_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $received = $this->host->svc(PharmOpsReceiveService::class)->saveReceive($body, $userId);
                $this->host->respond(true, 'ok', $received);
                break;
            case 'pharm_ops.setup_status':
                $setupStatus = $this->host->svc(PharmOpsSetupService::class)->getSetupStatus();
                $this->host->respond(true, 'ok', $setupStatus);
                break;
            case 'pharm_ops.reports_embed':
                $reportsEmbed = $this->host->svc(PharmOpsReportsService::class)->embedCatalog();
                $this->host->respond(true, 'ok', $reportsEmbed);
                break;
            case 'pharm_ops.controlled_catalog':
                (new PharmOpsAccessService())->assertCatalogAccess();
                $controlledCatalog = [
                    'drugs' => $this->host->svc(PharmDrugMetaService::class)->listActiveCatalogFlags(),
                ];
                $this->host->respond(true, 'ok', $controlledCatalog);
                break;
            case 'pharm_ops.controlled_catalog_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                (new PharmOpsAccessService())->assertCatalogAccess();
                $saved = $this->host->svc(PharmDrugMetaService::class)->saveControlledFlags($body['drugs'] ?? []);
                $this->host->respond(true, 'ok', [
                    'saved' => $saved,
                    'drugs' => $this->host->svc(PharmDrugMetaService::class)->listActiveCatalogFlags(),
                ]);
                break;
            case 'pharm_ops.catalog_list':
                (new PharmOpsAccessService())->assertCatalogAccess();
                $this->host->respond(true, 'ok', $this->host->svc(PharmCatalogAdminService::class)
                    ->getCatalog((string) ($_REQUEST['q'] ?? '')));
                break;
            case 'pharm_ops.catalog_save':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                (new PharmOpsAccessService())->assertCatalogAccess();
                try {
                    $payload = $this->host->svc(PharmCatalogAdminService::class)
                        ->saveDrug((array) ($body['drug'] ?? []), $userId);
                    $this->host->respond(true, 'Drug saved', $payload);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid'], 400);
                }
                break;
            case 'pharm_ops.destroy_get':
                $body = $this->host->readRequestParams($method);
                $destroyForm = $this->host->svc(PharmOpsDestroyService::class)->getDestroyForm(
                    (int) ($body['drug_id'] ?? 0),
                    (int) ($body['inventory_id'] ?? 0)
                );
                $this->host->respond(true, 'ok', $destroyForm);
                break;
            case 'pharm_ops.destroy_confirm':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $destroyed = $this->host->svc(PharmOpsDestroyService::class)->confirmDestroy($body, $userId);
                $this->host->respond(true, 'ok', $destroyed);
                break;
            case 'pharm_ops.rx_print_pdf':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $rxPrint = $this->host->svc(PharmOpsRxPrintService::class)->preparePrint(
                    (int) ($body['prescription_id'] ?? 0),
                    $userId
                );
                $this->host->respond(true, 'ok', $rxPrint);
                break;
            case 'pharm_ops.dispense_label_pdf':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $labelPrint = $this->host->svc(PharmOpsDispenseLabelService::class)->preparePrint(
                    (int) ($body['sale_id'] ?? 0),
                    $userId
                );
                $this->host->respond(true, 'ok', $labelPrint);
                break;
            case 'pharm_ops.warehouse_create':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $warehouse = $this->host->svc(PharmOpsSetupService::class)->createDefaultWarehouse(
                    (string) ($body['warehouse_title'] ?? ''),
                    $userId
                );
                $this->host->respond(true, 'ok', $warehouse);
                break;
            case 'pharm_ops.formulary_import':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $imported = $this->host->svc(PharmOpsSetupService::class)->importStarterFormulary(
                    !empty($body['use_starter']) ? null : (string) ($body['csv'] ?? ''),
                    $userId
                );
                $this->host->respond(true, 'ok', $imported);
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}

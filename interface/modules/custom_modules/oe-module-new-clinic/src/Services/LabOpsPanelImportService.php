<?php

/**
 * M12 — import OPD lab panel CSV into procedure_type
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class LabOpsPanelImportService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array{imported_orders: int, imported_results: int, skipped: int}
     */
    public function importCsvContent(int $providerId, string $csvContent, int $actorUserId): array
    {
        if ($providerId <= 0) {
            throw new \InvalidArgumentException('Lab provider id is required');
        }

        $provider = QueryUtils::querySingleRow(
            'SELECT ppid, name FROM procedure_providers WHERE ppid = ? AND active = 1',
            [$providerId]
        );
        if (!is_array($provider) || empty($provider['ppid'])) {
            throw new \RuntimeException('Lab provider not found', 404);
        }

        $groupId = $this->ensurePanelGroup((int) $provider['ppid'], (string) ($provider['name'] ?? 'Clinic Lab'));
        $lines = $this->parseCsv($csvContent);

        $importedOrders = 0;
        $importedResults = 0;
        $skipped = 0;
        $seenOrders = [];

        foreach ($lines as $line) {
            $orderCode = $line['order_code'];
            if ($orderCode === '') {
                $skipped++;
                continue;
            }

            if (!isset($seenOrders[$orderCode])) {
                $orderTypeId = $this->upsertOrderType(
                    $groupId,
                    $providerId,
                    $orderCode,
                    $line['order_name']
                );
                $seenOrders[$orderCode] = $orderTypeId;
                $importedOrders++;
            }

            $orderTypeId = $seenOrders[$orderCode];
            if ($this->upsertResultType($orderTypeId, $providerId, $line['result_code'], $line['result_name'])) {
                $importedResults++;
            }
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId();
        $this->config->set('lab_inhouse_provider_id', (string) $providerId, $facilityId);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'lab_ops.panel_imported',
            $actorUserId,
            1,
            'provider_id=' . $providerId . ' orders=' . $importedOrders . ' results=' . $importedResults
        );

        return [
            'imported_orders' => $importedOrders,
            'imported_results' => $importedResults,
            'skipped' => $skipped,
        ];
    }

    public function importStarterPack(int $providerId, int $actorUserId): array
    {
        $path = dirname(__DIR__, 6) . '/Documentation/NewClinic/samples/opd_lab_panel_starter.csv';
        if (!is_readable($path)) {
            throw new \RuntimeException('Starter panel CSV not found');
        }

        $content = (string) file_get_contents($path);

        return $this->importCsvContent($providerId, $content, $actorUserId);
    }

    private function ensurePanelGroup(int $providerId, string $providerName): int
    {
        $groupName = mb_substr($providerName . ' OPD Panel', 0, 63);
        $existing = QueryUtils::querySingleRow(
            "SELECT procedure_type_id FROM procedure_type
             WHERE lab_id = ? AND parent = 0 AND procedure_type = 'grp' AND name = ?
             ORDER BY procedure_type_id DESC LIMIT 1",
            [$providerId, $groupName]
        );

        if (is_array($existing) && !empty($existing['procedure_type_id'])) {
            return (int) $existing['procedure_type_id'];
        }

        return QueryUtils::sqlInsert(
            "INSERT INTO procedure_type
             (parent, name, lab_id, procedure_code, procedure_type, activity)
             VALUES (0, ?, ?, ?, 'grp', 1)",
            [$groupName, $providerId, 'OPD_PANEL']
        );
    }

    private function upsertOrderType(int $groupId, int $providerId, string $code, string $name): int
    {
        $row = QueryUtils::querySingleRow(
            "SELECT procedure_type_id FROM procedure_type
             WHERE parent = ? AND procedure_code = ? AND procedure_type = 'ord'
             ORDER BY procedure_type_id DESC LIMIT 1",
            [$groupId, $code]
        );

        if (is_array($row) && !empty($row['procedure_type_id'])) {
            QueryUtils::sqlStatementThrowException(
                "UPDATE procedure_type SET name = ?, lab_id = ?, activity = 1
                 WHERE procedure_type_id = ?",
                [$name, $providerId, (int) $row['procedure_type_id']]
            );

            return (int) $row['procedure_type_id'];
        }

        return QueryUtils::sqlInsert(
            "INSERT INTO procedure_type
             (parent, name, lab_id, procedure_code, procedure_type, activity)
             VALUES (?, ?, ?, ?, 'ord', 1)",
            [$groupId, $name, $providerId, $code]
        );
    }

    private function upsertResultType(int $orderTypeId, int $providerId, string $code, string $name): bool
    {
        if ($code === '') {
            return false;
        }

        $row = QueryUtils::querySingleRow(
            "SELECT procedure_type_id FROM procedure_type
             WHERE parent = ? AND procedure_code = ? AND procedure_type = 'res'
             ORDER BY procedure_type_id DESC LIMIT 1",
            [$orderTypeId, $code]
        );

        if (is_array($row) && !empty($row['procedure_type_id'])) {
            QueryUtils::sqlStatementThrowException(
                "UPDATE procedure_type SET name = ?, lab_id = ?, activity = 1
                 WHERE procedure_type_id = ?",
                [$name, $providerId, (int) $row['procedure_type_id']]
            );

            return true;
        }

        QueryUtils::sqlInsert(
            "INSERT INTO procedure_type
             (parent, name, lab_id, procedure_code, procedure_type, activity)
             VALUES (?, ?, ?, ?, 'res', 1)",
            [$orderTypeId, $name, $providerId, $code]
        );

        return true;
    }

    /**
     * @return array<int, array{order_code: string, order_name: string, result_code: string, result_name: string}>
     */
    private function parseCsv(string $csvContent): array
    {
        $lines = [];
        $handle = fopen('php://memory', 'r+');
        if ($handle === false) {
            throw new \RuntimeException('Unable to parse CSV');
        }

        fwrite($handle, $csvContent);
        rewind($handle);

        while (($row = fgetcsv($handle)) !== false) {
            if (count($row) < 4) {
                continue;
            }
            if (trim((string) $row[0]) === 'Order Code') {
                continue;
            }

            $lines[] = [
                'order_code' => trim((string) $row[0]),
                'order_name' => trim((string) $row[1]),
                'result_code' => trim((string) $row[2]),
                'result_name' => trim((string) $row[3]),
            ];
        }

        fclose($handle);

        return $lines;
    }
}

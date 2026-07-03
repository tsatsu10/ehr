<?php

/**
 * M13 — import OPD formulary CSV into drugs / templates / prices
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class PharmOpsFormularyImportService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public static function starterCsvPath(): string
    {
        return dirname(__DIR__, 6) . '/Documentation/NewClinic/samples/opd_formulary_starter.csv';
    }

    /**
     * @return array{imported: int, updated: int, skipped: int, drug_count: int}
     */
    public function importCsvContent(string $csvContent, int $actorUserId): array
    {
        if (trim($csvContent) === '') {
            throw new \InvalidArgumentException('CSV content is empty');
        }

        $lines = $this->parseCsv($csvContent);
        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $priceLevel = (string) ($GLOBALS['default_price_level'] ?? 'standard');

        foreach ($lines as $line) {
            $name = $line['drug_name'];
            if ($name === '') {
                $skipped++;
                continue;
            }

            $existing = QueryUtils::querySingleRow(
                'SELECT drug_id FROM drugs WHERE name = ? AND form = ? AND size = ? LIMIT 1',
                [$name, $line['form'], $line['strength']]
            );

            if (is_array($existing)) {
                $drugId = (int) ($existing['drug_id'] ?? 0);
                if ($drugId > 0) {
                    QueryUtils::sqlStatementThrowException(
                        'UPDATE drugs SET reorder_point = ?, route = ?, active = 1, dispensable = 1 WHERE drug_id = ?',
                        [$line['reorder_point'], $line['route'], $drugId]
                    );
                    $this->ensureBasePrice($drugId, $line['fee_amount'], $priceLevel);
                    $this->ensureTemplate($drugId, $name, $line);
                    $updated++;
                } else {
                    $skipped++;
                }
                continue;
            }

            $drugId = (int) QueryUtils::sqlInsert(
                'INSERT INTO drugs (
                    name, ndc_number, drug_code, on_order, reorder_point, max_level, form,
                    size, unit, route, cyp_factor, related_code,
                    dispensable, allow_multiple, allow_combining, active, consumable
                 ) VALUES (?, ?, ?, 0, ?, 0, ?, ?, ?, ?, 0, ?, 1, 1, 1, 1, 0)',
                [
                    $name,
                    '',
                    $this->buildDrugCode($name),
                    $line['reorder_point'],
                    $line['form'],
                    $line['strength'],
                    $line['unit'],
                    $line['route'],
                    '',
                ]
            );
            $this->ensureBasePrice($drugId, $line['fee_amount'], $priceLevel);
            $this->ensureTemplate($drugId, $name, $line);
            $imported++;
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy_ops.formulary_imported',
            $actorUserId,
            1,
            'imported=' . $imported . ' updated=' . $updated . ' skipped=' . $skipped
        );

        $drugCount = $this->countActiveDispensableDrugs();

        return [
            'imported' => $imported,
            'updated' => $updated,
            'skipped' => $skipped,
            'drug_count' => $drugCount,
        ];
    }

    public function countActiveDispensableDrugs(): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS cnt FROM drugs WHERE active = 1 AND dispensable = 1'
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function parseCsv(string $csvContent): array
    {
        $rows = [];
        $handle = fopen('php://memory', 'r+b');
        if ($handle === false) {
            throw new \RuntimeException('Could not parse CSV');
        }
        fwrite($handle, $csvContent);
        rewind($handle);

        $header = null;
        while (($data = fgetcsv($handle)) !== false) {
            if ($header === null) {
                $header = array_map(static fn ($col) => strtolower(trim((string) $col)), $data);
                continue;
            }
            if (count(array_filter($data, static fn ($v) => trim((string) $v) !== '')) === 0) {
                continue;
            }
            $assoc = [];
            foreach ($header as $idx => $key) {
                $assoc[$key] = trim((string) ($data[$idx] ?? ''));
            }
            $rows[] = [
                'drug_name' => $assoc['drug_name'] ?? '',
                'generic_name' => $assoc['generic_name'] ?? '',
                'form' => $assoc['form'] ?? '',
                'strength' => $assoc['strength'] ?? '',
                'unit' => $assoc['unit'] ?? '',
                'route' => $assoc['route'] ?? '',
                'dosage_text' => $assoc['dosage_text'] ?? '',
                'period_days' => $assoc['period_days'] ?? '',
                'quantity' => $assoc['quantity'] ?? '',
                'reorder_point' => (int) round((float) ($assoc['reorder_point'] ?? 0)),
                'fee_amount' => (float) ($assoc['fee_amount'] ?? 0),
                'eml_category' => $assoc['eml_category'] ?? '',
            ];
        }
        fclose($handle);

        return $rows;
    }

    /**
     * @param array<string, mixed> $line
     */
    private function ensureTemplate(int $drugId, string $selector, array $line): void
    {
        $existing = QueryUtils::querySingleRow(
            'SELECT drug_id FROM drug_templates WHERE drug_id = ? AND selector = ? LIMIT 1',
            [$drugId, $selector]
        );
        if (is_array($existing)) {
            return;
        }

        QueryUtils::sqlInsert(
            'INSERT INTO drug_templates (drug_id, selector, dosage, period, quantity, refills, taxrates, pkgqty)
             VALUES (?, ?, ?, ?, ?, 0, ?, 1.0)',
            [
                $drugId,
                $selector,
                $line['dosage_text'],
                $line['period_days'],
                $line['quantity'],
                '',
            ]
        );
    }

    private function ensureBasePrice(int $drugId, float $feeAmount, string $priceLevel): void
    {
        $existing = QueryUtils::querySingleRow(
            "SELECT pr_price FROM prices WHERE pr_id = ? AND pr_selector = '' AND pr_level = ? LIMIT 1",
            [$drugId, $priceLevel]
        );
        if (is_array($existing)) {
            QueryUtils::sqlStatementThrowException(
                "UPDATE prices SET pr_price = ? WHERE pr_id = ? AND pr_selector = '' AND pr_level = ?",
                [$feeAmount, $drugId, $priceLevel]
            );
            return;
        }

        QueryUtils::sqlInsert(
            "INSERT INTO prices (pr_id, pr_selector, pr_level, pr_price) VALUES (?, '', ?, ?)",
            [$drugId, $priceLevel, $feeAmount]
        );
    }

    private function buildDrugCode(string $name): string
    {
        $code = strtolower(preg_replace('/[^a-z0-9]+/i', '_', $name) ?? '');
        $code = trim($code, '_');

        return mb_substr($code !== '' ? $code : 'drug', 0, 31);
    }
}

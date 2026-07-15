<?php

/**
 * Seed the New Clinic pharmacy with a realistic West-Africa OPD formulary + stock lots.
 *
 * What it does (idempotent — safe to re-run):
 *   1. Imports/updates a ~40-item essential-medicines formulary via the real importer
 *      (creates drugs + base prices + dispense templates).
 *   2. Ensures a dispensary + bulk-store warehouse exist.
 *   3. Removes only THIS script's previous seed (drug_inventory.vendor_id / drug_sales.distributor_id
 *      = SEED_MARKER) and the leftover E2E write-off junk lots — never touches real dispense history
 *      or the golden-path E2E fixture (inventory_id = 1).
 *   4. Seeds realistic lots per drug (lot numbers, regional manufacturers, staggered expiries,
 *      quantities relative to each drug's reorder point) plus the matching "purchase" ledger rows,
 *      so the stock browser, reorder report, expiry filters, and transactions view all look real.
 *
 * Run:  C:\xampp\php\php.exe interface/modules/custom_modules/oe-module-new-clinic/scripts/seed-pharmacy-inventory.php
 *
 * @package OpenEMR\Modules\NewClinic
 */

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\PharmOpsFormularyImportService;

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

$_GET['site'] = $_GET['site'] ?? 'default';
$ignoreAuth = true;
$sessionAllowWrite = true;

require_once dirname(__DIR__, 4) . '/globals.php';

// Minimal admin context for the importer's audit log.
$_SESSION['authUser'] = $_SESSION['authUser'] ?? 'Adminstrator';
$_SESSION['authUserID'] = $_SESSION['authUserID'] ?? 1;
$actorUserId = (int) ($_SESSION['authUserID'] ?? 1);

const SEED_MARKER = 999001;          // vendor_id / distributor_id tag for this script's rows
const DISPENSARY = 'onsite';         // existing warehouse (dispensing shelf)
const STORE = 'store';               // bulk store (added below)

/**
 * Formulary — realistic private cash-clinic OPD essentials (primary market: West Africa).
 * Columns mirror the starter CSV. `stock` drives the lot profile (see lotPlan()).
 * fee_amount is the cash selling price in GH₵.
 */
$formulary = [
    // name, generic, form, strength, unit, route, dosage, period_days, qty, reorder, fee, category, stock
    ['Amoxicillin', 'Amoxicillin', 'Capsule', '500', 'mg', 'oral', '500 mg PO TID', 7, 21, 50, 18.00, 'Antibiotic', 'healthy2'],
    ['Amoxicillin-Clavulanate', 'Co-amoxiclav', 'Tablet', '625', 'mg', 'oral', '625 mg PO BD', 7, 14, 30, 45.00, 'Antibiotic', 'healthy'],
    ['Ampicillin-Cloxacillin', 'Ampiclox', 'Capsule', '500', 'mg', 'oral', '500 mg PO QID', 5, 20, 30, 22.00, 'Antibiotic', 'low'],
    ['Ciprofloxacin', 'Ciprofloxacin', 'Tablet', '500', 'mg', 'oral', '500 mg PO BD', 5, 10, 40, 20.00, 'Antibiotic', 'healthy'],
    ['Azithromycin', 'Azithromycin', 'Tablet', '500', 'mg', 'oral', '500 mg PO OD', 3, 3, 25, 35.00, 'Antibiotic', 'near'],
    ['Metronidazole', 'Metronidazole', 'Tablet', '400', 'mg', 'oral', '400 mg PO TID', 7, 21, 40, 12.00, 'Antibiotic', 'healthy'],
    ['Cotrimoxazole', 'Sulfamethoxazole-Trimethoprim', 'Tablet', '960', 'mg', 'oral', '960 mg PO BD', 5, 10, 40, 10.00, 'Antibiotic', 'healthy'],
    ['Doxycycline', 'Doxycycline', 'Capsule', '100', 'mg', 'oral', '100 mg PO BD', 7, 14, 30, 16.00, 'Antibiotic', 'healthy'],
    ['Cefuroxime', 'Cefuroxime', 'Tablet', '500', 'mg', 'oral', '500 mg PO BD', 7, 14, 20, 55.00, 'Antibiotic', 'low'],
    ['Erythromycin', 'Erythromycin', 'Tablet', '250', 'mg', 'oral', '250 mg PO QID', 5, 20, 20, 24.00, 'Antibiotic', 'healthy'],
    ['Ceftriaxone Injection', 'Ceftriaxone', 'Injection', '1', 'g', 'injection', '1 g IV/IM OD', 3, 3, 15, 40.00, 'Antibiotic', 'healthy'],

    ['Artemether-Lumefantrine', 'Artemether-Lumefantrine', 'Tablet', '20/120', 'mg', 'oral', '4 tabs BD x 3 days', 3, 24, 30, 25.00, 'Antimalarial', 'healthy2'],
    ['Dihydroartemisinin-Piperaquine', 'DHA-Piperaquine', 'Tablet', '40/320', 'mg', 'oral', 'OD x 3 days', 3, 9, 25, 30.00, 'Antimalarial', 'healthy'],
    ['Sulfadoxine-Pyrimethamine', 'SP', 'Tablet', '500/25', 'mg', 'oral', '3 tabs stat (IPTp)', 1, 3, 30, 8.00, 'Antimalarial', 'healthy'],
    ['Artesunate Injection', 'Artesunate', 'Injection', '60', 'mg', 'injection', 'IV per weight', 1, 3, 12, 45.00, 'Antimalarial', 'near'],
    ['Quinine', 'Quinine Sulfate', 'Tablet', '300', 'mg', 'oral', '600 mg PO TID', 7, 21, 20, 15.00, 'Antimalarial', 'low'],

    ['Paracetamol', 'Paracetamol', 'Tablet', '500', 'mg', 'oral', '500 mg PO QID PRN', 5, 20, 100, 5.00, 'Analgesic', 'healthy2'],
    ['Paracetamol Syrup', 'Paracetamol', 'Syrup', '120/5', 'mg', 'oral', '10 mL PO QID PRN', 5, 1, 40, 12.00, 'Analgesic', 'healthy'],
    ['Ibuprofen', 'Ibuprofen', 'Tablet', '400', 'mg', 'oral', '400 mg PO TID PRN', 5, 15, 60, 8.00, 'Analgesic', 'healthy'],
    ['Diclofenac', 'Diclofenac', 'Tablet', '50', 'mg', 'oral', '50 mg PO BD PRN', 5, 10, 50, 9.00, 'Analgesic', 'healthy'],
    ['Diclofenac Injection', 'Diclofenac', 'Injection', '75', 'mg', 'injection', '75 mg IM stat', 1, 1, 20, 14.00, 'Analgesic', 'expired'],
    ['Tramadol', 'Tramadol', 'Capsule', '50', 'mg', 'oral', '50 mg PO BD PRN', 5, 10, 20, 18.00, 'Analgesic', 'low'],

    ['Amlodipine', 'Amlodipine', 'Tablet', '5', 'mg', 'oral', '5 mg PO OD', 30, 30, 40, 10.00, 'Cardiovascular', 'healthy2'],
    ['Amlodipine', 'Amlodipine', 'Tablet', '10', 'mg', 'oral', '10 mg PO OD', 30, 30, 30, 13.00, 'Cardiovascular', 'healthy'],
    ['Lisinopril', 'Lisinopril', 'Tablet', '10', 'mg', 'oral', '10 mg PO OD', 30, 30, 30, 16.00, 'Cardiovascular', 'healthy'],
    ['Losartan', 'Losartan', 'Tablet', '50', 'mg', 'oral', '50 mg PO OD', 30, 30, 30, 20.00, 'Cardiovascular', 'near'],
    ['Hydrochlorothiazide', 'Hydrochlorothiazide', 'Tablet', '25', 'mg', 'oral', '25 mg PO OD', 30, 30, 30, 7.00, 'Cardiovascular', 'healthy'],
    ['Bendroflumethiazide', 'Bendroflumethiazide', 'Tablet', '2.5', 'mg', 'oral', '2.5 mg PO OD', 30, 30, 30, 6.00, 'Cardiovascular', 'healthy'],
    ['Methyldopa', 'Methyldopa', 'Tablet', '250', 'mg', 'oral', '250 mg PO BD', 30, 60, 25, 18.00, 'Cardiovascular', 'out'],
    ['Atenolol', 'Atenolol', 'Tablet', '50', 'mg', 'oral', '50 mg PO OD', 30, 30, 25, 9.00, 'Cardiovascular', 'healthy'],

    ['Metformin', 'Metformin', 'Tablet', '500', 'mg', 'oral', '500 mg PO BD', 30, 60, 40, 10.00, 'Endocrine', 'healthy2'],
    ['Glibenclamide', 'Glibenclamide', 'Tablet', '5', 'mg', 'oral', '5 mg PO OD', 30, 30, 30, 8.00, 'Endocrine', 'healthy'],

    ['Omeprazole', 'Omeprazole', 'Capsule', '20', 'mg', 'oral', '20 mg PO OD', 14, 14, 30, 15.00, 'Gastrointestinal', 'healthy'],
    ['Magnesium Trisilicate', 'Magnesium Trisilicate', 'Tablet', '500', 'mg', 'oral', '2 tabs PO TID PRN', 7, 42, 30, 6.00, 'Gastrointestinal', 'healthy'],
    ['Hyoscine Butylbromide', 'Hyoscine Butylbromide', 'Tablet', '10', 'mg', 'oral', '10 mg PO TID PRN', 3, 9, 25, 12.00, 'Gastrointestinal', 'low'],
    ['ORS', 'Oral rehydration salts', 'Sachet', '1', 'sachet', 'oral', '1 sachet in 1 L water', 1, 5, 40, 3.00, 'Gastrointestinal', 'healthy'],
    ['Zinc Sulfate', 'Zinc Sulfate', 'Tablet', '20', 'mg', 'oral', '20 mg PO OD x 10 days', 10, 10, 30, 5.00, 'Gastrointestinal', 'healthy'],
    ['Loperamide', 'Loperamide', 'Capsule', '2', 'mg', 'oral', '2 mg PO after each stool', 2, 8, 20, 9.00, 'Gastrointestinal', 'near'],

    ['Salbutamol Inhaler', 'Salbutamol', 'Inhaler', '100', 'mcg', 'inhalation', '2 puffs PRN', 30, 1, 15, 35.00, 'Respiratory', 'healthy'],
    ['Salbutamol Syrup', 'Salbutamol', 'Syrup', '2/5', 'mg', 'oral', '5 mL PO TID', 7, 1, 20, 14.00, 'Respiratory', 'healthy'],
    ['Cetirizine', 'Cetirizine', 'Tablet', '10', 'mg', 'oral', '10 mg PO OD', 7, 7, 40, 6.00, 'Antihistamine', 'healthy'],
    ['Chlorpheniramine', 'Chlorpheniramine', 'Tablet', '4', 'mg', 'oral', '4 mg PO TID PRN', 5, 15, 40, 4.00, 'Antihistamine', 'healthy'],
    ['Prednisolone', 'Prednisolone', 'Tablet', '5', 'mg', 'oral', 'per taper', 7, 20, 25, 8.00, 'Steroid', 'healthy'],

    ['Ferrous Sulfate + Folic Acid', 'Ferrous Sulfate-Folic Acid', 'Tablet', '200/0.4', 'mg', 'oral', '1 tab PO OD', 30, 30, 60, 6.00, 'Haematinic', 'healthy2'],
    ['Folic Acid', 'Folic Acid', 'Tablet', '5', 'mg', 'oral', '5 mg PO OD', 30, 30, 40, 4.00, 'Haematinic', 'healthy'],
    ['Vitamin B Complex', 'Vitamin B Complex', 'Tablet', '1', 'tab', 'oral', '1 tab PO OD', 30, 30, 40, 5.00, 'Supplement', 'healthy'],
    ['Multivitamin', 'Multivitamin', 'Tablet', '1', 'tab', 'oral', '1 tab PO OD', 30, 30, 40, 6.00, 'Supplement', 'healthy'],

    ['Albendazole', 'Albendazole', 'Tablet', '400', 'mg', 'oral', '400 mg PO stat', 1, 1, 40, 5.00, 'Anthelmintic', 'healthy'],
    ['Mebendazole', 'Mebendazole', 'Tablet', '100', 'mg', 'oral', '100 mg PO BD x 3 days', 3, 6, 30, 5.00, 'Anthelmintic', 'low'],

    ['Fluconazole', 'Fluconazole', 'Capsule', '150', 'mg', 'oral', '150 mg PO stat', 1, 1, 25, 12.00, 'Antifungal', 'healthy'],
    ['Clotrimazole Cream', 'Clotrimazole', 'Cream', '1', 'percent', 'topical', 'Apply BD', 14, 1, 25, 14.00, 'Antifungal', 'healthy'],
    ['Chlorhexidine', 'Chlorhexidine', 'Solution', '0.2', 'percent', 'topical', 'Apply BD', 7, 1, 15, 12.00, 'Topical', 'healthy'],
    ['Hydrocortisone Cream', 'Hydrocortisone', 'Cream', '1', 'percent', 'topical', 'Apply BD', 14, 1, 20, 16.00, 'Topical', 'healthy'],
];

$manufacturers = [
    'KAM' => 'Kama Industries', 'ERN' => 'Ernest Chemists', 'DAN' => 'Danadams Pharma',
    'LET' => 'Letap Pharmaceuticals', 'AYR' => 'Ayrton Drug', 'PHY' => 'Phyto-Riker (GIHOC)',
    'TOB' => 'Tobinco Pharmaceuticals', 'PHN' => 'Pharmanova', 'KIN' => 'Kinapharma',
    'STA' => 'Starwin Products', 'CIP' => 'Cipla', 'EMZ' => 'Emzor Pharmaceuticals',
    'FID' => 'Fidson Healthcare', 'DNK' => 'Denk Pharma',
];
$mfrKeys = array_keys($manufacturers);

echo "New Clinic — pharmacy inventory seed\n";
echo str_repeat('-', 44) . "\n";

// --- 1. Warehouses -----------------------------------------------------------
ensureWarehouse(DISPENSARY, 'Main dispensary', 5);
ensureWarehouse(STORE, 'Bulk store', 6);
echo "[ok] warehouses ready (dispensary + bulk store)\n";

// --- 2. Formulary via the real importer -------------------------------------
$csv = "drug_name,generic_name,form,strength,unit,route,dosage_text,period_days,quantity,reorder_point,fee_amount,eml_category\n";
foreach ($formulary as $d) {
    $csv .= implode(',', [
        $d[0], $d[1], $d[2], $d[3], $d[4], $d[5], '"' . $d[6] . '"',
        $d[7], $d[8], $d[9], number_format($d[10], 2, '.', ''), $d[11],
    ]) . "\n";
}
$importer = new PharmOpsFormularyImportService();
$result = $importer->importCsvContent($csv, $actorUserId);
echo "[ok] formulary imported: {$result['imported']} new, {$result['updated']} updated, "
    . "{$result['drug_count']} dispensable total\n";

// Retire the legacy bare "Salbutamol" inhaler from the 10-item starter — superseded here by the
// clearer "Salbutamol Inhaler" / "Salbutamol Syrup" entries, so it doesn't linger as a phantom SKU.
QueryUtils::sqlStatementThrowException(
    "UPDATE drugs SET active = 0, dispensable = 0 WHERE name = 'Salbutamol' AND form = 'Inhaler'"
);

// --- 3. Clean prior seed + E2E write-off junk (never real history) ----------
$delSales = QueryUtils::sqlStatementThrowException(
    'DELETE FROM drug_sales WHERE distributor_id = ?',
    [SEED_MARKER]
);
$delLots = QueryUtils::sqlStatementThrowException(
    'DELETE FROM drug_inventory WHERE vendor_id = ?',
    [SEED_MARKER]
);
// Remove regenerable E2E / pilot fixture lots that are NOT referenced by real dispense history.
// The golden-path fixture that dispense rows point to is preserved; E2E prep re-creates the rest.
$junkLots = QueryUtils::fetchRecords(
    "SELECT inventory_id FROM drug_inventory di
     WHERE di.vendor_id = 0
       AND (di.lot_number LIKE 'E2E-%' OR di.lot_number LIKE 'PILOT-%'
            OR di.manufacturer IN ('Pilot Seed', 'E2E Seed'))
       AND NOT EXISTS (
           SELECT 1 FROM drug_sales ds WHERE ds.inventory_id = di.inventory_id AND ds.pid > 0
       )"
) ?: [];
foreach ($junkLots as $junk) {
    $invId = (int) ($junk['inventory_id'] ?? 0);
    if ($invId <= 0) {
        continue;
    }
    QueryUtils::sqlStatementThrowException('DELETE FROM drug_sales WHERE inventory_id = ?', [$invId]);
    QueryUtils::sqlStatementThrowException('DELETE FROM drug_inventory WHERE inventory_id = ?', [$invId]);
}
echo '[ok] cleared previous seed + ' . count($junkLots) . " unreferenced E2E/pilot fixture lots\n";

// --- 4. Seed realistic lots + purchase ledger --------------------------------
$today = new DateTimeImmutable('today');
$lotCount = 0;
$unitTotal = 0;
$i = 0;
foreach ($formulary as $d) {
    $name = $d[0];
    $form = $d[2];
    $size = $d[3];
    $reorder = (int) $d[9];
    $sellPrice = (float) $d[10];
    $stock = $d[12];

    $drugId = findDrugId($name, $form, $size);
    if ($drugId <= 0) {
        echo "  ! skipped (no drug row): {$name} {$size}{$d[4]}\n";
        $i++;
        continue;
    }

    $mfr = $manufacturers[$mfrKeys[$i % count($mfrKeys)]];
    $mfrPrefix = $mfrKeys[$i % count($mfrKeys)];

    foreach (lotPlan($stock, $reorder, $today) as $lotIdx => $plan) {
        $lotNumber = sprintf('%s%s%02d', $mfrPrefix, date('y', $today->getTimestamp()), ($drugId % 90) + $lotIdx + 1);
        $lotNumber = substr($lotNumber . chr(65 + ($drugId % 26)), 0, 20);
        $qty = $plan['qty'];
        $expiration = $plan['exp'];
        $warehouse = $plan['warehouse'];
        $receivedOn = $plan['received'];
        $unitCost = round($sellPrice * 0.6, 2);

        $inventoryId = (int) QueryUtils::sqlInsert(
            'INSERT INTO drug_inventory
                (drug_id, lot_number, manufacturer, expiration, vendor_id, warehouse_id, on_hand)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$drugId, $lotNumber, $mfr, $expiration, SEED_MARKER, $warehouse, $qty]
        );

        // Matching purchase ledger row (trans_type 2 = purchase; qty/fee negative like a receive).
        QueryUtils::sqlInsert(
            'INSERT INTO drug_sales
                (drug_id, inventory_id, prescription_id, pid, encounter, user, sale_date,
                 quantity, fee, xfer_inventory_id, distributor_id, notes, trans_type)
             VALUES (?, ?, 0, 0, 0, ?, ?, ?, ?, 0, ?, ?, 2)',
            [
                $drugId, $inventoryId, 'seed', $receivedOn,
                (0 - $qty), (0 - round($unitCost * $qty, 2)), SEED_MARKER, 'Opening stock (seed)',
            ]
        );

        $lotCount++;
        $unitTotal += $qty;
    }
    $i++;
}

echo str_repeat('-', 44) . "\n";
echo "[done] seeded {$lotCount} lots, {$unitTotal} units across " . count($formulary) . " products\n";

// Snapshot for a quick sanity read.
$summary = QueryUtils::querySingleRow(
    "SELECT COUNT(DISTINCT di.drug_id) AS skus,
            COUNT(*) AS lots,
            COALESCE(SUM(di.on_hand),0) AS units,
            SUM(CASE WHEN di.expiration < CURDATE() THEN 1 ELSE 0 END) AS expired,
            SUM(CASE WHEN di.expiration >= CURDATE()
                     AND di.expiration <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS expiring
     FROM drug_inventory di WHERE di.vendor_id = ?",
    [SEED_MARKER]
);
echo "         in DB: {$summary['skus']} SKUs, {$summary['lots']} lots, {$summary['units']} units, "
    . "{$summary['expiring']} expiring-soon, {$summary['expired']} expired\n";

// ---------------------------------------------------------------------------

/**
 * Lot profiles: quantities relative to the reorder point + expiry mix, so the stock browser,
 * reorder report and expiry filters all have realistic data to show.
 *
 * @return array<int, array{qty:int, exp:string, warehouse:string, received:string}>
 */
function lotPlan(string $stock, int $reorder, DateTimeImmutable $today): array
{
    $exp = static fn (string $mod): string => $today->modify($mod)->format('Y-m-15');
    $recv = static fn (string $mod): string => $today->modify($mod)->format('Y-m-d');

    return match ($stock) {
        'out' => [],
        'low' => [
            ['qty' => max(1, (int) round($reorder * 0.6)), 'exp' => $exp('+14 months'),
             'warehouse' => DISPENSARY, 'received' => $recv('-2 months')],
        ],
        'near' => [
            ['qty' => max(1, (int) round($reorder * 0.8)), 'exp' => $exp('+45 days'),
             'warehouse' => DISPENSARY, 'received' => $recv('-10 months')],
            ['qty' => $reorder * 2, 'exp' => $exp('+20 months'),
             'warehouse' => DISPENSARY, 'received' => $recv('-1 months')],
        ],
        'expired' => [
            ['qty' => max(1, (int) round($reorder * 0.3)), 'exp' => $exp('-25 days'),
             'warehouse' => STORE, 'received' => $recv('-16 months')],
            ['qty' => $reorder * 2, 'exp' => $exp('+16 months'),
             'warehouse' => DISPENSARY, 'received' => $recv('-1 months')],
        ],
        'healthy2' => [
            ['qty' => max(1, (int) round($reorder * 1.2)), 'exp' => $exp('+9 months'),
             'warehouse' => DISPENSARY, 'received' => $recv('-4 months')],
            ['qty' => $reorder * 2, 'exp' => $exp('+22 months'),
             'warehouse' => STORE, 'received' => $recv('-1 months')],
        ],
        default => [ // 'healthy'
            ['qty' => $reorder * 3, 'exp' => $exp('+18 months'),
             'warehouse' => DISPENSARY, 'received' => $recv('-3 months')],
        ],
    };
}

function ensureWarehouse(string $optionId, string $title, int $seq): void
{
    $existing = QueryUtils::querySingleRow(
        "SELECT option_id FROM list_options WHERE list_id = 'warehouse' AND option_id = ? LIMIT 1",
        [$optionId]
    );
    if (is_array($existing)) {
        return;
    }
    QueryUtils::sqlInsert(
        "INSERT INTO list_options (list_id, option_id, title, seq, activity) VALUES ('warehouse', ?, ?, ?, 1)",
        [$optionId, $title, $seq]
    );
}

function findDrugId(string $name, string $form, string $size): int
{
    $row = QueryUtils::querySingleRow(
        'SELECT drug_id FROM drugs WHERE name = ? AND form = ? AND size = ? ORDER BY drug_id ASC LIMIT 1',
        [$name, $form, $size]
    );

    return is_array($row) ? (int) ($row['drug_id'] ?? 0) : 0;
}

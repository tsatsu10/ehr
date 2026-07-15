<?php

/**
 * M13 Pharmacy Operations Hub — clinic-wide pending dispense worklist
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PharmOpsWorklistService
{
    public const TAB_PENDING_DISPENSE = 'pending_dispense';
    public const TAB_LOW_STOCK = 'low_stock';
    public const TAB_WRITE_OFF = 'write_off';

    /** @var array<int, string> */
    private const PHARMACY_VISIT_STATES = ['ready_for_pharmacy', 'in_pharmacy'];

    public function __construct(
        private readonly PharmOpsAccessService $access = new PharmOpsAccessService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly PharmOpsDestroyService $destroyService = new PharmOpsDestroyService(),
    ) {
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function worklist(array $filters, int $actorUserId): array
    {
        $this->access->assertHubAccess();

        $visitDate = trim((string) ($filters['date'] ?? ''));
        if ($visitDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $visitDate)) {
            $visitDate = date('Y-m-d');
        }

        $tab = strtolower(trim((string) ($filters['tab'] ?? self::TAB_PENDING_DISPENSE)));
        if (!in_array($tab, [self::TAB_PENDING_DISPENSE, self::TAB_LOW_STOCK, self::TAB_WRITE_OFF], true)) {
            $tab = self::TAB_PENDING_DISPENSE;
        }

        $nestedFilters = is_array($filters['filters'] ?? null) ? $filters['filters'] : [];
        $urgentFirst = !empty($filters['urgent_first']) || !empty($nestedFilters['urgent_first']);

        $requestedFacility = (int) ($filters['facility_id'] ?? 0);
        $deskFacilityId = $this->visitScope->resolveDeskFacilityId(
            $requestedFacility > 0 ? $requestedFacility : null
        );
        $this->visitScope->repairOrphanVisits($deskFacilityId, $visitDate);

        $facilityIds = $this->resolveWorklistFacilityIds($requestedFacility, $deskFacilityId);

        $pendingRawRows = $this->fetchPrescriptionRows($facilityIds, $visitDate);
        // Batched (not one query per row) — stock status used to be looked up per prescription
        // row via a single-drug query, and mapWorklistRow() runs over every row twice (once
        // here just for the tab-bar count, again below to build the visible rows).
        $stockMap = self::batchStockSummaryForDrugs(array_map(
            static fn (array $raw): int => (int) ($raw['drug_id'] ?? 0),
            $pendingRawRows
        ));
        $pendingCount = 0;
        foreach ($pendingRawRows as $raw) {
            if ($this->mapWorklistRow($raw, $stockMap) !== null) {
                $pendingCount++;
            }
        }

        $lowStockRawRows = $this->fetchLowStockRows();
        $lowStockCount = count($lowStockRawRows);

        $warnDays = $this->destroyService->resolveExpiryWarnDays($deskFacilityId);
        $writeOffRawRows = $this->destroyService->fetchWriteOffRows($warnDays);
        $writeOffCount = count($writeOffRawRows);

        $rows = [];
        if ($tab === self::TAB_LOW_STOCK) {
            foreach ($lowStockRawRows as $raw) {
                $rows[] = $this->mapLowStockRow($raw);
            }
        } elseif ($tab === self::TAB_WRITE_OFF) {
            foreach ($writeOffRawRows as $raw) {
                $rows[] = $this->destroyService->mapWriteOffRow($raw, $warnDays);
            }
        } else {
            foreach ($pendingRawRows as $raw) {
                $mapped = $this->mapWorklistRow($raw, $stockMap);
                if ($mapped === null) {
                    continue;
                }
                $rows[] = $mapped;
            }
        }

        if ($urgentFirst && $tab === self::TAB_PENDING_DISPENSE) {
            usort($rows, static function (array $a, array $b): int {
                $ua = !empty($a['is_urgent']) ? 0 : 1;
                $ub = !empty($b['is_urgent']) ? 0 : 1;
                if ($ua !== $ub) {
                    return $ua <=> $ub;
                }
                $qa = (int) ($a['queue_number'] ?? 9999);
                $qb = (int) ($b['queue_number'] ?? 9999);
                if ($qa !== $qb) {
                    return $qa <=> $qb;
                }

                return strcmp((string) ($a['ordered_at'] ?? ''), (string) ($b['ordered_at'] ?? ''));
            });
        }

        return [
            'tab' => $tab,
            'visit_date' => $visitDate,
            'facility_id' => $deskFacilityId,
            'counts' => [
                self::TAB_PENDING_DISPENSE => $pendingCount,
                self::TAB_LOW_STOCK => $lowStockCount,
                self::TAB_WRITE_OFF => $writeOffCount,
            ],
            'rows' => $rows,
            'can_dispense' => $this->access->canDispense(),
            'can_receive' => $this->access->canReceive(),
            'can_destroy' => $this->access->canDestroy(),
            'can_print_rx' => $this->access->canPrintRx() && $this->access->isRxPrintEnabled($deskFacilityId),
            'can_print_dispense_label' => $this->access->isDispenseLabelEnabled($deskFacilityId)
                && $this->access->canPrintDispenseLabel(),
            'expiry_warn_days' => $warnDays,
            'actor_user_id' => $actorUserId,
            'last_updated' => date('c'),
        ];
    }

    public static function parseQuantity(?string $quantity): int
    {
        $quantity = trim((string) $quantity);
        if ($quantity === '') {
            return 0;
        }
        if (preg_match('/^\d+/', $quantity, $matches)) {
            return (int) $matches[0];
        }

        return 0;
    }

    /**
     * @param list<int> $facilityIds
     * @return list<int|string>
     */
    public static function prescriptionRowBindParams(string $visitDate, array $facilityIds): array
    {
        $bind = [$visitDate];
        if ($facilityIds !== []) {
            $bind = array_merge($bind, $facilityIds);
        }

        return $bind;
    }

    /**
     * @param list<int> $facilityIds
     */
    public static function prescriptionRowFacilityClause(array $facilityIds): string
    {
        if ($facilityIds === []) {
            return '';
        }

        $placeholders = implode(',', array_fill(0, count($facilityIds), '?'));

        return " AND (
              COALESCE(NULLIF(nv.facility_id, 0), fe.facility_id, 0) IN ({$placeholders})
              OR COALESCE(NULLIF(nv.facility_id, 0), fe.facility_id, 0) = 0
          )";
    }

  /**
   * @return string|null pending|partial when row belongs on worklist; null when fully dispensed
   */
  public static function classifyDispenseStatus(int $qtyOrdered, int $qtyDispensed, bool $filled): ?string
  {
      if ($qtyOrdered > 0 && $qtyDispensed >= $qtyOrdered) {
          return null;
      }

      if ($filled && $qtyDispensed <= 0) {
          return null;
      }

      if ($filled && $qtyOrdered > 0 && $qtyDispensed >= $qtyOrdered) {
          return null;
      }

      if ($qtyDispensed > 0) {
          return 'partial';
      }

      return 'pending';
  }

  public static function classifyReorderStatus(float $onHand, float $reorderPoint): string
  {
      if ($onHand <= 0) {
          return 'out_of_stock';
      }

      if ($reorderPoint > 0 && $onHand <= $reorderPoint) {
          return 'low';
      }

      return 'in_stock';
  }

  public static function isLowStockCandidate(float $onHand, float $reorderPoint): bool
  {
      if ($reorderPoint <= 0) {
          return $onHand <= 0;
      }

      return $onHand <= $reorderPoint;
  }

  /**
   * @return list<int> Empty list = do not filter by facility.
   */
  private function resolveWorklistFacilityIds(int $requestedFacility, int $deskFacilityId): array
  {
      $facilityScope = new FacilityScopeService();

      if ($requestedFacility > 0) {
          $this->visitScope->assertFacilityAccessible($requestedFacility);

          return [$requestedFacility];
      }

      if (!$facilityScope->shouldFilterByFacility()) {
          return $deskFacilityId > 0 ? [$deskFacilityId] : [];
      }

      $allowed = $facilityScope->getActorFacilityIds();

      return $allowed !== [] ? $allowed : ($deskFacilityId > 0 ? [$deskFacilityId] : []);
  }

  /**
   * @param list<int> $facilityIds
   * @return array<int, array<string, mixed>>
   */
  private function fetchPrescriptionRows(array $facilityIds, string $visitDate): array
  {
      $bind = self::prescriptionRowBindParams($visitDate, $facilityIds);
      $facilityClause = self::prescriptionRowFacilityClause($facilityIds);

      $sql = "SELECT rx.id AS prescription_id, rx.patient_id AS pid, rx.encounter,
                     rx.drug, rx.dosage, rx.quantity, rx.date_added, rx.start_date,
                     rx.filled_date, rx.drug_id, rx.route, rx.`interval`,
                     pd.fname, pd.lname, pd.pubpid,
                     nv.id AS visit_id, nv.queue_number, nv.state AS visit_state, nv.is_urgent,
                     COALESCE(ds_tot.qty_dispensed, 0) AS qty_dispensed
              FROM prescriptions rx
              INNER JOIN patient_data pd ON pd.pid = rx.patient_id
              INNER JOIN new_visit nv ON nv.id = " . PharmOpsVisitMatch::todayVisitSubquerySql() . "
              LEFT JOIN form_encounter fe ON fe.pid = rx.patient_id AND fe.encounter = nv.encounter
              LEFT JOIN (
                  SELECT prescription_id, SUM(quantity) AS qty_dispensed
                  FROM drug_sales
                  WHERE prescription_id > 0
                  GROUP BY prescription_id
              ) ds_tot ON ds_tot.prescription_id = rx.id
              WHERE rx.active = 1
                {$facilityClause}
              ORDER BY nv.is_urgent DESC, nv.queue_number ASC, rx.date_added ASC";

      return QueryUtils::fetchRecords($sql, $bind) ?: [];
  }

  /**
   * @param array<string, mixed> $raw
   * @param array<int, array{stock_status: string, on_hand: int, qoh_display: string|null}> $stockMap
   *   drug_id => pre-batched stock summary (see batchStockSummaryForDrugs()).
   * @return array<string, mixed>|null
   */
  private function mapWorklistRow(array $raw, array $stockMap = []): ?array
  {
      $prescriptionId = (int) ($raw['prescription_id'] ?? 0);
      $pid = (int) ($raw['pid'] ?? 0);
      if ($prescriptionId <= 0 || $pid <= 0) {
          return null;
      }

      $qtyOrdered = self::parseQuantity((string) ($raw['quantity'] ?? ''));
      $qtyDispensed = (int) ($raw['qty_dispensed'] ?? 0);
      $filledDate = (string) ($raw['filled_date'] ?? '');
      $filled = $filledDate !== '' && !str_starts_with($filledDate, '0000-00-00');

      $dispenseStatus = self::classifyDispenseStatus($qtyOrdered, $qtyDispensed, $filled);
      if ($dispenseStatus === null) {
          return null;
      }

      $visitId = (int) ($raw['visit_id'] ?? 0);
      $visitState = (string) ($raw['visit_state'] ?? '');
      $webroot = $GLOBALS['webroot'] ?? '';
      $moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';

      $drugName = trim((string) ($raw['drug'] ?? 'Medication'));
      $dosage = trim((string) ($raw['dosage'] ?? ''));
      if ($dosage !== '') {
          $drugName .= ' ' . $dosage;
      }

      $orderedAt = (string) ($raw['date_added'] ?? $raw['start_date'] ?? '');
      $orderedDisplay = $this->formatOrderedDisplay($orderedAt);

      $canOpenPharmacyDesk = $visitId > 0
          && in_array($visitState, self::PHARMACY_VISIT_STATES, true);

      return [
          'row_type' => self::TAB_PENDING_DISPENSE,
          'prescription_id' => $prescriptionId,
          'pid' => $pid,
          'encounter_id' => (int) ($raw['encounter'] ?? 0),
          'patient_label' => $this->formatPatientLabel(
              (string) ($raw['fname'] ?? ''),
              (string) ($raw['lname'] ?? '')
          ),
          'patient_name' => trim(($raw['fname'] ?? '') . ' ' . ($raw['lname'] ?? '')),
          'mrn' => (string) ($raw['pubpid'] ?? ''),
          'visit_id' => $visitId > 0 ? $visitId : null,
          'queue_number' => isset($raw['queue_number']) ? (int) $raw['queue_number'] : null,
          'is_urgent' => !empty($raw['is_urgent']),
          'drug_name' => $drugName,
          'qty_ordered' => $qtyOrdered,
          'qty_dispensed' => $qtyDispensed,
          'dispense_status' => $dispenseStatus,
          'status_label' => $this->buildStatusLabel($dispenseStatus, $qtyOrdered, $qtyDispensed),
          'stock_status' => ($stockMap[(int) ($raw['drug_id'] ?? 0)] ?? self::stockSummaryForDrug((int) ($raw['drug_id'] ?? 0)))['stock_status'],
          'ordered_at' => $orderedAt,
          'ordered_display' => $orderedDisplay,
          'can_open_pharmacy_desk' => $canOpenPharmacyDesk,
          'pharmacy_desk_url' => $canOpenPharmacyDesk
              ? $moduleUrl . '/pharmacy.php?visit_id=' . urlencode((string) $visitId)
              : null,
          'patient_chart_url' => $moduleUrl . '/patient-chart.php?pid='
              . urlencode((string) $pid) . '#clinical-meds',
      ];
  }

  private function formatPatientLabel(string $fname, string $lname): string
  {
      $fname = trim($fname);
      $lname = trim($lname);
      if ($fname === '' && $lname === '') {
          return 'Patient';
      }
      if ($lname !== '') {
          $initial = mb_substr($lname, 0, 1);
          if ($fname !== '') {
              return $fname . ' ' . $initial . '.';
          }

          return $lname;
      }

      return $fname;
  }

  private function buildStatusLabel(string $dispenseStatus, int $qtyOrdered, int $qtyDispensed): string
  {
      if ($dispenseStatus === 'partial') {
          if ($qtyOrdered > 0) {
              return 'Partial (' . $qtyDispensed . '/' . $qtyOrdered . ')';
          }

          return 'Partially dispensed';
      }

      return 'Not dispensed';
  }

  private function formatOrderedDisplay(string $orderedAt): ?string
  {
      $orderedAt = trim($orderedAt);
      if ($orderedAt === '' || str_starts_with($orderedAt, '0000-00-00')) {
          return null;
      }

      $timestamp = strtotime($orderedAt);
      if ($timestamp === false) {
          return null;
      }

      return 'ordered ' . date('H:i', $timestamp);
  }

  /**
   * @return array{stock_status: string, on_hand: int, qoh_display: string|null}
   */
  public static function stockSummaryForDrug(int $drugId): array
  {
      if ($drugId <= 0) {
          return ['stock_status' => 'unknown', 'on_hand' => 0, 'qoh_display' => null];
      }

      $map = self::batchStockSummaryForDrugs([$drugId]);

      return $map[$drugId] ?? ['stock_status' => 'unknown', 'on_hand' => 0, 'qoh_display' => null];
  }

  /**
   * Batched form of stockSummaryForDrug() — the worklist used to call the single-drug version
   * once per prescription row (a query per row, run twice per hub load/poll since the same
   * rows get mapped once for the tab-bar count and again to build the visible list).
   *
   * @param array<int, int> $drugIds
   * @return array<int, array{stock_status: string, on_hand: int, qoh_display: string|null}>
   */
  public static function batchStockSummaryForDrugs(array $drugIds): array
  {
      $drugIds = array_values(array_unique(array_filter(
          array_map('intval', $drugIds),
          static fn (int $id): bool => $id > 0
      )));
      if ($drugIds === []) {
          return [];
      }

      $placeholders = implode(',', array_fill(0, count($drugIds), '?'));
      $rows = QueryUtils::fetchRecords(
          "SELECT d.drug_id, COALESCE(SUM(di.on_hand), 0) AS on_hand, d.reorder_point
           FROM drugs d
           LEFT JOIN drug_inventory di
              ON di.drug_id = d.drug_id AND di.destroy_date IS NULL
           WHERE d.drug_id IN ($placeholders)
           GROUP BY d.drug_id, d.reorder_point",
          $drugIds
      ) ?: [];

      $map = [];
      foreach ($rows as $row) {
          $drugId = (int) ($row['drug_id'] ?? 0);
          $onHand = (float) ($row['on_hand'] ?? 0);
          $reorderPoint = (float) ($row['reorder_point'] ?? 0);
          $onHandInt = (int) round($onHand);
          $map[$drugId] = [
              'stock_status' => self::classifyReorderStatus($onHand, $reorderPoint),
              'on_hand' => $onHandInt,
              'qoh_display' => 'QOH ' . $onHandInt
                  . ($reorderPoint > 0 ? ' · reorder ' . (int) round($reorderPoint) : ''),
          ];
      }

      return $map;
  }

  /**
   * @return array<int, array<string, mixed>>
   */
  private function fetchLowStockRows(): array
  {
      $sql = "SELECT d.drug_id, d.name, d.reorder_point,
                     COALESCE(inv.on_hand, 0) AS on_hand
              FROM drugs d
              LEFT JOIN (
                  SELECT drug_id, SUM(on_hand) AS on_hand
                  FROM drug_inventory
                  WHERE destroy_date IS NULL
                  GROUP BY drug_id
              ) inv ON inv.drug_id = d.drug_id
              WHERE d.active = 1
                AND d.dispensable = 1
                AND (
                  (d.reorder_point > 0 AND COALESCE(inv.on_hand, 0) <= d.reorder_point)
                  OR (d.reorder_point <= 0 AND COALESCE(inv.on_hand, 0) <= 0)
                )
              ORDER BY COALESCE(inv.on_hand, 0) ASC, d.name ASC";

      return QueryUtils::fetchRecords($sql) ?: [];
  }

  /**
   * @param array<string, mixed> $raw
   * @return array<string, mixed>
   */
  private function mapLowStockRow(array $raw): array
  {
      $drugId = (int) ($raw['drug_id'] ?? 0);
      $onHand = (float) ($raw['on_hand'] ?? 0);
      $reorderPoint = (float) ($raw['reorder_point'] ?? 0);
      $stockStatus = self::classifyReorderStatus($onHand, $reorderPoint);

      $statusLabel = $stockStatus === 'out_of_stock' ? 'Out of stock' : 'Low stock';

      return [
          'row_type' => self::TAB_LOW_STOCK,
          'drug_id' => $drugId,
          'drug_name' => trim((string) ($raw['name'] ?? 'Medication')),
          'on_hand' => (int) round($onHand),
          'reorder_point' => (int) round($reorderPoint),
          'stock_status' => $stockStatus,
          'status_label' => $statusLabel,
          'qoh_display' => 'QOH ' . (int) round($onHand)
              . ($reorderPoint > 0 ? ' · reorder ' . (int) round($reorderPoint) : ''),
      ];
  }
}

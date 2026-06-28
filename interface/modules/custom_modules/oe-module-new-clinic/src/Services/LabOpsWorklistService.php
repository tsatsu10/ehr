<?php

/**
 * M12 Lab Operations Hub — clinic-wide pending worklist
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class LabOpsWorklistService
{
    public const TAB_PENDING = 'pending';
    public const TAB_IN_PROGRESS = 'in_progress';
    public const TAB_SEND_OUT = 'send_out';

    /** @var array<int, string> */
    private const TERMINAL_ORDER_STATUSES = ['complete', 'completed', 'canceled', 'cancelled'];

    public function __construct(
        private readonly LabOpsAccessService $access = new LabOpsAccessService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly LabOpsOrderMetaService $orderMeta = new LabOpsOrderMetaService(),
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

      $tab = strtolower(trim((string) ($filters['tab'] ?? self::TAB_PENDING)));
      if (!in_array($tab, [self::TAB_PENDING, self::TAB_IN_PROGRESS, self::TAB_SEND_OUT], true)) {
          $tab = self::TAB_PENDING;
      }

      $fulfillmentFilter = strtolower(trim((string) ($filters['fulfillment'] ?? 'all')));
      $urgentFirst = !empty($filters['urgent_first']);

      $requestedFacility = (int) ($filters['facility_id'] ?? 0);
      $deskFacilityId = $this->visitScope->resolveDeskFacilityId(
          $requestedFacility > 0 ? $requestedFacility : null
      );
      $this->visitScope->repairOrphanVisits($deskFacilityId, $visitDate);

      $facilityIds = $this->resolveWorklistFacilityIds($requestedFacility, $deskFacilityId);

      $rawRows = $this->fetchOrderRows($facilityIds, $visitDate);
      $orderIds = array_values(array_unique(array_filter(array_map(
          static fn (array $raw): int => (int) ($raw['procedure_order_id'] ?? 0),
          $rawRows
      ))));
      if ($orderIds !== []) {
          $this->orderMeta->batchEnsureFulfillmentMeta($orderIds);
          $rawRows = $this->fetchOrderRows($facilityIds, $visitDate);
      }
      $rows = [];
      $counts = [
          self::TAB_PENDING => 0,
          self::TAB_IN_PROGRESS => 0,
          self::TAB_SEND_OUT => 0,
      ];

      foreach ($rawRows as $raw) {
          $mapped = $this->mapWorklistRow($raw);
          $rowTab = self::classifyWorklistTab($mapped);
          if ($rowTab === null) {
              continue;
          }

          $counts[$rowTab]++;

          if ($rowTab !== $tab) {
              continue;
          }

          if ($fulfillmentFilter === 'in_house' && ($mapped['fulfillment'] ?? '') === 'send_out') {
              continue;
          }
          if ($fulfillmentFilter === 'send_out' && ($mapped['fulfillment'] ?? '') !== 'send_out') {
              continue;
          }

          $rows[] = $mapped;
      }

      if ($urgentFirst) {
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
          'counts' => $counts,
          'rows' => $rows,
          'can_enter' => $this->access->canEnterResults(),
          'can_release' => $this->access->canReleaseResults(),
          'actor_user_id' => $actorUserId,
          'last_updated' => date('c'),
      ];
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
   * @param array<string, mixed> $row
   */
  public static function classifyWorklistTab(array $row): ?string
  {
      $status = strtolower((string) ($row['order_status'] ?? ''));
      if (in_array($status, self::TERMINAL_ORDER_STATUSES, true)) {
          return null;
      }

      $fulfillment = (string) ($row['fulfillment'] ?? 'in_house');
      if ($fulfillment === 'send_out') {
          $reviewed = strtolower((string) ($row['review_status'] ?? '')) === 'reviewed';
          if ($reviewed) {
              return null;
          }

          return self::TAB_SEND_OUT;
      }

      $collected = !empty($row['collected']) || !empty($row['collected_at']);
      $reviewed = strtolower((string) ($row['review_status'] ?? '')) === 'reviewed';

      if (!$collected) {
          return self::TAB_PENDING;
      }

      if (!$reviewed) {
          return self::TAB_IN_PROGRESS;
      }

      return null;
  }

  /**
   * @param list<int> $facilityIds
   * @return array<int, array<string, mixed>>
   */
  private function fetchOrderRows(array $facilityIds, string $visitDate): array
  {
      $bind = [$visitDate, $visitDate];
      $facilityClause = '';
      if ($facilityIds !== []) {
          $placeholders = implode(',', array_fill(0, count($facilityIds), '?'));
          $facilityClause = " AND COALESCE(NULLIF(nv.facility_id, 0), fe.facility_id, 0) IN ({$placeholders})";
          $bind = array_merge($bind, $facilityIds);
      }

      $sql = "SELECT po.procedure_order_id, po.patient_id, po.encounter_id, po.date_ordered,
                     po.order_status, po.lab_id,
                     pd.fname, pd.lname, pd.pubpid,
                     GROUP_CONCAT(DISTINCT poc.procedure_order_title
                         ORDER BY poc.procedure_order_seq SEPARATOR ', ') AS test_names,
                     MIN(pr.date_collected) AS date_collected,
                     MAX(CASE WHEN pr.review_status = 'reviewed' THEN 1 ELSE 0 END) AS has_reviewed,
                     MAX(pr.review_status) AS review_status,
                     meta.fulfillment, meta.collected_at, meta.accession_no, meta.visit_id AS meta_visit_id,
                     nv.id AS visit_id, nv.queue_number, nv.state AS visit_state, nv.is_urgent
              FROM procedure_order po
              INNER JOIN patient_data pd ON pd.pid = po.patient_id
              LEFT JOIN procedure_order_code poc ON poc.procedure_order_id = po.procedure_order_id
              LEFT JOIN procedure_report pr ON pr.procedure_order_id = po.procedure_order_id
              LEFT JOIN new_lab_order_meta meta ON meta.procedure_order_id = po.procedure_order_id
              LEFT JOIN new_visit nv ON nv.pid = po.patient_id
                  AND nv.encounter = po.encounter_id
              LEFT JOIN form_encounter fe ON fe.pid = po.patient_id AND fe.encounter = po.encounter_id
              WHERE po.activity = 1
                AND (DATE(po.date_ordered) = ? OR nv.visit_date = ?)
                {$facilityClause}
              GROUP BY po.procedure_order_id, po.patient_id, po.encounter_id, po.date_ordered,
                       po.order_status, po.lab_id, pd.fname, pd.lname, pd.pubpid,
                       meta.fulfillment, meta.collected_at, meta.accession_no, meta.visit_id,
                       nv.id, nv.queue_number, nv.state, nv.is_urgent
              ORDER BY nv.is_urgent DESC, nv.queue_number ASC, po.date_ordered ASC";

      return QueryUtils::fetchRecords($sql, $bind) ?: [];
  }

  /**
   * @param array<string, mixed> $raw
   * @return array<string, mixed>
   */
  private function mapWorklistRow(array $raw): array
  {
      $orderId = (int) ($raw['procedure_order_id'] ?? 0);
      $pid = (int) ($raw['patient_id'] ?? 0);
      $visitId = (int) ($raw['visit_id'] ?? $raw['meta_visit_id'] ?? 0);
      $collectedAt = (string) ($raw['collected_at'] ?? '');
      $dateCollected = (string) ($raw['date_collected'] ?? '');
      $collected = ($collectedAt !== '' && !str_starts_with($collectedAt, '0000-00-00'))
          || ($dateCollected !== '' && !str_starts_with($dateCollected, '0000-00-00'));

      $fulfillment = $this->orderMeta->resolveFulfillment(
          (string) ($raw['fulfillment'] ?? ''),
          (int) ($raw['lab_id'] ?? 0)
      );

      $reviewStatus = (string) ($raw['review_status'] ?? '');
      if ($reviewStatus === '' && !empty($raw['has_reviewed'])) {
          $reviewStatus = 'reviewed';
      }

        $webroot = $GLOBALS['webroot'] ?? '';
        $moduleUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';
        $requisitionUrl = $orderId > 0
            ? $moduleUrl . '/lab-ops/requisition.php?procedure_order_id=' . urlencode((string) $orderId)
            : null;

        return [
          'procedure_order_id' => $orderId,
          'pid' => $pid,
          'encounter_id' => (int) ($raw['encounter_id'] ?? 0),
          'visit_id' => $visitId > 0 ? $visitId : null,
          'patient_name' => trim(($raw['fname'] ?? '') . ' ' . ($raw['lname'] ?? '')),
          'pubpid' => (string) ($raw['pubpid'] ?? ''),
          'queue_number' => isset($raw['queue_number']) ? (int) $raw['queue_number'] : null,
          'is_urgent' => !empty($raw['is_urgent']),
          'test_names' => (string) ($raw['test_names'] ?? 'Lab order'),
          'order_status' => (string) ($raw['order_status'] ?? 'pending'),
          'ordered_at' => (string) ($raw['date_ordered'] ?? ''),
          'ordered_display' => $this->formatDateTime($raw['date_ordered'] ?? null),
          'fulfillment' => $fulfillment,
          'fulfillment_label' => $fulfillment === 'send_out' ? 'Send-out' : 'In-house',
          'collected' => $collected,
          'collected_at' => $collectedAt !== '' ? $collectedAt : ($dateCollected !== '' ? $dateCollected : null),
          'accession_no' => (string) ($raw['accession_no'] ?? '') ?: null,
          'review_status' => $reviewStatus,
          'visit_state' => (string) ($raw['visit_state'] ?? ''),
          'can_open_lab_desk' => in_array((string) ($raw['visit_state'] ?? ''), ['ready_for_lab', 'in_lab'], true),
          'lab_desk_url' => $visitId > 0 ? $moduleUrl . '/lab.php?visit_id=' . urlencode((string) $visitId) : null,
          'requisition_url' => $requisitionUrl,
          'status_label' => $this->buildStatusLabel($collected, $reviewStatus, $fulfillment),
      ];
  }

  private function buildStatusLabel(bool $collected, string $reviewStatus, string $fulfillment): string
  {
      if ($fulfillment === 'send_out' && !$collected) {
          return 'Send-out · not collected';
      }
      if ($fulfillment === 'send_out' && $reviewStatus !== 'reviewed') {
          return 'Send-out · awaiting results';
      }
      if (!$collected) {
          return 'Not collected';
      }
      if ($reviewStatus !== 'reviewed') {
          return 'Collected · awaiting release';
      }

      return 'Released';
  }

  /**
   * @param mixed $value
   */
  private function formatDateTime($value): ?string
  {
      if ($value === null || $value === '') {
          return null;
      }

      $text = (string) $value;
      if (str_starts_with($text, '0000-00-00')) {
          return null;
      }

      try {
          return (new \DateTime($text))->format('d/m/Y H:i');
      } catch (\Exception) {
          return null;
      }
  }
}

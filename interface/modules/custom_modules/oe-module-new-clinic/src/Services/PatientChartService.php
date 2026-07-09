<?php

/**
 * Patient chart read models (B7)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PatientChartService
{
    public const PAST_VISITS_PAGE_SIZE = 20;

    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly VisitRowEnricher $rowEnricher = new VisitRowEnricher(),
        private readonly ClinicalExportService $clinicalExportService = new ClinicalExportService(),
        private readonly ClinicalDocHubLinkService $docHubLinks = new ClinicalDocHubLinkService(),
        private readonly ReferralCorrespondenceService $referrals = new ReferralCorrespondenceService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getVisitsPayload(int $pid, int $offset = 0, int $limit = self::PAST_VISITS_PAGE_SIZE): array
    {
        $this->facilityScope->assertPatientAccessible($pid);

        $limit = min(max($limit, 1), 50);
        $offset = max($offset, 0);
        $today = date('Y-m-d');
        $facilityFilter = $this->facilityScope->getVisitFacilityFilterClause('v');

        $todayBind = array_merge([$pid, $today], $facilityFilter['bind']);
        $todayVisits = $this->fetchVisitRows(
            "SELECT v.*, vt.label AS visit_type_label
             FROM new_visit v
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             WHERE v.pid = ? AND v.visit_date = ?{$facilityFilter['sql']}
             ORDER BY v.is_urgent DESC, v.queue_number ASC, v.started_at ASC",
            $todayBind
        );

        $pastCountBind = array_merge([$pid, $today], $facilityFilter['bind']);
        $pastCountRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM new_visit v
             WHERE v.pid = ? AND v.visit_date < ?{$facilityFilter['sql']}",
            $pastCountBind
        );
        $pastTotal = is_array($pastCountRow) ? (int) ($pastCountRow['cnt'] ?? 0) : 0;

        $pastBind = array_merge([$pid, $today], $facilityFilter['bind']);
        $pastRows = $this->fetchVisitRows(
            "SELECT v.*, vt.label AS visit_type_label
             FROM new_visit v
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             WHERE v.pid = ? AND v.visit_date < ?{$facilityFilter['sql']}
             ORDER BY v.visit_date DESC, v.queue_number DESC, v.started_at DESC
             LIMIT " . (int) $limit . " OFFSET " . (int) $offset,
            $pastBind
        );

        return [
            'visit_date' => $today,
            'today_visits' => $todayVisits,
            'past_visits' => $pastRows,
            'past_total' => $pastTotal,
            'past_offset' => $offset,
            'past_limit' => $limit,
            'past_has_more' => ($offset + count($pastRows)) < $pastTotal,
        ];
    }

    /**
     * @param array<int, mixed> $bind
     * @return array<int, array<string, mixed>>
     */
    private function fetchVisitRows(string $sql, array $bind): array
    {
        $rows = QueryUtils::fetchRecords($sql, $bind) ?: [];
        $visitIds = array_map(static fn (array $row): int => (int) ($row['id'] ?? 0), $rows);
        $skippedMap = $this->rowEnricher->batchSkippedTriage($visitIds);

        $pid = (int) ($bind[0] ?? 0);

        return array_map(
            fn (array $row): array => $this->mapVisitRow($row, $skippedMap, $pid),
            $rows
        );
    }

    /**
     * @param array<string, mixed> $row
     * @param array<int, bool> $skippedMap
     * @return array<string, mixed>
     */
    private function mapVisitRow(array $row, array $skippedMap, int $pid): array
    {
        $visitId = (int) ($row['id'] ?? 0);
        $enriched = $this->rowEnricher->enrichVisitRow($row, $visitId, $skippedMap);
        $encounterId = (int) ($row['encounter'] ?? 0);
        $facilityId = (int) ($row['facility_id'] ?? 0);
        $documentationUrl = $encounterId > 0
            ? $this->docHubLinks->buildDocumentationUrl($pid, $encounterId, $facilityId)
            : null;

        return [
            'id' => $visitId,
            'visit_date' => (string) ($row['visit_date'] ?? ''),
            'queue_number' => (int) ($row['queue_number'] ?? 0),
            'state' => (string) ($row['state'] ?? ''),
            'visit_type_label' => (string) ($enriched['visit_type_label'] ?? 'Visit'),
            'service_profile' => (string) ($row['service_profile'] ?? 'full_opd'),
            'chief_complaint' => $row['chief_complaint'] ?? null,
            'started_at' => $row['started_at'] ?? null,
            'completed_at' => $row['completed_at'] ?? null,
            'is_urgent' => !empty($row['is_urgent']),
            'skipped_triage' => !empty($enriched['skipped_triage']),
            'encounter' => $encounterId,
            'facility_id' => $facilityId,
            'documentation_url' => $documentationUrl,
            'export_visit_summary_url' => $this->clinicalExportService->buildVisitExportUrl($pid, $encounterId),
            'referrals_url' => $this->referrals->buildVisitReferralsUrl($pid, $encounterId),
        ];
    }
}

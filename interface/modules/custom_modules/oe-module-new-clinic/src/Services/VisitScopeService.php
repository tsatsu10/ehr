<?php

/**
 * Facility scope checks for visit-scoped operations
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class VisitScopeService
{
    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function resolveActorFacilityId(?int $requestedFacilityId = null): int
    {
        if ($requestedFacilityId !== null && $requestedFacilityId > 0) {
            $this->assertFacilityAccessible($requestedFacilityId);

            return $requestedFacilityId;
        }

        $facilityId = $this->resolveDefaultFacilityId();
        if ($facilityId <= 0) {
            throw new \RuntimeException('No facility context for this session', 400);
        }

        return $facilityId;
    }

    /**
     * Desk pages and AJAX: prefer session/request facility, else default service location.
     * Never throws — returns 0 only when no service location exists in the database.
     */
    public function resolveDeskFacilityId(?int $requestedFacilityId = null): int
    {
        if ($requestedFacilityId !== null && $requestedFacilityId > 0) {
            try {
                $this->assertFacilityAccessible($requestedFacilityId);

                return $requestedFacilityId;
            } catch (\RuntimeException) {
                if ($this->hasMultipleServiceLocations()) {
                    $_SESSION['nc_desk_facility_fallback'] = 1;
                }
            }
        }

        return $this->resolveDefaultFacilityId();
    }

    /**
     * @param array<string, mixed> $visit
     */
    public function assertVisitAccessible(array $visit): void
    {
        if (!$this->facilityScope->shouldFilterByFacility()) {
            return;
        }

        $visitFacilityId = (int) ($visit['facility_id'] ?? 0);
        $allowed = $this->facilityScope->getActorFacilityIds();

        if (empty($allowed)) {
            throw new \RuntimeException('Visit not accessible', 404);
        }

        if (in_array($visitFacilityId, $allowed, true)) {
            return;
        }

        if ($visitFacilityId === 0) {
            $defaultFacility = $this->resolveDefaultFacilityId();
            if ($defaultFacility > 0 && in_array($defaultFacility, $allowed, true)) {
                return;
            }
        }

        throw new \RuntimeException('Visit not accessible', 404);
    }

    public function assertFacilityAccessible(int $facilityId): void
    {
        if (!$this->facilityScope->shouldFilterByFacility()) {
            return;
        }

        $allowed = $this->facilityScope->getActorFacilityIds();
        if (!in_array($facilityId, $allowed, true)) {
            throw new \RuntimeException('Facility not accessible', 403);
        }
    }

    public function resolveDefaultFacilityId(): int
    {
        if (!empty($_SESSION['facilityId'])) {
            $sessionId = (int) $_SESSION['facilityId'];
            if ($this->isServiceLocation($sessionId)) {
                return $sessionId;
            }
        }

        if (!empty($GLOBALS['encounter_facility'])) {
            $encounterFacilityId = (int) $GLOBALS['encounter_facility'];
            if ($this->isServiceLocation($encounterFacilityId)) {
                return $encounterFacilityId;
            }
        }

        return $this->firstServiceLocationId();
    }

    public function resolveQueueFacilityId(?int $requestedFacilityId = null): int
    {
        return $this->resolveDeskFacilityId($requestedFacilityId);
    }

    private function isServiceLocation(int $facilityId): bool
    {
        if ($facilityId <= 0) {
            return false;
        }

        $row = QueryUtils::querySingleRow(
            "SELECT id FROM facility WHERE id = ? AND service_location = 1 LIMIT 1",
            [$facilityId]
        );

        return is_array($row);
    }

    private function firstServiceLocationId(): int
    {
        $row = QueryUtils::querySingleRow(
            "SELECT id FROM facility WHERE service_location = 1 ORDER BY id ASC LIMIT 1"
        );

        return is_array($row) ? (int) ($row['id'] ?? 0) : 0;
    }

    public function buildOrphanRepairKey(int $facilityId, string $visitDate): string
    {
        return $facilityId . ':' . $visitDate;
    }

    public function orphanRepairScopedToEncounterFacility(): bool
    {
        return true;
    }

    /** @var array<string, true> */
    private static array $repairedKeys = [];

    /**
     * Visits created before facility scoping may have facility_id = 0.
     * Encounters from OpenEMR insert may also have facility_id = 0 even when the visit row is scoped.
     */
    public function repairOrphanVisits(int $facilityId, string $visitDate): void
    {
        if ($facilityId <= 0) {
            return;
        }

        $this->assertFacilityAccessible($facilityId);

        $key = $this->buildOrphanRepairKey($facilityId, $visitDate);
        if (isset(self::$repairedKeys[$key])) {
            return;
        }
        self::$repairedKeys[$key] = true;

        sqlStatement(
            "UPDATE new_visit v
             INNER JOIN form_encounter fe ON fe.encounter = v.encounter AND fe.pid = v.pid
             SET v.facility_id = fe.facility_id, v.updated_at = NOW()
             WHERE v.facility_id = 0 AND v.visit_date = ?
             AND fe.facility_id = ?
             AND v.state NOT IN ('completed', 'closed_unpaid', 'cancelled')",
            [$visitDate, $facilityId]
        );

        if ($this->shouldRunAggressiveOrphanRepair()) {
            // Encounter facility unset (common after insertEncounter) — attach today's orphans to this desk.
            sqlStatement(
                "UPDATE new_visit v
                 INNER JOIN form_encounter fe ON fe.encounter = v.encounter AND fe.pid = v.pid
                 SET v.facility_id = ?, v.updated_at = NOW()
                 WHERE v.facility_id = 0 AND v.visit_date = ?
                 AND (fe.facility_id = 0 OR fe.facility_id IS NULL)
                 AND v.state NOT IN ('completed', 'closed_unpaid', 'cancelled')",
                [$facilityId, $visitDate]
            );
        }

        $this->syncEncounterFacilitiesForDesk($facilityId, $visitDate);
    }

    private function shouldRunAggressiveOrphanRepair(): bool
    {
        return $this->config->getInt('enable_aggressive_orphan_facility_repair', 0) === 1;
    }

    private function hasMultipleServiceLocations(): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM facility WHERE service_location = 1"
        );

        return is_array($row) && (int) ($row['cnt'] ?? 0) > 1;
    }

    public function syncEncounterFacilitiesForDesk(int $facilityId, string $visitDate): void
    {
        if ($facilityId <= 0) {
            return;
        }

        sqlStatement(
            "UPDATE form_encounter fe
             INNER JOIN new_visit v ON v.encounter = fe.encounter AND v.pid = fe.pid
             SET fe.facility_id = v.facility_id
             WHERE v.facility_id = ? AND v.visit_date = ?
             AND (fe.facility_id = 0 OR fe.facility_id IS NULL)
             AND v.state NOT IN ('completed', 'closed_unpaid', 'cancelled')",
            [$facilityId, $visitDate]
        );
    }

    /**
     * @param array<string, mixed> $visit
     * @return array<string, mixed>
     */
    public function normalizeVisitFacility(array $visit): array
    {
        $visitId = (int) ($visit['id'] ?? 0);
        $visitFacilityId = (int) ($visit['facility_id'] ?? 0);
        if ($visitId <= 0 || $visitFacilityId > 0) {
            return $visit;
        }

        $encounterRow = QueryUtils::querySingleRow(
            "SELECT fe.facility_id FROM new_visit v
             INNER JOIN form_encounter fe ON fe.encounter = v.encounter AND fe.pid = v.pid
             WHERE v.id = ?",
            [$visitId]
        );
        $facilityId = is_array($encounterRow) ? (int) ($encounterRow['facility_id'] ?? 0) : 0;
        if ($facilityId <= 0) {
            $facilityId = $this->resolveDefaultFacilityId();
        }
        if ($facilityId <= 0) {
            return $visit;
        }

        $this->assertFacilityAccessible($facilityId);
        $visit['facility_id'] = $facilityId;

        if ($visitFacilityId === 0) {
            sqlStatement(
                "UPDATE new_visit SET facility_id = ?, updated_at = NOW() WHERE id = ? AND facility_id = 0",
                [$facilityId, $visitId]
            );
            $this->syncEncounterFacilitiesForDesk($facilityId, (string) ($visit['visit_date'] ?? date('Y-m-d')));
        }

        return $visit;
    }
}

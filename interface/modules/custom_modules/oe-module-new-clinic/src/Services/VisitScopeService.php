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
    private ?FacilityScopeService $facilityScope = null;
    private ?ClinicConfigService $config = null;

    public function __construct(
        ?FacilityScopeService $facilityScope = null,
        ?ClinicConfigService $config = null,
    ) {
        $this->facilityScope = $facilityScope;
        $this->config = $config;
    }

    private function getFacilityScope(): FacilityScopeService
    {
        if ($this->facilityScope === null) {
            $this->facilityScope = new FacilityScopeService();
        }

        return $this->facilityScope;
    }

    private function getConfig(): ClinicConfigService
    {
        if ($this->config === null) {
            $this->config = new ClinicConfigService();
        }

        return $this->config;
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
                // SCALE-1.1: read-only ajax actions call session_write_close() before
                // dispatch, so guard this diagnostic flag — a write after close is
                // silently dropped. Only set it while the session is still open.
                if ($this->hasMultipleServiceLocations() && session_status() === PHP_SESSION_ACTIVE) {
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
        if (!$this->getFacilityScope()->shouldFilterByFacility()) {
            return;
        }

        $visitFacilityId = (int) ($visit['facility_id'] ?? 0);
        $allowed = $this->getFacilityScope()->getActorFacilityIds();

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
        if (!$this->getFacilityScope()->shouldFilterByFacility()) {
            return;
        }

        $allowed = $this->getFacilityScope()->getActorFacilityIds();
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

    /**
     * Resolve encounter for clinical strips: explicit id wins, else latest active visit.
     */
    public function resolveActiveEncounterId(int $pid, ?int $encounterId = null): int
    {
        if ($encounterId !== null && $encounterId > 0) {
            return $encounterId;
        }

        $row = QueryUtils::querySingleRow(
            "SELECT encounter FROM new_visit
             WHERE pid = ?
             AND state NOT IN ('completed', 'closed_unpaid', 'cancelled')
             AND encounter > 0
             ORDER BY id DESC LIMIT 1",
            [$pid]
        );

        return is_array($row) ? (int) ($row['encounter'] ?? 0) : 0;
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
     *
     * Since queues now show all active visits regardless of date, we run two
     * repair passes per request:
     *   1. Date-scoped pass for $visitDate (fast, covers the common same-day case).
     *   2. Active-visits-only pass with no date filter (catches midnight carry-over
     *      and any visits left unrepaired from previous days).
     * Both passes are deduplicated with static caches to stay cheap.
     */
    public function repairOrphanVisits(int $facilityId, string $visitDate): void
    {
        if ($facilityId <= 0) {
            return;
        }

        $this->assertFacilityAccessible($facilityId);

        // Request-local fast path: never re-run for the same facility+date within
        // one request (preserves the original static-cache dedup).
        $requestKey = $this->buildOrphanRepairKey($facilityId, $visitDate);
        if (isset(self::$repairedKeys[$requestKey])) {
            return;
        }
        self::$repairedKeys[$requestKey] = true;

        // SCALE-1.3 — cross-request throttle. These UPDATE…JOINs used to run on EVERY
        // poll from EVERY tab (the static cache only dedupes within one request, and
        // each poll is a fresh request). Now a DB lock lets at most ONE request per
        // facility+date run the writes every 5 minutes; the rest skip them. Skipping
        // loses nothing — the queues already reflect the last repair, and a genuinely
        // new orphan is caught on the next 5-minute window.
        if (!$this->claimMaintenanceLock('repair_orphans_' . $facilityId . '_' . $visitDate)) {
            return;
        }

        // Pass 1 — date-scoped (common same-day case).
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

        // Pass 2 — active orphans from any date (handles midnight carry-over visits).
        sqlStatement(
            "UPDATE new_visit v
             INNER JOIN form_encounter fe ON fe.encounter = v.encounter AND fe.pid = v.pid
             SET v.facility_id = fe.facility_id, v.updated_at = NOW()
             WHERE v.facility_id = 0
             AND fe.facility_id = ?
             AND v.state NOT IN ('completed', 'closed_unpaid', 'cancelled')",
            [$facilityId]
        );
    }

    /**
     * Try to claim a short-lived maintenance lock (SCALE-1.3).
     *
     * Returns true if THIS request won the claim (and should run the work), false if
     * another request already holds an unexpired lock.
     *
     * Uses a unique owner token + read-back rather than affected-rows: OpenEMR's
     * sqlStatement() logs each query, so affected_rows() reflects the LOGGING insert,
     * not our statement — it can't tell a win from a no-op. Instead: (1) take over an
     * expired lock, (2) INSERT IGNORE one if absent, both stamping our token, then
     * (3) read back the owner. We won iff the lock now carries our token. Under a
     * race, InnoDB row locking + the PK serialise the writers so exactly one token
     * survives.
     *
     * Fails OPEN (returns true) if the lock table isn't installed yet, so behaviour
     * degrades to the old always-run rather than silently never-run.
     */
    private function claimMaintenanceLock(string $lockKey, int $ttlSeconds = 300): bool
    {
        try {
            // Fast path (honours R2 — reads don't write): if a live lock already
            // exists we've lost, so return WITHOUT writing. This keeps the common
            // "poll loses" case a single shared read instead of every poll taking a
            // write lock on the same lock row (which would re-introduce the very
            // contention this throttle exists to remove). Only the ~once-per-window
            // winner falls through to the write path below.
            $live = QueryUtils::querySingleRow(
                'SELECT (locked_until > NOW()) AS live FROM new_clinic_maintenance_lock WHERE lock_key = ?',
                [$lockKey]
            );
            if (is_array($live) && (int) ($live['live'] ?? 0) === 1) {
                return false;
            }

            $token = bin2hex(random_bytes(16));
            // Take over the lock only if the current one has expired.
            sqlStatement(
                'UPDATE new_clinic_maintenance_lock
                 SET locked_until = DATE_ADD(NOW(), INTERVAL ? SECOND), owner_token = ?
                 WHERE lock_key = ? AND locked_until < NOW()',
                [$ttlSeconds, $token, $lockKey]
            );
            // Create it if absent; ignored if another request just made it.
            sqlStatement(
                'INSERT IGNORE INTO new_clinic_maintenance_lock (lock_key, locked_until, owner_token)
                 VALUES (?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?)',
                [$lockKey, $ttlSeconds, $token]
            );
            $row = QueryUtils::querySingleRow(
                'SELECT owner_token FROM new_clinic_maintenance_lock WHERE lock_key = ?',
                [$lockKey]
            );
        } catch (\Throwable) {
            return true;
        }

        return is_array($row) && (string) ($row['owner_token'] ?? '') === $token;
    }

    private function shouldRunAggressiveOrphanRepair(): bool
    {
        return $this->getConfig()->getInt('enable_aggressive_orphan_facility_repair', 0) === 1;
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

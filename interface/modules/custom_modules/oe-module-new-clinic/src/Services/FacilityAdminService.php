<?php

/**
 * Native facility editor for Clinic Setup — Admin Hub "Clinic" tab
 * (D-ADMIN native facility editor).
 *
 * Wraps the core OpenEMR\Services\FacilityService rather than touching the
 * `facility` table directly — that table is shared with the rest of stock
 * OpenEMR (scheduling, billing, encounters), so writes must go through the
 * same validated path the stock screen uses. Only a curated, cash-clinic
 * relevant field subset is exposed here (name, contact, address, service /
 * billing location, active state); US-billing plumbing (NPI, EIN, taxonomy,
 * x12 sender id, OID, IBAN, mailing address, POS code) stays on the stock
 * "Advanced (stock form)" screen, matching the native-editor pattern used
 * elsewhere in this module (issue/history/immunization/referral editors).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Services\FacilityService;

class FacilityAdminService
{
    /**
     * Lazy — the core FacilityService constructor runs a UUID backfill query and
     * builds a validator, so we must NOT construct it on the read path. listForAdmin()
     * (called on every admin.config load) uses plain QueryUtils; only save() needs the
     * core service. Kept injectable for tests.
     */
    private ?FacilityService $facilityService;

    public function __construct(?FacilityService $facilityService = null)
    {
        $this->facilityService = $facilityService;
    }

    private function facilityService(): FacilityService
    {
        return $this->facilityService ??= new FacilityService();
    }

    /** Same core ACL the stock facilities.php screen requires, plus the module's own admin gate. */
    public function assertCanManageFacilities(): void
    {
        if (!AclMain::aclCheckCore('new_clinic', 'new_admin')) {
            throw new \RuntimeException('Forbidden', 403);
        }
        if (!AclMain::aclCheckCore('admin', 'users')) {
            throw new \RuntimeException('Core user admin permission required', 403);
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listForAdmin(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT id, name, phone, email, website, street, city, state, postal_code,
                    country_code, color, service_location, billing_location, inactive
             FROM facility
             ORDER BY inactive ASC, name ASC"
        ) ?: [];

        return array_map([$this, 'shape'], $rows);
    }

    /**
     * Create (id <= 0) or update (id > 0) a facility.
     *
     * @param array<string, mixed> $input
     * @return array<int, array<string, mixed>>
     */
    public function save(array $input, int $actorUserId): array
    {
        $this->assertCanManageFacilities();

        $facilityId = (int) ($input['id'] ?? 0);
        $name = mb_substr(trim((string) ($input['name'] ?? '')), 0, 255);
        if ($name === '') {
            throw new \InvalidArgumentException('Facility name is required');
        }

        $values = [
            'name' => $name,
            'phone' => mb_substr(trim((string) ($input['phone'] ?? '')), 0, 30),
            'email' => mb_substr(trim((string) ($input['email'] ?? '')), 0, 255),
            'website' => mb_substr(trim((string) ($input['website'] ?? '')), 0, 255),
            'street' => mb_substr(trim((string) ($input['street'] ?? '')), 0, 255),
            'city' => mb_substr(trim((string) ($input['city'] ?? '')), 0, 255),
            'state' => mb_substr(trim((string) ($input['state'] ?? '')), 0, 50),
            'postal_code' => mb_substr(trim((string) ($input['postal_code'] ?? '')), 0, 11),
            'country_code' => mb_substr(trim((string) ($input['country_code'] ?? '')), 0, 30),
            'color' => mb_substr(trim((string) ($input['color'] ?? '')), 0, 7),
            'service_location' => !empty($input['service_location']) ? 1 : 0,
            'billing_location' => !empty($input['billing_location']) ? 1 : 0,
            'inactive' => !empty($input['inactive']) ? 1 : 0,
        ];

        if ($facilityId > 0) {
            $this->assertFacilityExists($facilityId);
            $values['id'] = $facilityId;
            $this->facilityService()->updateFacility($values);
            // Some provider-based code looks up facility by name instead of id
            // (see FacilityService::updateUsersFacility docblock) — keep the
            // denormalized users.facility column in sync, same as stock facilities.php.
            $this->facilityService()->updateUsersFacility($name, $facilityId);
            $action = 'updated';
            $savedId = $facilityId;
        } else {
            $savedId = (int) $this->facilityService()->insertFacility($values);
            $action = 'created';
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'facility',
            $actorUserId,
            1,
            $action . ' id=' . $savedId
        );

        return $this->listForAdmin();
    }

    private function assertFacilityExists(int $facilityId): void
    {
        $row = QueryUtils::querySingleRow('SELECT id FROM facility WHERE id = ?', [$facilityId]);
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Facility not found');
        }
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function shape(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'name' => (string) ($row['name'] ?? ''),
            'phone' => (string) ($row['phone'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
            'website' => (string) ($row['website'] ?? ''),
            'street' => (string) ($row['street'] ?? ''),
            'city' => (string) ($row['city'] ?? ''),
            'state' => (string) ($row['state'] ?? ''),
            'postal_code' => (string) ($row['postal_code'] ?? ''),
            'country_code' => (string) ($row['country_code'] ?? ''),
            'color' => (string) ($row['color'] ?? ''),
            'service_location' => (int) ($row['service_location'] ?? 0) === 1,
            'billing_location' => (int) ($row['billing_location'] ?? 0) === 1,
            'inactive' => (int) ($row['inactive'] ?? 0) === 1,
        ];
    }
}

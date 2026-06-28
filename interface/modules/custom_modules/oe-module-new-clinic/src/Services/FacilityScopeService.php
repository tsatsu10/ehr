<?php

/**
 * Facility scope for patient search and preview (M1a-F12)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class FacilityScopeService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService()
    ) {
    }

    public function shouldFilterByFacility(): bool
    {
        global $GLOBALS;

        if (empty($GLOBALS['login_into_facility'])) {
            return false;
        }

        if ($this->canSearchAllFacilities()) {
            return false;
        }

        return true;
    }

    public function canSearchAllFacilities(): bool
    {
        if ($this->config->getInt('search_all_facilities_for_admin', 1) !== 1) {
            return false;
        }

        return AclMain::aclCheckCore('admin', 'super')
            || AclMain::aclCheckCore('admin', 'users');
    }

    /**
     * @return array{sql: string, bind: array<int|string>}
     */
    public function getPatientFilterClause(string $patientAlias = 'pd'): array
    {
        if (!$this->shouldFilterByFacility()) {
            return ['sql' => '', 'bind' => []];
        }

        $facilityIds = $this->getActorFacilityIds();
        if (empty($facilityIds)) {
            return ['sql' => ' AND 1 = 0', 'bind' => []];
        }

        global $GLOBALS;
        $field = $GLOBALS['pt_restrict_field'] ?? 'facility_id';
        $field = preg_replace('/[^a-zA-Z0-9_]/', '', (string) $field) ?: 'facility_id';

        $placeholders = implode(',', array_fill(0, count($facilityIds), '?'));

        return [
            'sql' => " AND ({$patientAlias}.{$field} IN ({$placeholders}) OR {$patientAlias}.{$field} IS NULL OR {$patientAlias}.{$field} = '' OR {$patientAlias}.{$field} = '0')",
            'bind' => $facilityIds,
        ];
    }

    /**
     * @return array{sql: string, bind: array<int|string>}
     */
    public function getVisitFacilityFilterClause(string $visitAlias = 'v'): array
    {
        if (!$this->shouldFilterByFacility()) {
            return ['sql' => '', 'bind' => []];
        }

        $facilityIds = $this->getActorFacilityIds();
        if (empty($facilityIds)) {
            return ['sql' => ' AND 1 = 0', 'bind' => []];
        }

        $placeholders = implode(',', array_fill(0, count($facilityIds), '?'));

        return [
            'sql' => " AND ({$visitAlias}.facility_id IN ({$placeholders}) OR {$visitAlias}.facility_id = 0)",
            'bind' => $facilityIds,
        ];
    }

    public function assertPatientAccessible(int $pid): void
    {
        if (!$this->shouldFilterByFacility()) {
            return;
        }

        $filter = $this->getPatientFilterClause('pd');
        $sql = "SELECT pid FROM patient_data pd WHERE pd.pid = ? {$filter['sql']} LIMIT 1";
        $bind = array_merge([$pid], $filter['bind']);
        $row = QueryUtils::querySingleRow($sql, $bind);

        if (empty($row)) {
            throw new \RuntimeException('Patient not found', 404);
        }
    }

    /**
     * @return list<int>
     */
    public function getActorFacilityIds(): array
    {
        $ids = [];

        if (!empty($_SESSION['facilityId'])) {
            $ids[] = (int) $_SESSION['facilityId'];
        }

        if (!empty($_SESSION['authUserID'])) {
            $rows = QueryUtils::fetchRecords(
                "SELECT DISTINCT facility_id FROM users_facility WHERE tablename = 'users' AND table_id = ?",
                [(int) $_SESSION['authUserID']]
            ) ?: [];

            foreach ($rows as $row) {
                if (!empty($row['facility_id'])) {
                    $ids[] = (int) $row['facility_id'];
                }
            }
        }

        $ids = array_values(array_unique(array_filter($ids)));

        return $ids;
    }
}

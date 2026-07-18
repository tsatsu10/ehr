<?php

/**
 * S1 Scheduling & Flow — shell bootstrap payload (filters, deep links)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Services\UserService;

class SchedulingShellService
{
    public function __construct(
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getBootstrapPayload(int $facilityId): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);

        return [
            'default_facility_id' => $facilityId,
            'default_date' => $this->clinicDate->today(),
            'facilities' => $this->listServiceFacilities(),
            'providers' => $this->listCalendarProviders($facilityId),
        ];
    }

    /**
     * Deep links for calendar / flow board / recalls — always the S1 hub;
     * the stock calendar/tracker/recalls screens are no longer linked.
     *
     * @return array{scheduling_url: string, flow_board_url: string, recalls_url: string}
     */
    public function resolveIntegrationUrls(int $facilityId): array
    {
        $webroot = (string) ($GLOBALS['webroot'] ?? '');
        $modulePublic = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/';

        return [
            'scheduling_url' => $modulePublic . 'scheduling/index.php?lens=calendar',
            'flow_board_url' => $modulePublic . 'scheduling/index.php?lens=flow',
            'recalls_url' => $modulePublic . 'scheduling/index.php?lens=recalls',
        ];
    }

    /**
     * @return list<array{id: int, label: string}>
     */
    private function listServiceFacilities(): array
    {
        $records = QueryUtils::fetchRecords(
            "SELECT id, name FROM facility WHERE service_location = 1 ORDER BY name ASC"
        ) ?: [];

        $rows = [];
        foreach ($records as $row) {
            $id = (int) ($row['id'] ?? 0);
            if ($id <= 0) {
                continue;
            }
            $rows[] = [
                'id' => $id,
                'label' => trim((string) ($row['name'] ?? '')) ?: ('Facility ' . $id),
            ];
        }

        return $rows;
    }

    /**
     * @return list<array{id: int, label: string}>
     */
    private function listCalendarProviders(int $facilityId): array
    {
        $userService = new UserService();
        $records = $userService->getUsersForCalendar($facilityId > 0 ? (string) $facilityId : '') ?: [];

        $rows = [];
        foreach ($records as $row) {
            $id = (int) ($row['id'] ?? 0);
            if ($id <= 0) {
                continue;
            }
            $fname = trim((string) ($row['fname'] ?? ''));
            $lname = trim((string) ($row['lname'] ?? ''));
            $label = trim($lname . ', ' . $fname);
            $rows[] = [
                'id' => $id,
                'label' => $label !== ',' ? $label : (string) ($row['username'] ?? ('User ' . $id)),
            ];
        }

        return $rows;
    }
}

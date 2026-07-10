<?php

/**
 * M0-F07 — REST read surface for the New Clinic visit queue.
 *
 * For external polling (dashboards, reporting/BI tools) authenticated via the
 * standard OpenEMR OAuth2 REST flow. Desk islands never call this: they use
 * ajax.php (see CLAUDE.md "never fetch directly, never REST/FHIR for desk work").
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Rest;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Http\HttpRestRequest;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

final class NewClinicVisitsRestController
{
    /** Any one of these New Clinic ACOs may read the queue (mirrors AjaxController::requireClinicDeskAcl). */
    private const READ_ACOS = [
        'new_reception', 'new_nurse', 'new_doctor', 'new_lab',
        'new_pharmacy', 'new_cashier', 'new_admin', 'reports',
    ];

    public function __construct(
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * GET /api/new/visits?date=&state=&facility_id=
     *
     * @return array{data: array<int, array<string, mixed>>}
     */
    public function getAll(HttpRestRequest $request): array
    {
        $this->assertReadAcl($request);

        $query = $request->query->all();

        $requestedFacilityId = !empty($query['facility_id']) ? (int) $query['facility_id'] : null;
        $facilityId = $this->visitScope->resolveActorFacilityId($requestedFacilityId);

        $state = $query['state'] ?? null;
        if (is_string($state) && str_contains($state, ',')) {
            $state = array_values(array_filter(array_map('trim', explode(',', $state))));
        }

        $visits = $this->queueService->getQueue([
            'facility_id' => $facilityId,
            'visit_date' => $query['date'] ?? null,
            'state' => $state,
        ]);

        return [
            'data' => array_map([$this, 'toResource'], $visits),
        ];
    }

    private function assertReadAcl(HttpRestRequest $request): void
    {
        $user = $request->getSession()->get('authUser');
        foreach (self::READ_ACOS as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco, $user)) {
                return;
            }
        }

        throw new AccessDeniedHttpException('Organization policy does not have permit access resource');
    }

    /**
     * @param array<string, mixed> $visit
     * @return array<string, mixed>
     */
    private function toResource(array $visit): array
    {
        return [
            'id' => (int) ($visit['id'] ?? 0),
            'pid' => (int) ($visit['pid'] ?? 0),
            'encounter' => (int) ($visit['encounter'] ?? 0),
            'facility_id' => (int) ($visit['facility_id'] ?? 0),
            'visit_date' => (string) ($visit['visit_date'] ?? ''),
            'visit_type_id' => isset($visit['visit_type_id']) ? (int) $visit['visit_type_id'] : null,
            'service_profile' => $visit['service_profile'] ?? null,
            'queue_number' => isset($visit['queue_number']) ? (int) $visit['queue_number'] : null,
            'state' => (string) ($visit['state'] ?? ''),
            'is_urgent' => !empty($visit['is_urgent']),
            'started_at' => $visit['started_at'] ?? null,
            'completed_at' => $visit['completed_at'] ?? null,
            'patient_name' => trim(($visit['fname'] ?? '') . ' ' . ($visit['lname'] ?? '')),
            'pubpid' => $visit['pubpid'] ?? null,
        ];
    }
}

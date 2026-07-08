<?php

/**
 * admin.* ajax actions (AUDIT-10h).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\AclAdminService;
use OpenEMR\Modules\NewClinic\Services\ClinicAdminService;
use OpenEMR\Modules\NewClinic\Services\FacilityUserAdminService;
use OpenEMR\Modules\NewClinic\Services\FeeScheduleAdminService;
use OpenEMR\Modules\NewClinic\Services\GeoService;
use OpenEMR\Modules\NewClinic\Services\ReconciliationService;
use OpenEMR\Modules\NewClinic\Services\StaffAccessSummaryService;
use OpenEMR\Modules\NewClinic\Services\StaffAdminService;
use OpenEMR\Modules\NewClinic\Services\VisitTypeAdminService;

final class AdminActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'admin.geo.regions',
        'admin.geo.districts',
        'admin.config',
        'admin.config.save',
        'admin.completion_weights.save',
        'admin.visit_type.save',
        'admin.visit_type.archive',
        'admin.fee.save',
        'admin.fee.archive',
        'admin.fee.billing_codes',
        'admin.fee.import',
        'admin.roles.grant_self',
        'admin.roles.templates',
        'admin.staff.list',
        'admin.staff.create',
        'admin.staff.deactivate',
        'admin.staff.access_summary',
        'admin.facility_user.list',
        'admin.facility_user.get',
        'admin.facility_user.save',
        'admin.facility_user.matrix',
        'admin.staff.get',
        'admin.staff.update',
        'admin.staff.reset_password',
        'admin.acl.users',
        'admin.acl.membership',
        'admin.acl.membership_add',
        'admin.acl.membership_remove',
        'admin.acl.groups',
        'admin.acl.group_permissions',
        'admin.acl.group_permissions_add',
        'admin.acl.group_permissions_remove',
        'admin.acl.return_values',
        'admin.acl.group_create',
        'admin.acl.group_remove',
        'admin.reconciliation.run',
        'admin.profile.apply_cash_clinic',
        'admin.forms_catalog.set_state',
        'admin.health_status',
        'admin.backup.run',
        'admin.backup.complete',
        'admin.setup.mark_item',
        'admin.setup.complete',
        'admin.config.export',
        'admin.config.import'
    ];

    public function __construct(
        private readonly AjaxController $host,
    ) {
    }

    public function supports(string $action): bool
    {
        return in_array($action, self::ACTIONS, true);
    }

    public function handle(string $action, string $method, int $userId): void
    {
        switch ($action) {
                case 'admin.geo.regions':
                    $country = (string) ($_REQUEST['country'] ?? 'GH');
                    $this->host->respond(true, 'ok', ['regions' => $this->host->svc(GeoService::class)->listRegions($country)]);
                    break;
                case 'admin.geo.districts':
                    $regionCode = (string) ($_REQUEST['region_code'] ?? '');
                    $this->host->respond(true, 'ok', [
                        'districts' => $this->host->svc(GeoService::class)->listDistricts($regionCode),
                    ]);
                    break;
                case 'admin.config':
                    $scope = strtolower(trim((string) ($_REQUEST['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($_REQUEST['facility_id'] ?? 0);
                    if ($scope === 'facility' && $requestedFacilityId <= 0 && !empty($_SESSION['facilityId'])) {
                        $requestedFacilityId = (int) $_SESSION['facilityId'];
                    }
                    $payload = $this->host->svc(ClinicAdminService::class)->getSettingsPayload(
                        $scope,
                        $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->host->respond(true, 'ok', $payload);
                    break;
                case 'admin.config.save':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->host->svc(ClinicAdminService::class)->saveSettings(
                        $scope,
                        (array) ($body['settings'] ?? []),
                        $userId,
                        $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->host->respond(true, 'Settings saved', $payload);
                    break;
                case 'admin.completion_weights.save':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->host->svc(ClinicAdminService::class)->saveCompletionFieldWeights(
                        (array) ($body['items'] ?? []),
                        $userId,
                        $scope,
                        $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->host->respond(true, 'Completion weights saved', $payload);
                    break;
                case 'admin.visit_type.save':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $facilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->host->svc(VisitTypeAdminService::class)->save(
                        $facilityId,
                        (array) ($body['visit_type'] ?? $body),
                        $userId
                    );
                    $this->host->respond(true, 'Visit type saved', $payload);
                    break;
                case 'admin.visit_type.archive':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $facilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->host->svc(VisitTypeAdminService::class)->archive(
                        $facilityId,
                        (int) ($body['visit_type_id'] ?? 0),
                        $userId
                    );
                    $this->host->respond(true, 'Visit type archived', $payload);
                    break;
                case 'admin.fee.save':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $facilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->host->svc(FeeScheduleAdminService::class)->save(
                        $facilityId,
                        (array) ($body['fee'] ?? $body),
                        $userId
                    );
                    $this->host->respond(true, 'Fee line saved', $payload);
                    break;
                case 'admin.fee.archive':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $facilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->host->svc(FeeScheduleAdminService::class)->archive(
                        $facilityId,
                        (int) ($body['fee_id'] ?? 0),
                        $userId
                    );
                    $this->host->respond(true, 'Fee line archived', $payload);
                    break;
                case 'admin.fee.billing_codes':
                    $codeType = (string) ($_REQUEST['code_type'] ?? '');
                    $query = (string) ($_REQUEST['q'] ?? '');
                    $codes = $this->host->svc(FeeScheduleAdminService::class)->searchBillingCodes($codeType, $query);
                    $this->host->respond(true, 'ok', ['billing_codes' => $codes]);
                    break;
                case 'admin.fee.import':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $facilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->host->svc(FeeScheduleAdminService::class)->importCsv(
                        $facilityId,
                        (string) ($body['csv'] ?? ''),
                        $userId
                    );
                    $this->host->respond(true, 'Fees imported', $payload);
                    break;
                case 'admin.roles.grant_self':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $this->host->requireSuperAdmin();
                    $username = (string) ($_SESSION['authUser'] ?? '');
                    if ($username === '') {
                        $this->host->respond(false, 'No logged-in user', [], 401);
                    }
                    $payload = $this->host->svc(ClinicAdminService::class)->grantDeskRolesToCurrentUser($username, $userId);
                    $this->host->respond(true, 'Roles granted — log out and back in for ACL to take effect', $payload);
                    break;
                case 'admin.roles.templates':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    $this->host->respond(true, 'ok', $this->host->svc(StaffAdminService::class)->getTemplatesPayload($facilityId));
                    break;
                case 'admin.staff.list':
                    $page = max(1, (int) ($_REQUEST['page'] ?? 1));
                    $pageSize = max(1, min(100, (int) ($_REQUEST['page_size'] ?? 25)));
                    $search = (string) ($_REQUEST['search'] ?? '');
                    $status = (string) ($_REQUEST['status'] ?? 'active');
                    $this->host->respond(true, 'ok', $this->host->svc(StaffAdminService::class)->listStaff($page, $pageSize, $search, $status));
                    break;
                case 'admin.staff.create':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $body['facility_id'] = (int) ($body['facility_id'] ?? $this->host->resolveRequestFacilityId());
                    $payload = $this->host->svc(StaffAdminService::class)->createFromTemplate($body, $userId);
                    $this->host->respond(true, 'Staff created', $payload);
                    break;
                case 'admin.staff.deactivate':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $targetUserId = (int) ($body['user_id'] ?? 0);
                    if ($targetUserId <= 0) {
                        $this->host->respond(false, 'user_id required', [], 400);
                    }
                    $this->host->svc(StaffAdminService::class)->deactivateUser($targetUserId, $userId);
                    $this->host->respond(true, 'Staff deactivated');
                    break;
                case 'admin.staff.access_summary':
                    $targetUserId = (int) ($_REQUEST['user_id'] ?? 0);
                    if ($targetUserId <= 0) {
                        $this->host->respond(false, 'user_id required', [], 400);
                    }
                    $this->host->respond(true, 'ok', $this->host->svc(StaffAccessSummaryService::class)->getSummary($targetUserId));
                    break;
                case 'admin.facility_user.list':
                    $this->host->respond(true, 'ok', $this->host->svc(FacilityUserAdminService::class)->listMatrix());
                    break;
                case 'admin.facility_user.get':
                    $targetUserId = (int) ($_REQUEST['user_id'] ?? 0);
                    $facId = (int) ($_REQUEST['facility_id'] ?? $this->host->resolveRequestFacilityId());
                    if ($targetUserId <= 0 || $facId <= 0) {
                        $this->host->respond(false, 'user_id and facility_id required', [], 400);
                    }
                    $this->host->respond(true, 'ok', $this->host->svc(FacilityUserAdminService::class)->getForUserFacility($targetUserId, $facId));
                    break;
                case 'admin.facility_user.save':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $targetUserId = (int) ($body['user_id'] ?? 0);
                    $facId = (int) ($body['facility_id'] ?? 0);
                    $values = is_array($body['values'] ?? null) ? $body['values'] : [];
                    if ($targetUserId <= 0 || $facId <= 0) {
                        $this->host->respond(false, 'user_id and facility_id required', [], 400);
                    }
                    $this->host->svc(FacilityUserAdminService::class)->saveForUserFacility($targetUserId, $facId, $values);
                    $this->host->respond(true, 'Facility user fields saved');
                    break;
                case 'admin.facility_user.matrix':
                    $facilityFilter = (int) ($_REQUEST['facility_id'] ?? 0);
                    $search = (string) ($_REQUEST['search'] ?? '');
                    $this->host->respond(
                        true,
                        'ok',
                        $this->host->svc(FacilityUserAdminService::class)->getMatrixGrid(
                            $facilityFilter > 0 ? $facilityFilter : null,
                            $search
                        )
                    );
                    break;
                case 'admin.staff.get':
                    $targetUserId = (int) ($_REQUEST['user_id'] ?? 0);
                    if ($targetUserId <= 0) {
                        $this->host->respond(false, 'user_id required', [], 400);
                    }
                    $this->host->respond(true, 'ok', $this->host->svc(StaffAdminService::class)->getUserDetail($targetUserId));
                    break;
                case 'admin.staff.update':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $targetUserId = (int) ($body['user_id'] ?? 0);
                    if ($targetUserId <= 0) {
                        $this->host->respond(false, 'user_id required', [], 400);
                    }
                    $this->host->respond(true, 'Staff updated', $this->host->svc(StaffAdminService::class)->updateUser($targetUserId, $body, $userId));
                    break;
                case 'admin.staff.reset_password':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $targetUserId = (int) ($body['user_id'] ?? 0);
                    if ($targetUserId <= 0) {
                        $this->host->respond(false, 'user_id required', [], 400);
                    }
                    $this->host->svc(StaffAdminService::class)->resetPassword(
                        $targetUserId,
                        (string) ($body['admin_password'] ?? ''),
                        (string) ($body['new_password'] ?? ''),
                        $userId
                    );
                    $this->host->respond(true, 'Password reset');
                    break;
                case 'admin.acl.users':
                    $this->host->respond(true, 'ok', $this->host->svc(AclAdminService::class)->listUsers());
                    break;
                case 'admin.acl.membership':
                    $username = (string) ($_REQUEST['username'] ?? '');
                    $this->host->respond(true, 'ok', $this->host->svc(AclAdminService::class)->getMembership($username));
                    break;
                case 'admin.acl.membership_add':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $username = (string) ($body['username'] ?? '');
                    $groups = is_array($body['groups'] ?? null) ? $body['groups'] : [];
                    $this->host->respond(true, 'Membership updated', $this->host->svc(AclAdminService::class)->addMembership($username, $groups));
                    break;
                case 'admin.acl.membership_remove':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $username = (string) ($body['username'] ?? '');
                    $groups = is_array($body['groups'] ?? null) ? $body['groups'] : [];
                    $this->host->respond(true, 'Membership updated', $this->host->svc(AclAdminService::class)->removeMembership($username, $groups));
                    break;
                case 'admin.acl.groups':
                    $this->host->respond(true, 'ok', $this->host->svc(AclAdminService::class)->listGroups());
                    break;
                case 'admin.acl.group_permissions':
                    $group = (string) ($_REQUEST['group'] ?? '');
                    $returnValue = (string) ($_REQUEST['return_value'] ?? '');
                    $this->host->respond(true, 'ok', $this->host->svc(AclAdminService::class)->getGroupPermissions($group, $returnValue));
                    break;
                case 'admin.acl.group_permissions_add':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $this->host->respond(
                        true,
                        'Permissions updated',
                        $this->host->svc(AclAdminService::class)->addGroupPermissions(
                            (string) ($body['group'] ?? ''),
                            (string) ($body['return_value'] ?? ''),
                            is_array($body['aco_ids'] ?? null) ? $body['aco_ids'] : []
                        )
                    );
                    break;
                case 'admin.acl.group_permissions_remove':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $this->host->respond(
                        true,
                        'Permissions updated',
                        $this->host->svc(AclAdminService::class)->removeGroupPermissions(
                            (string) ($body['group'] ?? ''),
                            (string) ($body['return_value'] ?? ''),
                            is_array($body['aco_ids'] ?? null) ? $body['aco_ids'] : []
                        )
                    );
                    break;
                case 'admin.acl.return_values':
                    $this->host->respond(true, 'ok', $this->host->svc(AclAdminService::class)->listReturnValues());
                    break;
                case 'admin.acl.group_create':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $this->host->respond(
                        true,
                        'ACL group created',
                        $this->host->svc(AclAdminService::class)->createGroup(
                            (string) ($body['title'] ?? ''),
                            (string) ($body['identifier'] ?? ''),
                            (string) ($body['return_value'] ?? ''),
                            (string) ($body['description'] ?? '')
                        )
                    );
                    break;
                case 'admin.acl.group_remove':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $this->host->respond(
                        true,
                        'ACL group removed',
                        $this->host->svc(AclAdminService::class)->removeGroup(
                            (string) ($body['title'] ?? ''),
                            (string) ($body['return_value'] ?? '')
                        )
                    );
                    break;
                case 'admin.reconciliation.run':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $facilityId = $this->host->resolveRequestFacilityId();
                    $runDate = (string) ($body['run_date'] ?? date('Y-m-d'));
                    $result = $this->host->svc(ReconciliationService::class)->run($facilityId, $runDate, 'manual', $userId);
                    $this->host->respond(true, 'Reconciliation complete', $result);
                    break;
                case 'admin.profile.apply_cash_clinic':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $this->host->requireSuperAdmin();
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $payload = $this->host->svc(ClinicAdminService::class)->applyCashClinicProfile(
                        $scope,
                        $userId,
                        $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->host->respond(true, 'Cash clinic profile applied', $payload);
                    break;
                case 'admin.forms_catalog.set_state':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $registryId = (int) ($body['registry_id'] ?? 0);
                    $enabled = !empty($body['enabled']);
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->host->svc(ClinicAdminService::class)->setFormsCatalogState(
                            $scope,
                            $registryId,
                            $enabled,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->host->respond(true, 'Form registry updated', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'admin.health_status':
                    $params = $this->host->readRequestParams($method);
                    $scope = strtolower(trim((string) ($params['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($params['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $this->host->respond(true, 'ok', [
                        'system_health' => $this->host->svc(ClinicAdminService::class)->getSystemHealth(
                            $scope,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        ),
                    ]);
                    break;
                case 'admin.backup.run':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->host->svc(ClinicAdminService::class)->initiateBackupRun(
                            $scope,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->host->respond(true, 'Backup started', $payload);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'admin.backup.complete':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $runId = (int) ($body['run_id'] ?? 0);
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->host->svc(ClinicAdminService::class)->completeBackupRun(
                            $scope,
                            $userId,
                            $runId > 0 ? $runId : null,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->host->respond(true, 'Backup marked complete', $payload);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'admin.setup.mark_item':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $checklistKey = trim((string) ($body['checklist_key'] ?? ''));
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->host->svc(ClinicAdminService::class)->markSetupItem(
                            $scope,
                            $checklistKey,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->host->respond(true, 'Setup item marked', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    }
                    break;
                case 'admin.setup.complete':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->host->svc(ClinicAdminService::class)->markSetupComplete(
                            $scope,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->host->respond(true, 'Setup marked complete', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    }
                    break;
                case 'admin.config.export':
                    $scope = strtolower(trim((string) ($_REQUEST['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($_REQUEST['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->host->svc(ClinicAdminService::class)->exportConfigSnapshot(
                            $scope,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->host->respond(true, 'Config export ready', $payload);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'admin.config.import':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $snapshot = is_array($body['snapshot'] ?? null) ? $body['snapshot'] : [];
                    $dryRun = !empty($body['dry_run']);
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->host->svc(ClinicAdminService::class)->importConfigSnapshot(
                            $scope,
                            $snapshot,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null,
                            $dryRun
                        );
                        $message = $dryRun ? 'Config import preview ready' : 'Config import complete';
                        $this->host->respond(true, $message, $payload);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    }
                    break;

            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}

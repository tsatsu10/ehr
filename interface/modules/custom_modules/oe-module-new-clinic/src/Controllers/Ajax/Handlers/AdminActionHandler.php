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
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\DirectoryContactService;
use OpenEMR\Modules\NewClinic\Services\FacilityUserAdminService;
use OpenEMR\Modules\NewClinic\Services\FeeScheduleAdminService;
use OpenEMR\Modules\NewClinic\Services\GeoService;
use OpenEMR\Modules\NewClinic\Services\HisPackImportService;
use OpenEMR\Modules\NewClinic\Services\PatientImportService;
use OpenEMR\Modules\NewClinic\Services\PerfCounterService;
use OpenEMR\Modules\NewClinic\Services\ReconciliationService;
use OpenEMR\Modules\NewClinic\Services\AdminBackupService;
use OpenEMR\Modules\NewClinic\Services\AdminDuplicateReviewService;
use OpenEMR\Modules\NewClinic\Services\AdminListEditorService;
use OpenEMR\Modules\NewClinic\Services\AuditLogService;
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
        'admin.fee.bulk_price',
        'admin.lists.catalog',
        'admin.lists.options',
        'admin.lists.save',
        'admin.lists.set_active',
        'admin.duplicates.list',
        'admin.directory.save',
        'admin.directory.delete',
        'admin.facility.save',
        'admin.roles.grant_self',
        'admin.roles.templates',
        'admin.staff.list',
        'admin.staff.create',
        'admin.staff.deactivate',
        'admin.staff.access_summary',
        'admin.audit.query',
        'admin.audit.detail',
        'admin.audit.export',
        'admin.backup.verify',
        'admin.backup.export_recovery_key',
        'admin.facility_user.list',
        'admin.facility_user.get',
        'admin.facility_user.save',
        'admin.facility_user.matrix',
        'admin.staff.get',
        'admin.staff.update',
        'admin.staff.reset_password',
        'admin.staff.locked_list',
        'admin.staff.unlock',
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
        'admin.his_pack_status',
        'admin.his_pack_import',
        'admin.health_status',
        'admin.perf.summary',
        'admin.backup.run',
        'admin.backup.run_files',
        'admin.backup.complete',
        'admin.setup.mark_item',
        'admin.setup.unmark_item',
        'admin.setup.complete',
        'admin.setup.reopen',
        'admin.setup.provision_staff',
        'admin.config.export',
        'admin.config.import',
        'admin.patient_import.chunk',
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
                case 'admin.directory.save':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $contacts = $this->host->svc(DirectoryContactService::class)->save(
                        (array) ($body['contact'] ?? $body),
                        $userId
                    );
                    $this->host->respond(true, 'Contact saved', ['directory_contacts' => $contacts]);
                    break;
                case 'admin.directory.delete':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $contacts = $this->host->svc(DirectoryContactService::class)->delete(
                        (int) ($body['id'] ?? 0),
                        $userId
                    );
                    $this->host->respond(true, 'Contact deleted', ['directory_contacts' => $contacts]);
                    break;
                case 'admin.facility.save':
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
                    $result = $this->host->svc(ClinicAdminService::class)->saveFacility(
                        (array) ($body['facility'] ?? $body),
                        $userId,
                        $scope,
                        $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->host->respond(true, 'Facility saved', $result);
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
                case 'admin.fee.bulk_price':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $facilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $dryRun = !empty($body['dry_run']);
                    try {
                        $payload = $this->host->svc(FeeScheduleAdminService::class)->bulkPriceUpdate(
                            $facilityId,
                            (array) ($body['bulk'] ?? $body),
                            $userId,
                            $dryRun
                        );
                        $this->host->respond(true, $dryRun ? 'ok' : 'Prices updated', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid'], 400);
                    }
                    break;
                case 'admin.lists.catalog':
                    $this->host->respond(true, 'ok', [
                        'lists' => $this->host->svc(AdminListEditorService::class)->getCatalog(),
                    ]);
                    break;
                case 'admin.lists.options':
                    try {
                        $options = $this->host->svc(AdminListEditorService::class)
                            ->getOptions((string) ($_REQUEST['list_id'] ?? ''));
                        $this->host->respond(true, 'ok', ['options' => $options]);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid'], 400);
                    }
                    break;
                case 'admin.lists.save':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $options = $this->host->svc(AdminListEditorService::class)->saveOption(
                            (string) ($body['list_id'] ?? ''),
                            (array) ($body['option'] ?? []),
                            $userId
                        );
                        $this->host->respond(true, 'Saved', ['options' => $options]);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid'], 400);
                    }
                    break;
                case 'admin.lists.set_active':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $options = $this->host->svc(AdminListEditorService::class)->setActive(
                            (string) ($body['list_id'] ?? ''),
                            (string) ($body['option_id'] ?? ''),
                            !empty($body['active']),
                            $userId
                        );
                        $this->host->respond(true, 'Updated', ['options' => $options]);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid'], 400);
                    }
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
                case 'admin.audit.query':
                    $this->host->respond(true, 'ok', $this->host->svc(AuditLogService::class)->query($_REQUEST));
                    break;
                case 'admin.audit.detail':
                    try {
                        $this->host->respond(true, 'ok', $this->host->svc(AuditLogService::class)->detail((int) ($_REQUEST['id'] ?? 0)));
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'not_found'], 404);
                    }
                    break;
                case 'admin.audit.export':
                    $this->host->respond(true, 'ok', $this->host->svc(AuditLogService::class)->export($_REQUEST));
                    break;
                case 'admin.backup.verify':
                    try {
                        $result = $this->host->svc(AdminBackupService::class)->verifyBackup((int) ($_REQUEST['run_id'] ?? 0));
                        $this->host->respond(true, 'ok', $result);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'admin.backup.export_recovery_key':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $result = $this->host->svc(AdminBackupService::class)->exportRecoveryKey($userId);
                        $this->host->respond(true, 'ok', $result);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'admin.duplicates.list':
                    $this->host->respond(true, 'ok', $this->host->svc(AdminDuplicateReviewService::class)->getReview());
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
                        $userId,
                        !empty($body['require_change'])
                    );
                    $this->host->respond(true, 'Password reset');
                    break;
                case 'admin.staff.locked_list':
                    $this->host->respond(true, 'ok', $this->host->svc(StaffAdminService::class)->listLockedAccounts());
                    break;
                case 'admin.staff.unlock':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $targetUserId = (int) ($body['user_id'] ?? 0);
                    if ($targetUserId <= 0) {
                        $this->host->respond(false, 'user_id required', [], 400);
                    }
                    $this->host->respond(
                        true,
                        'Account unlocked',
                        $this->host->svc(StaffAdminService::class)->unlockAccount($targetUserId, $userId)
                    );
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
                    $runDate = $this->host->validDay($body['run_date'] ?? '', date('Y-m-d'));
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
                case 'admin.his_pack_status':
                    $this->host->respond(true, 'ok', $this->host->svc(HisPackImportService::class)->getStatus());
                    break;
                case 'admin.his_pack_import':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $result = $this->host->svc(HisPackImportService::class)->applyGhanaOpdPack($userId);
                    $this->host->respond(true, 'ok', $result);
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
                case 'admin.perf.summary':
                    // SCALE-4.5 — read-only perf visibility for the Admin Hub
                    // System tab. Day defaults to yesterday in the service.
                    $params = $this->host->readRequestParams($method);
                    $this->host->respond(true, 'ok', $this->host->svc(PerfCounterService::class)->summary(
                        (string) ($params['day'] ?? '')
                    ));
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
                    // BACKUP-H1(b)/M2 — a real encrypted backup can take a while
                    // (mysqldump + gzip + encrypt); don't hold the exclusive PHP
                    // session-file lock for the whole request, or every other tab/
                    // request from this same user serializes behind it (SCALE-1.1).
                    // Reads of $_SESSION after close are still fine — only writes
                    // are dropped, and nothing below writes to the session.
                    if (session_status() === PHP_SESSION_ACTIVE) {
                        session_write_close();
                    }
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
                case 'admin.backup.run_files':
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
                    // BACKUP-H1(b)/M2 — a first-run site-files mirror of a large
                    // documents tree can take a while; same session-lock release as
                    // admin.backup.run above.
                    if (session_status() === PHP_SESSION_ACTIVE) {
                        session_write_close();
                    }
                    try {
                        $payload = $this->host->svc(ClinicAdminService::class)->initiateFilesBackupRun(
                            $scope,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->host->respond(true, 'Site-files backup complete', $payload);
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
                    // M2 — same session-lock release; this write only touches
                    // admin_hub_backup_run, never $_SESSION.
                    if (session_status() === PHP_SESSION_ACTIVE) {
                        session_write_close();
                    }
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
                case 'admin.setup.unmark_item':
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
                        $svc = $this->host->svc(ClinicAdminService::class);
                        $facilityArg = $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null;
                        $payload = $action === 'admin.setup.unmark_item'
                            ? $svc->unmarkSetupItem($scope, $checklistKey, $userId, $facilityArg)
                            : $svc->markSetupItem($scope, $checklistKey, $userId, $facilityArg);
                        $this->host->respond(
                            true,
                            $action === 'admin.setup.unmark_item' ? 'Setup item unmarked' : 'Setup item marked',
                            $payload
                        );
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
                case 'admin.setup.reopen':
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
                    $payload = $this->host->svc(ClinicAdminService::class)->reopenSetup(
                        $scope,
                        $userId,
                        $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->host->respond(true, 'Setup reopened', $payload);
                    break;
                case 'admin.setup.provision_staff':
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
                        $payload = $this->host->svc(ClinicAdminService::class)->provisionSetupStaff(
                            $scope,
                            $userId,
                            $scope === 'facility' && $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->host->respond(true, 'Starter sign-ins created', $payload);
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
                case 'admin.patient_import.chunk':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    // Facility comes from the session ONLY — never the client body — so a
                    // tampered request can't import into a facility the caller doesn't
                    // actually belong to.
                    $importFacilityId = (int) ($_SESSION['facilityId'] ?? 0);
                    if (!$this->host->svc(ClinicConfigService::class)->isEnabled('enable_patient_import', 0, $importFacilityId)) {
                        $this->host->respond(false, 'Patient import is not enabled', [], 403);
                    }
                    // prior_keys carries identity keys accepted by earlier chunks of the
                    // same run (M2) so cross-chunk repeats are predicted as duplicates
                    // too — validated defensively since it comes straight from the
                    // client body: only known buckets, only string members, capped at
                    // 5000 keys total so a hostile/oversized body can't blow up memory.
                    $priorKeys = ['name_dob' => [], 'name_phone' => [], 'national_id' => []];
                    $rawPriorKeys = $body['prior_keys'] ?? null;
                    if (is_array($rawPriorKeys)) {
                        $totalPriorKeys = 0;
                        foreach (array_keys($priorKeys) as $bucket) {
                            $rawBucket = $rawPriorKeys[$bucket] ?? null;
                            if (!is_array($rawBucket)) {
                                continue;
                            }
                            foreach ($rawBucket as $key) {
                                if ($totalPriorKeys >= 5000) {
                                    break 2;
                                }
                                if (is_string($key) && $key !== '') {
                                    $priorKeys[$bucket][] = $key;
                                    $totalPriorKeys++;
                                }
                            }
                        }
                    }
                    $importPayload = $this->host->svc(PatientImportService::class)->processChunk(
                        is_array($body['rows'] ?? null) ? $body['rows'] : [],
                        !empty($body['dry_run']),
                        $userId,
                        $importFacilityId,
                        $priorKeys
                    );
                    $this->host->respond(true, 'ok', $importPayload);
                    break;

            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}

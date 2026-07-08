<?php

/**
 * JSON ACL administration for People & access React surfaces.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclExtended;
use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Services\UserService;

class AclAdminService
{
    public function __construct(
        private readonly StaffAdminService $staffAdmin = new StaffAdminService(),
    ) {
    }

    public function assertCanManageAcl(): void
    {
        $this->staffAdmin->assertCanManageStaff();
        if (!AclMain::aclCheckCore('admin', 'acl')) {
            throw new \RuntimeException('ACL administration permission required', 403);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function listUsers(): array
    {
        $this->assertCanManageAcl();

        $rows = QueryUtils::fetchRecords(
            "SELECT id, username, fname, lname FROM users WHERE username != '' AND active = 1 ORDER BY username ASC"
        ) ?: [];

        $users = [];
        foreach ($rows as $row) {
            $username = (string) ($row['username'] ?? '');
            if ($username === '' || !AclExtended::iHavePermissionsOf($username)) {
                continue;
            }
            $groups = AclExtended::aclGetGroupTitles($username) ?: [];
            $users[] = [
                'id' => (int) ($row['id'] ?? 0),
                'username' => $username,
                'display_name' => trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? '')),
                'no_membership' => $groups === [],
            ];
        }

        return ['users' => $users];
    }

    /**
     * @return array<string, mixed>
     */
    public function getMembership(string $username): array
    {
        $this->assertCanManageAcl();
        $username = trim($username);
        if ($username === '') {
            throw new \InvalidArgumentException('username required');
        }
        if (!AclExtended::iHavePermissionsOf($username)) {
            throw new \RuntimeException('Not authorized to view this user', 403);
        }

        return [
            'username' => $username,
            'active' => $this->buildGroupList($username, true),
            'inactive' => $this->buildGroupList($username, false),
        ];
    }

    /**
     * @param list<string> $groups
     * @return array<string, mixed>
     */
    public function addMembership(string $username, array $groups): array
    {
        $this->assertCanManageAcl();
        $username = trim($username);
        $groups = array_values(array_filter(array_map('strval', $groups)));
        if ($username === '' || $groups === []) {
            throw new \InvalidArgumentException('username and groups required');
        }
        if (!AclExtended::iHavePermissionsOf($username)) {
            throw new \RuntimeException('Not authorized to modify this user', 403);
        }

        $warnings = [];
        if (in_array('Emergency Login', $groups, true)) {
            $warnings[] = xl(
                'Emergency Login ACL is chosen. De-activate the user until required during emergency situations.'
            );
        }

        AclExtended::addUserAros($username, $groups);
        EventAuditLogger::getInstance()->newEvent(
            'security-administration-update',
            $_SESSION['authUser'] ?? '',
            $_SESSION['authProvider'] ?? '',
            1,
            'Added ' . $username . ' to following access group(s): ' . implode(', ', $groups)
        );

        $payload = $this->getMembership($username);
        $payload['warnings'] = $warnings;

        return $payload;
    }

    /**
     * @param list<string> $groups
     * @return array<string, mixed>
     */
    public function removeMembership(string $username, array $groups): array
    {
        $this->assertCanManageAcl();
        $username = trim($username);
        $groups = array_values(array_filter(array_map('strval', $groups)));
        if ($username === '' || $groups === []) {
            throw new \InvalidArgumentException('username and groups required');
        }
        if (!AclExtended::iHavePermissionsOf($username)) {
            throw new \RuntimeException('Not authorized to modify this user', 403);
        }

        $warnings = [];
        $userNametoID = (new UserService())->getIdByUsername($username);
        $gaclProtect = checkUserSetting('gacl_protect', '1', $userNametoID) || $username === 'admin';
        if ($gaclProtect && in_array('Administrators', $groups, true)) {
            $warnings[] = xl('Not allowed to remove this user from the Administrators group') . '!';
        }

        AclExtended::removeUserAros($username, $groups);
        EventAuditLogger::getInstance()->newEvent(
            'security-administration-update',
            $_SESSION['authUser'] ?? '',
            $_SESSION['authProvider'] ?? '',
            1,
            'Removed ' . $username . ' from following access group(s): ' . implode(', ', $groups)
        );

        $payload = $this->getMembership($username);
        $payload['warnings'] = $warnings;

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    public function listGroups(): array
    {
        $this->assertCanManageAcl();

        $xml = $this->loadXml(AclExtended::aclListingsXml([]));
        $groups = [];
        foreach ($xml->acl as $acl) {
            $groups[] = [
                'value' => (string) ($acl->value ?? ''),
                'title' => (string) ($acl->title ?? ''),
                'return_value' => (string) ($acl->returnid ?? ''),
                'return_title' => (string) ($acl->returntitle ?? ''),
                'note' => (string) ($acl->note ?? ''),
            ];
        }

        return ['groups' => $groups];
    }

    /**
     * @return array<string, mixed>
     */
    public function getGroupPermissions(string $groupTitle, string $returnValue): array
    {
        $this->assertCanManageAcl();
        $groupTitle = trim($groupTitle);
        $returnValue = trim($returnValue);
        if ($groupTitle === '' || $returnValue === '') {
            throw new \InvalidArgumentException('group and return_value required');
        }

        return [
            'group' => $groupTitle,
            'return_value' => $returnValue,
            'active' => $this->buildAcoSections($groupTitle, $returnValue, true),
            'inactive' => $this->buildAcoSections($groupTitle, $returnValue, false),
        ];
    }

    /**
     * @param list<string|int> $acoIds
     * @return array<string, mixed>
     */
    public function addGroupPermissions(string $groupTitle, string $returnValue, array $acoIds): array
    {
        $this->assertCanManageAcl();
        $groupTitle = trim($groupTitle);
        $returnValue = trim($returnValue);
        $acoIds = array_values(array_filter(array_map('strval', $acoIds)));
        if ($groupTitle === '' || $returnValue === '' || $acoIds === []) {
            throw new \InvalidArgumentException('group, return_value, and aco_ids required');
        }

        AclExtended::aclAddAcos($groupTitle, $returnValue, $acoIds);
        EventAuditLogger::getInstance()->newEvent(
            'security-administration-update',
            $_SESSION['authUser'] ?? '',
            $_SESSION['authProvider'] ?? '',
            1,
            'Added ACOs to group ' . $groupTitle . ': ' . implode(', ', $acoIds)
        );

        return $this->getGroupPermissions($groupTitle, $returnValue);
    }

    /**
     * @param list<string|int> $acoIds
     * @return array<string, mixed>
     */
    public function removeGroupPermissions(string $groupTitle, string $returnValue, array $acoIds): array
    {
        $this->assertCanManageAcl();
        $groupTitle = trim($groupTitle);
        $returnValue = trim($returnValue);
        $acoIds = array_values(array_filter(array_map('strval', $acoIds)));
        if ($groupTitle === '' || $returnValue === '' || $acoIds === []) {
            throw new \InvalidArgumentException('group, return_value, and aco_ids required');
        }

        $warnings = [];
        if ($groupTitle === 'Administrators') {
            $warnings[] = xl('Not allowed to inactivate anything from the Administrators ACL') . '!';
        } else {
            AclExtended::aclRemoveAcos($groupTitle, $returnValue, $acoIds);
            EventAuditLogger::getInstance()->newEvent(
                'security-administration-update',
                $_SESSION['authUser'] ?? '',
                $_SESSION['authProvider'] ?? '',
                1,
                'Removed ACOs from group ' . $groupTitle . ': ' . implode(', ', $acoIds)
            );
        }

        $payload = $this->getGroupPermissions($groupTitle, $returnValue);
        $payload['warnings'] = $warnings;

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    public function listReturnValues(): array
    {
        $this->assertCanManageAcl();

        $xml = $this->loadXml(AclExtended::returnValuesXml([]));
        $returns = [];
        foreach ($xml->return as $return) {
            $returns[] = [
                'return_value' => (string) ($return->returnid ?? ''),
                'title' => (string) ($return->returntitle ?? ''),
            ];
        }

        return ['return_values' => $returns];
    }

    /**
     * @return array<string, mixed>
     */
    public function createGroup(string $title, string $identifier, string $returnValue, string $description): array
    {
        $this->assertCanManageAcl();

        $title = trim($title);
        $identifier = trim($identifier);
        $returnValue = trim($returnValue);
        $description = trim($description);

        if ($title === '' || $identifier === '' || $returnValue === '' || $description === '') {
            throw new \InvalidArgumentException('title, identifier, return_value, and description are required');
        }
        if (!ctype_alpha(str_replace(' ', '', $title))) {
            throw new \InvalidArgumentException('Title may only contain alphabetic characters and spaces');
        }
        if (!ctype_alpha($identifier)) {
            throw new \InvalidArgumentException('Identifier may only contain alphabetic characters with no spaces');
        }
        if (!ctype_alpha(str_replace(' ', '', $description))) {
            throw new \InvalidArgumentException('Description may only contain alphabetic characters and spaces');
        }
        if (AclExtended::aclExist($title, false, $returnValue)) {
            throw new \InvalidArgumentException('Title already used for this return value');
        }
        if (AclExtended::aclExist(false, $identifier, $returnValue)) {
            throw new \InvalidArgumentException('Identifier already used for this return value');
        }

        AclExtended::aclAdd($title, $identifier, $returnValue, $description);
        EventAuditLogger::getInstance()->newEvent(
            'security-administration-update',
            $_SESSION['authUser'] ?? '',
            $_SESSION['authProvider'] ?? '',
            1,
            'Created ACL group ' . $title
        );

        return $this->listGroups();
    }

    /**
     * @return array<string, mixed>
     */
    public function removeGroup(string $title, string $returnValue): array
    {
        $this->assertCanManageAcl();

        $title = trim($title);
        $returnValue = trim($returnValue);
        if ($title === '' || $returnValue === '') {
            throw new \InvalidArgumentException('title and return_value required');
        }
        if ($title === 'Administrators') {
            throw new \InvalidArgumentException('Not allowed to delete the Administrators group');
        }

        AclExtended::aclRemove($title, $returnValue);
        EventAuditLogger::getInstance()->newEvent(
            'security-administration-update',
            $_SESSION['authUser'] ?? '',
            $_SESSION['authProvider'] ?? '',
            1,
            'Removed ACL group ' . $title
        );

        return $this->listGroups();
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function buildGroupList(string $username, bool $active): array
    {
        $allGroups = AclExtended::aclGetGroupTitleList();
        $userGroups = AclExtended::aclGetGroupTitles($username) ?: [];
        $list = [];

        foreach ($allGroups as $value) {
            $isMember = $userGroups && in_array($value, $userGroups, true);
            if ($active !== $isMember) {
                continue;
            }
            $list[] = [
                'value' => $value,
                'label' => xl_gacl_group($value),
            ];
        }

        return $list;
    }

    /**
     * @return list<array{name: string, acos: list<array{id: string, title: string}>}>
     */
    private function buildAcoSections(string $groupTitle, string $returnValue, bool $active): array
    {
        $xml = $this->loadXml(AclExtended::acoListingsXml($groupTitle, $returnValue, []));
        $bucket = $active ? $xml->active : $xml->inactive;
        $sections = [];

        foreach ($bucket->section as $section) {
            $acos = [];
            foreach ($section->aco as $aco) {
                $acos[] = [
                    'id' => (string) ($aco->id ?? ''),
                    'title' => (string) ($aco->title ?? ''),
                ];
            }
            if ($acos === []) {
                continue;
            }
            $sections[] = [
                'name' => (string) ($section->name ?? ''),
                'acos' => $acos,
            ];
        }

        return $sections;
    }

    private function loadXml(string $xmlString): \SimpleXMLElement
    {
        $xml = simplexml_load_string($xmlString);
        if ($xml === false) {
            throw new \RuntimeException('Invalid ACL XML response');
        }

        return $xml;
    }
}

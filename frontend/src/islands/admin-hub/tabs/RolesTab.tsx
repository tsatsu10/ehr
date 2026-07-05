import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import type { AclInventoryRow, RoleGroup, SensitivePermission } from '../adminTypes';

interface RolesTabProps {
  webroot: string;
  roleGroups: RoleGroup[];
  sensitivePermissions: SensitivePermission[];
  aclInventory: AclInventoryRow[];
  onGrantSelf: () => void;
  granting: boolean;
}

function RoleGroupsTable({ groups }: { groups: RoleGroup[] }) {
  if (!groups.length) {
    return <div className="text-[var(--oe-nc-text-muted)]"><em>No New Clinic role groups found.</em></div>;
  }

  return groups.map((group) => {
    const activeMembers = (group.members ?? []).filter((m) => m.active);
    return (
      <Card className="mb-2" key={group.group_title}>
        <CardContent className="py-2">
          <div className="flex justify-between flex-wrap">
            <strong>{group.group_title}</strong>
            <Badge variant="neutral">{group.member_count} members</Badge>
          </div>
          <div className="text-sm mt-1">
            {!activeMembers.length ? (
              <span className="text-[var(--oe-nc-text-muted)]"><em>No active members</em></span>
            ) : (
              activeMembers.map((member, i) => (
                <span key={member.username}>
                  {i > 0 ? ', ' : ''}
                  {member.display_name || member.username}
                  <span className="text-[var(--oe-nc-text-muted)]"> ({member.username})</span>
                </span>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    );
  });
}

function SensitiveTable({ items }: { items: SensitivePermission[] }) {
  if (!items.length) {
    return <div className="text-[var(--oe-nc-text-muted)]"><em>No sensitive permissions configured.</em></div>;
  }

  return (
    <Table className={ncShadcnTableClass({ bordered: true })}>
      <TableHeader>
        <TableRow>
          <TableHead>Permission</TableHead>
          <TableHead>Granted to groups</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((row) => (
          <TableRow key={row.aco_key}>
            <TableCell>
              <code>{row.aco_key}</code>
              <br />
              <span className="text-sm text-[var(--oe-nc-text-muted)]">{row.aco_title}</span>
            </TableCell>
            <TableCell>{(row.granted_groups ?? []).join(', ') || '—'}</TableCell>
            <TableCell className="text-sm">{row.note ?? ''}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AclInventoryTable({ rows }: { rows: AclInventoryRow[] }) {
  if (!rows.length) {
    return <div className="text-[var(--oe-nc-text-muted)]"><em>No ACL keys found.</em></div>;
  }

  return (
    <Table className={ncShadcnTableClass({ bordered: true })}>
      <TableHeader>
        <TableRow>
          <TableHead>ACL key</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Groups</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.aco_key}>
            <TableCell><code>{row.aco_key}</code></TableCell>
            <TableCell>{row.aco_title}</TableCell>
            <TableCell className="text-sm">{(row.granted_groups ?? []).join(', ') || '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function RolesTab({
  webroot,
  roleGroups,
  sensitivePermissions,
  aclInventory,
  onGrantSelf,
  granting,
}: RolesTabProps) {
  return (
    <>
      <Card className="mb-3">
        <CardContent>
          <p className="text-[var(--oe-nc-text-muted)] mb-2">Manage staff accounts and ACL assignments in core OpenEMR admin.</p>
          <p className={deskCalloutClass('info', 'py-2 text-sm mb-2')}>
            To turn on Lab or Pharmacy desks, use the Queue & roles tab and check Enable lab desk /
            Enable pharmacy desk, then Save changes.
          </p>
          <Button variant="outline" size="sm" className="mr-2" asChild>
            <a
              href={`${webroot}/interface/usergroup/usergroup_admin.php`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Manage users
            </a>
          </Button>
          <Button variant="outline" size="sm" className="mr-2" asChild>
            <a
              href={`${webroot}/interface/usergroup/adminacl.php`}
              target="_blank"
              rel="noopener noreferrer"
            >
              ACL editor
            </a>
          </Button>
          <Button
            type="button"
            variant="warning"
            size="sm"
            id="nc-admin-grant-self-roles"
            disabled={granting}
            onClick={onGrantSelf}
          >
            {granting ? 'Granting…' : 'Grant New Clinic roles to my account'}
          </Button>
          <small className="form-text text-[var(--oe-nc-text-muted)] mt-2">
            Grants desk groups for pilot testing. Log out and back in afterward.
          </small>
        </CardContent>
      </Card>
      <div id="nc-admin-roles">
        <RoleGroupsTable groups={roleGroups} />
      </div>
      <h5 className="mt-4">Sensitive permissions</h5>
      <div id="nc-admin-sensitive">
        <SensitiveTable items={sensitivePermissions} />
      </div>
      <h5 className="mt-4">ACL inventory</h5>
      <div id="nc-admin-acl-inventory">
        <AclInventoryTable rows={aclInventory} />
      </div>
    </>
  );
}

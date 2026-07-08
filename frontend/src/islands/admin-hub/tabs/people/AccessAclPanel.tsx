import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Shield, Users } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import type { AclInventoryRow, RoleGroup, SensitivePermission } from '../../adminTypes';
import { AdminEmptyState, AdminSection, AdminStack } from '../../adminUi';
import { GUIDED_ACL_TASKS } from '../../guidedAclTasks';
import { PeopleActionHub, PeopleInfoCallout } from '../../peopleUi';
import type { PeopleViewId } from '../../peopleViewRouting';
import type { PeopleSubTabId } from '../../peopleTypes';

function RoleGroupsTable({ groups }: { groups: RoleGroup[] }) {
  if (!groups.length) {
    return <AdminEmptyState title="No New Clinic role groups found" />;
  }

  return groups.map((group) => {
    const activeMembers = (group.members ?? []).filter((m) => m.active);
    return (
      <AdminSection
        key={group.group_title}
        title={group.group_title}
        variant="muted"
        action={<Badge variant="neutral">{group.member_count} members</Badge>}
        bodyClassName="py-2"
      >
        <div className="text-sm">
          {!activeMembers.length ? (
            <span className="text-[var(--oe-nc-text-muted)]">No active members</span>
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
      </AdminSection>
    );
  });
}

function SensitiveTable({ items }: { items: SensitivePermission[] }) {
  if (!items.length) {
    return <AdminEmptyState title="No sensitive permissions configured" />;
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
    return <AdminEmptyState title="No ACL keys found" />;
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

interface AccessAclPanelProps {
  roleGroups: RoleGroup[];
  sensitivePermissions: SensitivePermission[];
  aclInventory: AclInventoryRow[];
  onOpenView: (view: PeopleViewId, destinationSub: PeopleSubTabId) => void;
  onGoQueueTab: () => void;
  developerTools?: React.ReactNode;
}

export function AccessAclPanel({
  roleGroups,
  sensitivePermissions,
  aclInventory,
  onOpenView,
  onGoQueueTab,
  developerTools,
}: AccessAclPanelProps) {
  const guidedActions = GUIDED_ACL_TASKS.map((task) => ({
    id: task.id,
    view: task.view,
    title: task.title,
    description: task.description,
    actionLabel: task.actionLabel,
    destinationSub: task.sub,
    tone: task.tone,
    icon: task.icon,
  }));

  return (
    <AdminStack>
      <AdminSection
        title="Guided ACL tasks"
        description="Each task opens a dedicated editor on the People sub-tab best suited for that job."
        icon={<Users className="h-4 w-4" aria-hidden />}
      >
        <PeopleInfoCallout>
          To turn on Lab or Pharmacy desks, use{' '}
          <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={onGoQueueTab}>
            Queue & roles
          </Button>
          {' '}and enable the desk, then Save changes.
        </PeopleInfoCallout>
        <div className="mt-3">
          <PeopleActionHub
            actions={guidedActions}
            onOpen={(view, destinationSub) => onOpenView(view as PeopleViewId, destinationSub)}
          />
        </div>
      </AdminSection>

      {developerTools}

      <div id="nc-admin-roles">
        <RoleGroupsTable groups={roleGroups} />
      </div>

      <AdminSection
        title="Sensitive permissions"
        icon={<Shield className="h-4 w-4" aria-hidden />}
        id="nc-admin-sensitive"
      >
        <p className={deskCalloutClass('info', 'text-sm mb-3')}>
          These permissions bypass normal workflow guardrails. Grant sparingly.
        </p>
        <SensitiveTable items={sensitivePermissions} />
      </AdminSection>

      <AdminSection title="ACL inventory" id="nc-admin-acl-inventory">
        <AclInventoryTable rows={aclInventory} />
      </AdminSection>
    </AdminStack>
  );
}

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
    return <div className="text-muted"><em>No New Clinic role groups found.</em></div>;
  }

  return groups.map((group) => {
    const activeMembers = (group.members ?? []).filter((m) => m.active);
    return (
      <div className="card mb-2" key={group.group_title}>
        <div className="card-body py-2">
          <div className="d-flex justify-content-between flex-wrap">
            <strong>{group.group_title}</strong>
            <span className="badge badge-secondary">{group.member_count} members</span>
          </div>
          <div className="small mt-1">
            {!activeMembers.length ? (
              <span className="text-muted"><em>No active members</em></span>
            ) : (
              activeMembers.map((member, i) => (
                <span key={member.username}>
                  {i > 0 ? ', ' : ''}
                  {member.display_name || member.username}
                  <span className="text-muted"> ({member.username})</span>
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    );
  });
}

function SensitiveTable({ items }: { items: SensitivePermission[] }) {
  if (!items.length) {
    return <div className="text-muted"><em>No sensitive permissions configured.</em></div>;
  }

  return (
    <table className="table table-sm table-bordered">
      <thead>
        <tr>
          <th>Permission</th>
          <th>Granted to groups</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.aco_key}>
            <td>
              <code>{row.aco_key}</code>
              <br />
              <span className="small text-muted">{row.aco_title}</span>
            </td>
            <td>{(row.granted_groups ?? []).join(', ') || '—'}</td>
            <td className="small">{row.note ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AclInventoryTable({ rows }: { rows: AclInventoryRow[] }) {
  if (!rows.length) {
    return <div className="text-muted"><em>No ACL keys found.</em></div>;
  }

  return (
    <table className="table table-sm table-bordered">
      <thead>
        <tr>
          <th>ACL key</th>
          <th>Title</th>
          <th>Groups</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.aco_key}>
            <td><code>{row.aco_key}</code></td>
            <td>{row.aco_title}</td>
            <td className="small">{(row.granted_groups ?? []).join(', ') || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
      <div className="card mb-3">
        <div className="card-body">
          <p className="text-muted mb-2">Manage staff accounts and ACL assignments in core OpenEMR admin.</p>
          <p className="alert alert-info py-2 small">
            To turn on Lab or Pharmacy desks, use the Queue & roles tab and check Enable lab desk /
            Enable pharmacy desk, then Save changes.
          </p>
          <a
            className="btn btn-outline-primary btn-sm mr-2"
            href={`${webroot}/interface/usergroup/usergroup_admin.php`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Manage users
          </a>
          <a
            className="btn btn-outline-secondary btn-sm mr-2"
            href={`${webroot}/interface/usergroup/adminacl.php`}
            target="_blank"
            rel="noopener noreferrer"
          >
            ACL editor
          </a>
          <button
            type="button"
            className="btn btn-warning btn-sm"
            id="nc-admin-grant-self-roles"
            disabled={granting}
            onClick={onGrantSelf}
          >
            {granting ? 'Granting…' : 'Grant New Clinic roles to my account'}
          </button>
          <small className="form-text text-muted mt-2">
            Grants desk groups for pilot testing. Log out and back in afterward.
          </small>
        </div>
      </div>
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

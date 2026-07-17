import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { CalendarDays } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import type { VisitTypeRow } from '../adminTypes';
import { profileLabel } from '../adminUtils';
import { AdminEmptyState, AdminSection } from '../adminUi';

interface VisitTypesTabProps {
  visitTypes: VisitTypeRow[];
  onAdd: () => void;
  onEdit: (row: VisitTypeRow) => void;
  onArchive: (row: VisitTypeRow) => void;
}

export function VisitTypesTab({
  visitTypes,
  onAdd,
  onEdit,
  onArchive,
}: VisitTypesTabProps) {
  return (
    <AdminSection
      title="Visit types"
      description="What patients can be booked or checked in as — shown on both Scheduling and Front Desk."
      icon={<CalendarDays className="h-4 w-4" aria-hidden />}
      action={
        <Button
          type="button"
          size="sm"
          id="nc-admin-add-visit-type"
          onClick={onAdd}
        >
          Add visit type
        </Button>
      }
    >
      <div id="nc-admin-visit-types">
        {!visitTypes.length ? (
          <AdminEmptyState title="No visit types configured" />
        ) : (
            <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitTypes.map((row) => {
                  const status = row.is_active
                    ? (row.is_default ? <Badge>Default</Badge> : 'Active')
                    : <span className="text-[var(--oe-nc-text-muted)]">Archived</span>;
                  return (
                    <TableRow key={row.id} className={row.is_active ? '' : 'text-[var(--oe-nc-text-muted)]'}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell>{profileLabel(row.service_profile)}</TableCell>
                      <TableCell className="text-sm">{row.scope_label ?? ''}</TableCell>
                      <TableCell>{status}</TableCell>
                      <TableCell className="text-nowrap">
                        {row.is_active && (
                          <>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto p-0 mr-2 nc-admin-edit-type"
                              onClick={() => onEdit(row)}
                            >
                              Edit
                            </Button>
                            {!row.is_default && (
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-destructive nc-admin-archive-type"
                                onClick={() => onArchive(row)}
                              >
                                Archive
                              </Button>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
    </AdminSection>
  );
}

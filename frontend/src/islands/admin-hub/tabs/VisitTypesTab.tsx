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
import type { CalendarCategory, VisitTypeRow } from '../adminTypes';
import { categoryLabel, profileLabel } from '../adminUtils';

interface VisitTypesTabProps {
  visitTypes: VisitTypeRow[];
  calendarCategories: CalendarCategory[];
  onAdd: () => void;
  onEdit: (row: VisitTypeRow) => void;
  onArchive: (row: VisitTypeRow) => void;
}

export function VisitTypesTab({
  visitTypes,
  calendarCategories,
  onAdd,
  onEdit,
  onArchive,
}: VisitTypesTabProps) {
  return (
    <Card>
      <CardContent>
        <div className="flex justify-between items-center mb-3">
          <p className="text-[var(--oe-nc-text-muted)] mb-0">Visit types map to calendar categories for encounters.</p>
          <Button
            type="button"
            size="sm"
            id="nc-admin-add-visit-type"
            onClick={onAdd}
          >
            Add visit type
          </Button>
        </div>
        <div id="nc-admin-visit-types">
          {!visitTypes.length ? (
            <div className="text-[var(--oe-nc-text-muted)]"><em>No visit types configured.</em></div>
          ) : (
            <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Calendar category</TableHead>
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
                      <TableCell>{categoryLabel(row.pc_catid, calendarCategories)}</TableCell>
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
      </CardContent>
    </Card>
  );
}

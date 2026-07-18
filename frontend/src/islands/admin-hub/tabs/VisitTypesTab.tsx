import { useMemo, useState } from 'react';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
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
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(true);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return visitTypes.filter((row) => {
      if (!showArchived && !row.is_active) {
        return false;
      }
      if (needle === '') {
        return true;
      }
      return row.label.toLowerCase().includes(needle)
        || profileLabel(row.service_profile).toLowerCase().includes(needle);
    });
  }, [query, showArchived, visitTypes]);

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
        {visitTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <Input
              type="search"
              className="h-8"
              style={{ maxWidth: '16rem' }}
              placeholder="Search visit types…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search visit types"
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="nc-admin-visit-type-show-archived"
                checked={showArchived}
                onCheckedChange={(checked) => setShowArchived(checked === true)}
              />
              <Label htmlFor="nc-admin-visit-type-show-archived" className="font-normal normal-case cursor-pointer mb-0">
                Show archived
              </Label>
            </div>
            <span className="text-sm text-[var(--oe-nc-text-muted)]">
              {filtered.length} of {visitTypes.length} visit type{visitTypes.length === 1 ? '' : 's'}
            </span>
          </div>
        )}
        {!visitTypes.length ? (
          <AdminEmptyState title="No visit types configured" />
        ) : filtered.length === 0 ? (
          <AdminEmptyState
            title="No visit types match this filter"
            description="Try a different search, or turn on Show archived."
          />
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
                {filtered.map((row) => {
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
